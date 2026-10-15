const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { fixture } = require("./browser-fixture");
(async () => {
  const f = await fixture(),
    out = process.env.DFDF_MODEL_OUTPUT || "test-results/agent-models";
  fs.mkdirSync(out, { recursive: true });
  try {
    const warnings = [];
    const page = await f.page(
      "model_review",
      { width: 960, height: 800 },
      {},
      {
        path: "/play.html?model-review=1",
        beforeLoad: async (p) =>
          p.on("console", (m) => {
            if (m.type() === "warning" || m.type() === "error")
              warnings.push(m.text());
          }),
      },
    );
    await page.waitForFunction(() => !!window.AGENT_REVIEW, null, {
      timeout: 60000,
    });
    await page.evaluate(
      () => (document.querySelector(".am-toolbar").style.visibility = "hidden"),
    );
    assert.equal(
      await page.evaluate(() => Object.keys(AGENT_MODELS.catalog).length),
      40,
    );
    assert.equal(await page.evaluate(() => AGENT_MODELS.style), "voxel");
    const ids = await page.evaluate(() => AGENTS.map((a) => a.key)),
      results = [];
    const sourceAbilities = await page.evaluate(() =>
      JSON.stringify(AGENTS.map((a) => a.abilities)),
    );
    for (const id of ids) {
      const result = await page.evaluate((id) => {
        const view = AGENT_REVIEW;
        view.setPose("inspect");
        view.select(id);
        view.setAngle(0);
        view.render(0);
        const stats = view.stats();
        let finite = true;
        view.model.group.traverse((o) => {
          if (o.isMesh) {
            for (const attr of ["position", "normal"])
              for (const v of o.geometry.attributes[attr].array)
                if (!Number.isFinite(v)) finite = false;
          }
        });
        let flat = true;
        view.model.group.traverse((o) => {
          if (!o.userData.baked) return;
          const n = o.geometry.attributes.normal;
          for (let i = 0; i < n.count; i += 3)
            for (let j = 1; j < 3; j++)
              for (let k = 0; k < 3; k++)
                if (
                  Math.abs(n.array[i * 3 + k] - n.array[(i + j) * 3 + k]) >
                  0.0001
                )
                  flat = false;
        });
        return {
          ...stats,
          finite,
          flat,
          metadata: view.model.group.userData.agentModel,
          version: view.model.group.userData.agentModel?.version,
        };
      }, id);
      assert.equal(result.version, 4, id);
      assert.equal(result.finite, true, id);
      assert.equal(result.flat, true, id + " flat block faces");
      assert.equal(result.metadata.style, "voxel");
      assert.ok(
        result.metadata.blocks > 40 && result.metadata.blocks < 180,
        id + " block budget",
      );
      assert.ok(
        result.triangles > 400 && result.triangles < 2600,
        `${id}: ${result.triangles} triangles`,
      );
      assert.ok(result.meshes < 45, `${id}: ${result.meshes} meshes`);
      assert.ok(
        result.bounds.max[1] < 2.6 && result.bounds.min[1] > -0.35,
        `${id}: bounds ${JSON.stringify(result.bounds)}`,
      );
      // Real WebGL renders, also checked by a reviewer; the screenshot is not a
      // separate asset renderer that could hide a broken in-game model.
      await page
        .locator("#agent-model-review canvas")
        .screenshot({ path: path.join(out, id + ".png") });
      await page.evaluate(() => AGENT_REVIEW.setAngle(Math.PI));
      await page
        .locator("#agent-model-review canvas")
        .screenshot({ path: path.join(out, id + "-back.png") });
      const animation = await page.evaluate(() => {
        const v = AGENT_REVIEW,
          poses = ["idle", "walk", "fire", "reload", "cast", "crouch"],
          states = [];
        for (const pose of poses) {
          v.setPose(pose, false);
          for (let i = 0; i < 8; i++) animateFighter(v.actor, 1 / 30);
          v.model.group.updateMatrixWorld(true);
          let finite = true;
          v.model.group.traverse((o) => {
            if (!o.matrixWorld.elements.every(Number.isFinite)) finite = false;
          });
          states.push({
            pose,
            finite,
            leg: v.model.legL.leg.rotation.x,
            hand: v.model.armL.arm.quaternion.toArray(),
          });
        }
        v.setPose("inspect");
        return states;
      });
      assert.ok(
        animation.every((s) => s.finite),
        id + " animated transforms",
      );
      assert.notEqual(
        animation[0].leg,
        animation[1].leg,
        id + " walking articulation",
      );
      const portrait = await page.evaluate(async (id) => {
        const a = AGENTS.find((a) => a.key === id),
          start = performance.now(),
          url = agentPortrait(a, 120, 150),
          same = url === agentPortrait(a, 120, 150),
          image = new Image();
        image.src = url;
        await image.decode();
        return {
          width: image.naturalWidth,
          height: image.naturalHeight,
          same,
          ms: performance.now() - start,
        };
      }, id);
      assert.deepEqual(
        [portrait.width, portrait.height, portrait.same],
        [120, 150, true],
        id + " actual-model portrait cache",
      );
      results.push({ ...result, portrait });
      console.log(
        id,
        result.triangles,
        "triangles",
        result.metadata.blocks,
        "blocks",
        result.meshes,
        "meshes",
      );
    }
    assert.equal(
      await page.evaluate(() => JSON.stringify(AGENTS.map((a) => a.abilities))),
      sourceAbilities,
      "model changes never alter abilities",
    );
    // Warm all shared shapes, then repeated selection must release the previous
    // baked meshes and its team material, while keeping shared geometry alive.
    const cleanup = await page.evaluate(() => {
      const view = AGENT_REVIEW;
      view.select("hwaryeong");
      view.render(0);
      const initial = { ...view.renderer.info.memory },
        owned = new Set(),
        shared = new Set();
      let disposed = 0,
        sharedDisposed = 0,
        teamDisposed = 0;
      view.model.group.traverse((o) => {
        if (o.geometry) (o.userData.baked ? owned : shared).add(o.geometry);
      });
      for (const g of owned) g.addEventListener("dispose", () => disposed++);
      for (const g of shared)
        g.addEventListener("dispose", () => sharedDisposed++);
      view.model.teamMat.addEventListener("dispose", () => teamDisposed++);
      const samples = [];
      for (let i = 0; i < 6; i++) {
        view.select(i % 2 ? "hwaryeong" : "seorin");
        view.render(0);
        samples.push({ ...view.renderer.info.memory });
      }
      return {
        total: owned.size,
        disposed,
        sharedDisposed,
        teamDisposed,
        initial,
        samples,
      };
    });
    assert.equal(cleanup.disposed, cleanup.total);
    assert.equal(cleanup.sharedDisposed, 0);
    assert.equal(cleanup.teamDisposed, 1);
    assert.equal(
      cleanup.samples[1].geometries,
      cleanup.samples[5].geometries,
      "geometry count after repeated swaps",
    );
    await page.evaluate(
      () => (document.querySelector(".am-toolbar").style.visibility = ""),
    );
    await page.selectOption("#am-agent", "chochim");
    await page.locator("#am-back").click();
    await page.setViewportSize({ width: 852, height: 393 });
    assert.equal(await page.locator("#am-close").isVisible(), true);
    assert.ok(
      await page.evaluate(() => {
        const d = document.getElementById("agent-model-review");
        return d.scrollWidth <= d.clientWidth + 1;
      }),
    );
    await page.locator("#am-close").click();
    assert.equal(await page.evaluate(() => window.AGENT_REVIEW), null);
    await page.evaluate(() => {
      room.mode = "std";
      startGame(AGENTS[0], false);
      ADMIN.freezeAI = true;
      world.phase = "live";
      closeShop();
    });
    assert.equal(
      await page.evaluate(() =>
        world.actors.every(
          (a) => a.model?.group.userData.agentModel?.version === 4,
        ),
      ),
      true,
      "actual match uses new models",
    );
    const team = await page.evaluate(() => {
      for (const a of world.actors) syncActorModel(a);
      return world.actors.filter((a) => a.model._teamMeshes?.length).length;
    });
    assert.ok(
      team > 0,
      "existing ally/enemy material assignment remains active",
    );
    assert.deepEqual(f.errors, []);
    assert.deepEqual(
      warnings.filter((m) =>
        /outfit|chdetail|shader error|VALIDATE_STATUS/i.test(m),
      ),
      [],
    );
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify({ results, cleanup, errors: f.errors, warnings }, null, 2),
    );
    console.log(
      "40 voxel models: actual renders, flat block faces, portraits, six animation states, match integration, team shader and resource disposal passed",
    );
  } finally {
    await f.browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

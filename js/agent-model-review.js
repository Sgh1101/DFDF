// Loaded only by ?model-review=1. Uses the same builder and animation functions
// as matches; no alternate display-only character meshes or account writes.
(() => {
  "use strict";
  if (!window.AGENT_MODELS || window.AGENT_REVIEW) return;
  const previousFocus = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.id = "agent-model-review";
  dialog.setAttribute("aria-label", "요원 3D 모델 보기");
  dialog.innerHTML = `<style>
  #agent-model-review{width:calc(100vw - 32px);height:calc(100dvh - 32px);max-width:1380px;max-height:1000px;padding:0;border:1px solid #3b475b;border-radius:18px;background:#111925;color:#e9eef6;font:14px/1.5 system-ui;overflow:hidden}
  #agent-model-review::backdrop{background:#080d16df}
  #agent-model-review *{box-sizing:border-box}#agent-model-review button,#agent-model-review select{font:inherit;min-height:40px;border:1px solid #465169;border-radius:9px;background:#233044;color:#f1f5fc;padding:7px 12px;cursor:pointer}
  #agent-model-review :focus-visible{outline:2px solid #96e5df;outline-offset:2px}
  #agent-model-review header{height:68px;display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid #2d3a4d}#agent-model-review header strong{font-size:18px;margin-right:auto}
  #agent-model-review main{height:calc(100% - 68px);display:grid;grid-template-columns:minmax(0,1fr) 310px}
  #agent-model-review .am-stage{position:relative;min-width:0;min-height:0;background:radial-gradient(ellipse at 50% 40%,#28384e,#111925 70%)}
  #agent-model-review canvas{display:block;width:100%;height:100%;touch-action:none}
  #agent-model-review .am-toolbar{position:absolute;bottom:16px;left:16px;right:16px;display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
  #agent-model-review aside{padding:24px 20px;overflow-y:auto;border-left:1px solid #2d3a4d}#agent-model-review h2{font-size:30px;line-height:1.2;margin:4px 0 12px}
  #agent-model-review .am-role{color:#9fb1c9;font-size:12px;letter-spacing:.1em}#agent-model-review .am-design{color:#bdcbdc;margin-bottom:22px}
  #agent-model-review .am-ability{border-top:1px solid #2d3a4d;padding:13px 0}#agent-model-review .am-ability b{display:block;margin-bottom:5px}#agent-model-review .am-ability p{margin:0;color:#aebed2;font-size:12px}
  #agent-model-review .am-hint{color:#90a3ba;font-size:12px}#agent-model-review [aria-pressed=true]{border-color:#91d9d7;color:#b8f2ee;background:#243e4b}
  @media(max-width:700px){#agent-model-review{width:100vw;height:100dvh;max-height:none;border-radius:0}#agent-model-review header{padding:8px 12px;gap:8px;height:60px}#agent-model-review header strong{font-size:14px}#agent-model-review main{height:calc(100% - 60px);grid-template-columns:minmax(0,1fr) 210px}#agent-model-review aside{padding:14px 12px}#agent-model-review .am-toolbar{bottom:8px;left:6px;right:6px}#agent-model-review .am-toolbar button,#agent-model-review .am-toolbar select{font-size:12px;padding:5px 8px;min-height:36px}}
  @media(max-width:500px) and (orientation:portrait){#agent-model-review main{grid-template-columns:1fr;grid-template-rows:minmax(320px,1fr) 30%}#agent-model-review aside{border-left:0;border-top:1px solid #2d3a4d}#agent-model-review h2{font-size:24px}#agent-model-review .am-design{margin-bottom:12px}}
  </style><header><strong>요원 3D 모델</strong><select aria-label="요원 선택" id="am-agent"></select><button type="button" id="am-close">닫기</button></header>
  <main><div class="am-stage"><canvas aria-label="드래그하여 회전하는 요원 3D 모델" tabindex="0"></canvas><div class="am-toolbar"><button type="button" id="am-front">앞</button><button type="button" id="am-back">뒤</button><button type="button" id="am-turn" aria-pressed="false">자동 회전</button><select id="am-pose" aria-label="동작"><option value="inspect">기본 자세</option><option value="idle">총기 준비</option><option value="walk">달리기</option><option value="fire">사격</option><option value="reload">재장전</option><option value="cast">능력 사용</option><option value="crouch">앉기</option></select></div></div><aside><div class="am-role"></div><h2></h2><p class="am-design"></p><div class="am-abilities"></div><p class="am-hint">드래그 또는 ← → 키로 회전 · 마우스 휠로 확대</p></aside></main>`;
  document.body.append(dialog);
  dialog.showModal();
  const $ = (s) => dialog.querySelector(s),
    canvas = $("canvas"),
    stage = $(".am-stage");
  for (const ag of AGENTS) {
    const o = document.createElement("option");
    o.value = ag.key;
    o.textContent = ag.name;
    $("#am-agent").append(o);
  }
  const r = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  r.outputColorSpace = T.SRGBColorSpace;
  r.toneMapping = T.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.25;
  const sc = new T.Scene(),
    camera = new T.PerspectiveCamera(30, 1, 0.05, 30);
  camera.position.set(2.6, 1.75, -4.6);
  camera.lookAt(0, 1.02, 0);
  sc.add(new T.HemisphereLight(0xd7e9ff, 0x8d8791, 1.4));
  for (const [color, power, x, y, z] of [
    [0xfff0dc, 3, -3, 4, -4],
    [0xa3cfff, 2, 3, 2, 2],
    [0xffffff, 0.7, 2, 1, -4],
  ]) {
    const light = new T.DirectionalLight(color, power);
    light.position.set(x, y, z);
    sc.add(light);
  }
  const env = new T.Scene();
  env.background = new T.Color(0x465164);
  for (const [color, x, y, z, w, h, d] of [
    [0xffffff, 0, 5, 0, 8, 0.1, 8],
    [0xffe7cb, -4, 2, -2, 0.1, 4, 4],
    [0xb1d7ff, 4, 2, 1, 0.1, 3, 5],
  ]) {
    const m = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshBasicMaterial({ color }),
    );
    m.position.set(x, y, z);
    env.add(m);
  }
  const pm = new T.PMREMGenerator(r),
    environment = pm.fromScene(env, 0.04);
  sc.environment = environment.texture;
  pm.dispose();
  env.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  const ground = new T.Mesh(
    new T.BoxGeometry(1.1, 0.035, 1.1),
    new T.MeshStandardMaterial({ color: 0x28364a, roughness: 0.8 }),
  );
  ground.position.y = 0.012;
  sc.add(ground);
  const halo = new T.Mesh(
    new T.TorusGeometry(0.61, 0.003, 4, 80),
    new T.MeshBasicMaterial({ color: 0x99c9cf }),
  );
  halo.rotation.x = PI() / 2;
  halo.position.y = 0.032;
  sc.add(halo);
  let model,
    actor,
    pose = "inspect",
    turning = false,
    closed = false,
    frame,
    last = 0,
    angle = 0,
    distance = 5.3,
    drag = null;
  function PI() {
    return Math.PI;
  }
  function select(id) {
    const ag = AGENTS.find((a) => a.key === id) || AGENTS[0];
    if (model) {
      sc.remove(model.group);
      chDispose(model.group);
    }
    model = buildFighter(0x8fbcc7, ag);
    sc.add(model.group);
    actor = {
      model,
      agent: ag,
      alive: true,
      team: "atk",
      yaw: 0,
      pitch: 0,
      y: 0,
      onGround: true,
      vel: { x: 0, z: 0 },
      recoil: 0,
      reloading: 0,
      _castT: 0,
    };
    $("#am-agent").value = ag.key;
    $(".am-role").textContent = ag.role;
    $("h2").textContent = ag.name;
    $(".am-design").textContent = AGENT_MODELS.catalog[ag.key].design;
    $(".am-abilities").replaceChildren();
    for (const ability of ag.abilities) {
      const d = document.createElement("div"),
        b = document.createElement("b"),
        p = document.createElement("p");
      d.className = "am-ability";
      b.textContent = ability.key + " · " + ability.name;
      p.textContent = ability.desc;
      d.append(b, p);
      $(".am-abilities").append(d);
    }
    pose = $("#am-pose").value;
    render(0);
    return model;
  }
  function render(dt = 0) {
    if (!model || closed) return;
    actor.vel.z = pose === "walk" ? -6 : 0;
    actor.crouch = pose === "crouch";
    actor.reloading = pose === "reload" ? 1 : 0;
    actor.recoil =
      pose === "fire" ? 0.45 + 0.35 * Math.sin(performance.now() * 0.04) : 0;
    actor._castT = pose === "cast" ? 0.6 : 0;
    actor._castKey = "E";
    animateFighter(actor, Math.min(0.05, dt));
    if (pose === "inspect") {
      model.armL.arm.rotation.set(0.05, 0, 0.13);
      model.armR.arm.rotation.set(0.05, 0, -0.13);
      model.armL.fore.rotation.set(-0.12, 0, 0);
      model.armR.fore.rotation.set(-0.12, 0, 0);
    }
    model.gun.visible = pose !== "inspect" && pose !== "cast";
    if (turning) angle += dt * 0.35;
    model.group.rotation.y = angle;
    const v = new T.Vector3(2.6, 1.75 - 1.02, -4.6)
      .normalize()
      .multiplyScalar(distance);
    camera.position.copy(v).add(new T.Vector3(0, 1.02, 0));
    camera.lookAt(0, 1.02, 0);
    r.render(sc, camera);
  }
  function stats() {
    let triangles = 0,
      meshes = 0;
    model.group.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        triangles +=
          (o.geometry.index
            ? o.geometry.index.count
            : o.geometry.attributes.position.count) / 3;
      }
    });
    const bounds = new T.Box3().setFromObject(model.group);
    return {
      id: actor.agent.key,
      triangles,
      meshes,
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
      memory: { ...r.info.memory },
      calls: r.info.render.calls,
    };
  }
  function resize() {
    const rect = stage.getBoundingClientRect();
    r.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
    render(0);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  function loop(time) {
    if (closed) return;
    const dt = last ? (time - last) / 1000 : 0;
    last = time;
    if (!document.hidden && (turning || pose !== "inspect")) render(dt);
    frame = requestAnimationFrame(loop);
  }
  function close() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    if (model) {
      sc.remove(model.group);
      chDispose(model.group);
    }
    for (const o of [ground, halo]) {
      o.geometry.dispose();
      o.material.dispose();
    }
    environment.dispose();
    r.dispose();
    r.forceContextLoss();
    dialog.remove();
    window.AGENT_REVIEW = null;
    previousFocus?.focus();
  }
  $("#am-agent").onchange = (e) => select(e.target.value);
  $("#am-close").onclick = close;
  $("#am-pose").onchange = (e) => {
    pose = e.target.value;
    render(0);
  };
  $("#am-front").onclick = () => {
    angle = -0.51;
    render(0);
  };
  $("#am-back").onclick = () => {
    angle = PI() - 0.51;
    render(0);
  };
  $("#am-turn").onclick = () => {
    turning = !turning;
    $("#am-turn").setAttribute("aria-pressed", String(turning));
  };
  canvas.onpointerdown = (e) => {
    drag = { id: e.pointerId, x: e.clientX };
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = (e) => {
    if (drag && drag.id === e.pointerId) {
      angle += (e.clientX - drag.x) * 0.012;
      drag.x = e.clientX;
      render(0);
    }
  };
  canvas.onpointerup = canvas.onpointercancel = () => {
    drag = null;
  };
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      distance = Math.max(2.2, Math.min(7, distance + e.deltaY * 0.004));
      render(0);
    },
    { passive: false },
  );
  canvas.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      angle += e.key === "ArrowLeft" ? -0.2 : 0.2;
      render(0);
    }
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  dialog.addEventListener("keydown", (e) => e.stopPropagation());
  window.AGENT_REVIEW = {
    select,
    render,
    stats,
    close,
    get model() {
      return model;
    },
    get actor() {
      return actor;
    },
    get renderer() {
      return r;
    },
    setAngle(value) {
      angle = value;
      render(0);
    },
    setPose(value, draw = true) {
      pose = value;
      $("#am-pose").value = value;
      if (draw) render(0);
      else {
        actor.vel.z = value === "walk" ? -6 : 0;
        actor.crouch = value === "crouch";
        actor.reloading = value === "reload" ? 1 : 0;
        actor.recoil = value === "fire" ? 0.5 : 0;
        actor._castT = value === "cast" ? 0.6 : 0;
        actor._castKey = "E";
      }
    },
  };
  select(new URLSearchParams(location.search).get("agent"));
  resize();
  frame = requestAnimationFrame(loop);
})();

(() => {
  "use strict";
  const rad = Math.PI / 180;
  // Preserve every source cube, UV face and bone; merge only within a bone.
  function geometry(cubes, pivot, desc) {
    const positions = [], normals = [], uv = [];
    const faces = ["east", "west", "up", "down", "south", "north"];
    for (const cube of cubes) {
      const size = cube.size.map((v) => Math.max(v, 0.001)), inflation = Number(cube.inflate) || 0;
      const g = new T.BoxGeometry(...size.map((v) => Math.max(0.001, v + inflation * 2)));
      const coords = g.getAttribute("uv"), indices = g.index;
      for (let face = 0; face < 6; face++) {
        let spec = cube.uv?.[faces[face]];
        if (Array.isArray(cube.uv)) {
          const [u, v] = cube.uv, [x, y, z] = size;
          const box = [[u, v + z, z, y], [u + z + x, v + z, z, y], [u + z, v, x, z], [u + z + x, v, x, z], [u + z + x + z, v + z, x, y], [u + z, v + z, x, y]][face];
          spec = { uv: box.slice(0, 2), uv_size: box.slice(2) };
        }
        if (!spec) { // Absent faces are removed below, rather than sampling an unrelated pixel.
          for (let k = face * 6; k < face * 6 + 6; k++) indices.array[k] = 0;
          continue;
        }
        const origin = spec.uv || [0, 0], extent = spec.uv_size || [size[0], size[1]];
        for (let k = face * 4; k < face * 4 + 4; k++) {
          coords.setXY(k, (origin[0] + coords.getX(k) * extent[0]) / desc.texture_width, 1 - (origin[1] + (1 - coords.getY(k)) * extent[1]) / desc.texture_height);
        }
      }
      g.translate(...cube.origin.map((v, i) => v + size[i] / 2));
      if (cube.rotation) {
        const p = cube.pivot || pivot; g.translate(...p.map((v) => -v));
        g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...cube.rotation.map((v) => v * rad), "ZYX")));
        g.translate(...p);
      }
      g.translate(...pivot.map((v) => -v));
      const flat = g.toNonIndexed();
      positions.push(...flat.attributes.position.array); normals.push(...flat.attributes.normal.array); uv.push(...flat.attributes.uv.array);
      flat.dispose(); g.dispose();
    }
    const merged = new T.BufferGeometry();
    merged.setAttribute("position", new T.Float32BufferAttribute(positions, 3)); merged.setAttribute("normal", new T.Float32BufferAttribute(normals, 3)); merged.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    return merged;
  }
  function buildGeo(geo, mat) {
    const rig = new T.Group(), nodes = new Map();
    rig.name = "bedrock-rig";
    for (const bone of geo.bones) {
      const node = new T.Group(), pivot = bone.pivot || [0, 0, 0], parent = geo.bones.find((b) => b.name === bone.parent), base = parent?.pivot || [0, 0, 0];
      node.name = "phantom-bone-" + bone.name;
      node.position.set(...pivot.map((v, i) => v - base[i]));
      node.rotation.set(...(bone.rotation || [0, 0, 0]).map((v) => v * rad), "ZYX");
      node.userData.base = { p: node.position.toArray(), r: (bone.rotation || [0, 0, 0]).slice() };
      if (bone.cubes?.length) node.add(new T.Mesh(geometry(bone.cubes, pivot, geo.description), mat));
      nodes.set(bone.name, node);
    }
    for (const bone of geo.bones) (nodes.get(bone.parent) || rig).add(nodes.get(bone.name));
    return rig;
  }
  window.BEDROCK_RIG = { build: buildGeo };
})();

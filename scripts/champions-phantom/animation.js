// Keyframed motion for the gun's moving parts. The game only plays tracks for
// the magazine, mag_and_lefthand, charge_handle, bolt, trigger and mag_release
// bones (js/champions-phantom.js pose()); its own hand/camera motion stays.
"use strict";
const keys = (pairs) => Object.fromEntries(pairs.map(([t, v]) => [t.toFixed(4), v]));
function build() {
  const pull = (t0) => keys([[t0, [0, 0, 0]], [t0 + 0.08, [-3.25, 0, 0]], [t0 + 0.2, [-3.25, 0, 0]], [t0 + 0.26, [0.25, 0, 0]], [t0 + 0.32, [0, 0, 0]]]);
  const animations = {
    idle: { loop: true, animation_length: 1, bones: {} },
    draw: { animation_length: 1.1, bones: { charge_handle: { position: pull(0.12) } } },
    shoot: { animation_length: 0.3, bones: { trigger: { rotation: keys([[0, [0, 0, 0]], [0.03, [0, 0, -14]], [0.14, [0, 0, 0]]]) }, bolt: { position: keys([[0, [0, 0, 0]], [0.04, [-2.5, 0, 0]], [0.12, [0, 0, 0]]]) } } },
    shoot_aim: { animation_length: 0.25, bones: { trigger: { rotation: keys([[0, [0, 0, 0]], [0.03, [0, 0, -14]], [0.12, [0, 0, 0]]]) }, bolt: { position: keys([[0, [0, 0, 0]], [0.04, [-2.5, 0, 0]], [0.11, [0, 0, 0]]]) } } },
    // Tactical reload: release, drop and swing the magazine out, bring a fresh one
    // up, seat it with a slap, then work the charging handle.
    reload_tactical: {
      animation_length: 2.75,
      bones: {
        mag_release: { position: keys([[0.3, [0, 0, 0]], [0.36, [0, 0, 0.35]], [0.5, [0, 0, 0]]]) },
        magazine: {
          position: keys([[0, [0, 0, 0]], [0.38, [0, 0, 0]], [0.62, [-0.8, -5.5, 0]], [0.82, [-2.5, -18, 0]], [1.3, [-2.5, -18, 0]], [1.62, [-0.6, -5, 0]], [1.86, [0, 0.35, 0]], [1.96, [0, 0, 0]]]),
          rotation: keys([[0, [0, 0, 0]], [0.38, [0, 0, 0]], [0.62, [0, 0, 9]], [0.82, [0, 0, 24]], [1.3, [0, 0, 18]], [1.62, [0, 0, 7]], [1.86, [0, 0, -2]], [1.96, [0, 0, 0]]]),
        },
        charge_handle: { position: keys([[0, [0, 0, 0]], [2.18, [0, 0, 0]], [2.3, [-3.25, 0, 0]], [2.44, [-3.25, 0, 0]], [2.5, [0.25, 0, 0]], [2.56, [0, 0, 0]]]) },
      },
    },
    reload_empty: null,
    inspect: { animation_length: 0.6333, bones: {} },
    // Long showcase loop: the game turns the gun; the handle is racked twice.
    inspect_loop: { loop: true, animation_length: 10.8, bones: { charge_handle: { position: { ...pull(2.4), ...pull(7.8) } } } },
  };
  animations.reload_empty = { ...animations.reload_tactical };
  return { format_version: "1.8.0", animations };
}
module.exports = { build };

'use strict';

// Coordinates are derived from the SGH mesh's grip and the centres of its gold pins.
const grip = [0, 9.52, 3.1];
const upperPin = [0, 9.957, -2.62];
const lowerPin = [0, 8.88, -2.62];
const bladePin = [0, 9.42, -2.62];
const neutral = [-22, -63, 0];
const zero = [0, 0, 0];

function rig(cubes) {
  return {
    format_version: '1.12.0',
    'minecraft:geometry': [{
      description: { identifier: 'geometry.sgh_butterfly', texture_width: 128, texture_height: 128 },
      bones: [
        { name: 'righthand', pivot: grip },
        { name: 'weapon', parent: 'righthand', pivot: grip },
        { name: 'blade2', parent: 'weapon', pivot: bladePin, cubes: cubes.blade2 },
        { name: 'blade_illuminated', parent: 'blade2', pivot: bladePin, cubes: cubes.blade_illuminated },
        { name: 'up', parent: 'weapon', pivot: upperPin, cubes: cubes.up },
        { name: 'bone3_illuminated', parent: 'up', pivot: upperPin, cubes: cubes.bone3_illuminated },
        { name: 'down', parent: 'weapon', pivot: lowerPin, cubes: cubes.down },
        { name: 'bone2_illuminated', parent: 'down', pivot: lowerPin, cubes: cubes.bone2_illuminated },
        { name: 'trail_illuminated', parent: 'blade2', pivot: bladePin, cubes: cubes.trail_illuminated },
      ],
    }],
  };
}

function curve(points) {
  return Object.fromEntries(points.map(([at, vector]) => [at, { vector, lerp_mode: 'catmullrom' }]));
}

function clip(duration, wrist, hinges, sounds, trail) {
  const bones = {
    righthand: {
      position: curve(wrist.map(([at, position]) => [at, position])),
      rotation: curve(wrist.map(([at, , rotation]) => [at, rotation])),
    },
    up: { rotation: curve(hinges.map(([at, angle]) => [at, [angle, 0, 0]])) },
    down: { rotation: curve(hinges.map(([at, , angle]) => [at, [angle, 0, 0]])) },
  };
  if (trail) {
    const [from, to] = trail;
    bones.trail_illuminated = { scale: { 0: 0, [from]: 0, [from + .06]: 1, [to]: 0 } };
  }
  return {
    animation_length: duration,
    bones,
    sound_effects: Object.fromEntries(sounds.map(([at, effect]) => [at, { effect }])),
  };
}

function animation() {
  const rest = (at) => [at, zero, neutral];
  return {
    format_version: '1.8.0',
    animations: {
      static_idle: { loop: true, bones: { righthand: { rotation: neutral }, trail_illuminated: { scale: 0 } } },
      draw: clip(2, [
        [0, [2, -6, 4], [44, 12, -34]],
        [.16, [3, -2, 2], [8, -22, -62]],
        [.32, [2, 3, -1], [-50, -85, -18]],
        [.52, [0, 4.6, -1.2], [-81, 9, 15]],
        [.74, [2.6, 5, .4], [-82, -35, 2]],
        [1.03, [2, 3.9, .7], [-32, -77, 15]],
        [1.46, [.55, .8, .2], [-24, -66, 4]], rest(2),
      ], [
        [0, 152, -168], [.2, 48, -78], [.33, 8, -17], [.5, 116, -138],
        [.66, 27, -43], [.8, -7, 6], [1, 0, 0], [2, 0, 0],
      ], [[.21, 'draw']]),
      inspect: clip(6.5, [
        rest(0), [.3, [1, 2.3, -.25], [-37, -38, -23]],
        [.58, [2.6, 4.8, -.6], [-44, -4, 25]],
        [.91, [2.5, 2.8, -2.3], [-16, -71, 37]],
        [1.22, [2.8, 1.5, -3.2], [4, -78, 39]],
        [1.58, [3.4, 2.9, -.8], [-64, 26, 54]],
        [1.91, [3.7, 4.3, -.6], [-99, 32, 70]],
        [2.27, [3.9, 5.4, -.4], [37, 18, 87]],
        [2.62, [3.2, 6.3, -.7], [56, -38, 95]],
        [2.98, [2.4, 5, .1], [29, -49, 88]],
        [3.34, [2.1, 4.2, .5], [-22, -6, 75]],
        [3.73, [2.5, 6.3, .3], [-64, -4, 55]],
        [4.08, [2.8, 7.3, -.8], [-45, 6, 42]],
        [4.43, [2.3, 5.6, -.55], [-69, 20, 32]],
        [4.8, [1.4, 3.1, -1.5], [-86, 0, 24]],
        [5.16, [.5, 1, -.7], [-63, -35, 11]],
        [5.61, [-.7, -1.6, 1.8], [-38, -59, -4]],
        [6.08, [-.15, -.35, .25], [-24, -65, -1]], rest(6.5),
      ], [
        [0, 0, 0], [.34, 22, -58], [.57, 91, -155], [.79, 33, -56],
        [1.08, 54, -125], [1.38, -13, -35], [1.69, 112, -148], [1.93, 162, -88],
        [2.21, 58, -21], [2.52, -59, 55], [2.86, 3, -79],
        [3.17, 68, -52], [3.49, -20, 32], [3.81, -117, 128],
        [4.09, 52, -87], [4.38, 18, -48], [4.76, -6, 9], [4.96, 0, 0], [6.5, 0, 0],
      ], [[.4, 'inspect']]),
      melee_1: clip(2.5, [
        [0, [-2, .3, 1], [6, -76, 34]], [.2, [-.4, 1.2, -4], [-18, -60, 41]],
        [.37, [2, 3.1, -6.4], [-10, -23, 62]], [.65, [2.2, 3.8, -4.4], [-35, 4, 46]],
        [.97, [2.9, 5, -3.1], [-58, 56, 4]], [1.25, [1.9, 4.7, -2.8], [-58, 62, -8]],
        [1.67, [.8, 2.1, -1.8], [-35, -24, 7]], rest(2.5),
      ], [
        [0, 0, 0], [.43, 5, 0], [.7, 47, -65], [1.04, 146, -132],
        [1.29, 68, -74], [1.53, -9, 10], [1.75, 0, 0], [2.5, 0, 0],
      ], [[.23, 'melee_1'], [.6, 'rotate_1']], [.18, .43]),
      melee_2: clip(2.5, [
        [0, [2, -3.8, 1.1], [-62, 13, -37]], [.18, [9.8, -1, -6.7], [-70, 27, -31]],
        [.34, [13, -.6, -8.8], [-81, 42, -9]], [.57, [7.5, -.2, -4.4], [-68, -12, 3]],
        [.86, [3.4, .8, .1], [-50, -65, 26]], [1.23, [4.2, 2.5, 3.4], [-93, 47, 18]],
        [1.6, [1.9, 2.2, 1.2], [-54, -36, 17]], rest(2.5),
      ], [
        [0, 0, 0], [.52, 0, 0], [.74, 17, -87], [1.02, 58, -147],
        [1.27, 76, -170], [1.46, -10, 8], [1.7, 0, 0], [2.5, 0, 0],
      ], [[0, 'melee_2'], [.6, 'rotate_2']], [.05, .31]),
      melee_3: clip(3, [
        [0, [13.2, 6.5, 5.1], [-19, 31, 32]], [.21, [12.3, 6.7, -6], [-4, 28, 50]],
        [.4, [10.6, 5.2, -7.6], [-12, 16, 51]], [.73, [9.2, 3.9, 1.3], [-18, -8, 49]],
        [1.05, [7.4, 4.2, 1.1], [-52, 12, 53]], [1.38, [5.3, 3.8, -2.2], [-68, 64, 36]],
        [1.68, [4.8, 3.6, -.1], [-84, 49, 26]], [2.02, [2.1, 2.6, 1], [-39, -31, 13]],
        [2.46, [.6, .9, .25], [-26, -62, 3]], rest(3),
      ], [
        [0, 0, 0], [.96, 0, 0], [1.2, 47, -81], [1.47, 73, -125],
        [1.71, -137, 150], [2.01, 16, -28], [2.25, 0, 0], [3, 0, 0],
      ], [[0, 'melee_3'], [1.1, 'rotate_3']], [.09, .36]),
    },
  };
}

module.exports = { rig, animation };

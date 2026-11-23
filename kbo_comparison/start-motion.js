(function () {
  const start = document.getElementById('start-screen');
  if (start.hidden || typeof window.matchMedia !== 'function') return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 3400;
  const ground = 91;
  const skin = '#9a8177';
  const pants = '#a1a8b0';
  const cleats = '#53606d';
  const ball = '#384754';
  const pose = (head, shoulders, hips, backLeg, leadLeg, backArm, leadArm, bat = [0, 0]) =>
    [head, shoulders, hips, ...backLeg, ...leadLeg, ...backArm, ...leadArm, bat];

  const contactTime = 0.61;
  const releaseTime = 0.59;
  const pitchingReset = 0.945;
  const battingReady = pose([63, 24], [60, 40], [59, 61],
    [[48, 74], [44, ground]], [[73, 74], [81, ground]],
    [[46, 40], [57, 33]], [[72, 47], [57, 33]], [-15, -30]);
  const batting = [
    [0, battingReady],
    [0.13, pose([63, 24], [60, 40], [59, 61],
      [[48, 74], [44, ground]], [[73, 74], [81, ground]],
      [[47, 41], [58, 34]], [[72, 47], [58, 34]], [-13, -31])],
    // Stay behind the ball as the front foot gathers and strides.
    [0.34, pose([59, 25], [55, 39], [55, 61],
      [[46, 75], [44, ground]], [[68, 70], [75, 81]],
      [[42, 39], [54, 32]], [[67, 44], [54, 32]], [-22, -26])],
    [0.51, pose([62, 25], [58, 41], [60, 63],
      [[48, 75], [44, ground]], [[79, 75], [88, ground]],
      [[46, 43], [56, 34]], [[68, 47], [56, 34]], [-28, -20])],
    // The back hip turns first. The hands and barrel stay behind it.
    [0.55, pose([65, 25], [61, 42], [66, 62],
      [[52, 73], [44, 89]], [[82, 75], [88, ground]],
      [[49, 52], [62, 43]], [[72, 51], [62, 43]], [-29, -10])],
    [0.58, pose([67, 26], [64, 43], [70, 62],
      [[55, 73], [44, 87]], [[84, 75], [88, ground]],
      [[58, 58], [72, 52]], [[76, 54], [72, 52]], [-12, 4])],
    [contactTime, pose([69, 26], [68, 43], [73, 61],
      [[57, 72], [44, 86]], [[86, 75], [88, ground]],
      [[69, 56], [84, 56]], [[79, 50], [84, 56]], [32, -4])],
    [0.65, pose([72, 26], [73, 43], [75, 60],
      [[59, 73], [44, 86]], [[87, 74], [88, ground]],
      [[82, 49], [96, 50]], [[85, 45], [96, 50]], [25, -15])],
    [0.73, pose([76, 25], [74, 40], [75, 59],
      [[60, 73], [44, 87]], [[86, 74], [88, ground]],
      [[85, 35], [76, 25]], [[72, 48], [76, 25]], [-8, -28])],
    [0.83, pose([77, 25], [74, 40], [75, 59],
      [[59, 73], [44, 88]], [[86, 74], [88, ground]],
      [[85, 32], [71, 25]], [[70, 44], [71, 25]], [-28, -12])],
    [0.92, pose([69, 25], [66, 41], [65, 61],
      [[52, 74], [44, ground]], [[76, 71], [86, 86]],
      [[54, 40], [62, 33]], [[74, 47], [62, 33]], [-20, -24])],
    [1, battingReady],
  ];

  const pitchingReady = pose([54, 24], [51, 40], [50, 60],
    [[46, 75], [43, ground]], [[61, 75], [65, ground]],
    [[42, 48], [58, 39]], [[65, 48], [58, 39]]);
  const pitchingFinish = pose([110, 27], [106, 41], [106, 60],
    [[115, 74], [119, ground]], [[99, 75], [99, ground]],
    [[108, 54], [108, 65]], [[101, 52], [95, 57]]);
  const pitching = [
    [0, pitchingReady],
    [0.10, pitchingReady],
    [0.31, pose([51, 22], [48, 38], [47, 58],
      [[45, 73], [43, ground]], [[68, 49], [60, 67]],
      [[40, 45], [57, 35]], [[62, 45], [57, 35]])],
    // The hands separate low as the center of mass moves toward home plate.
    [0.42, pose([57, 24], [53, 41], [56, 61],
      [[47, 74], [43, ground]], [[77, 63], [78, 82]],
      [[41, 49], [29, 54]], [[67, 43], [82, 37]])],
    [0.51, pose([65, 25], [61, 42], [65, 64],
      [[50, 75], [43, ground]], [[82, 74], [99, ground]],
      [[43, 39], [35, 25]], [[76, 39], [90, 36]])],
    // With the stride foot down, the hips open while the forearm lays back.
    [0.55, pose([73, 24], [67, 41], [72, 63],
      [[55, 73], [46, 88]], [[91, 74], [99, ground]],
      [[60, 28], [42, 29]], [[81, 43], [86, 53]])],
    [releaseTime, pose([83, 30], [76, 45], [78, 62],
      [[60, 72], [49, 84]], [[96, 75], [99, ground]],
      [[86, 28], [104, 20]], [[83, 53], [74, 55]])],
    [0.65, pose([99, 40], [89, 47], [80, 60],
      [[61, 61], [46, 69]], [[97, 75], [99, ground]],
      [[101, 54], [105, 70]], [[84, 58], [72, 54]])],
    [0.74, pose([101, 42], [92, 49], [82, 62],
      [[69, 58], [54, 61]], [[96, 74], [99, ground]],
      [[99, 63], [92, 76]], [[83, 60], [74, 54]])],
    // The trailing leg swings past the planted foot and takes the next step.
    [0.79, pose([105, 37], [98, 47], [91, 61],
      [[90, 57], [77, 66]], [[98, 74], [99, ground]],
      [[101, 60], [98, 73]], [[92, 59], [82, 55]])],
    [0.83, pose([107, 31], [102, 43], [100, 62],
      [[108, 68], [111, 81]], [[99, 75], [99, ground]],
      [[104, 57], [105, 70]], [[97, 56], [89, 55]])],
    [0.88, pitchingFinish],
    [pitchingReset, pitchingFinish],
  ];

  const mix = (from, to, progress) => from + (to - from) * progress;
  const tangent = (incoming, outgoing) =>
    incoming * outgoing > 0 ? 2 * incoming * outgoing / (incoming + outgoing) : 0;

  function interpolate(frames, progress) {
    const next = frames.findIndex(([time]) => time >= progress);
    if (next === 0) return frames[0][1];
    const [start, from] = frames[next - 1];
    const [end, to] = frames[next];
    const [before, previous] = frames[next - 2] ?? [start, from];
    const [after, following] = frames[next + 1] ?? [end, to];
    const span = end - start;
    const t = (progress - start) / span;
    const square = t * t;
    // Match velocity across poses and keep planted feet fixed.
    const blend = square * (3 - 2 * t);
    return from.map((point, index) => point.map((value, axis) => {
      const destination = to[index][axis];
      const current = (destination - value) / span;
      const entering = start === before ? 0 : (value - previous[index][axis]) / (start - before);
      const leaving = end === after ? 0 : (following[index][axis] - destination) / (after - end);
      return mix(value, destination, blend) + span * (
        t * (1 - t) ** 2 * tangent(entering, current) +
        square * (t - 1) * tangent(current, leaving)
      );
    }));
  }

  function draw(ctx, throwing, frame, progress) {
    const [head, shoulders, hips, backKnee, backFoot, leadKnee, leadFoot,
      backElbow, backHand, leadElbow, leadHand, barrel] = frame;
    const jersey = throwing ? '#31587e' : '#64707c';
    const shadow = throwing ? '#244464' : '#424d58';
    const offset = ([x, y], dx, dy = 0) => [x + dx, y + dy];

    function path(points, color, width = 0) {
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      for (const point of points.slice(1)) ctx.lineTo(...point);
      if (width) {
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.stroke();
      } else {
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
    function oval([x, y], rx, ry, color) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.clearRect(0, 0, 160, 104);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    path([[10, 95], [151, 95]], '#b7bfc7', 1);
    if (throwing) {
      path([[21, 95], [38, 91], [61, 91], [85, 95]], '#d7dce0');
      path([[45, 91], [58, 91]], '#89939e', 2);
    } else {
      path([[27, 94], [36, 87], [97, 87]], '#b7bfc7', 1);
      path([[104, 91], [119, 91], [119, 94], [112, 97], [104, 94]], '#8c97a3');
    }
    ctx.save();
    // Hide the cut back to the rubber after both feet have landed.
    if (throwing) ctx.globalAlpha = Math.min(1, Math.abs(progress - pitchingReset) / 0.05);
    oval([throwing ? hips[0] : 61, 94], 33, 3, '#303e511a');

    path([offset(hips, -4), backKnee, backFoot], '#78838d', 7);
    const backToe = throwing ? offset(backFoot, 5, 2) : [backFoot[0] + 5, ground + 1];
    path([offset(backFoot, -2, 1), backToe], cleats, 4);
    path([offset(hips, 4), leadKnee, leadFoot], pants, 8);
    path([offset(leadFoot, -2, 1), offset(leadFoot, 6, 1)], '#39434d', 4);

    if (!throwing) {
      path([offset(shoulders, -5, -2), backElbow], shadow, 8);
      path([backElbow, backHand], '#776158', 5);
    }
    path([offset(shoulders, -7, -6), offset(shoulders, 8, -5),
      offset(hips, 8, 2), offset(hips, -8, 2)], jersey);
    path([offset(hips, -7), offset(hips, 7)], shadow, 2);
    path([offset(shoulders, 5), leadElbow], jersey, 8);
    path([leadElbow, leadHand], skin, 5);

    oval(head, 6.7, 7.2, skin);
    path([offset(head, -7), offset(head, -6, -6), offset(head, -2, -8),
      offset(head, 4, -8), offset(head, 7, -4), offset(head, 11, -3),
      offset(head, 11, -1), offset(head, 2, -2), offset(head, -6, 3)], shadow);
    path([offset(head, -4, -5), offset(head, 4, -5)], jersey, 1.5);
    if (throwing) {
      path([offset(shoulders, -5, -2), backElbow], shadow, 6);
      path([backElbow, backHand], skin, 4.5);
      oval(leadHand, 5.5, 4.5, '#76665d');
      path([offset(leadHand, -3, -1), offset(leadHand, 3, 1)], '#50433e', 1);
      if (progress >= 0.38 && progress <= releaseTime) oval(backHand, 2.5, 2.5, ball);
      if (progress > releaseTime && progress < releaseTime + 0.09) {
        const flight = (progress - releaseTime) / 0.09;
        const x = mix(104, 162, flight);
        const y = mix(20, 44, flight);
        path([[x - 13, y - 4], [x - 5, y - 1]], '#869bb0', 1.5);
        oval([x, y], 2.4, 2.4, ball);
      }
    } else {
      // The projected barrel gets shorter momentarily as it points away.
      const alongBat = fraction => offset(leadHand, barrel[0] * fraction, barrel[1] * fraction);
      path([alongBat(-0.1), alongBat(1)], '#77706b', 3.2);
      path([alongBat(0.47), alongBat(1)], '#625b57', 4.8);
      oval(leadHand, 2.7, 2.7, skin);
      const entryTime = contactTime - 0.15;
      const exitTime = contactTime + 0.095;
      if (progress >= entryTime && progress <= exitTime) {
        const hit = progress >= contactTime;
        const flight = hit ? (progress - contactTime) / (exitTime - contactTime)
          : (progress - entryTime) / (contactTime - entryTime);
        const x = mix(hit ? 113 : 162, hit ? 162 : 113, flight);
        const y = mix(hit ? 52 : 46, hit ? 20 : 52, flight);
        if (hit) path([[x - 12, y + 8], [x - 4, y + 3]], '#8e99a3', 1.5);
        oval([x, y], 2.4, 2.4, ball);
      }
    }
    ctx.restore();
  }

  for (const canvas of start.querySelectorAll('canvas[data-motion]')) {
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.scale(2, 2);
    const throwing = canvas.dataset.motion === 'pitching';
    const frames = throwing ? pitching : batting;
    let request = 0;
    let started;
    let loops = 0;
    const render = progress => {
      const frame = throwing && progress >= pitchingReset ? pitchingReady : interpolate(frames, progress);
      draw(ctx, throwing, frame, progress);
    };
    const tick = now => {
      started ??= now;
      const elapsed = now - started;
      if (elapsed >= loops * duration) {
        request = 0;
        render(0);
        return;
      }
      render((elapsed % duration) / duration);
      request = window.requestAnimationFrame(tick);
    };
    function play(count) {
      if (reducedMotion.matches || request) return;
      started = undefined;
      loops = count;
      request = window.requestAnimationFrame(tick);
    }
    canvas.parentElement.addEventListener('pointerenter', () => play(1));
    canvas.parentElement.addEventListener('focus', () => play(1));
    reducedMotion.addEventListener('change', () => {
      window.cancelAnimationFrame(request);
      request = 0;
      render(reducedMotion.matches ? (throwing ? releaseTime : contactTime) : 0);
      play(2);
    });
    render(reducedMotion.matches ? (throwing ? releaseTime : contactTime) : 0);
    play(2);
  }
})();

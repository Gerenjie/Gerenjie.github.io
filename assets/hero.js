// Ambient orrery for the home-page hero: every minor planet Rubin (MPC X05) has discovered,
// propagated on two-body Keplerian orbits. Data format matches the full orrery at /x05-orrery/.
(async function () {
  const cv = document.getElementById('hero-sky');
  if (!cv || !window.X05_B64 || !('DecompressionStream' in window)) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const bin = Uint8Array.from(atob(window.X05_B64), (c) => c.charCodeAt(0));
  const raw = new Uint8Array(await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const N = raw.length / 13;
  let off = 0;
  const take = (T) => { const n = N * T.BYTES_PER_ELEMENT; const x = new T(raw.buffer.slice(off, off + n)); off += n; return x; };
  const qA = take(Uint16Array), qE = take(Uint16Array), qI = take(Uint8Array), qO = take(Uint8Array), qW = take(Uint8Array), qM = take(Uint16Array);
  take(Uint8Array); const qC = take(Uint8Array);

  const K = 0.01720209895, EPOCH = 61200;
  const a = new Float32Array(N), e = new Float32Array(N), n = new Float64Array(N), M0 = new Float64Array(N);
  const P = new Float32Array(N * 3), Q = new Float32Array(N * 3), grp = new Uint8Array(N);
  const GRP = [0, 0, 1, 2, 2, 3, 2, 3]; // class -> colour group
  for (let k = 0; k < N; k++) {
    a[k] = Math.pow(10, qA[k] / 65535 * 3.6 - 0.1); e[k] = qE[k] / 65535;
    n[k] = K / Math.pow(a[k], 1.5); M0[k] = qM[k] / 65536 * 2 * Math.PI; grp[k] = GRP[qC[k]];
    const i = qI[k] / 2 * Math.PI / 180, O = qO[k] / 256 * 2 * Math.PI, w = qW[k] / 256 * 2 * Math.PI;
    const cO = Math.cos(O), sO = Math.sin(O), cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i);
    P[k*3] = cO*cw - sO*sw*ci; P[k*3+1] = sO*cw + cO*sw*ci; P[k*3+2] = sw*si;
    Q[k*3] = -cO*sw - sO*cw*ci; Q[k*3+1] = -sO*sw + cO*cw*ci; Q[k*3+2] = cw*si;
  }
  const PLANETS = [[0.387, 0.206, 77.46, 252.25], [0.723, 0.007, 131.5, 181.98], [1.0, 0.017, 102.9, 100.46], [1.524, 0.093, 336.0, 355.45], [5.203, 0.048, 14.33, 34.35]]
    .map(([pa, pe, pv, pL]) => ({ a: pa, e: pe, v: pv * Math.PI / 180, M0: (pL - pv) * Math.PI / 180, n: K / Math.pow(pa, 1.5) }));

  const css = getComputedStyle(document.documentElement);
  const COL = ['--neo', '--mb', '--res', '--out'].map((v) => css.getPropertyValue(v).trim());
  const kepler = (M, ecc) => { let E = M + ecc * Math.sin(M); for (let j = 0; j < (ecc > 0.6 ? 7 : 4); j++) E -= (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E)); return E; };

  let W = 0, H = 0, dpr = 1;
  const scr = new Float32Array(N * 2);
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect(); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }

  let t = 61312, az = 0.6; // 2026-09-29
  const tilt = 1.02;        // ~58 degrees: a raked, three-quarter view of the belt
  function draw() {
    const wide = W > 760;
    const cx = wide ? W * 0.66 : W * 0.5, cy = H * (wide ? 0.5 : 0.42);
    const s = Math.min(wide ? W * 0.62 : W, H * 1.6) / 2 / 3.6;
    const cA = Math.cos(az), sA = Math.sin(az), cT = Math.cos(tilt), sT = Math.sin(tilt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // planet orbits
    ctx.strokeStyle = 'rgba(170,180,200,.18)'; ctx.lineWidth = 1;
    for (const p of PLANETS) {
      ctx.beginPath();
      for (let j = 0; j <= 120; j++) {
        const E = j / 120 * 2 * Math.PI, x0 = p.a * (Math.cos(E) - p.e), y0 = p.a * Math.sqrt(1 - p.e * p.e) * Math.sin(E);
        const x = x0 * Math.cos(p.v) - y0 * Math.sin(p.v), y = x0 * Math.sin(p.v) + y0 * Math.cos(p.v);
        const X = cx + (x * cA - y * sA) * s, Y = cy - (x * sA + y * cA) * cT * s;
        j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < N; k++) {
      const E = kepler(M0[k] + n[k] * (t - EPOCH), e[k]), o = k * 3;
      const x = a[k] * (Math.cos(E) - e[k]), y = a[k] * Math.sqrt(1 - e[k] * e[k]) * Math.sin(E);
      const X = x * P[o] + y * Q[o], Y = x * P[o+1] + y * Q[o+1], Z = x * P[o+2] + y * Q[o+2];
      scr[k*2] = cx + (X * cA - Y * sA) * s;
      scr[k*2+1] = cy - ((X * sA + Y * cA) * cT + Z * sT) * s;
    }
    for (const g of [1, 2, 3, 0]) {
      ctx.fillStyle = COL[g]; ctx.globalAlpha = g === 1 ? 0.38 : 0.9;
      const z = g === 1 ? 1.3 : 2.2, h = z / 2;
      for (let k = 0; k < N; k++) {
        if (grp[k] !== g) continue;
        const x = scr[k*2], y = scr[k*2+1];
        if (x < -3 || y < -3 || x > W + 3 || y > H + 3) continue;
        ctx.fillRect(x - h, y - h, z, z);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // planets + Sun
    ctx.fillStyle = 'rgba(225,230,240,.85)';
    for (const p of PLANETS) {
      const E = kepler(p.M0 + p.n * (t - 51544.5), p.e), x0 = p.a * (Math.cos(E) - p.e), y0 = p.a * Math.sqrt(1 - p.e * p.e) * Math.sin(E);
      const x = x0 * Math.cos(p.v) - y0 * Math.sin(p.v), y = x0 * Math.sin(p.v) + y0 * Math.cos(p.v);
      ctx.beginPath(); ctx.arc(cx + (x * cA - y * sA) * s, cy - (x * sA + y * cA) * cT * s, p.a > 4 ? 3.2 : 2.2, 0, 7); ctx.fill();
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
    g.addColorStop(0, 'rgba(255,236,190,1)'); g.addColorStop(0.3, 'rgba(255,205,140,.7)'); g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.fill();
  }

  let visible = true, raf = 0, last = performance.now();
  function loop(now) {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    t += dt * 20; az += dt * 0.012;
    draw();
    if (visible && !document.hidden) raf = requestAnimationFrame(loop);
  }
  const start = () => { if (!raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) start(); }).observe(cv);
  document.addEventListener('visibilitychange', start);
  new ResizeObserver(() => { resize(); draw(); }).observe(cv);
  resize(); draw(); cv.classList.add('ready'); start();
})();

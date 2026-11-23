/* Lane Dash: drag your car sideways. Let go and it snaps into the nearest of 3 lanes.
   Traffic gets faster and denser over time. Score = cars you pass. A crash ends the run. Solo. */
(() => {
    const W = 300,
        H = 460,
        LANE_W = W / 3,
        CAR_W = 44,
        CAR_H = 76,
        CAR_Y = H - 100;
    // Crash box for each car (centre-to-centre distance that counts as a hit).
    // Smaller than the drawn car, so near-misses don't crash.
    const BOX_W = 26,
        BOX_H = 40;
    const laneX = i => LANE_W * i + LANE_W / 2;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    BrawlBox.registerGame('lane-dash', {
        start(stage, api) {
            stage.innerHTML = `<style>.ld-canvas{width:min(88vw,${W}px);height:auto;aspect-ratio:${W}/${H};touch-action:none;cursor:grab;border-radius:18px}</style>
        <p class="g-sub">Drag your car. Let go to snap into a lane.</p>
        <canvas class="ld-canvas" id="ld-cv" width="${W}" height="${H}"></canvas><p class="g-sub" id="ld-count">Passed: 0</p>`;
            const cv = stage.querySelector('#ld-cv'),
                ctx = cv.getContext('2d'),
                countEl = stage.querySelector('#ld-count');
            const car = {
                x: laneX(1),
                target: laneX(1)
            };
            let cars = [],
                passed = 0,
                dragging = false,
                dragOffset = 0;
            let over = false,
                raf = 0,
                last = 0,
                spawnIn = 0.6,
                t0 = 0,
                timeoutId = 0;
            const toLogical = e => {
                const r = cv.getBoundingClientRect();
                return {
                    x: (e.clientX - r.left) * (W / r.width),
                    y: (e.clientY - r.top) * (H / r.height)
                };
            };
            const onDown = e => {
                if (over) return;
                const p = toLogical(e);
                if (Math.abs(p.x - car.x) < CAR_W + 16 && Math.abs(p.y - CAR_Y) < CAR_H) {
                    dragging = true;
                    dragOffset = car.x - p.x;
                    cv.setPointerCapture(e.pointerId);
                }
            };
            const onMove = e => {
                if (!dragging) return;
                const p = toLogical(e);
                car.x = clamp(p.x + dragOffset, CAR_W / 2, W - CAR_W / 2);
            };
            const onUp = () => {
                if (!dragging) return;
                dragging = false;
                car.target = laneX(clamp(Math.floor(car.x / LANE_W), 0, 2));
            };
            const spawn = () => {
                const blocked = Math.random() < 0.35 ? 2 : 1;
                BrawlBox.util.shuffle([0, 1, 2]).slice(0, blocked).forEach(i => cars.push({
                    x: laneX(i),
                    y: -CAR_H,
                    counted: false
                }));
            };
            const crash = () => {
                if (over) return;
                over = true;
                api.sfx('bad');
                const r = cv.getBoundingClientRect(),
                    k = r.width / W;
                api.burst(r.left + car.x * k, r.top + CAR_Y * k, 40);
                timeoutId = setTimeout(() => api.finish(), 500);
            };
            const update = (dt, el) => {
                if (!dragging) car.x += (car.target - car.x) * Math.min(1, dt * 12);
                const speed = 180 + Math.min(280, el * 10);
                cars.forEach(c => c.y += speed * dt);
                cars.forEach(c => {
                    if (!c.counted && c.y > CAR_Y + CAR_H) {
                        c.counted = true;
                        passed++;
                        api.setScore(passed);
                        countEl.textContent = `Passed: ${passed}`
                    }
                    if (Math.abs(c.x - car.x) < BOX_W && Math.abs(c.y - CAR_Y) < BOX_H) crash();
                });
                cars = cars.filter(c => c.y < H + CAR_H);
                spawnIn -= dt;
                if (spawnIn <= 0) {
                    spawn();
                    spawnIn = Math.max(.45, 1.1 - el * .02)
                }
            };
            const draw = () => {
                ctx.fillStyle = '#3a3a5c';
                ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = '#2d2d48';
                ctx.fillRect(0, 0, 6, H);
                ctx.fillRect(W - 6, 0, 6, H);
                ctx.setLineDash([24, 20]);
                ctx.lineWidth = 4;
                ctx.strokeStyle = 'rgba(255,255,255,.55)';
                [LANE_W, LANE_W * 2].forEach(x => {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, H);
                    ctx.stroke()
                });
                ctx.setLineDash([]);
                ctx.font = '44px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                cars.forEach(c => ctx.fillText('🚙', c.x, c.y));
                ctx.fillText('🏎️', car.x, CAR_Y);
            };
            const frame = now => {
                const dt = Math.max(0, Math.min(.05, (now - last) / 1000));
                last = now;
                if (!over) update(dt, (now - t0) / 1000);
                draw();
                if (!over) raf = requestAnimationFrame(frame)
            };
            t0 = last = performance.now();
            spawn();
            cv.addEventListener('pointerdown', onDown);
            cv.addEventListener('pointermove', onMove);
            cv.addEventListener('pointerup', onUp);
            cv.addEventListener('pointercancel', onUp);
            api.onStop(() => {
                cancelAnimationFrame(raf);
                clearTimeout(timeoutId);
                cv.removeEventListener('pointerdown', onDown);
                cv.removeEventListener('pointermove', onMove);
                cv.removeEventListener('pointerup', onUp);
                cv.removeEventListener('pointercancel', onUp)
            });
            raf = requestAnimationFrame(frame);
        },
    });
})();
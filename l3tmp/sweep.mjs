import { openApp, evaluate, waitFor, sleep, clickButtonByText } from '../scripts/recette/lib.mjs';

const URL = 'http://localhost:5230/';
const session = await openApp(URL, { width: 1600, height: 900 });
try {
  console.log(await evaluate(session, `__wfrp.scenario('diligence', 42)`));
  await waitFor(session, '!!__wfrp.state()');
  await evaluate(session, '__wfrp.fog(false)');
  await waitFor(session, `!!document.querySelector('canvas.iso-stage[data-vue]')`, { timeoutMs: 20000 });
  for (let i = 0; i < 10; i++) {
    if (!(await evaluate(session, `!!document.querySelector('.modal-overlay')`))) break;
    const t = await evaluate(session, `[...document.querySelectorAll('.modal-overlay button:not(:disabled)')].map(b=>b.textContent.trim())`);
    const l = ['Terminer', 'Continuer', 'Fermer'].find((x) => t.some((y) => y.includes(x)));
    if (!l) break;
    await clickButtonByText(session, l);
    await sleep(400);
  }
  const rows = [];
  for (let x = 1; x < 32; x += 1) {
    for (let y = 1; y < 38; y += 1) {
      const r = await evaluate(session, `(async () => {
        globalThis.__l3 = null;
        __wfrp.store.setState({ partyPos: { x: ${x}, y: ${y}, z: 0 } });
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const d = globalThis.__l3;
        return d ? { aj: d.ajoutees, zones: d.zoneIds.length, over: d.overhead, rl: d.roomless } : null;
      })()`);
      if (r && r.aj && r.aj.length) rows.push({ x, y, ...r });
    }
  }
  console.log(JSON.stringify(rows));
} finally {
  await session.close();
}

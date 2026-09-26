import { mkdirSync, writeFileSync } from 'node:fs';
import { openApp, evaluate, waitFor, sleep, clickButtonByText } from '../scripts/recette/lib.mjs';

const URL = 'http://localhost:5230/';
const SUFFIXE = process.argv[2] ?? 'avant';
const OUT = process.argv[3] ?? 'C:/Users/gauch/AppData/Local/Temp/claude/C--Users-gauch-PhpstormProjects-Foundry-Game/87c77da4-29e3-40cc-9238-bea1ae78a458/scratchpad/l3-ab';
const POS = (process.argv[4] ? JSON.parse(process.argv[4]) : [
  { nom: 'A', x: 17, y: 2, z: 0 },
  { nom: 'B', x: 10, y: 3, z: 0 },
  { nom: 'C', x: 20, y: 12, z: 0 },
]);

mkdirSync(OUT, { recursive: true });
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
  // Cran par DÉFAUT et zoom 1, par les actions du jeu (aucune écriture de caméra parallèle).
  console.log(await evaluate(session, `(() => { const g = () => __wfrp.store.getState(); g().setZoom(1); return { camRot: g().camRot, viewMode: g().viewMode, zoom: g().zoom }; })()`));
  for (const p of POS) {
    await evaluate(session, `__wfrp.store.setState({ partyPos: { x: ${p.x}, y: ${p.y}, z: ${p.z} } })`);
    await sleep(1200);
    if (await evaluate(session, `!!document.querySelector('.modal-overlay')`)) {
      const t = await evaluate(session, `[...document.querySelectorAll('.modal-overlay button:not(:disabled)')].map(b=>b.textContent.trim())`);
      const l = ['Terminer', 'Continuer', 'Fermer'].find((x) => t.some((y) => y.includes(x)));
      if (l) { await clickButtonByText(session, l); await sleep(600); }
    }
    const clip = await evaluate(session, `(() => {
      const c = document.querySelector('canvas.iso-stage');
      const r = c.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), scale: 1 };
    })()`);
    const r = await session.rpc('Page.captureScreenshot', { format: 'png', clip });
    const buf = Buffer.from(r.data, 'base64');
    const f = `${OUT}/${p.nom}-${SUFFIXE}.png`;
    writeFileSync(f, buf);
    console.log(`OK ${f} (${(buf.length / 1024).toFixed(0)} Ko) pos=${p.x},${p.y},${p.z}`);
  }
} finally {
  await session.close();
}

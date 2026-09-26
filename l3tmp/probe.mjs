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
    console.log('modal buttons', t);
    const l = ['Terminer', 'Continuer', 'Fermer'].find((x) => t.some((y) => y.includes(x)));
    if (!l) break;
    await clickButtonByText(session, l);
    await sleep(400);
  }
  const info = await evaluate(session, `(() => {
    const s = __wfrp.store.getState();
    const sc = s.scene;
    return {
      sceneId: sc.id, dims: sc.dimensions, partyPos: s.partyPos,
      arch: sc.architecture.map(b => ({ id: b.id, storeys: b.storeys.map(st => ({ id: st.id, z: st.z, nparts: st.parts.length, rooms: st.roomZoneIds, parts: st.parts.map(p => ({ kind: p.kind, rect: p.rect, cells: p.cells && p.cells.length })) })) })),
      zones: (sc.effectZones ?? []).map(z => ({ id: z.id, kind: z.kind, rect: z.rect, cells: z.cells && z.cells.length, z: z.z })),
    };
  })()`);
  console.log(JSON.stringify(info, null, 1).slice(0, 6000));
} finally {
  await session.close();
}

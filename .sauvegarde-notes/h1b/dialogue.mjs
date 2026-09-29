import { writeFileSync } from 'node:fs';
const { openApp, evaluate, setViewport, sleep, shot, consoleGuard, resoudreModales, attendreSelecteur } = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
const DIR = '/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/h1b/apres';
const session = await openApp();
const guard = consoleGuard(session);
const out = {};
try {
  await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(session, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(500);
  await resoudreModales(session, 'intro');
  await evaluate(session, `(() => { const s = window.__wfrp.store.getState(); const e = (s.scene.entities || []).find((x) => x.kind !== 'hero') || {}; window.__wfrp.store.setState({ dialogue: { dialogue: { id: 'recette', start: 'n1', nodes: [{ id: 'n1', desc: 'Halte, voyageurs ! La route est dangereuse passé le gué, et les mutants rôdent dans les collines.', choices: [{ label: 'Nous passerons quand même.' }, { label: 'Parlez-nous de ces mutants.' }] }] }, nodeId: 'n1', speakerId: e.id, session: 1 } }); })()`);
  await sleep(600);
  for (const [w, h] of [[360, 740], [900, 780], [1366, 650]]) {
    await setViewport(session, w, h);
    await sleep(600);
    out[`${w}x${h}`] = await evaluate(session, `(() => { const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.x*10)/10, Math.round(b.y*10)/10, Math.round(b.width*10)/10, Math.round(b.height*10)/10]; }; const d = document.querySelector('.dialogue-box'); return { dialogue: r(d), zone: d && d.closest('[data-zone]') ? d.closest('[data-zone]').dataset.zone : null, zoneRect: r(d && d.closest('[data-zone]')), flot: r(document.querySelector('.stage-flot')), pont: r(document.querySelector('.stage > .exploration-dock')), objectif: r(document.querySelector('.objective-banner')), position: d ? getComputedStyle(d).position : null }; })()`);
    await shot(session, `exploration-dialogue-${w}x${h}`, DIR);
  }
} finally {
  out.console = guard.entries;
  guard.stop();
  await session.close();
}
writeFileSync('/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/h1b/dialogue.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));

// Sonde du juge C1d (lecture seule) : mots tranchés du fil et du journal, largeur du panneau du journal, 701-900.
const L = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur, clickButtonByText, cliquerSelecteur, shot } = L;
const DIR = '/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/juge-c1d';
const s = await openApp('http://localhost:5397/');
const MESURE = `(() => {
  const out = { panel: null, mots: [], segments: [] };
  const p = document.querySelector('.ld-panel'); if (p) { const b = p.getBoundingClientRect(); out.panel = [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }
  for (const racine of document.querySelectorAll('.combat-feed, .ld-panel')) {
    for (const b of racine.querySelectorAll('b')) out.segments.push(b.className + ':' + b.textContent + ':' + (b.querySelector('.nom-mot') ? 'Nom' : 'nu'));
    const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const re = /\\S+/g;
      for (let m = re.exec(n.data); m; m = re.exec(n.data)) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const tops = [...new Set([...r.getClientRects()].filter((x) => x.width > 0.5).map((x) => Math.round(x.top)))];
        if (tops.length > 1) out.mots.push((racine.classList.contains('ld-panel') ? 'journal' : 'fil') + ':' + m[0] + ':' + tops.length + 'l:' + (n.parentElement.className || n.parentElement.tagName));
      }
    }
  }
  return out;
})()`;
try {
  await evaluate(s, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(s, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(400); await resoudreModales(s, 'intro');
  await setViewport(s, 1707, 780);
  await evaluate(s, `window.__wfrp.fight('enc-mutants')`); await sleep(1500);
  await resoudreModales(s, 'ouverture');
  if (await evaluate(s, `!!document.querySelector(".cc-phase [data-action='round-start']:not(:disabled)")`)) {
    await clickButtonByText(s, 'Commencer'); await sleep(900); await resoudreModales(s, 'round');
  }
  for (let i = 0; i < 6; i++) { await sleep(1500); await resoudreModales(s, 'x'); }
  await cliquerSelecteur(s, '.log-drawer .ld-btn'); await sleep(500);
  for (const w of [701, 740, 780, 820, 860, 900, 1100]) {
    await setViewport(s, w, 780); await sleep(900);
    const m = await evaluate(s, MESURE);
    console.log(w + 'x780 ' + JSON.stringify(m));
    if (w === 701) await shot(s, 'J-701x780', DIR);
  }
} finally { await s.close(); }

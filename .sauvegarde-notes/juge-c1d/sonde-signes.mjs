// Sonde du juge C1d (lecture seule) : les bornes en SIGNES (56 arche, 28 carte) tiennent-elles en deux lignes ?
const L = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur, clickButtonByText, shot } = L;
const DIR = '/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/juge-c1d';
const s = await openApp('http://localhost:5397/');
const ARCHE = 'Wolfgang Maximilian Wurmwald (Grande Mêlée Wissenlandaise)'.slice(0, 56);
const CARTE = 'Wolfgang Maximilian Wurmwald'.slice(0, 28);
const MESURE = `(() => {
  const lignes = (el) => { if (!el) return null; const r = document.createRange(); r.selectNodeContents(el); const tops = [...new Set([...r.getClientRects()].filter((x) => x.width > 0.5).map((x) => Math.round(x.top)))]; return tops.length; };
  const nom = document.querySelector('.cc-arch-name'); const inner = nom?.firstElementChild;
  const bn = nom?.getBoundingClientRect(), bi = inner?.getBoundingClientRect();
  const fig = [...document.querySelectorAll('.pd-track > figure > figcaption')].map((f) => [f.textContent, lignes(f), Math.round(f.getBoundingClientRect().height), Math.round(f.getBoundingClientRect().width)]);
  const arch = document.querySelector('.cc-arch')?.getBoundingClientRect();
  return { nom: inner?.textContent, lignes: lignes(inner), boite: bn && [Math.round(bn.width), Math.round(bn.height)], contenu: bi && Math.round(bi.height), rogne: bn && bi ? +(bi.height - bn.height).toFixed(1) : null, arche: arch && [Math.round(arch.y), Math.round(arch.height)], fig };
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
  for (let i = 0; i < 4; i++) { await sleep(1500); await resoudreModales(s, 'x'); }
  const avant = {};
  for (const w of [701, 900, 1366]) { await setViewport(s, w, w === 1366 ? 650 : 780); await sleep(700); avant[w] = await evaluate(s, MESURE); }
  await evaluate(s, `(() => { const st = window.__wfrp.store; const b = st.getState().battle; const actif = b.order[b.turn]; let carte = true;
    st.setState({ battle: { ...b, combatants: b.combatants.map((c) => { if (c.id === actif) return { ...c, label: ${JSON.stringify(ARCHE)} }; if (c.kind === 'hero' && carte) { carte = false; return { ...c, label: ${JSON.stringify(CARTE)} }; } return c; }) } }); })()`);
  await sleep(600);
  for (const w of [701, 900, 1366]) {
    await setViewport(s, w, w === 1366 ? 650 : 780); await sleep(700);
    console.log(w, 'AVANT', JSON.stringify(avant[w]));
    console.log(w, 'APRES', JSON.stringify(await evaluate(s, MESURE)));
    if (w === 701) await shot(s, 'S-signes-701x780', DIR);
  }
  console.log('longueurs', ARCHE.length, CARTE.length);
} finally { await s.close(); }

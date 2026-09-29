const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur, clickButtonByText, freezeTimeout } = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
process.env.WFRP_DEV_URL ||= 'http://localhost:5236/';
const vues = JSON.parse(process.argv[2]); const expr = process.argv[3]; const prep = process.argv[4] || 'true';
const s = await openApp();
try {
  await evaluate(s, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(s, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(500); await resoudreModales(s, 'intro');
  await setViewport(s, 1707, 780);
  await evaluate(s, `window.__wfrp.fight('enc-mutants')`); await sleep(1500);
  await resoudreModales(s, 'o', { labels: ['Tout lancer', 'Lancer', 'Continuer', 'Appliquer', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer'] });
  await clickButtonByText(s, 'Commencer le combat'); await sleep(1200); await resoudreModales(s, 'r');
  await freezeTimeout(s, [3600000]);
  console.log('prep', JSON.stringify(await evaluate(s, prep))); await sleep(800);
  for (const [w, h] of vues) { await setViewport(s, w, h); await sleep(700); console.log(w, h, JSON.stringify(await evaluate(s, expr))); }
} finally { await s.close(); }

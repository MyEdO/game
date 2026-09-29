const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur, clickButtonByText } = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
process.env.WFRP_DEV_URL ||= 'http://localhost:5236/';
const vues = JSON.parse(process.argv[2]);
const expr = process.argv[3];
const etat = process.argv[4] || 'heros';
const s = await openApp();
try {
  await evaluate(s, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(s, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(500); await resoudreModales(s, 'intro');
  await setViewport(s, 1707, 780);
  await evaluate(s, `window.__wfrp.fight('enc-mutants')`); await sleep(1500);
  await resoudreModales(s, 'o', { labels: ['Tout lancer', 'Lancer', 'Continuer', 'Appliquer', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer'] });
  if (etat !== 'ouverture') { await clickButtonByText(s, 'Commencer le combat'); await sleep(1200); await resoudreModales(s, 'r'); }
  const kind = etat === 'adverse' ? 'enemy' : 'hero';
  if (etat === 'heros' || etat === 'adverse') {
    await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order.find((x) => { const c = b.combatants.find((c) => c.id === x) || {}; return '${kind}' === 'hero' ? c.kind === 'hero' : c.kind !== 'hero'; }); return window.__wfrp.turn(id); })()`);
    await sleep(1000); if (etat === 'heros') await resoudreModales(s, 't');
  }
  for (const [w, h] of vues) {
    await setViewport(s, w, h); await sleep(700);
    console.log(w, h, JSON.stringify(await evaluate(s, expr)));
  }
} finally { await s.close(); }

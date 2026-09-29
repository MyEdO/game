const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur, clickButtonByText } = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
process.env.WFRP_DEV_URL ||= 'http://localhost:5236/';
const s = await openApp();
try {
  await evaluate(s, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(s, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(500); await resoudreModales(s, 'intro');
  await setViewport(s, 1707, 780);
  await evaluate(s, `window.__wfrp.fight('enc-mutants')`); await sleep(1500);
  await resoudreModales(s, 'o', { labels: ['Tout lancer', 'Lancer', 'Continuer', 'Appliquer', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer'] });
  await clickButtonByText(s, 'Commencer le combat'); await sleep(1200); await resoudreModales(s, 'r');
  await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order.find((x) => (b.combatants.find((c) => c.id === x) || {}).kind === 'hero'); return window.__wfrp.turn(id); })()`);
  await sleep(1000); await resoudreModales(s, 't');
  for (const [w, h] of (process.argv[2] ? JSON.parse(process.argv[2]) : [[1707, 780], [1366, 650]])) {
    await setViewport(s, w, h); await sleep(600);
    console.log(w, h, JSON.stringify(await evaluate(s, process.argv[3] || `(() => { const b = document.querySelector('.cc-arch-body'); const R = (e) => { const r = e.getBoundingClientRect(); return [String(e.className).split(' ')[0], +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1), e.scrollHeight]; }; return { body: R(b), kids: [...b.children].map(R), gut: [...b.querySelectorAll('.cc-gutter > *')].map(R), arch: R(document.querySelector('.cc-arch')), archKids: [...document.querySelector('.cc-arch').children].map(R) }; })()`)));
  }
} finally { await s.close(); }

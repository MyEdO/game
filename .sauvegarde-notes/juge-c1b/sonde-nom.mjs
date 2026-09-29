// Sonde du juge C1b (lecture seule) : nom de l'acteur dans l'arche — lignes, coupe au trait d'union, boîte de l'arche, empreinte.
const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur, clickButtonByText, freezeTimeout } = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
const NOMS = ['Sigmund Reikhardt', 'Grunni Pierre-de-Fer', 'Aelindra Feuille-d’Argent', 'Knud Cratinx Klein Bürger-de-Fer', "Mangeuse d'hommes de la Drakwald (Araignée Géante)"];
const GEO = `(() => { const n = document.querySelector('.cc-arch-name'); const a = document.querySelector('.cc-arch'); const cc = document.querySelector('.stage > .combat-console');
  const t = n.firstChild && n.firstChild.nodeType === 3 ? n.firstChild : null; const lignes = [];
  const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let tn; let cur = null; let y = null;
  while ((tn = walker.nextNode())) { for (let i = 0; i < tn.length; i++) { const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + 1); const b = r.getClientRects()[0]; if (!b) continue; const yy = Math.round(b.top); if (y === null || Math.abs(yy - y) > 3) { lignes.push(''); y = yy; } lignes[lignes.length - 1] += tn.data[i]; } }
  const b = a.getBoundingClientRect(); return { lignes, arche: [+b.x.toFixed(1), +b.y.toFixed(1), +b.width.toFixed(1), +b.height.toFixed(1)], pontPct: +(100 * cc.getBoundingClientRect().height / innerHeight).toFixed(1), debordX: n.scrollWidth - n.clientWidth }; })()`;
const s = await openApp('http://127.0.0.1:5391/');
try {
  await evaluate(s, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(s, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(500); await resoudreModales(s, 'intro');
  await setViewport(s, 1707, 780);
  await evaluate(s, `window.__wfrp.fight('enc-mutants')`); await sleep(1500);
  await resoudreModales(s, 'o', { labels: ['Tout lancer', 'Lancer', 'Continuer', 'Appliquer', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer'] });
  await sleep(500); await clickButtonByText(s, 'Commencer le combat'); await sleep(1200); await resoudreModales(s, 'r');
  await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order.find((x) => (b.combatants.find((c) => c.id === x) || {}).kind === 'hero'); return window.__wfrp.turn(id); })()`);
  await sleep(900); await resoudreModales(s, 'tour'); await freezeTimeout(s, [3600000]);
  for (const nom of NOMS) {
    await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order[b.turn]; window.__wfrp.store.setState({ battle: { ...b, combatants: b.combatants.map((x) => x.id === id ? { ...x, label: ${JSON.stringify(nom)} } : x) } }); })()`);
    await sleep(400);
    for (const [w, h] of [[1707, 780], [1366, 650], [900, 780], [701, 780], [700, 780], [360, 740]]) { await setViewport(s, w, h); await sleep(500); console.log(w + 'x' + h, JSON.stringify(await evaluate(s, GEO))); }
  }
} finally { await s.close(); }

// Sonde du juge C1b (lecture seule) : captures 561/600×780, tour de héros et pause de Round ; recouvrement frise/fil × groupe.
const { openApp, evaluate, setViewport, sleep, shot, resoudreModales, attendreSelecteur, clickButtonByText, freezeTimeout } = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
const DIR = '/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/juge-c1b/captures';
const GEO = `(() => { const R = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [+b.x.toFixed(1), +b.y.toFixed(1), +b.width.toFixed(1), +b.height.toFixed(1)]; };
  const inter = (a, b) => { if (!a || !b) return null; const ox = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]); const oy = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]); return ox > 0.5 && oy > 0.5 ? [+ox.toFixed(1), +oy.toFixed(1)] : null; };
  const g = R("[data-zone='groupe'] > *"), f = R('.initiative-strip'), fil = R('.combat-feed'), o = R("[data-zone='ouverture'] > *");
  return { zoneTemps: R("[data-zone='temps']"), groupe: g, frise: f, fil, friseXgroupe: inter(f, g), filXgroupe: inter(fil, g), friseXouv: inter(f, o), filXouv: inter(fil, o) }; })()`;
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
  for (const etat of ['A', 'P']) {
    if (etat === 'P') { await evaluate(s, `window.__wfrp.store.setState({ pendingRoundStart: { round: 2, readyBySeat: {} } })`); await sleep(500); }
    for (const [w, h] of [[561, 780], [600, 780]]) { await setViewport(s, w, h); await sleep(700); console.log(etat, w + 'x' + h, JSON.stringify(await evaluate(s, GEO))); console.log(await shot(s, `${etat}-${w}x${h}`, DIR, { neutraliser: false })); }
  }
} finally { await s.close(); }

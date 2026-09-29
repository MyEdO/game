// Sonde du juge C1b (lecture seule) : débords de la frise hors de sa zone/piste, fil × bandeau de phase,
// boîte de l'arche d'une forme à l'autre et d'un acteur à l'autre (nom long), budget sous pointeur grossier.
const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur, clickButtonByText, cliquerAction, freezeTimeout, unfreezeTimeout } = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
const GEO = `(() => {
  const R = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [+b.x.toFixed(1), +b.y.toFixed(1), +b.width.toFixed(1), +b.height.toFixed(1)]; };
  const q = (s) => document.querySelector(s);
  const inter = (a, b) => { if (!a || !b) return null; const ox = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]); const oy = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]); return ox > 0.5 && oy > 0.5 ? [+ox.toFixed(1), +oy.toFixed(1)] : null; };
  const W = innerWidth, H = innerHeight;
  const cc = q('.stage > .combat-console');
  const zone = R(q("[data-zone='temps']")), piste = R(q("[data-piste='frise']")), frise = R(q('.initiative-strip'));
  const fil = R(q('.combat-feed')), phase = R(q('.combat-console > .cc-phase'));
  const cells = [...document.querySelectorAll('.combat-console .cc-cell, .combat-console .cc-set, .combat-console .cc-end')];
  const hors = cells.filter((c) => { const b = c.getBoundingClientRect(); return b.width > 0 && (b.x < -0.5 || b.y < -0.5 || b.right > W + 0.5 || b.bottom > H + 0.5); }).length;
  const n = q('.cc-arch-name');
  let lignes = null; if (n) { const r = document.createRange(); r.selectNodeContents(n); lignes = new Set([...r.getClientRects()].map((x) => Math.round(x.y))).size; }
  const cell = q('.cc-grid-right .cc-cell');
  return { vue: [W, H], doigt: matchMedia('(pointer: coarse)').matches, forme: cc && cc.dataset.forme,
    pontPct: cc ? +(100 * cc.getBoundingClientRect().height / H).toFixed(1) : null,
    bande: R(q('.cc-dock')), arche: R(q('.cc-arch')), portrait: R(q('.cc-arch .ptile')), nom: n && n.textContent, nomLignes: lignes,
    case: cell ? +cell.getBoundingClientRect().width.toFixed(1) : null, hors,
    zone, piste, frise, friseHorsZoneDroite: frise && zone ? +((frise[0] + frise[2]) - (zone[0] + zone[2])).toFixed(1) : null,
    friseHorsPisteDroite: frise && piste ? +((frise[0] + frise[2]) - (piste[0] + piste[2])).toFixed(1) : null,
    fil, filHorsZoneBas: fil && zone ? +((fil[1] + fil[3]) - (zone[1] + zone[3])).toFixed(1) : null, filXphase: inter(fil, phase), filXfrise: inter(fil, frise),
    defile: document.scrollingElement.scrollHeight > H + 1 };
})()`;
const log = (...a) => console.log(...a);
const s = await openApp('http://127.0.0.1:5391/');
async function passe(tag, vues) { for (const [w, h] of vues) { await setViewport(s, w, h); await sleep(700); log(tag, JSON.stringify(await evaluate(s, GEO))); } }
try {
  await evaluate(s, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(s, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(500); await resoudreModales(s, 'intro');
  await setViewport(s, 1707, 780);
  await evaluate(s, `window.__wfrp.fight('enc-mutants')`); await sleep(1500);
  await resoudreModales(s, 'o', { labels: ['Tout lancer', 'Lancer', 'Continuer', 'Appliquer', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer'] });
  await sleep(500);
  await clickButtonByText(s, 'Commencer le combat'); await sleep(1200); await resoudreModales(s, 'r');
  const heros = await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const kind = (id) => (b.combatants.find((c) => c.id === id) || {}).kind;
    for (let i = 0; i < b.order.length; i++) { const sv = b.order[(i + 1) % b.order.length]; if (kind(b.order[i]) === 'hero' && kind(sv) !== 'hero') { const r = window.__wfrp.turn(b.order[i]); if (typeof r === 'string' && r.startsWith('\\u2713')) return b.order[i]; } } return null; })()`);
  log('heros', heros);
  await sleep(900); await resoudreModales(s, 'tour');
  await freezeTimeout(s, [3600000]);
  const LARG = [[1707, 780], [1366, 650], [901, 780], [900, 780], [800, 780], [701, 780], [700, 780], [680, 780], [640, 780], [600, 780], [561, 780], [560, 650], [360, 650]];
  await passe('A', LARG);
  await evaluate(s, `window.__wfrp.store.setState({ pendingRoundStart: { round: 2, readyBySeat: {} } })`); await sleep(500);
  await passe('P', LARG);
  await evaluate(s, `window.__wfrp.store.setState({ pendingRoundStart: null })`); await sleep(400);
  // Nom long sur l'acteur au trait (mise en place __wfrp) : la boîte de l'arche bouge-t-elle ?
  const nomOrig = await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order[b.turn]; const c = b.combatants.find((x) => x.id === id); const l = c.label; window.__wfrp.store.setState({ battle: { ...b, combatants: b.combatants.map((x) => x.id === id ? { ...x, label: 'Knud Cratinx Klein Bürger-de-Fer' } : x) } }); return l; })()`);
  log('nomOrig', nomOrig); await sleep(500);
  await passe('A-long', [[1707, 780], [1366, 650], [900, 780], [701, 780]]);
  await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order[b.turn]; window.__wfrp.store.setState({ battle: { ...b, combatants: b.combatants.map((x) => x.id === id ? { ...x, label: ${JSON.stringify(nomOrig)} } : x) } }); })()`);
  await sleep(400);
  // Pointeur grossier émulé (CDP)
  await s.rpc('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await s.rpc('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
  await sleep(300);
  await passe('T', [[360, 650], [360, 740], [390, 844], [560, 650], [640, 780], [700, 780], [768, 1024], [820, 1180], [901, 650], [901, 780], [1024, 600], [1024, 768], [1180, 820], [1280, 720], [1366, 650], [1366, 1024]]);
  await s.rpc('Emulation.setEmitTouchEventsForMouse', { enabled: false });
  await s.rpc('Emulation.setTouchEmulationEnabled', { enabled: false });
  await sleep(300);
  // État C : Fin du tour cliqué deux fois.
  await setViewport(s, 1707, 780); await sleep(300);
  await cliquerAction(s, 'end-turn'); await sleep(300); await cliquerAction(s, 'end-turn'); await sleep(800);
  await passe('C', LARG);
  await unfreezeTimeout(s);
} finally { await s.close(); }

// Recette C1b (#1806, #1856, #1919) : captures + géométrie, états A (héros), pause de Round, journal
// ouvert, C (adverse, par « Fin du tour » cliqué deux fois) ; tactile émulé à 768×1024 et 1366×650.
// Usage : node recette.mjs <etiquette>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const LIB = '/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs';
const { openApp, evaluate, setViewport, sleep, shot, consoleGuard, resoudreModales, attendreSelecteur, clickButtonByText, cliquerSelecteur, cliquerAction, freezeTimeout, unfreezeTimeout } = await import(LIB);
const etiquette = process.argv[2] || 'x';
const DIR = join('/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/c1b', etiquette);
mkdirSync(DIR, { recursive: true });
const VUES = [[360, 740], [360, 650], [560, 650], [640, 780], [700, 780], [701, 780], [900, 780], [1366, 650], [1707, 780]];
const VUES_DOIGT = [[768, 1024], [1366, 650]];
process.env.WFRP_DEV_URL ||= 'http://localhost:5236/';

const GEO = `(() => {
  const R = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
  const q = (s) => document.querySelector(s);
  const inter = (a, b) => { if (!a || !b) return null; const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x); const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return ox > 0.5 && oy > 0.5 ? [+ox.toFixed(1), +oy.toFixed(1)] : null; };
  const W = innerWidth, H = innerHeight;
  const cc = q('.stage > .combat-console'); const dock = q('.cc-dock'); const arch = q('.cc-arch');
  const nom = q('.cc-arch-name');
  const lignes = (el) => { if (!el) return null; const lh = parseFloat(getComputedStyle(el).lineHeight) || 1; return Math.round(el.getBoundingClientRect().height / lh); };
  const nomDebord = nom ? nom.scrollWidth - nom.clientWidth : null;
  const cell = q('.cc-grid-right .cc-cell'); const ico = q('.cc-grid-right .cc-cell:not(.cc-empty) .cc-ico');
  const setIco = q('.cc-set:not(.cc-empty) .cc-ico, .cc-set:not(.cc-empty) svg');
  const feed = R(q('.combat-feed')); const phase = R(q('.combat-console > .cc-phase'));
  const frise = q('.initiative-strip'); const piste = q("[data-piste='frise']");
  const corner = q('.cc-corner'); const end = q('.cc-end');
  const x = q('.cc-bay-head .cc-key');
  const cells = [...document.querySelectorAll('.combat-console .cc-cell, .combat-console .cc-set')];
  const horsEcran = cells.filter((c) => { const b = c.getBoundingClientRect(); return b.width > 0 && (b.x < -0.5 || b.y < -0.5 || b.right > W + 0.5 || b.bottom > H + 0.5); }).length;
  // Mots coupés dans le fil : un nom dont un MOT tient sur deux lignes.
  const motsCoupes = [...document.querySelectorAll('.combat-feed .nm-ally > span > span, .combat-feed .nm-foe > span > span')].filter((s) => s.getClientRects().length > 1).map((s) => s.textContent);
  return {
    vue: [W, H], doigt: matchMedia('(pointer: coarse)').matches, forme: cc && cc.dataset.forme,
    pont: cc ? +cc.getBoundingClientRect().height.toFixed(1) : null, pontPct: cc ? +(100 * cc.getBoundingClientRect().height / H).toFixed(1) : null,
    bande: R(dock), arche: R(arch), portrait: R(q('.cc-arch .ptile')),
    nom: nom ? { texte: nom.textContent, ...R(nom), lignes: lignes(nom), debord: nomDebord, ellipse: getComputedStyle(nom).textOverflow } : null,
    case: R(cell), icone: R(ico), iconeSet: R(setIco), horsEcran,
    coin: R(corner), coinBordDroit: corner ? +(W - corner.getBoundingClientRect().right).toFixed(1) : null, fin: R(end),
    toucheX: x ? { texte: x.textContent, ...R(x) } : null,
    fil: feed, phase, filXphase: inter(feed, phase), filXfrise: inter(feed, R(frise)), motsCoupes,
    frise: R(frise), piste: R(piste), zoneTemps: R(q("[data-zone='temps']")),
    defilePage: document.scrollingElement.scrollHeight > H + 1,
  };
})()`;

const session = await openApp();
const guard = consoleGuard(session);
const out = {};
const shas = [];
async function passe(nom, vues) {
  out[nom] = [];
  for (const [w, h] of vues) {
    await setViewport(session, w, h);
    await sleep(700);
    const g = await evaluate(session, GEO);
    out[nom].push(g);
    const p = await shot(session, `${nom}-${w}x${h}`, DIR, { neutraliser: false });
    shas.push(p);
    console.log(nom, w, h, JSON.stringify({ forme: g.forme, pontPct: g.pontPct, arche: g.arche, portrait: g.portrait && g.portrait.w, case: g.case && g.case.w, icone: g.icone && g.icone.w, iconeSet: g.iconeSet && g.iconeSet.w, nom: g.nom && [g.nom.texte, g.nom.lignes, g.nom.debord], filXphase: g.filXphase, filXfrise: g.filXfrise, mots: g.motsCoupes, coinBord: g.coinBordDroit, X: g.toucheX && [g.toucheX.w, g.toucheX.h], horsEcran: g.horsEcran, defile: g.defilePage }));
  }
}
try {
  await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(session, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(500);
  await resoudreModales(session, 'intro');
  await setViewport(session, 1707, 780);
  await evaluate(session, `window.__wfrp.fight('enc-mutants')`);
  await sleep(1500);
  await resoudreModales(session, 'ouverture de combat', { labels: ['Tout lancer', 'Lancer', 'Continuer', 'Appliquer', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer'] });
  await sleep(500);
  await clickButtonByText(session, 'Commencer le combat');
  await sleep(1200);
  await resoudreModales(session, 'ouverture de Round');
  // Mise en place (__wfrp) : le trait au héros qui précède un adversaire.
  const heros = await evaluate(session, `(() => {
    const b = window.__wfrp.store.getState().battle;
    const kind = (id) => (b.combatants.find((c) => c.id === id) || {}).kind;
    for (let i = 0; i < b.order.length; i++) {
      const suivant = b.order[(i + 1) % b.order.length];
      if (kind(b.order[i]) === 'hero' && kind(suivant) !== 'hero') { const r = window.__wfrp.turn(b.order[i]); if (typeof r === 'string' && r.startsWith('\\u2713')) return b.order[i]; }
    }
    return null;
  })()`);
  if (!heros) throw new Error('aucun héros avant un adversaire');
  await sleep(900);
  await resoudreModales(session, 'tour de héros');
  await freezeTimeout(session, [3600000]);
  await passe('A-heros', VUES);
  // Pause de Round (mise en place __wfrp, comme la sonde) : le bandeau de phase sur le parapet.
  await evaluate(session, `window.__wfrp.store.setState({ pendingRoundStart: { round: 2, readyBySeat: {} } })`);
  await sleep(400);
  await passe('P-pause', VUES);
  await evaluate(session, `window.__wfrp.store.setState({ pendingRoundStart: null })`);
  await sleep(300);
  // Journal ouvert : clic réel sur sa poignée.
  await setViewport(session, 1707, 780); await sleep(300);
  await cliquerSelecteur(session, '.log-drawer .ld-btn');
  await sleep(400);
  await passe('J-journal', VUES);
  await setViewport(session, 1707, 780); await sleep(300);
  await cliquerSelecteur(session, '.log-drawer .ld-btn');
  await sleep(400);
  // Tactile émulé, tour de héros.
  await session.rpc('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await session.rpc('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
  await sleep(300);
  await passe('T-doigt-heros', VUES_DOIGT);
  await session.rpc('Emulation.setEmitTouchEventsForMouse', { enabled: false });
  await session.rpc('Emulation.setTouchEmulationEnabled', { enabled: false });
  await sleep(300);
  // État C : « Fin du tour » cliqué deux fois (armer, confirmer), minuteries figées.
  await setViewport(session, 1707, 780); await sleep(300);
  await cliquerAction(session, 'end-turn');
  await sleep(300);
  await cliquerAction(session, 'end-turn');
  await sleep(700);
  const spect = await evaluate(session, `!!document.querySelector(".combat-console[data-forme='spectatrice']")`);
  if (!spect) throw new Error('forme spectatrice non atteinte');
  await passe('C-adverse', VUES);
  await session.rpc('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await sleep(300);
  await passe('T-doigt-adverse', VUES_DOIGT);
  await session.rpc('Emulation.setTouchEmulationEnabled', { enabled: false });
  await unfreezeTimeout(session);
  out.console = guard.errors();
} finally {
  writeFileSync(join(DIR, 'geo.json'), JSON.stringify(out, null, 1));
  writeFileSync(join(DIR, 'captures.txt'), shas.join('\n') + '\n');
  await session.close();
}

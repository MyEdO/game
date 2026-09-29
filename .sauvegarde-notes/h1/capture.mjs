// Recette H1 #1919 : captures + mesures du HUD, 5 vues x états, joueur réel pour les gestes testés.
// Usage : node capture.mjs <etiquette avant|apres>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const LIB = '/home/user/game/.wt-1919-H1/scripts/recette/lib.mjs';
const { openApp, evaluate, setViewport, sleep, shot, consoleGuard, resoudreModales, attendreSelecteur, cliquerSelecteur, clickButtonByText, clicReel } = await import(LIB);

const etiquette = process.argv[2] || 'x';
const DIR = join('/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/h1', etiquette);
mkdirSync(DIR, { recursive: true });
const VUES = [[360, 740], [700, 780], [900, 780], [1366, 650], [1707, 780]];

const MESURE = `(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.x*10)/10, Math.round(b.y*10)/10, Math.round(b.width*10)/10, Math.round(b.height*10)/10]; };
  const q = (s) => document.querySelector(s);
  const pont = q('.stage > .combat-console') || q('.stage > .exploration-dock');
  const surfaces = {
    topbar: r(q('.hud-topbar')), groupe: r(q('.party-dock')), frise: r(q('.initiative-strip')),
    fil: r(q('.combat-feed')), ouverture: r(q(".cc-phase[data-phase='ouverture']")), rail: r(q('.hud-rail')),
    journal: r(q('.ld-panel')), objectif: r(q('.objective-banner')), pont: r(pont), flot: r(q('.stage-flot')),
    phasePont: r(q(".combat-console .cc-phase")),
  };
  const zones = [...document.querySelectorAll('[data-zone]')].map((z) => ({ zone: z.dataset.zone, r: r(z) }));
  const flot = q('.stage-flot');
  const cs = flot ? getComputedStyle(flot) : null;
  // commandes atteignables : chaque bouton visible du HUD et du pont reçoit son propre clic
  const boutons = [...document.querySelectorAll('.stage-flot button, .stage > .party-dock button, .stage > .combat-console button, .stage > .exploration-dock button')]
    .filter((b) => { const x = b.getBoundingClientRect(); return x.width > 0 && x.height > 0 && getComputedStyle(b).visibility !== 'hidden'; });
  const inatteignables = boutons.filter((b) => {
    const x = b.getBoundingClientRect(); const cx = x.x + x.width / 2, cy = x.y + x.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return true;
    const h = document.elementFromPoint(cx, cy); return !(h && (h === b || b.contains(h)));
  }).map((b) => (b.getAttribute('title') || b.textContent || b.className).trim().slice(0, 40));
  return {
    vue: [innerWidth, innerHeight], surfaces, zones,
    rows: cs ? cs.gridTemplateRows : null, cols: cs ? cs.gridTemplateColumns : null,
    pontBasAuBord: pont ? Math.round(pont.getBoundingClientRect().bottom - innerHeight) : null,
    debordPage: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth,
    boutons: boutons.length, inatteignables,
  };
})()`;

const session = await openApp();
const guard = consoleGuard(session);
const mesures = {};
async function capturer(etat) {
  for (const [w, h] of VUES) {
    await setViewport(session, w, h);
    await sleep(700);
    const m = await evaluate(session, MESURE);
    mesures[`${etat}-${w}x${h}`] = m;
    await shot(session, `${etat}-${w}x${h}`, DIR);
  }
}
try {
  await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(session, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(500);
  await resoudreModales(session, 'intro');
  await evaluate(session, `window.__wfrp.store.setState({ objectives: [{ id: 'recette-hud', text: 'Retrouver la piste des mutants dans les collines' }] })`);
  await sleep(500);
  await capturer('exploration');

  // clic dans une zone vide, exploration : la cible est le monde
  await setViewport(session, 1366, 650);
  await sleep(500);
  const vide = await evaluate(session, `(() => { const x = innerWidth * 0.62, y = innerHeight * 0.45; const h = document.elementFromPoint(x, y); window.__cible = null; window.addEventListener('pointerdown', (e) => { window.__cible = e.target.tagName + '.' + (e.target.className && e.target.className.baseVal !== undefined ? e.target.className.baseVal : e.target.className); }, { once: true, capture: true }); return { x, y, tag: h && h.tagName, cls: h && String(h.className && (h.className.baseVal ?? h.className)).slice(0, 60) }; })()`);
  await clicReel(session, vide.x, vide.y);
  await sleep(300);
  mesures['clic-vide-exploration'] = { ...vide, recu: await evaluate(session, 'window.__cible') };

  // volet du groupe à 360 (R-M1 : tuile ≥ 44px, chiffre de Blessures lisible), ouvert au clic réel
  await setViewport(session, 360, 740);
  await sleep(500);
  await cliquerSelecteur(session, '.party-dock .pd-handle');
  await sleep(400);
  mesures['volet-360'] = await evaluate(session, `[...document.querySelectorAll('.party-dock.on .pd-track .ptile')].map((t) => { const r = t.getBoundingClientRect(); const c = t.querySelector('[data-overlay] > span'); const cr = c ? c.getBoundingClientRect() : null; const cs = c ? getComputedStyle(c) : null; const top = c && cr.width ? document.elementFromPoint(cr.x + cr.width / 2, cr.y + cr.height / 2) : null; return { tuile: [Math.round(r.width), Math.round(r.height)], chiffre: c ? c.textContent : null, police: cs ? cs.fontSize : null, visible: !!(cr && cr.width > 0 && top && (top === c || c.contains(top) || t.contains(top))) }; })`);
  await shot(session, 'exploration-volet-360x740', DIR);
  await cliquerSelecteur(session, '.party-dock .pd-handle');
  await sleep(300);

  // journal d'exploration, ouvert au clic réel
  await cliquerSelecteur(session, '.exploration-dock .ld-btn');
  await sleep(400);
  await capturer('exploration-journal');
  await cliquerSelecteur(session, '.exploration-dock .ld-btn');
  await sleep(300);

  // combat : ouverture (pause du Round 1)
  await setViewport(session, 1707, 780);
  await evaluate(session, `window.__wfrp.fight('enc-mutants')`);
  await sleep(1500);
  await resoudreModales(session, 'ouverture de combat', { labels: ['Tout lancer', 'Lancer', 'Continuer', 'Appliquer', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer'] });
  await sleep(500);
  await capturer('combat-ouverture');
  // le joueur COMMENCE le combat par le vrai bouton
  await clickButtonByText(session, 'Commencer le combat');
  await sleep(1200);
  await resoudreModales(session, 'ouverture de Round');
  // tour d'un héros (setup)
  const heros = await evaluate(session, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order.find((x) => (b.combatants.find((c) => c.id === x) || {}).kind === 'hero'); return window.__wfrp.turn(id); })()`);
  await sleep(1200);
  await resoudreModales(session, 'tour héros');
  mesures.tourHeros = heros;
  await capturer('combat-heros');
  // clic vide combat
  await setViewport(session, 1366, 650);
  await sleep(500);
  const vide2 = await evaluate(session, `(() => { const x = innerWidth * 0.62, y = innerHeight * 0.40; const h = document.elementFromPoint(x, y); window.__cible = null; window.addEventListener('pointerdown', (e) => { window.__cible = e.target.tagName + '.' + String(e.target.className && (e.target.className.baseVal ?? e.target.className)); }, { once: true, capture: true }); return { x, y, tag: h && h.tagName, cls: h && String(h.className && (h.className.baseVal ?? h.className)).slice(0, 60) }; })()`);
  await clicReel(session, vide2.x, vide2.y);
  await sleep(300);
  mesures['clic-vide-combat'] = { ...vide2, recu: await evaluate(session, 'window.__cible') };
  // journal de combat, ouvert au clic réel
  await cliquerSelecteur(session, '.hud-rail .ld-btn');
  await sleep(400);
  await capturer('combat-journal');
  await cliquerSelecteur(session, '.hud-rail .ld-btn');
  await sleep(300);
  // tour adverse (setup)
  const adv = await evaluate(session, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order.find((x) => (b.combatants.find((c) => c.id === x) || {}).kind !== 'hero'); return window.__wfrp.turn(id); })()`);
  mesures.tourAdverse = adv;
  await sleep(300);
  await capturer('combat-adverse');
} finally {
  mesures.console = guard.entries;
  writeFileSync(join(DIR, 'mesures.json'), JSON.stringify(mesures, null, 1));
  guard.stop();
  await session.close();
}
console.log('erreurs console :', guard.errors().length);

// Recette C1 (#1806, #1856) : géométrie de la console, états A (tour de héros), B (refus survol/focus),
// C (tour adverse). Usage : node recette.mjs <etiquette> [--geo-seul]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const LIB = '/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs';
const { openApp, evaluate, setViewport, sleep, shot, consoleGuard, resoudreModales, attendreSelecteur, clickButtonByText, survoler, infobulleDe, realKey } = await import(LIB);
const etiquette = process.argv[2] || 'x';
const geoSeul = process.argv.includes('--geo-seul');
const DIR = join('/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/c1', etiquette);
mkdirSync(DIR, { recursive: true });
const VUES = [[1707, 780], [1366, 650], [901, 780], [900, 780], [701, 780], [700, 780], [640, 780], [360, 740]];
process.env.WFRP_DEV_URL ||= 'http://localhost:5236/';

const GEO = `(() => {
  const R = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), b: +b.bottom.toFixed(1), r: +b.right.toFixed(1) }; };
  const q = (s) => document.querySelector(s);
  const cc = q('.stage > .combat-console'); const dock = q('.cc-dock');
  const H = innerHeight, W = innerWidth;
  const cell = q('.cc-grid-right .cc-cell'); const ico = q('.cc-grid-right .cc-cell:not(.cc-empty) .cc-ico');
  const portrait = q('.cc-arch .ptile');
  const regions = [...(dock ? dock.children : [])].map((e) => ({ q: String(e.className).split(' ').slice(0, 2).join(' '), ...R(e), deborde: e.scrollHeight - e.clientHeight, debordeX: e.scrollWidth - e.clientWidth }));
  const tops = [...new Set(regions.map((r) => Math.round(r.y)))];
  const cells = [...document.querySelectorAll('.combat-console .cc-cell, .combat-console .cc-set')];
  const horsEcran = cells.filter((c) => { const b = c.getBoundingClientRect(); return b.width > 0 && (b.x < -0.5 || b.y < -0.5 || b.right > W + 0.5 || b.bottom > H + 0.5); }).map((c) => c.getAttribute('aria-label') || c.className);
  const debordes = [...document.querySelectorAll('.combat-console .cc-cell, .combat-console .cc-arch, .combat-console .cc-arch-body, .combat-console .cc-bay, .combat-console .cc-end, .combat-console .cc-gutter')].filter((e) => e.scrollHeight - e.clientHeight > 1 || e.scrollWidth - e.clientWidth > 1).map((e) => String(e.className).split(' ').slice(0, 3).join('.') + ' ' + (e.scrollWidth - e.clientWidth) + 'x' + (e.scrollHeight - e.clientHeight) + ' ' + (e.getAttribute('aria-label') || ''));
  const endKey = q('.cc-end .cc-key'); const x = q('.cc-bay-head .cc-key');
  const arch = q('.cc-arch');
  const cs = getComputedStyle(document.documentElement);
  return {
    vue: [W, H], forme: cc && cc.dataset.forme,
    total: cc ? +cc.getBoundingClientRect().height.toFixed(1) : null, bande: dock ? +dock.getBoundingClientRect().height.toFixed(1) : null,
    totalPct: cc ? +(100 * cc.getBoundingClientRect().height / H).toFixed(1) : null, bandePct: dock ? +(100 * dock.getBoundingClientRect().height / H).toFixed(1) : null,
    case: cell ? R(cell) : null, icone: ico ? R(ico) : null, portrait: portrait ? R(portrait) : null, arche: R(arch),
    archeCentre: arch ? +((arch.getBoundingClientRect().x + arch.getBoundingClientRect().width / 2) - W / 2).toFixed(1) : null,
    rangees: tops.length, regions, horsEcran, debordes,
    lbl: document.querySelectorAll('.cc-lbl').length, setN: document.querySelectorAll('.cc-set-n').length,
    sets: [...document.querySelectorAll('.cc-set')].map((s) => (s.classList.contains('cc-empty') ? 'vide' : s.classList.contains('on') ? 'tenu' : 'set') + (s.querySelector('.cc-key') ? '+touche' : '')),
    grille: [...document.querySelectorAll('.cc-grid-right .cc-cell')].map((c) => c.classList.contains('cc-empty') ? '·' : (c.getAttribute('aria-label') || '').slice(0, 12)),
    toucheX: x ? { texte: x.textContent, ...R(x), tete: R(x.parentElement) } : null,
    fin: endKey ? { touche: endKey.textContent, arme: q('.cc-end').hasAttribute('data-armed'), nom: (q('.cc-end > b') || {}).textContent, etat: (q('#cc-etat-du-tour') || {}).textContent || null } : null,
    flot: R(q('.stage-flot')), frise: R(q('.initiative-strip')), fil: R(q('.combat-feed')), rail: R(q('.hud-rail')), groupe: R(q('.party-dock')),
    vars: ['--cc-cell', '--cc-portrait', '--cc-deck-h'].map((v) => v + '=' + cs.getPropertyValue(v).trim().slice(0, 30)),
  };
})()`;

const session = await openApp();
const guard = consoleGuard(session);
const out = { geo: {}, refus: {}, adverse: {} };
const log = (...a) => console.log(...a);
async function passe(nom, fn) {
  for (const [w, h] of VUES) {
    await setViewport(session, w, h);
    await sleep(700);
    await fn(`${nom}-${w}x${h}`, w, h);
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
  // ÉTAT A (setup par __wfrp) : tour d'un héros, 2 sets posés sur 3 vignettes, rang 2 de la grille vidé.
  out.setupA = await evaluate(session, `(() => {
    const st = window.__wfrp.store.getState(); const b = st.battle;
    const id = b.order.find((x) => (b.combatants.find((c) => c.id === x) || {}).kind === 'hero');
    const r = window.__wfrp.turn(id);
    const b2 = window.__wfrp.store.getState().battle;
    const h = b2.combatants.find((c) => c.id === id);
    const armes = (h.items || []).filter((it) => it.trappingId && (it.type === 'weapon' || it.weapon || /arme|epee|dague|arc|pistolet|arbalete|hache|lance|masse/.test(it.trappingId)));
    const sets = (h.loadouts || []).length;
    const combatants = b2.combatants.map((c) => c.id !== id ? c : { ...c, barre: { ...(c.barre || {}), capacites: { ...((c.barre || {}).capacites || {}), 1: null } } });
    window.__wfrp.store.setState({ battle: { ...b2, combatants } });
    return { tour: r, heros: h.label, sets, loadouts: (h.loadouts || []).map((l) => l.id), items: (h.items || []).map((i) => i.trappingId).slice(0, 12) };
  })()`);
  await sleep(1000);
  await resoudreModales(session, 'tour héros');
  log('setup A', JSON.stringify(out.setupA));
  await passe('A', async (k) => {
    const g = await evaluate(session, GEO);
    out.geo[k] = g;
    log(k, `bande ${g.bande}px ${g.bandePct}% · total ${g.total}px ${g.totalPct}% · case ${g.case && g.case.w}x${g.case && g.case.h} · icône ${g.icone && g.icone.w} · portrait ${g.portrait && g.portrait.w} · rangées ${g.rangees} · arche Δcentre ${g.archeCentre} · hors écran ${g.horsEcran.length} · débords ${g.debordes.length} ${g.debordes.slice(0, 4).join(' | ')}`);
    if (!geoSeul) await shot(session, k, DIR);
  });
  if (!geoSeul) {
    // ÉTAT B : refus au SURVOL (souris réelle) puis au FOCUS (Tab réel).
    await passe('B', async (k) => {
      const cible = await evaluate(session, `(() => { const c = document.querySelector('.combat-console button.cc-cell[data-gated]'); if (!c) return null; c.setAttribute('data-recette-cible', ''); return c.getAttribute('aria-label'); })()`);
      if (!cible) { out.refus[k] = { cible: null }; log(k, 'aucune case refusée'); return; }
      await survoler(session, '[data-recette-cible]', { attenteMs: 600 });
      const survol = await infobulleDe(session, '[data-recette-cible]');
      await shot(session, `${k}-survol`, DIR);
      await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5, buttons: 0 });
      await sleep(300);
      // FOCUS : en combat, Tab est lié à `target-next` (src/state/keybindings.ts:333) — le focus DOM
      // d'une case est le chemin de la MANETTE (useGamepad), rejoué ici par el.focus().
      await evaluate(session, `document.querySelector('[data-recette-cible]').focus()`);
      await sleep(500);
      const focus = await infobulleDe(session, '[data-recette-cible]');
      focus.actif = await evaluate(session, `document.activeElement === document.querySelector('[data-recette-cible]')`);
      await shot(session, `${k}-focus`, DIR);
      await evaluate(session, `(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); const c = document.querySelector('[data-recette-cible]'); c && c.removeAttribute('data-recette-cible'); })()`);
      await sleep(200);
      out.refus[k] = { cible, survol, focus };
      log(k, 'refus', cible, '· survol', JSON.stringify(survol && { t: survol.texte && survol.texte.slice(0, 70), bulle: survol.bulle, cible: survol.cible }), '· focus', JSON.stringify(focus && { t: focus.texte && focus.texte.slice(0, 70), actif: focus.actif, bulle: focus.bulle }));
    });
    // ÉTAT C : tour adverse (setup par __wfrp).
    out.tourAdverse = await evaluate(session, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order.find((x) => (b.combatants.find((c) => c.id === x) || {}).kind !== 'hero'); return window.__wfrp.turn(id); })()`);
    await sleep(400);
    await passe('C', async (k) => {
      const g = await evaluate(session, GEO);
      const clic = await evaluate(session, `(() => { const a = document.querySelector('.cc-arch'); const d = document.querySelector('.cc-dock'); if (!a || !d) return null; const ra = a.getBoundingClientRect(), rd = d.getBoundingClientRect(); const x = Math.max(4, ra.x - 40), y = rd.y + rd.height / 2; const h = document.elementFromPoint(x, y); return { x: Math.round(x), y: Math.round(y), recu: h ? h.tagName + '.' + String(h.className && (h.className.baseVal ?? h.className)).slice(0, 40) : null }; })()`);
      out.adverse[k] = { ...g, clicAcote: clic };
      log(k, `forme ${g.forme} · bande ${g.bande}px ${g.bandePct}% · total ${g.total}px ${g.totalPct}% · portrait ${g.portrait && g.portrait.w} · clic à côté de l'arche → ${clic && clic.recu}`);
      await shot(session, k, DIR);
    });
  }
} finally {
  out.console = guard.entries;
  writeFileSync(join(DIR, 'mesures.json'), JSON.stringify(out, null, 1));
  guard.stop();
  await session.close();
}
console.log('erreurs console :', guard.errors().length, JSON.stringify(guard.errors().map((e) => String(e.text || e).slice(0, 160))));

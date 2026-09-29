// Sonde du juge d'écran C1b (lecture seule) : infobulle d'une case DISPONIBLE au survol réel,
// et nom long dans l'arche SPECTATRICE (renommage = mise en place __wfrp).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const LIB = '/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs';
const { openApp, evaluate, setViewport, sleep, shot, consoleGuard, resoudreModales, attendreSelecteur, clickButtonByText, cliquerAction, freezeTimeout, unfreezeTimeout, survoler } = await import(LIB);
const DIR = '/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/juge-vision-c1b';
const NOMS = JSON.parse(process.env.NOMS);
process.env.WFRP_DEV_URL ||= 'http://localhost:5236/';
const NOM = `(() => { const n = document.querySelector('.cc-arch-name'); const a = document.querySelector('.cc-arch'); const R = (e) => { const b = e.getBoundingClientRect(); return [+b.x.toFixed(1), +b.y.toFixed(1), +b.width.toFixed(1), +b.height.toFixed(1)]; };
  return { forme: document.querySelector('.combat-console')?.dataset.forme, nom: n && n.textContent, nomR: n && R(n), debord: n && (n.scrollWidth - n.clientWidth), arche: a && R(a), vue: [innerWidth, innerHeight] }; })()`;
const TIP = `(() => { const t = [...document.querySelectorAll('[role=tooltip], .tooltip, .cc-tip, .tip')].filter((e) => e.getBoundingClientRect().width > 0); return t.map((e) => { const b = e.getBoundingClientRect(); return { cls: e.className, txt: e.textContent.slice(0, 200), r: [b.x, b.y, b.width, b.height].map((v) => +v.toFixed(1)) }; }); })()`;
const session = await openApp();
const guard = consoleGuard(session);
const out = {};
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
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 300, buttons: 0 });
  await setViewport(session, 1707, 780); await sleep(300);
  await cliquerAction(session, 'end-turn'); await sleep(300);
  await cliquerAction(session, 'end-turn'); await sleep(700);
  const spect = await evaluate(session, `!!document.querySelector(".combat-console[data-forme='spectatrice']")`);
  if (!spect) throw new Error('forme spectatrice non atteinte');
  // Mise en place : l'adversaire actif reçoit un nom long.
  out.nomLong = [];
  for (const nomv of NOMS) {
  out.renomme = await evaluate(session, `(() => { const b = window.__wfrp.store.getState().battle; const act = b.combatants.find((c) => c.id === 'enemy-enc-mutants-1'); window.__wfrp.store.setState({ battle: { ...b, combatants: b.combatants.map((c) => c === act ? { ...c, label: ${JSON.stringify(nomv)} } : c) } }); return act ? act.id : Object.keys(b.combatants[0]).join(','); })()`);
  await sleep(500);
  
  for (const [w, h] of [[701, 780], [900, 780], [1366, 650]]) {
    await setViewport(session, w, h); await sleep(600);
    out.nomLong.push({nomv, ...(await evaluate(session, NOM))});
    await shot(session, `N2-${NOMS.indexOf(nomv)}-${w}x${h}`, DIR, { neutraliser: false });
  }
  }
  await unfreezeTimeout(session);
  out.console = guard.errors();
} finally {
  writeFileSync(join(DIR, 'sonde2.json'), JSON.stringify(out, null, 1));
  await session.close();
}

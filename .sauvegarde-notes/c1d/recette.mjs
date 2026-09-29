// Recette JOUEUR du lot C1d : clics et clavier réels ; `__wfrp` pour la MISE EN PLACE seule
// (scénario, combat, trait au héros, noms au pire, pause de Round).
import { readFileSync, writeFileSync } from 'node:fs';
const L = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
const H = await import('/home/user/game/.wt-1919-H2/scripts/recette/hud-clickables.mjs');
const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur, clickButtonByText, cliquerSelecteur, cliquerAction, realKey, shot, consoleGuard, freezeTimeout, unfreezeTimeout } = L;
const DIR = '/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/c1d/captures';
const SOURIS = [[360, 740], [560, 650], [640, 780], [700, 780], [701, 780], [900, 780], [1366, 650], [1707, 780]];
const DOIGT = [[768, 1024], [1366, 650]];
const journalDeBord = [];
const note = (s) => { console.log(s); journalDeBord.push(s); };
const s = await openApp();
const cg = consoleGuard(s);
const touch = (on) => s.rpc('Emulation.setTouchEmulationEnabled', on ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
const ETAT = `(() => { const r = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  return { forme: document.querySelector('.combat-console')?.dataset.forme ?? null, arche: r('.cc-arch'), bande: r('.cc-dock'), frise: r('.initiative-strip'), groupe: r("[data-zone='groupe'] > .party-dock"), journal: r('.ld-panel'), fin: r('.cc-end'), nom: document.querySelector('.cc-arch-name')?.textContent ?? null, pageDefile: document.scrollingElement.scrollHeight > innerHeight }; })()`;
async function passe(etat, vues) {
  for (const [w, h] of vues) {
    await setViewport(s, w, h); await sleep(700);
    const e = await evaluate(s, ETAT);
    const f = await shot(s, `${etat}-${w}x${h}`, DIR);
    note(`${etat} ${w}×${h} → ${f.split('/').pop()} ${JSON.stringify(e)}`);
  }
}
try {
  await evaluate(s, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(s, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(400); await resoudreModales(s, 'intro');
  await setViewport(s, 1707, 780);
  await evaluate(s, `window.__wfrp.fight('enc-mutants')`); await sleep(1500);
  await resoudreModales(s, 'ouverture');
  // Le joueur lance le Round (clic réel sur le bandeau d'ouverture).
  if (await evaluate(s, `!!document.querySelector(".cc-phase [data-action='round-start']:not(:disabled)")`)) {
    await clickButtonByText(s, 'Commencer'); await sleep(900); await resoudreModales(s, 'round');
  }
  // MISE EN PLACE : le trait au héros qui précède un adversaire, et les noms au pire des données.
  const { creaturesParLongueur, heroCompose } = H.libellesAuPire(
    JSON.parse(readFileSync('/home/user/game/.wt-1919-H2/src/data/creatures.json', 'utf8')),
    JSON.parse(readFileSync('/home/user/game/.wt-1919-H2/src/data/pregens.json', 'utf8')));
  const heros = await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const kind = (id) => (b.combatants.find((c) => c.id === id) || {}).kind;
    for (let i = 0; i < b.order.length; i++) { const suivant = b.order[(i + 1) % b.order.length]; if (kind(b.order[i]) === 'hero' && kind(suivant) !== 'hero') { const r = window.__wfrp.turn(b.order[i]); if (typeof r === 'string' && r.startsWith('\\u2713')) return b.order[i]; } } return null; })()`);
  note(`mise en place : trait à ${heros}`);
  await sleep(900); await resoudreModales(s, 'tour');
  await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const longs = ${JSON.stringify(creaturesParLongueur)}; const actif = b.order[b.turn]; let k = 1; let compose = ${JSON.stringify(heroCompose)};
    window.__wfrp.store.setState({ battle: { ...b, combatants: b.combatants.map((c) => { if (c.id === actif) return { ...c, label: longs[0] }; if (c.kind !== 'hero') return { ...c, label: longs[k++ % longs.length] }; if (compose) { const l = compose; compose = null; return { ...c, label: l }; } return c; }) } }); })()`);
  await sleep(500);
  note(`noms au pire : actif « ${creaturesParLongueur[0]} », adversaires « ${creaturesParLongueur.slice(1, 3).join(' », « ')} »…, héros composé « ${heroCompose} »`);
  // 1. Tour du héros.
  await passe('heros-souris', SOURIS);
  await touch(true); await passe('heros-doigt', DOIGT); await touch(false);
  // 2. Journal ouvert : CLIC RÉEL sur sa poignée, puis refermé par clic réel.
  await setViewport(s, 1707, 780); await sleep(400);
  await cliquerSelecteur(s, '.log-drawer .ld-btn'); await sleep(400);
  await passe('journal-souris', SOURIS);
  await touch(true); await passe('journal-doigt', DOIGT); await touch(false);
  await setViewport(s, 1707, 780); await sleep(400);
  await cliquerSelecteur(s, '.log-drawer .ld-btn'); await sleep(400);
  note(`journal refermé au clic : ${await evaluate(s, `!document.querySelector('.ld-panel')`)}`);
  // 3. Pause de Round (mise en place), levée aussitôt après.
  await evaluate(s, `window.__wfrp.store.setState({ pendingRoundStart: { round: 2, readyBySeat: {} } })`); await sleep(500);
  await passe('pause-souris', SOURIS);
  await touch(true); await passe('pause-doigt', DOIGT); await touch(false);
  await evaluate(s, `window.__wfrp.store.setState({ pendingRoundStart: null })`); await sleep(500);
  // 4. Tour adverse : « Fin du tour » au CLAVIER (Espace, `end-turn`) pour armer, puis CLIC RÉEL pour confirmer.
  await setViewport(s, 1707, 780); await sleep(500);
  await evaluate(s, `(() => { const a = document.activeElement; if (a && a.blur) a.blur(); })()`);
  await realKey(s, { key: ' ', code: 'Space' }); await sleep(300);
  note(`après Espace : forme ${await evaluate(s, `document.querySelector('.combat-console')?.dataset.forme`)}, coin « ${await evaluate(s, `document.querySelector('.cc-end')?.textContent.trim()`)} »`);
  await freezeTimeout(s, [3600000]);
  try {
    if (await evaluate(s, `document.querySelector('.combat-console')?.dataset.forme !== 'spectatrice'`)) {
      await cliquerAction(s, 'end-turn'); await sleep(700);
    }
    note(`après clic « Fin du tour » : forme ${await evaluate(s, `document.querySelector('.combat-console')?.dataset.forme`)}`);
    await passe('adverse-souris', SOURIS);
    await touch(true); await passe('adverse-doigt', DOIGT); await touch(false);
  } finally { await unfreezeTimeout(s); }
  const erreurs = cg.errors();
  const horsConnu = erreurs.filter((e) => !/items\.ts:708/.test(e.text));
  note(`console : ${erreurs.length} erreur(s), dont ${horsConnu.length} hors items.ts:708`);
  for (const e of erreurs) note(`  [${e.type}] ${e.text.slice(0, 300)}`);
} finally {
  writeFileSync(DIR + '/recette.log', journalDeBord.join('\n') + '\n');
  cg.stop(); await s.close();
}

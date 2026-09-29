// Sonde de mise au point : combat au tour d'un héros, puis `EXPR` évaluée à chaque vue × pointeur.
// Usage : node dbg.mjs '<vues w×h,...>' '<souris|doigt|les2>' '<etat: hero|pause|journal|adverse>' '<fichier expr.js>'
import { readFileSync } from 'node:fs';
const L = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur, clickButtonByText, cliquerSelecteur } = L;
const [vuesArg, ptrArg, etat, exprFile] = process.argv.slice(2);
const vues = vuesArg.split(',').map((v) => v.split('x').map(Number));
const ptrs = ptrArg === 'les2' ? ['souris', 'doigt'] : [ptrArg];
const expr = readFileSync(exprFile, 'utf8');
const s = await openApp();
try {
  await evaluate(s, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(s, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(400); await resoudreModales(s, 'intro');
  await setViewport(s, 1707, 780);
  await evaluate(s, `window.__wfrp.fight('enc-mutants')`); await sleep(1500);
  await resoudreModales(s, 'o'); await sleep(500);
  for (let i = 0; i < 8; i++) {
    if (await evaluate(s, `document.querySelectorAll('.combat-console button.cc-cell').length`) > 0) break;
    if (await evaluate(s, `!!document.querySelector(".cc-phase [data-action='round-start']:not(:disabled)")`)) {
      await clickButtonByText(s, 'Commencer'); await sleep(900); await resoudreModales(s, 'r'); continue;
    }
    await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order.find((x) => (b.combatants.find((c) => c.id === x) || {}).kind === 'hero'); return window.__wfrp.turn(id); })()`);
    await sleep(900); await resoudreModales(s, 'tour');
  }
  if (etat === 'pause') { await evaluate(s, `window.__wfrp.store.setState({ pendingRoundStart: { round: 2, readyBySeat: {} } })`); await sleep(400); }
  if (etat === 'journal') { await cliquerSelecteur(s, '.log-drawer .ld-btn'); await sleep(400); }
  if (etat === 'long') {
    await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const a = b.order[b.turn]; window.__wfrp.store.setState({ battle: { ...b, combatants: b.combatants.map((c) => c.id === a ? { ...c, label: 'Gargouille de la Porte-du-Midi des Collines Stériles' } : c) } }); })()`);
    await sleep(300);
  }
  for (const p of ptrs) {
    await s.rpc('Emulation.setTouchEmulationEnabled', p === 'doigt' ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    for (const [w, h] of vues) {
      await setViewport(s, w, h); await sleep(700);
      console.log(p, `${w}x${h}`, JSON.stringify(await evaluate(s, expr)));
    }
  }
} finally { await s.close(); }

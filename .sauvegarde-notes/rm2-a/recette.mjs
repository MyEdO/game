// Recette R-M2 lot A : combat, focus sur une case, ↓, Entrée, Échap ; puis même cycle entré à la souris.
import { openApp, evaluate, realKey, survoler, clicReel, consoleGuard, sleep, waitFor, resoudreModales } from '/home/user/game/scripts/recette/lib.mjs';

const URL = 'http://localhost:5173/';
const passe = process.argv[2] ?? '1';
const log = (...a) => console.log(`[passe ${passe}]`, ...a);
const ACTIF = `(() => { const a = document.activeElement; if (!a || a === document.body) return 'body';
  const dansBoite = !!a.closest('[role="tooltip"]'); const dansDialogue = !!a.closest('[role="dialog"]');
  return a.tagName + ' «' + (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 30) + '»' + (a.dataset.cell ? ' [data-cell=' + a.dataset.cell + ']' : '') + (dansBoite ? ' dansBoite' : '') + (dansDialogue ? ' dansDialogue' : ''); })()`;
const ETAT = `(() => ({ boites: document.querySelectorAll('.infobulle[role="tooltip"]').length,
  fiche: !!document.querySelector('.codex-modal'), codex: window.__wfrp.store.getState().codexOverlay?.id ?? null,
  bulle: (document.querySelector('.infobulle[role="tooltip"] .codex-pop-title')?.textContent ?? null) }))()`;

const session = await openApp(URL, { timeoutMs: 90000 });
const cg = consoleGuard(session);
try {
  // SETUP (`__wfrp`) : le terrain d'entraînement et sa rencontre ; le Round 1 s'ouvre au clavier (Entrée).
  await evaluate(session, `window.__wfrp.scenario('entrainement', 7)`);
  await evaluate(session, `window.__wfrp.ready(20000)`, { timeoutMs: 25000 });
  await resoudreModales(session, 'intro').catch((e) => log('resoudreModales', e.message));
  await evaluate(session, `window.__wfrp.fight('enc-entrainement')`);
  await sleep(2500);
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await waitFor(session, `!!document.querySelector('.combat-console .codex-ref [data-cell]')`, { timeoutMs: 20000 });
  // SETUP : la case candidate = la 1re case de la console dont l'infobulle porte une porte vers la fiche.
  const cases = await evaluate(session, `[...document.querySelectorAll('.combat-console .codex-ref[aria-keyshortcuts="ArrowDown"] [data-cell]')].map((b) => b.dataset.cell)`);
  log('cases à porte :', JSON.stringify(cases));
  const cell = cases.includes('defend') ? 'defend' : cases[0];
  log('case retenue :', cell);
  const SEL = `.combat-console [data-cell="${cell}"]`;
  const surCase = `document.activeElement === document.querySelector('${SEL}')`;

  for (let cycle = 1; cycle <= 3; cycle++) {
    await evaluate(session, `document.querySelector('${SEL}').focus()`);
    log(`[cyc ${cycle}] focus posé (setup) → ${await evaluate(session, ACTIF)} ; ${JSON.stringify(await evaluate(session, ETAT))}`);
    await realKey(session, { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    await sleep(250);
    log(`[cyc ${cycle}] ↓ → ${await evaluate(session, ACTIF)} ; ${JSON.stringify(await evaluate(session, ETAT))}`);
    await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await waitFor(session, `!!document.querySelector('.codex-modal')`, { timeoutMs: 10000 }).catch(() => {});
    await sleep(300);
    log(`[cyc ${cycle}] Entrée → ${await evaluate(session, ACTIF)} ; ${JSON.stringify(await evaluate(session, ETAT))}`);
    await realKey(session, { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(400);
    log(`[cyc ${cycle}] Échap → ${await evaluate(session, ACTIF)} ; ${JSON.stringify(await evaluate(session, ETAT))} ; sur la case = ${await evaluate(session, surCase)}`);
  }
  // SOURIS : survol réel de la case, clic réel sur « Ouvrir la fiche ».
  for (let cycle = 4; cycle <= 5; cycle++) {
    await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2, buttons: 0 });
    await sleep(300);
    // Cycle 5 : le focus part de body (SETUP), l'entrée est la souris seule.
    if (cycle === 5) await evaluate(session, `document.activeElement && document.activeElement.blur()`);
    log(`[cyc ${cycle}] avant survol → ${await evaluate(session, ACTIF)}`);
    await survoler(session, SEL, { attenteMs: 400 });
    log(`[cyc ${cycle}] survol → ${await evaluate(session, ACTIF)} ; ${JSON.stringify(await evaluate(session, ETAT))}`);
    const porte = await evaluate(session, `(() => { const b = document.querySelector('.infobulle[role="tooltip"] button'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    if (!porte) { log(`[cyc ${cycle}] aucune porte`); continue; }
    // Trajet réel du pointeur jusqu'à la porte (pont de survol), puis clic.
    await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: porte.x, y: porte.y, buttons: 0 });
    await sleep(60);
    await clicReel(session, porte.x, porte.y);
    await waitFor(session, `!!document.querySelector('.codex-modal')`, { timeoutMs: 10000 }).catch(() => {});
    await sleep(400);
    log(`[cyc ${cycle}] clic porte (pointeur laissé en ${porte.x},${porte.y}) → ${await evaluate(session, ACTIF)} ; ${JSON.stringify(await evaluate(session, ETAT))}`);
    if (cycle === 5) {
      await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1, buttons: 0 });
      await sleep(300);
      log(`[cyc ${cycle}] pointeur hors zone → ${JSON.stringify(await evaluate(session, ETAT))}`);
    }
    await realKey(session, { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(400);
    log(`[cyc ${cycle}] Échap → ${await evaluate(session, ACTIF)} ; ${JSON.stringify(await evaluate(session, ETAT))} ; sur la case = ${await evaluate(session, surCase)}`);
  }
  log('console : erreurs =', cg.errors().length, JSON.stringify(cg.errors().slice(0, 5)));
} finally {
  cg.stop();
  await session.close();
}

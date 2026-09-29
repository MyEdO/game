// F13 (pointeur laissé dans l'aire de la boîte, puis cycle clavier) et Q4i (placement des panneaux ancrés de la console).
import { openApp, evaluate, realKey, survoler, clicReel, consoleGuard, sleep, waitFor, resoudreModales } from '/home/user/game/scripts/recette/lib.mjs';
const session = await openApp('http://localhost:5173/', { timeoutMs: 90000 });
const cg = consoleGuard(session);
const log = (...a) => console.log(...a);
const ETAT = `(() => ({ boites: document.querySelectorAll('.infobulle[role="tooltip"]').length, fiche: !!document.querySelector('.codex-modal'),
  ancreBulle: document.querySelector('[aria-describedby][data-infobulle]')?.textContent?.trim().slice(0, 30) ?? null,
  bulle: (document.querySelector('.infobulle[role="tooltip"] .codex-pop-title')?.textContent ?? null) }))()`;
try {
  await evaluate(session, `window.__wfrp.scenario('entrainement', 7)`);
  await evaluate(session, `window.__wfrp.ready(20000)`, { timeoutMs: 25000 });
  await resoudreModales(session, 'intro').catch(() => {});
  log('[Q4i setup]', await evaluate(session, `(() => { try { return String(window.__wfrp.giveTrapping('tr-tireur', 'carreau-nain-norse', 6)); } catch (e) { return String(e); } })()`));
  await evaluate(session, `window.__wfrp.fight('enc-entrainement')`);
  await sleep(2500);
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await waitFor(session, `!!document.querySelector('.combat-console .codex-ref [data-cell]')`, { timeoutMs: 20000 });
  const SEL = `.combat-console [data-cell="defend"]`;
  // F13 : clic souris sur la porte, pointeur laissé dans l'aire de la boîte, puis 3 cycles clavier.
  await survoler(session, SEL, { attenteMs: 400 });
  const porte = await evaluate(session, `(() => { const b = document.querySelector('.infobulle[role="tooltip"] button'); const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: porte.x, y: porte.y, buttons: 0 });
  await clicReel(session, porte.x, porte.y);
  await waitFor(session, `!!document.querySelector('.codex-modal')`, { timeoutMs: 10000 }).catch(() => {});
  await sleep(400);
  log('[F13] clic porte →', JSON.stringify(await evaluate(session, ETAT)));
  await realKey(session, { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(400);
  log('[F13] Échap →', JSON.stringify(await evaluate(session, ETAT)), 'pointeur en', JSON.stringify(porte));
  log('[F13] focus après la fiche :', await evaluate(session, `document.activeElement?.dataset?.cell ?? document.activeElement?.tagName`));
  for (let pin = 1; pin <= 3; pin++) {
    await realKey(session, { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    await sleep(250);
    log(`[F13 pin ${pin}] ↓ →`, JSON.stringify(await evaluate(session, ETAT)));
    await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await waitFor(session, `!!document.querySelector('.codex-modal')`, { timeoutMs: 10000 }).catch(() => {});
    await sleep(400);
    log(`[F13 pin ${pin}] Entrée →`, JSON.stringify(await evaluate(session, ETAT)));
    await realKey(session, { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(400);
    log(`[F13 pin ${pin}] Échap →`, JSON.stringify(await evaluate(session, ETAT)));
  }
  // Pointeur hors écran, puis un cycle clavier.
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0, buttons: 0 });
  await sleep(300);
  await realKey(session, { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  await sleep(250);
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(700);
  log('[F13 hors écran] Entrée →', JSON.stringify(await evaluate(session, ETAT)));
  await realKey(session, { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(400);
  // Q4i : le panneau de munition naît du chip de son arme ; ses variables au 1er rendu contre le placement recalculé après mise en page.
  await evaluate(session, `(() => { const o = new MutationObserver(() => { const p = document.querySelector('.pp-panel'); if (p && !window.__q4i) { const r = document.querySelector('[data-cell] ~ *, body') && null; window.__q4i = { premier: ['--ancre-left','--ancre-top','--ancre-bottom','--ancre-h','--ancre-w'].map((v) => p.style.getPropertyValue(v)) }; } }); o.observe(document.body, { childList: true, subtree: true }); window.__q4iObs = o; })()`);
  const chip = await evaluate(session, `(() => { const c = [...document.querySelectorAll('button[data-ammo]')][0]; if (!c) return null; c.setAttribute('data-q4i', ''); const r = c.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
  if (!chip) log('[Q4i] chip de munition absent');
  else {
    await clicReel(session, chip.x, chip.y);
    await sleep(800);
    const mesure = await evaluate(session, `(() => {
      const p = document.querySelector('.pp-panel'); const a = document.querySelector('[data-q4i]');
      if (!p) return { panneau: false };
      const r = a.getBoundingClientRect(); const vw = innerWidth, vh = innerHeight, L = 280, M = 8, E = 6;
      const w = Math.min(L, vw - 2 * M); const left = Math.max(M, Math.min(r.left, vw - w - M));
      const dessous = vh - r.bottom - E - M, dessus = r.top - E - M, cap = Math.floor(vh * 0.6);
      const attendu = dessous >= dessus ? [left + 'px', (r.bottom + E) + 'px', 'auto', Math.max(0, Math.min(dessous, cap)) + 'px', w + 'px'] : [left + 'px', 'auto', (vh - r.top + E) + 'px', Math.max(0, Math.min(dessus, cap)) + 'px', w + 'px'];
      const final = ['--ancre-left','--ancre-top','--ancre-bottom','--ancre-h','--ancre-w'].map((v) => p.style.getPropertyValue(v));
      return { panneau: true, premier: window.__q4i?.premier ?? null, final, attenduApresMiseEnPage: attendu };
    })()`);
    log('[Q4i] munition :', JSON.stringify(mesure));
  }
  await evaluate(session, `window.__q4iObs && window.__q4iObs.disconnect()`);
  log('console : erreurs =', cg.errors().length, JSON.stringify(cg.errors().slice(0, 5)));
} finally { cg.stop(); await session.close(); }

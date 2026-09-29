// Sonde lecture seule : Échap pendant le chargement À FROID du chunk de la fiche (CompendiumScreen retardé par CDP Fetch).
import { openApp, evaluate, realKey, consoleGuard, sleep, waitFor, resoudreModales } from '/home/user/game/scripts/recette/lib.mjs';
const URL = 'http://localhost:5199/';
const RETARD = Number(process.argv[2] ?? 6000);
const log = (...a) => console.log(...a);
const ETAT = `(() => { const s = window.__wfrp.store.getState(); const a = document.activeElement;
  return { codex: s.codexOverlay?.id ?? null, fiche: !!document.querySelector('.codex-modal'), menu: !!s.gameMenuOpen,
    menuDom: !!document.querySelector('.game-menu-overlay'), boites: document.querySelectorAll('.infobulle[role="tooltip"]').length,
    actif: !a || a === document.body ? 'body' : a.tagName + '«' + (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 25) + '»' + (a.dataset.cell ? '[' + a.dataset.cell + ']' : '') }; })()`;
const session = await openApp(URL, { timeoutMs: 90000 });
const cg = consoleGuard(session);
const retenus = [];
const handler = (m) => {
  if (m.sessionId !== session.sessionId || m.method !== 'Fetch.requestPaused') return;
  retenus.push(m.params.request.url);
  setTimeout(() => { session.rpc('Fetch.continueRequest', { requestId: m.params.requestId }).catch(() => {}); }, RETARD);
};
session.listeners.add(handler);
try {
  const deja = await evaluate(session, `performance.getEntriesByType('resource').map(e => e.name).filter(n => /CompendiumScreen/.test(n))`);
  log('CompendiumScreen déjà chargé avant le geste :', JSON.stringify(deja));
  await evaluate(session, `window.__wfrp.scenario('entrainement', 7)`);
  await evaluate(session, `window.__wfrp.ready(20000)`, { timeoutMs: 25000 });
  await resoudreModales(session, 'intro').catch((e) => log('resoudreModales', e.message));
  await evaluate(session, `window.__wfrp.fight('enc-entrainement')`);
  await sleep(2500);
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await waitFor(session, `!!document.querySelector('.combat-console .codex-ref[aria-keyshortcuts="ArrowDown"] [data-cell]')`, { timeoutMs: 20000 });
  const cell = await evaluate(session, `(() => { const c = [...document.querySelectorAll('.combat-console .codex-ref[aria-keyshortcuts="ArrowDown"] [data-cell]')].map(b => b.dataset.cell); return c.includes('defend') ? 'defend' : c[0]; })()`);
  const deja2 = await evaluate(session, `performance.getEntriesByType('resource').map(e => e.name).filter(n => /CompendiumScreen/.test(n))`);
  log('case :', cell, '; CompendiumScreen chargé avant ↓ :', JSON.stringify(deja2));
  await session.rpc('Fetch.enable', { patterns: [{ urlPattern: '*CompendiumScreen*', requestStage: 'Request' }] });
  await evaluate(session, `document.querySelector('.combat-console [data-cell="${cell}"]').focus()`);
  await realKey(session, { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  await sleep(250);
  log('↓      →', JSON.stringify(await evaluate(session, ETAT)));
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(500);
  log('Entrée →', JSON.stringify(await evaluate(session, ETAT)), '; requêtes retenues :', JSON.stringify(retenus));
  await realKey(session, { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(300);
  log('Échap pendant le chargement →', JSON.stringify(await evaluate(session, ETAT)));
  await sleep(RETARD + 2500);
  log('chunk arrivé →', JSON.stringify(await evaluate(session, ETAT)));
  await realKey(session, { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(400);
  log('2e Échap →', JSON.stringify(await evaluate(session, ETAT)));
  log('console : erreurs =', cg.errors().length, JSON.stringify(cg.errors().slice(0, 5)));
} finally {
  session.listeners.delete(handler);
  cg.stop();
  await session.close();
}

import { openApp, consoleGuard, evaluate, realKey, clickButtonByText, survoler, sleep } from '/home/user/game/scripts/recette/lib.mjs';
const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); };

async function main() {
  const session = await openApp();
  const guard = consoleGuard(session);
  try {
    await evaluate(session, "window.__wfrp.scenario('entrainement')");
    await evaluate(session, "window.__wfrp.ready()");
    await evaluate(session, "window.__wfrp.fight('enc-entrainement')");
    await sleep(500);
    await clickButtonByText(session, 'Commencer le combat', { exact: true }).catch(() => {});
    await sleep(400);

    // Activer le throttling reseau (CDP Network) AVANT le geste -- 1500ms de latence.
    await session.rpc('Network.enable');
    await session.rpc('Network.emulateNetworkConditions', {
      offline: false, latency: 1500, downloadThroughput: 200 * 1024, uploadThroughput: 200 * 1024,
    });
    log('Throttling reseau active (latence 1500ms).');

    const cellSel = "button.cc-cell[data-cell]:not([disabled])";
    await survoler(session, cellSel, { attenteMs: 400 });
    log('Boite ouverte au survol ?', await evaluate(session, "!!document.querySelector('.infobulle')"));
    await clickButtonByText(session, 'Ouvrir la fiche', { exact: true, dans: '.infobulle' });
    log('Juste apres clic "Ouvrir la fiche" -> codex-modal ?', await evaluate(session, "!!document.querySelector('.codex-modal')"), '| infobulle encore la ?', await evaluate(session, "!!document.querySelector('.infobulle')"));
    // Echap IMMEDIATEMENT (pendant le chargement du chunk)
    await realKey(session, { key: 'Escape' });
    await sleep(50);
    log('T+50ms apres Echap immediat -> codex-modal ?', await evaluate(session, "!!document.querySelector('.codex-modal')"), '| menu systeme ouvert ?', await evaluate(session, "!!document.querySelector('.system-menu, .pause-menu, [class*=SystemMenu]')"));
    await sleep(500);
    log('T+550ms -> codex-modal ?', await evaluate(session, "!!document.querySelector('.codex-modal')"), '| menu systeme ?', await evaluate(session, "!!document.querySelector('.system-menu, .pause-menu, [class*=SystemMenu]')"));
    await sleep(1500);
    log('T+2050ms (chunk du surement arrive) -> codex-modal ?', await evaluate(session, "!!document.querySelector('.codex-modal')"), '| menu systeme (bouton Reprendre) ?', await evaluate(session, "!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Reprendre')"), '| activeElement:', await evaluate(session, "document.activeElement.tagName+' '+(document.activeElement.textContent||'').slice(0,40)"));
    log('store.codexOverlay :', await evaluate(session, "JSON.stringify(window.__wfrp.store.getState().codexOverlay)"));
    log('store.screen :', await evaluate(session, "window.__wfrp.store.getState().screen"));
    // Fermer le menu systeme pour voir si la fiche apparait DESSOUS une fois le menu ferme
    await realKey(session, { key: 'Escape' });
    await sleep(300);
    log('Apres avoir referme le menu systeme -> codex-modal ?', await evaluate(session, "!!document.querySelector('.codex-modal')"), '| menu Reprendre encore la ?', await evaluate(session, "!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Reprendre')"));
    log('store.codexOverlay APRES fermeture du menu systeme :', await evaluate(session, "JSON.stringify(window.__wfrp.store.getState().codexOverlay)"));
    await sleep(1000);
    log('encore 1s plus tard -> codex-modal ?', await evaluate(session, "!!document.querySelector('.codex-modal')"));

    // Retirer le throttling avant de fermer (propre)
    await session.rpc('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  } finally {
    log('Erreurs console:', guard.errors());
    await session.close();
  }
}
main().then(()=>console.log('---OK---')).catch(e=>{console.error('ECHEC', e && e.stack||e); process.exitCode=1;});

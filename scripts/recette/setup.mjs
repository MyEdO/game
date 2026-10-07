// MISE EN PLACE de recette partagée : « lancer le scénario X, et le combat Y » — le squelette que
// chaque recette réécrivait (#2198, frictions du 2026-10-05). `__wfrp` pose le DÉCOR (scénario,
// rencontre) ; le premier geste de combat (« Commencer le combat ») reste celui du JOUEUR, au vrai
// bouton (`ouvrirRound`). Aucune écriture : les captures et le journal relèvent de la recette.
//
//   import { demarrer } from 'file:///…/scripts/recette/setup.mjs';
//   const { session, choix } = await demarrer({ scenario: 'entrainement', combat: 'enc-entrainement' });   // lance son Chrome
//   const { session, choix } = await demarrer({ scenario: 'embuscade', attacher: true });                 // session TENUE
import { appelerWfrp, attacherSession, leverApresNettoyage, openApp, ouvrirRound, porterChoix, resoudreModales, waitFor } from './lib.mjs';

/**
 * Ouvre l'app (`ouvrir`), ou s'attache à la session tenue, ou reprend la `session` donnée ; lance le
 * scénario `scenario` (graine `graine`), attend l'entrée en scène, résout les fenêtres d'ouverture,
 * puis, si `combat` est donné, pose la rencontre (`__wfrp.fight`) et OUVRE le premier Round au geste du
 * joueur. Rend `{ session, choix }` — `choix` : ceux que `resoudreModales` a faits à la place du
 * joueur ; la console depuis l'amorçage est `session.console` (`errors()`, `warnings()`). Sur échec, ne
 * ferme que la session qu'il a lui-même ouverte ou attachée ; la levée porte les choix (`porterChoix`).
 */
export async function demarrer({ scenario, graine, combat, attacher = false, url, timeoutMs = 120000, session: donnee, ouvrir = openApp } = {}) {
  const session = donnee ?? (attacher ? await attacherSession() : await ouvrir(url, { timeoutMs, console: true }));
  const choix = [];
  try {
    if (scenario) {
      await appelerWfrp(session, 'scenario', scenario, ...(graine === undefined ? [] : [Number(graine)]));
      // `ready(timeoutMs)` borne SON attente d'entrée en scène (src/state/devtools.ts, `ready`) ; l'évaluation la dépasse.
      await appelerWfrp(session, { nom: 'ready', timeoutMs: 65000 }, 60000);
      choix.push(...(await resoudreModales(session, `ouverture de « ${scenario} »`)));
    }
    if (combat) {
      await appelerWfrp(session, 'fight', combat);
      await waitFor(session, `!!window.__wfrp.store.getState().pendingRoundStart || !!document.querySelector('.modal-overlay')`, { timeoutMs: 20000 });
      choix.push(...(await resoudreModales(session, `ouverture du combat « ${combat} »`)));
      await ouvrirRound(session);
    }
    return { session, choix };
  } catch (e) {
    porterChoix(e, [...choix, ...(e.choix ?? [])]);
    if (donnee) throw e;
    await leverApresNettoyage(e, () => session.close());
  }
}

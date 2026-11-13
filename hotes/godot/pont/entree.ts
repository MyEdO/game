/**
 * L'ENTRÉE DU BUNDLE DU PONT (#2928, `CONTRAT.md`) : la page expose le pont à Godot en `globalThis.wfrpPont`, sur son
 * stockage (`localStorage`, où vivent les sauvegardes) et sur le réseau de la page (`portsDeLaPage`, sa minuterie
 * écrite ici), avec le choix d'un fichier sur le disque du joueur (`choisirUnFichier`) et la pile des couches d'une tenue
 * (`resoudreLaPile`). Le bundle se bâtit par `hotes/godot/construire.mjs`, qui charge le gel du catalogue avant elle
 * (`scripts/entree-d-hote.mjs`).
 */
import { creerPont, type Pont } from './pont';
import { choisirUnFichier } from './fichier';
import { resoudreLaPile } from './pileEnFond';
import { stockageWeb } from '../../../src/hote/stockageWeb';
import { portsDeLaPage } from '../../../src/hote/coop/page';

/**
 * @contrat Transport
 * - La page charge le bundle `wfrp-pont.js` (`node hotes/godot/construire.mjs --pont-seul --sortie <dossier>`), qui
 *   expose `globalThis.wfrpPont`. Le bundle lit les API de navigateur que déclare `API_DU_NAVIGATEUR`
 *   (`processus.mjs`), dont `localStorage`, le stockage du pont, où vivent les sauvegardes, et celles du salon ; la
 *   construction le lit (`lecturesDuBundle`, `construire.mjs`) et la CI rougit sur un nom de navigateur lu qui n'est ni
 *   déclaré ni compté à son nombre de lectures dans `HORS_DU_PROCESSUS` ; elle l'exécute dans un contexte qui ne porte
 *   que les API déclarées, et rougit si `demarrer`, `vue`, `sauvegardes` ou `salon` n'y répondent pas `ok: true`.
 */
(globalThis as typeof globalThis & { wfrpPont: Pont & { choisirUnFichier: typeof choisirUnFichier; resoudreLaPile: typeof resoudreLaPile } }).wfrpPont = { ...creerPont(stockageWeb('localStorage'), {
  ...portsDeLaPage(),
  minuterie: { programmer: (suite, delai) => { const id = setTimeout(suite, delai); return () => clearTimeout(id); } },
}), choisirUnFichier, resoudreLaPile };

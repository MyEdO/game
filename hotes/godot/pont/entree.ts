/**
 * L'ENTRÉE DU BUNDLE DU PONT (#2928, `CONTRAT.md`) : la page expose le pont à Godot en `globalThis.wfrpPont`, sur son
 * stockage (`localStorage`, où vivent les sauvegardes), avec le
 * choix d'un fichier sur le disque du joueur (`choisirUnFichier`) et la pile des couches d'une tenue
 * (`resoudreLaPile`). Le bundle se bâtit par `hotes/godot/construire.mjs`, qui charge le gel du catalogue avant elle
 * (`scripts/entree-d-hote.mjs`).
 */
import { creerPont, type Pont } from './pont';
import { choisirUnFichier } from './fichier';
import { resoudreLaPile } from './pileEnFond';
import { stockageWeb } from '../../../src/hote/stockageWeb';

/**
 * @contrat Transport
 * - La page charge le bundle `wfrp-pont.js` (`node hotes/godot/construire.mjs --pont-seul --sortie <dossier>`), qui
 *   expose `globalThis.wfrpPont`. Le bundle lit les API de navigateur que déclare `API_DU_NAVIGATEUR`
 *   (`processus.mjs`), dont `localStorage`, le stockage du pont, où vivent les sauvegardes ; la construction
 *   l'exécute dans un contexte qui ne porte qu'elles, et la CI rougit si `demarrer`, `vue` ou `sauvegardes` n'y
 *   répondent pas `ok: true`.
 */
(globalThis as typeof globalThis & { wfrpPont: Pont & { choisirUnFichier: typeof choisirUnFichier; resoudreLaPile: typeof resoudreLaPile } }).wfrpPont = { ...creerPont(stockageWeb('localStorage'), null), choisirUnFichier, resoudreLaPile };

/**
 * LE DÉMARRAGE DU PONT DU BUNDLE (#2928, `CONTRAT.md`) : `demarrerLePont` expose le pont à Godot en `globalThis.wfrpPont`,
 * sur le stockage de la page (`localStorage`, où vivent les sauvegardes) et sur son réseau (`portsDeLaPage`, sa minuterie
 * écrite ici), avec le choix d'un fichier sur le disque du joueur (`choisirUnFichier`), la pile des couches d'une tenue
 * (`resoudreLaPile`), le téléchargement d'un fichier du serveur du jeu (`telecharger`), et le contenu (`ContenuDUnJeu`)
 * que l'entrée d'un jeu lui remet (#4936). Le bundle se bâtit par `hotes/godot/construire.mjs` depuis cette entrée, après
 * le gel du catalogue (`scripts/entree-d-hote.mjs`) ; l'import de ce module ne démarre rien.
 */
import { creerPont, type Pont } from './pont';
import { choisirUnFichier } from './fichier';
import { resoudreLaPile } from './pileEnFond';
import { telecharger } from './telechargement';
import { stockageWeb } from '../../../src/hote/stockageWeb';
import { portsDeLaPage } from '../../../src/hote/coop/page';
import type { ContenuDUnJeu } from '../../../src/hote/contenu';

/**
 * @contrat Transport
 * - La page charge le bundle `wfrp-pont.js` (`node hotes/godot/construire.mjs --pont-seul --sortie <dossier>`), qui
 *   expose `globalThis.wfrpPont`. Le bundle lit les API de navigateur que déclare `API_DU_NAVIGATEUR`
 *   (`processus.mjs`), dont `localStorage`, le stockage du pont, où vivent les sauvegardes, et celles du salon ; la
 *   construction le lit (`lecturesDuBundle`, `construire.mjs`) et la CI rougit sur un nom de navigateur lu qui n'est ni
 *   déclaré ni compté à son nombre de lectures dans `HORS_DU_PROCESSUS` ; elle l'exécute dans un contexte qui ne porte
 *   que les API déclarées, et rougit sur tout écart aux appels qu'y joue `executer` (`construire.mjs`).
 */
export function demarrerLePont(contenu: ContenuDUnJeu): void {
  (globalThis as typeof globalThis & { wfrpPont: Pont & { choisirUnFichier: typeof choisirUnFichier; resoudreLaPile: typeof resoudreLaPile; telecharger: typeof telecharger } }).wfrpPont = { ...creerPont(stockageWeb('localStorage'), {
    ...portsDeLaPage(),
    minuterie: { programmer: (suite, delai) => { const id = setTimeout(suite, delai); return () => clearTimeout(id); } },
  }, contenu), choisirUnFichier, resoudreLaPile, telecharger };
}

import { ouvrirLaBibliotheque } from '../hote/bibliotheque';
import { accesBase, idbDisponible } from '../web/indexedDb';
import { stockageWeb } from '../web/stockageWeb';

const STORE = 'projects';

/** La base IndexedDB `wfrp4-library` de la bibliothèque web (#776, #3041). */
const base = accesBase({ nom: 'wfrp4-library', magasins: { [STORE]: { keyPath: 'id' } } });
const projets = base.magasin<unknown, string>(STORE);

/** La bibliothèque de campagnes du web (`hote/bibliotheque.ts`) : sa base IndexedDB quand le navigateur l'offre, son
 *  miroir et ses tombes dans `localStorage`, ports relus à chaque appel. La borne par entrée du miroir reste nettement
 *  sous le quota `localStorage` usuel (~5 Mio ≈ 2 500 000 caractères UTF-16), pour y loger plusieurs projets. */
const bibliotheque = ouvrirLaBibliotheque(() => (idbDisponible() ? projets : null), () => stockageWeb('localStorage'), {
  borneDuMiroirParEntree: 500_000,
  causesDIndisponibilite: 'navigation privée, accès refusé…',
});

export const {
  initLibrary,
  projectsLoad,
  publishedProjects,
  projectSave,
  projectRemove,
  estRefusee,
  projetDeLEntree,
  campagneDeLEntree,
} = bibliotheque;

/** Test : remet la bibliothèque à zéro (`reinitialiser`) et vide sa base IndexedDB. */
export async function __resetLibraryForTest(): Promise<void> {
  bibliotheque.reinitialiser();
  await base.vider();
}

/** L'ENTRÉE VIDE DU PONT (#4936) : le pont démarré (`demarrerLePont`) sur un contenu sans campagne, sans scénario remis
 *  ni fiche, l'entrée que la suite de la construction bâtit par `--entree` (`hotes/godot/construire.hors-store.test.ts`). */
import { demarrerLePont } from './entree';

demarrerLePont({ campagnes: [], scenarios: [], dossiers: [] });

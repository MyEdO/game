/** L'ENTRÉE COMMUNE DU PONT (#4936) : le pont démarré (`demarrerLePont`) sur le contenu de test du commun. Le bundle se
 *  bâtit depuis elle sans `--entree` (`hotes/godot/construire.mjs`). */
import { demarrerLePont } from './entree';
import { contenu } from '../../../src/scenes/fixtures/contenuDuCommun';

demarrerLePont(contenu);

/** L'ENTRÉE DU PONT DU JEU DE RÔLE (#4936) : le pont démarré (`demarrerLePont`) sur son contenu, celle que passent les
 *  scripts `jeu-de-role:*` de `package.json` (`hotes/godot/construire.mjs --entree`). */
import { demarrerLePont } from '../../hotes/godot/pont/entree';
import { contenu } from './contenu';

demarrerLePont(contenu);

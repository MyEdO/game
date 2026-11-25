/** L'ENTRÉE DU PONT DU JEU DE RÔLE (#4936) : le pont démarré (`demarrerLePont`) sur son contenu, celle que passent les
 *  scripts `godot:*` de `package.json` (`hotes/godot/construire.mjs --entree`). */
import { demarrerLePont } from './entree';
import { contenu } from './contenu-jeu-de-role';

demarrerLePont(contenu);

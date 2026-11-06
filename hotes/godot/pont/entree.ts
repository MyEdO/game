/**
 * L'ENTRÉE DU BUNDLE DU PONT (#2928, `CONTRAT.md`) : la page expose le pont à Godot en `globalThis.wfrpPont`, avec le
 * choix d'une image sur le disque de l'auteur (`choisirUneImage`). Le bundle se bâtit par `hotes/godot/construire.mjs`,
 * qui charge le gel du catalogue avant elle (`scripts/entree-d-hote.mjs`).
 */
import { creerPont, type Pont } from './pont';
import { choisirUneImage } from './fichier';

(globalThis as typeof globalThis & { wfrpPont: Pont & { choisirUneImage: typeof choisirUneImage } }).wfrpPont = { ...creerPont(), choisirUneImage };

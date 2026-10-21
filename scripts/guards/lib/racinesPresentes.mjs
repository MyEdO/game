// LES RACINES DES ZONES QUE L'ARBRE PORTE (#2928) : celles de `RACINES_DES_ZONES` (`couches.mjs`) dont le dossier existe,
// lues au chargement ; une racine sans dossier n'a rien à lire. Le périmètre des gardes (`commentPoison.mjs`) et les
// lectures des gates (`ECRIT_LU`, `scripts/gates/toutes.mjs`) en dérivent. Hors de `couches.mjs`, que la table garde
// sans lecture du disque. Le chemin se joint au dossier du module, jamais par `new URL(gabarit, import.meta.url)`, que
// Vite réécrit en import d'actifs sous un environnement de navigateur (`jsdom`).
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RACINES_DES_ZONES } from './couches.mjs';

const DEPOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const RACINES_PRESENTES = Object.freeze(RACINES_DES_ZONES.filter((r) => existsSync(join(DEPOT, r))));

// Mécanique de scan du garde-fou « armure portée résolue au noyau » (#2948, lot L1e). L'armure de statbloc
// DÉCLARÉE PORTÉE (`armurePortee`, apparence d'auteur puis record) et les pièces synthétisées de ses PA
// (`synthArmour`) se résolvent en UN module, `src/noyau/equipementDessine.ts` : une seconde résolution refait
// diverger ce que le combat, l'exploration et chaque hôte dessinent d'un même porteur.
//
// La détection est LEXICALE, sur le CODE seul : un appel `synthArmour(` ou un accès de propriété
// `.armurePortee` / `?.armurePortee`. Une CLÉ littérale (`{ armurePortee: true }`, schéma Zod, apparence
// d'auteur écrite) n'est pas une lecture et n'est pas vue. Dialectes : JavaScript/TypeScript (`codeSeul.mjs`)
// et GDScript (`gdscript.mjs`) pour l'hôte Godot. Ce que la garde ne voit pas : une lecture par clé calculée
// (`a['armure' + 'Portee']`) ou par destructuration (`const { armurePortee } = a`).
// Module ESM pur, exécutable par `node` nu — même patron que `heroDebout.mjs` (mécanique ici, POLITIQUE dans
// le test).

import { codeSeul } from './codeSeul.mjs';
import { lexemesGdscript } from './gdscript.mjs';

/** Appel de la synthèse d'armure de statbloc. @type {RegExp} */
export const SYNTH_RX = /\bsynthArmour\s*\(/g;
/** Accès de propriété au drapeau d'armure portée. @type {RegExp} */
export const LECTURE_RX = /\.\s*armurePortee\b/g;

/** Le texte réduit à son CODE dans le dialecte du fichier. @param {string} relPath @param {string} contenu */
const vueCode = (relPath, contenu) => (relPath.endsWith('.gd') ? lexemesGdscript(contenu).code : codeSeul(contenu));

/**
 * Chaque appel `synthArmour(` et chaque lecture `.armurePortee` du CODE d'un fichier, avec sa ligne.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanArmurePortee(relPath, contenu) {
  const lignes = vueCode(relPath, contenu).split('\n');
  /** @type {{ line: number, detail: string }[]} */
  const findings = [];
  lignes.forEach((l, i) => {
    for (const rx of [SYNTH_RX, LECTURE_RX]) for (const m of l.matchAll(rx)) findings.push({ line: i + 1, detail: m[0] });
  });
  return findings;
}

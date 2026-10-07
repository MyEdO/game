// Mécanique de scan du garde-fou « anciens tokens CharKey en VALEUR de caractéristique » (#302,
// verrous 2ᵉ vague, pérennise le grep de sortie #311). Migration #311 (78d04b4a) : `CharKey` est
// passé de `'CC'|'CT'|'F'|'E'|'I'|'Ag'|'Dex'|'Int'|'FM'|'Soc'` à des slugs pleins
// (`capacite-de-combat`…) — plus jamais de token court en VALEUR mécanique (clé de `Characteristics`,
// champ `char`/`resolveChar`/`testModChar`/`characteristic`). Cible les DATASETS + le STATE :
// jamais l'AFFICHAGE (`charAbr`, dérivé de `characteristics.json` par id, cf. `src/data/index.ts`).
// Module ESM pur, exécutable par `node` nu — même patron que `hardcode.mjs`.

/** Retire commentaires ET imports nommés — mêmes règles que `hardcode.mjs`.
 * @param {string} src @returns {string} */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+['"][^'"]*['"];?/g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

const TOKENS = '(?:CC|CT|F|E|I|Ag|Dex|Int|FM|Soc)';

/** @type {RegExp} */
export const CHAR_KEY_LEGACY_RX = new RegExp(
  `\\b(?:CC|CT|Ag|Dex|Int|FM|Soc)\\s*:\\s*\\d` + // clé d'objet Characteristics/charAdvances, tokens multi-lettres
  `|\\.characteristics\\.${TOKENS}\\b` + // accès propriété directe
  `|characteristics\\[['"]${TOKENS}['"]\\]` + // accès index
  `|\\b(?:char|resolveChar|testModChar|characteristic)\\??\\s*:\\s*['"]${TOKENS}['"]`, // champ CharKey typé
);

/**
 * Scan complet d'un fichier source : chaque ligne portant le motif (hors commentaires/imports).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanCharKeyLegacy(relPath, contenu) {
  const findings = [];
  stripComments(contenu)
    .split('\n')
    .forEach((line, i) => {
      if (CHAR_KEY_LEGACY_RX.test(line)) findings.push({ line: i + 1, detail: line.trim() });
    });
  return findings;
}

/** Compte de sites par fichier (raccourci de `scanCharKeyLegacy(...).length`).
 * @param {string} relPath @param {string} contenu @returns {number} */
export function countCharKeyLegacy(relPath, contenu) {
  return scanCharKeyLegacy(relPath, contenu).length;
}

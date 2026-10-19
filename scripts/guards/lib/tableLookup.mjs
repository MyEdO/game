// Mécanique de scan du garde-fou « lookup [min,max] hors engine/tables.ts » (#302, verrous 2ᵉ vague).
// `findTableEntry`/`findTableEntryIndex` (src/engine/tables.ts) sont la SOURCE UNIQUE du motif
// `table.find((e) => roll >= e.min && roll <= e.max)` — toute réinvention du MÊME motif (recherche
// d'une entrée de table par fourchette, via `.find`/`.findIndex`) ailleurs réinvente le foyer.
// Ne cible QUE la forme `.find(/.findIndex(` — une comparaison `>= x.min && <= x.max` HORS `.find`
// (ex. `waterExposure.ts` : simple test d'appartenance sur un modificateur, pas une recherche de
// table) reste un motif DIFFÉRENT, volontairement hors périmètre. Module ESM pur, exécutable par
// `node` nu — même patron que `journalWrite.mjs`.

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

/** @type {RegExp} */
export const TABLE_LOOKUP_RX = /\.find(?:Index)?\(\([^)]*\)\s*=>\s*[^)]*>=\s*[^)]*\.min\s*&&[^)]*<=\s*[^)]*\.max/;

/**
 * Scan complet d'un fichier source : chaque ligne portant le motif (hors commentaires/imports).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanTableLookup(relPath, contenu) {
  const findings = [];
  stripComments(contenu)
    .split('\n')
    .forEach((line, i) => {
      if (TABLE_LOOKUP_RX.test(line)) findings.push({ line: i + 1, detail: line.trim() });
    });
  return findings;
}

/** Compte de sites par fichier (raccourci de `scanTableLookup(...).length`).
 * @param {string} relPath @param {string} contenu @returns {number} */
export function countTableLookup(relPath, contenu) {
  return scanTableLookup(relPath, contenu).length;
}

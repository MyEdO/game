// Mécanique de scan du garde-fou « prégénéré retrouvé PAR LABEL » (#322) : un test qui recherche
// un `PregenDef` (`src/data/pregens.json`) via `.find(… => x.name === 'Wilhelmina Faust')` ou
// `.name.startsWith('Klein')` réinvente une résolution par AFFICHAGE (fragile au renommage) au lieu
// de `pregen(PREGEN.<clé>)` / `pregenParty(...)` (`src/data/pregens.ts`), la SOURCE UNIQUE d'un
// prégénéré par id STABLE. Module ESM pur, exécutable par `node` nu — consommé par
// `src/data/pregen-by-label-guard.test.ts` ET par un futur hook pre-commit. Même patron que
// `hardcode.mjs`/`inBattleFind.mjs` (mécanique de détection ici, policy dans le test).

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

/** Chaînes quotées d'au moins 3 caractères présentes sur une ligne (candidates à un libellé).
 * @type {RegExp} */
const QUOTED_RX = /['"]([^'"]{3,})['"]/g;

/**
 * Scan complet d'un fichier : chaque ligne portant un `.find(` (ou `.findIndex(`) dont le
 * prédicat lit `.name`/`.label` ET compare/préfixe une chaîne littérale qui EST (ou préfixe) un nom
 * de prégénéré connu (`names`, lu depuis `pregens.json` par l'appelant — jamais dupliqué ici).
 * @param {string} relPath @param {string} contenu @param {string[]} names
 * @returns {{ line: number, detail: string }[]}
 */
export function scanPregenByLabel(relPath, contenu, names) {
  const findings = [];
  stripComments(contenu)
    .split('\n')
    .forEach((line, i) => {
      if (!/\.find(Index)?\(/.test(line)) return;
      if (!/\.(name|label)\b/.test(line)) return;
      let m;
      QUOTED_RX.lastIndex = 0;
      while ((m = QUOTED_RX.exec(line))) {
        const q = m[1];
        if (names.some((n) => n === q || n.startsWith(q))) {
          findings.push({ line: i + 1, detail: line.trim() });
          break;
        }
      }
    });
  return findings;
}

/** Compte de sites par fichier (raccourci de `scanPregenByLabel(...).length`).
 * @param {string} relPath @param {string} contenu @param {string[]} names @returns {number} */
export function countPregenByLabel(relPath, contenu, names) {
  return scanPregenByLabel(relPath, contenu, names).length;
}

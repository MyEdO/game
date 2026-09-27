// LECTURE DE `_zod.def` (#1463 R2, D10b) — hors de `src/data/schemas/grammaire/descente.ts`, la forme
// d'un nœud zod se lit par `defDe` et ses enfants par `enfantsDe` : un `_zod.def` écrit à la main, ou un
// champ d'enfants (`CHAMPS_D_ENFANTS`, exporté par `descente.ts`) lu sur un `def`, est une seconde
// lecture de la forme, qui divergera sur la première enveloppe neuve. Module ESM pur, exécutable par
// `node` nu ; le scan porte sur la vue CODE SEUL (`codeSeul.mjs`) : un commentaire ou une chaîne
// n'exécutent rien.
import { codeSeul } from './codeSeul.mjs';

/** Accès à `def` sur `_zod` (`_zod.def`, `_zod?.def`, `_zod!.def`), et `_def` (alias de zod). */
const ACCES_DEF = /_zod[!?]*\.def\b|\b_def\b/;
/** Accès `_zod['def']` / `_zod?.['def']` : la chaîne est blanchie dans la vue code, on relit la source
 *  à la même colonne (`codeSeul.mjs` préserve les colonnes). */
const ACCES_DEF_CROCHET = /_zod[!?]*(?:\?\.)?\[\s*['"`]/g;
const CROCHET_DEF = /^_zod[!?]*(?:\?\.)?\[\s*(['"`])def\1\s*\]/;
/** Le `= defDe(` d'une assignation : `const nd = defDe(n)`, `let d: DefZod = defDe(n)`, `d = defDe(n)`. */
const ASSIGNATION_DE_DEF = /=\s*defDe\s*\(/g;
/** Une déstructuration depuis `defDe(` : `const { shape } = defDe(n)`. */
const DESTRUCTURATION_DE_DEF = /\{([^{}]*)\}\s*(?::[^=;]*)?=\s*defDe\s*\(/g;

const echapper = (mot) => mot.replace(/[$]/g, '\\$');

/**
 * Motif d'une lecture de champ d'enfants sur un `def` ou un alias : `def.shape`, `def?.options`,
 * `x.def!.element`, `nd.shape` quand `nd` est un alias.
 * @param {readonly string[]} champs
 * @param {readonly string[]} [alias] identifiants assignés depuis `defDe(` dans le même fichier
 * @returns {RegExp}
 */
function motifDeChampDEnfants(champs, alias = []) {
  const noms = ['def', ...alias].map(echapper).join('|');
  return new RegExp(`(?<![\\w$])(?:${noms})[!?]*\\??\\.(?:${champs.map(echapper).join('|')})\\b`);
}

/**
 * Les identifiants assignés depuis `defDe(` : l'identifiant, une annotation `: T` facultative sans `=`
 * ni `;`, puis `= defDe(`. Chaque `= defDe(` se résout sur le seul segment qui le précède depuis le
 * dernier `=`/`;` (ou la fin de la résolution précédente), le premier identifiant du segment suivi de
 * `=` ou de `:` : chaque caractère est visité un nombre borné de fois.
 * @param {string} code
 * @returns {string[]}
 */
function aliasDeDef(code) {
  const noms = [];
  let fin = 0;
  for (const m of code.matchAll(ASSIGNATION_DE_DEF)) {
    const egal = m.index;
    let debut = egal;
    while (debut > fin && code[debut - 1] !== '=' && code[debut - 1] !== ';') debut--;
    for (let i = debut; i < egal; ) {
      if (!/[A-Za-z_$]/.test(code[i])) {
        i++;
        continue;
      }
      let finNom = i;
      while (/[\w$]/.test(code[finNom])) finNom++;
      let suite = finNom;
      while (suite < egal && /\s/.test(code[suite])) suite++;
      if (suite === egal || code[suite] === ':') {
        noms.push(code.slice(i, finNom));
        fin = egal + m[0].length;
        break;
      }
      i = finNom;
    }
  }
  return noms;
}

/** Le reste de `code` après chaque appel `defDe(…)` complet, parenthèses imbriquées comprises. */
function apresDefDe(code) {
  const restes = [];
  for (let i = code.indexOf('defDe('); i !== -1; i = code.indexOf('defDe(', i + 1)) {
    if (i > 0 && /[\w$]/.test(code[i - 1])) continue;
    let profondeur = 0;
    for (let j = i + 'defDe'.length; j < code.length; j++) {
      if (code[j] === '(') profondeur++;
      else if (code[j] === ')' && --profondeur === 0) {
        restes.push(code.slice(j + 1));
        break;
      }
    }
  }
  return restes;
}

/**
 * Les lectures de `_zod.def` et de champs d'enfants d'un texte source, ligne par ligne : sur `def`,
 * sur un appel `defDe(…)`, sur un identifiant assigné depuis `defDe(` dans le même fichier, ou par
 * déstructuration de `defDe(…)`.
 * @param {string} contenu
 * @param {readonly string[]} champs `CHAMPS_D_ENFANTS` de `descente.ts`
 * @returns {{ ligne: number, extrait: string }[]}
 */
export function lecturesDefZod(contenu, champs) {
  const code = codeSeul(contenu);
  const alias = [...new Set(aliasDeDef(code).filter((n) => n !== 'def'))];
  const champ = motifDeChampDEnfants(champs, alias);
  const apresAppel = new RegExp(`^[!?]*\\??\\.(?:${champs.map(echapper).join('|')})\\b`);
  const destructure = new RegExp(`(?<![\\w$])(?:${champs.map(echapper).join('|')})(?![\\w$])`);
  const brut = contenu.split('\n');
  const trouvees = [];
  code.split('\n').forEach((ligne, i) => {
    const crochet = [...ligne.matchAll(ACCES_DEF_CROCHET)].some((m) => CROCHET_DEF.test(brut[i].slice(m.index)));
    const appel = apresDefDe(ligne).some((reste) => apresAppel.test(reste));
    const deconstruit = [...ligne.matchAll(DESTRUCTURATION_DE_DEF)].some((m) => destructure.test(m[1]));
    if (ACCES_DEF.test(ligne) || crochet || champ.test(ligne) || appel || deconstruit) trouvees.push({ ligne: i + 1, extrait: brut[i].trim() });
  });
  return trouvees;
}

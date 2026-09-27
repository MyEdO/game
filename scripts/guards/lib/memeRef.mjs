// Mécanique de scan de la garde « même référence » (#1473) : l'identité (id, spec) d'une référence se
// juge par le prédicat UNIQUE `memeRef` (`src/engine/careerSlots.ts`), égalité des `refKey`. Motifs
// refusés : la normalisation `(… spec ?? '') ===` recodée à un site, la conjonction nue
// `….id === … && ….spec ===` (ou sa négation `!== … || ….spec !==`), et la même identité en deux temps :
// `const xs = ….filter((s) => s.id === …)` puis `xs.find((s) => s.spec === …)`, tant que le bloc qui déclare
// `xs` n'est pas refermé (portée d'un `const`, mesurée aux accolades du code seul). Une couverture par joker
// (`spec == null || ….spec === …`) n'est pas une identité : elle reste hors motif. Lu sur la vue CODE SEUL
// (`codeSeul.mjs`) : commentaires et contenus de chaîne ne portent rien. Module ESM pur, exécutable
// par `node` nu.
import { codeSeul } from './codeSeul.mjs';

/** `(x.spec ?? '') ===`, `!==`, et la forme miroir `=== (y.spec ?? '')`. */
export const MEME_SPEC_RX = /\bspec\s*\?\?\s*''\s*\)\s*[!=]==|[!=]==\s*\(\s*[\w$.!?[\]]*\bspec\s*\?\?\s*''/;

/** `….id === … && ….spec ===` (`talentId`, `skillId` compris) et la négation `….id !== … || ….spec !==`. */
export const MEME_ID_SPEC_RX = /\w*[iI]d\s*===[^&|]*&&\s*[\w$.!?[\]]*\bspec\s*===|\w*[iI]d\s*!==[^&|]*\|\|\s*[\w$.!?[\]]*\bspec\s*!==/;

/** `const xs = ….filter((s) => s.id === …` : capture le nom de la collection filtrée par id. */
export const FILTRE_PAR_ID_RX = /\bconst\s+([\w$]+)\s*=[^;]*\.filter\(\s*\(?\s*([\w$]+)\s*\)?\s*=>\s*\2\.\w*[iI]d\s*===/;

/** `xs.find((s) => s.spec ===` sur une collection `xs` filtrée par id (`FILTRE_PAR_ID_RX`). */
const specSurFiltre = (nom) =>
  new RegExp(`\\b${nom.replace(/\$/g, '\\$')}\\.(?:find|findIndex|some|every|filter)\\(\\s*\\(?\\s*([\\w$]+)\\s*\\)?\\s*=>\\s*\\1\\.spec\\s*[!=]==`);

/** Accolades ouvertes moins accolades fermées d'un fragment de code. */
const soldeAccolades = (code) => [...code].reduce((n, c) => (c === '{' ? n + 1 : c === '}' ? n - 1 : n), 0);

/**
 * Lignes d'un fichier source qui recodent l'égalité de spécialisation.
 * @param {string} contenu @returns {{ line: number, detail: string }[]}
 */
export function scanMemeRef(contenu) {
  const lignes = contenu.split('\n');
  const findings = [];
  let filtres = [];
  let profondeur = 0;
  codeSeul(contenu).split('\n').forEach((ligne, i) => {
    const deuxTemps = filtres.some((f) => f.rx.test(ligne));
    if (MEME_SPEC_RX.test(ligne) || MEME_ID_SPEC_RX.test(ligne) || deuxTemps) findings.push({ line: i + 1, detail: lignes[i].trim() });
    const filtre = FILTRE_PAR_ID_RX.exec(ligne);
    if (filtre) filtres.push({ rx: specSurFiltre(filtre[1]), profondeur: profondeur + soldeAccolades(ligne.slice(0, filtre.index)) });
    for (const c of ligne) {
      if (c === '{') profondeur++;
      else if (c === '}') {
        profondeur--;
        filtres = filtres.filter((f) => f.profondeur <= profondeur);
      }
    }
  });
  return findings;
}

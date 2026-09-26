// Mécanique de scan de la garde « même référence » (#1473) : l'identité (id, spec) d'une référence se
// juge par le prédicat UNIQUE `memeRef` (`src/engine/careerSlots.ts`), égalité des `refKey`. Motifs
// refusés : la normalisation `(… spec ?? '') ===` recodée à un site, et la conjonction nue
// `….id === … && ….spec ===` (ou sa négation `!== … || ….spec !==`). Une couverture par joker
// (`spec == null || ….spec === …`) n'est pas une identité : elle reste hors motif. Lu sur la vue CODE SEUL
// (`codeSeul.mjs`) : commentaires et contenus de chaîne ne portent rien. Module ESM pur, exécutable
// par `node` nu.
import { codeSeul } from './codeSeul.mjs';

/** `(x.spec ?? '') ===`, `!==`, et la forme miroir `=== (y.spec ?? '')`. */
export const MEME_SPEC_RX = /\bspec\s*\?\?\s*''\s*\)\s*[!=]==|[!=]==\s*\(\s*[\w$.!?[\]]*\bspec\s*\?\?\s*''/;

/** `….id === … && ….spec ===` (`talentId`, `skillId` compris) et la négation `….id !== … || ….spec !==`. */
export const MEME_ID_SPEC_RX = /\w*[iI]d\s*===[^&|]*&&\s*[\w$.!?[\]]*\bspec\s*===|\w*[iI]d\s*!==[^&|]*\|\|\s*[\w$.!?[\]]*\bspec\s*!==/;

/**
 * Lignes d'un fichier source qui recodent l'égalité de spécialisation.
 * @param {string} contenu @returns {{ line: number, detail: string }[]}
 */
export function scanMemeRef(contenu) {
  const lignes = contenu.split('\n');
  const findings = [];
  codeSeul(contenu).split('\n').forEach((ligne, i) => {
    if (MEME_SPEC_RX.test(ligne) || MEME_ID_SPEC_RX.test(ligne)) findings.push({ line: i + 1, detail: lignes[i].trim() });
  });
  return findings;
}

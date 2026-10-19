import { ast, typescript } from './dialecte.mjs';
// Garde d'UNICITÉ des clés de stockage web (#1897) : une clé `wfrp4.…` n'est écrite en littéral que
// chez son propriétaire, qui l'exporte. Mécanique ICI, jouée par `src/cles-de-stockage-guard.test.ts`
// — scanner AST en lib, test qui le joue. Module ESM pur, exécutable par `node` nu. L'accès au
// stockage lui-même est un mur de lint (`murs/stockage-web`, `oxlint.config.mjs`).
//
// Détection par AST : une clé est un LITTÉRAL du code, jamais une occurrence textuelle d'un commentaire.

/** Dossier scanné, POSIX relatif à la racine du dépôt. */
export const SCAN_DIRS = ['src'];

/** Forme d'une clé de stockage du jeu : préfixe `wfrp4.` (ou `wfrp.` des outils de recette). */
const CLE_DE_STOCKAGE_RX = /^wfrp4?\.[\w.-]+$/;

/**
 * Clés de stockage écrites en LITTÉRAL (chaîne ou gabarit sans substitution) : une clé n'a qu'un
 * propriétaire, qui l'exporte ; un second littéral de la même clé est une copie qui divergera.
 * Hors vue : une clé composée par substitution (`` `wfrp4.save.${slot}` ``).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, cle: string }[]}
 */
export function scanClesDeStockage(relPath, contenu, sourceFile) {
  if (!/wfrp4?\./.test(contenu)) return [];
  const ts = typescript();
  const sf = sourceFile ?? ast({ rel: relPath, text: contenu });
  const out = [];
  const visite = (n) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && CLE_DE_STOCKAGE_RX.test(n.text)) {
      out.push({ line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, cle: n.text });
    }
    n.forEachChild(visite);
  };
  visite(sf);
  return out;
}

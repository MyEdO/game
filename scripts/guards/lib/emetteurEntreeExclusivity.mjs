import { ast, typescript } from './dialecte.mjs';
// Garde d'EXCLUSIVITÉ de l'émetteur d'entrée du kit de recette (#1953) : l'émetteur BRUT du CDP
// (`emetteursBruts`, `scripts/recette/lib.mjs`) n'est référencé que dans les ÉMETTEURS — `brancherCdp`
// qui le pose, `geste` (souris, toucher) et `frappe` (clavier) qui le lisent. Mécanique ICI, jouée par
// `src/emetteur-entree-exclusivity-guard.test.ts` — patron `stockageWebExclusivity.mjs`. Module ESM
// pur, exécutable par `node` nu.
//
// Détection par AST : un site est une RÉFÉRENCE, jamais une occurrence textuelle — un commentaire ou
// une chaîne qui nomme l'émetteur n'est pas un accès.

/** Nom de l'émetteur brut privé. */
export const EMETTEUR_BRUT = 'emetteursBruts';

/** PRÉ-FILTRE lexical : un fichier qui ne nomme pas l'émetteur n'est jamais parsé. @type {RegExp} */
export const EMETTEUR_BRUT_RX = /\bemetteursBruts\b/;

/** Dossier scanné, POSIX relatif à la racine du dépôt. */
export const SCAN_DIRS = ['scripts/recette'];

/** Le module propriétaire de l'émetteur brut. */
export const PROPRIETAIRE = 'scripts/recette/lib.mjs';

/** Les ÉMETTEURS : seules fonctions du propriétaire où l'émetteur brut se référence. */
export const EMETTEURS = Object.freeze(['brancherCdp', 'geste', 'frappe']);

/**
 * Références à l'émetteur brut HORS d'un émetteur : dans un autre fichier que le propriétaire, ou
 * dans le propriétaire hors des fonctions `EMETTEURS` (sa déclaration au niveau du module exceptée).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, dans: string }[]}
 */
export function scanEmetteurBrut(relPath, contenu, sourceFile) {
  if (!EMETTEUR_BRUT_RX.test(contenu)) return [];
  const ts = typescript();
  const sf = sourceFile ?? ast({ rel: relPath, text: contenu });
  const proprietaire = relPath === PROPRIETAIRE;
  const out = [];
  const fonctionDe = (n) => {
    for (let a = n.parent; a; a = a.parent) if (ts.isFunctionDeclaration(a) && a.name) return a.name.text;
    return null;
  };
  const visite = (n) => {
    if (ts.isIdentifier(n) && n.text === EMETTEUR_BRUT) {
      const declaration = ts.isVariableDeclaration(n.parent) && n.parent.name === n && !fonctionDe(n);
      const dans = fonctionDe(n);
      if (!(proprietaire && (declaration || EMETTEURS.includes(dans)))) {
        out.push({ line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, dans: dans ?? '(module)' });
      }
    }
    n.forEachChild(visite);
  };
  visite(sf);
  return out;
}

// MUR « interne » (#2724) — le « package-private » que TypeScript n'a pas : un fichier sous `X/interne/`
// n'est importable que depuis `X/`. La frontière est la PLACE du fichier dans l'arbre, sans aucune liste.
//
// Le spécificateur se NORMALISE sans lire le disque : le pre-commit ne lint que les fichiers stagés,
// recopiés sous un dossier jetable (`lintStage.mjs`), où la cible n'existe pas. Les alias sont ceux du
// `tsconfig.json` du dépôt, reposés sous `context.cwd`. Si le chemin obtenu porte un segment de DOSSIER
// `interne`, l'importeur doit vivre sous le parent du DERNIER de ces segments.
// Formes jugées : `import`, `import type`, `export … from`, `import()`, `typeof import()`, `require`,
// `import x = require()`. `export *` d'un interne n'est admis que DANS ce même dossier `interne` : la porte
// de `X/` réexporte par nom. Aucune exemption de test : le banc d'un interne vit sous `X/`.

import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aliasDuDepot } from './importGraph.mjs';

const SEGMENT = 'interne';
const RACINE_DU_DEPOT = fileURLToPath(new URL('../../../', import.meta.url));

const posix = (chemin) => chemin.split('\\').join('/');

/** Les alias du dépôt, cibles RELATIVES à sa racine (`src/` pour `@/`). */
const ALIAS = aliasDuDepot(RACINE_DU_DEPOT).map(({ prefixe, vers }) => ({ prefixe, vers: posix(relative(RACINE_DU_DEPOT, vers)) }));

/** Le chemin absolu que désigne `spec` depuis `importeur`, sous la racine `racine` ; `null` pour un paquet. */
export function cibleLexicale(importeur, spec, racine) {
  if (spec.startsWith('.')) return posix(resolve(dirname(importeur), spec));
  const alias = ALIAS.find(({ prefixe }) => spec.startsWith(prefixe));
  return alias ? posix(resolve(racine, alias.vers, spec.slice(alias.prefixe.length))) : null;
}

/** Le dossier dont `cible` est l'interne (parent du DERNIER segment `interne` de dossier), ou `null`. Un
 *  dernier segment sans extension peut nommer un dossier (`./interne` → son `index`). */
export function porteurDInterne(cible) {
  const segments = posix(cible).split('/');
  const dernier = extname(segments.at(-1)) ? segments.length - 2 : segments.length - 1;
  const i = segments.lastIndexOf(SEGMENT, dernier);
  return i > 0 ? segments.slice(0, i).join('/') : null;
}

const sous = (fichier, dossier) => posix(fichier).startsWith(`${dossier}/`);

/** Le verdict sur UN arc : `null` s'il est admis, sinon le message. */
export function verdictInterne(importeur, cible, { exportToutes = false, racine = '' } = {}) {
  const porteur = porteurDInterne(cible);
  if (porteur === null) return null;
  const lisible = (chemin) => (racine ? posix(relative(racine, chemin)) : posix(chemin));
  if (!sous(importeur, porteur)) {
    return `Mur interne (#2724) : \`${lisible(cible)}\` est interne à \`${lisible(porteur)}/\` — passer par la porte que ce dossier exporte, ou déplacer l'appelant sous \`${lisible(porteur)}/\`.`;
  }
  if (exportToutes && !sous(importeur, `${porteur}/${SEGMENT}`)) {
    return `Mur interne (#2724) : \`export *\` d'un interne ouvre tout le dossier — réexporter par nom (\`export { … } from\`).`;
  }
  return null;
}

/** Le texte d'un spécificateur littéral : chaîne, ou gabarit sans expression. */
const valeurDe = (source) => {
  if (!source) return null;
  if (typeof source.value === 'string') return source.value;
  if (source.type === 'TemplateLiteral' && source.expressions.length === 0) return source.quasis[0].value.cooked;
  return null;
};

export default {
  meta: { type: 'problem' },
  create(context) {
    const racine = context.cwd;
    const importeur = posix(context.filename);
    const juger = (node, spec, options) => {
      if (spec === null || !spec.includes(SEGMENT)) return;
      const cible = cibleLexicale(importeur, spec, racine);
      if (cible === null) return;
      const message = verdictInterne(importeur, cible, { ...options, racine });
      if (message) context.report({ node, message });
    };
    return {
      ImportDeclaration: (node) => juger(node, valeurDe(node.source)),
      ExportNamedDeclaration: (node) => juger(node, valeurDe(node.source)),
      ExportAllDeclaration: (node) => juger(node, valeurDe(node.source), { exportToutes: true }),
      ImportExpression: (node) => juger(node, valeurDe(node.source)),
      TSImportType: (node) => juger(node, valeurDe(node.source) ?? valeurDe(node.argument?.literal)),
      TSExternalModuleReference: (node) => juger(node, valeurDe(node.expression)),
      CallExpression: (node) => {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require' && node.arguments.length === 1) {
          juger(node, valeurDe(node.arguments[0]));
        }
      },
    };
  },
};

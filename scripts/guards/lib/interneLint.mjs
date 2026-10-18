// MUR « interne » (#2724) — le « package-private » que TypeScript n'a pas : un fichier sous `X/interne/`
// n'est importable que depuis `X/`. La frontière est la PLACE du fichier dans l'arbre, sans aucune liste.
//
// Le spécificateur se NORMALISE sans lire le disque : le pre-commit ne lint que les fichiers stagés,
// recopiés sous un dossier jetable (`lintStage.mjs`), où la cible n'existe pas. Les alias sont ceux du
// `tsconfig.json` du dépôt, reposés sous `context.cwd`. Si le chemin obtenu porte un segment de DOSSIER
// `interne`, l'importeur doit vivre sous le parent du DERNIER de ces segments.
// Formes jugées : `import`, `import type`, `export … from`, `export *`, `import()`, `typeof import()`,
// `require`, `module.require`, `import x = require()`, `createRequire(…)(…)`, `module.createRequire(…)(…)`
// et l'appel d'une liaison `createRequire(…)` (déclarée ou assignée, avant ou après l'appel),
// `import.meta.glob(motif | [motifs])` (motif `/…` lu depuis `context.cwd`, motif `!…` ignoré),
// `vi.importActual`, `vi.importMock`, `vi.mock`, `vi.doMock`, `vi.unmock`, `vi.doUnmock`, `vitest.mock`.
// Hors de portée, la règle ne lisant pas le disque : le spécificateur CALCULÉ (variable, gabarit à
// expression) et le motif de glob JOKER sans segment `interne` (`import.meta.glob('/src/zz/**/*.ts')`).
// Hors de portée, la règle suivant les requireurs par NOM : la liaison renommée ou réaffectée
// (`createRequire as cr`, `const r2 = req`, `var req = require`) et l'accès calculé (`module['require']`).
// Un interne ne se RÉEXPORTE que depuis son dossier `interne/` : `export … from`, `export *`, et
// `export { x }`, `export default x`, `export = x` d'une liaison importée d'un interne sont refusés
// ailleurs. La liaison réexportée EN VALEUR (`export const p = b`) est hors de portée.
// La porte de `X/` expose des fonctions qu'elle écrit elle-même.
// Aucune exemption de test : le banc d'un interne vit sous `X/`.

import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aliasDuDepot } from './importGraph.mjs';

const SEGMENT = 'interne';
const RACINE_DU_DEPOT = fileURLToPath(new URL('../../../', import.meta.url));
const OBJETS_VITEST = new Set(['vi', 'vitest']);
const METHODES_VITEST = new Set(['importActual', 'importMock', 'mock', 'doMock', 'unmock', 'doUnmock']);

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
const lisibleDepuis = (racine) => (chemin) => (racine ? posix(relative(racine, chemin)) : posix(chemin));

/** Le message d'une réexportation d'un interne de `porteur` hors de `porteur/interne/`. */
const messageReexport = (porteur, racine) => {
  const p = lisibleDepuis(racine)(porteur);
  return `Mur interne (#2724) : un interne de \`${p}/\` ne se réexporte que depuis \`${p}/${SEGMENT}/\` — la porte de \`${p}/\` expose une fonction qu'elle écrit elle-même.`;
};

/** Le verdict sur UN arc : `null` s'il est admis, sinon le message. `reexport` : l'arc réexporte la cible. */
export function verdictInterne(importeur, cible, { reexport = false, racine = '' } = {}) {
  const porteur = porteurDInterne(cible);
  if (porteur === null) return null;
  const lisible = lisibleDepuis(racine);
  if (!sous(importeur, porteur)) {
    return `Mur interne (#2724) : \`${lisible(cible)}\` est interne à \`${lisible(porteur)}/\` — passer par la porte que ce dossier exporte, ou déplacer l'appelant sous \`${lisible(porteur)}/\`.`;
  }
  if (reexport && !sous(importeur, `${porteur}/${SEGMENT}`)) return messageReexport(porteur, racine);
  return null;
}

/** Le texte d'un spécificateur littéral : chaîne, ou gabarit sans expression. */
const valeurDe = (source) => {
  if (!source) return null;
  if (typeof source.value === 'string') return source.value;
  if (source.type === 'TemplateLiteral' && source.expressions.length === 0) return source.quasis[0].value.cooked;
  return null;
};

const nomDe = (noeud) => noeud?.name ?? noeud?.value ?? null;

/** `createRequire(…)` ou `module.createRequire(…)`. */
const estCreateRequire = (appel) => appel?.type === 'CallExpression'
  && nomDe(appel.callee.type === 'MemberExpression' ? appel.callee.property : appel.callee) === 'createRequire';

const estImportMeta = (noeud) => noeud.type === 'MetaProperty' && noeud.meta.name === 'import' && noeud.property.name === 'meta';

export default {
  meta: { type: 'problem' },
  create(context) {
    const racine = context.cwd;
    const importeur = posix(context.filename);
    const cibleDe = (spec) => (spec === null || !spec.includes(SEGMENT) ? null : cibleLexicale(importeur, spec, racine));
    const jugerCible = (node, cible, options) => {
      if (cible === null) return;
      const message = verdictInterne(importeur, cible, { ...options, racine });
      if (message) context.report({ node, message });
    };
    const juger = (node, spec, options) => jugerCible(node, cibleDe(spec), options);
    const jugerMotif = (node, motif) => {
      if (motif === null || motif.startsWith('!') || !motif.includes(SEGMENT)) return;
      jugerCible(node, motif.startsWith('/') ? posix(resolve(racine, `.${motif}`)) : cibleLexicale(importeur, motif, racine));
    };

    /** Liaison locale importée d'un interne → son porteur, quand ce fichier n'est pas sous `porteur/interne/`. */
    const liaisons = new Map();
    const retenir = (spec, noms) => {
      const cible = cibleDe(spec);
      const porteur = cible === null ? null : porteurDInterne(cible);
      if (porteur !== null && !sous(importeur, `${porteur}/${SEGMENT}`)) for (const nom of noms) liaisons.set(nom, porteur);
    };
    const jugerLiaison = (node, nom) => {
      const porteur = liaisons.get(nom);
      if (porteur !== undefined) context.report({ node, message: messageReexport(porteur, racine) });
    };
    const requireurs = new Set(['require']);
    /** Appels d'un identifiant à spécificateur littéral : jugés à `Program:exit`, une fois connues toutes
     *  les liaisons `createRequire(…)` du fichier. */
    const appelsDIdentifiant = [];

    return {
      Program: (node) => {
        for (const declaration of node.body) {
          if (declaration.type === 'ImportDeclaration') retenir(valeurDe(declaration.source), declaration.specifiers.map((s) => s.local.name));
          const egal = declaration.type === 'ExportNamedDeclaration' ? declaration.declaration : declaration;
          if (egal?.type === 'TSImportEqualsDeclaration' && egal.moduleReference.type === 'TSExternalModuleReference') {
            retenir(valeurDe(egal.moduleReference.expression), [egal.id.name]);
          }
        }
      },
      ImportDeclaration: (node) => juger(node, valeurDe(node.source)),
      ExportNamedDeclaration: (node) => {
        if (node.source) return juger(node, valeurDe(node.source), { reexport: true });
        for (const s of node.specifiers) jugerLiaison(s, nomDe(s.local));
      },
      ExportAllDeclaration: (node) => juger(node, valeurDe(node.source), { reexport: true }),
      ExportDefaultDeclaration: (node) => {
        if (node.declaration.type === 'Identifier') jugerLiaison(node, node.declaration.name);
      },
      TSExportAssignment: (node) => {
        if (node.expression.type === 'Identifier') jugerLiaison(node, node.expression.name);
      },
      ImportExpression: (node) => juger(node, valeurDe(node.source)),
      TSImportType: (node) => juger(node, valeurDe(node.source) ?? valeurDe(node.argument?.literal)),
      TSImportEqualsDeclaration: (node) => {
        if (node.moduleReference.type !== 'TSExternalModuleReference') return;
        const reexport = node.isExport === true || node.parent?.type === 'ExportNamedDeclaration';
        juger(node, valeurDe(node.moduleReference.expression), { reexport });
      },
      VariableDeclarator: (node) => {
        if (node.id.type === 'Identifier' && estCreateRequire(node.init)) requireurs.add(node.id.name);
      },
      AssignmentExpression: (node) => {
        if (node.left.type === 'Identifier' && estCreateRequire(node.right)) requireurs.add(node.left.name);
      },
      CallExpression: (node) => {
        const { callee, arguments: [premier] } = node;
        if (callee.type === 'Identifier') {
          const spec = valeurDe(premier);
          if (spec !== null && spec.includes(SEGMENT)) appelsDIdentifiant.push({ node, nom: callee.name, spec });
          return;
        }
        if (estCreateRequire(callee)) return juger(node, valeurDe(premier));
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        const methode = nomDe(callee.property);
        if (callee.object.type === 'Identifier' && callee.object.name === 'module' && methode === 'require') {
          return juger(node, valeurDe(premier));
        }
        if (callee.object.type === 'Identifier' && OBJETS_VITEST.has(callee.object.name) && METHODES_VITEST.has(methode)) {
          return juger(node, valeurDe(premier));
        }
        if (estImportMeta(callee.object) && methode === 'glob') {
          for (const motif of premier?.type === 'ArrayExpression' ? premier.elements : [premier]) jugerMotif(node, valeurDe(motif));
        }
      },
      'Program:exit': () => {
        for (const { node, nom, spec } of appelsDIdentifiant) if (requireurs.has(nom)) juger(node, spec);
      },
    };
  },
};

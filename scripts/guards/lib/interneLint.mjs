// MUR « interne » (#2724) — le « package-private » que TypeScript n'a pas : un fichier sous `X/interne/`
// n'est importable que depuis `X/`. La frontière est la PLACE du fichier dans l'arbre, sans aucune liste.
//
// Le spécificateur se NORMALISE sans lire le disque : le pre-commit ne lint que les fichiers stagés,
// recopiés sous un dossier jetable (`lintStage.mjs`), où la cible n'existe pas. Les alias sont ceux du
// `tsconfig.json` du dépôt, reposés sous `context.cwd`. Si le chemin obtenu porte un segment de DOSSIER
// `interne`, l'importeur doit vivre sous le parent du DERNIER de ces segments.
// Formes jugées : tous les arcs d'import de `arcsDImport.mjs`, et leurs limites ; un motif
// d'`import.meta.glob` `/…` se lit sous `context.cwd`, un motif `!…` est ignoré. Hors de portée, la
// règle ne lisant pas le disque : le motif de glob JOKER sans segment `interne`
// (`import.meta.glob('/src/zz/**/*.ts')`).
// Un interne ne se RÉEXPORTE que depuis son dossier `interne/` : `export … from`, `export *`, et
// `export { x }`, `export default x`, `export = x` d'une liaison importée d'un interne sont refusés
// ailleurs. La liaison réexportée EN VALEUR (`export const p = b`) est hors de portée.
// La porte de `X/` expose des fonctions qu'elle écrit elle-même.
// Aucune exemption de test : le banc d'un interne vit sous `X/`.

import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aliasDuDepot } from './importGraph.mjs';
import { nomDe, valeurDe, visiteurDArcs } from './arcsDImport.mjs';

const SEGMENT = 'interne';
const RACINE_DU_DEPOT = fileURLToPath(new URL('../../../', import.meta.url));

export const posix = (chemin) => chemin.split('\\').join('/');

/** Les alias du dépôt, cibles RELATIVES à sa racine (`src/` pour `@/`). */
const ALIAS = aliasDuDepot(RACINE_DU_DEPOT).map(({ prefixe, vers }) => ({ prefixe, vers: posix(relative(RACINE_DU_DEPOT, vers)) }));

/** Le chemin absolu que désigne `spec` depuis `importeur`, sous la racine `racine` ; `null` pour un paquet.
 *  Un `spec` `/…` part de `racine` (Vite). */
export function cibleLexicale(importeur, spec, racine) {
  if (spec.startsWith('.')) return posix(resolve(dirname(importeur), spec));
  if (spec.startsWith('/')) return posix(resolve(racine, `.${spec}`));
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
      jugerCible(node, cibleLexicale(importeur, motif, racine));
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
    const arcs = visiteurDArcs({ surArc: (node, spec, { reexport }) => juger(node, spec, { reexport }), surMotif: jugerMotif });

    return {
      ...arcs,
      Program: (node) => {
        for (const declaration of node.body) {
          if (declaration.type === 'ImportDeclaration') retenir(valeurDe(declaration.source), declaration.specifiers.map((s) => s.local.name));
          const egal = declaration.type === 'ExportNamedDeclaration' ? declaration.declaration : declaration;
          if (egal?.type === 'TSImportEqualsDeclaration' && egal.moduleReference.type === 'TSExternalModuleReference') {
            retenir(valeurDe(egal.moduleReference.expression), [egal.id.name]);
          }
        }
      },
      ExportNamedDeclaration: (node) => {
        arcs.ExportNamedDeclaration(node);
        if (!node.source) for (const s of node.specifiers) jugerLiaison(s, nomDe(s.local));
      },
      ExportDefaultDeclaration: (node) => {
        if (node.declaration.type === 'Identifier') jugerLiaison(node, node.declaration.name);
      },
      TSExportAssignment: (node) => {
        if (node.expression.type === 'Identifier') jugerLiaison(node, node.expression.name);
      },
    };
  },
};

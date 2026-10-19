// Les ARCS D'IMPORT d'un fichier, énumérés une seule fois pour les murs qui jugent un arc
// (`murs/interne`, `murs/purete-imports` ; #2724, #2882). Un arc est un spécificateur LITTÉRAL et le
// nœud qui le porte, avec deux qualités : `reexport` (l'arc réexporte la cible) et `typeSeul` (l'arc
// s'efface à la compilation : `import type`, `import { type X }` tout-type, `export type … from`,
// `typeof import()`, `import('…').T`).
// Formes : `import`, `export … from`, `export *`, `import()`, `typeof import()`, `require`,
// `module.require`, `import x = require()`, `createRequire(…)(…)`, `module.createRequire(…)(…)` et
// l'appel d'une liaison `createRequire(…)` (déclarée ou assignée, avant ou après l'appel),
// `import.meta.glob(motif | [motifs])` (rendu au juge des motifs), `vi.importActual`, `vi.importMock`,
// `vi.mock`, `vi.doMock`, `vi.unmock`, `vi.doUnmock`, `vitest.mock`.
// Hors de portée : le spécificateur CALCULÉ (variable, gabarit à expression), la liaison renommée ou
// réaffectée d'un requireur (`createRequire as cr`, `const r2 = req`, `var req = require`) et l'accès calculé (`module['require']`).

const OBJETS_VITEST = new Set(['vi', 'vitest']);
const METHODES_VITEST = new Set(['importActual', 'importMock', 'mock', 'doMock', 'unmock', 'doUnmock']);

/** Le texte d'un spécificateur littéral : chaîne, ou gabarit sans expression. */
export const valeurDe = (source) => {
  if (!source) return null;
  if (typeof source.value === 'string') return source.value;
  if (source.type === 'TemplateLiteral' && source.expressions.length === 0) return source.quasis[0].value.cooked;
  return null;
};

export const nomDe = (noeud) => noeud?.name ?? noeud?.value ?? null;

/** `createRequire(…)` ou `module.createRequire(…)`. */
const estCreateRequire = (appel) => appel?.type === 'CallExpression'
  && nomDe(appel.callee.type === 'MemberExpression' ? appel.callee.property : appel.callee) === 'createRequire';

const estImportMeta = (noeud) => noeud.type === 'MetaProperty' && noeud.meta.name === 'import' && noeud.property.name === 'meta';

/** La déclaration s'efface-t-elle à la compilation ? Mot-clé `type`, ou spécificateurs tous `type`. */
const efface = (node) => node.importKind === 'type' || node.exportKind === 'type'
  || (node.specifiers?.length > 0 && node.specifiers.every((s) => s.importKind === 'type' || s.exportKind === 'type'));

/** Les visiteurs qui appellent `surArc(node, spec, { reexport, typeSeul })` pour chaque arc littéral, et
 *  `surMotif(node, motif)` pour chaque motif d'`import.meta.glob`. */
export function visiteurDArcs({ surArc, surMotif = () => {} }) {
  const arc = (node, source, { reexport = false, typeSeul = false } = {}) => {
    const spec = valeurDe(source);
    if (spec !== null) surArc(node, spec, { reexport, typeSeul });
  };
  const requireurs = new Set(['require']);
  /** Appels d'un identifiant à spécificateur littéral : jugés à `Program:exit`, une fois connues toutes
   *  les liaisons `createRequire(…)` du fichier. */
  const appelsDIdentifiant = [];
  return {
    ImportDeclaration: (node) => arc(node, node.source, { typeSeul: efface(node) }),
    ExportNamedDeclaration: (node) => {
      if (node.source) arc(node, node.source, { reexport: true, typeSeul: efface(node) });
    },
    ExportAllDeclaration: (node) => arc(node, node.source, { reexport: true, typeSeul: node.exportKind === 'type' }),
    ImportExpression: (node) => arc(node, node.source),
    TSImportType: (node) => {
      const spec = valeurDe(node.source) ?? valeurDe(node.argument?.literal);
      if (spec !== null) surArc(node, spec, { reexport: false, typeSeul: true });
    },
    TSImportEqualsDeclaration: (node) => {
      if (node.moduleReference.type !== 'TSExternalModuleReference') return;
      const reexport = node.isExport === true || node.parent?.type === 'ExportNamedDeclaration';
      arc(node, node.moduleReference.expression, { reexport, typeSeul: node.importKind === 'type' });
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
        if (valeurDe(premier) !== null) appelsDIdentifiant.push({ node, nom: callee.name, source: premier });
        return;
      }
      if (estCreateRequire(callee)) return arc(node, premier);
      if (callee.type !== 'MemberExpression' || callee.computed) return;
      const methode = nomDe(callee.property);
      if (callee.object.type === 'Identifier' && callee.object.name === 'module' && methode === 'require') return arc(node, premier);
      if (callee.object.type === 'Identifier' && OBJETS_VITEST.has(callee.object.name) && METHODES_VITEST.has(methode)) return arc(node, premier);
      if (estImportMeta(callee.object) && methode === 'glob') {
        for (const motif of premier?.type === 'ArrayExpression' ? premier.elements : [premier]) surMotif(node, valeurDe(motif));
      }
    },
    'Program:exit': () => {
      for (const { node, nom, source } of appelsDIdentifiant) if (requireurs.has(nom)) arc(node, source);
    },
  };
}

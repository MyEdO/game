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
// Un spécificateur CALCULÉ (variable, gabarit à expression, étalement, motif de glob) n'est pas un arc : chacune de
// ces formes le rend au juge des chargements que la lecture ne suit pas (`surCalcule`), hors de l'`import()` qu'un
// `vi.mock` prend en argument, lui-même un arc. Le même juge reçoit, quand l'appelant le fournit avec la portée
// d'oxlint, toute référence à un CHARGEUR (`vi`, `vitest`, `require`, `module` globaux ou importés de leur module,
// `createRequire` importé, chaque liaison `createRequire(…)` ; `genreDuChargeur`) employée autrement qu'appelée, ou que
// comme objet d'un membre nommé, appelé s'il charge (`emploiLisible`) : liée ou passée comme valeur, déstructurée, lue
// par un accès calculé (`vi['importActual']`, `module['require']`) ; tout chargeur importé sous un autre nom
// (`import { vi as v }`) ; et tout `createRequire(…)` dont le rendu n'est ni appelé, ni lié à un nom, ni lu par
// `.resolve`.

/** Les objets et méthodes de Vitest qui chargent un module. Le graphe d'imports (`importGraph.mjs`) les lit aussi. */
export const OBJETS_VITEST = new Set(['vi', 'vitest']);
export const METHODES_VITEST = new Set(['importActual', 'importMock', 'mock', 'doMock', 'unmock', 'doUnmock']);


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

/** Les nœuds dont un identifiant est un nom de TYPE, effacé à la compilation. */
const POSITIONS_DE_TYPE = new Set(['TSTypeQuery', 'TSQualifiedName', 'TSTypeReference']);

/** Les modules qui exportent un chargeur : Vitest, et `createRequire` de Node. */
const MODULES_CHARGEURS = new Set(['vitest', 'node:module', 'module']);

/** Le genre du chargeur que désigne la référence `n` (`portee` : le `sourceCode` d'oxlint) : `vitest` (`vi`,
 *  `vitest`), `require` (`require` global, liaison `createRequire(…)`), `createRequire`, `module` (global, ou espace de
 *  `node:module`) ; `null` pour toute autre liaison, locale au fichier. */
function genreDuChargeur(n, portee, requireurs) {
  let reference = null;
  for (let s = portee.getScope(n); s && !reference; s = s.upper) reference = s.references.find((r) => r.identifier === n) ?? null;
  if (!reference || !reference.isRead()) return null;
  const variable = reference.resolved;
  if (!variable || variable.defs.length === 0) return OBJETS_VITEST.has(n.name) ? 'vitest' : ['require', 'createRequire', 'module'].includes(n.name) ? n.name : null;
  const [def] = variable.defs;
  if (def?.type === 'ImportBinding' && MODULES_CHARGEURS.has(def.parent?.source?.value)) {
    if (def.node.type !== 'ImportSpecifier') return def.parent.source.value === 'vitest' ? 'vitest' : 'module';
    const importe = nomDe(def.node.imported);
    return OBJETS_VITEST.has(importe) ? 'vitest' : importe === 'createRequire' ? 'createRequire' : null;
  }
  return requireurs.has(n.name) ? 'require' : null;
}

/** Les membres qu'un chargeur de chaque genre CHARGE : leur seul emploi lisible est d'être appelés. */
const MEMBRES_QUI_CHARGENT = { vitest: METHODES_VITEST, module: new Set(['require', 'createRequire']) };
/** Les membres d'un chargeur de chaque genre qu'un emploi peut lire sans charger ; tout autre membre est refusé. */
const MEMBRES_INERTES = { require: new Set(['resolve']), createRequire: new Set() };

/** L'emploi de la référence `n`, un chargeur du genre `genre`, laisse-t-il le chargement lisible : appelé, objet
 *  d'un membre nommé (appelé s'il charge), nom de type ? */
function emploiLisible(n, genre) {
  const p = n.parent;
  if (POSITIONS_DE_TYPE.has(p.type)) return true;
  if (p.type === 'CallExpression') return p.callee === n;
  if (p.type !== 'MemberExpression' || p.object !== n || p.computed) return false;
  const membre = nomDe(p.property);
  if (genre in MEMBRES_INERTES) return MEMBRES_INERTES[genre].has(membre);
  return !MEMBRES_QUI_CHARGENT[genre].has(membre) || (p.parent.type === 'CallExpression' && p.parent.callee === p);
}

/** Le rendu d'un `createRequire(…)` est-il appelé, lié à un nom, ou lu par `.resolve` ? */
const requireurLisible = (appel) => {
  const p = appel.parent;
  return (p.type === 'VariableDeclarator' && p.init === appel && p.id.type === 'Identifier')
    || (p.type === 'AssignmentExpression' && p.right === appel && p.left.type === 'Identifier')
    || (p.type === 'CallExpression' && p.callee === appel)
    || (p.type === 'MemberExpression' && p.object === appel && !p.computed && nomDe(p.property) === 'resolve');
};

/** Les visiteurs qui appellent `surArc(node, spec, { reexport, typeSeul })` pour chaque arc littéral,
 *  `surMotif(node, motif)` pour chaque motif littéral d'`import.meta.glob`, et, si l'appelant le fournit,
 *  `surCalcule(node)` pour chaque chargement que la lecture ne suit pas (spécificateur calculé, chargeur détourné) ;
 *  `portee` : le `sourceCode` d'oxlint, qui dit à quelle liaison une référence se résout. */
export function visiteurDArcs({ surArc, surMotif = () => {}, surCalcule, portee }) {
  const calcule = surCalcule ?? (() => {});
  const arc = (node, source, { reexport = false, typeSeul = false } = {}) => {
    const spec = valeurDe(source);
    if (spec !== null) surArc(node, spec, { reexport, typeSeul });
    else if (source && source.type !== 'ImportExpression') calcule(node);
  };
  const requireurs = new Set(['require']);
  /** Appels d'un identifiant à argument : jugés à `Program:exit`, une fois connues toutes les liaisons
   *  `createRequire(…)` du fichier. */
  const appelsDIdentifiant = [];
  /** Les identifiants de chargeur possible, jugés à `Program:exit` (`genreDuChargeur`, `emploiLisible`). */
  const emplois = [];
  const juges = {
    Identifier: (node) => { emplois.push(node); },
    CallExpression: (node) => { if (estCreateRequire(node) && !requireurLisible(node)) calcule(node); },
    ImportSpecifier: (node) => {
      const source = node.parent.source.value;
      const importe = nomDe(node.imported);
      if (MODULES_CHARGEURS.has(source) && (OBJETS_VITEST.has(importe) || importe === 'createRequire') && importe !== nomDe(node.local)) calcule(node);
    },
  };
  const visiteurs = {
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
        if (premier) appelsDIdentifiant.push({ node, nom: callee.name, source: premier });
        return;
      }
      if (estCreateRequire(callee)) return arc(node, premier);
      if (callee.type !== 'MemberExpression' || callee.computed) return;
      const methode = nomDe(callee.property);
      if (callee.object.type === 'Identifier' && callee.object.name === 'module' && methode === 'require') return arc(node, premier);
      if (callee.object.type === 'Identifier' && OBJETS_VITEST.has(callee.object.name) && METHODES_VITEST.has(methode)) return arc(node, premier);
      if (estImportMeta(callee.object) && methode === 'glob') {
        for (const motif of premier?.type === 'ArrayExpression' ? premier.elements : [premier]) {
          const valeur = valeurDe(motif);
          if (valeur === null) calcule(node);
          else surMotif(node, valeur);
        }
      }
    },
    'Program:exit': () => {
      for (const { node, nom, source } of appelsDIdentifiant) if (requireurs.has(nom)) arc(node, source);
      if (!surCalcule) return;
      for (const n of emplois) {
        const genre = genreDuChargeur(n, portee, requireurs);
        if (genre !== null && !emploiLisible(n, genre)) calcule(n);
      }
    },
  };
  if (!surCalcule) return visiteurs;
  return {
    ...visiteurs,
    Identifier: juges.Identifier,
    ImportSpecifier: juges.ImportSpecifier,
    CallExpression: (node) => { visiteurs.CallExpression(node); juges.CallExpression(node); },
  };
}

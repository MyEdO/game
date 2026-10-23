// MUR « état de module » (#2907) : un module du moteur, du noyau, des données ou des scénarios ne garde aucun
// état entre deux appels qui puisse fabriquer un id d'une partie à l'autre — un id neuf vient de la fabrique de
// l'hôte (`FabriqueDId`, `src/lib/entityId.ts`), un compte de diagnostic d'une `sonde` (`src/lib/sonde.ts`).
// Formes jugées :
//   · quand la RACINE de la cible (`x`, `x.y`, `x[k]`, `M().y` d'un produit de fabrique) se lie au module ou
//     au global : `++`/`--`, une affectation composée arithmétique (`+=`, `-=`, `*=`…, pas `||=`, `&&=`,
//     `??=`), et l'affectation qui se reprend (`x = x + 1`) ;
//   · un `let` de premier niveau initialisé d'un nombre ;
//   · une FABRIQUE À FERMETURE (`estFabriqueAFermeture`) évaluée au premier niveau du module (appel, alias,
//     IIFE comprise) : importée sous un nom de `FABRIQUES_A_FERMETURE`, ou déclarée dans le fichier même.
//     `FABRIQUES_ADMISES` en exempte les mémos purs, et la `sonde` sous sa seule forme : `const X = sonde()`,
//     `X` lu par `X.passer()` seulement (la sonde ne rend aucun compte à son porteur).
// ANGLES MORTS : l'alias pris DANS une fonction (`const o = ETAT; o.n++`), le compte derrière une fonction du
// module (`cellule(cle).v += 1`, le témoin d'édition des datasets de `src/data/versionDataset.ts`), la méthode
// qui mute (`Map#set`, `Array#push`), une fabrique à fermeture d'une forme que `estFabriqueAFermeture` ne
// reconnaît pas.

const ARITHMETIQUES = new Set(['+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=']);

/** Les fabriques à fermeture de `src/` (hors tests), par nom : l'inventaire que `estFabriqueAFermeture` relève,
 *  tenu à l'identique par le banc `src/etat-de-module-lint.test.ts`. Une fabrique neuve s'y inscrit — sinon le
 *  banc rougit — et son évaluation au premier niveau d'un module sous le mur est refusée. */
export const FABRIQUES_A_FERMETURE = Object.freeze([
  'brancherImagesPilotees', 'brancherLesSons', 'composeur', 'computeLightField', 'creerPartie', 'creerPercage', 'fabriqueDuClone',
  'fabriqueEnSequence', 'installAnimTracks', 'libreDEspece', 'lotEnregistreur', 'lotRejoueur', 'makeLosMemo',
  'makeRNG', 'memoByRef', 'memoParVersion', 'mountedSvg', 'outdoorLookup', 'posePartagee', 'poserDecalque',
  'poserLampesDuCiel', 'realFloorAt', 'rigGroundTilt', 'seedStream', 'simulerRasterisation', 'tenueDesJetons',
  'visibilityField',
]);

/** Les fabriques dont l'évaluation de premier niveau est admise, et pourquoi. */
export const FABRIQUES_ADMISES = Object.freeze({
  memoParVersion: 'mémo d’une dérivation PURE des données, invalidé à leur version : même version, même valeur',
  memoByRef: 'mémo d’une dérivation PURE de son argument, keyé par référence : même argument, même valeur',
});

const MESSAGE = (cible) => `État de module (#2907) : \`${cible}\` est un compte numérique de module muté — il survit d'une partie à l'autre. Un id neuf vient de la fabrique de l'hôte (\`FabriqueDId\`, \`src/lib/entityId.ts\`), un compte de diagnostic d'une \`sonde\` (\`src/lib/sonde.ts\`).`;
const MESSAGE_LET = (nom) => `État de module (#2907) : \`let ${nom}\` de premier niveau initialisé d'un nombre — un compte de module survit d'une partie à l'autre. Un id neuf vient de la fabrique de l'hôte (\`FabriqueDId\`, \`src/lib/entityId.ts\`), un compte de diagnostic d'une \`sonde\` (\`src/lib/sonde.ts\`) ; une valeur fixe est une \`const\`.`;
const MESSAGE_FABRIQUE = (nom) => `État de module (#2907) : la fabrique à fermeture \`${nom}\` est évaluée au premier niveau du module — son état survit d'une partie à l'autre. Un id neuf vient de la fabrique de l'hôte (\`idNeuf\`, \`src/noyau/plateforme.ts\`) ; une fabrique s'appelle DANS la fonction qui s'en sert.`;
const MESSAGE_SONDE = `État de module (#2907) : une sonde de module s'écrit \`const X = sonde()\` et ne se lit que par \`X.passer()\` — son compte ne se relit que dans un test (\`passagesDe\`, \`src/lib/sonde.ts\`).`;

const FONCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const estFonction = (n) => n != null && (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');
const rendUneFonction = (n) => estFonction(n)
  || (n?.type === 'ObjectExpression' && n.properties.some((p) => p.method || estFonction(p.value)));
const DECLARATION_MUTABLE = (d) => d.kind !== 'const'
  || d.declarations.some((v) => ['ObjectExpression', 'ArrayExpression', 'NewExpression'].includes(v.init?.type));

/** FABRIQUE À FERMETURE : une fonction dont le corps déclare un état (`let`/`var`, ou `const` d'un objet, d'un
 *  tableau, d'une instance) et qui rend une fonction ou un objet de fonctions — chaque appel en fait un
 *  détenteur d'état. Prédicat partagé du mur et de l'inventaire (`FABRIQUES_A_FERMETURE`). */
export function estFabriqueAFermeture(fn) {
  if (!fn || fn.body?.type !== 'BlockStatement') return false;
  const corps = fn.body.body;
  return corps.some((s) => s.type === 'VariableDeclaration' && DECLARATION_MUTABLE(s))
    && corps.some((s) => s.type === 'ReturnStatement' && rendUneFonction(s.argument));
}

/** Les fonctions de PREMIER NIVEAU d'un programme ESTree : `[nom, nœud de déclaration, fonction]`. */
export function fonctionsDePremierNiveau(programme) {
  const out = [];
  for (const brut of programme.body) {
    const s = (brut.type === 'ExportNamedDeclaration' || brut.type === 'ExportDefaultDeclaration') && brut.declaration ? brut.declaration : brut;
    if (s.type === 'FunctionDeclaration' && s.id) out.push([s.id.name, s, s]);
    if (s.type === 'VariableDeclaration') for (const d of s.declarations) if (d.id.type === 'Identifier' && estFonction(d.init)) out.push([d.id.name, d, d.init]);
  }
  return out;
}

/** L'identifiant racine d'une cible (`x`, `x.y.z`, `x[k]`, `M().y`), ou `null` (`this.n`). Un appel n'est
 *  traversé que vers un PRODUIT de fabrique (`produit`) : le mémo `M` de `const M = memoParVersion(…)` rend la
 *  même valeur à chaque lecture, la muter est muter le module. */
function racine(n, produit) {
  let courant = n;
  for (;;) {
    if (courant.type === 'MemberExpression') courant = courant.object;
    else if (courant.type === 'CallExpression' && courant.callee.type === 'Identifier' && produit(courant.callee)) courant = courant.callee;
    else break;
  }
  return courant.type === 'Identifier' ? courant : null;
}

/** `node` s'évalue-t-il au chargement du module : hors de toute fonction, sauf celle qu'on appelle sur place
 *  (IIFE), et hors des initialiseurs de champ d'instance ? */
function auPremierNiveau(node) {
  for (let enfant = node, parent = node.parent; parent; enfant = parent, parent = parent.parent) {
    if (FONCTIONS.has(parent.type) && !(parent.parent?.type === 'CallExpression' && parent.parent.callee === parent)) return false;
    if (parent.type === 'PropertyDefinition' && !parent.static && parent.value === enfant) return false;
  }
  return true;
}

const estNombre = (n) => (n?.type === 'Literal' && typeof n.value === 'number')
  || (n?.type === 'UnaryExpression' && n.operator === '-' && estNombre(n.argument));

const nomImporte = (spec) => (spec.imported?.type === 'Identifier' ? spec.imported.name : spec.imported?.value);
const REFUSEES = new Set(FABRIQUES_A_FERMETURE.filter((n) => !Object.hasOwn(FABRIQUES_ADMISES, n)));

const etatDeModule = {
  meta: { type: 'problem' },
  create(context) {
    const source = context.sourceCode;
    /** La liaison de `id` vit au module ou au global (non résolue comprise). */
    const deModule = (node, id) => {
      for (let portee = source.getScope(node); portee; portee = portee.upper) {
        const liaison = portee.set.get(id.name);
        if (liaison) return liaison.scope.type === 'module' || liaison.scope.type === 'global';
      }
      return true;
    };
    /** `id` se lie-t-il à une `const` de module initialisée d'un appel (le produit d'une fabrique) ? */
    const produit = (id) => {
      for (let portee = source.getScope(id); portee; portee = portee.upper) {
        const liaison = portee.set.get(id.name);
        if (!liaison) continue;
        const def = liaison.defs[0]?.node;
        return liaison.scope.type === 'module' && def?.type === 'VariableDeclarator' && def.init?.type === 'CallExpression'
          && def.parent?.kind === 'const';
      }
      return false;
    };
    const juger = (node, cible) => {
      const id = racine(cible, produit);
      if (id && deModule(node, id)) context.report({ node, message: MESSAGE(source.getText(cible)) });
    };
    const seReprend = (droite, gauche) => droite.type === 'BinaryExpression'
      && [droite.left, droite.right].some((operande) => source.getText(operande) === source.getText(gauche));
    /** Chaque référence de premier niveau à la liaison déclarée par `decl` est refusée. */
    const refuserLesEvaluations = (decl, nom) => {
      for (const v of source.getDeclaredVariables(decl)) {
        for (const ref of v.references) {
          if (ref.init || !ref.isRead() || ref.identifier.parent?.type === 'ExportSpecifier') continue;
          if (auPremierNiveau(ref.identifier)) context.report({ node: ref.identifier, message: MESSAGE_FABRIQUE(nom) });
        }
      }
    };
    /** `appel` est-il l'initialiseur d'une `const X` de premier niveau dont toute lecture est `X.passer()` ? */
    const sondeBienFormee = (appel) => {
      const d = appel.parent;
      if (d?.type !== 'VariableDeclarator' || d.init !== appel || d.id.type !== 'Identifier') return false;
      if (d.parent?.kind !== 'const') return false;
      return source.getDeclaredVariables(d).every((v) => v.references.every((ref) => {
        if (ref.init) return true;
        const p = ref.identifier.parent;
        if (p?.type === 'ExportSpecifier') return true;
        return p?.type === 'MemberExpression' && p.object === ref.identifier && !p.computed && p.property.name === 'passer'
          && p.parent?.type === 'CallExpression' && p.parent.callee === p && p.parent.arguments.length === 0;
      }));
    };
    const jugerLesSondes = (spec) => {
      for (const v of source.getDeclaredVariables(spec)) {
        for (const ref of v.references) {
          const id = ref.identifier;
          if (id.parent?.type === 'ExportSpecifier' || !auPremierNiveau(id)) continue;
          const appel = id.parent?.type === 'CallExpression' && id.parent.callee === id ? id.parent : null;
          if (!appel || !sondeBienFormee(appel)) context.report({ node: id, message: MESSAGE_SONDE });
        }
      }
    };
    return {
      Program(programme) {
        for (const [nom, decl] of fonctionsDePremierNiveau(programme)) {
          const fn = decl.type === 'VariableDeclarator' ? decl.init : decl;
          if (estFabriqueAFermeture(fn) && !Object.hasOwn(FABRIQUES_ADMISES, nom)) refuserLesEvaluations(decl, nom);
        }
      },
      ImportDeclaration(node) {
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier' && nomImporte(spec) === 'sonde') jugerLesSondes(spec);
          else if (spec.type === 'ImportSpecifier' && REFUSEES.has(nomImporte(spec))) refuserLesEvaluations(spec, nomImporte(spec));
          else if (spec.type === 'ImportNamespaceSpecifier') {
            for (const v of source.getDeclaredVariables(spec)) {
              for (const ref of v.references) {
                const p = ref.identifier.parent;
                const nom = p?.type === 'MemberExpression' && p.object === ref.identifier && !p.computed ? p.property.name : null;
                if (nom && (REFUSEES.has(nom) || nom === 'sonde') && auPremierNiveau(ref.identifier)) context.report({ node: p, message: nom === 'sonde' ? MESSAGE_SONDE : MESSAGE_FABRIQUE(nom) });
              }
            }
          }
        }
      },
      UpdateExpression(node) { juger(node, node.argument); },
      AssignmentExpression(node) {
        if (ARITHMETIQUES.has(node.operator) || (node.operator === '=' && seReprend(node.right, node.left))) juger(node, node.left);
      },
      VariableDeclaration(node) {
        if (node.kind !== 'let') return;
        const parent = node.parent?.type === 'ExportNamedDeclaration' ? node.parent.parent : node.parent;
        if (parent?.type !== 'Program') return;
        for (const d of node.declarations) {
          if (d.id.type === 'Identifier' && estNombre(d.init)) context.report({ node: d, message: MESSAGE_LET(d.id.name) });
        }
      },
    };
  },
};

export default etatDeModule;

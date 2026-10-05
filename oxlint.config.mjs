import js from '@eslint/js';
import globals from 'globals';
import { fileURLToPath } from 'node:url';

const MARQUES = '/^(Built(CascadeStep|RollRow)|PlayerText|AdresseDeCreation)$/';
const MSG_FORGE = 'Marque d’origine (#1262/#1318) : forger un `Built*`/`PlayerText`/`AdresseDeCreation` par cast rend la marque décorative. Passer par un constructeur de la porte (rollSeam), par `revealToStep`, par un minteur de texte (`t`, `refLabel`, `composeRollLabel`), ou par une fabrique d’adresse (`adresseDeCreation`, `adresseLue`).';

const VERROU_MARQUES = [{
  selector: `TSAsExpression TSTypeReference > Identifier[name=${MARQUES}]`,
  message: MSG_FORGE,
}, {
  selector: `TSTypeAssertion TSTypeReference > Identifier[name=${MARQUES}]`,
  message: MSG_FORGE,
}, {
  selector: [
    `TSTypeAliasDeclaration > TSTypeReference > Identifier[name=${MARQUES}]`,
    `TSTypeAliasDeclaration > TSArrayType > TSTypeReference > Identifier[name=${MARQUES}]`,
    `TSTypeAliasDeclaration > TSTypeOperator > TSArrayType > TSTypeReference > Identifier[name=${MARQUES}]`,
    `TSTypeAliasDeclaration > TSUnionType > TSTypeReference > Identifier[name=${MARQUES}]`,
    `TSTypeAliasDeclaration > TSUnionType > TSArrayType > TSTypeReference > Identifier[name=${MARQUES}]`,
    `TSTypeAliasDeclaration > TSUnionType > TSTypeOperator > TSArrayType > TSTypeReference > Identifier[name=${MARQUES}]`,
  ].join(', '),
  message: 'Marque d’origine (#1262/#1318) : aliaser un `Built*`/`PlayerText` rouvre la route de forge par cast (le verrou filtre par NOM). Nommer la marque au site, ou passer par un minteur.',
}, {

  selector: [
    'Literal[value=/^(espece:talents:[0-9]+(:tirage:[0-9]+)?|carriere:competences:[0-9]+|ajout:[^:]+|signe:[0-9]+|dotation:[0-9]+([.][0-9]+)*)$/]',
    'TemplateElement[value.cooked=/^(espece:talents|carriere:competences|ajout|signe|dotation):/]',
  ].join(', '),
  message: 'Marque d’origine (#1988) : une adresse de création écrite en texte échappe à la marque `AdresseDeCreation` — le typecheck laisse une clé littérale entrer dans un Record par un objet intermédiaire. Passer par une fabrique `adresseDeCreation`, ou par `adresseLue` pour une clé lue.',
}, {

  selector: [
    'Literal[value=/^(espece|carriere|ajout|signe|dotation|espece:talents|carriere:competences):$/]',
    'TemplateLiteral[expressions.length=0] > TemplateElement[value.cooked=/^(espece|carriere|ajout|signe|dotation|espece:talents|carriere:competences):$/]',
  ].join(', '),
  message: 'Marque d’origine (#1988) : un préfixe de famille d’adresse de création écrit en texte recopie la grammaire hors de `engine/adresseDeCreation.ts`. Demander au module : `deFamille`, `tirageSous`.',
}];

const VERROU_CONTENEUR = [{
  selector: "CallExpression[callee.object.name='Object'][callee.property.name='assign'] > ObjectExpression > Property[key.name='label']",
  message: 'Contournement de conteneur (#1318 T1) : `Object.assign` ne vérifie pas le type de la cible — un `label` y rentre en `string` et blanchit la marque. Déclarer le libellé à la porte (spec), ou passer par un minteur.',
}, {
  selector: [
    'TSAsExpression TSTypeReference > Identifier[name=/^CascadeStep$/]',
    'TSTypeAssertion TSTypeReference > Identifier[name=/^CascadeStep$/]',
  ].join(', '),
  message: 'Contournement de conteneur (#1318 T2) : caster en `CascadeStep` fait entrer un littéral entier, `label` compris. Passer par une porte du seam (`monoStep`/`tableStep`/`choiceStep`/`quantityStep`/`displayStep`/`bandStep`/`hostStep`).',
}];

const VERROU_DIALECTE = [{
  selector: "MemberExpression[property.name='ScriptKind']",
  message: 'Dialecte de parse (#1679 L3b) : le `ts.ScriptKind` se déduit de l’extension par `scriptKindDe` (`scripts/guards/lib/dialecte.mjs`) — une table recopiée au site fait lire un `.mts` en TS ici et en JS là, et un scan silencieusement faux ne se voit pas.',
}];

const MARCHE_BRUTE = ['readdirSync', 'readdir', 'opendirSync', 'opendir', 'globSync', 'glob'];
const MSG_ORDRE_TOTAL =
  'Ordre total (#1679 L3b) : lister un dossier passe par `listerDossier`/`listerArbre` (`scripts/guards/lib/lister.mjs`), et LIRE un corpus source par `readCorpus` (`scripts/guards/lib/sourceCorpus.mjs`) — un listing brut suit l’ordre du système de fichiers et périme le doc dérivé sur l’autre OS.';
const MSG_LOCALE_COMPARE =
  'Ordre total (#1679 L3b) : `localeCompare`, `toLocale*` et `Intl` suivent la locale et l’ICU du processus — le doc dérivé change avec la machine. Comparer par `parUnitesDeCode` (chemin, id, clé) ou `parLibelle` (libellé lu par le joueur), de `src/lib/ordre.mjs` ; formater sans locale.';

const ORDRE_TOTAL_IMPORTS = {
  paths: ['fs', 'node:fs', 'fs/promises', 'node:fs/promises'].map((name) => ({
    name,
    importNames: MARCHE_BRUTE,
    message: MSG_ORDRE_TOTAL,
  })),
};

const cles = (champ, noms) => [
  `[computed=false][${champ}.name=${noms}]`,
  `[${champ}.type='Literal'][${champ}.value=${noms}]`,
  `[${champ}.type='TemplateLiteral'][${champ}.expressions.length=0][${champ}.quasis.0.value.cooked=${noms}]`,
];

const NOMS_MARCHE = `/^(${MARCHE_BRUTE.join('|')})$/`;
const VERROU_LISTAGE = [
  ...cles('property', NOMS_MARCHE).map((c) => `MemberExpression[object.type!='MetaProperty']${c}`),
  ...cles('key', NOMS_MARCHE).map((c) => `ObjectPattern > Property${c}`),
  `TSImportEqualsDeclaration TSQualifiedName[right.name=${NOMS_MARCHE}]`,
  `JSXMemberExpression[property.name=${NOMS_MARCHE}]`,
].map((selector) => ({ selector, message: MSG_ORDRE_TOTAL }));

const POLICE_POSSESSION = [{
  group: ['**/state/netOwnership', '**/state/netFlow'],
  importNames: ['ownsLocally'],
  message: 'Possession à l’affichage (#1262) : passer par `ui/ownership.ts` (`ownsLocal`/`useOwns`) — le terme `net.mode === "local"` y est déjà mort.',
}];

const NOMS_LOCALE = '/^(localeCompare|toLocale[A-Za-z]*)$/';
const VERROU_LOCALE_COMPARE = [
  ...cles('property', NOMS_LOCALE).map((c) => `MemberExpression${c}`),
  ...cles('key', NOMS_LOCALE).map((c) => `ObjectPattern > Property${c}`),
  "Identifier[name='Intl']:not(TSQualifiedName > Identifier, MemberExpression[computed=false] > Identifier.property, Property[computed=false] > Identifier.key)",
].map((selector) => ({ selector, message: MSG_LOCALE_COMPARE }));

const REGLES_MARCHE = {
  'murs/ordre-total-imports': ['error', ORDRE_TOTAL_IMPORTS],
  'murs/ordre-total': ['error', ...VERROU_LISTAGE],
};
const REGLES_LOCALE = {
  'murs/ordre-total-locale': ['error', ...VERROU_LOCALE_COMPARE],
};

export const REGLES_ORDRE_TOTAL = { ...REGLES_MARCHE, ...REGLES_LOCALE };

const GLOBS_GENERATEURS = [
  'scripts/docs/**', 'scripts/raw/**', 'scripts/guards/lib/**',

  'scripts/gen-registry.mjs', 'scripts/gen-sorts-doc.mts',
  'scripts/data/check-progression-schemas.mjs',

  'scripts/test/partition.mjs',
];

const SOURCE_DU_MUR = ['scripts/guards/lib/lister.mjs'];

const msgPurete = (amont, aval, suite) =>
  `Pureté de couche (#1709, CLAUDE.md règle 3) : src/${amont} n’importe rien de src/${aval} à l’EXÉCUTION — ${suite}`;

const pureteImports = (amont, avals) => ({
  patterns: avals.map(([aval, suite]) => ({
    group: [`**/${aval}`, `**/${aval}/**`],
    allowTypeImports: true,
    message: msgPurete(amont, aval, suite),
  })),
});

const pureteSyntaxe = (amont, avals) => avals.map(([aval, suite]) => ({
  selector: `ImportExpression[source.value=/(^|\\/)${aval}\\//]`,
  message: msgPurete(amont, aval, suite),
}));

const AVALS_ENGINE = [
  ['state', 'extraire le type/la logique partagée vers une couche neutre — `engine/flowCore` a été extrait pour cela (#8), la couche `state` ne fait qu’instancier la feuille générique.'],
  ['ui', 'extraire le type/la logique partagée vers une couche neutre, ou n’importer que le TYPE (`import type`).'],
  ['gameIso', 'extraire le type/la logique partagée vers une couche neutre, ou n’importer que le TYPE (`import type`).'],
];
const AVALS_DATA = [
  ['ui', 'la base APP-OWNED est en amont de l’affichage — incident #421 : `pregens.ts` important `ui/creator` tirait tout ce graphe dans celui de `data`. Reconstruire sur les primitives `engine` (`createHero`, `rollInitialWealth`…), ou n’importer que le TYPE (`import type`).'],
  ['state', 'la donnée est en amont du store/flux — extraire le type/la logique partagée vers une couche neutre, ou n’importer que le TYPE (`import type`).'],
  ['gameIso', 'la donnée est SERVIE au rendu, elle ne l’importe pas — extraire la forme partagée vers une couche neutre, ou n’importer que le TYPE (`import type`).'],
];
const AVALS_STATE = [
  ['ui', 'le store/flux est en amont de l’affichage — extraire le type/la logique partagée, ou n’importer que le TYPE (`import type`).'],
  ['gameIso', 'extraire la géométrie/simulation partagée vers `src/geometry` (ou le module neutre pertinent) — c’est le geste de l’audit #161.'],
];

// #2278
const GLOBS_DE_MOD = ['hooks', 'types', 'tests'].flatMap((d) => [`.claude/skills/*/${d}/**/*.ts`, `.claude/skills/*/${d}/**/*.mts`]);
const DOSSIERS_DE_MOD = ['.claude/skills/', '.claude/skills/*/', ...['hooks', 'types', 'tests'].flatMap((d) => [`.claude/skills/*/${d}/`, `.claude/skills/*/${d}/**/`])];
const EXTENSIONS_HORS_TS = ['js', 'mjs', 'cjs', 'cts', 'jsx', 'tsx'];
const GLOBS_DE_MOD_HORS_TS = ['hooks', 'types', 'tests'].flatMap((d) => EXTENSIONS_HORS_TS.map((ext) => `.claude/skills/*/${d}/**/*.${ext}`));
const BANCS_DE_MOD = ['.claude/skills/**/*.test.ts'];
const COUTURE_DE_MOD = ['.claude/skills/*/hooks/ops.ts'];
const REMEDE_MOD = 'le calcul va à un script de `scripts/`, le mod rend (#2278)';
const ACCES = (nom) => `[computed=false][optional=false][property.name=${nom}]`;
const DOLLAR_DE = (objet, membre) => `MemberExpression${ACCES(membre)} > MemberExpression.object${ACCES(objet)} > Identifier.object`;
const IDIOME = [
  '[optional=false][arguments.length=1]',
  '[callee.computed=false][callee.optional=false][callee.property.name="run"]',
  '[callee.object.computed=false][callee.object.optional=false][callee.object.property.name="process"][callee.object.object.name="$"]',
  '[arguments.0.type="SpreadElement"][arguments.0.argument.type="CallExpression"][arguments.0.argument.optional=false]',
  '[arguments.0.argument.callee.type="Identifier"][arguments.0.argument.callee.name="appel"]',
].join('');
const PLACES_DE_DOLLAR = [
  DOLLAR_DE('"ui"', '/^(resolve|log|invalidate)$/'),
  `MemberExpression[computed=false][optional=false] > MemberExpression.object${ACCES('"state"')} > Identifier.object`,
  DOLLAR_DE('"session"', '/^(id|append)$/'),
  DOLLAR_DE('"tool"', '"register"'),
  DOLLAR_DE('"clock"', '"every"'),
  `CallExpression${IDIOME} > MemberExpression.callee > MemberExpression.object > Identifier.object`,
  `CallExpression${IDIOME} > SpreadElement > CallExpression > MemberExpression.arguments:first-child${ACCES('"root"')} > MemberExpression.object${ACCES('"plugin"')} > Identifier.object`,
  'CallExpression[optional=false][callee.type="Identifier"] > Identifier.arguments',
  ':function > Identifier.params',
  'TSTypeQuery Identifier',
  'MemberExpression[computed=false] > Identifier.property',
];
const MSG_DOLLAR = `\`$\` hors de ses places (accès à liste blanche ou idiome \`$.process.run(...appel($.plugin.root, …))\`, argument d'une fonction locale, paramètre, \`typeof $\` en type) : ${REMEDE_MOD}.`;
const TYPE_MOTEUR = ':matches(TSTypeReference[typeName.name="EngineInterface"], TSTypeQuery[exprName.name="$"])';
const ANY_DE_MOD = [{
  selector: 'TSAnyKeyword',
  message: `\`any\` dans un mod : il laisse \`$\` circuler sous un autre nom et hors de sa liste blanche ; ${REMEDE_MOD}.`,
}];
const MOTEUR_SOUS_UN_AUTRE_NOM = [{
  selector: [
    `Identifier[name!="$"] > TSTypeAnnotation ${TYPE_MOTEUR}`,
    `:matches(ObjectPattern, ArrayPattern) > TSTypeAnnotation ${TYPE_MOTEUR}`,
    `VariableDeclarator:not([id.name="$"]) > :matches(TSAsExpression, TSTypeAssertion, TSSatisfiesExpression).init > ${TYPE_MOTEUR}.typeAnnotation`,
    `:matches(TSAsExpression, TSTypeAssertion, TSSatisfiesExpression):not(VariableDeclarator > .init) > ${TYPE_MOTEUR}.typeAnnotation`,
    `:matches(TSTypeAliasDeclaration, TSInterfaceDeclaration, TSTypeParameter) ${TYPE_MOTEUR}`,
  ].join(', '),
  message: `Le moteur sous un autre nom que \`$\` (liaison, déstructuration, cast, alias ou contrainte typés \`EngineInterface\`/\`typeof $\`) : \`$\` sortirait de sa liste blanche ; ${REMEDE_MOD}.`,
}];
const SEUIL_DE_MOD = [{
  selector: 'BinaryExpression[operator=/^(<|>|<=|>=)$/]',
  message: `Seuil dans un mod (opérateur relationnel) : ${REMEDE_MOD}.`,
}, {
  selector: [
    'BinaryExpression[operator=/^([-*/%]|\\*\\*)$/]:not([left.type=/^(Literal|BinaryExpression)$/])',
    'BinaryExpression[operator=/^([-*/%]|\\*\\*)$/]:not([right.type=/^(Literal|BinaryExpression)$/])',
    'BinaryExpression[operator="+"][left.value=type(number)]:not([right.type="Literal"])',
    'BinaryExpression[operator="+"][right.value=type(number)]:not([left.type="Literal"])',
    'BinaryExpression[operator="+"]:not([left.type="Literal"]):not([right.type="Literal"])',
    'AssignmentExpression[operator=/^([-+*/%]|\\*\\*)=$/]',
    'UnaryExpression[operator="+"]',
  ].join(', '),
  message: `Seuil dans un mod (arithmétique sur un non-littéral, \`+\` unaire, affectation composée ; le pliage de littéraux, \`60 * 1000\`, passe, et un gabarit concatène) : ${REMEDE_MOD}.`,
}, {
  selector: 'UpdateExpression',
  message: `Seuil dans un mod (\`++\`/\`--\`) : ${REMEDE_MOD}.`,
}, {
  selector: 'SwitchCase[test.value=type(number)]',
  message: `Seuil dans un mod (\`case\` numérique) : ${REMEDE_MOD}.`,
}, {
  selector: 'Identifier[name="Math"]:not(MemberExpression[computed=false] > Identifier.property)',
  message: `Seuil dans un mod (\`Math\`) : ${REMEDE_MOD}.`,
}];
const EGALITE_NUMERIQUE_DE_MOD = [{
  selector: [
    'BinaryExpression[operator=/^[!=]==?$/][left.value=type(number)]',
    'BinaryExpression[operator=/^[!=]==?$/][right.value=type(number)]',
    'BinaryExpression[operator=/^[!=]==?$/][left.operator="-"][left.argument.value=type(number)]',
    'BinaryExpression[operator=/^[!=]==?$/][right.operator="-"][right.argument.value=type(number)]',
  ].join(', '),
  message: `Seuil dans un mod (égalité avec un littéral numérique) : ${REMEDE_MOD}.`,
}];
const METHODES_DE_PARSING = '/^(split|match|matchAll|replace|replaceAll|indexOf|lastIndexOf|slice|substring|substr|startsWith|endsWith|includes|search|exec|test|charAt|charCodeAt|codePointAt|at)$/';
const PARSING_DE_MOD = [{
  selector: `CallExpression > MemberExpression.callee[property.name=${METHODES_DE_PARSING}], CallExpression > MemberExpression.callee[computed=true][property.value=${METHODES_DE_PARSING}]`,
  message: `Parsing dans un mod (appel d'une méthode de découpe ou de recherche de chaîne ; le type du receveur est inconnu du mur) : ${REMEDE_MOD}.`,
}, {
  selector: [
    'Identifier[name=/^(parseInt|parseFloat|Number|RegExp)$/]:not(MemberExpression[computed=false] > Identifier.property):not(TSTypeReference > Identifier.typeName)',
    'Literal[regex]',
    'MemberExpression[object.name="Date"][property.name="parse"]',
    'NewExpression[callee.name=/^(Date|URL)$/]:not([arguments.length=0])',
  ].join(', '),
  message: `Parsing dans un mod (\`parseInt\`, \`parseFloat\`, \`Number\`, \`RegExp\`, littéral regex, \`Date.parse\`, \`new Date(x)\` ou \`new URL(x)\`) : ${REMEDE_MOD}.`,
}];
const JSON_PARSE_DE_MOD = [{
  selector: 'MemberExpression[object.name="JSON"][property.name="parse"]',
  message: `Parsing dans un mod (\`JSON.parse\`, réservé à la couture \`hooks/ops.ts\`) : ${REMEDE_MOD}.`,
}];
const ASK_DE_MOD = [{
  selector: [
    ':matches(Property, TSPropertySignature, PropertyDefinition, MethodDefinition)[key.name="ask"]',
    'Literal[value="ask"]',
    'TemplateLiteral[expressions.length=0] > TemplateElement[value.cooked="ask"]',
  ].join(', '),
  message: `\`ask\` dans un mod : la décision de demander est une RÈGLE du régime ; ${REMEDE_MOD}.`,
}];
const SOURCE_HORS_MOD = [
  '/^[.][.](?!.(types|hooks)(.[A-Za-z0-9_-]+)*$)/',
  '/^[.][^.].*[.][.]/',
];
const IMPORT_DE_MOD = [{
  selector: SOURCE_HORS_MOD.map((motif) =>
    `:matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration, ImportExpression) > Literal.source[value=${motif}]`).join(', '),
  message: `Import relatif hors de \`hooks/\` et \`types/\` dans un mod : un module importé échapperait au mur (\`claude-code\`, \`./x\` et \`../types\` restent permis) ; ${REMEDE_MOD}.`,
}];
const VERROU_MOD_COUTURE = [{
  selector: 'Identifier[name="$"]',
  message: `\`$\` dans la couture \`hooks/ops.ts\` : le moteur ne suit \`$\` dans aucun import (issuecomment-5984257542), la couture est PURE ; ${REMEDE_MOD}.`,
}, ...ANY_DE_MOD, ...SEUIL_DE_MOD, ...EGALITE_NUMERIQUE_DE_MOD, ...PARSING_DE_MOD, ...ASK_DE_MOD, ...IMPORT_DE_MOD];
const VERROU_MOD = [{
  selector: `Identifier[name="$"]:not(${PLACES_DE_DOLLAR.join(', ')})`,
  message: MSG_DOLLAR,
}, {
  selector: 'MemberExpression[property.name="invalidate"][object.property.name="ui"][object.object.name="$"]:not(CallExpression[arguments.length=1][arguments.0.value="ui.render"] > MemberExpression.callee)',
  message: `\`$.ui.invalidate\` hors d'un événement de RENDU (\`'ui.render'\`) : invalider une réponse mise en cache casse le cache de prompt ; ${REMEDE_MOD}.`,
}, {
  selector: [
    ':matches(VariableDeclarator, FunctionDeclaration, FunctionExpression, ClassDeclaration, ClassExpression) > Identifier.id[name="appel"]',
    ':function > Identifier.params[name="appel"]',
    'ObjectPattern > Property > Identifier.value[name="appel"]',
    'ArrayPattern > Identifier[name="appel"]',
    ':matches(AssignmentPattern, AssignmentExpression) > Identifier.left[name="appel"]',
    'RestElement > Identifier.argument[name="appel"]',
    'CatchClause > Identifier.param[name="appel"]',
    'ImportDeclaration:not([source.value="./ops"]) > :matches(ImportSpecifier, ImportDefaultSpecifier, ImportNamespaceSpecifier) > Identifier.local[name="appel"]',
    'ImportSpecifier[local.name="appel"]:not([imported.name="appel"])',
  ].join(', '),
  message: `\`appel\` est l'import de \`./ops\` : aucune déclaration locale ni import d'ailleurs sous ce nom, l'idiome de lancement serait détourné ; ${REMEDE_MOD}.`,
}, ...ANY_DE_MOD, ...MOTEUR_SOUS_UN_AUTRE_NOM, ...SEUIL_DE_MOD, ...EGALITE_NUMERIQUE_DE_MOD, ...PARSING_DE_MOD, ...JSON_PARSE_DE_MOD, ...ASK_DE_MOD, ...IMPORT_DE_MOD];
const VERROU_MOD_HORS_TS = [{
  selector: 'Program',
  message: `Module hors \`.ts\` dans un mod (\`.js\`, \`.mjs\`, \`.cjs\`, \`.cts\`, \`.jsx\`, \`.tsx\`, bancs compris) : un mod s'écrit en \`.ts\`, avec \`h()\` pour le rendu (#2278) ; ${REMEDE_MOD}.`,
}];

export const IGNORE_LINT = ['dist/**', 'node_modules/**', 'public/**', '_site/**', '**/*.json', '/*.config.*', 'server/.wrangler/**', '.playwright-mcp/**', '.wt-*/**',
  '.claude/**/*', '!.claude/workflows/', '!.claude/workflows/**',
  ...DOSSIERS_DE_MOD.map((dossier) => `!${dossier}`),
  ...[...GLOBS_DE_MOD, ...GLOBS_DE_MOD_HORS_TS].map((glob) => `!${glob}`),
  ...BANCS_DE_MOD,
];
const coeur = Object.fromEntries(Object.entries(js.configs.recommended.rules).map(([k,v])=>[k==='no-dupe-args'||k==='no-octal'?'core/'+k:k,v]));
export const BLOCS_LINT = [
{files:['**/*'],rules:coeur},
{files:['**/*.ts','**/*.tsx','**/*.mts','**/*.cts'],rules:{
  "constructor-super": [
    0
  ],
  "getter-return": [
    0,
    {
      "allowImplicit": false
    }
  ],
  "no-class-assign": [
    0
  ],
  "no-const-assign": [
    0
  ],
  "no-dupe-class-members": [
    0
  ],
  "no-dupe-keys": [
    0
  ],
  "no-func-assign": [
    0
  ],
  "no-import-assign": [
    0
  ],
  "no-new-native-nonconstructor": [
    0
  ],
  "no-obj-calls": [
    0
  ],
  "no-redeclare": [
    0,
    {
      "builtinGlobals": true
    }
  ],
  "no-setter-return": [
    0
  ],
  "no-this-before-super": [
    0
  ],
  "no-unreachable": [
    0
  ],
  "no-unsafe-negation": [
    0,
    {
      "enforceForOrderingRelations": false
    }
  ],
  "no-with": [
    0
  ],
  "no-var": [
    2
  ],
  "prefer-rest-params": [
    2
  ],
  "prefer-spread": [
    2
  ],
  "core/no-dupe-args": [
    0
  ]
}},
{files:['**/*'],rules:{
  "typescript/ban-ts-comment": [
    0
  ],
  "no-array-constructor": [
    2
  ],
  "typescript/no-duplicate-enum-values": [
    2
  ],
  "typescript/no-empty-object-type": [
    2
  ],
  "typescript/no-explicit-any": [
    0
  ],
  "typescript/no-extra-non-null-assertion": [
    2
  ],
  "typescript/no-misused-new": [
    2
  ],
  "typescript/no-namespace": [
    2
  ],
  "typescript/no-non-null-asserted-optional-chain": [
    2
  ],
  "typescript/no-require-imports": [
    2
  ],
  "typescript/no-this-alias": [
    2
  ],
  "typescript/no-unnecessary-type-constraint": [
    2
  ],
  "typescript/no-unsafe-declaration-merging": [
    2
  ],
  "typescript/no-unsafe-function-type": [
    2
  ],
  "no-unused-expressions": [
    2,
    {
      "allowShortCircuit": false,
      "allowTaggedTemplates": false,
      "allowTernary": false
    }
  ],
  "no-unused-vars": [
    1,
    {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }
  ],
  "typescript/no-wrapper-object-types": [
    2
  ],
  "typescript/prefer-as-const": [
    2
  ],
  "typescript/prefer-namespace-keyword": [
    2
  ],
  "typescript/triple-slash-reference": [
    2
  ]
}},
  { files: ['**/*'],
    rules: {
      'no-undef': 'off',
      'typescript/no-explicit-any': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'typescript/ban-ts-comment': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-condition': ['warn', { checkLoops: false }],
      'prefer-const': 'warn',
      'no-case-declarations': 'off',
    },
  },
  {

    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      'murs/marques': ['error', ...VERROU_MARQUES],
    },
  },
  {

    files: ['src/**/*.ts', 'src/**/*.tsx'],
    excludeFiles: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      'murs/conteneur': ['error', ...VERROU_CONTENEUR],
    },
  },
  {

    files: ['src/ui/**/*.ts', 'src/ui/**/*.tsx'],
    excludeFiles: ['src/ui/ownership.ts'],
    rules: {
      'murs/possession': ['error', { patterns: POLICE_POSSESSION }],
    },
  },
  {

    files: ['src/state/**/*.ts', 'src/state/**/*.tsx'],
    excludeFiles: [
      'src/state/flowOutcomes.ts',
      'src/state/rollFlowSpecs.ts',
      'src/state/encounterPsychFlow.ts',
      'src/state/**/*.test.ts', 'src/state/**/*.test.tsx',
    ],
    rules: {
      'murs/canal-issue': ['error', {
        patterns: [{
          group: ['**/flowOutcomes'],
          message: 'Canal d’issue (#1262 V3 Lj) : déclarer `issue` au flux (`RollFlowSpec.issue`) et acquitter par `flow.apply(get, …)` — un site ne rédige plus sa ligne d’issue.',
        }],
      }],
    },
  },
  {

    files: ['scripts/**'],
    excludeFiles: ['scripts/guards/lib/dialecte.mjs'],
    rules: {
      'murs/dialecte': ['error', ...VERROU_DIALECTE],
    },
  },
  {

    files: [...GLOBS_GENERATEURS, 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    excludeFiles: SOURCE_DU_MUR,
    rules: REGLES_MARCHE,
  },
  {

    files: GLOBS_GENERATEURS,
    excludeFiles: SOURCE_DU_MUR,
    rules: REGLES_LOCALE,
  },
  {

    files: ['src/engine/**/*.ts', 'src/engine/**/*.tsx'],
    excludeFiles: ['src/engine/**/*.test.ts', 'src/engine/**/*.test.tsx'],
    rules: {
      'murs/purete-imports': ['error', pureteImports('engine', AVALS_ENGINE)],
      'murs/purete': ['error', ...pureteSyntaxe('engine', AVALS_ENGINE)],
    },
  },
  {

    files: ['src/state/**/*.ts', 'src/state/**/*.tsx'],
    excludeFiles: ['src/state/**/*.test.ts', 'src/state/**/*.test.tsx'],
    rules: {
      'murs/purete-imports': ['error', pureteImports('state', AVALS_STATE)],
      'murs/purete': ['error', ...pureteSyntaxe('state', AVALS_STATE)],
    },
  },
  {

    files: ['src/data/**/*.ts', 'src/data/**/*.tsx'],
    excludeFiles: ['src/data/**/*.test.ts', 'src/data/**/*.test.tsx'],
    rules: {
      'murs/purete-imports': ['error', pureteImports('data', AVALS_DATA)],
      'murs/purete': ['error', ...pureteSyntaxe('data', AVALS_DATA)],
    },
  },
  {
    files: GLOBS_DE_MOD,
    excludeFiles: [...BANCS_DE_MOD, ...COUTURE_DE_MOD],
    rules: { 'murs/mod-sans-regle': ['error', ...VERROU_MOD] },
  },
  {
    files: COUTURE_DE_MOD,
    rules: { 'murs/mod-sans-regle': ['error', ...VERROU_MOD_COUTURE] },
  },
  {
    files: GLOBS_DE_MOD_HORS_TS,
    rules: { 'murs/mod-sans-regle': ['error', ...VERROU_MOD_HORS_TS] },
  },
];
export default {
 plugins:['typescript'], categories:{correctness:'off'},
 jsPlugins:[{name:'murs',specifier:fileURLToPath(new URL('./scripts/guards/lib/mursLint.mjs',import.meta.url))},{name:'core',specifier:fileURLToPath(new URL('./scripts/guards/lib/reglesCoeurLint.mjs',import.meta.url))}],
 globals:{...globals.browser,...globals.node},
 ignorePatterns:IGNORE_LINT,
 overrides:BLOCS_LINT.map(b=>({files:['**/*'],...b})),
 options:{reportUnusedDisableDirectives:'warn'},
};

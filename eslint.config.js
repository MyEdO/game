import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import { builtinRules } from 'eslint/use-at-your-own-risk';

/**
 * Configuration ESLint « plate » (flat config), volontairement PRAGMATIQUE :
 * on cible les vrais bugs (le typecheck strict couvre déjà beaucoup), pas le
 * style. Les conventions stylistiques sont en `warn` (n'échouent pas la CI) pour
 * établir une base sans bloquer le développement en cours. À durcir au fil de l'eau.
 */

/** Les MURS, chacun sous SON nom de règle (plugin local `murs`) : un mur de syntaxe est la règle du cœur
 *  `no-restricted-syntax`, un mur d'import la règle du cœur `no-restricted-imports`. Une directive nomme
 *  le mur qu'elle éteint, et un bloc qui pose un mur ne remplace jamais les options d'un autre — en flat
 *  config, le dernier bloc qui déclare une règle REMPLACE ses options : un nom partagé forçait chaque bloc
 *  à redire les murs voisins. */
const MURS_DE_SYNTAXE = ['marques', 'conteneur', 'dialecte', 'ordre-total', 'ordre-total-locale', 'purete', 'mod-sans-regle'];
const MURS_D_IMPORT = ['ordre-total-imports', 'possession', 'canal-issue', 'purete-imports'];
const MURS = {
  meta: { name: 'murs' },
  rules: Object.fromEntries([
    ...MURS_DE_SYNTAXE.map((nom) => [nom, builtinRules.get('no-restricted-syntax')]),
    ...MURS_D_IMPORT.map((nom) => [nom, builtinRules.get('no-restricted-imports')]),
  ]),
};

/** Un NOM de marque, cherché en DESCENDANT (le cast se forge tout autant sous un tableau/`readonly`). */
const MARQUES = '/^(Built(CascadeStep|RollRow)|PlayerText|AdresseDeCreation)$/';
const MSG_FORGE = 'Marque d’origine (#1262/#1318) : forger un `Built*`/`PlayerText`/`AdresseDeCreation` par cast rend la marque décorative. Passer par un constructeur de la porte (rollSeam), par `revealToStep`, par un minteur de texte (`t`, `refLabel`, `composeRollLabel`), ou par une fabrique d’adresse (`adresseDeCreation`, `adresseLue`).';

/** VERROU DES MARQUES — les trois ROUTES DE FORGE (cast `as`, cast `<T>`, alias qui déguiserait le nom). */
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
  // `AdresseDeCreation` : une adresse ÉCRITE en texte (littéral complet, ou gabarit ouvert sur une famille)
  // entre dans un Record par une clé d'objet sans cast, ce que le typecheck laisse passer (`adresseDeCreation.ts`).
  selector: [
    'Literal[value=/^(espece:talents:[0-9]+(:tirage:[0-9]+)?|carriere:competences:[0-9]+|ajout:[^:]+|signe:[0-9]+|dotation:[0-9]+([.][0-9]+)*)$/]',
    'TemplateElement[value.cooked=/^(espece:talents|carriere:competences|ajout|signe|dotation):/]',
  ].join(', '),
  message: 'Marque d’origine (#1988) : une adresse de création écrite en texte échappe à la marque `AdresseDeCreation` — le typecheck laisse une clé littérale entrer dans un Record par un objet intermédiaire. Passer par une fabrique `adresseDeCreation`, ou par `adresseLue` pour une clé lue.',
}, {
  // `AdresseDeCreation` : un PRÉFIXE de famille écrit en texte recopie la grammaire hors de son module. Le
  // gabarit ouvert (`espece:${i}`) n'est pas refusé : `CharacterCreator.tsx` en fait des clés d'écran.
  selector: [
    'Literal[value=/^(espece|carriere|ajout|signe|dotation|espece:talents|carriere:competences):$/]',
    'TemplateLiteral[expressions.length=0] > TemplateElement[value.cooked=/^(espece|carriere|ajout|signe|dotation|espece:talents|carriere:competences):$/]',
  ].join(', '),
  message: 'Marque d’origine (#1988) : un préfixe de famille d’adresse de création écrit en texte recopie la grammaire hors de `engine/adresseDeCreation.ts`. Demander au module : `deFamille`, `tirageSous`.',
}];

/** VERROU DES CONTENEURS (#1318 V8a₀ T1/T2) — les deux voies qui recomposent l'ÉTAPE entière et
 *  blanchissent son `label` au passage. Portée plus étroite que les marques (cf. le bloc qui l'emploie). */
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
/** MUR DU DIALECTE DE PARSE (#1679 L3b) : le `ts.ScriptKind` d'un fichier se déduit de son extension
 *  par `scriptKindDe` (`scripts/guards/lib/dialecte.mjs`), source unique. Un kind CONSTANT légitime se
 *  dit AU SITE (`eslint-disable-next-line murs/dialecte` + raison), jamais par une exemption de fichier. */
const VERROU_DIALECTE = [{
  selector: "MemberExpression[property.name='ScriptKind']",
  message: 'Dialecte de parse (#1679 L3b) : le `ts.ScriptKind` se déduit de l’extension par `scriptKindDe` (`scripts/guards/lib/dialecte.mjs`) — une table recopiée au site fait lire un `.mts` en TS ici et en JS là, et un scan silencieusement faux ne se voit pas.',
}];

/** MUR DE L'ORDRE TOTAL (#1679 L3b, incident #1620 ; étendu aux tests de `src` par #1709 C3c) — les
 *  NOMS de la marche brute, et les trois messages, que posent `REGLES_MARCHE` (clôture des générateurs
 *  et tests de `src`) et `REGLES_LOCALE` (clôture des générateurs). `readCorpus` est nommé dans le message :
 *  un test qui balaie l'arbre lit un CORPUS. */
const MARCHE_BRUTE = ['readdirSync', 'readdir', 'opendirSync', 'opendir', 'globSync', 'glob'];
const MSG_ORDRE_TOTAL =
  'Ordre total (#1679 L3b) : lister un dossier passe par `listerDossier`/`listerArbre` (`scripts/guards/lib/lister.mjs`), et LIRE un corpus source par `readCorpus` (`scripts/guards/lib/sourceCorpus.mjs`) — un listing brut suit l’ordre du système de fichiers et périme le doc dérivé sur l’autre OS.';
const MSG_LOCALE_COMPARE =
  'Ordre total (#1679 L3b) : `localeCompare`, `toLocale*` et `Intl` suivent la locale et l’ICU du processus — le doc dérivé change avec la machine. Comparer par `parUnitesDeCode` (chemin, id, clé) ou `parLibelle` (libellé lu par le joueur), de `src/lib/ordre.mjs` ; formater sans locale.';

/** Volet IMPORT du mur : les quatre modules `fs`, chacun avec tous les noms de la marche brute. */
const ORDRE_TOTAL_IMPORTS = {
  paths: ['fs', 'node:fs', 'fs/promises', 'node:fs/promises'].map((name) => ({
    name,
    importNames: MARCHE_BRUTE,
    message: MSG_ORDRE_TOTAL,
  })),
};

/** Les trois formes d'une CLÉ de nom `noms` sous le champ `champ` d'un nœud : nommée, littérale
 *  (`x['n']`) ou gabarit sans expression (`` x[`n`] ``). */
const cles = (champ, noms) => [
  `[computed=false][${champ}.name=${noms}]`,
  `[${champ}.type='Literal'][${champ}.value=${noms}]`,
  `[${champ}.type='TemplateLiteral'][${champ}.expressions.length=0][${champ}.quasis.0.value.cooked=${noms}]`,
];

/** Volet SYNTAXE du LISTAGE : un nom de la marche brute, sur TOUT receveur sauf `import.meta` (un
 *  `MetaProperty`, pas un module : `import.meta.glob` de Vite), en accès par membre (optionnel
 *  compris), en clé de déstructuration, en alias d'import TypeScript (`import r = fs.readdirSync`) et
 *  en membre JSX (`<fs.glob />`). */
const NOMS_MARCHE = `/^(${MARCHE_BRUTE.join('|')})$/`;
const VERROU_LISTAGE = [
  ...cles('property', NOMS_MARCHE).map((c) => `MemberExpression[object.type!='MetaProperty']${c}`),
  ...cles('key', NOMS_MARCHE).map((c) => `ObjectPattern > Property${c}`),
  `TSImportEqualsDeclaration TSQualifiedName[right.name=${NOMS_MARCHE}]`,
  `JSXMemberExpression[property.name=${NOMS_MARCHE}]`,
].map((selector) => ({ selector, message: MSG_ORDRE_TOTAL }));

/** POLICE DE LA POSSESSION À L'AFFICHAGE (#1262 L1) — le motif d'import restreint. */
const POLICE_POSSESSION = [{
  group: ['**/state/netOwnership', '**/state/netFlow'],
  importNames: ['ownsLocally'],
  message: 'Possession à l’affichage (#1262) : passer par `ui/ownership.ts` (`ownsLocal`/`useOwns`) — le terme `net.mode === "local"` y est déjà mort.',
}];

/** Volet LOCALE — porté par la seule clôture des générateurs (cf. le bloc des tests) : ce qui suit la
 *  locale ou l'ICU du processus. `localeCompare` et les `toLocale*` sous toute forme de clé (membre,
 *  optionnel compris, et déstructuration), et toute référence à la valeur `Intl` (hors position de
 *  type, sans exécution). */
const NOMS_LOCALE = '/^(localeCompare|toLocale[A-Za-z]*)$/';
const VERROU_LOCALE_COMPARE = [
  ...cles('property', NOMS_LOCALE).map((c) => `MemberExpression${c}`),
  ...cles('key', NOMS_LOCALE).map((c) => `ObjectPattern > Property${c}`),
  "Identifier[name='Intl']:not(TSQualifiedName > Identifier, MemberExpression[computed=false] > Identifier.property, Property[computed=false] > Identifier.key)",
].map((selector) => ({ selector, message: MSG_LOCALE_COMPARE }));

/** Le mur de l'ordre total, en deux blocs dont chacun déclare SEUL ses règles (volet UNICITÉ de
 *  `scripts/guards/lib/lister.test.mjs` : un bloc postérieur qui redéclarerait une règle l'éteindrait) :
 *  la MARCHE (listage de dossier) arme la clôture des générateurs et les tests de `src` ; la LOCALE, la
 *  seule clôture des générateurs. */
const REGLES_MARCHE = {
  'murs/ordre-total-imports': ['error', ORDRE_TOTAL_IMPORTS],
  'murs/ordre-total': ['error', ...VERROU_LISTAGE],
};
const REGLES_LOCALE = {
  'murs/ordre-total-locale': ['error', ...VERROU_LOCALE_COMPARE],
};
/** Toutes les règles du mur. Exportées : le volet CLÔTURE de `scripts/guards/lib/lister.test.mjs` les
 *  applique aux modules de la clôture qui vivent hors des globs du mur. */
export const REGLES_ORDRE_TOTAL = { ...REGLES_MARCHE, ...REGLES_LOCALE };

/** Globs de la clôture des générateurs de dérivés (volet MUR de `scripts/guards/lib/lister.test.mjs`). */
const GLOBS_GENERATEURS = [
  'scripts/docs/**', 'scripts/raw/**', 'scripts/guards/lib/**',
  // Les racines du registre qui ne vivent dans aucun de ces trois dossiers.
  'scripts/gen-registry.mjs', 'scripts/gen-sorts-doc.mts',
  'scripts/data/check-progression-schemas.mjs',
  // Un module de la clôture qui porte une exemption AU SITE : sous le mur, le lint la lit (hors du
  // mur, elle serait une directive inutilisée).
  'scripts/test/partition.mjs',
];
/** La source du mur elle-même (précédent `flowOutcomes.ts`, « la source elle-même »). */
const SOURCE_DU_MUR = ['scripts/guards/lib/lister.mjs'];

/** PURETÉ DE COUCHE (#1709 C3b-2 ; CLAUDE.md règle stricte 3, issues #8 et #161) : la couche AMONT
 *  n'a AUCUNE arête d'EXÉCUTION vers la couche AVAL. Le critère est STRUCTUREL, jamais nominatif :
 *  ce qui est élidé à la compilation (`import type … from`, `import { type X }` tout-type,
 *  `export type … from`, et la référence inline `import('…').T` — un `TSImportType`, qu'aucune des
 *  deux règles ne visite) ne crée aucune arête et PASSE ; tout le reste est refusé, y compris l'alias
 *  `@/…` (`tsconfig.json` `paths`) et le `export … from`.
 *
 *  DEUX règles, parce qu'aucune ne suffit seule (mesuré sur 7 formes d'import, cf.
 *  `src/eslint-ordre-total-et-purete.test.ts` qui rejoue la table sur la config RÉSOLUE) :
 *  `no-restricted-imports` ne visite que `ImportDeclaration` / `ExportNamedDeclaration[source]` /
 *  `ExportAllDeclaration` (`node_modules/eslint/lib/rules/no-restricted-imports.js` — aucun
 *  `ImportExpression`), donc l'import DYNAMIQUE lui échappe et revient au mur `murs/purete` (`no-restricted-syntax` du cœur).
 *  Précédent du dépôt : le mur de l'ordre total, plus bas, « DEUX règles, parce qu'aucune ne suffit
 *  seule ». `allowTypeImports` est porté par la règle CORE d'ESLint 10 (la variante
 *  `@typescript-eslint` est DÉPRÉCIÉE depuis 8.64.0 au profit d'elle).
 */
const msgPurete = (amont, aval, suite) =>
  `Pureté de couche (#1709, CLAUDE.md règle 3) : src/${amont} n’importe rien de src/${aval} à l’EXÉCUTION — ${suite}`;

/** Formes d'import STATIQUES vers une couche aval (le type-only passe : il n'a pas d'arête runtime). */
const pureteImports = (amont, avals) => ({
  patterns: avals.map(([aval, suite]) => ({
    group: [`**/${aval}`, `**/${aval}/**`],
    allowTypeImports: true,
    message: msgPurete(amont, aval, suite),
  })),
});

/** Import DYNAMIQUE vers une couche aval — hors de portée de `no-restricted-imports`. */
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

/** MUR DES MODS CLAUDE CODE (#2278, amendement n° 2 : issuecomment-5984597607) — un mod REND, les
 *  scripts de `scripts/` MESURENT. Périmètre : l'`include` du tsconfig que pose le moteur
 *  (`../../hooks`, `../../types`, `../../tests`), hors bancs ; un import relatif n'en sort pas. La
 *  couture `hooks/ops.ts` est PURE. Liste blanche de `$` : issuecomment-5983917564 et
 *  issuecomment-5984597607 ; idiome de lancement : issuecomment-5984257542. `$.ui.invalidate` ne prend
 *  qu'un événement de RENDU : types 2.1.289, `RenderEventName = 'ui.render'`, quand
 *  `InvalidatableEventName` y ajoute les six réponses que le moteur met en cache (`prompt.section`,
 *  `prompt.context`, `prompt.attachment`, `tool.describe`, `command.describe`, `config.describe`).
 *  `$` passé à une fonction locale reste `$` : `any` est refusé, et une liaison typée `EngineInterface`
 *  (ou `typeof $`), castée vers lui ou contrainte par lui se nomme `$` et n'est jamais déstructurée ; le
 *  tsconfig posé par le moteur est `"strict": true` (`.claude-plugin/types/tsconfig.json`, 2.1.289),
 *  donc un paramètre sans type est refusé par `tsc` dans `mods:check`.
 *  CE QUE LE MUR NE GARDE PAS : l'évasion DÉLIBÉRÉE (`'a' + 'sk'`, clé calculée, alias de `Math` reçu
 *  en paramètre, type dérivé de `On` par `Parameters<…>`) ; l'appelé IMPORTÉ qui reçoit `$` (le moteur
 *  le refuse, la garde `mods:check` le prouve par `claude plugin validate --strict`) ; un import `../x`
 *  depuis un sous-dossier de `hooks/` (`../hooks/x` s'écrit à la racine seulement) ; et les prédicats
 *  que le type du receveur seul distingue : `.every`, `.length === x`, `Object.is`, `t[0]`, la
 *  déstructuration d'une chaîne. */
const GLOBS_DE_MOD = ['hooks', 'types', 'tests'].flatMap((d) => [`.claude/skills/*/${d}/**/*.ts`, `.claude/skills/*/${d}/**/*.mts`]);
/** Les dossiers à dé-ignorer pour atteindre le périmètre : un fichier sous un dossier ignoré ne se rattrape pas. */
const DOSSIERS_DE_MOD = ['.claude/skills/', '.claude/skills/*/', ...['hooks', 'types', 'tests'].flatMap((d) => [`.claude/skills/*/${d}/`, `.claude/skills/*/${d}/**/`])];
/** Les extensions refusées sous un mod, bancs compris : un module hors `.ts` porterait ce que le mur ne lit pas. */
const EXTENSIONS_HORS_TS = ['js', 'mjs', 'cjs', 'cts', 'jsx', 'tsx'];
const GLOBS_DE_MOD_HORS_TS = ['hooks', 'types', 'tests'].flatMap((d) => EXTENSIONS_HORS_TS.map((ext) => `.claude/skills/*/${d}/**/*.${ext}`));
const BANCS_DE_MOD = ['.claude/skills/**/*.test.ts'];
const COUTURE_DE_MOD = ['.claude/skills/*/hooks/ops.ts'];
const REMEDE_MOD = 'le calcul va à un script de `scripts/`, le mod rend (#2278)';
/** Un accès membre ni calculé ni optionnel, de propriété `nom` (chaîne entre guillemets ou regex). */
const ACCES = (nom) => `[computed=false][optional=false][property.name=${nom}]`;
/** La chaîne `$.<objet>.<membre>` à liste blanche : le `$` qui en est l'objet. */
const DOLLAR_DE = (objet, membre) => `MemberExpression${ACCES(membre)} > MemberExpression.object${ACCES(objet)} > Identifier.object`;
/** L'appel `$.process.run(...appel($.plugin.root, …))`, lu sur ses champs. */
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
/** Un type qui désigne le moteur : `EngineInterface` ou `typeof $`, à toute profondeur du type. */
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
/** Un import relatif reste dans `hooks/`/`types/` : `./x`, ou `../types`/`../hooks` et leurs modules. */
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

export default tseslint.config(
  // `src/data` est LU par ESLint comme le reste de `src` (#1709 C3c-3b) : ses `.ts` (fabriques,
  // grammaire, schémas générés, gardes) passent sous les mêmes verrous et la même pureté de couche ;
  // ses `.json` restent ignorés par `**/*.json` — la DONNÉE n'est pas ce qu'un lint juge.
  { ignores: ['dist/**', 'node_modules/**', 'public/**', '_site/**', '**/*.json', '*.config.*', '.claude/**/*', 'server/.wrangler/**', '.playwright-mcp/**', '.wt-*/**',
    // `.claude/` reste ignoré, sauf le périmètre du mur des mods (#2278) ; ses bancs restent dehors.
    ...DOSSIERS_DE_MOD.map((dossier) => `!${dossier}`), ...[...GLOBS_DE_MOD, ...GLOBS_DE_MOD_HORS_TS].map((glob) => `!${glob}`), ...BANCS_DE_MOD] },
  { plugins: { murs: MURS } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-undef': 'off', // TypeScript gère déjà les identifiants non définis
      '@typescript-eslint/no-explicit-any': 'off', // `any` assumé dans le store/bus
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-condition': ['warn', { checkLoops: false }],
      'prefer-const': 'warn',
      'no-case-declarations': 'off',
    },
  },
  {
    // VERROU DES MARQUES D'ORIGINE (#1262) : `BuiltCascadeStep`/`BuiltRollRow` portent une propriété
    // REQUISE inécrivable hors de leur module (symbole non exporté), donc le SEUL moyen d'en forger
    // une est le cast. Toute exemption est AU SITE (un `eslint-disable-next-line` porteur de sa raison),
    // minteurs compris : chaque porte de `rollSeam`, `revealToStep` et le prédicat `isBuiltRollRow` de
    // `rollRowBuild` portent la leur, et un second cast dans ces fichiers rougit. Partout ailleurs le
    // cast rendrait la marque décorative.
    //
    // DEUX formes de cast (`x as T` et `<T>x`), et la référence est cherchée en DESCENDANT : la marque
    // se forge tout autant sous un tableau (`as BuiltCascadeStep[]`), un `readonly` ou un générique —
    // c'est même la route RÉALISTE vers `openSequence.steps`. TROISIÈME forme, sans quoi les deux
    // premières ne valent rien : l'ALIAS (`type A = BuiltRollRow; x as A`) — les deux sélecteurs
    // ci-dessus filtrent par NOM, donc une ligne d'alias suffisait à sortir du radar (mesuré : tsc ET
    // eslint verts avant fermeture).
    //
    // L'alias se refuse à sa DÉCLARATION, mais SEULEMENT quand le type ALIASÉ EST la marque (nu, en
    // tableau, `readonly`, ou en union). La forme descendante « toute référence sous un alias » a été
    // MESURÉE et REJETÉE : elle fauche 4 sites LÉGITIMES (`state/nightBands.ts` l.104/115/116,
    // `state/cascade.ts` l.57) — des types de CALLBACK qui EXIGENT des étapes mintées en entrée/sortie,
    // c'est-à-dire le murage lui-même. Employer la marque dans une signature n'est pas la déguiser.
    // Restent donc hors portée (dit au JSDoc de `state/stepBrand.ts`) : l'alias GÉNÉRIQUE ou calculé
    // (`type A<T> = …`, type conditionnel, accès indexé) et le renommage à l'import.
    //
    // TROISIÈME MARQUE, mêmes routes, même verrou (#1318 V8a₀) : `PlayerText` (`src/i18n/playerText.ts`),
    // le texte destiné à l'œil du joueur. Ses MINTEURS portent chacun son exemption AU SITE : `t()`
    // (`i18n/index.ts`), `composeRollLabel` (`state/rollSeam.ts`), le minteur de fixture
    // `i18n/fixtureText.ts`, et les libellés de la donnée (#1709 C3c-3b) `dataLabel` (`data/index.ts`) et
    // `mutationTablePlayerLabel` (`data/mutations.ts`) — un second cast dans l'un de ces fichiers échoue.
    // QUATRIÈME MARQUE (#1988) : `AdresseDeCreation` (`src/engine/adresseDeCreation.ts`), la clé des choix
    // de création. Même régime : l'unique cast (`marquer`) porte son exemption AU SITE ; un cast ailleurs
    // forgerait une adresse depuis un texte quelconque. QUATRIÈME ROUTE, propre à cette marque : l'adresse
    // ÉCRITE en texte (littéral, gabarit ouvert sur une famille), que tsc laisse entrer par un objet
    // intermédiaire — sonde et bilan au JSDoc de `engine/adresseDeCreation.ts`. Chaque fabrique, qui
    // compose l'adresse par gabarit, porte son exemption sur sa ligne.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      'murs/marques': ['error', ...VERROU_MARQUES],
    },
  },
  {
    // LES DEUX CONTOURNEMENTS DE CONTENEUR (#1318 V8a₀) — marquer `label` au type ferme la déclaration
    // DIRECTE, pas les deux voies qui recomposent l'étape ENTIÈRE et blanchissent le champ au passage :
    //  T1. `Object.assign(step, { label: '…' })` — la signature `assign<T,U>(t: T, s: U): T & U` ne
    //      vérifie RIEN contre `T` : le champ marqué se réécrit en `string` sans un mot de `tsc`.
    //  T2. `x as CascadeStep` — le cast de CONTENEUR : tout littéral y entre, `label` compris. Les casts
    //      internes des 7 portes du seam visent `BuiltCascadeStep`, que le sélecteur ne nomme pas : ils
    //      ne blanchissent rien, la marque étant exigée EN AMONT, au paramètre de leur SPEC — c'est la
    //      déclaration qui est murée, pas la sortie.
    // Le sélecteur T1 est SYNTAXIQUE (un lint ne type pas la cible) : il vise `Object.assign` dont un
    // argument littéral porte un `label`. Le seul site RÉEL du dépôt (`interludeFlow.ts`, un
    // `Partial<PendingActivityFields>` — pas une étape) porte son exemption AU SITE avec sa raison.
    // Les fichiers de TEST sont hors du sélecteur T2 : leurs `as CascadeStep` sont GELÉS nominativement
    // et décroissants — le COMPTE vit dans `GEL_AS_CASCADE_STEP` (`state/player-text-ratchet.test.ts`,
    // cible 0), jamais ici : un chiffre recopié en commentaire ment au premier lot qui l'abaisse. Un gel
    // mesuré vaut mieux qu'une exemption muette, et le code de PRODUCTION, lui, n'en a plus AUCUN (mesuré).
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      'murs/conteneur': ['error', ...VERROU_CONTENEUR],
    },
  },
  {
    // POLICE DE LA POSSESSION À L'AFFICHAGE (#1262 L1) : une fenêtre demande « ce siège pilote-t-il ce
    // combattant ? » par la porte UI `src/ui/ownership.ts`, jamais en important le prédicat d'état.
    // Ce n'est PAS un verrou : `ownsLocally` est exporté par `netOwnership` (6 consommateurs internes)
    // et ré-exporté par `netFlow` — l'import reste écrivable, la CI le refuse. Le nom seul est
    // restreint : les autres exports de ces modules (types `NetState`, `initialNet`…) passent.
    files: ['src/ui/**/*.ts', 'src/ui/**/*.tsx'],
    ignores: ['src/ui/ownership.ts'],
    rules: {
      'murs/possession': ['error', { patterns: POLICE_POSSESSION }],
    },
  },
  {
    // POLICE DU CANAL D'ISSUE (#1262 V3 Lj) : la ligne d'ISSUE d'un jet se DÉCLARE au flux
    // (`RollFlowSpec.issue`, rendue par le verbe `apply`) — un flux de `src/state` n'importe plus un
    // `describeX` pour composer sa propre ligne (c'est le doublon modale ↔ journal que le lot ferme).
    // Ce n'est PAS un verrou : `flowOutcomes` reste exporté (les fenêtres de `src/ui` l'affichent) —
    // l'import reste écrivable, la CI le refuse. Règle AST : insensible aux guillemets, à l'alias et
    // à la forme d'import (namespace, `export … from`). Ce qu'elle N'attrape PAS est dit au JSDoc du
    // volet « canal » de `cascade-consequence-guard.test.ts`, qui la mesure sur la config réelle.
    files: ['src/state/**/*.ts', 'src/state/**/*.tsx'],
    ignores: [
      'src/state/flowOutcomes.ts', // la source elle-même
      'src/state/rollFlowSpecs.ts', // GOULOT : déclaration `spec.issue` des flux à fenêtre
      'src/state/encounterPsychFlow.ts', // GOULOT : conséquence d'étape (freeCons → commitStep)
      'src/state/**/*.test.ts', 'src/state/**/*.test.tsx', // les tests mesurent les describeX eux-mêmes
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
    // MUR DU DIALECTE DE PARSE (#1679 L3b) : 14 sites choisissaient leur `ts.ScriptKind` par une table
    // d'extensions recopiée (2 à 3 branches, trois graphies) — une extension neuve entrait en TS ici et
    // en JS là. La table vit dans `scripts/guards/lib/dialecte.mjs` (`scriptKindDe`), qui porte
    // son exemption AU SITE avec sa raison : c'est là que la table se lit.
    files: ['scripts/**'],
    rules: {
      'murs/dialecte': ['error', ...VERROU_DIALECTE],
    },
  },
  {
    // MUR DE L'ORDRE TOTAL (#1679 L3b, incident #1620) : dans la clôture des générateurs de dérivés,
    // un listing de répertoire passe par `listerDossier`/`listerArbre` (`scripts/guards/lib/lister.mjs`)
    // et une comparaison de chaînes par `parUnitesDeCode`. Sans cela le même dépôt rend deux `.md`
    // différents selon la machine (NTFS trie sans casse, ext4 rend l'ordre d'un hash ; `localeCompare`
    // suit l'ICU du processus) et la CI rougit MUETTE sur un doc simplement périmé.
    //
    // La PORTÉE de ce bloc est vérifiée, pas postulée : `scripts/guards/lib/lister.test.mjs` exige que
    // chaque racine de `GENERATORS` ∪ `NON_GENERATOR_CHECKS` (`scripts/docs/build-all.mjs`) soit sous un
    // des globs ci-dessous, et lint par `REGLES_ORDRE_TOTAL` chaque module de leur clôture d'imports NON
    // bornée qui vit hors de ces globs, en le NOMMANT — les globs et les règles se lisent DEPUIS ce
    // fichier, jamais recopiés.
    //
    // DEUX règles, parce qu'aucune ne suffit seule — mesuré sur la table `FORMES_MARCHE` de
    // `src/eslint-ordre-total-et-purete.test.ts`, pour `readdirSync` comme pour `glob`, par la config
    // résolue : `murs/ordre-total-imports` seule prend l'import nommé et l'alias ; les deux prennent le
    // namespace ; `murs/ordre-total` seule prend tout le reste — membre (optionnel compris) de
    // `fs`, de `fs.promises`, d'un `import()`, de son `.default`, d'un `require`, de
    // `process.getBuiltinModule`, d'un receveur quelconque ; clé littérale ou gabarit ; déstructuration.
    // `no-restricted-properties` ne remplace pas ce mur de syntaxe : son `allowObjects` se lit sur
    // le NOM du receveur (`node_modules/eslint/lib/rules/no-restricted-properties.js`), et
    // `import.meta` n'en a pas — elle refuserait `import.meta.glob`.
    // Exemption au FICHIER pour la source elle-même (`SOURCE_DU_MUR`) ; le crochet de l'enregistreur de
    // lectures porte ses exemptions AU SITE, avec leur raison.
    //
    // LES TESTS DE `src` (#1709 C3c-1) sont sous la MARCHE. Une garde qui balaie l'arbre réel lit un
    // CORPUS : `readCorpus` (`scripts/guards/lib/sourceCorpus.mjs`, mémoïsé, gelé, ordre total, refus du
    // vide par base) ; un LISTAGE de dossier passe par `listerDossier`/`listerArbre`. La marche brute
    // n'est plus écrivable ici — ni par import nommé, ni par membre, ni par déstructuration.
    // PÉRIMÈTRE (#1709 C3c-3b) : TOUT test de `src`, en UNE paire de globs — un dossier neuf sous
    // `src/` naît donc SOUS le mur, sans qu'on ait à y penser.
    files: [...GLOBS_GENERATEURS, 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    ignores: SOURCE_DU_MUR,
    rules: REGLES_MARCHE,
  },
  {
    // MUR DE L'ORDRE TOTAL — LA LOCALE, sur la seule clôture des générateurs. Les tests de `src` n'y sont
    // pas : l'ordre total vise le déterminisme cross-OS des docs DÉRIVÉS ; un test qui asserte l'ordre
    // que le PRODUIT rend par locale (`src/ui/compendium/relations.test.ts` compare la donnée réelle à
    // `localeCompare(b, 'fr')` ; deux scénarios trient des ids en `{ numeric: true }`, que `lister.mjs`
    // ne sait pas exprimer) mesure un contrat PRODUIT, pas un listing — le refuser ici exigerait des
    // exemptions au site.
    files: GLOBS_GENERATEURS,
    ignores: SOURCE_DU_MUR,
    rules: REGLES_LOCALE,
  },
  {
    // PURETÉ DU MOTEUR (#1709 C3b-2 ; CLAUDE.md règle 3, issue #8) — `src/engine` est la couche RÈGLES,
    // PURE : `state`/`ui`/`gameIso` en dépendent, JAMAIS l'inverse. Les fichiers de TEST sont hors
    // portée : ils exercent légitimement le runtime des couches aval (`runPureFlowLines`,
    // `applyTriggeredEffects`, `combatantVisuals`…) — ce sont des consommateurs, pas le moteur.
    files: ['src/engine/**/*.ts', 'src/engine/**/*.tsx'],
    ignores: ['src/engine/**/*.test.ts', 'src/engine/**/*.test.tsx'],
    rules: {
      'murs/purete-imports': ['error', pureteImports('engine', AVALS_ENGINE)],
      'murs/purete': ['error', ...pureteSyntaxe('engine', AVALS_ENGINE)],
    },
  },
  {
    // PURETÉ DE `state` (#1709 C3b-2 ; règle 3, #161). Tests hors portée, même raison que pour le moteur.
    files: ['src/state/**/*.ts', 'src/state/**/*.tsx'],
    ignores: ['src/state/**/*.test.ts', 'src/state/**/*.test.tsx'],
    rules: {
      'murs/purete-imports': ['error', pureteImports('state', AVALS_STATE)],
      'murs/purete': ['error', ...pureteSyntaxe('state', AVALS_STATE)],
    },
  },
  {
    // PURETÉ DE `src/data` (#1709 C3c-3b ; CLAUDE.md règle 3, incident #421) — la base APP-OWNED est
    // la couche la plus AMONT : `ui`, `state` et `gameIso` la lisent, JAMAIS l'inverse. Le critère est
    // STRUCTUREL, comme pour le moteur et le store : ce qui est élidé à la compilation passe (les réfs
    // de TYPE INLINE d'`index.ts`, `import('../state/flow').Condition`, sont des `TSImportType`
    // qu'aucune des deux règles ne visite), tout import RUNTIME est refusé. Les deux inversions
    // VIVANTES sont visibles à leur site, avec leur ticket : `fsPersist.ts` (#518) et `props.types.ts`
    // (#1506) portent chacune un `eslint-disable-next-line` motivé — jamais un nom de fichier en liste.
    // Tests hors portée, même raison que pour le moteur : ils exercent légitimement le runtime aval.
    files: ['src/data/**/*.ts', 'src/data/**/*.tsx'],
    ignores: ['src/data/**/*.test.ts', 'src/data/**/*.test.tsx'],
    rules: {
      'murs/purete-imports': ['error', pureteImports('data', AVALS_DATA)],
      'murs/purete': ['error', ...pureteSyntaxe('data', AVALS_DATA)],
    },
  },
  {
    // MUR DES MODS (#2278) : hors couture, `$` à ses trois places, ni seuil, ni parsing, ni `ask`, ni
    // `appel` qui ne soit l'import de `./ops` (en-tête de `VERROU_MOD`).
    files: GLOBS_DE_MOD,
    ignores: [...BANCS_DE_MOD, ...COUTURE_DE_MOD],
    rules: {
      'murs/mod-sans-regle': ['error', ...VERROU_MOD],
    },
  },
  {
    // MUR DES MODS — la couture `hooks/ops.ts` : aucun `$` ; seuil, `Math` et parsing refusés, sauf
    // `JSON.parse` et l'égalité (`exitCode !== 0`), qui sont sa raison d'être.
    files: COUTURE_DE_MOD,
    rules: {
      'murs/mod-sans-regle': ['error', ...VERROU_MOD_COUTURE],
    },
  },
  {
    // MUR DES MODS — un module hors `.ts` est refusé, bancs compris : un mod s'écrit en `.ts` avec `h()`.
    files: GLOBS_DE_MOD_HORS_TS,
    rules: {
      'murs/mod-sans-regle': ['error', ...VERROU_MOD_HORS_TS],
    },
  },
);

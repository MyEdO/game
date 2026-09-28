import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Configuration ESLint « plate » (flat config), volontairement PRAGMATIQUE :
 * on cible les vrais bugs (le typecheck strict couvre déjà beaucoup), pas le
 * style. Les conventions stylistiques sont en `warn` (n'échouent pas la CI) pour
 * établir une base sans bloquer le développement en cours. À durcir au fil de l'eau.
 */

/** Un NOM de marque, cherché en DESCENDANT (le cast se forge tout autant sous un tableau/`readonly`). */
const MARQUES = '/^(Built(CascadeStep|RollRow)|PlayerText|AdresseDeCreation)$/';
const MSG_FORGE = 'Marque d’origine (#1262/#1318) : forger un `Built*`/`PlayerText`/`AdresseDeCreation` par cast rend la marque décorative. Passer par un constructeur de la porte (rollSeam), par `revealToStep`, par un minteur de texte (`t`, `refLabel`, `composeRollLabel`), ou par une fabrique d’adresse (`adresseDeCreation`, `adresseLue`).';

/** VERROU DES MARQUES — les trois ROUTES DE FORGE (cast `as`, cast `<T>`, alias qui déguiserait le nom).
 *  Défini ICI parce que DEUX blocs le déclarent : en flat config, le dernier bloc qui pose une règle
 *  REMPLACE ses options — un bloc qui l'omettrait désarmerait le verrou au lieu de s'y ajouter. */
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
 *  par `scriptKindDe` (`scripts/guards/lib/dialecte.mjs`), source unique. Défini ICI parce que DEUX
 *  blocs le posent : en flat config, le dernier bloc qui déclare une règle REMPLACE ses options — le
 *  bloc de l'ordre total (plus bas, plus étroit) doit donc le REDIRE, sinon `scripts/guards/lib/**`
 *  sortirait du mur. Un kind CONSTANT légitime se dit AU SITE (`eslint-disable-next-line` + raison),
 *  jamais par une exemption de fichier. */
const VERROU_DIALECTE = [{
  selector: "MemberExpression[property.name='ScriptKind']",
  message: 'Dialecte de parse (#1679 L3b) : le `ts.ScriptKind` se déduit de l’extension par `scriptKindDe` (`scripts/guards/lib/dialecte.mjs`) — une table recopiée au site fait lire un `.mts` en TS ici et en JS là, et un scan silencieusement faux ne se voit pas.',
}];

/** MUR DE L'ORDRE TOTAL (#1679 L3b, incident #1620 ; étendu aux tests de `src` par #1709 C3c) — les
 *  NOMS de la marche brute, et les trois messages. Définis ICI parce que DEUX blocs les posent : la
 *  clôture des générateurs et les tests de `src` (par couche). Une recopie divergerait au premier nom
 *  ajouté. `readCorpus` est nommé dans le message : un test qui balaie l'arbre lit un CORPUS. */
const MARCHE_BRUTE = ['readdirSync', 'readdir', 'opendirSync', 'opendir', 'globSync'];
const MSG_ORDRE_TOTAL =
  'Ordre total (#1679 L3b) : lister un dossier passe par `listerDossier`/`listerArbre` (`scripts/guards/lib/lister.mjs`), et LIRE un corpus source par `readCorpus` (`scripts/guards/lib/sourceCorpus.mjs`) — un listing brut suit l’ordre du système de fichiers et périme le doc dérivé sur l’autre OS.';
const MSG_LOCALE_COMPARE =
  'Ordre total (#1679 L3b) : comparer deux chaînes par `parUnitesDeCode` (`scripts/guards/lib/lister.mjs`) — unités de code, jamais `localeCompare`, dont le verdict suit la locale du processus.';

/** Volet IMPORT du mur : les quatre modules `fs`, chacun avec les cinq noms de la marche brute. */
const ORDRE_TOTAL_IMPORTS = {
  paths: ['fs', 'node:fs', 'fs/promises', 'node:fs/promises'].map((name) => ({
    name,
    importNames: MARCHE_BRUTE,
    message: MSG_ORDRE_TOTAL,
  })),
};

/** Volet SYNTAXE du LISTAGE : accès par membre et déstructuration. */
const VERROU_LISTAGE = [
  { selector: `MemberExpression[property.name=/^(${MARCHE_BRUTE.join('|')})$/]`, message: MSG_ORDRE_TOTAL },
  { selector: `ObjectPattern > Property[key.name=/^(${MARCHE_BRUTE.join('|')})$/]`, message: MSG_ORDRE_TOTAL },
];

/** POLICE DE LA POSSESSION À L'AFFICHAGE (#1262 L1) — le motif d'import restreint, DÉFINI ICI parce
 *  que DEUX blocs le posent : la police de `src/ui/**` et, après le mur de l'ordre total (qui
 *  déclare `no-restricted-imports` et REMPLACERAIT donc ses options), les TESTS de `src/ui`. */
const POLICE_POSSESSION = [{
  group: ['**/state/netOwnership', '**/state/netFlow'],
  importNames: ['ownsLocally'],
  message: 'Possession à l’affichage (#1262) : passer par `ui/ownership.ts` (`ownsLocal`/`useOwns`) — le terme `net.mode === "local"` y est déjà mort.',
}];

/** Volet COMPARAISON DE CHAÎNES — porté par la seule clôture des générateurs (cf. le bloc des tests). */
const VERROU_LOCALE_COMPARE = [
  { selector: "CallExpression[callee.property.name='localeCompare']", message: MSG_LOCALE_COMPARE },
];

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
 *  `ImportExpression`), donc l'import DYNAMIQUE lui échappe et revient à `no-restricted-syntax`.
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

export default tseslint.config(
  // `src/data` est LU par ESLint comme le reste de `src` (#1709 C3c-3b) : ses `.ts` (fabriques,
  // grammaire, schémas générés, gardes) passent sous les mêmes verrous et la même pureté de couche ;
  // ses `.json` restent ignorés par `**/*.json` — la DONNÉE n'est pas ce qu'un lint juge.
  { ignores: ['dist/**', 'node_modules/**', 'public/**', '_site/**', '**/*.json', '*.config.*', '.claude/**', 'server/.wrangler/**', '.playwright-mcp/**', '.wt-*/**'] },
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
    // une est le cast. L'exemption est AUX MINTEURS (`rollSeam`, `revealStep`, `rollRowBuild` : forger la
    // marque EST leur corps de métier, une fois, dans leur corps) ; une exemption AU SITE (un
    // `eslint-disable-next-line` porteur de sa raison) reste possible là où une marque effacée doit être
    // postulée. Partout ailleurs le cast rendrait la marque décorative.
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
    // le texte destiné à l'œil du joueur. Ses MINTEURS sont exemptés au FICHIER (`i18n/index.ts` pour
    // `t()`, `state/rollSeam.ts` pour `composeRollLabel` — déjà dans la liste), et le minteur de fixture
    // `i18n/fixtureText.ts` est SOUS la règle avec son exemption AU SITE : un second cast
    // y échouerait. Même régime pour le MINTEUR (b), les libellés de la donnée (#1709 C3c-3b, depuis que
    // `src/data` est linté) : `data/index.ts` (`dataLabel`) et `data/mutations.ts`
    // (`mutationTablePlayerLabel`) portent chacun son exemption AU SITE — un troisième cast y échouerait.
    // QUATRIÈME MARQUE (#1988) : `AdresseDeCreation` (`src/engine/adresseDeCreation.ts`), la clé des choix
    // de création. Même régime que le minteur (b) : l'unique cast de ses fabriques porte son exemption
    // AU SITE ; un cast ailleurs forgerait une adresse depuis un texte quelconque.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/state/rollSeam.ts', 'src/state/revealStep.ts', 'src/ui/rollRowBuild.ts', 'src/i18n/index.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...VERROU_MARQUES],
    },
  },
  {
    // LES DEUX CONTOURNEMENTS DE CONTENEUR (#1318 V8a₀) — marquer `label` au type ferme la déclaration
    // DIRECTE, pas les deux voies qui recomposent l'étape ENTIÈRE et blanchissent le champ au passage :
    //  T1. `Object.assign(step, { label: '…' })` — la signature `assign<T,U>(t: T, s: U): T & U` ne
    //      vérifie RIEN contre `T` : le champ marqué se réécrit en `string` sans un mot de `tsc`.
    //  T2. `x as CascadeStep` — le cast de CONTENEUR : tout littéral y entre, `label` compris. Les casts
    //      internes des 7 portes du seam visent `BuiltCascadeStep` et restent exemptés AU FICHIER
    //      (`rollSeam`/`revealStep`) : ils ne blanchissent plus rien depuis que la marque est exigée EN
    //      AMONT, au paramètre de leur SPEC — c'est la déclaration qui est murée, pas la sortie.
    // Le sélecteur T1 est SYNTAXIQUE (un lint ne type pas la cible) : il vise `Object.assign` dont un
    // argument littéral porte un `label`. Le seul site RÉEL du dépôt (`interludeFlow.ts`, un
    // `Partial<PendingActivityFields>` — pas une étape) porte son exemption AU SITE avec sa raison.
    // Les fichiers de TEST sont hors du sélecteur T2 : leurs `as CascadeStep` sont GELÉS nominativement
    // et décroissants — le COMPTE vit dans `GEL_AS_CASCADE_STEP` (`state/player-text-ratchet.test.ts`,
    // cible 0), jamais ici : un chiffre recopié en commentaire ment au premier lot qui l'abaisse. Un gel
    // mesuré vaut mieux qu'une exemption muette, et le code de PRODUCTION, lui, n'en a plus AUCUN (mesuré).
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/state/rollSeam.ts', 'src/state/revealStep.ts', 'src/ui/rollRowBuild.ts', 'src/i18n/index.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      // Les marques sont REDITES ici : en flat config, le DERNIER bloc qui déclare une règle REMPLACE
      // ses options — les omettre désarmerait le verrou #1262/#1318 sur tout le code de production
      // (mesuré : les `eslint-disable` d'un fichier exempté AU SITE devenaient INUTILISÉS, symptôme du désarmement).
      'no-restricted-syntax': ['error', ...VERROU_MARQUES, ...VERROU_CONTENEUR],
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
      'no-restricted-imports': ['error', { patterns: POLICE_POSSESSION }],
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
      // La PURETÉ DE COUCHE de `src/state` est REDITE ici : en flat config, le dernier bloc qui
      // déclare une règle REMPLACE ses options — deux blocs `src/state/**` déclarant
      // `no-restricted-imports` s'écraseraient l'un l'autre. Les trois goulots exemptés ci-dessus le
      // sont du seul CANAL D'ISSUE : ils restent sous la pureté par le bloc qui les nomme, plus bas.
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/flowOutcomes'],
          message: 'Canal d’issue (#1262 V3 Lj) : déclarer `issue` au flux (`RollFlowSpec.issue`) et acquitter par `flow.apply(get, …)` — un site ne rédige plus sa ligne d’issue.',
        }, ...pureteImports('state', AVALS_STATE).patterns],
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
      'no-restricted-syntax': ['error', ...VERROU_DIALECTE],
    },
  },
  {
    // MUR DE L'ORDRE TOTAL (#1679 L3b, incident #1620) : dans la clôture des générateurs de dérivés,
    // un listing de répertoire passe par `listerDossier`/`listerArbre` (`scripts/guards/lib/lister.mjs`)
    // et une comparaison de chaînes par `parUnitesDeCode`. Sans cela le même dépôt rend deux `.md`
    // différents selon la machine (NTFS trie sans casse, ext4 rend l'ordre d'un hash ; `localeCompare`
    // suit l'ICU du processus) et la CI rougit MUETTE sur un doc simplement périmé.
    //
    // La PORTÉE de ce bloc est vérifiée, pas postulée : `scripts/guards/lib/lister.test.mjs` marche la
    // clôture d'imports NON bornée de `GENERATORS` ∪ `NON_GENERATOR_CHECKS` (`scripts/docs/build-all.mjs`)
    // et échoue en NOMMANT tout module atteint qui ne serait sous aucun des globs ci-dessous — la liste
    // se lit DEPUIS ce fichier, jamais recopiée.
    //
    // DEUX règles, parce qu'aucune ne suffit seule (mesuré sur 11 formes d'écriture) :
    // `no-restricted-imports` prend l'import nommé, l'alias et le namespace ; `no-restricted-syntax`
    // prend l'accès par membre (`fs.readdirSync`, `fs.promises.readdir`, `(await import('fs')).readdirSync`,
    // `require('fs').readdirSync`) et la déstructuration. `no-restricted-properties` a été mesurée
    // INSUFFISANTE : elle ne sait pas exprimer `fs.promises.readdir` (4 formes sur 11 la franchissent).
    // Exemption au FICHIER pour la source elle-même (précédent `flowOutcomes.ts` ci-dessus, « la source
    // elle-même ») ; le crochet de l'enregistreur de lectures porte ses exemptions AU SITE, avec leur raison.
    files: [
      'scripts/docs/**', 'scripts/raw/**', 'scripts/guards/lib/**',
      // Les deux racines du registre qui ne vivent dans aucun de ces trois dossiers.
      'scripts/gen-sorts-doc.mts', 'scripts/data/check-progression-schemas.mjs',
    ],
    ignores: ['scripts/guards/lib/lister.mjs'],
    rules: {
      'no-restricted-imports': ['error', ORDRE_TOTAL_IMPORTS],
      // `VERROU_DIALECTE` est REDIT ici : en flat config, le dernier bloc qui déclare une règle REMPLACE
      // ses options — l'omettre désarmerait le mur du dialecte sur `scripts/guards/lib/**`, où vivent 12
      // des 14 sites migrés.
      'no-restricted-syntax': ['error', ...VERROU_DIALECTE, ...VERROU_LISTAGE, ...VERROU_LOCALE_COMPARE],
    },
  },
  {
    // PURETÉ DU MOTEUR (#1709 C3b-2 ; CLAUDE.md règle 3, issue #8) — `src/engine` est la couche RÈGLES,
    // PURE : `state`/`ui`/`gameIso` en dépendent, JAMAIS l'inverse. Les fichiers de TEST sont hors
    // portée : ils exercent légitimement le runtime des couches aval (`runPureFlowLines`,
    // `applyTriggeredEffects`, `combatantVisuals`…) — ce sont des consommateurs, pas le moteur.
    // `VERROU_MARQUES`/`VERROU_CONTENEUR` sont REDITS : en flat config, le dernier bloc qui déclare
    // `no-restricted-syntax` REMPLACE ses options — les omettre désarmerait #1262/#1318 sur `src/engine`.
    files: ['src/engine/**/*.ts', 'src/engine/**/*.tsx'],
    ignores: ['src/engine/**/*.test.ts', 'src/engine/**/*.test.tsx'],
    rules: {
      'no-restricted-imports': ['error', pureteImports('engine', AVALS_ENGINE)],
      'no-restricted-syntax': ['error', ...VERROU_MARQUES, ...VERROU_CONTENEUR, ...pureteSyntaxe('engine', AVALS_ENGINE)],
    },
  },
  {
    // PURETÉ DE `state` — volet IMPORT DYNAMIQUE (#1709 C3b-2 ; règle 3, #161). Le volet statique est
    // déclaré plus haut, DANS le bloc du canal d'issue (une seule déclaration de `no-restricted-imports`
    // par périmètre). Tests hors portée, même raison que pour le moteur. `rollSeam`/`revealStep` sont
    // traités par le bloc suivant : ils sont MINTEURS des marques, donc hors `VERROU_MARQUES`.
    files: ['src/state/**/*.ts', 'src/state/**/*.tsx'],
    ignores: ['src/state/**/*.test.ts', 'src/state/**/*.test.tsx', 'src/state/rollSeam.ts', 'src/state/revealStep.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...VERROU_MARQUES, ...VERROU_CONTENEUR, ...pureteSyntaxe('state', AVALS_STATE)],
    },
  },
  {
    // Les deux MINTEURS de `src/state` : exemptés des verrous de marque (forger la marque EST leur
    // corps de métier), JAMAIS de la pureté de couche — sans ce bloc, la règle du dessus les ferait
    // sortir du radar de l'import dynamique.
    files: ['src/state/rollSeam.ts', 'src/state/revealStep.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...pureteSyntaxe('state', AVALS_STATE)],
    },
  },
  {
    // Les trois goulots du canal d'issue restent SOUS la pureté de couche : leur exemption ne porte
    // que sur `flowOutcomes` (bloc du canal, plus haut, qui les `ignores`).
    files: ['src/state/flowOutcomes.ts', 'src/state/rollFlowSpecs.ts', 'src/state/encounterPsychFlow.ts'],
    rules: {
      'no-restricted-imports': ['error', pureteImports('state', AVALS_STATE)],
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
    // `VERROU_MARQUES`/`VERROU_CONTENEUR` sont REDITS : en flat config, le dernier bloc qui déclare
    // `no-restricted-syntax` REMPLACE ses options — ce sont exactement les deux que les fichiers
    // non-test de `src/data` résolvent (mesuré par `calculateConfigForFile` sur `data/index.ts`).
    files: ['src/data/**/*.ts', 'src/data/**/*.tsx'],
    ignores: ['src/data/**/*.test.ts', 'src/data/**/*.test.tsx'],
    rules: {
      'no-restricted-imports': ['error', pureteImports('data', AVALS_DATA)],
      'no-restricted-syntax': ['error', ...VERROU_MARQUES, ...VERROU_CONTENEUR, ...pureteSyntaxe('data', AVALS_DATA)],
    },
  },
  {
    // MUR DE L'ORDRE TOTAL — LES TESTS DE `src` (#1709 C3c-1). Une garde qui balaie l'arbre réel lit un
    // CORPUS : `readCorpus` (`scripts/guards/lib/sourceCorpus.mjs`, mémoïsé, gelé, ordre total, refus du
    // vide par base) ; un LISTAGE de dossier passe par `listerDossier`/`listerArbre`. La marche brute
    // n'est plus écrivable ici — ni par import nommé, ni par membre, ni par déstructuration.
    // PÉRIMÈTRE (#1709 C3c-3b) : TOUT test de `src`, en UNE paire de globs — un dossier neuf sous
    // `src/` naît donc SOUS le mur, sans qu'on ait à y penser.
    // `VERROU_MARQUES` est REDIT : en flat config, le dernier bloc qui déclare `no-restricted-syntax`
    // REMPLACE ses options — c'est la seule option que ces tests résolvent aujourd'hui (mesuré sur la
    // config résolue, cf. `src/eslint-ordre-total-et-purete.test.ts`), l'omettre désarmerait #1262/#1318.
    // `VERROU_LOCALE_COMPARE` n'est PAS repris : l'ordre total vise le déterminisme cross-OS des docs
    // DÉRIVÉS ; un test qui asserte l'ordre que le PRODUIT rend par locale (`src/ui/compendium/
    // relations.test.ts` compare la donnée réelle à `localeCompare(b, 'fr')` ; deux scénarios trient des
    // ids en `{ numeric: true }`, que `lister.mjs` ne sait pas exprimer) mesure un contrat PRODUIT, pas
    // un listing — le refuser ici exigerait des exemptions au site.
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      'no-restricted-imports': ['error', ORDRE_TOTAL_IMPORTS],
      'no-restricted-syntax': ['error', ...VERROU_MARQUES, ...VERROU_LISTAGE],
    },
  },
  {
    // … et la POLICE DE LA POSSESSION redite pour les TESTS de `src/ui` : le bloc ci-dessus déclare
    // `no-restricted-imports`, donc il REMPLACE les options que ces fichiers résolvaient (mesuré :
    // eux seuls, parmi les sept couches, portaient une `no-restricted-imports`). Les deux volets se
    // posent ICI dans la MÊME option — `paths` pour la marche brute, `patterns` pour la possession —,
    // chacun depuis sa constante : rien n'est recopié, et le mur reste le même pour toutes les couches.
    files: ['src/ui/**/*.test.ts', 'src/ui/**/*.test.tsx'],
    rules: {
      'no-restricted-imports': ['error', { ...ORDRE_TOTAL_IMPORTS, patterns: POLICE_POSSESSION }],
    },
  },
);

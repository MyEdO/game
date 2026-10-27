import js from '@eslint/js';
import globals from 'globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectLabelEntityResolvers } from './scripts/guards/lib/labelLogic.mjs';
import { RACINES_DES_ZONES, SURFACE_DU_NOYAU, ZONES_SANS_REEXPORTATION, dossierDe } from './scripts/guards/lib/couches.mjs';

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
  'Ordre total (#1679 L3b) : lister un dossier passe par `listerDossier`/`listerEntrees`/`listerArbre` (`scripts/guards/lib/lister.mjs`), et LIRE un corpus source par `readCorpus` (`scripts/guards/lib/sourceCorpus.mjs`) — un listing brut suit l’ordre du système de fichiers et périme le doc dérivé sur l’autre OS.';
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

const STOCKAGES_WEB = ['localStorage', 'sessionStorage'];
const MSG_STOCKAGE_WEB = 'Stockage web (#1897) : le `localStorage` et le `sessionStorage` ne se touchent que par `stockageWeb(genre)` ou `lireDictionnaire` (`src/web/stockageWeb.ts`), quel que soit l’objet porteur (`window`, `globalThis`, `self`, déstructuration, accès indexé).';

const REMEDE_CONSOLE = 'rendre l’information VISIBLE, la nommer en `aria-label`/`aria-describedby`, ou la confier au popover `CodexRef` (verbatim de la donnée)';
const VERROU_CONSOLE = [{
  selector: 'JSXAttribute > JSXIdentifier.name[name="title"]',
  message: `Infobulle native dans la console (\`title\`) : invisible au tactile, au clavier et à l’arbre d’accessibilité ; ${REMEDE_CONSOLE}.`,
}, {
  selector: ':matches(ObjectExpression, :matches(AssignmentExpression, ForOfStatement, ForInStatement) > ObjectPattern.left, :matches(AssignmentExpression, ForOfStatement, ForInStatement) > :matches(ObjectPattern, ArrayPattern).left ObjectPattern) > Property[key.type="Identifier"][key.name="title"][computed=false][shorthand=false][method=false][kind="init"]',
  message: `Propriété \`title\` de littéral dans la console : elle finit en attribut \`title\` au rendu ; une case nomme son geste et pointe sa règle (\`rule\`, \`gate\`) ; ${REMEDE_CONSOLE}.`,
}];

const PROPRIETAIRE_DATALIST = 'src/ui/compendium/refField/**';
const MSG_DATALIST = 'Datalist (#286, #2724) : le motif `<input list>`/`<datalist>` appartient à `RefField` (`src/ui/compendium/refField/`) — composer `RefField` (modes `freeText`, `vocab`) ou sa saisie libre à suggestions `SaisieSuggeree`.';
const VERROU_DATALIST = [
  'JSXOpeningElement > JSXIdentifier.name[name="datalist"]',
  'JSXOpeningElement[name.name="input"] > JSXAttribute > JSXIdentifier.name[name="list"]',
  'Literal[value=/<datalist\\b/]',
  'Literal[regex.pattern=/<datalist\\b/]',
  'TemplateElement[value.raw=/<datalist\\b/]',
  'CallExpression > Literal.arguments:first-child[value=/^datalist$/i]',
].map((selector) => ({ selector, message: MSG_DATALIST }));

const ROLES_COMPOSITES = '(listbox|radiogroup|tablist|menu|menubar|grid|treegrid|tree)';
const REMEDE_ROLES = 'ne se posent que dans une primitive de `src/ui/composites/` (`Listbox`, `RadioGroup`, `Menu`, `Tabs`) ; composer la primitive';
const ROLE_EN_ATTRIBUT = {
  selector: `:matches(JSXAttribute[name.name="role"], Property[key.name="role"], Property[key.value="role"]) :matches(Literal[value=/^${ROLES_COMPOSITES}$/], TemplateElement[value.cooked=/^${ROLES_COMPOSITES}$/])`,
  message: `Rôle ARIA composite (#414) : \`listbox\`, \`radiogroup\`, \`tablist\`, \`menu\`, \`menubar\`, \`grid\`, \`treegrid\` et \`tree\` portent un clavier à roving tabindex et ${REMEDE_ROLES}.`,
};
const LITTERAL_DE_ROLE = 'Literal, TemplateLiteral[expressions.length=0], Identifier[name="undefined"]';
const SET_ATTRIBUTE_ROLE = 'CallExpression:matches([callee.property.name="setAttribute"], [callee.property.value="setAttribute"])[arguments.0.value="role"]';
const MSG_ROLE_CALCULE = `Rôle ARIA calculé (#414, #2724) : hors \`src/ui/composites\`, un \`role\` s’écrit en littéral au JSX (une conditionnelle de littéraux passe) et ne se pose ni par \`setAttribute\` à valeur calculée ni par affectation \`.role =\` — un rôle calculé ne se juge pas ; les rôles composites à roving tabindex ${REMEDE_ROLES}.`;
const ROLES_CALCULES = [
  `JSXAttribute[name.name="role"] > JSXExpressionContainer > :not(${LITTERAL_DE_ROLE}, ConditionalExpression)`,
  `JSXAttribute[name.name="role"] > JSXExpressionContainer > ConditionalExpression > :matches(.consequent, .alternate):not(${LITTERAL_DE_ROLE})`,
  `${SET_ATTRIBUTE_ROLE}:not([arguments.1.type="Literal"])`,
  `${SET_ATTRIBUTE_ROLE}[arguments.1.value=/^${ROLES_COMPOSITES}$/]`,
  'AssignmentExpression > MemberExpression.left:matches([computed=false][property.name="role"], [property.value="role"])',
].map((selector) => ({ selector, message: MSG_ROLE_CALCULE }));
const roleEnHtml = (roles) => {
  const motif = `/role=["']${roles}["']/`;
  return {
    selector: `:matches(Literal[value=${motif}], TemplateElement[value.cooked=${motif}], JSXText[value=${motif}])`,
    message: `Rôle ARIA composite écrit en HTML (#414) : un \`role\` à roving tabindex ${REMEDE_ROLES}.`,
  };
};

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

  'scripts/gen-registry.mjs', 'scripts/gen-sorts-doc.mts', 'scripts/gen-formats.mjs', 'scripts/gen-verbes.mjs',
  'scripts/data/check-progression-schemas.mjs',

  'scripts/test/partition.mjs',
];

const SOURCE_DU_MUR = ['scripts/guards/lib/lister.mjs'];

/** Le code des zones de `COUCHES` (#2882, #2928) : `src/`, et les hôtes externes (`hotes/`). */
const CODE_DES_ZONES = RACINES_DES_ZONES.map((r) => `${r}/**`);
const TS_DES_ZONES = RACINES_DES_ZONES.flatMap((r) => [`${r}/**/*.ts`, `${r}/**/*.tsx`]);

const SOURCE_DES_MINUTERIES = 'src/web/minuteries.ts';
const MINUTERIES = ['setTimeout', 'setInterval'];
const HOTES = ['window', 'globalThis', 'self', 'global'];
const MODULES_DE_MINUTERIES = ['timers', 'node:timers', 'timers/promises', 'node:timers/promises'];
const APPEL_DE_MINUTERIE = `:matches(CallExpression, NewExpression) > Identifier.callee[name=/^(${MINUTERIES.join('|')})$/]`;
const MSG_MINUTERIE = `Minuterie nue (#405, #415, #2817) : \`src/engine\` n’en pose aucune ; sous src/noyau, un appel différé passe par \`programmer\` (\`src/noyau/plateforme.ts\`) ; sous src/state, src/lib et src/web, un timer réel passe par \`scheduleCombatTimer\`/\`scheduleFlowTimer\` (\`${SOURCE_DES_MINUTERIES}\`). Les deux voies aboutissent au registre tracé que \`clearTrackedTimers\` annule au teardown de test.`;

const MSG_SANS_HOTE = 'Sans hôte (#2817, AGENTS.md règle 3) : `src/engine` et `src/noyau` tournent sans hôte, qui leur FOURNIT ce qu’ils ne tirent pas d’eux-mêmes : un tirage passe par le `RNG` que l’appelant nomme (`battleRng()` au noyau, semé par l’hôte de `graineDEntropie`, `src/web/entropie.ts`), l’heure du jeu par `gameTime` de l’état, un appel différé par `programmer` (`src/noyau/plateforme.ts`), un id unique d’un projet à l’autre par l’appelant (`idDEntropie` de l’hôte ; `nextEntityId` au sein d’une collection), le navigateur par les services de `src/web`.';
const MSG_ENTROPIE = 'Entropie (#2817) : `Math.random` ne s’écrit que dans `src/web/entropie.ts`, le seul site d’entropie de `src/` — un jet de règle prend un `RNG` nommé par l’appelant, une présentation ou un son tire de `entierDEntropie`, une graine de `graineDEntropie`, un id d’entité de `idDEntropie`.';
const VERROU_ENTROPIE = [
  { object: 'Math', property: 'random' },
  { property: 'Math' },
].map((cible) => ({ ...cible, message: MSG_ENTROPIE }));
const VERROU_SANS_HOTE = [
  { object: 'Date', property: 'now' },
  { property: 'Date' },
].map((cible) => ({ ...cible, message: MSG_SANS_HOTE }));
const VERROU_SANS_HOTE_SYNTAXE = [
  "NewExpression[callee.name='Date'][arguments.length=0]",
  "CallExpression[callee.name='Date']",
].map((selector) => ({ selector, message: MSG_SANS_HOTE }));
const GLOBALES_D_HOTE = [...HOTES, 'performance', 'crypto', 'document', 'navigator', 'location', 'fetch', 'indexedDB', 'process', 'queueMicrotask', 'requestIdleCallback', 'requestAnimationFrame'];

const TYPES_CLAVIER = '/^key(down|up|press)$/';
const GESTIONNAIRES_CLAVIER = '/^onkey(down|up|press)$/';
const NOM_DE_POSE = '/^addEventListener$/';
const POSE = `CallExpression:matches([callee.property.name=${NOM_DE_POSE}], [callee.property.value=${NOM_DE_POSE}], [callee.type="Identifier"][callee.name=${NOM_DE_POSE}])`;
const MSG_CLAVIER_GLOBAL = 'Clavier (#1687, #2724) : hors `src/ui/clavier`, un écouteur `keydown`/`keyup`/`keypress` ne se pose sur AUCUN receveur (fenêtre, document, alias, élément) et son type ne s’écrit nulle part : une couche passe par un hook de `src/ui/clavier/couches/` qui nomme son geste sans prendre de gestionnaire (porte d’Échap, piège du dialogue), le remap d’un raccourci par `useRemapDeTouche` (`src/ui/clavier/remapDeTouche.ts`), un élément par son `onKeyDown` JSX, un raccourci d’application par le registre (`src/state/clavier/keybindings.ts`).';
const MSG_TYPE_CALCULE = `${MSG_CLAVIER_GLOBAL} Le type d’un écouteur s’écrit en littéral : un type calculé ne se juge pas.`;
const MSG_POSE_DETOURNEE = `${MSG_CLAVIER_GLOBAL} \`addEventListener\` s’appelle directement : une référence détournée (alias, \`.call\`, \`.bind\`, déstructuration) ne se juge pas.`;
const VERROU_CLAVIER_GLOBAL = [
  { selector: `:matches(Literal[value=${TYPES_CLAVIER}], TemplateElement[value.cooked=${TYPES_CLAVIER}])`, message: MSG_CLAVIER_GLOBAL },
  { selector: `${POSE}:not([arguments.0.type="Literal"]):not([arguments.0.type="TemplateLiteral"][arguments.0.expressions.length=0])`, message: MSG_TYPE_CALCULE },
  { selector: `MemberExpression:matches([property.name=${NOM_DE_POSE}], [property.value=${NOM_DE_POSE}]):not(CallExpression > MemberExpression.callee)`, message: MSG_POSE_DETOURNEE },
  { selector: `Property:matches([key.name=${NOM_DE_POSE}], [key.value=${NOM_DE_POSE}])`, message: MSG_POSE_DETOURNEE },
  { selector: `:matches(Identifier[name=${GESTIONNAIRES_CLAVIER}], Literal[value=${GESTIONNAIRES_CLAVIER}], TemplateElement[value.cooked=${GESTIONNAIRES_CLAVIER}])`, message: MSG_CLAVIER_GLOBAL },
];
const MSG_ECHAP = 'Échap (#1476, #2724) : le code de la touche est `CODE_ECHAP` (`src/state/clavier/keybindings.ts`) ; une surface qui se ferme à Échap s’empile (`useDismissLayer`/`useModalA11y`) et `resoudreEchap` la congédie.';
const MSG_ECHAP_ALIAS = `${MSG_ECHAP} Ni l’ancien nom \`Esc\` ni le code numérique \`keyCode\` (obsolète) ne désignent une touche.`;
const ECHAP_ALIAS = [
  'Literal[value="Esc"]',
  'TemplateElement[value.cooked="Esc"]',
  'MemberExpression:matches([computed=false][property.name="keyCode"], [property.value="keyCode"])',
].map((selector) => ({ selector, message: MSG_ECHAP_ALIAS }));
const DEFINITION_ECHAP = 'Program > ExportNamedDeclaration > VariableDeclaration[kind="const"] > VariableDeclarator[id.name="CODE_ECHAP"]';
const ECHAP_GABARIT = { selector: 'TemplateElement[value.cooked="Escape"]', message: MSG_ECHAP };
const RESOLVEURS_PAR_LIBELLE = [...collectLabelEntityResolvers(readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), 'src/data/index.ts'), 'utf8'))];
const MSG_RESOLVEUR_PAR_LIBELLE = `Libellé en logique (#1463, #2995) : ${RESOLVEURS_PAR_LIBELLE.map((n) => `\`${n}\``).join(', ')} résolvent une entrée par son LIBELLÉ, couture de SAISIE de \`src/data/index.ts\`. Un test ou un script nomme l’entrée par son id (\`findSpellById\`, \`findTalentById\`, \`find((x) => x.id === …)\`) ; une saisie « format livre » s’éprouve par son parseur (\`refFormatLivre\`, \`parseQualityInstance\`).`;
const NOMS_RESOLVEURS_PAR_LIBELLE = `/^(${RESOLVEURS_PAR_LIBELLE.join('|')})$/`;
const VERROU_RESOLVEUR_PAR_LIBELLE = [
  `ImportSpecifier[imported.name=${NOMS_RESOLVEURS_PAR_LIBELLE}]`,
  `ExportSpecifier[local.name=${NOMS_RESOLVEURS_PAR_LIBELLE}]`,
  ...cles('property', NOMS_RESOLVEURS_PAR_LIBELLE).map((c) => `MemberExpression${c}`),
  ...cles('key', NOMS_RESOLVEURS_PAR_LIBELLE).map((c) => `ObjectPattern > Property${c}`),
].map((selector) => ({ selector, message: MSG_RESOLVEUR_PAR_LIBELLE }));
const MSG_ECHAP_IMPORT = 'Échap (#1476, #2724) : `CODE_ECHAP` ne s’importe que sous `src/state/clavier` et `src/ui/clavier` — une surface qui se ferme à Échap s’empile (`useDismissLayer`/`useModalA11y`) et la porte de la pile la congédie ; le remap d’un raccourci passe par `useRemapDeTouche`.';
const MSG_POSITIONS = 'Positions de touche (#1687, #2724) : le registre clavier, son lecteur et son remap lisent `e.code` (la POSITION physique), jamais `e.key` (le caractère, qui ment sur un clavier AZERTY). Les touches NOMMÉES des couches (`src/ui/clavier/couches/`) se lisent par `e.key`.';
const VERROU_POSITIONS = [
  'MemberExpression[computed=false][property.name="key"]',
  'MemberExpression[computed=true][property.value="key"]',
  'ObjectPattern > Property:matches([key.name="key"], [key.value="key"])',
  'Literal[value=/\\be\\.key\\b/]',
  'TemplateElement[value.cooked=/\\be\\.key\\b/]',
].map((selector) => ({ selector, message: MSG_POSITIONS }));

// #2278, #2280
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
  DOLLAR_DE('"ui"', '/^(resolve|log|invalidate|status|toast)$/'),
  `MemberExpression[computed=false][optional=false] > MemberExpression.object${ACCES('"state"')} > Identifier.object`,
  DOLLAR_DE('"session"', '/^(id|root)$/'),
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
  selector: 'MemberExpression[property.name="append"][object.property.name="session"][object.object.name="$"]',
  message: 'Un mod n\'écrit jamais dans l\'historique de la session (`$.session.append`) : le tour suivant relit l\'historique et réécrit le cache de prompt ; la situation se rend au bandeau, en résultat d\'outil ou en bloc `prompt.context` (#2596).',
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
    // #2928
    files: TS_DES_ZONES,
    rules: {
      'murs/marques': ['error', ...VERROU_MARQUES],
    },
  },
  {
    // #2928
    files: TS_DES_ZONES,
    excludeFiles: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'murs/conteneur': ['error', ...VERROU_CONTENEUR],
    },
  },
  {
    // #2724
    files: ['src/ui/console/**'],
    excludeFiles: ['src/ui/console/**/*.test.ts', 'src/ui/console/**/*.test.tsx'],
    rules: {
      'murs/console-sans-title': ['error', ...VERROU_CONSOLE],
    },
  },
  {
    // #286, #2724
    files: ['src/**'],
    excludeFiles: [PROPRIETAIRE_DATALIST, 'src/**/*.test.*', 'src/**/*.bench.*'],
    rules: {
      'murs/datalist': ['error', ...VERROU_DATALIST],
    },
  },
  {
    // #414, #2724
    files: ['src/**'],
    excludeFiles: ['src/ui/composites/**'],
    rules: {
      'murs/roles-composites': ['error', ROLE_EN_ATTRIBUT, ...ROLES_CALCULES],
    },
  },
  {
    // #414, #2724
    files: ['src/**/*.tsx'],
    excludeFiles: ['src/ui/composites/**', 'src/**/*.test.tsx'],
    rules: {
      'murs/roles-composites': ['error', ROLE_EN_ATTRIBUT, ...ROLES_CALCULES, roleEnHtml(ROLES_COMPOSITES)],
    },
  },
  {
    // #288, #314, #2724
    files: ['src/**/*.test.tsx'],
    excludeFiles: ['src/ui/composites/**'],
    rules: {
      'murs/roles-composites': ['error', ROLE_EN_ATTRIBUT, ...ROLES_CALCULES, roleEnHtml('tablist')],
    },
  },
  {

    files: ['src/state/**/*.ts', 'src/state/**/*.tsx', 'src/noyau/**/*.ts', 'src/noyau/**/*.tsx'],
    excludeFiles: [
      'src/noyau/flowOutcomes.ts',
      'src/noyau/rollFlowSpecs.ts',
      'src/noyau/encounterPsychFlow.ts',
      'src/state/**/*.test.ts', 'src/state/**/*.test.tsx',
      'src/noyau/**/*.test.ts', 'src/noyau/**/*.test.tsx',
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

    files: [...GLOBS_GENERATEURS, ...RACINES_DES_ZONES.flatMap((r) => [`${r}/**/*.test.ts`, `${r}/**/*.test.tsx`])],
    excludeFiles: SOURCE_DU_MUR,
    rules: REGLES_MARCHE,
  },
  {

    files: GLOBS_GENERATEURS,
    excludeFiles: SOURCE_DU_MUR,
    rules: REGLES_LOCALE,
  },
  {
    // #2882, #2928
    files: CODE_DES_ZONES,
    excludeFiles: ['**/*.test.*', '**/*.bench.*'],
    rules: { 'murs/purete-imports': 'error' },
  },
  {
    // #2882, #2928
    files: CODE_DES_ZONES,
    rules: { 'murs/zone': 'error', 'murs/suite-jouee': 'error' },
  },
  {
    // #2817 D2
    files: ZONES_SANS_REEXPORTATION.map((z) => `${dossierDe(z)}/**`),
    excludeFiles: [SURFACE_DU_NOYAU, '**/*.test.*', '**/*.bench.*', '**/*.testkit.*', '**/*.d.ts'],
    rules: { 'murs/reexportation': 'error' },
  },
  {
    // #328
    files: ['src/noyau/cascade.ts', 'src/noyau/pendings.ts', 'src/ui/CascadeModal.tsx'],
    rules: {
      'murs/quarantaine': ['error', {
        cibles: ['**/*{shipCrew,shipManeuver,crewMorale,crew-roles}*', '**/*{shipCrew,shipManeuver,crewMorale,crew-roles}*/**'],
        message: 'le batch générique de cascade (#328) n’importe rien du domaine naval : le flux propriétaire résout la présentation du participant à la construction (`BatchParticipant`).',
      }],
    },
  },
  {
    // #415, #2724, #2817
    files: ['src/state/**', 'src/noyau/**', 'src/engine/**', 'src/lib/**', 'src/web/**'],
    excludeFiles: [SOURCE_DES_MINUTERIES, 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      'murs/minuteries': ['error', ...MINUTERIES.map((name) => ({ name, message: MSG_MINUTERIE }))],
      'murs/minuteries-hote': ['error', ...HOTES.flatMap((object) => MINUTERIES.map((property) => ({ object, property, message: MSG_MINUTERIE })))],
      'murs/minuteries-import': ['error', { paths: MODULES_DE_MINUTERIES.map((name) => ({ name, importNames: MINUTERIES, message: MSG_MINUTERIE })) }],
      'murs/minuteries-appel': ['error', { selector: APPEL_DE_MINUTERIE, message: MSG_MINUTERIE }],
    },
  },
  {
    // #2817, #2928
    files: CODE_DES_ZONES,
    excludeFiles: ['src/web/entropie.ts', '**/*.test.*', '**/*.bench.*'],
    rules: { 'murs/entropie': ['error', ...VERROU_ENTROPIE] },
  },
  {
    // #2817
    files: ['src/engine/**', 'src/noyau/**'],
    excludeFiles: ['src/**/*.test.*', 'src/**/*.bench.*'],
    rules: {
      'murs/sans-hote': ['error', ...VERROU_SANS_HOTE],
      'murs/sans-hote-syntaxe': ['error', ...VERROU_SANS_HOTE_SYNTAXE],
      'murs/sans-hote-globale': ['error', ...GLOBALES_D_HOTE.map((name) => ({ name, message: MSG_SANS_HOTE }))],
    },
  },
  {
    // #2724, #2928
    files: [...CODE_DES_ZONES, 'scripts/**'],
    rules: { 'murs/interne': 'error' },
  },
  {
    // #1897, #2724, #2928
    files: CODE_DES_ZONES,
    excludeFiles: ['**/*.test.*', '**/*.bench.*'],
    rules: {
      'murs/stockage-web': ['error', ...STOCKAGES_WEB.map((property) => ({ property, message: MSG_STOCKAGE_WEB }))],
      'murs/stockage-web-global': ['error', ...STOCKAGES_WEB.map((name) => ({ name, message: MSG_STOCKAGE_WEB }))],
    },
  },
  {
    // #1463, #2995
    files: ['**/*.test.*', '**/*.bench.*', '**/*.testkit.*', 'scripts/**'],
    rules: {
      'murs/resolveur-par-libelle': ['error', ...VERROU_RESOLVEUR_PAR_LIBELLE],
    },
  },
  {
    // #495, #2724
    files: ['src/**'],
    excludeFiles: ['src/ui/editor/**', 'src/ui/gallery/**', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      'murs/atelier': ['error', {
        patterns: [{
          group: ['**/editor/GameOpEditor', '**/editor/GameOpEditor.*', '**/editor/ConditionEditor', '**/editor/ConditionEditor.*', '**/editor/refsDOp', '**/editor/refsDOp.*'],
          message: 'Atelier (#495) : `GameOpEditor`, `ConditionEditor` et la palette d’auteur `refsDOp` ne servent qu’à l’atelier (`src/ui/editor/`, et la galerie DEV `src/ui/gallery/`) — une surface joueur compose `opRows`/`GameOpChips`/`humanizeCondition`.',
        }],
      }],
    },
  },
  {
    // CWE-338, #2724
    files: ['server/src/**'],
    excludeFiles: ['server/src/**/*.test.*'],
    rules: {
      'murs/alea-serveur': ['error', ...[
        { object: 'Math', property: 'random' },
        { property: 'Math' },
      ].map((cible) => ({
        ...cible,
        message: 'Aléa du serveur (CWE-338) : `server/src` émet les secrets de partie (token hôte, token de siège, code de room) ; tirer par `secureRandom` (`server/src/rand.ts`).',
      }))],
    },
  },
  {
    // #1687, #2724
    files: ['src/**'],
    excludeFiles: ['src/ui/clavier/**', 'src/**/*.test.*', 'src/**/*.bench.*'],
    rules: { 'murs/clavier-global': ['error', ...VERROU_CLAVIER_GLOBAL] },
  },
  {
    // #1476, #2724
    files: ['src/**'],
    excludeFiles: ['src/state/clavier/**', 'src/**/*.test.*', 'src/**/*.bench.*'],
    rules: { 'murs/echap': ['error', { selector: 'Literal[value="Escape"]', message: MSG_ECHAP }, ECHAP_GABARIT, ...ECHAP_ALIAS] },
  },
  {
    // #1476, #2724
    files: ['src/state/clavier/**'],
    excludeFiles: ['src/**/*.test.*', 'src/**/*.bench.*'],
    rules: { 'murs/echap': ['error', { selector: `:not(${DEFINITION_ECHAP}) > Literal[value="Escape"]`, message: MSG_ECHAP }, ECHAP_GABARIT, ...ECHAP_ALIAS] },
  },
  {
    // #1476, #2724
    files: ['src/**'],
    excludeFiles: ['src/state/clavier/**', 'src/ui/clavier/**'],
    rules: { 'murs/echap-import': ['error', { patterns: [{ regex: '(^|/)clavier(/|$)', importNames: ['CODE_ECHAP'], message: MSG_ECHAP_IMPORT }] }] },
  },
  {
    // #1687, #2724
    files: ['src/state/clavier/**', 'src/ui/clavier/**'],
    excludeFiles: ['src/ui/clavier/couches/**', 'src/**/*.test.*', 'src/**/*.bench.*'],
    rules: { 'murs/clavier-positions': ['error', ...VERROU_POSITIONS] },
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

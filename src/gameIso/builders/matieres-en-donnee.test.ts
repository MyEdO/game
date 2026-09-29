import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';
import { repoProgram, virtualProgram, VIRTUAL_ROOT } from '../../../scripts/guards/lib/tsProgram.mjs';
import { codeSeul as sansCommentaires } from '../../../scripts/guards/lib/commentPoison.mjs';
import { materials, semencesDeScene, terrains } from '../../data';

/**
 * GARDE DÉRIVÉE (#1691, élargie #1715, #1716, #1789) — aucune couche ÉMETTRICE du monde ne NOMME une
 * matière, ni un TERRAIN : ni le SOL qu'une scène neuve reçoit (semence, #1716), ni un id de
 * `terrains.json` en littéral (#1716, #1789).
 *
 * Les DEUX BRAS scannent le MÊME périmètre — les cinq couches ci-dessous, même corpus (`fichiers`,
 * une seule marche d'arbre) — et se neutralisent par la MÊME forme : `NEUTRALISEURS` pour les
 * matières, `NEUTRALISEURS_TERRAIN` pour les sols, chacun NOMMÉ, chacun tenu par un test de vie qui
 * le rend ROUGE dès qu'aucun site du périmètre ne l'exerce plus — au grain du CHAMP, une entrée par
 * champ (`neutraliseursDeChamp`), pour qu'un homonyme qui meurt rougisse SEUL. Un homonyme se
 * neutralise par le NOM DU CHAMP (`key:`, `cargoId:`, `part:`, `scope:`), par le
 * TYPE ATTENDU au site du littéral quand c'est un VOCABULAIRE d'union (checker TypeScript), par une
 * UNION de littéraux ÉCRITE EN PLACE (paramètre, champ) ou par une SEMENCE d'authoring GELÉE
 * (`as const satisfies Fige<…Defaults>`) — jamais par un nom de fichier, jamais par un site toléré.
 *
 * Le relief était le dernier domaine de `MaterialRef` dont l'id était choisi EN CODE
 * (`floors.ts` : `'pilier'`, `'pierre'`, `'terre'`) ; il vient de la donnée comme les autres — la
 * SCÈNE (`reliefDefaults`) pour les parois de relief, le TERRAIN (`terrains.json › matiere`) pour le
 * flanc d'un bloc plein, le BÂTIMENT (`buildings.json › roofMaterial`) pour sa couverture par
 * défaut. Ce que la garde interdit, c'est le RETOUR de ce choix : un id de `materials.json` écrit en
 * dur dans une couche qui ÉMET de la géométrie ou du catalogue.
 *
 * PÉRIMÈTRE (les CINQ couches qui émettent — `src/ui/editor/**` depuis #1716 : la palette et le
 * redimensionnement POSENT le sol d'une scène, rien ne les tenait) : `src/gameIso/builders/**` (géométrie pure),
 * `src/gameIso/authoring/*Svg.ts` (peintres du plan et de l'éditeur), `src/gameIso/catalog/**`
 * (catalogues et façades de donnée), et `src/state/**` ENTIER — la DÉRIVATION des masses de toit y
 * émet le `material` de chaque masse (`sceneEdit.ts`, #1715 volet b : il se résout corps > type de
 * bâtiment > scène), et le reste du store pose les mutations de scène que le rendu consomme.
 * Hors périmètre : le rig, les backends et le stage, où `plan` n'est pas une matière de toiture mais
 * la VOIE DE CORPS d'une créature (`bodyPlan.ts`) — un scan naïf de `src/gameIso/**` y compte 42
 * homonymes qui ne sont pas des émissions de matière.
 *
 * Le vocabulaire interdit est DÉRIVÉ du dataset — aucune liste récitée ici : une matière ajoutée
 * demain est gardée le jour même. Les fichiers de TEST sont hors scan : ils POSENT des matières en
 * fixture, ce qui est le geste d'un auteur, pas un choix du moteur. Les commentaires sont retirés
 * avant la mesure : une réf `pierre` en prose n'est pas une émission.
 *
 * AUCUNE exception nominative : le stock mesuré est vide, il doit le rester.
 */
const GAMEISO = fileURLToPath(new URL('../', import.meta.url));
/** Racine du dépôt : `readCorpus` rend ses chemins relatifs à elle. */
const RACINE = fileURLToPath(new URL('../../../', import.meta.url));

/** Les CINQ couches ÉMETTRICES scannées. `prefixe`/`dir` composent le chemin que le rapport porte ;
 *  `recursif: false` borne la couche à la profondeur 1. */
const COUCHES = [
  { prefixe: 'gameIso/', dir: 'builders', recursif: true, filtre: (f: string) => /\.tsx?$/.test(f) },
  { prefixe: 'gameIso/', dir: 'authoring', recursif: false, filtre: (f: string) => /Svg\.tsx?$/.test(f) },
  { prefixe: 'gameIso/', dir: 'catalog', recursif: true, filtre: (f: string) => /\.tsx?$/.test(f) },
  { prefixe: '', dir: '.', recursif: true, filtre: (f: string) => /\.tsx?$/.test(f) },
  { prefixe: 'ui/', dir: 'editor', recursif: true, filtre: (f: string) => /\.tsx?$/.test(f) },
] as const;

/** BASE de lecture d'une couche, DÉRIVÉE de son préfixe et de son dossier — chemin POSIX depuis la
 *  racine du dépôt, la forme que `readCorpus` prend et rend. La racine du store est `src/state`,
 *  celle des trois couches de rendu `src/gameIso/<dossier>`. */
const baseDe = (c: (typeof COUCHES)[number]) => `src/${c.prefixe}${c.dir === '.' ? 'state' : c.dir}`;

/** Le STORE seul (la couche `src/state`, sans préfixe) : les autres couches portent le leur. */
const duStore = (rel: string) => !/^(gameIso|ui)\//.test(rel);

/** Le chemin que le RAPPORT porte, depuis `src/` : le store est la seule couche sans préfixe. */
const chemin = (rel: string) => (duStore(rel) ? `state/${rel}` : rel);

/**
 * Les SIGNAUX STRUCTURELS du store, chacun neutralisé par `codeSeul` — aucun nom de fichier,
 * aucune ligne : c'est la FORME qui dit qu'un littéral n'est pas une émission de matière.
 *  - la clé `scope:` porte la PORTÉE d'un avertissement de validation, où `plan` est le plan de scène ;
 *  - une déclaration `… as const satisfies <X>Defaults` est une SEMENCE d'authoring GELÉE : depuis
 *    #1716 la semence VIVANTE est de la donnée (`semences-de-scene.json`, lue par `emptyScene`), et
 *    la forme ne subsiste qu'aux MIGRATIONS de projet (`worldMap.ts`), qui reconstituent la valeur
 *    d'avant leur lot — la matière y est écrite pour être POSÉE sur un vieux document, pas émise par
 *    un builder. Le `satisfies` est ce qui distingue la semence d'un littéral libre ; la cible est
 *    `Fige<…Defaults>` (#1789), et cette reconnaissance par REGEX passe au checker (#1789 train D).
 */
const SIGNAUX_STRUCTURELS = [
  { nom: 'clé `scope:` (portée d’un avertissement)', re: /\bscope:/, portee: 'ligne' },
  { nom: 'SEMENCE `as const satisfies …Defaults`', re: /\bas const satisfies\s+(?:Fige<)?\w*Defaults>?\b/, portee: 'bloc' },
] as const;

/** Les signaux de PORTÉE LIGNE, en une seule passe. */
const LIGNE_STRUCTURELLE = new RegExp(
  SIGNAUX_STRUCTURELS.filter((s) => s.portee === 'ligne').map((s) => s.re.source).join('|'),
);
/** La DÉCLARATION d'une semence, du `=` au `satisfies` : elle porte ses littéraux sur plusieurs lignes. */
const SEMENCE_DECL = /=\s*\{[^{}]*\}\s*as const satisfies\s+(?:Fige<)?\w*Defaults>?\b/g;

/** Tous les fichiers du périmètre : la marche de l'arbre ET la lecture viennent de la primitive de
 *  corpus (`readCorpus`, une clé par base, `*.test.*` hors corpus). Le chemin rendu est celui que le
 *  rapport porte — relatif à `src/` pour les couches de `gameIso`, à `src/state/` pour le store. */
function fichiersDuPerimetre(): { rel: string; source: string; code: string }[] {
  return COUCHES.flatMap((c) =>
    readCorpus([baseDe(c)])
      .map(({ rel, text }) => ({ source: rel, f: rel.slice(baseDe(c).length + 1), text }))
      .filter(({ f }) => (c.recursif || !f.includes('/')) && c.filtre(f.slice(f.lastIndexOf('/') + 1)))
      .map(({ source, f, text }) => ({ rel: `${c.prefixe}${c.dir === '.' ? '' : `${c.dir}/`}${f}`, source, code: text })),
  );
}

/** Le code SANS ses commentaires, lignes préservées — mesure COMMUNE aux deux bras (matières et
 *  semence de terrain) : une réf en prose n'est jamais une émission, quel que soit le vocabulaire.
 *  La coupe vient de la primitive de garde (`codeSeul`, `scripts/guards/lib/commentPoison.mjs`), qui
 *  balaie les CHAÎNES et les littéraux de regex avant de blanchir un span de commentaire : un `//`
 *  à l'intérieur d'une chaîne (`'http://x'`) ne tronque pas la ligne, et la mesure des littéraux qui
 *  suivent reste faite. */
function codeNu(src: string): string[] {
  return sansCommentaires(src).split('\n');
}

/** Un littéral de chaîne VIDÉ, ses bornes gardées : une neutralisation ne déplace aucune colonne. */
const litteraux = (t: string) => t.replace(/(['"`])[^'"`\n]*\1/g, (m) => `${m[0]}_${m[0]}`);

/** UNION de littéraux d'un TYPE (`'lieu' | 'commerce' | 'plan'`) : un type ne rend rien — il DÉCLARE
 *  le vocabulaire d'un état d'IU. Neutralisée comme une collection, pas comme un fichier. */
const UNION_DE_LITTERAUX = /(['"`])[^'"`\n]*\1(\s*\|\s*(['"`])[^'"`\n]*\3)+/g;

/** CLÉS D'ONGLET déclarées DANS LE FICHIER (`key: '…'`) : la comparaison d'un ÉTAT D'ONGLET à sa clé
 *  (`placeTab === 'plan'`) lit un état d'IU, elle n'émet aucune face — la déclaration et sa lecture
 *  sont le MÊME signal, pris dans le même fichier. */
const clesDOnglet = (src: string): Set<string> =>
  new Set([...src.matchAll(/\bkey:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]));

/** Neutralisation d'un CHAMP dont le vocabulaire N'EST PAS celui des matières, à l'écriture
 *  (`part: 'pilier'`) comme à la comparaison (`w.scope === 'plan'`) : c'est le NOM DU CHAMP qui est
 *  le signal, jamais le fichier. Chacun a un homonyme au dataset des matières (`pilier`, `plan`). */
const champHorsMatiere = (champs: string) => {
  const ecriture = new RegExp(`\\b(${champs})\\s*:\\s*(['"\`])[^'"\`]*\\2`, 'g');
  const comparaison = new RegExp(`\\b(${champs})\\s*(===|!==|==|!=)\\s*(['"\`])[^'"\`]*\\3`, 'g');
  return (code: string) => code.replace(ecriture, '$1: _').replace(comparaison, '$1 $2 _');
};

type Neutraliseur = { nom: string; applique: (code: string, onglets: Set<string>) => string };

/**
 * UNE entrée de neutraliseur PAR CHAMP, produite depuis le VOCABULAIRE de chaque champ : le contrat
 * de vie se juge alors au grain du champ, et un homonyme que plus aucun site n'exerce rougit SEUL.
 * Groupés, quatre champs partageaient un verdict — trois morts passaient sous le vivant.
 */
const neutraliseursDeChamp = (vocabulaires: Record<string, string>): { nom: string; applique: (code: string) => string }[] =>
  Object.entries(vocabulaires).map(([champ, vocabulaire]) => ({
    nom: `champ \`${champ}\` (${vocabulaire})`,
    applique: champHorsMatiere(champ),
  }));

/**
 * Les NEUTRALISEURS de ligne, chacun NOMMÉ — la table EST le contrat : un neutraliseur que plus
 * aucun site du périmètre n'exerce est une exemption morte, et le test de vie le rend ROUGE.
 *  - UNE entrée par CHAMP (`neutraliseursDeChamp`), son libellé portant le VOCABULAIRE du champ :
 *    `part` partie de face, `scope` portée d'un avertissement de validation, `key` clé de récap /
 *    d'IU — chacun a un homonyme au dataset des matières. `kind` (type de sélection d'un éditeur) n'y
 *    figure PAS : aucun `kind:` du périmètre ne porte d'homonyme de MATIÈRE — groupé à `key`, il
 *    passait pour vivant ;
 *  - l'UNION de littéraux d'un type : la DÉCLARATION d'un vocabulaire d'état, pas une émission ;
 *  - la comparaison d'un ÉTAT D'ONGLET à une clé déclarée dans le même fichier : le signal est la
 *    GAUCHE de la comparaison (un identifiant d'onglet, `…Tab`), jamais le fichier — `m.material ===
 *    'plan'` reste une émission dans un fichier qui déclare `key: 'plan'` ailleurs.
 */
const NEUTRALISEURS: readonly Neutraliseur[] = [
  ...neutraliseursDeChamp({
    part: 'partie de face',
    scope: 'portée d’un avertissement',
    key: 'clé de récap / d’IU',
  }),
  { nom: 'UNION de littéraux d’un type', applique: (code) => code.replace(UNION_DE_LITTERAUX, litteraux) },
  {
    nom: 'comparaison d’un état d’ONGLET à une clé déclarée',
    applique: (code, onglets) =>
      onglets.size
        ? code.replace(
            new RegExp(`\\b(\\w*[Tt]ab)\\s*(===|!==|==|!=)\\s*(['"\`])(?:${[...onglets].join('|')})\\3`, 'g'),
            '$1 $2 _',
          )
        : code,
  },
];

/**
 * Le code SEUL, lignes préservées (le rapport porte des `fichier:ligne`) :
 *  - commentaires de bloc et de ligne retirés — une réf en prose n'est pas une émission ;
 *  - chaque NEUTRALISEUR de `NEUTRALISEURS` appliqué à la ligne ; `sauf` en retire UN, et c'est
 *    ainsi que le test de vie mesure ce que chacun blanchit RÉELLEMENT dans le périmètre ;
 *  - les deux signaux du store (`SIGNAUX_STRUCTURELS`) : clé `scope:` et déclaration `as const
 *    satisfies <X>Defaults` (la SEMENCE d'authoring, neutralisée sur tout son bloc puisqu'elle
 *    s'écrit sur plusieurs lignes).
 */
function codeSeul(src: string, sauf?: string): string {
  const onglets = clesDOnglet(src);
  return sansCommentaires(src)
    .replace(SEMENCE_DECL, (bloc) => litteraux(bloc))
    .split('\n')
    .map((l) => {
      let code = l;
      for (const n of NEUTRALISEURS) if (n.nom !== sauf) code = n.applique(code, onglets);
      return LIGNE_STRUCTURELLE.test(code) ? litteraux(code) : code;
    })
    .join('\n');
}

/** Un id CITÉ en littéral (la mesure commune des trois bras). */
const citeId = (id: string) => new RegExp(`(['"\`])${id}\\1`);

/** Les MEMBRES littéraux d'une UNION, déclarée (`type X = 'a' | 'b'`) comme écrite en place. */
const membresDUnion = (union: string): string[] => [...union.matchAll(/(['"`])([^'"`\n]*)\1/g)].map((m) => m[2]);

/** Les ids de `terrains.json`, mémoïsés — le registre des sols contre lequel une union se juge. */
const idsTerrain = (() => {
  let vus: Set<string> | null = null;
  return () => (vus ??= new Set(terrains.map((t) => t.id)));
})();

/** CLAUSE PARTAGÉE du bras terrain : une union dont TOUS les membres sont des ids de terrain n'est
 *  pas un vocabulaire propre, c'est une LISTE RÉCITÉE — ni le type attendu au site
 *  (`vocabulaireAuSite`) ni le neutraliseur d'union en place ne la blanchissent. */
const tousDesTerrains = (membres: readonly string[]): boolean => membres.length > 0 && membres.every((v) => idsTerrain().has(v));
const membresSontTousDesTerrains = (union: string): boolean => tousDesTerrains(membresDUnion(union));

/** Une étendue de littéral à blanchir sur une ligne : colonnes [de, a[, bornes comprises. */
type Etendue = readonly [number, number];
/** Par ligne (0-based), les littéraux dont le TYPE ATTENDU au site est un vocabulaire (`vocabulaireAuSite`). */
type SitesDuVocabulaire = ReadonlyMap<number, readonly Etendue[]>;

const EGALITES = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/** Le type DÉCLARÉ d'une expression, avant tout rétrécissement de flux : dans `if (v === 'a') v === 'a'`,
 *  le second `v` rétréci vaut `'a'`, son vocabulaire reste celui de sa déclaration. */
const typeDeclare = (checker: ts.TypeChecker, e: ts.Expression): ts.Type => {
  const symbole = checker.getSymbolAtLocation(e);
  return symbole && symbole.flags & (ts.SymbolFlags.Variable | ts.SymbolFlags.Property)
    ? checker.getTypeOfSymbol(symbole)
    : checker.getTypeAtLocation(e);
};

/** Le TYPE ATTENDU d'un littéral à son site : son type contextuel (`getContextualType` : champ,
 *  argument, élément, affectation) ; pour l'opérande d'une égalité, le type déclaré de l'autre
 *  opérande ; pour un `case`, celui de l'expression du `switch` — TypeScript ne donne pas de type
 *  contextuel à ces deux sites. */
const typeAttendu = (checker: ts.TypeChecker, lit: ts.StringLiteralLike): ts.Type | undefined => {
  const p = lit.parent;
  if (ts.isBinaryExpression(p) && EGALITES.has(p.operatorToken.kind)) return typeDeclare(checker, p.left === lit ? p.right : p.left);
  if (ts.isCaseClause(p) && p.expression === lit) return typeDeclare(checker, p.parent.parent.expression);
  return checker.getContextualType(lit);
};

/**
 * Les littéraux d'un fichier dont le TYPE ATTENDU au site est un VOCABULAIRE qui les AUTORISE : les
 * constituants littéraux de chaîne de ce type contiennent la valeur, et ne sont pas TOUS des ids de
 * terrain — une union tout-terrain est une LISTE RÉCITÉE, même clause que l'union écrite en place.
 * La valeur est alors de CE vocabulaire, que l'union soit déclarée dans le fichier ou importée. Un
 * même littéral hors de ce site (`terrain: 'neige'` à côté d'une `Meteo = 'pluie' | 'neige'`) garde
 * son type attendu à lui, et reste compté.
 */
function vocabulaireAuSite(checker: ts.TypeChecker, sf: ts.SourceFile): SitesDuVocabulaire {
  const sites = new Map<number, Etendue[]>();
  const visite = (n: ts.Node): void => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && idsTerrain().has(n.text)) {
      const t = typeAttendu(checker, n);
      const membres = (t ? (t.isUnion() ? t.types : [t]) : []).filter((x) => x.isStringLiteral()).map((x) => (x as ts.StringLiteralType).value);
      if (membres.includes(n.text) && !tousDesTerrains(membres)) {
        const { line, character } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        sites.set(line, [...(sites.get(line) ?? []), [character, character + n.getWidth(sf)]]);
      }
    }
    ts.forEachChild(n, visite);
  };
  visite(sf);
  return sites;
}

/** Les sites du vocabulaire de TOUS les fichiers du périmètre, par chemin depuis la racine : UN
 *  Program sur leurs racines, chaque module (déclarant ou importé) résolu une seule fois ; le Program
 *  ne survit pas à l'appel (`tsProgram.mjs`, aucune rétention). */
function sitesDuPerimetre(sources: readonly string[]): ReadonlyMap<string, SitesDuVocabulaire> {
  const program = repoProgram(RACINE, () => sources.map((s) => RACINE + s));
  const checker = program.getTypeChecker();
  return new Map(sources.map((s) => {
    const sf = program.getSourceFile(RACINE + s);
    if (!sf) throw new Error(`${s} absent du Program`);
    return [s, vocabulaireAuSite(checker, sf)];
  }));
}

/** Les sites du vocabulaire d'une source SYNTHÉTIQUE `principal`, compilée avec ses `modules` voisins
 *  (chemins relatifs à une racine virtuelle) : les morsures de la garde. */
function sitesSynthetiques(principal: string, modules: Record<string, string> = {}): SitesDuVocabulaire {
  const program = virtualProgram({ ...modules, 'fixture.ts': principal });
  const sf = program.getSourceFiles().find((f) => /[\\/]fixture\.ts$/.test(f.fileName) && f.fileName.replace(/\\/g, '/').startsWith(VIRTUAL_ROOT.replace(/\\/g, '/')));
  if (!sf) throw new Error('fixture absente du Program virtuel');
  return vocabulaireAuSite(program.getTypeChecker(), sf);
}

/** Les littéraux d'une ligne aux `etendues` VIDÉS, bornes gardées : aucune colonne ne bouge. */
const blanchitEtendues = (code: string, etendues: readonly Etendue[] = []) =>
  etendues.reduce((c, [de, a]) => `${c.slice(0, de)}${c[de]}${' '.repeat(a - de - 2)}${c[a - 1]}${c.slice(a)}`, code);

/**
 * Les NEUTRALISEURS du bras TERRAIN, chacun NOMMÉ — même contrat que `NEUTRALISEURS` : un neutraliseur
 * que plus aucun site du PÉRIMÈTRE n'exerce est une exemption morte, et le test de vie le rend ROUGE.
 * Aucun nom de fichier, aucune ligne : c'est la FORME qui dit qu'un littéral n'est pas un id de sol.
 *  - le TYPE ATTENDU au site du littéral, quand c'est un VOCABULAIRE d'union qui l'autorise, déclaré
 *    dans le fichier ou importé (capacité d'arête, résultat de dépilage… — `vocabulaireAuSite`) ;
 *  - une UNION de littéraux ÉCRITE EN PLACE (paramètre, champ) qui porte AU MOINS un membre hors du
 *    registre des sols : elle DÉCLARE un vocabulaire propre, elle n'émet pas. Une union dont TOUS les
 *    membres sont des ids de terrain est une LISTE RÉCITÉE — même clause qu'au type attendu
 *    (`tousDesTerrains`), et la ligne reste comptée ;
 *  - UNE entrée par CHAMP dont le vocabulaire n'est pas celui des sols (`neutraliseursDeChamp`, la
 *    même fabrique que le bras des matières) — `key` (clé de récap / d'IU), `cargoId` (cargaison,
 *    `bois`) : chacun a un homonyme au registre des terrains, et chacun rougit SEUL quand son site
 *    meurt. `kind` (type de SÉLECTION d'un éditeur, `route`) et `weather` (météo, `neige`) n'y
 *    figurent PAS : leurs sites sont typés par leur vocabulaire, le type attendu les tient ;
 *  - la SEMENCE d'authoring GELÉE (`as const satisfies Fige<…Defaults>`) des migrations de projet.
 */
const NEUTRALISEURS_TERRAIN: readonly { nom: string; portee: 'ligne' | 'bloc'; applique: (code: string, sites: SitesDuVocabulaire, ligne: number) => string }[] = [
  { nom: 'TYPE ATTENDU au site : un vocabulaire d’union', portee: 'ligne', applique: (code, sites, ligne) => blanchitEtendues(code, sites.get(ligne)) },
  {
    nom: 'UNION de littéraux écrite en place',
    portee: 'ligne',
    applique: (code) =>
      code.replace(UNION_DE_LITTERAUX, (union) => (membresSontTousDesTerrains(union) ? union : litteraux(union))),
  },
  ...neutraliseursDeChamp({
    key: 'clé de récap / d’IU',
    cargoId: 'cargaison',
  }).map((n) => ({ ...n, portee: 'ligne' as const })),
  { nom: 'SEMENCE d’authoring GELÉE d’une migration', portee: 'bloc', applique: (code) => code.replace(SEMENCE_DECL, (bloc) => litteraux(bloc)) },
];

/** Le code d'une couche SANS ses commentaires ni ses homonymes de terrain, lignes préservées. `sauf` en
 *  retire UN neutraliseur — c'est ainsi que le test de vie mesure ce que chacun blanchit RÉELLEMENT.
 *  Un neutraliseur de portée `bloc` s'applique au TEXTE entier (la semence gelée tient sur 3 lignes).
 *  `sites` : les littéraux du fichier au type attendu d'un vocabulaire (`vocabulaireAuSite`). */
function codeHorsTerrain(src: string, sites: SitesDuVocabulaire = new Map(), sauf?: string): string {
  let texte = codeNu(src).join('\n');
  for (const n of NEUTRALISEURS_TERRAIN) if (n.portee === 'bloc' && n.nom !== sauf) texte = n.applique(texte, sites, -1);
  return texte
    .split('\n')
    .map((l, i) => {
      let code = l;
      for (const n of NEUTRALISEURS_TERRAIN) if (n.portee === 'ligne' && n.nom !== sauf) code = n.applique(code, sites, i);
      return code;
    })
    .join('\n');
}

describe('couches émettrices du monde — aucune matière ni aucun terrain nommé en dur (#1691, #1715, #1716, #1789)', () => {
  const fichiers = fichiersDuPerimetre();
  const sitesDe = (() => {
    let parSource: ReadonlyMap<string, SitesDuVocabulaire> | null = null;
    return (source: string) => (parSource ??= sitesDuPerimetre(fichiers.map((f) => f.source))).get(source);
  })();

  it('le scan couvre les CINQ couches émettrices (sanity)', () => {
    for (const c of COUCHES)
      expect(fichiers.filter((f) => f.rel.startsWith(c.prefixe) && (c.dir === '.' || f.rel.includes(`${c.dir}/`))).length, c.dir).toBeGreaterThan(0);
    expect(fichiers.some((f) => f.rel === 'sceneEdit.ts'), 'la dérivation des masses n’est plus scannée').toBe(true);
    expect(fichiers.some((f) => f.rel === 'scene.ts'), 'le SCHÉMA de scène n’est plus scanné').toBe(true);
    expect(fichiers.some((f) => f.rel.includes('/')), 'le scan de `src/state` n’est plus récursif').toBe(true);
    expect(fichiers.some((f) => f.rel === 'ui/editor/Palette.tsx'), 'la PALETTE de l’éditeur n’est plus scannée').toBe(true);
    expect(fichiers.some((f) => f.rel === 'ui/editor/Editor.tsx'), 'le redimensionnement de l’éditeur n’est plus scanné').toBe(true);
    expect(materials.length).toBeGreaterThan(5);
  });

  it('les HOMONYMES du store portent tous un signal STRUCTUREL, et aucun ne survit à la neutralisation', () => {
    const nus: { rel: string; ligne: number; texte: string }[] = [];
    for (const f of fichiers.filter((x) => duStore(x.rel))) {
      const sansCommentaires = codeNu(f.code);
      sansCommentaires.forEach((l, i) => {
        if (materials.some((m) => new RegExp(`(['"\`])${m.id}\\1`).test(l)))
          nus.push({ rel: f.rel, ligne: i + 1, texte: [l, sansCommentaires[i + 1] ?? '', sansCommentaires[i + 2] ?? ''].join('\n') });
      });
    }
    expect(nus.length, 'plus aucun homonyme dans `src/state` : la neutralisation ne prouve plus rien.').toBeGreaterThan(0);
    // Un signal se lit sur la ligne ou sur la CLÔTURE de sa déclaration (la semence tient sur 3 lignes).
    expect(
      nus.filter((n) => !SIGNAUX_STRUCTURELS.some((s) => s.re.test(n.texte))).map((n) => `${n.rel}:${n.ligne}`),
      `Littéral de matière dans \`src/state\` sans signal structurel — signaux connus : ${SIGNAUX_STRUCTURELS.map((s) => s.nom).join(', ')}.`,
    ).toEqual([]);
    for (const s of SIGNAUX_STRUCTURELS)
      expect(nus.some((n) => s.re.test(n.texte)), `le signal « ${s.nom} » n’est plus exercé par aucun site.`).toBe(true);
  });

  /**
   * CONTRAT DE VIE des neutraliseurs — le pendant, pour la table `NEUTRALISEURS`, de ce que
   * `SIGNAUX_STRUCTURELS` exige site par site : un neutraliseur se juge à ce qu'il BLANCHIT
   * RÉELLEMENT. L'attendu est DÉRIVÉ du corpus (aucun nom de fichier ici) : on rejoue le scan en
   * retirant UN neutraliseur, et la différence de littéraux comptés est ce qu'il porte. Zéro
   * différence = exemption morte, à re-trier — pas à garder « au cas où ».
   */
  it('chaque NEUTRALISEUR est exercé par un site du périmètre (aucune exemption morte)', () => {
    const cite = (l: string) => materials.some((m) => new RegExp(`(['"\`])${m.id}\\1`).test(l));
    for (const n of NEUTRALISEURS) {
      const exerce = fichiers.some((f) => {
        const avec = codeSeul(f.code).split('\n');
        return codeSeul(f.code, n.nom)
          .split('\n')
          .some((l, i) => cite(l) && !cite(avec[i]));
      });
      expect(exerce, `neutraliseur mort : « ${n.nom} » ne blanchit plus aucun site du périmètre — re-trier l’exemption.`).toBe(true);
    }
  });

  /**
   * SECOND BRAS (#1716) — le SOL d’une scène neuve vient de la DONNÉE, jamais du code.
   *
   * Le vocabulaire est DÉRIVÉ, comme celui des matières : la valeur cherchée est
   * `semences-de-scene.json › terrain` elle-même (un id de `terrains.json`, tenu au parse par
   * `idDe('terrain')`) — change la semence au Codex, la garde suit le jour même, sans une ligne.
   *
   * ZÉRO, sans aucune neutralisation : la semence ne se nomme NULLE PART dans les cinq couches, ni
   * en pose (`.fill(…)`, `?? …`, `= …` : c’est la donnée qui la fournit) ni en collection — une
   * collection qui la nommerait serait une liste de terrains récitée en code, la classe de
   * `BARE_GROUND`, que le vocabulaire dérivé de `terrains.json` rend inutile.
   */
  it('la SEMENCE de terrain ne se nomme nulle part : le sol d’une scène neuve vient de la donnée (#1716)', () => {
    const semence = semencesDeScene.terrain;
    expect(terrains.some((t) => t.id === semence), `la semence « ${semence} » n’est pas un terrain : la garde mesure un vocabulaire mort.`).toBe(true);
    const cite = (id: string) => new RegExp(`(['"\`])${id}\\1`);
    const fautes: string[] = [];
    for (const f of fichiers) {
      codeNu(f.code).forEach((l, i) => {
        if (cite(semence).test(l)) fautes.push(`${f.rel}:${i + 1} — « ${semence} »`);
      });
    }
    expect(
      fautes,
      'une couche émettrice NOMME le sol de départ : il vient de `semences-de-scene.json › terrain` ' +
        '(`DEFAULT_TERRAIN`, `state/scene.ts`), éditable au Codex — jamais d’un littéral.\n  ' +
        fautes.join('\n  '),
    ).toEqual([]);
  });

  /**
   * TROISIÈME BRAS (#1716) — le SCHÉMA du monde ne récite aucun terrain.
   *
   * Vocabulaire DÉRIVÉ, comme les deux autres : la liste cherchée est `terrains.json › id` ENTIÈRE —
   * un terrain déposé demain au Codex est gardé le jour même, sans une ligne ici. La moitié
   * « matière » de la clause est tenue par le bras des ids de `materials.json` ci-dessous, qui scanne
   * le même périmètre.
   *
   * Les HOMONYMES (`porte` capacité d’arête, `vide` résultat de dépilage, `neige` météo, `bois`
   * cargaison, `route` clé de récap et type de SÉLECTION d’éditeur) sont neutralisés par FORME
   * (`NEUTRALISEURS_TERRAIN`) : type attendu au site d’un vocabulaire d’union, union écrite en place,
   * nom de champ, semence gelée. AUCUN site toléré, aucune liste d’exemption, aucun nom de fichier :
   * le stock mesuré est vide.
   *
   * Périmètre : les MÊMES CINQ couches que le bras des matières (#1789), même corpus `fichiers`.
   */
  it('aucune des CINQ couches émettrices ne porte un id de terrain en littéral (#1716, #1789)', () => {
    const ids = terrains.map((t) => t.id);
    expect(ids.length, 'vocabulaire de terrains VIDE : la garde mesurerait le néant.').toBeGreaterThan(0);
    const fautes: string[] = [];
    for (const f of fichiers) {
      codeHorsTerrain(f.code, sitesDe(f.source)).split('\n').forEach((l, i) => {
        for (const id of ids) if (citeId(id).test(l)) fautes.push(`${chemin(f.rel)}:${i + 1} — « ${id} »`);
      });
    }
    expect(
      fautes,
      'une couche émettrice NOMME un terrain : le porteur d’un rôle se demande au dataset ' +
        '(`terrainAbsent`/`terrainHorsGrille`, `state/terrain`), une semence vient de ' +
        '`semences-de-scene.json` et un défaut de compilateur de `defauts-de-compilation.json` — ' +
        'jamais d’un littéral. En couche de RENDU ou d’IU, le terrain se LIT sur la tuile ou sur le ' +
        '`MaterialRef` reçu, se DÉRIVE de `terrains` / `terrainsAvecGlyphe`, ou se demande au dataset ' +
        'PAR RÔLE — jamais choisi en code.\n  ' +
        fautes.join('\n  '),
    ).toEqual([]);
  });

  /**
   * CONTRAT DE VIE des neutraliseurs du bras TERRAIN — même mesure que pour les matières, sur le MÊME
   * périmètre : on rejoue le scan des cinq couches en retirant UN neutraliseur, et la différence d'ids
   * comptés est ce qu'il porte.
   */
  it('chaque neutraliseur du bras TERRAIN est exercé par un site du périmètre (aucune exemption morte)', () => {
    const ids = terrains.map((t) => t.id);
    const cite = (l: string) => ids.some((id) => citeId(id).test(l));
    for (const n of NEUTRALISEURS_TERRAIN) {
      const exerce = fichiers.some((f) => {
        const avec = codeHorsTerrain(f.code, sitesDe(f.source)).split('\n');
        return codeHorsTerrain(f.code, sitesDe(f.source), n.nom)
          .split('\n')
          .some((l, i) => cite(l) && !cite(avec[i]));
      });
      expect(exerce, `neutraliseur mort : « ${n.nom} » ne blanchit plus aucun site du périmètre — re-trier l’exemption.`).toBe(true);
    }
  });

  /**
   * SONDE de la CLAUSE d'union (#1789) — mesurée sur des sources SYNTHÉTIQUES, vocabulaire tiré du
   * dataset (aucun id récité ici) : une union dont TOUS les membres sont des sols est une LISTE
   * RÉCITÉE et reste comptée ; un SEUL membre hors registre en fait un vocabulaire propre, blanchi.
   */
  it('une union TOUT-TERRAIN reste comptée, une union à membre hors registre est blanchie', () => {
    const ids = terrains.map((t) => t.id);
    expect(ids.length, 'moins de deux terrains : la sonde d’union ne mesure rien.').toBeGreaterThan(1);
    const [a, b] = ids;
    const horsRegistre = 'hors-registre-des-sols';
    expect(ids).not.toContain(horsRegistre);
    const compte = (src: string) =>
      codeHorsTerrain(src)
        .split('\n')
        .filter((l) => ids.some((id) => citeId(id).test(l))).length;
    expect(
      compte(`type Sol = '${a}' | '${b}';`),
      `liste de terrains récitée blanchie : « ${a} | ${b} » n’est pas un vocabulaire propre, elle doit rester comptée.`,
    ).toBe(1);
    expect(
      compte(`function f(x: '${horsRegistre}' | '${a}') {}`),
      'une union qui porte un membre hors du registre des sols DÉCLARE un vocabulaire : elle se blanchit.',
    ).toBe(0);
  });

  /**
   * MORSURES du type attendu au site (#1883) — sources SYNTHÉTIQUES compilées par le checker,
   * vocabulaire tiré du dataset : un id de terrain n'est blanchi QUE là où son type attendu est le
   * vocabulaire qui l'autorise. Le même id posé dans un champ libre reste compté, que le vocabulaire
   * voisin soit déclaré dans le fichier ou importé.
   */
  it('un id de terrain hors du site typé par son vocabulaire reste compté, union déclarée ou importée', () => {
    const [sol] = terrains.map((t) => t.id);
    const horsRegistre = 'hors-registre-des-sols';
    const compte = (principal: string, modules?: Record<string, string>) =>
      codeHorsTerrain(principal, sitesSynthetiques(principal, modules))
        .split('\n')
        .filter((l) => citeId(sol).test(l)).length;
    const meteo = `export type WeatherFxId = '${horsRegistre}' | '${sol}';\n`;
    const importe = `import type { WeatherFxId } from './meteo';\nexport const fx: WeatherFxId = '${sol}';\n`;
    const declare = `type Meteo = '${horsRegistre}' | '${sol}';\nexport const fx: Meteo = '${sol}';\n`;
    expect(compte(importe, { 'meteo.ts': meteo }), 'le littéral TYPÉ par le vocabulaire importé est de ce vocabulaire.').toBe(0);
    expect(compte(declare), 'le littéral TYPÉ par le vocabulaire déclaré est de ce vocabulaire.').toBe(0);
    expect(
      compte(`${importe}export const tuile = { terrain: '${sol}' };\n`, { 'meteo.ts': meteo }),
      'un `terrain:` libre dans un fichier qui IMPORTE un vocabulaire homonyme reste une émission de sol.',
    ).toBe(1);
    expect(
      compte(`${declare}export const tuile = { terrain: '${sol}' };\n`),
      'un `terrain:` libre à côté d’une union DÉCLARÉE homonyme reste une émission de sol.',
    ).toBe(1);
    expect(
      compte(`${declare}declare const m: Meteo;\nexport const pluie = m === '${sol}';\n`),
      'la comparaison au vocabulaire déclaré est de ce vocabulaire.',
    ).toBe(0);
  });

  /**
   * SONDE de la COUPE des commentaires (#1789) — elle balaie les CHAÎNES : un `//` à l'intérieur d'un
   * littéral (`'http://x'`) n'est pas un début de commentaire. Une coupe naïve à `indexOf('//')`
   * tronquerait la ligne AVANT la mesure et rendrait AVEUGLE tout ce qui suit l'URL sur cette ligne :
   * angle mort des DEUX bras, puisque `codeNu` est leur mesure commune. Vocabulaire tiré du dataset.
   */
  it('la coupe des commentaires préserve les CHAÎNES : un `//` dans un littéral n’aveugle pas la ligne', () => {
    const [sol] = terrains.map((t) => t.id);
    const compte = (src: string) =>
      codeHorsTerrain(src)
        .split('\n')
        .filter((l) => citeId(sol).test(l)).length;
    expect(compte(`const u = 'http://x'; // '${sol}'`), 'un id CITÉ EN COMMENTAIRE est une réf en prose, jamais une émission.').toBe(0);
    expect(compte(`const t = '${sol}'; // ok`), 'un id émis en CODE reste compté, commentaire ou pas.').toBe(1);
    expect(
      compte(`const a = 'http://x', b = '${sol}';`),
      'littéral APRÈS une URL sur la même ligne : une coupe naïve à `//` tronquerait avant la mesure et l’émission passerait.',
    ).toBe(1);
  });

  it('la neutralisation est STRUCTURELLE : une COMPARAISON de partie n’est pas une émission de matière', () => {
    const fichierTemoin = `${GAMEISO}authoring/floorsSvg.ts`;
    expect(existsSync(fichierTemoin), 'le site témoin de la comparaison de partie a disparu — reformuler la garde.').toBe(true);
    const brut = readFileSync(fichierTemoin, 'utf8');
    const partie = materials.find((m) => brut.includes(`part === '${m.id}'`) || brut.includes(`part !== '${m.id}'`));
    expect(partie, 'plus aucune comparaison `part === <homonyme d’une matière>` : le cas n’est plus exercé.').toBeDefined();
    expect(new RegExp(`'${partie!.id}'`).test(codeSeul(brut)), `« ${partie!.id} » compté comme matière alors que c’est une PARTIE.`).toBe(false);
  });

  it('l’homonyme `plan` du RIG est hors périmètre : la voie de corps n’est pas une couverture', () => {
    expect(materials.some((m) => m.id === 'plan' && m.domain === 'roof'), '`plan` n’est plus une matière de toiture : reformuler la garde.').toBe(true);
    expect(fichiers.some((f) => /bodyPlan|sceneMeshes|actorAnimSelect|enemyProfile|tokenBodyKind/.test(f.rel))).toBe(false);
  });

  it('aucun id de `materials.json` n’apparaît en littéral dans les couches émettrices', () => {
    const fautes: string[] = [];
    for (const f of fichiers) {
      const code = codeSeul(f.code);
      const lignes = code.split('\n');
      for (const m of materials) {
        const re = new RegExp(`(['"\`])${m.id}\\1`);
        lignes.forEach((l, i) => {
          if (re.test(l)) fautes.push(`${f.rel}:${i + 1} — « ${m.id} » (domaine ${m.domain})`);
        });
      }
    }
    expect(
      fautes,
      'une couche émettrice NOMME une matière : la matière d’une face vient de la DONNÉE (scène `reliefDefaults`, ' +
        'terrain `matiere`, bâtiment `roofMaterial`, masse de toit `material`, recette de décor `primitive.material`), jamais du code.\n  ' +
        fautes.join('\n  '),
    ).toEqual([]);
  });
});

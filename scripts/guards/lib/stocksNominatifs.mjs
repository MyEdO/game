// CROISSANCE D'UN STOCK NOMINATIF dans un diff. Un stock (tableau/Set/Map/objet de chemins
// `src/…`, `scripts/…`, `docs/…`, parfois `fichier:ligne`) est une DETTE qui va vers zéro : il
// DÉCROÎT. Un stock qui naît ou grossit est une exemption de plus, et l'ajout d'une ligne y est
// toujours le chemin le plus court pour rendre une CI verte — c'est exactement ce que le cliquet
// doit rendre visible (même raison que l'interdit du PLAFOND en tête de `stock.mjs`).
//
// FRONTIÈRE (celle de `stock.mjs`) : cette lib CALCULE, le VERDICT appartient à l'appelant — la
// porte du commit (`scripts/git-hooks/porte-du-commit.mjs`) et les portes a posteriori (dernier commit,
// plage poussée) décident, avec quel message et sous quelle dérogation.
//
// PÉRIMÈTRE : les fichiers où un stock vit dans ce dépôt — tests de `src/**`, libs de garde
// `scripts/guards/lib/**`, tests de `scripts/**`, tables JSON de `scripts/hooks/`, de
// `scripts/guards/` et de `scripts/guards/lib/`, le gel d'exports `knip-exports-baseline.json` de la
// RACINE, les stocks NOMMÉS de l'Atlas RAW (`scripts/raw/*-stock.json`, #1709) et les BASELINES
// de compte qui les voisinent (`scripts/raw/*-baseline.json` — #1711 T1). Ces motifs nomment
// des FAMILLES, pas des dossiers, et le test de périmètre les CONFRONTE à une dérivation : tout JSON
// suivi dont la racine est un objet à CLÉS-CHEMINS, ou qui porte une liste d'entrées à champ
// `fichier`, doit tomber sous l'un d'eux — sans quoi le rouge le NOMME. Il est exprimé
// en EXPRESSIONS RÉGULIÈRES et non en littéraux de chemin : un tableau de chemins écrit ici serait
// lui-même vu comme un stock par la règle qu'il sert.
//
// CE QU'UNE BASELINE DE COMPTE DÉCLARE, ET CE QU'ELLE TAIT (#1711 T1, le filet). Une baseline gèle
// un COMPTE PAR FICHIER : `{ "src/x.ts": 3 }`. La porte compte des
// ENTRÉES nommées, et la CLÉ en est une — un fichier qui entre au gel est donc vu, déclarable par
// `CLIQUET:`. Le NOMBRE, lui, n'en est pas une : relever `2 → 3` est `-1/+1` sur la même ligne, net
// 0, invisible aux deux portes ; et une entrée qui ne nomme AUCUN fichier (`{ "chapitre": "LDB 8",
// "folio": 12 }`, les gels par chapitre) n'est vue par aucune porte non plus. La forme qui rend un
// relèvement déclarable est le stock NOMINATIF — une entrée par occurrence, comme
// `scripts/raw/reconciliation-stock.json` : l'ajout y est une LIGNE de plus. Le filet couvre les
// clés neuves ; les baselines de compte de `scripts/raw` sont, elles, passées à la forme nominative
// (#1711 T2-T4, puis les ancres sans contenu #1727 T2 : leurs entrées nomment le chapitre
// par son CHEMIN `Source/…md`, donc 51 entrées vues sur 51 là où le nom NU à espaces
// (`"05 - Amibe.md"`) n'en donnait AUCUNE à voir). Plus aucun porteur suivi n'est sous ce filet.
// UNE CLASSE RESTE, et c'est la FORME qui la tient : deux RUBRIQUES d'un même fichier entre
// lesquelles une entrée se DÉPLACE sont net 0 (`-1` et `+1` sous le même toit). C'est pourquoi les
// deux classes d'ancres sans contenu vivent en DEUX FICHIERS
// (`empty-folios-perdues-stock.json` / `…-benignes-stock.json`) : le déclassement d'une page perdue y
// est une croissance nette du fichier receveur, donc un `CLIQUET:` à porter au message.
//
// DÉFINITION. Un PORTEUR est un littéral de TABLEAU ou d'OBJET atteignable depuis une liaison de
// MODULE — `export const X = …`, `const X = …` de module, IIFE, fonction déclarée puis exportée.
// Les options imbriquées appartiennent à leur ARGUMENT. Un tableau scalaire joint avec '/' ou '\\'
// et le descripteur canonique { dossier, suffixe, recursif } ne sont pas des collections nominatives.
// Dans une suite, le littéral `fichiers` des options directement passées en argument 0 aux fabriques
// de depotGabarit est une fixture jetable. L'appel est prouvé par `estAppelDeclare` ; les options
// voisines et les collections déclarées séparément gardent leur mesure. Le checker n'est emprunté
// que si un import candidat est présent, et reste vivant pendant tout le parcours.
// Un ARGUMENT qui ne nomme AUCUN FICHIER est un PARAMÈTRE, pas un porteur : c'est une liste de
// RACINES que l'appelé consomme (`readCorpus(['src/ui', 'src/gameIso'])`). Dès qu'un fichier y est
// nommé (extension, ou `fichier:ligne`), le littéral RESTE un porteur quelle que soit la façade —
// `defineStock([ … ])`, `registre([ … ])`, `Array.from([ … ])`, `Object.freeze([ … ])`,
// `new Set([ … ])` : même refus qu’en TÊTE de `lignesLocales`, un stock reste un stock.
// Une ENTRÉE vit à la ligne de son PREMIER caractère, et se lit ainsi :
//   · un ÉLÉMENT de tableau est une entrée si son sous-arbre nomme un fichier — un objet élément
//     compris —, et l'on n'y descend jamais ;
//   · une PROPRIÉTÉ d'objet dont la CLÉ nomme un fichier est une entrée, sans descente (le registre
//     `AUTO_RESOLUS` : `'criticals.json': …`) ;
//   · sinon, une propriété dont la VALEUR est elle-même un littéral de tableau ou d'objet est une
//     RUBRIQUE — un porteur imbriqué (`'test:hooks': [ … ]`) : on y descend, on ne la compte pas ;
//   · toute autre propriété est une entrée si son sous-arbre nomme un fichier.
// Une propriété dont la clé est `foyer` n'est jamais lue, ni sa valeur ni rien au-dessous : un FOYER
// déclaré (le fichier où une construction a le droit de vivre, `sAppliqueA` de `sourceCorpus.mjs`)
// n'est pas une dette.
// Une ENTRÉE NOMINATIVE est une entrée de stock au sens LARGE, celle que cette porte compte :
// `estEntreeNominative` en juge une ligne, `entreesNominatives` les lit dans une image. Une entrée de
// site (`{ fichier, ref, occurrence }`, `stock.mjs`) en est une espèce.
// En JSON, tout est de portée module. Aucun seuil de taille : la porte compte des entrées nées et
// mortes, jamais des stocks.
//
// PORTÉE DE MODULE : une entrée ne compte que si elle vit au niveau du MODULE. Un littéral écrit
// dans un corps de fonction (`test(…)`, `it(…)`, une fabrique) est une DONNÉE LOCALE, pas un stock :
// il ne survit pas à l'appel qui le porte et ne s'ajoute à aucune dette. La position se décide sur
// le POST-IMAGE du fichier par l'AST TypeScript, jamais par indentation (les trois « entrées » de
// `429b9a1a2`, les deux faux positifs de `91c928d16` et le `+8` de `572e60b8b` sont tous de cette
// classe ; précédent `0d6ddeee1` : la classe se règle au garde, jamais à la fixture).
//
// MIGRATION DE SITE DE TEST (#1735) : même propriétaire de stock (ou renommage Git), même contenu
// complet hors fichier, même titre littéral. Le titre existe dans l'ancien fichier avant et dans le
// nouveau après, manque dans le nouveau avant, et l'ancien fichier disparaît. Les deux membres
// appariés quittent le bilan ; une panne de lecture ne prouve aucune disparition. Les deux adresses
// sont des suites (`estSuiteVitest`). Les appels sont liés aux imports runtime Vitest/node:test
// (`liaisonImportee`), ou aux globals it/test sans liaison locale. L'ordre des champs ne fait rien,
// une clé calculée ou un étalement ne prouve rien. Lectures et titres sont cachés pour le seul bilan.
// UNE SEULE SOURCE D'IMAGE : le lecteur `lirePostImage` que l'appelant fournit (contrat
// `lirePostImage` de `gitPorte.mjs`). `croissanceDesStocks` REFUSE nommément l'appel qui n'en porte
// pas — un compte sans image ment —, et ne reconstruit aucune image depuis le diff. VOIE NOMINALE :
// les deux lecteurs rendent leur image, `entreesNominatives` y pose les entrées, et le compte est
// l'écart des deux images, entrée par entrée (`ecartDEntrees`) ; le diff ne dit que les porteurs
// touchés, nés ou supprimés. REPLI : quand le lecteur rend `null` (fichier supprimé, binaire, dialecte
// hors `DIALECTE`), `estEntreeNominative` juge la LIGNE seule et l'entrée COMPTE — la porte perd sa
// précision, jamais sa vue. Ce que le repli ne sait pas lire, il le rate : entrée MULTILIGNE,
// entrée-objet JSON, propriété dont la CLÉ ne nomme pas de fichier alors que sa valeur en nomme
// (`"sites": [ … ]` de `scripts/raw/reconciliation-stock.json`). Les appelants de production
// fournissent l'image (`plageStock.mjs`, `scripts/git-hooks/porte-du-commit.mjs`).
//
// CE QUE LA RÈGLE MESURE MAL, par construction, et qui doit se lire ici plutôt que se découvrir :
//   · plusieurs entrées sur UNE ligne = SOUS-COMPTAGE (la ligne compte pour une), jamais une cécité :
//     la croissance reste vue, son ampleur est minorée ;
//   · une entrée dont aucun littéral ne nomme un fichier (id numérique, nom de symbole seul) est
//     hors de vue : `structuresStock.mjs` porte 1088 membres directs de porteurs, 1049 nomment un
//     fichier — 39 hors de vue (mesuré à `b55d69da7`) ;
//   · une entrée MULTILIGNE vit à la ligne de son PREMIER caractère : un diff qui n'ajoute que des
//     lignes internes d'une entrée déjà là ne compte rien (angle mort latent aujourd'hui, que
//     `scripts/hooks/ecrans-ui.json` deviendra le jour où une entrée y tiendra sur deux lignes) ;
//   · le REPLI ne voit ni accolade ouvrante ni entrée multiligne : ce qu'il rate, il le rate en
//     silence, et c'est le prix d'une image que le lecteur rend `null` ;
//   · une table de MAPPING qui vit sous un chemin de `PORTEURS` (`entityConsumers.mjs`,
//     `hors-modal-intent-path.test.ts`) compte comme un stock : la condition de porteur est un
//     CHEMIN, et une ligne de mapping de plus dans une lib de garde se DÉCLARE par `CLIQUET:` comme
//     toute autre croissance ;
//   · un stock de DOSSIERS passé en ARGUMENT est HORS DE VUE, et c'est le prix payé pour cesser de
//     compter une marche d'arbre migrée : `registre(['src/ui', 'src/state'])` écrit au module ne
//     rend aucune entrée, là où `const R = ['src/ui', 'src/state']` en rend deux. Le REPLI de ligne,
//     lui, ne les voit dans aucun des deux cas ;
//   · un ARGUMENT qui NOMME un fichier reste compté : les sept façades d'une ligne de la sonde du
//     juge (2026-09-07) — `defineStock`, `registre`, `Array.from`, `[].concat`, identité,
//     `Object.freeze(registre([ … ]))`, `table({ 'src/a.ts': 1 })` — rendent chacune leurs entrées ;
//   · une flèche à corps CONCIS reste de portée MODULE (`export const stock = () => [ … ]`) : c'est
//     l'une des trois enveloppes d'une ligne mesurées le 2026-09-04, et la traiter en corps de
//     fonction rouvrirait ce contournement ;
//   · les DIALECTES des porteurs de test ne sont pas énumérés ici : ils viennent du fragment
//     `SUFFIXE_SUITE` (`fichierVitest.mjs`), qui les porte tous — une suite née en `.mts` ou en
//     `.mjs` sous `src/` entre dans le périmètre sans qu'on revienne sur cette liste.
import { estSuiteVitest, SUFFIXE_SUITE } from './fichierVitest.mjs'
import { parUnitesDeCode } from './lister.mjs'
import { analyserCorpus, ast, typescript } from './dialecte.mjs'
import { contexteImports, estAppelDeclare, liaisonImportee } from './canonUnique.mjs'
import { enteteDeHunk } from './hunks.mjs'

/** Fichiers susceptibles de porter un stock nominatif. Une BASELINE de COMPTE
 *  (`scripts/raw/*-baseline.json`, `scripts/guards/*.json`) n'y entre que pour ses CLÉS — limite
 *  écrite en tête de ce module ; les deux motifs restent, une baseline de compte pouvant renaître.
 *  Les JSON de `scripts/guards/lib/` (`decisions-baseline.json`) et le gel d'exports de la racine
 *  (`knip-exports-baseline.json`) sont, eux, NOMINATIFS de bout en bout. */
const PORTEURS = [
  // Les SUITES des deux racines : une racine COMPOSÉE avec le suffixe de suite du prédicat partagé
  // (`fichierVitest.mjs`). Un BANC en est absent à dessein : son index FIGÉ est le témoin qu'il
  // compare au vivant, pas un stock nominatif à migrer.
  new RegExp(String.raw`^src\/.+` + SUFFIXE_SUITE + '$'),
  /^scripts\/guards\/lib\/.+\.mjs$/,
  new RegExp(String.raw`^scripts\/.+` + SUFFIXE_SUITE + '$'),
  /^scripts\/hooks\/[^/]+\.json$/,
  /^scripts\/raw\/[^/]+-stock\.json$/,
  /^scripts\/raw\/[^/]+-baseline\.json$/,
  /^scripts\/guards\/[^/]+\.json$/,
  /^scripts\/guards\/lib\/[^/]+\.json$/,
  /^knip-exports-baseline\.json$/,
];

/** Chemin de dépôt : une racine suivie, puis tout sauf des espaces. */
const CHEMIN = String.raw`(?:src|scripts|docs)\/[^'"\`\s]+`;
/** Chemin d'un CHAPITRE EXTRAIT : la racine `Source/` puis un `.md` dont le nom porte des ESPACES
 *  (`"Source/Warhammer v4 - Livre de base version corrigee/08 - Statut.md"`). Racine ajoutée pour
 *  `scripts/raw/folio-gaps-stock.json` (#1711 T4), dont chaque entrée nomme le chapitre où vit le
 *  saut de folio : les dossiers de `Source/` et les fichiers-chapitre portent des espaces par
 *  nature, et `CHEMIN`/`NOM_NU` les excluent tous deux — sans cette racine, le stock resterait hors
 *  de vue des deux portes. BORNES : la chaîne COMMENCE par `Source/` et FINIT par `.md`, ESPACES et
 *  APOSTROPHE ASCII admis au milieu (sept répertoires de `Source/` en portent une : « Les archives
 *  de l'Empire volume 1 », « Aldorf la Couronne de l'Empire », « 1.0 L'ennemi dans l'Ombre
 *  Compagnon »…, et 36 des 76 entrées de `scripts/raw/folio-gaps-stock.json` resteraient hors de
 *  vue sans elle) ; aucune quote DOUBLE ni backtick au milieu. Une prose citée à espaces sans
 *  extension, ou un `Source/` sans `.md`, n'en est pas une.
 *  SUR-COMPTAGE DIT : une phrase entière qui commencerait par `Source/` et s'achèverait sur un `.md`
 *  compte pour une entrée — la porte majore, elle n'aveugle pas (même sens que les autres écarts
 *  listés en tête). */
const CHEMIN_SOURCE = String.raw`Source\/[^"\`]+\.md`;
/** Le même chapitre là où une quote SIMPLE peut le FERMER — dans `JETON`, qui lit le TEXTE SOURCE
 *  d'un littéral. Y admettre l'apostrophe ferait franchir la quote fermante à la classe de
 *  caractères (`log('Source/x', 'y.md')` deviendrait un jeton) : la borne reste ici l'apostrophe
 *  exclue, et le chapitre à apostrophe se lit par la branche à quote DOUBLE ou backtick de `JETON`,
 *  la seule graphie qu'un stock JSON emploie. */
const CHEMIN_SOURCE_SIMPLE = String.raw`Source\/[^'"\`]+\.md`;
/** Nom de fichier NU, extension de code ou de donnée : la clé `'criticals.json'` du registre
 *  `AUTO_RESOLUS` (src/state/flowtest-derived-stake.test.ts) est une entrée de stock au même titre
 *  qu'un chemin — l'exiger complet laisserait passer le cas FONDATEUR de cette porte. */
const NOM_NU = String.raw`[\w.-]+\.(?:ts|tsx|mjs|mts|json|md|css)`;
/** Le suffixe toléré DANS la chaîne d'un jeton : `:ligne`/`:symbole`, et balise commentée
 *  (`'src/ui/X.test.tsx // div'`). */
const SUFFIXE_JETON = String.raw`(?::[\w.|:-]+)?(?:\s+\/\/\s*[^'"\`]*)?`;
/** Un jeton d'entrée entre quotes, DEUX branches — la quote fermante décide de ce que le chemin
 *  peut porter : toute quote admet un chemin sans espace ni apostrophe ; la quote DOUBLE et le
 *  backtick admettent en plus un chapitre de `Source/` à apostrophe. Sans espace dans le chemin —
 *  hors `CHEMIN_SOURCE`, seule racine à espaces : une PROSE qui cite un chemin au milieu d'une
 *  phrase entre quotes n'est pas une entrée. */
const JETON = String.raw`(?:['"\`](?:${CHEMIN}|${NOM_NU}|${CHEMIN_SOURCE_SIMPLE})${SUFFIXE_JETON}['"\`]|["\`]${CHEMIN_SOURCE}${SUFFIXE_JETON}["\`])`;
/** Le MÊME jeton, sur le TEXTE d'un littéral de chaîne déjà déquoté par l'AST. */
const NOMME = new RegExp(String.raw`^(?:${CHEMIN}|${NOM_NU}|${CHEMIN_SOURCE})${SUFFIXE_JETON}$`);

/** Le même jeton, resserré sur ce qui nomme un FICHIER : un chemin qui porte une EXTENSION (suivie
 *  au besoin de `:ligne`/`:symbole`), ou un nom de fichier nu. `'src/ui'`, `'src/ui/styles'`,
 *  `'scripts/migrations'` n'en sont pas : ce sont des RACINES de scan. Ce motif ne sert QU'À décider
 *  si un littéral en position d'ARGUMENT reste un porteur — partout ailleurs, `NOMME` fait foi. */
const CHEMIN_FICHIER = String.raw`(?:src|scripts|docs)\/[^'"\`\s]*\.(?:ts|tsx|mjs|mts|json|md|css)`;
const NOMME_FICHIER = new RegExp(String.raw`^(?:${CHEMIN_FICHIER}|${NOM_NU}|${CHEMIN_SOURCE})${SUFFIXE_JETON}$`);

/**
 * Une ENTRÉE littérale de stock, DEUX formes — la ligne entière fait foi dans les deux cas :
 *   · le jeton OUVRE la ligne : élément de liste/Set (`'src/x.test.ts',`), propriété d'objet
 *     (`'criticals.json': 'raison',`), ou tuple dont il est la clé (`['src/x.ts', { n: 32, … }],`) ;
 *   · le jeton FERME un tuple crocheté (`['CritEscalation', 'onRepeat', 'src/x.ts:325'],`) —
 *     forme réelle des stocks de sites de ce dépôt, que la première ne voit pas.
 */
const ENTREE_EN_TETE = new RegExp(String.raw`^\s*\[?\s*${JETON}\s*(?:[,:][^\n]*)?$`);
const ENTREE_EN_QUEUE = new RegExp(String.raw`^\s*\[[^\n]*${JETON}\s*\][,;]?\s*(?:\/\/[^\n]*)?$`);

/** Le premier fichier qu'une ligne d'entrée NOMME, entre quotes, sans son suffixe `:ligne`/`:symbole`. */
const FICHIER_NOMME = new RegExp(String.raw`['"\`]((?:${CHEMIN}|${NOM_NU}|${CHEMIN_SOURCE})(?=${SUFFIXE_JETON}['"\`]))`);

/** Un chemin NOMMÉ ramené à son identité : sans suffixe `:ligne`/`:symbole`, extension comprise (#2223). */
const cheminNormalise = (chemin) => chemin.replace(/:[\w.|:-]+$/, '');

/** L'extension finale d'un chemin (`.ts`, `.json`…), celle qui distingue `p` de `p.<ext>`. */
const EXTENSION = /\.[^./]+$/;

/**
 * La CLÉ d'une entrée (#1806 D5″), SEULE fonction d'identité de la porte — voie image comme repli de
 * ligne : le fichier qu'elle nomme, normalisé (`cheminNormalise`), ou son texte entier quand aucun
 * littéral n'en nomme un. Une propriété de dictionnaire n'est l'identité que si son nom nomme lui-même
 * un fichier : c'est alors le premier littéral de la ligne.
 * @param {string} texte la ligne NOMMANTE de l'entrée @returns {string}
 */
export function fichierNommePar(texte) {
  const m = FICHIER_NOMME.exec(texte);
  return m ? cheminNormalise(m[1]) : texte;
}

/** Le fichier peut-il porter un stock ? */
export function estPorteurDeStock(chemin) {
  const rel = String(chemin ?? '').replace(/\\/g, '/');
  return PORTEURS.some((re) => re.test(rel));
}

/** La ligne (sans son marqueur de diff) est-elle une entrée littérale de stock ? REPLI de la porte :
 *  il ne se joue que sur un fichier dont l'IMAGE ne se lit pas, et juge la ligne pour elle seule. */
export function estEntreeNominative(ligne) {
  const l = String(ligne ?? '');
  return ENTREE_EN_TETE.test(l) || ENTREE_EN_QUEUE.test(l);
}

// ── Ce que porte une IMAGE de fichier, décidé par l'AST ──────────────────────────────────────────

/** Image parsée d'un fichier, ou `null` si son extension n'a pas de dialecte (`dialecte.mjs`) :
 *  aucune image n'est alors lue, le REPLI de ligne juge seul. */
function imageParsee(source, chemin) {
  const sf = ast({ rel: String(chemin), text: String(source ?? '') }, { inconnu: 'refus' });
  return sf && { ts: typescript(), sf, texte: sf.text };
}

/**
 * Lignes (1-based) qui ne vivent PAS au niveau du module. Est LOCAL ce qui vit dans une fonction
 * passée en ARGUMENT d'un appel — le corps d'un `test(…)`, d'un `it(…)`, d'un `describe(…)`, d'un
 * `map(…)` : ce qu'on y écrit meurt avec l'appel. Est de MODULE tout le reste, y compris ce qu'une
 * simple enveloppe pourrait sembler cacher : une IIFE (`export const STOCK = (() => [ … ])()`), une
 * fonction ou une flèche DÉCLARÉE puis exportée (`export function stock() { return [ … ] }`).
 * Marquer toute FunctionLike rendait la règle contournable par trois enveloppes d'une ligne (mesuré
 * 2026-09-04) : un stock reste un stock, quelle que soit la façade qui le sert.
 */
function lignesLocales({ ts, sf, texte }) {
  const locales = new Set();
  const marquer = (node) => {
    const debut = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
    const fin = sf.getLineAndCharacterOfPosition(Math.min(node.end, texte.length)).line;
    for (let l = debut; l <= fin; l++) locales.add(l + 1);
  };
  const visiter = (node) => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      visiter(node.expression);
      for (const arg of node.arguments ?? []) {
        // Une fonction imbriquée est déjà couverte par l'englobante : la descente s'arrête là.
        if (ts.isFunctionLikeDeclaration(arg)) marquer(arg);
        else visiter(arg);
      }
      return;
    }
    node.forEachChild(visiter);
  };
  sf.forEachChild(visiter);
  return locales;
}

/**
 * Prédicat « cette ligne (1-based) de `source` est en PORTÉE DE MODULE », ou `null` si le dialecte
 * n'a pas d'AST ici. La portée se lit sur la STRUCTURE, jamais sur l'indentation.
 */
export function porteeDeModule(source, chemin) {
  const img = imageParsee(source, chemin);
  if (!img) return null;
  const locales = lignesLocales(img);
  return (ligne) => !locales.has(ligne);
}

/** Le littéral de chaîne du sous-arbre qui NOMME un fichier, ou `null`. Le NOM d'une propriété en
 *  fait partie : c'est elle que porte le registre `AUTO_RESOLUS` (`'criticals.json': …`). Rendre le
 *  NŒUD, et pas un booléen, donne à l'appelant la LIGNE où le fichier est nommé — celle qu'une
 *  entrée multiligne doit citer en exemple. */
function noeudQuiNomme(ts, node, motif = NOMME, ignorer = () => false) {
  let trouve = null;
  const visiter = (n) => {
    if (trouve || ignorer(n)) return;
    if (ts.isPropertyAssignment(n) && nomDePropriete(ts, n) === 'foyer') return;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      if (motif.test(n.text)) trouve = n;
      return;
    }
    // Gabarit à SUBSTITUTION (`` `src/${n}.test.ts` ``) : sa tête suffit à le nommer. La ligne, elle,
    // est bien vue par le REPLI — ne juger que les littéraux nus rendait l'image AVEUGLE là où la
    // lecture de secours voyait (mesuré : 2 entrées comptées par le repli, 0 par l'image).
    if (ts.isTemplateExpression(n)) {
      if (motif.test(n.head.text) || motif.test(texteDeGabarit(ts, n))) trouve = n;
      return;
    }
    n.forEachChild(visiter);
  };
  visiter(node);
  return trouve;
}

/** Le sous-arbre nomme-t-il un fichier ? */
function nommeUnFichier(ts, node, motif = NOMME) {
  return noeudQuiNomme(ts, node, motif) !== null;
}

/** Le texte d'un gabarit, ses substitutions ÔTÉES (`` `src/${n}.test.ts` `` → `src/.test.ts`) : ce
 *  qui reste est ce que l'auteur a écrit en dur, et c'est là que vit le chemin. */
function texteDeGabarit(ts, node) {
  return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join('');
}

/**
 * Le littéral est-il un PARAMÈTRE d'appel ? — un argument qui ne nomme AUCUN fichier. Alors ce n'est
 * pas un porteur : c'est une liste de RACINES que l'appelé consomme (`readCorpus(['src/ui'])`), et
 * la compter faisait payer un cliquet à une marche d'arbre migrée.
 *
 * La position d'argument NE SUFFIT PAS à exempter : sinon `defineStock(['src/a.ts', 'src/b.ts'])`,
 * `registre([ … ])`, `Array.from([ … ])`, `[].concat([ … ])`, `table({ 'src/a.ts': 1 })` cachaient un
 * stock derrière UNE ligne — la classe que la règle refuse déjà nommément (« un stock reste un stock,
 * quelle que soit la façade qui le sert », `lignesLocales` ci-dessus ; sonde du juge de diff,
 * 2026-09-07 : sept façades à zéro entrée). Dès qu'un FICHIER est nommé dans l'argument, il reste
 * porteur, quelle que soit la façade — gel, construction, identité ou n'importe quel appelé.
 */
function estParametreDAppel(ts, node) {
  let argument = node;
  for (let parent = argument.parent; parent; parent = argument.parent) {
    if (ts.isCallExpression(parent)) {
      return (parent.arguments ?? []).includes(argument) && !nommeUnFichier(ts, argument, NOMME_FICHIER);
    }
    if (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent)
      || ts.isTypeAssertion(parent) || ts.isSatisfiesExpression(parent)
      || ts.isNonNullExpression(parent) || ts.isPropertyAssignment(parent)
      || ts.isObjectLiteralExpression(parent) || ts.isArrayLiteralExpression(parent)) argument = parent;
    else return false;
  }
  return false;
}

function estCheminScalaire(ts, node) {
  if (!ts.isArrayLiteralExpression(node)) return false;
  const acces = node.parent;
  const appel = acces?.parent;
  return !!acces && ts.isPropertyAccessExpression(acces) && acces.expression === node
    && acces.name.text === 'join' && !!appel && ts.isCallExpression(appel)
    && appel.expression === acces && appel.arguments.length === 1
    && ts.isStringLiteral(appel.arguments[0]) && ['/', '\\'].includes(appel.arguments[0].text)
    && node.elements.every(e => ts.isStringLiteral(e) || ts.isIdentifier(e) || ts.isNoSubstitutionTemplateLiteral(e));
}

function estDescripteurDeCorpus(ts, node) {
  if (!ts.isObjectLiteralExpression(node) || node.properties.length !== 3
    || !node.properties.every(ts.isPropertyAssignment)) return false;
  const champs = new Map(node.properties.map(p => [nomDePropriete(ts, p), p.initializer]));
  const dossier = champs.get('dossier');
  const suffixe = champs.get('suffixe');
  const recursif = champs.get('recursif');
  return champs.size === 3 && !!dossier && ts.isStringLiteral(dossier)
    && !NOMME_FICHIER.test(dossier.text) && !!suffixe && ts.isStringLiteral(suffixe)
    && /^[.-][^/\\]+$/.test(suffixe.text) && !!recursif
    && [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(recursif.kind);
}

const sitesDesEntrees = new WeakMap();
function siteDeTest(ts, node) {
  if (!ts.isObjectLiteralExpression(node) || !node.properties.every(ts.isPropertyAssignment)) return null;
  const champs = new Map(node.properties.map(p => [nomDePropriete(ts, p), p.initializer]));
  const fichier = champs.get('fichier');
  const titre = champs.get('it');
  if (champs.size !== node.properties.length || champs.has(null) || !fichier || !titre
    || !ts.isStringLiteral(fichier) || !estSuiteVitest(fichier.text)
    || !ts.isStringLiteral(titre) || !titre.text.trim()) return null;
  const chemin = [];
  const declarations = [];
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isPropertyAssignment(p)) chemin.push(nomDePropriete(ts, p));
    if (ts.isVariableDeclaration(p)) declarations.push(p.name.getText());
    if (ts.isFunctionDeclaration(p)) {
      if (!p.name) return null;
      declarations.push(p.name.text);
    }
  }
  if (!declarations.length || chemin.includes(null)) return null;
  const proprietaire = declarations.reverse();
  const signature = n => {
    const enfants = [];
    n.forEachChild(c => enfants.push(signature(c)));
    return [n.kind, typeof n.text === 'string' ? n.text : null, enfants];
  };
  return { fichier: fichier.text, titre: titre.text,
    proprietaire: JSON.stringify([proprietaire, chemin.reverse()]),
    contenu: JSON.stringify(node.properties.filter(p => nomDePropriete(ts, p) !== 'fichier')
      .sort((a, b) => parUnitesDeCode(nomDePropriete(ts, a), nomDePropriete(ts, b))).map(signature)) };
}

/** Le NOM d'une propriété, tel qu'écrit, ou `null` s'il est calculé. */
function nomDePropriete(ts, prop) {
  const nom = prop.name;
  if (!nom) return null;
  if (ts.isStringLiteral(nom) || ts.isNoSubstitutionTemplateLiteral(nom) || ts.isIdentifier(nom)) return nom.text;
  return null;
}

function importsDeType(ts, sf) {
  const noms = new Set();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const clause = st.importClause;
    if (clause.isTypeOnly && clause.name) noms.add(clause.name.text);
    const liaisons = clause.namedBindings;
    if (liaisons && ts.isNamespaceImport(liaisons) && clause.isTypeOnly) noms.add(liaisons.name.text);
    if (liaisons && ts.isNamedImports(liaisons)) for (const el of liaisons.elements) {
      if (clause.isTypeOnly || el.isTypeOnly) noms.add(el.name.text);
    }
  }
  return noms;
}

const FOYER_DEPOT_JETABLE = 'scripts/guards/lib/depotGabarit.mjs';
const FABRIQUES_DE_DEPOT = { [FOYER_DEPOT_JETABLE]: ['instanceDeDepot', 'gabaritDeDepot'] };

/**
 * Les ENTRÉES de stock d'une IMAGE de fichier, par ligne croissante — ou `null` si le dialecte n'a
 * pas d'AST ici (le REPLI de ligne juge alors seul). Voir la DÉFINITION en tête de module.
 * Deux entrées sur une même ligne n'en font qu'une (sous-comptage).
 *
 * Chaque entrée porte DEUX lignes : `ligne`, où elle vit (son premier caractère — l'accolade
 * ouvrante d'une entrée-objet JSON), et `nomme`, celle du littéral qui NOMME le fichier. Les deux
 * coïncident sur une entrée d'une seule ligne ; sur une entrée multiligne, c'est `nomme` qui porte
 * l'information, et c'est elle que la porte cite en exemple.
 *
 * Chaque entrée porte aussi sa `cle`, l'IDENTITÉ sous laquelle la porte la compte : `fichierNommePar`
 * de sa ligne nommante (#1806 D5″, #2223), pour une liste, un dictionnaire ou une `Map`.
 * @param {string} source @param {string} chemin
 * @returns {{ ligne: number, nomme: number, cle: string }[] | null}
 */
export function entreesNominatives(source, chemin) {
  const img = imageParsee(source, chemin);
  if (!img) return null;
  const candidat = estSuiteVitest(chemin) && img.sf.statements.some(st => img.ts.isImportDeclaration(st)
    && st.moduleSpecifier.text?.includes('depotGabarit'));
  if (!candidat) return entreesDeLAnalyse(img);
  for (const { sourceFile: sf, diagnostics, checker } of analyserCorpus([{ rel: chemin, text: source }], { inconnu: 'refus' })) {
    if (!sf) return null;
    const analyse = { ts: img.ts, sf, texte: sf.text };
    if (diagnostics.length) return entreesDeLAnalyse(analyse);
    const contexte = contexteImports(sf, checker);
    const typesSeuls = importsDeType(img.ts, sf);
    const fichiersDeFixture = node => {
      const prop = node.parent;
      const options = prop?.parent;
      const appel = options?.parent;
      return !!prop && img.ts.isPropertyAssignment(prop) && prop.initializer === node
        && nomDePropriete(img.ts, prop) === 'fichiers' && !!options && img.ts.isObjectLiteralExpression(options)
        && !!appel && img.ts.isCallExpression(appel) && appel.arguments[0] === options
        && !typesSeuls.has((img.ts.isPropertyAccessExpression(appel.expression) ? appel.expression.expression : appel.expression).text)
        && estAppelDeclare(appel, sf, FABRIQUES_DE_DEPOT, contexte) !== null;
    };
    return entreesDeLAnalyse(analyse, fichiersDeFixture);
  }
  return null;
}

function entreesDeLAnalyse(img, fichiersDeFixture = () => false) {
  const { ts, sf } = img;
  const locales = lignesLocales(img);
  const ligneDe = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const textes = sf.text.split('\n');
  /** @type {Map<number, { nomme: number, cle: string }>} ligne de l'entrée → ligne nommante, identité. */
  const lignes = new Map();
  const poser = (porteur, nommant) => {
    const ligne = ligneDe(porteur);
    const nomme = ligneDe(nommant);
    if (!lignes.has(ligne)) {
      const entree = { nomme, cle: fichierNommePar(textes[nomme - 1] ?? '') };
      const site = siteDeTest(ts, porteur);
      if (site) sitesDesEntrees.set(entree, site);
      lignes.set(ligne, entree);
    }
  };
  const litteral = (n) => n && (ts.isArrayLiteralExpression(n) || ts.isObjectLiteralExpression(n));
  const parcourir = (node) => {
    if (litteral(node) && (fichiersDeFixture(node) || estParametreDAppel(ts, node) || estCheminScalaire(ts, node) || estDescripteurDeCorpus(ts, node))) return;
    if (!litteral(node) || locales.has(ligneDe(node))) {
      node.forEachChild(parcourir);
      return;
    }
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) {
        const nommant = noeudQuiNomme(ts, element, NOMME, fichiersDeFixture);
        if (nommant) poser(element, nommant);
      }
      return;
    }
    for (const prop of node.properties) {
      const nom = nomDePropriete(ts, prop);
      if (nom === 'foyer') continue;
      if (nom !== null && NOMME.test(nom)) { poser(prop, prop.name ?? prop); continue; }
      if (litteral(prop.initializer)) { parcourir(prop.initializer); continue; }
      const nommant = noeudQuiNomme(ts, prop, NOMME, fichiersDeFixture);
      if (nommant) poser(prop, nommant);
    }
  };
  sf.forEachChild(parcourir);
  return [...lignes].sort((a, b) => a[0] - b[0]).map(([ligne, entree]) => copierSite(entree, { ligne, ...entree }));
}

/** Entrées d'une image de fichier (`entreesNominatives`), chacune avec le `texte` de sa ligne
 *  nommante, ou `null` quand l'image ne se lit pas (lecteur absent, fichier supprimé, binaire,
 *  dialecte inconnu) : le REPLI de ligne juge alors, et l'entrée COMPTE.
 *  @returns {{ ligne: number, nomme: number, cle: string, texte: string }[] | null} */
function entreesDeLImage(lire, fichier) {
  if (typeof lire !== 'function') return null;
  let source;
  try { source = lire(fichier); } catch { return null; }
  if (typeof source !== 'string') return null;
  try {
    const lignes = source.split('\n');
    return entreesNominatives(source, fichier)?.map((e) => copierSite(e, { ...e, texte: (lignes[e.nomme - 1] ?? '').replace(/\r$/, '').trim() })) ?? null;
  } catch { return null; }
}

/** `ligne` → `nomme` d'une image lue (`entreesDeLImage`), ou `null`. */
const lignesDEntrees = (entrees) => entrees && new Map(entrees.map((e) => [e.ligne, e.nomme]));

/** `sans` nomme-t-il le fichier `avec` privé de son extension, `sans` n'en ayant aucune ? */
const extensionAjoutee = (sans, avec) => !EXTENSION.test(sans) && avec.replace(EXTENSION, '') === sans && avec !== sans;

/**
 * L'APPARIEMENT des entrées de deux images (#2223) : une entrée d'`apres` s'apparie à une entrée
 * d'`avant` de même `cle`, à texte égal d'abord, puis à clé seule (une valeur réécrite). Au SECOND
 * RANG, une morte et une née qui restent s'apparient quand l'une nomme `p` sans extension et l'autre
 * `p.<ext>` (`extensionAjoutee`, dans les deux sens) ; deux chemins à extension ne s'apparient jamais.
 * Les objets rendus sont ceux reçus : `paires` = `[avant, apres]`.
 * @template {{ cle: string, texte: string }} E
 * @param {E[]} avant @param {E[]} apres
 * @returns {{ paires: [E, E][], nees: E[], mortes: E[] }}
 */
function apparier(avant, apres) {
  /** @type {Map<string, E[]>} */
  const restantes = new Map();
  for (const e of avant) (restantes.get(e.cle) ?? restantes.set(e.cle, []).get(e.cle)).push(e);
  const paires = [];
  const aTexteInegal = apres.filter((e) => {
    const memes = restantes.get(e.cle) ?? [];
    const i = memes.findIndex((m) => m.texte === e.texte);
    if (i < 0) return true;
    paires.push([memes.splice(i, 1)[0], e]);
    return false;
  });
  const aCleInegale = aTexteInegal.filter((e) => {
    const [a] = (restantes.get(e.cle) ?? []).splice(0, 1);
    if (a) paires.push([a, e]);
    return !a;
  });
  const mortes = [...restantes.values()].flat();
  const nees = aCleInegale.filter((e) => {
    const i = mortes.findIndex((m) => extensionAjoutee(m.cle, e.cle) || extensionAjoutee(e.cle, m.cle));
    if (i < 0) return true;
    paires.push([mortes.splice(i, 1)[0], e]);
    return false;
  });
  return { paires, nees, mortes };
}

function copierSite(source, cible) {
  const site = sitesDesEntrees.get(source);
  if (site) sitesDesEntrees.set(cible, site);
  return cible;
}
const vueDEntree = entree => copierSite(entree, { cle: entree.cle, texte: entree.texte });

/**
 * Ce qui NAÎT et ce qui MEURT entre deux images, en ENTRÉES identifiées par leur `cle` (#2223,
 * `apparier`). Réordonner, réindenter ou réécrire la valeur d'une entrée ne fait rien naître.
 * @param {{ cle: string, texte: string }[]} pre @param {{ cle: string, texte: string }[]} post
 * @returns {{ nees: { cle: string, texte: string }[], mortes: { cle: string, texte: string }[] }}
 */
function ecartDEntrees(pre, post) {
  const { nees, mortes } = apparier(pre, post);
  return { nees: nees.map(vueDEntree), mortes: mortes.map(vueDEntree) };
}

/**
 * Ce qu'une FUSION fait naître et mourir, en ENTRÉES, contre la fusion automatique de ses deux
 * parents (#2223), PUR. Une entrée de la `base` commune que l'un des côtés a retirée est retirée de la
 * fusion automatique : la fusion qui la garde la fait NAÎTRE (résurrection, retrait contre retouche
 * compris), celle qui retire une entrée gardée des deux côtés la fait MOURIR. Les entrées nées d'un
 * côté ou de l'autre (le même texte des deux côtés compte une fois) sont celles de la fusion
 * automatique : la fusion ne fait naître que ce qu'elle ajoute à leur multiensemble (`ecartDEntrees`).
 * Ce multiensemble est l'UNION des deux côtés : une copie née de `^1` en consomme une née de `^2` de
 * même clé et même texte, une pour une, comme dans `apparier`.
 * CONTRAT : les entrées de `base` sont des objets DISTINCTS — l'appariement les reconnaît par
 * identité d'objet, et deux entrées partageant un objet n'en feraient qu'une.
 * @param {{ base: { cle: string, texte: string }[], parents: [{ cle: string, texte: string }[], { cle: string, texte: string }[]], fusion: { cle: string, texte: string }[] }} p
 * @returns {{ nees: { cle: string, texte: string }[], mortes: { cle: string, texte: string }[] }}
 */
export function apportDeFusion({ base, parents: [p1, p2], fusion }) {
  const [c1, c2, cm] = [p1, p2, fusion].map((cote) => apparier(base, cote))
  const gardees = (c) => new Map(c.paires)
  const [g1, g2, gm] = [c1, c2, cm].map(gardees)
  const nees = []
  const mortes = []
  for (const e of base) {
    const automatique = g1.has(e) && g2.has(e)
    if (gm.has(e) && !automatique) nees.push(gm.get(e))
    if (!gm.has(e) && automatique) mortes.push(e)
  }
  const deUn = [...c1.nees]
  const nesDesCotes = [...c1.nees, ...c2.nees.filter((e) => {
    const i = deUn.findIndex((d) => d.cle === e.cle && d.texte === e.texte)
    if (i < 0) return true
    deUn.splice(i, 1)
    return false
  })]
  const propres = ecartDEntrees(nesDesCotes, cm.nees)
  return { nees: [...nees.map(vueDEntree), ...propres.nees], mortes: [...mortes.map(vueDEntree), ...propres.mortes] }
}

/**
 * Bilan d'une FUSION, porteur par porteur, PUR (#2223) : `apportDeFusion` sur les images de chacun
 * des `fichiers` — la fusion, ses deux parents, leur base commune —, rendu comme `bilanDesStocks`.
 * Une image absente (`null`) n'a aucune entrée ; une image hors `DIALECTE` non plus (les familles de
 * `PORTEURS` sont toutes dans un dialecte).
 * @param {{ fichiers: string[], lire: { fusion: (c: string) => string | null, parents: [(c: string) => string | null, (c: string) => string | null], commune: (c: string) => string | null } }} p
 * @returns {ReturnType<typeof bilanDesStocks>}
 */
export function bilanDeFusion({ fichiers, lire }) {
  return fichiers.filter(estPorteurDeStock).sort(parUnitesDeCode).map((fichier) => {
    const entrees = (l) => entreesDeLImage(l, fichier) ?? []
    const { nees, mortes } = apportDeFusion({
      base: entrees(lire.commune),
      parents: [entrees(lire.parents[0]), entrees(lire.parents[1])],
      fusion: entrees(lire.fusion),
    })
    return bilanDuPorteur(fichier, nees, mortes, new Map())
  })
}

/** Le bilan d'un porteur : `parCle` = clé → nées moins mortes, les mortes reportées par `renommages`
 *  (chemin au parent ↦ chemin au commit, normalisés comme une clé). */
function bilanDuPorteur(fichier, retenues, perdues, renommages) {
  /** @type {Map<string, number>} clé → croissance nette */
  const parCle = new Map();
  const reportees = new Map([...renommages].map(([a, b]) => [cheminNormalise(a), cheminNormalise(b)]));
  for (const { cle: k } of retenues) parCle.set(k, (parCle.get(k) ?? 0) + 1);
  for (const { cle: k } of perdues) {
    const reportee = reportees.get(k) ?? k;
    parCle.set(reportee, (parCle.get(reportee) ?? 0) - 1);
  }
  return { fichier, retenues, perdues, parCle };
}

/** En-têtes de diff qui ne portent ni contenu ni numérotation. Ceux qui en portent sont lus AVANT :
 *  `diff --git ` (drapeau de zone d'en-tête) et `--- `/`+++ ` (les chemins pré et post). */
const ENTETE_INERTE =
  /^(?:index |old mode |new mode |similarity |dissimilarity |rename |copy |new file mode |deleted file mode |Binary files |GIT binary patch|\\)/;

/**
 * DÉPLACEMENT : une entrée qui QUITTE un porteur DISPARU et reparaît À L'IDENTIQUE ailleurs dans le
 * même diff. Le stock ne grandit pas — c'est le même élément, sous un autre toit —, donc
 * `git mv aStock.mjs bStock.mjs` d'un porteur de six entrées vaut net 0 (#1720). Un `CLIQUET: +6`
 * y serait faux par construction : `+N` compte les entrées du stock, pas un déménagement.
 *
 * BORNE : la source doit DISPARAÎTRE (son post-chemin est `/dev/null`). Sa raison est un
 * CONSERVATISME fail-closed, pas une doctrine du compte — entre deux porteurs VIVANTS, le retrait
 * reste créditable à SON site, hors migration de site de test prouvée par
 * `apparierLesSitesDeTests`. Une redistribution sans cette preuve se DIT par `CLIQUET:`. Rien ne
 * reste à créditer : ses entrées ont déménagé, la porte le lit sans avoir à deviner une intention.
 * L'appariement se fait sur le TEXTE de l'entrée, un pour un.
 *
 * CE QU'IL NE VOIT PAS, mesuré : une entrée RÉÉCRITE en chemin n'est plus la même (c'est le but),
 * mais une entrée seulement REFORMATÉE non plus — guillemets doubles, ou déplacement accompagné
 * d'une retouche — et elle se recompte `+1` chez le receveur (mesuré `+2` sur un renommage de deux
 * entrées dont une requotée). La RÉINDENTATION, elle, n'y échappe pas : le texte est comparé
 * `trim()` (mesuré `[]`).
 * @param {{ fichier: string, disparu: boolean, retenues: string[], perdues: string[] }[]} parFichier
 *   muté sur place : les entrées appariées quittent `retenues`.
 */
function apparierLesDeplacements(parFichier) {
  /** @type {Map<string, number>} texte d'entrée → combien de fois il a quitté un porteur disparu. */
  const partantes = new Map();
  for (const f of parFichier) {
    if (!f.disparu) continue;
    for (const { texte } of f.perdues) partantes.set(texte, (partantes.get(texte) ?? 0) + 1);
  }
  if (partantes.size === 0) return;
  for (const f of parFichier) {
    if (f.disparu) continue;
    f.retenues = f.retenues.filter(({ texte }) => {
      const reste = partantes.get(texte) ?? 0;
      if (reste === 0) return true;
      partantes.set(texte, reste - 1);
      return false;
    });
  }
}

function apparierLesSitesDeTests(parFichier, { lirePreImage, lirePostImage, renommages }) {
  if (typeof lirePreImage !== 'function') return;
  const caches = [new Map(), new Map()];
  const lire = (cote, chemin) => {
    const cache = caches[cote];
    if (!cache.has(chemin)) {
      try { cache.set(chemin, [lirePreImage, lirePostImage][cote](chemin)); }
      catch { cache.set(chemin, undefined); }
    }
    return cache.get(chemin);
  };
  const titresLus = new Map();
  const titres = (source, chemin) => {
    if (typeof source !== 'string' || !estSuiteVitest(chemin)) return null;
    const cle = JSON.stringify([chemin, source]);
    if (titresLus.has(cle)) return titresLus.get(cle);
    let trouves = null;
    for (const { sourceFile: sf, diagnostics, checker } of analyserCorpus([{ rel: chemin, text: source }], { inconnu: 'refus' })) {
      if (!sf || diagnostics.length) break;
      const ts = typescript();
      const imports = contexteImports(sf, checker);
      const typesSeuls = importsDeType(ts, sf);
      const apiDeTest = e => {
        if (ts.isIdentifier(e)) {
          if (typesSeuls.has(e.text)) return false;
          const origine = liaisonImportee(e, sf, imports);
          if (origine) return ['vitest', 'node:test'].includes(origine.spec)
            && (['it', 'test'].includes(origine.nom) || (origine.spec === 'node:test' && origine.nom === 'default'));
          return ['it', 'test'].includes(e.text) && !checker.getSymbolAtLocation(e);
        }
        if (!ts.isPropertyAccessExpression(e) || !ts.isIdentifier(e.expression)
          || typesSeuls.has(e.expression.text) || !['it', 'test'].includes(e.name.text)) return false;
        const origine = liaisonImportee(e.expression, sf, imports);
        return !!origine && origine.nom === '*' && ['vitest', 'node:test'].includes(origine.spec);
      };
      trouves = new Set();
      const visiter = node => {
        if (ts.isCallExpression(node)) {
          const titre = node.arguments[0];
          if (titre && ts.isStringLiteral(titre) && apiDeTest(node.expression)) trouves.add(titre.text);
        }
        node.forEachChild(visiter);
      };
      visiter(sf);
    }
    titresLus.set(cle, trouves);
    return trouves;
  };
  const preuve = (a, b) => {
    if (a.fichier === b.fichier || a.titre !== b.titre || a.contenu !== b.contenu
      || a.proprietaire !== b.proprietaire || lire(1, a.fichier) !== null) return false;
    const avant = titres(lire(0, a.fichier), a.fichier);
    const apres = titres(lire(1, b.fichier), b.fichier);
    const preNouveau = lire(0, b.fichier);
    const deja = preNouveau === null ? new Set() : titres(preNouveau, b.fichier);
    return !!avant?.has(a.titre) && !!apres?.has(b.titre) && deja !== null && !deja.has(b.titre);
  };
  for (const receveur of parFichier) {
    receveur.retenues = receveur.retenues.filter(nee => {
      const b = sitesDesEntrees.get(nee);
      if (!b) return true;
      for (const donneur of parFichier) {
        if (donneur.fichier !== receveur.fichier && renommages.get(donneur.fichier) !== receveur.fichier) continue;
        const i = donneur.perdues.findIndex(morte => {
          const a = sitesDesEntrees.get(morte);
          return a && preuve(a, b);
        });
        if (i >= 0) { donneur.perdues.splice(i, 1); return false; }
      }
      return true;
    });
  }
}

/**
 * Le TEXTE qui représente une entrée touchée : la ligne où elle NOMME son fichier quand le diff la
 * porte, sinon la ligne de l'entrée elle-même. Une entrée-objet JSON vit à son accolade ouvrante :
 * la citer telle quelle rendrait un exemple `"{"`, sans information, et apparierait deux déplacements
 * sur une accolade. La ligne nommante est ce qui distingue une entrée d'une autre.
 * @param {{ texte: string, ligne: number }[]} touchees
 * @param {Map<number, number> | null} entrees ligne d'entrée → ligne nommante de l'image
 */
function texteDEntree(touchees, entrees) {
  const parLigne = new Map(touchees.map((t) => [t.ligne, t.texte]));
  return (t) => parLigne.get(entrees?.get(t.ligne)) ?? t.texte;
}

/**
 * Croissance des stocks nominatifs d'un diff unifié (`-U0` ou non : seuls les `+`/`-` comptent), PAR
 * CLÉ (#1806 D5″) : la clé d'une entrée est le fichier qu'elle nomme (`fichierNommePar`), et la
 * croissance d'un porteur est la somme des croissances nettes POSITIVES de ses clés — un retrait sous
 * une clé ne paie pas un ajout sous une autre. Les clés RETIRÉES sont d'abord reportées par
 * `images.renommages` (chemin au parent ↦ chemin au commit, la carte `-M`, FOURNIE par l'appelant) : un
 * renommage pur coûte 0. Un porteur n'est rendu que si cette somme est positive.
 *
 * Une entrée DÉPLACÉE d'un porteur DISPARU vers un autre porteur ne compte nulle part
 * (`apparierLesDeplacements`, qui porte la borne et sa raison).
 *
 * Les entrées se lisent sur le POST-IMAGE (`lirePostImage(chemin)`) et le PRÉ-IMAGE
 * (`lirePreImage(chemin)`) de chaque porteur touché, et le compte est leur écart (`ecartDEntrees`) :
 * réordonner ou réécrire la valeur d'une entrée ne fait rien naître (#2223). Quand un lecteur rend
 * `null`, les lignes du diff jugent : une ligne compte quand `entreesNominatives` de l'image lisible
 * y pose une entrée, sinon `estEntreeNominative` la juge seule. Les deux lecteurs sont fournis par
 * l'appelant : la lib reste PURE.
 * @param {string} diffU0
 * @param {{ lirePostImage: (chemin: string) => string | null,
 *           lirePreImage?: (chemin: string) => string | null,
 *           renommages?: ReadonlyMap<string, string> }} images
 * @returns {{ fichier: string, ajoutees: number, retirees: number, net: number, exemples: string[] }[]}
 *   trié par fichier ; `net` = la croissance par clé ; `exemples` = jusqu'à 3 entrées ajoutées sous
 *   une clé qui croît, citées par leur ligne NOMMANTE (`texteDEntree`) telle qu'écrite.
 * @throws {TypeError} si le diff n'est pas une chaîne.
 * @throws {Error} si `images.lirePostImage` n'est pas une fonction : sans image, une entrée que le
 *   repli de ligne ne sait pas lire (entrée-objet JSON, propriété dont la clé ne nomme pas de
 *   fichier) ne se compte pas, et l'appelant reçoit un zéro qui ment. Un lecteur qui rend `null`
 *   est un lecteur : le repli juge alors, et la porte le sait.
 */
export function croissanceDesStocks(diffU0, images) {
  return croissancesDuBilan(bilanDesStocks(diffU0, images));
}

/**
 * Le BILAN SIGNÉ d'un diff, porteur par porteur : `parCle` = clé → croissance nette, NÉGATIVE comprise,
 * pour TOUT porteur touché. `croissanceDesStocks` en est la lecture positive ; deux bilans se
 * SOUSTRAIENT clé par clé (`bilanSoustrait`, `plageStock.mjs`, #1806). Mêmes paramètres et mêmes
 * levées que `croissanceDesStocks`, qui les lui délègue.
 * @param {string} diffU0 @param {Parameters<typeof croissanceDesStocks>[1]} images
 * @returns {{ fichier: string, retenues: { cle: string, texte: string }[], perdues: { cle: string, texte: string }[], parCle: Map<string, number> }[]}
 */
export function bilanDesStocks(diffU0, images) {
  if (typeof diffU0 !== 'string') {
    throw new TypeError(
      `bilanDesStocks(diffU0, images) attend le diff en CHAÎNE, reçu ${typeof diffU0} `
      + '— la signature est POSITIONNELLE : bilanDesStocks(diff, { lirePostImage, lirePreImage })',
    );
  }
  if (typeof images?.lirePostImage !== 'function') {
    throw new Error(
      "bilanDesStocks : aucun lecteur d'image post — un compte sans image ment. Passer "
      + '`{ lirePostImage: (chemin) => string | null }` ; un lecteur qui rend `null` laisse le REPLI '
      + 'de ligne juger.',
    );
  }
  const { lirePostImage, lirePreImage = null, renommages = new Map() } = images;
  /** @type {Map<string, { ajoutees: { texte: string, ligne: number }[],
   *    retirees: { texte: string, ligne: number }[], disparu: boolean, ne: boolean }>} */
  const parFichier = new Map();
  const suivi = (chemin) => {
    if (!parFichier.has(chemin)) parFichier.set(chemin, { ajoutees: [], retirees: [], disparu: false, ne: false });
    return parFichier.get(chemin);
  };
  const porteurOuNull = (brut) => {
    const chemin = brut.trim();
    return chemin !== '/dev/null' && estPorteurDeStock(chemin) ? chemin.replace(/\\/g, '/') : null;
  };
  // Les AJOUTS vivent sous le post-chemin, les RETRAITS sous le PRÉ-chemin : ils coïncident sur une
  // modification, et divergent sur une SUPPRESSION, dont le post-chemin est `/dev/null`. C'est ce
  // qui rend visibles les entrées que perd un porteur supprimé, et fait d'un renommage un
  // DÉPLACEMENT plutôt qu'un porteur neuf de N entrées (#1720).
  let ancien = null;
  let preAbsent = false;
  let nouveau = null;
  let numAncien = 0;
  let numNouveau = 0;
  // `--- `/`+++ ` ne sont des EN-TÊTES que hors d'un hunk : DANS un hunk, une ligne de CONTENU
  // retirée qui commence par `-- ` s'écrit `--- …` et n'est qu'un retrait. Le drapeau de zone la
  // laisse donc à sa branche, et le pré-chemin tient pour TOUS les retraits du fichier — `@@` ne le
  // réarme pas, un stock qui MAIGRIT se lit jusqu'au bout.
  let dansHunk = false;
  for (const brute of diffU0.split('\n')) {
    const ligne = brute.replace(/\r$/, '');
    if (ligne.startsWith('diff --git ')) {
      dansHunk = false;
      continue;
    }
    const entetePre = dansHunk ? null : /^--- (?:a\/)?(.+)$/.exec(ligne);
    if (entetePre) {
      ancien = porteurOuNull(entetePre[1]);
      preAbsent = entetePre[1].trim() === '/dev/null';
      continue;
    }
    const entete = dansHunk ? null : /^\+\+\+ (?:b\/)?(.+)$/.exec(ligne);
    if (entete) {
      nouveau = porteurOuNull(entete[1]);
      if (ancien && entete[1].trim() === '/dev/null') suivi(ancien).disparu = true;
      if (nouveau && preAbsent) suivi(nouveau).ne = true;
      numAncien = 0;
      numNouveau = 0;
      continue;
    }
    const hunk = enteteDeHunk(ligne);
    if (hunk) {
      numAncien = hunk.a;
      numNouveau = hunk.c;
      dansHunk = true;
      continue;
    }
    if (ENTETE_INERTE.test(ligne)) continue;
    const ajout = ligne.startsWith('+');
    const retrait = ligne.startsWith('-');
    if (!ajout && !retrait) {
      // Ligne de CONTEXTE : elle existe des deux côtés et fait avancer les deux numérotations.
      numAncien += 1;
      numNouveau += 1;
      continue;
    }
    const porteur = ajout ? nouveau : ancien;
    const numero = ajout ? numNouveau++ : numAncien++;
    if (!porteur) continue;
    const touchee = { texte: ligne.slice(1).trim(), ligne: numero };
    const compte = suivi(porteur);
    if (ajout) compte.ajoutees.push(touchee);
    else compte.retirees.push(touchee);
  }
  const lus = [...parFichier]
    .map(([fichier, { ajoutees, retirees, disparu, ne }]) => {
      const post = disparu ? [] : entreesDeLImage(lirePostImage, fichier);
      const pre = ne ? [] : entreesDeLImage(lirePreImage, fichier);
      if (post && pre) {
        const { nees, mortes } = ecartDEntrees(pre, post);
        return { fichier, disparu, retenues: nees, perdues: mortes };
      }
      const surPost = lignesDEntrees(post);
      const surPre = lignesDEntrees(pre);
      const estEntree = (entrees) => (t) => (entrees ? entrees.has(t.ligne) : estEntreeNominative(t.texte));
      const identifiee = (texte) => ({ cle: fichierNommePar(texte), texte });
      const { nees, mortes } = ecartDEntrees(
        retirees.filter(estEntree(surPre)).map(texteDEntree(retirees, surPre)).map(identifiee),
        ajoutees.filter(estEntree(surPost)).map(texteDEntree(ajoutees, surPost)).map(identifiee),
      );
      return { fichier, disparu, retenues: nees, perdues: mortes };
    })
    .sort((a, b) => parUnitesDeCode(a.fichier, b.fichier));
  apparierLesDeplacements(lus);
  apparierLesSitesDeTests(lus, { lirePreImage, lirePostImage, renommages });
  return lus.map(({ fichier, retenues, perdues }) => bilanDuPorteur(fichier, retenues, perdues, renommages));
}

/** Croissance d'un porteur lue sur ses clés : la somme des nets POSITIFS (#1806 D5″). */
export const croissanceDesCles = (parCle) => [...parCle.values()].reduce((s, n) => s + Math.max(0, n), 0);

/** La lecture POSITIVE d'un bilan : les porteurs qui croissent, trois exemples sous une clé qui croît. */
function croissancesDuBilan(bilan) {
  return bilan
    .map(({ fichier, retenues, perdues, parCle }) => {
      const croit = (t) => (parCle.get(t.cle) ?? 0) > 0;
      return {
        fichier,
        ajoutees: retenues.length,
        retirees: perdues.length,
        net: croissanceDesCles(parCle),
        exemples: retenues.filter(croit).slice(0, 3).map((t) => t.texte),
      };
    })
    .filter((c) => c.net > 0);
}

/** Longueur minimale d'un motif de cliquet : sous ce seuil, c'est un tampon, pas une raison. */
export const MOTIF_MIN = 20;

/**
 * Lignes DÉCLARÉES par un message de commit sous un MOT-CLÉ : `<MOT>: <fichier> +N — <motif>`. Lecteur
 * UNIQUE des déclarations au compte exact — `CLIQUET:` (un stock qui grandit, ci-dessous) et
 * `RECLASSEMENT:` (une revendication `css` qui sort des sites du stock CSS, `reclassementCss.mjs`).
 * Le tiret peut être cadratin, demi-cadratin ou trait d'union ; un motif plus court que `MOTIF_MIN`
 * n'est pas retenu (l'appelant voit alors le fichier comme non couvert).
 * @param {string} message @param {string} motCle
 * @returns {{ fichier: string, n: number, motif: string }[]}
 */
export function declarationsDuMessage(message, motCle) {
  const out = [];
  const motif = new RegExp(String.raw`^[^\S\n]*${motCle}\s*:\s*(\S+)\s*\+(\d+)\s*[—–-]\s*(.+)$`, 'gm');
  for (const m of String(message ?? '').matchAll(motif)) {
    const raison = m[3].trim();
    if (raison.length >= MOTIF_MIN) out.push({ fichier: m[1].replace(/\\/g, '/'), n: Number(m[2]), motif: raison });
  }
  return out;
}

/** Cliquets DÉCLARÉS par un message de commit : `CLIQUET: <fichier> +N — <motif>`. */
export const cliquetsDuMessage = (message) => declarationsDuMessage(message, 'CLIQUET');

/**
 * Les mesures NON COUVERTES par les lignes déclarées : une mesure `{ fichier, n }` n'est couverte que
 * par UNE ligne qui la nomme ET annonce son compte exact — sinon la ligne serait un tampon qui survit
 * au geste suivant, et deux lignes pour un même fichier laisseraient choisir la bonne. Juge UNIQUE de
 * `CLIQUET:` (ci-dessous) et de `RECLASSEMENT:` (`reclassementCss.mjs`).
 * @template {{ fichier: string, n: number }} M
 * @param {readonly M[]} mesures @param {readonly { fichier: string, n: number }[]} lignes
 * @returns {(M & { declare: number | null, declarees?: number[] })[]} `declare` = le premier `+N` lu
 *   pour ce fichier ; `declarees` = tous, présent seulement s'il y en a plusieurs.
 */
export function mesuresNonCouvertes(mesures, lignes) {
  return mesures.flatMap((m) => {
    const pourLui = lignes.filter((d) => d.fichier === m.fichier);
    if (pourLui.length === 1 && pourLui[0].n === m.n) return [];
    const declarees = pourLui.length > 1 ? { declarees: pourLui.map((d) => d.n) } : {};
    return [{ ...m, declare: pourLui.length ? pourLui[0].n : null, ...declarees }];
  });
}

/**
 * Ce que le message a déclaré pour une mesure non couverte, en clair : aucune ligne, un compte
 * faux, ou plusieurs lignes pour le même fichier.
 * @param {{ n: number, declare: number | null, declarees?: number[] }} r @returns {string}
 */
export function declarationLue(r) {
  if (r.declarees) return `le message porte ${r.declarees.length} lignes (${r.declarees.map((n) => `+${n}`).join(', ')}) — une seule par fichier`;
  if (r.declare === null) return 'aucune ligne au message';
  return `le message annonce \`+${r.declare}\`, pas +${r.n}`;
}

/**
 * Croissances NON COUVERTES par un cliquet du message : un cliquet ne couvre un fichier que s'il
 * ANNONCE LE BON COMPTE (`+N` = la croissance nette réelle) — sinon la ligne serait un tampon qui
 * survit à l'ajout suivant.
 * @param {{ diff: string, message: string }} p
 * @param {Parameters<typeof croissanceDesStocks>[1]} images
 * @returns {{ fichier: string, ajoutees: number, retirees: number, net: number, exemples: string[],
 *   declare: number | null }[]}
 * @throws {Error} propagé de `croissanceDesStocks` : sans `images.lirePostImage`, le compte ment.
 */
export function croissancesNonCouvertes({ diff, message }, images) {
  return nonCouvertesDuBilan(bilanDesStocks(diff, images), message);
}

/** `croissancesNonCouvertes` sur un bilan DÉJÀ lu (`bilanDesStocks`) : la plage le lit une fois. */
export function nonCouvertesDuBilan(bilan, message) {
  const mesures = croissancesDuBilan(bilan).map((c) => ({ ...c, n: c.net }));
  return mesuresNonCouvertes(mesures, cliquetsDuMessage(message)).map(({ n: _n, ...c }) => c);
}

/**
 * Le geste qui porte une ligne (`CLIQUET:`, `RECLASSEMENT:`) au message des commits d'une PLAGE à qui
 * un refus est attribué, selon qu'ils sont des FUSIONS (`fusion`) ou des commits simples : chaque sorte
 * présente a le sien, sans `rebase -i`.
 * @param {{ fusion: boolean }[]} refus @returns {string}
 */
export function gesteSurLesCommitsFautifs(refus) {
  const gestes = [];
  if (refus.some((r) => !r.fusion)) {
    gestes.push('commit simple : `git commit --amend` s’il est la tête ; plus bas, reconstruire la pile depuis son parent '
      + '(`git cherry-pick` du commit, `git commit --amend`, puis `git cherry-pick` des suivants)');
  }
  if (refus.some((r) => r.fusion)) gestes.push('FUSION : `git commit --amend` de la fusion si elle est la tête ; sinon refaire la fusion');
  return gestes.join(' ; ');
}

/** Refus lisible d'une croissance : ce qui a grossi, de combien, trois exemples, et le geste. */
export function raisonDeRefus(croissances) {
  const lignes = croissances.map((c) => {
    const compte = `+${c.net} entrée(s) nette(s) (${c.ajoutees} ajoutée(s), ${c.retirees} retirée(s))`;
    const declare = c.declare === null ? '' : ` — ${declarationLue({ ...c, n: c.net })}`;
    return `${c.fichier} : ${compte}${declare} — ex. ${c.exemples.join(' · ')}`;
  });
  return (
    `⛔ STOCK NOMINATIF qui NAÎT ou GRANDIT : ${lignes.join(' || ')}. Un stock nominatif est une ` +
    "DETTE vers zéro, jamais un registre : retirer l'entrée, ou porter la règle dans le socle pour " +
    "qu'aucune entrée ne soit nécessaire. Si la croissance est délibérée, le message de commit la " +
    'DIT : `CLIQUET: <fichier> +N — <motif>` (motif d’au moins ' + MOTIF_MIN + ' caractères). `+N` '
    + "compte les ENTRÉES du stock — ses éléments —, jamais ce qu'elles dénombrent."
  );
}

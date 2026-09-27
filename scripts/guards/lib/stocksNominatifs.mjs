// CROISSANCE D'UN STOCK NOMINATIF dans un diff. Un stock (tableau/Set/Map/objet de chemins
// `src/…`, `scripts/…`, `docs/…`, parfois `fichier:ligne`) est une DETTE qui va vers zéro : il
// DÉCROÎT. Un stock qui naît ou grossit est une exemption de plus, et l'ajout d'une ligne y est
// toujours le chemin le plus court pour rendre une CI verte — c'est exactement ce que le cliquet
// doit rendre visible (même raison que l'interdit du PLAFOND en tête de `stock.mjs`).
//
// FRONTIÈRE (celle de `stock.mjs`) : cette lib CALCULE, le VERDICT appartient à l'appelant — le
// garde de solde (au commit) et les portes a posteriori (dernier commit, plage poussée) décident,
// avec quel message et sous quelle dérogation.
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
// En JSON, tout est de portée module. Aucun seuil de taille : la porte compte des lignes ajoutées et
// retirées, jamais des stocks.
//
// PORTÉE DE MODULE : une entrée ne compte que si elle vit au niveau du MODULE. Un littéral écrit
// dans un corps de fonction (`test(…)`, `it(…)`, une fabrique) est une DONNÉE LOCALE, pas un stock :
// il ne survit pas à l'appel qui le porte et ne s'ajoute à aucune dette. La position se décide sur
// le POST-IMAGE du fichier par l'AST TypeScript, jamais par indentation (les trois « entrées » de
// `429b9a1a2`, les deux faux positifs de `91c928d16` et le `+8` de `572e60b8b` sont tous de cette
// classe ; précédent `0d6ddeee1` : la classe se règle au garde, jamais à la fixture).
//
// UNE SEULE SOURCE D'IMAGE : le lecteur `lirePostImage` que l'appelant fournit (contrat
// `lirePostImage` de `gitPorte.mjs`). `croissanceDesStocks` REFUSE nommément l'appel qui n'en porte
// pas — un compte sans image ment —, et ne reconstruit aucune image depuis le diff. VOIE NOMINALE :
// le lecteur rend l'image, `entreesNominatives` y pose les entrées, et une ligne du diff ne compte que
// si elle en porte une. REPLI : quand le lecteur rend `null` (fichier supprimé, binaire, dialecte
// hors `DIALECTE`), `estEntreeNominative` juge la LIGNE seule et l'entrée COMPTE — la porte perd sa
// précision, jamais sa vue. Ce que le repli ne sait pas lire, il le rate : entrée MULTILIGNE,
// entrée-objet JSON, propriété dont la CLÉ ne nomme pas de fichier alors que sa valeur en nomme
// (`"sites": [ … ]` de `scripts/raw/reconciliation-stock.json`). Les appelants de production
// fournissent l'image (`plageStock.mjs`, `solde-ticket-guard.mjs`).
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
//     lui, ne les voit dans aucun des deux cas. Ce qui a fait la frontière : la ligne
//     `for (const { rel, text } of readCorpus(['src/ui']))` de `6382c792d` et les quatre
//     `readCorpus([ … ])` de `cc71eb45c` ont coûté trois runs de gates et cinq cliquets qui NIENT
//     leur propre croissance (« aucun stock ne grandit ») ;
//   · un ARGUMENT qui NOMME un fichier reste compté : les sept façades d'une ligne de la sonde du
//     juge (2026-09-07) — `defineStock`, `registre`, `Array.from`, `[].concat`, identité,
//     `Object.freeze(registre([ … ]))`, `table({ 'src/a.ts': 1 })` — rendent chacune leurs entrées ;
//   · une flèche à corps CONCIS reste de portée MODULE (`export const stock = () => [ … ]`) : c'est
//     l'une des trois enveloppes d'une ligne mesurées le 2026-09-04, et la traiter en corps de
//     fonction rouvrirait ce contournement ;
//   · les DIALECTES des porteurs de test ne sont pas énumérés ici : ils viennent du fragment
//     `SUFFIXE_SUITE` (`fichierVitest.mjs`), qui les porte tous — une suite née en `.mts` ou en
//     `.mjs` sous `src/` entre dans le périmètre sans qu'on revienne sur cette liste.
import { SUFFIXE_SUITE } from './fichierVitest.mjs'
import { parUnitesDeCode } from './lister.mjs'
import { ast, typescript } from './dialecte.mjs'
import { enteteDeHunk } from './hunks.mjs'

/** Fichiers susceptibles de porter un stock nominatif. Une BASELINE de COMPTE
 *  (`scripts/raw/*-baseline.json`, `scripts/guards/*.json`) n'y entre que pour ses CLÉS — limite
 *  écrite en tête de ce module ; les deux motifs restent, une baseline de compte pouvant renaître.
 *  Les JSON de `scripts/guards/lib/` (`decisions-baseline.json`) et le gel d'exports de la racine
 *  (`knip-exports-baseline.json`) sont, eux, NOMINATIFS de bout en bout. */
const PORTEURS = [
  // Les SUITES des deux racines : une racine COMPOSÉE avec le suffixe de suite du prédicat partagé
  // (`fichierVitest.mjs`). Un BANC en est absent à dessein : son index FIGÉ est le témoin qu'il
  // compare au vif, pas un stock nominatif à migrer.
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
 *   · le jeton OUVRE la ligne : élément de liste/Set (`'src/x.test.ts',`), clé d'objet
 *     (`'criticals.json': 'raison',`), ou tuple dont il est la clé (`['src/x.ts', { n: 32, … }],`) ;
 *   · le jeton FERME un tuple crocheté (`['CritEscalation', 'onRepeat', 'src/x.ts:325'],`) —
 *     forme réelle des stocks de sites de ce dépôt, que la première ne voit pas.
 */
const ENTREE_EN_TETE = new RegExp(String.raw`^\s*\[?\s*${JETON}\s*(?:[,:][^\n]*)?$`);
const ENTREE_EN_QUEUE = new RegExp(String.raw`^\s*\[[^\n]*${JETON}\s*\][,;]?\s*(?:\/\/[^\n]*)?$`);

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
        if (ts.isFunctionLike(arg)) marquer(arg);
        else visiter(arg);
      }
      return;
    }
    ts.forEachChild(node, visiter);
  };
  ts.forEachChild(sf, visiter);
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

/** Le littéral de chaîne du sous-arbre qui NOMME un fichier, ou `null`. La CLÉ d'une propriété en
 *  fait partie : c'est elle que porte le registre `AUTO_RESOLUS` (`'criticals.json': …`). Rendre le
 *  NŒUD, et pas un booléen, donne à l'appelant la LIGNE où le fichier est nommé — celle qu'une
 *  entrée multiligne doit citer en exemple. */
function noeudQuiNomme(ts, node, motif = NOMME) {
  let trouve = null;
  const visiter = (n) => {
    if (trouve) return;
    if (ts.isPropertyAssignment(n) && cleDe(ts, n) === 'foyer') return;
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
    ts.forEachChild(n, visiter);
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
  const parent = node.parent;
  if (!parent || !ts.isCallExpression(parent)) return false;
  if (!(parent.arguments ?? []).some((a) => a === node)) return false;
  return !nommeUnFichier(ts, node, NOMME_FICHIER);
}

/** La CLÉ d'une propriété, telle qu'écrite, ou `null` si elle est calculée. */
function cleDe(ts, prop) {
  const nom = prop.name;
  if (!nom) return null;
  if (ts.isStringLiteral(nom) || ts.isNoSubstitutionTemplateLiteral(nom) || ts.isIdentifier(nom)) return nom.text;
  return null;
}

/**
 * Les ENTRÉES de stock d'une IMAGE de fichier, par ligne croissante — ou `null` si le dialecte n'a
 * pas d'AST ici (le REPLI de ligne juge alors seul). Voir la DÉFINITION en tête de module.
 * Deux entrées sur une même ligne n'en font qu'une (sous-comptage).
 *
 * Chaque entrée porte DEUX lignes : `ligne`, où elle vit (son premier caractère — l'accolade
 * ouvrante d'une entrée-objet JSON), et `nomme`, celle du littéral qui NOMME le fichier. Les deux
 * coïncident sur une entrée d'une seule ligne ; sur une entrée multiligne, c'est `nomme` qui porte
 * l'information, et c'est elle que la porte cite en exemple.
 * @param {string} source @param {string} chemin
 * @returns {{ ligne: number, nomme: number }[] | null}
 */
export function entreesNominatives(source, chemin) {
  const img = imageParsee(source, chemin);
  if (!img) return null;
  const { ts, sf } = img;
  const locales = lignesLocales(img);
  const ligneDe = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  /** @type {Map<number, number>} ligne de l'entrée → ligne où elle nomme son fichier. */
  const lignes = new Map();
  const poser = (porteur, nommant) => {
    const ligne = ligneDe(porteur);
    if (!lignes.has(ligne)) lignes.set(ligne, nommant ? ligneDe(nommant) : ligne);
  };
  const litteral = (n) => n && (ts.isArrayLiteralExpression(n) || ts.isObjectLiteralExpression(n));
  const parcourir = (node) => {
    if (!litteral(node) || locales.has(ligneDe(node)) || estParametreDAppel(ts, node)) {
      ts.forEachChild(node, parcourir);
      return;
    }
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) {
        const nommant = noeudQuiNomme(ts, element);
        if (nommant) poser(element, nommant);
      }
      return;
    }
    for (const prop of node.properties) {
      const cle = cleDe(ts, prop);
      if (cle === 'foyer') continue;
      if (cle !== null && NOMME.test(cle)) { poser(prop, prop.name ?? prop); continue; }
      if (litteral(prop.initializer)) { parcourir(prop.initializer); continue; }
      const nommant = noeudQuiNomme(ts, prop);
      if (nommant) poser(prop, nommant);
    }
  };
  ts.forEachChild(sf, parcourir);
  return [...lignes].sort((a, b) => a[0] - b[0]).map(([ligne, nomme]) => ({ ligne, nomme }));
}

/** Entrées d'une image de fichier, `ligne` → `nomme`, ou `null` quand l'image ne se lit pas (lecteur
 *  absent, fichier supprimé, binaire, dialecte inconnu) : le REPLI de ligne juge alors, et l'entrée
 *  COMPTE. */
function lignesDEntrees(lire, fichier) {
  if (typeof lire !== 'function') return null;
  let source;
  try { source = lire(fichier); } catch { return null; }
  if (typeof source !== 'string') return null;
  try {
    const entrees = entreesNominatives(source, fichier);
    return entrees && new Map(entrees.map((e) => [e.ligne, e.nomme]));
  } catch { return null; }
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
 * reste créditable à SON site (le porteur source décroît de 1 et le reste plus tard), et une
 * redistribution délibérée se DIT par `CLIQUET:` chez le receveur. D'un porteur supprimé, rien ne
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
    for (const texte of f.perdues) partantes.set(texte, (partantes.get(texte) ?? 0) + 1);
  }
  if (partantes.size === 0) return;
  for (const f of parFichier) {
    if (f.disparu) continue;
    f.retenues = f.retenues.filter((texte) => {
      const reste = partantes.get(texte) ?? 0;
      if (reste === 0) return true;
      partantes.set(texte, reste - 1);
      return false;
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
 * Croissance NETTE des stocks nominatifs d'un diff unifié (`-U0` ou non : seuls les `+`/`-`
 * comptent). Un fichier n'est rendu que si ses entrées AJOUTÉES dépassent ses entrées RETIRÉES.
 *
 * Une entrée DÉPLACÉE d'un porteur DISPARU vers un autre porteur ne compte nulle part
 * (`apparierLesDeplacements`, qui porte la borne et sa raison).
 *
 * Les lignes AJOUTÉES se lisent sur le POST-IMAGE (`lirePostImage(chemin)`), les RETIRÉES sur le
 * PRÉ-IMAGE (`lirePreImage(chemin)`) — sans quoi le retrait d'une fixture locale compenserait
 * l'ajout d'une vraie entrée. Une ligne compte quand `entreesNominatives` de l'image correspondante y
 * pose une entrée ; quand le lecteur rend `null`, `estEntreeNominative` juge la ligne seule. Les deux
 * lecteurs sont fournis par l'appelant : la lib reste PURE.
 * @param {string} diffU0
 * @param {{ lirePostImage: (chemin: string) => string | null,
 *           lirePreImage?: (chemin: string) => string | null }} images
 * @returns {{ fichier: string, ajoutees: number, retirees: number, net: number, exemples: string[] }[]}
 *   trié par fichier ; `exemples` = jusqu'à 3 entrées ajoutées, citées par leur ligne NOMMANTE
 *   (`texteDEntree`) telle qu'écrite.
 * @throws {TypeError} si le diff n'est pas une CHAÎNE : la signature est POSITIONNELLE, et un appel
 *   en objet (`croissanceDesStocks({ diff })`) stringifiait `[object Object]` — donc `[]` sur TOUS
 *   les commits, y compris sur des croissances réelles. Un juge a publié ce faux zéro le 2026-09-04
 *   (revue de palier n°4, trouvaille 5) : la lib ne peut pas distinguer un diff vide d'un appel mal
 *   formé, elle refuse donc de deviner.
 * @throws {Error} si `images.lirePostImage` n'est pas une fonction : sans image, une entrée que le
 *   repli de ligne ne sait pas lire (entrée-objet JSON, propriété dont la clé ne nomme pas de
 *   fichier) ne se compte pas, et l'appelant reçoit un zéro qui ment. Un lecteur qui rend `null`
 *   est un lecteur : le repli juge alors, et la porte le sait.
 */
export function croissanceDesStocks(diffU0, images) {
  if (typeof diffU0 !== 'string') {
    throw new TypeError(
      `croissanceDesStocks(diffU0, images) attend le diff en CHAÎNE, reçu ${typeof diffU0} `
      + '— la signature est POSITIONNELLE : croissanceDesStocks(diff, { lirePostImage, lirePreImage })',
    );
  }
  if (typeof images?.lirePostImage !== 'function') {
    throw new Error(
      "croissanceDesStocks : aucun lecteur d'image post — un compte sans image ment. Passer "
      + '`{ lirePostImage: (chemin) => string | null }` ; un lecteur qui rend `null` laisse le REPLI '
      + 'de ligne juger.',
    );
  }
  const { lirePostImage, lirePreImage = null } = images;
  /** @type {Map<string, { ajoutees: { texte: string, ligne: number }[],
   *    retirees: { texte: string, ligne: number }[], disparu: boolean }>} */
  const parFichier = new Map();
  const suivi = (chemin) => {
    if (!parFichier.has(chemin)) parFichier.set(chemin, { ajoutees: [], retirees: [], disparu: false });
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
      continue;
    }
    const entete = dansHunk ? null : /^\+\+\+ (?:b\/)?(.+)$/.exec(ligne);
    if (entete) {
      nouveau = porteurOuNull(entete[1]);
      if (ancien && entete[1].trim() === '/dev/null') suivi(ancien).disparu = true;
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
    .map(([fichier, { ajoutees, retirees, disparu }]) => {
      const surPost = lignesDEntrees(lirePostImage, fichier);
      const surPre = lignesDEntrees(lirePreImage, fichier);
      const estEntree = (entrees) => (t) => (entrees ? entrees.has(t.ligne) : estEntreeNominative(t.texte));
      return {
        fichier,
        disparu,
        retenues: ajoutees.filter(estEntree(surPost)).map(texteDEntree(ajoutees, surPost)),
        perdues: retirees.filter(estEntree(surPre)).map(texteDEntree(retirees, surPre)),
      };
    })
    .sort((a, b) => parUnitesDeCode(a.fichier, b.fichier));
  apparierLesDeplacements(lus);
  return lus
    .map(({ fichier, retenues, perdues }) => ({
      fichier,
      ajoutees: retenues.length,
      retirees: perdues.length,
      net: retenues.length - perdues.length,
      exemples: retenues.slice(0, 3),
    }))
    .filter((c) => c.net > 0);
}

/** Longueur minimale d'un motif de cliquet : sous ce seuil, c'est un tampon, pas une raison. */
export const MOTIF_MIN = 20;

/**
 * Cliquets DÉCLARÉS par un message de commit : `CLIQUET: <fichier> +N — <motif>`. Le tiret peut
 * être cadratin, demi-cadratin ou trait d'union ; un motif plus court que `MOTIF_MIN` n'est pas
 * retenu (l'appelant voit alors le fichier comme non couvert).
 * @param {string} message
 * @returns {{ fichier: string, n: number, motif: string }[]}
 */
export function cliquetsDuMessage(message) {
  const out = [];
  for (const m of String(message ?? '').matchAll(/^[^\S\n]*CLIQUET\s*:\s*(\S+)\s*\+(\d+)\s*[—–-]\s*(.+)$/gm)) {
    const motif = m[3].trim();
    if (motif.length >= MOTIF_MIN) out.push({ fichier: m[1].replace(/\\/g, '/'), n: Number(m[2]), motif });
  }
  return out;
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
  const cliquets = cliquetsDuMessage(message);
  return croissanceDesStocks(diff, images)
    .map((c) => {
      const pourCeFichier = cliquets.filter((k) => k.fichier === c.fichier);
      const couvert = pourCeFichier.some((k) => k.n === c.net);
      return couvert ? null : { ...c, declare: pourCeFichier.length ? pourCeFichier[0].n : null };
    })
    .filter(Boolean);
}

/** Refus lisible d'une croissance : ce qui a grossi, de combien, trois exemples, et le geste. */
export function raisonDeRefus(croissances) {
  const lignes = croissances.map((c) => {
    const compte = `+${c.net} entrée(s) nette(s) (${c.ajoutees} ajoutée(s), ${c.retirees} retirée(s))`;
    const declare = c.declare === null ? '' : ` — le message annonce \`+${c.declare}\`, pas +${c.net}`;
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

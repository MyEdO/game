import { ast } from './dialecte.mjs';
// Mécanique de scan du garde-fou « liste de LIVRES recopiée dans le code » (#1825).
//
// INVARIANT : le code ne nomme AUCUN livre — un livre de plus, c'est de la DONNÉE
// (`src/data/books.json`), zéro ligne de code. Une CITATION n'est pas une identité : un commentaire
// qui porte une réf nue, un `source.book` en donnée, un sigle isolé dans une phrase ne DÉSIGNENT
// pas le registre. Ce qui le désigne, c'est de le LISTER.
//
// CRITÈRE DE FORME, et lui seul : une ÉNUMÉRATION LITTÉRALE dont les membres désignent AU MOINS
// DEUX LIVRES DISTINCTS du registre, par leur `abbr` ou par leur `id`. Le SEUIL DE DEUX sépare la
// liste de la citation : un site qui nomme UN livre cite ; un site qui en nomme deux recopie une
// population que le registre porte déjà, et qui s'en désynchronisera. Le compte porte sur les
// LIVRES et non sur les chaînes : les DEUX noms d'un même livre (`['aux-armes', 'AA']`, la paire
// d'une `Map` de sigles) restent UNE citation.
//
// ⚠ Ce critère n'est PAS celui du littéral ISOLÉ dont la valeur entière égale une valeur de
// registre : celui-là est RÉFUTÉ par le dépôt, mesure et faux positifs à l'appui, dans l'en-tête
// d'`ID_NAME_RX` (`registryIdBranch.mjs`) — s'y reporter plutôt que recopier ses chiffres ici.
// C'est la PLURALITÉ dans une MÊME énumération qui fait la preuve, jamais la valeur d'un littéral.
//
// ⚠ Distinct de `registryIdBranch.mjs` (BRANCHEMENT par identité, `b.abbr === '…'`, `switch`,
// `.includes`) : ici aucun branchement n'est requis — une liste inerte est déjà la faute, parce
// qu'elle FIGE une population. Les formes de BRANCHEMENT à deux valeurs (`switch` à deux `case`,
// `a === 'X' || a === 'Y'`) relèvent de CETTE garde-là, à sa condition de liaison.
//
// Module ESM pur. Le registre entre par
// INJECTION (`identitesDe`) : un banc l'éprouve sur un registre FIXTURE à sigles inventés, sans
// jamais recopier une identité réelle.
import * as tsModule from 'typescript/unstable/ast';
import { REGISTRE_LIVRES } from '../../raw/_lib.mjs'

/** Liaison LOCALE du compilateur — même raison que dans `registryIdBranch.mjs` : sous le
 *  transformeur SSR de Vitest, chaque `ts.x` d'un import est une traversée de module. */
const ts = tsModule;

/** Dossiers scannés : tout le code du jeu et tout l'outillage. Un livre peut être recopié n'importe
 *  où — le périmètre n'a aucune raison d'être plus étroit que « le code ». */
export const SCAN_DIRS = ['src', 'scripts'];

/** Extensions scannées : TypeScript du jeu ET JavaScript d'outillage. */
export const SCAN_EXTS = ['.ts', '.tsx', '.mts', '.mjs', '.js'];

/** Nombre de LIVRES distincts d'une même énumération à partir duquel elle LISTE au lieu de CITER. */
export const SEUIL = 2;

/**
 * Fichiers HORS périmètre, par FORME et non par nom d'offenseur. Le critère est « ce fichier EST le
 * registre », jamais « ce fichier est gênant » :
 *  - les GÉNÉRÉS (`*.generated.*`) : l'union d'ids y est la DÉRIVATION du registre elle-même —
 *    l'accuser reviendrait à interdire au registre d'exister en TypeScript ;
 *  - les SCHÉMAS (`src/data/schemas/**`) : la forme DÉCLARÉE d'une entrée, adossée aux unions
 *    générées ci-dessus ;
 *  - les MIGRATIONS (`*migration*`) : une migration ponctuelle nomme les entrées de l'état ancien.
 * Le reste de `src/data/**` est DANS le périmètre, tests compris : un test qui fige une population
 * de livres est exactement la recopie que cette garde cherche.
 * @param {string} rel chemin relatif à la racine, séparateurs `/` @returns {boolean}
 */
export function estExclu(rel) {
  return /\.generated\./.test(rel) || /migration/i.test(rel) || rel.startsWith('src/data/schemas/');
}

/**
 * Exemptions AU SITE (jamais au fichier), même idiome que `rawRefIntegrity.mjs#SITE_EXEMPTIONS` :
 * `{ fichier, ligne, forme, raison, date }`. Une exemption nomme la LIGNE EXACTE et la FORME — un
 * déplacement du site la périme (fail-closed), et le banc refuse toute entrée sans `raison` ni
 * `date`. Deux classes seulement l'ouvrent, et chacune se MESURE avant de s'inscrire — rien n'y
 * entre par anticipation :
 *  - la COLLISION de vocabulaire : un `id` de livre qui est aussi un nom de LIEU (une cité donne son
 *    nom à son supplément) ou un `abbr` de deux lettres qui est une clé d'objet quelconque ;
 *  - la table HISTORIQUE : une énumération qui décrit un ÉTAT PASSÉ du dépôt, que le registre
 *    d'aujourd'hui ne peut pas rendre — même nature qu'une migration, sans en porter le nom.
 * @type {{ fichier: string, ligne: number, forme: string, raison: string, date: string }[]}
 */
export const SITE_EXEMPTIONS = [
  {
    fichier: 'scripts/raw/reanchor-split.mjs',
    ligne: 21,
    forme: 'tableau-objets',
    raison: "table HISTORIQUE : les deux livres dont le fichier mono-bloc a été éclaté au commit nommé par `SPLIT_SOURCE_SHA`, avec leur chemin TEL QU'IL ÉTAIT À CE COMMIT (adresse `git show <sha>^:<path>`, pas un chemin du disque). QUELS livres ont été éclatés à ce commit est un fait d'histoire que le registre ne porte pas : rien à dériver.",
    date: '2026-09-20',
  },
]

const estExempte = (rel, site) =>
  SITE_EXEMPTIONS.some((e) => e.fichier === rel && e.ligne === site.line && e.forme === site.forme)

/**
 * Nom d'un livre → le LIVRE qu'il désigne. Les deux noms sous lesquels le dépôt désigne un livre
 * (`source.book` porte l'`id`, les rapports et les stocks portent l'`abbr`) pointent la MÊME
 * entrée — c'est ce qui permet de compter des LIVRES et non des chaînes.
 * @param {{ id?: string, abbr?: string }[]} registre @returns {Map<string, string>}
 */
export const identitesDe = (registre) => {
  const parNom = new Map();
  for (const b of registre) {
    const livre = b.id ?? b.abbr;
    if (!livre) continue;
    for (const nom of [b.id, b.abbr]) if (typeof nom === 'string' && nom.length > 0) parNom.set(nom, livre);
  }
  return parNom;
};

const IDENTITES = identitesDe(REGISTRE_LIVRES);

/** Les identités du registre RÉEL. Un banc qui a besoin d'un nom de livre vrai le PREND ici, il ne
 *  le recopie pas — la garde exigerait de lui ce qu'elle exige du code qu'elle surveille. */
export const identitesReelles = () => IDENTITES;

/** Texte d'un nœud s'il est une chaîne LITTÉRALE, sinon `null`. */
const texteLitteral = (n) =>
  n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;

/** Nom d'une propriété quand il est écrit en clair (identifiant ou chaîne), sinon `null`. */
const nomDePropriete = (p) =>
  'name' in p && p.name && (ts.isStringLiteral(p.name) || ts.isIdentifier(p.name)) ? p.name.text : null;

/**
 * Chaînes d'une ALTERNATION, écrite en littéral de regex (`/A|B/`) ou en texte destiné à en
 * construire une, la forme sous laquelle une recopie manuelle du registre se déguiserait le plus
 * naturellement. Les antislashs d'échappement sont retirés avant le découpage (`frenchy\.bzh` est
 * UNE chaîne, pas deux), puis le texte se coupe sur tout caractère qu'une identité de livre ne
 * contient pas : une identité n'est faite que de lettres ASCII, de chiffres, d'espaces, de points,
 * de tirets et de soulignés.
 */
const chainesDAlternation = (texte) => texte.replace(/\\/g, '').split(/[^A-Za-z0-9_ .-]+/);

/**
 * Sites d'un fichier où une ÉNUMÉRATION LITTÉRALE recopie le registre des livres.
 *
 * FORMES VUES (`forme` du site) :
 *  - `tableau` : tableau littéral — éléments directs, et CLÉ de chaque tuple imbriqué (`new Map([[…]])`) ;
 *  - `tableau-objets` : tableau d'objets littéraux où un MÊME champ porte l'identité d'entrée après
 *    entrée — un registre recopié entrée par entrée ;
 *  - `objet-cles` / `objet-valeurs` : objet littéral, par ses clés ou par ses valeurs littérales ;
 *  - `regex` : alternation d'un littéral de regex ;
 *  - `chaine` : chaîne littérale portant une alternation ;
 *  - `union` : union de types littéraux TypeScript ;
 *  - `enum` : `enum` dont les noms de membres ou leurs initialiseurs sont des identités.
 *
 * CE QUE LE SCAN NE VOIT PAS, écrit noir sur blanc :
 *  - une énumération CONSTRUITE (concaténation, `.push` successifs, gabarit dont les morceaux sont
 *    calculés) — elle n'est pas littérale, et aucune forme ne la distingue d'un calcul légitime ;
 *    c'est d'ailleurs la SORTIE attendue de tout site accusé ici ;
 *  - un sigle ISOLÉ, où qu'il soit : c'est une citation, par construction du seuil ;
 *  - deux livres dans DEUX énumérations voisines : chacune se juge pour elle-même ;
 *  - un BRANCHEMENT par identité (`switch`, `===`, `.includes`) : périmètre de `registryIdBranch.mjs` ;
 *  - les COMMENTAIRES (trivia) : ils ne sont jamais visités — une réf nue y fait foi (CLAUDE.md
 *    règle 6).
 *
 * @param {string} relPath chemin relatif, séparateurs `/` (décide du dialecte de parse)
 * @param {string} contenu source du fichier
 * @param {Map<string, string>} [identites] registre INJECTÉ (défaut : `src/data/books.json`)
 * @returns {{ line: number, forme: string, valeurs: string[] }[]}
 */
export function scanLivresRecopies(relPath, contenu, identites = IDENTITES, sourceFile) {
  const sf = sourceFile ?? ast({ rel: relPath, text: contenu });
  const sites = [];
  const juger = (valeurs, node, forme) => {
    const retenues = [...new Set(valeurs)].filter((v) => typeof v === 'string' && identites.has(v));
    const livres = new Set(retenues.map((v) => identites.get(v)));
    if (livres.size < SEUIL) return;
    const site = { line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, forme, valeurs: retenues };
    if (!estExempte(relPath, site)) sites.push(site);
  };
  const visit = (n) => {
    if (ts.isArrayLiteralExpression(n)) {
      const membres = [];
      /** champ → valeurs littérales qu'il porte d'un objet-élément à l'autre. @type {Map<string, string[]>} */
      const parChamp = new Map();
      for (const e of n.elements) {
        const t = texteLitteral(e);
        if (t !== null) { membres.push(t); continue }
        // CLÉ d'un tuple imbriqué : la forme d'une `Map` littérale, dont les clés figent la population.
        if (ts.isArrayLiteralExpression(e)) {
          const k = texteLitteral(e.elements[0]);
          if (k !== null) membres.push(k);
          continue
        }
        if (ts.isObjectLiteralExpression(e)) {
          for (const p of e.properties) {
            const nom = nomDePropriete(p);
            const val = ts.isPropertyAssignment(p) ? texteLitteral(p.initializer) : null;
            if (nom === null || val === null) continue;
            if (!parChamp.has(nom)) parChamp.set(nom, []);
            parChamp.get(nom).push(val);
          }
        }
      }
      juger(membres, n, 'tableau');
      for (const valeurs of parChamp.values()) juger(valeurs, n, 'tableau-objets');
    } else if (ts.isObjectLiteralExpression(n)) {
      juger(n.properties.map(nomDePropriete), n, 'objet-cles');
      juger(n.properties.map((p) => (ts.isPropertyAssignment(p) ? texteLitteral(p.initializer) : null)), n, 'objet-valeurs');
    } else if (ts.isRegularExpressionLiteral(n)) {
      juger(chainesDAlternation(n.text), n, 'regex');
    } else if (ts.isUnionTypeNode(n)) {
      juger(
        n.types.map((t) => (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal) ? t.literal.text : null)),
        n,
        'union',
      );
    } else if (ts.isEnumDeclaration(n)) {
      juger(n.members.map((m) => (('name' in m && ts.isIdentifier(m.name)) || ts.isStringLiteral(m.name) ? m.name.text : null)), n, 'enum');
      juger(n.members.map((m) => (m.initializer ? texteLitteral(m.initializer) : null)), n, 'enum');
    } else {
      const t = texteLitteral(n);
      // Une chaîne ne se juge QUE si elle porte une alternation : hors d'un `|`, un texte qui
      // contient deux noms de livre est de la PROSE (un libellé, un message), pas une population.
      if (t !== null && t.includes('|')) juger(chainesDAlternation(t), n, 'chaine');
    }
    n.forEachChild(visit);
  };
  visit(sf);
  return sites;
}

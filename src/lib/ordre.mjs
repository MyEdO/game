// Comparateurs d'ORDRE TOTAL (#1679 L3b, incident #1620) et repli des libellés — module PUR sans import :
// l'ordre d'une chaîne ne dépend ni de la locale ni de l'ICU du processus. Composé par le code de
// `src/` et par le lecteur de disque `scripts/guards/lib/lister.mjs`, qui les ré-exporte. En `.mjs` :
// `lister.mjs` est dans la clôture STATIQUE de `npm run gates`, qui ne porte aucun module TypeScript
// (`scripts/node-requis.test.mjs`, volet (b)).

/** Comparateur d'ORDRE TOTAL : unités de code UTF-16 (`<`/`>`), soit exactement l'ordre de `.sort()`
 *  sans comparateur. Jamais `localeCompare` : son verdict dépend de la locale et de l'ICU du
 *  processus — même classe de rouge que l'ordre du système de fichiers, sur des chaînes.
 *  EMPLOI : chemins, identifiants, clés — tout ce qui n'est pas lu comme du texte par un humain.
 *  @type {(a: string, b: string) => number} */
export const parUnitesDeCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** Ligatures que NFD ne décompose pas, et leur graphie décomposée (mesuré sur les libellés de
 *  `src/data/*.json` : `œ` ; `æ` par symétrie). */
const LIGATURES = { œ: 'oe', æ: 'ae' }

/** REPLI d'un libellé : marques retirées (NFD puis `\p{M}`), casse repliée, ligatures décomposées ;
 *  la ponctuation est gardée. Déterministe sans ICU — `normalize`/`toLowerCase` ne consultent aucune
 *  locale. Le composent : `norm` (`src/lib/normalize.ts`), la recherche et l'auto-liage du Codex
 *  (`src/ui/compendium/search.ts`, `relations.ts`), `src/state/dialogueLibelle.ts`,
 *  `parseSizeLabel` (`src/engine/size.ts`).
 *  @type {(s: string) => string} */
export const replier = (s) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[œæ]/g, (c) => LIGATURES[c])

/** Clé PRIMAIRE d'un libellé : `replier`, toute espace Unicode (insécable, fine) lue comme l'espace, et
 *  tout ce qui n'est ni lettre, ni chiffre, ni espace (apostrophe, guillemets, tirets, barre) lu comme un
 *  séparateur qui SUIT l'espace (`!`) — il se classe avant tout chiffre et toute lettre (« L’étreinte »
 *  avant « Le Prévôt », « 6–10 » avant « 61–65 »), après l'espace (« Lire sur les lèvres » avant
 *  « Lire/Écrire »). */
const clePrimaire = (s) => replier(s).replace(/\s/gu, ' ').replace(/[^\p{L}\p{N} ]/gu, '!')

/** Comparateur d'ORDRE TOTAL pour un LIBELLÉ LU PAR UN HUMAIN (titre de section, concept français,
 *  nom d'entité, nom d'export d'un index, libellé d'une liste à l'écran) : alphabétique sur
 *  `clePrimaire` (accents, casse, ligatures et ponctuation repliés), puis sur `replier`, puis — pour que
 *  l'ordre reste TOTAL — départage par unités de code brutes (« Béni » vs « beni »).
 *  EMPLOI : ce que quelqu'un PARCOURT de l'œil. Un chemin ou une clé prend `parUnitesDeCode` — y
 *  replier la casse rendrait deux chemins distincts égaux à la première passe.
 *  @type {(a: string, b: string) => number} */
export const parLibelle = (a, b) =>
  parUnitesDeCode(clePrimaire(a), clePrimaire(b)) || parUnitesDeCode(replier(a), replier(b)) || parUnitesDeCode(a, b)

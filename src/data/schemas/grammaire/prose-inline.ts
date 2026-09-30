/**
 * STOCK NOMINATIF DATÉ de la PROSE INLINE tolérée (#1389 Lot A, épique #1388) — le DÉNOMINATEUR de
 * la campagne d'adressage #1390, à cible ZÉRO. Une ligne = un `type` de document dont des nœuds
 * portent encore, en `desc`, de la prose recopiée d'un livre EXTRAIT, avec le COMPTE de ces nœuds.
 * Patron du dépôt : `scripts/guards/lib/structuresStock.mjs` (stock nominatif daté à comptes,
 * contrat bidirectionnel, décroissant).
 *
 * MASQUE de la mesure, mot à mot : « nœud portant un `desc` chaîne non vide dont la source EFFECTIVE
 * — son `source.book` propre, sinon le `source.book` de l'ancêtre le plus proche qui en porte un —
 * désigne un livre à `dir` dans `books.json`, `maison` ou pas, à toute profondeur », sur les deux
 * racines de documents (les `.json` de `src/data`, les `-projet.json` de `src/scenes`). La mesure vit dans
 * `scripts/guards/lib/proseInline.mjs` et s'imprime par `node scripts/source/mesurer-prose-inline.mjs` :
 * les comptes ci-dessous en SORTENT, ils ne se tapent pas.
 *
 * CE QUE LA LISTE AUTORISE : le verrou V3 de `grammaire/prose.ts` refuse au PARSE toute prose
 * recopiée d'un livre extrait ; un type de cette liste y échappe, le temps que sa famille migre.
 *
 * ANGLE MORT DÉCLARÉ : V3 ne mord qu'aux SITES qui composent la forme de prose — au Lot A,
 * l'ENVELOPPE seule, et sur le seul `source.book` PROPRE du nœud (le refine ne voit pas l'ancêtre).
 * TOUT NŒUD AUTRE que l'entrée d'enveloppe est COMPTÉ ici sans être refusable au parse, et le
 * deviendra quand SON schéma composera `proseAdressable` (Lot C) : les RANGÉES (`[].entries[]`,
 * `phenomena[]`, `boardEvents[]`…), les VARIANTES à source PROPRE (`[].variants[]`, 30 nœuds :
 * spells 18, talents 12) et les nœuds à source HÉRITÉE (43). Répartition mesurée le 2026-09-05 :
 * 2 161 nœuds d'enveloppe-racine / 464 profonds. C'est le contrat
 * `src/data/prose-inline-contrat.test.ts` qui est la garantie ; le refine est la commodité.
 *
 * COMMENT UNE LIGNE SE SOLDE — jamais en la retirant seule : par le commit qui MIGRE la famille
 * (ses `desc` deviennent des `descRef`), dans lequel la mesure ne l'observe plus et la ligne part.
 * Le contrat est BIDIRECTIONNEL : un type observé sans ligne = rouge (dérive neuve) ; une ligne dont
 * le compte ne colle plus = rouge (hausse comme baisse) ; une ligne à 0 = rouge (elle doit partir).
 * Ce stock ne fait que DÉCROÎTRE, et meurt vide : stock vide ⇒ ce fichier est supprimé et V3 devient
 * inconditionnel (DoD de #1390).
 */

/** Une ligne du stock : le compte MESURÉ, et le pilotage (lot, date, motif) qui la porte. */
export interface LigneProseInline {
  readonly entrees: number;
  readonly lot: string;
  readonly date: string;
  readonly motif: string;
}

/** Lot d'ouverture — la mesure de baseline, posée par le commit qui crée la forme et ses verrous. */
const LOT = '#1388 Lot A C2';
/** Jour de la mesure. */
const DATE = '2026-09-05';

/**
 * Baseline MESURÉE le 2026-09-05 : 2 625 nœuds sur 54 types, 16 livres extraits sur 29.
 * Le total n'est pas déclaré ici — il se recalcule (`src/data/prose-inline-contrat.test.ts`
 * l'imprime au run) : un total écrit à la main se périme au premier commit de migration.
 */
export const PROSE_INLINE_TOLEREE: Readonly<Record<string, LigneProseInline>> = {
  spells: { entrees: 456, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée (438) et de rangée (18 : `[].variants[]`), à adresser au Lot C' },
  trappings: { entrees: 279, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  talents: { entrees: 198, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée (186) et de rangée (12 : `[].variants[]`), à adresser au Lot C' },
  creatures: { entrees: 196, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  criticals: { entrees: 160, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`[].entries[]`) — refus au parse à la migration de la famille, Lot C' },
  traits: { entrees: 128, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  mutations: { entrees: 116, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  careers: { entrees: 108, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  regles: { entrees: 85, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  'arcane-phenomena': { entrees: 77, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`phenomena[]`, `phenomena[].testMods[]`) — refus au parse à la migration de la famille, Lot C' },
  'sea-events': { entrees: 63, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`boardEvents[]`, `portEvents[]`) — refus au parse à la migration de la famille, Lot C' },
  // 61 → 62 (#1612, 2026-09-06) : l'Activité Mendier entre au dataset avec sa `desc` VERBATIM du LDB
  // (règle stricte 5 — le texte doit pouvoir se recoller au Source). Elle se solde comme ses 61 sœurs,
  // par la MÊME migration vers l'adresse (`descRef`), jamais séparément.
  activities: { entrees: 62, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  qualities: { entrees: 59, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  locations: { entrees: 55, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  skills: { entrees: 48, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  gods: { entrees: 40, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  domains: { entrees: 37, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée (14) et de rangée (23 : `[].windModifiers[]`, `[].windModifiers[].cancelledBy`), à adresser au Lot C' },
  interludeEvents: { entrees: 31, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  'naval-ports': { entrees: 29, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  traumas: { entrees: 29, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  'naval-traits': { entrees: 26, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  'rencontres-edoc': { entrees: 26, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`tables.fortuites[]`, `tables.dangereuses[]`) — refus au parse à la migration de la famille, Lot C' },
  species: { entrees: 26, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  stars: { entrees: 23, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  characteristics: { entrees: 21, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée (19) et de rangée (2 : `[].options[]`), à adresser au Lot C' },
  etats: { entrees: 21, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  'land-cargo': { entrees: 20, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`rumours[]`) — refus au parse à la migration de la famille, Lot C' },
  structures: { entrees: 11, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  maladies: { entrees: 18, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  symptoms: { entrees: 18, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  'sea-navigation': { entrees: 15, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`orientation.changementDeCap[]`, `orientation.reperes[]`) — refus au parse à la migration de la famille, Lot C' },
  tavernGames: { entrees: 13, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  vehicles: { entrees: 12, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  'mass-battle': { entrees: 10, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`hazards[]`) — refus au parse à la migration de la famille, Lot C' },
  peripeties: { entrees: 10, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  classes: { entrees: 9, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  'reseau-routier': { entrees: 9, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  'sea-shanties': { entrees: 7, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  'steam-breakdown': { entrees: 6, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  astrology: { entrees: 5, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  drunkenness: { entrees: 5, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`entries[]`) — refus au parse à la migration de la famille, Lot C' },
  'naval-progression': { entrees: 5, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`entries[]`) — refus au parse à la migration de la famille, Lot C' },
  'sea-perils': { entrees: 5, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`hazards[]`, `echouer`) — refus au parse à la migration de la famille, Lot C' },
  'ship-stations': { entrees: 5, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  'crew-morale': { entrees: 4, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`bands[]`) — refus au parse à la migration de la famille, Lot C' },
  'driving-mishap': { entrees: 4, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`entries[]`) — refus au parse à la migration de la famille, Lot C' },
  'incidents-monture': { entrees: 4, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`entries[]`) — refus au parse à la migration de la famille, Lot C' },
  'problemes-vehicule': { entrees: 4, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`entries[]`) — refus au parse à la migration de la famille, Lot C' },
  weather: { entrees: 4, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`conditions[]`) — refus au parse à la migration de la famille, Lot C' },
  'sea-weather': { entrees: 3, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` de rangée (`precipitations[]`) — refus au parse à la migration de la famille, Lot C' },
  'crew-roles': { entrees: 2, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  projet: { entrees: 1, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
  'water-exposure': { entrees: 1, lot: LOT, date: DATE, motif: 'prose du livre recopiée en `desc` d’entrée, à adresser au Lot C' },
};

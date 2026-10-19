/**
 * RULE_REF — où vit la RÈGLE derrière un modificateur de jet, en ids STABLES.
 *
 * La référence est une propriété de la RÈGLE, pas du site qui pousse la `ModLine` : deux
 * producteurs de la même règle (« Main secondaire » en attaque et en Parade) consomment la MÊME
 * entrée. Module FEUILLE du moteur : aucun import (pas de couplage UI — l'affichage résout
 * `{category, id}` au Codex, cf. `ui/RollLine.tsx`).
 *
 * Stock DÉNOMBRABLE : la garde `src/engine/rule-refs.test.ts` recense les producteurs de `ModLine`
 * SANS `ref` — toute règle nouvellement liée retire une ligne du cliquet.
 */
import { gelerLaConstante } from '../lib/gelerProfond';

/** Cible Codex en ids STABLES : `category` = clé de catégorie du registre, `id` = id de l'entrée. */
export interface CodexTarget {
  category: string;
  id: string;
}

/**
 * Provenance STRUCTURÉE d'un modificateur : QUI l'octroie, en identité stable.
 *
 * `id` seul suffit — le NOM se résout au RENDU (`ui/RollLine.tsx`), jamais au producteur : un
 * résolveur passé de site en site s'oublie au premier site suivant, et l'écran affiche alors l'id
 * brut (« pregen-101 », recette B3a). `label` n'est renseigné que par une provenance qui n'a PAS
 * d'identité dans l'état (source hors combattants). `category` complète le lien Codex quand elle
 * existe : un membre du groupe n'en a aucune à ce jour (#1107).
 */
export interface ModProvenance {
  /** Nom d'AFFICHAGE — omis quand `id` suffit à le résoudre au rendu. */
  label?: string;
  category?: string;
  id?: string;
}

/** Les règles dont la référence Codex est établie. Ajouter une règle = ajouter SA clé ici. */
export type RuleId =
  | 'viser'
  | 'viser-une-localisation'
  | 'main-secondaire'
  | 'combat-deux-armes'
  | 'tirer-dans-le-tas'
  | 'tir-en-mouvement'
  | 'sur-la-defensive'
  | 'empoignade'
  /** Charge : le Mouvement qui ouvre un corps à corps (`LDB 15 l.35-37`). */
  | 'charger'
  | 'soutien'
  | 'sombre-pacte'
  | 'chance'
  | 'benediction-de-chance'
  | 'determination'
  | 'avantage'
  | 'amputation'
  | 'maladresse-tableau-des-oups'
  | 'portee-d-une-arme'
  | 'allonge-longueur-d-arme'
  | 'taille-modificateurs-en-combat'
  | 'taille-cible-au-tir'
  | 'superiorite-numerique'
  | 'attaque-de-flanc-ou-de-dos'
  | 'fuite'
  | 'cible-en-contrebas'
  | 'tir-dans-un-combat-au-corps-a-corps'
  | 'cible-dissimulee'
  | 'combat-monte'
  | 'equipe-incomplete-machine-de-guerre'
  | 'possession-pas-a-sa-taille'
  | 'tests-opposes'
  | 'rapide'
  | 'commandant-d-equipe'
  | 'exposition'
  | 'faim-et-soif'
  | 'encombrement'
  | 'combiner-les-difficultes'
  | 'navigation-derive'
  | 'navigation-greement'
  | 'navigation-chavirage'
  | 'apprentissage-particulier'
  /** Modificateur de Statut aux Tests sociaux (`LDB 08` « Charme »). */
  | 'statut'
  /** Modificateurs d'exposition aux maladies transmises par l'eau (`MSRC 16`). */
  | 'exposition-hydrique'
  /** Précipitations de la Mer des Griffes, qui modulent les Tests en mer (`MDG 13`). */
  | 'meteo-maritime'
  | 'echouer-en-mer'
  | 'navigation-echouage';

/**
 * Les règles CHIFFRÉES et les rangées que le moteur lit de leur fiche (`regles.json`, champ `rangees`) :
 * la valeur, la famille et le libellé de leur `ModLine` sont de la DONNÉE, que seul `ligneDeRegle`
 * (`src/engine/reglesChiffrees.ts`) transforme en ligne. Elles n'ont donc pas d'entrée `RULE_REF` : une
 * ligne qui l'écrirait à la main ne compile pas. #1173
 */
export const RANGEES_DE_REGLE = {
  viser: ['viser'],
  'viser-une-localisation': ['localisation'],
  'superiorite-numerique': ['deux-contre-un', 'trois-contre-un'],
  'tirer-dans-le-tas': ['petit-groupe', 'groupe-important', 'foule'],
  'sur-la-defensive': ['sur-la-defensive'],
  'attaque-de-flanc-ou-de-dos': ['flanc-ou-dos'],
  fuite: ['dos-tourne'],
  'tir-en-mouvement': ['tir-en-mouvement'],
  'tir-dans-un-combat-au-corps-a-corps': ['tir-dans-la-melee'],
  'cible-en-contrebas': ['en-contrebas'],
  'combat-monte': ['cible-plus-petite', 'cibler-le-cavalier', 'esquive-a-cheval'],
  'possession-pas-a-sa-taille': ['possession-pas-a-sa-taille'],
  empoignade: ['avantage-le-plus-faible', 'avantage-le-plus-fort'],
  'portee-d-une-arme': ['bout-portant', 'courte', 'moyenne', 'longue', 'extreme'],
  'main-secondaire': ['main-secondaire'],
  'taille-modificateurs-en-combat': ['plus-petit'],
  'allonge-longueur-d-arme': ['arme-plus-longue'],
  'equipe-incomplete-machine-de-guerre': ['equipe-incomplete'],
  avantage: ['par-point'],
} as const satisfies Partial<Record<RuleId, readonly string[]>>;

export type RegleChiffree = keyof typeof RANGEES_DE_REGLE;
export type RangeeDe<R extends RegleChiffree> = (typeof RANGEES_DE_REGLE)[R][number];

/** La fiche Codex de chaque règle NON chiffrée, en ids STABLES. Les producteurs de `ModLine` la
 *  consomment (`RULE_REF.charger`), l'affichage la résout en chip cliquable — jamais un
 *  `{category, id}` recopié au site de push. Garde d'intégrité : `src/engine/rule-refs.test.ts`. */
export const RULE_REF: Record<Exclude<RuleId, RegleChiffree>, CodexTarget> = gelerLaConstante({
  'combat-deux-armes': { category: 'regles', id: 'combat-deux-armes' },
  charger: { category: 'regles', id: 'charger' },
  soutien: { category: 'regles', id: 'soutien' },
  'sombre-pacte': { category: 'regles', id: 'sombre-pacte' },
  chance: { category: 'characteristics', id: 'chance' },
  'benediction-de-chance': { category: 'spells', id: 'benediction-de-chance' },
  determination: { category: 'characteristics', id: 'determination' },
  amputation: { category: 'regles', id: 'amputation' },
  'maladresse-tableau-des-oups': { category: 'regles', id: 'maladresse-tableau-des-oups' },
  'taille-cible-au-tir': { category: 'regles', id: 'taille-cible-au-tir' },
  'cible-dissimulee': { category: 'regles', id: 'cible-dissimulee' },
  'tests-opposes': { category: 'regles', id: 'tests-opposes' },
  rapide: { category: 'qualities', id: 'rapide' },
  'commandant-d-equipe': { category: 'talents', id: 'commandant-d-equipe' },
  exposition: { category: 'regles', id: 'exposition' },
  'faim-et-soif': { category: 'regles', id: 'faim-et-soif' },
  encombrement: { category: 'regles', id: 'encombrement' },
  'combiner-les-difficultes': { category: 'regles', id: 'combiner-les-difficultes' },
  'navigation-derive': { category: 'regles', id: 'navigation-derive' },
  'navigation-greement': { category: 'regles', id: 'navigation-greement' },
  'navigation-chavirage': { category: 'regles', id: 'navigation-chavirage' },
  'apprentissage-particulier': { category: 'activities', id: 'learn' },
  statut: { category: 'regles', id: 'statut' },
  'exposition-hydrique': { category: 'regles', id: 'exposition-hydrique' },
  'meteo-maritime': { category: 'seaWeather', id: 'seaWeather' },
  'echouer-en-mer': { category: 'seaPerils', id: 'seaPerils' },
  'navigation-echouage': { category: 'regles', id: 'navigation-echouage' },
}); // #2097

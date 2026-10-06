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
  | 'salve'
  | 'arme-d-equipe'
  | 'nuee'
  | 'parasite'
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
  | 'meteo-maritime';

/** La fiche Codex de chaque règle, en ids STABLES. Les producteurs de `ModLine` la consomment
 *  (`RULE_REF.viser`), l'affichage la résout en chip cliquable — jamais un `{category, id}` recopié
 *  au site de push. Garde d'intégrité : `src/engine/rule-refs.test.ts`. */
export const RULE_REF: Record<RuleId, CodexTarget> = gelerLaConstante({
  viser: { category: 'regles', id: 'viser' },
  'viser-une-localisation': { category: 'regles', id: 'viser-une-localisation' },
  'main-secondaire': { category: 'regles', id: 'main-secondaire' },
  'combat-deux-armes': { category: 'regles', id: 'combat-deux-armes' },
  'tirer-dans-le-tas': { category: 'regles', id: 'tirer-dans-le-tas' },
  'tir-en-mouvement': { category: 'regles', id: 'tir-en-mouvement' },
  'sur-la-defensive': { category: 'regles', id: 'sur-la-defensive' },
  empoignade: { category: 'regles', id: 'empoignade' },
  charger: { category: 'regles', id: 'charger' },
  soutien: { category: 'regles', id: 'soutien' },
  'sombre-pacte': { category: 'regles', id: 'sombre-pacte' },
  chance: { category: 'characteristics', id: 'chance' },
  'benediction-de-chance': { category: 'spells', id: 'benediction-de-chance' },
  determination: { category: 'characteristics', id: 'determination' },
  avantage: { category: 'regles', id: 'avantage' },
  amputation: { category: 'regles', id: 'amputation' },
  'maladresse-tableau-des-oups': { category: 'regles', id: 'maladresse-tableau-des-oups' },
  'portee-d-une-arme': { category: 'regles', id: 'portee-d-une-arme' },
  'allonge-longueur-d-arme': { category: 'regles', id: 'allonge-longueur-d-arme' },
  'taille-modificateurs-en-combat': { category: 'regles', id: 'taille-modificateurs-en-combat' },
  'taille-cible-au-tir': { category: 'regles', id: 'taille-cible-au-tir' },
  'superiorite-numerique': { category: 'regles', id: 'superiorite-numerique' },
  'attaque-de-flanc-ou-de-dos': { category: 'regles', id: 'attaque-de-flanc-ou-de-dos' },
  fuite: { category: 'regles', id: 'fuite' },
  'cible-en-contrebas': { category: 'regles', id: 'cible-en-contrebas' },
  'tir-dans-un-combat-au-corps-a-corps': { category: 'regles', id: 'tir-dans-un-combat-au-corps-a-corps' },
  'cible-dissimulee': { category: 'regles', id: 'cible-dissimulee' },
  'combat-monte': { category: 'regles', id: 'combat-monte' },
  'equipe-incomplete-machine-de-guerre': { category: 'regles', id: 'equipe-incomplete-machine-de-guerre' },
  'possession-pas-a-sa-taille': { category: 'regles', id: 'possession-pas-a-sa-taille' },
  salve: { category: 'qualities', id: 'salve' },
  'arme-d-equipe': { category: 'qualities', id: 'arme-d-equipe' },
  nuee: { category: 'traits', id: 'nuee' },
  parasite: { category: 'traits', id: 'parasite' },
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
}); // #2097

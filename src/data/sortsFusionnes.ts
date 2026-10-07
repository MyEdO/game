import type { Fige } from '../state/scene';

/**
 * Ids de sort FUSIONNÉS par le lot #1897 : une entrée du livre fan `frenchy-bzh` qui doublait un sort déjà
 * au catalogue n'existe plus, son id désigne l'entrée qui l'a absorbée (doctrine « une entité, N livres » :
 * `.claude/memory/game-doctrine-une-entite-n-livres-n-variantes.md`).
 *
 * TABLE GELÉE (`Fige`, `src/state/scene.ts`) : ce que rejoue la migration de donnée
 * (`scripts/migrations/2026-09-23-1897-sorts-fan-par-le-pont.mjs`), jamais une correspondance du jour :
 * un lot de fusion ULTÉRIEUR n'étend donc pas cette table, il pose la SIENNE.
 *
 * Chargé tel quel par Node nu (`scripts/migrations/2026-09-23-1897-sorts-fan-par-le-pont.mjs`) : le seul
 * import est `import type`, et `as const satisfies` n'est qu'une annotation — l'effacement des types de
 * Node les retire sans rien exécuter.
 */
export const SORTS_FUSIONNES_1897 = {
  'alarme': 'alerte',
  'ame-devoilee': 'percevoir-l-echeveau',
  'apaisement': 'baume-pour-un-esprit-blesse',
  'appel-de-vanhel': 'l-appel-de-vanhel',
  'arriere-sorciere': 'n-ecoutez-point-la-sorciere',
  'belier': 'poussee',
  'bienveillance': 'bonne-volonte',
  'bouclier': 'bouclier-anti-fleches',
  'bruit': 'bruits',
  'chaleur-de-la-fourrure': 'peau-de-loup-d-hiver',
  'chuchotis': 'murmures',
  'conserve': 'conservation',
  'courant-d-air': 'coup-de-vent',
  'eau-pure': 'purification-de-l-eau',
  'entrave': 'enchevetrement',
  'espionnage': 'tendre-l-oreille',
  'esprit-enfievre': 'feu-spirituel',
  'explosion-de-dhar': 'explosion-de-corruption',
  'fatigue': 'drain',
  'fers-de': 'entraves-a-la-verite',
  'feu-follet': 'feux-follets',
  'flamme': 'flamme-magique',
  'flammes-bleues-de-tzeentch': 'feu-bleu-de-tzeentch',
  'flammes-roses-de-tzeentch': 'feu-rose-de-tzeentch',
  'instinct-animal': 'instincts-animaux',
  'introspection': 'consentement',
  'justice': 'benediction-de-droiture',
  'la-verite-finit-toujours-par-sortir': 'la-verite-eclatera',
  'langue-des-pestigors': 'langue-des-gors',
  'langue-des-slaangors': 'langue-des-gors',
  'langue-des-tzaangors': 'langue-des-gors',
  'main-de-rhya': 'caresse-de-rhya',
  'marteau-de-justice': 'marteau-ardent-de-sigmar',
  'modele-de-vertu': 'flambeau-de-vertu',
  'morsure-d-hiver': 'morsure-de-l-hiver',
  'nuee': 'menace-rampante',
  'oeil-de-lynx': 'yeux-de-chat',
  'pied-leger': 'pas-leger',
  'position': 'reperes',
  'pourriture': 'putrefaction',
  'projectile': 'carreau',
  'projectile-de-dhar': 'decharge-de-corruption',
  'projectile-mineur': 'flechette',
  'rapidite': 'benediction-de-vivacite',
  'resistance-du-penitent': 'endurance-de-l-anachorete',
  'robustesse': 'benediction-de-vigueur',
  'ruine': 'degradation',
  'saccade': 'secousse',
  'sagesse-du-hibou': 'sagesse-de-la-chouette',
  'saut-de-cabri': 'bondissant-comme-un-cerf',
  'soins': 'benediction-de-guerison',
  'sus-a-l-ennemi': 'vaincre-les-impies',
  'telekinesie': 'deplacement-d-objet',
  'verena-m-est-temoin': 'verena-est-mon-temoin',
} as const satisfies Fige<Readonly<Record<string, string>>>;

/** La table en `Map` : une clé héritée d'`Object.prototype` (`constructor`) n'y est pas une entrée. */
const CORRESPONDANCE: ReadonlyMap<string, string> = new Map(Object.entries(SORTS_FUSIONNES_1897));

/** L'id qui désigne le sort `id` après ce lot : l'entrée absorbante d'un id fusionné, sinon `id`. */
export const idDeSortVivant = (id: string): string => CORRESPONDANCE.get(id) ?? id;

/** Une liste d'ids de sort après ce lot : chaque id par `idDeSortVivant`, dédoublonnée, ordre gardé
 *  (deux fusionnés vers le même sort n'en font qu'un). */
export const listeDeSortsVivants = (ids: readonly string[]): string[] => [...new Set(ids.map(idDeSortVivant))];

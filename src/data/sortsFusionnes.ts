import type { Fige } from '../state/scene';

/**
 * Ids de sort FUSIONNÉS par le lot #1897 : une entrée du livre fan `frenchy-bzh` qui doublait un sort déjà
 * au catalogue n'existe plus, son id désigne l'entrée qui l'a absorbée (doctrine « une entité, N livres » :
 * `.claude/memory/game-doctrine-une-entite-n-livres-n-variantes.md`).
 *
 * TABLE GELÉE (`Fige`, `src/state/scene.ts`) : ce que rejouent la migration de donnée
 * (`scripts/migrations/2026-09-23-1897-sorts-fan-par-le-pont.mjs`) et les migrations de chargement des
 * documents PORTABLES de ce lot (`ROSTER_MIGRATIONS[4]`, `src/state/roster.ts`), jamais une correspondance
 * du jour. Un document déjà monté au format d'après ce lot ne repasse plus par elle : un lot de fusion
 * ULTÉRIEUR n'étend donc pas cette table, il pose la SIENNE.
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

/** Clés dont la valeur est une LISTE d'ids de sort : `spells` (profil de créature, statbloc, combat de
 *  scène, héros), `spellIds` (portée d'un modificateur de NI), `componentSpells` (`Combatant`). */
const LISTES_DE_SORTS = new Set(['spells', 'spellIds', 'componentSpells']);
/** Clés dont la valeur, quand c'est une CHAÎNE, est un id de sort : `spell` (`learnSpell`,
 *  `Combatant.focus`), `spellId` (`castSpell`, `dispel`, `ritual`, `summon`, `ActiveEffect.spell`),
 *  `sourceSpellId` (`ActiveEffect`). */
const SCALAIRES_DE_SORT = new Set(['spell', 'spellId', 'sourceSpellId']);
/** Clé d'une case de console (`EntreeBarre.cle`, `src/engine/types.ts`) : un id de sort derrière ce
 *  préfixe (`src/ui/CombatConsole.tsx`). */
const CLE_DE_CASE = 'cle';
const PREFIXE_DE_CASE_DE_SORT = 'sort-';

const estListeDeChaines = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** La valeur `v` de la clé `k`, réécrite si c'est une place d'id de sort ; `undefined` sinon. */
function placeDeSort(k: string, v: unknown): unknown {
  if (LISTES_DE_SORTS.has(k) && estListeDeChaines(v)) return listeDeSortsVivants(v);
  if (SCALAIRES_DE_SORT.has(k) && typeof v === 'string') return idDeSortVivant(v);
  if (k === CLE_DE_CASE && typeof v === 'string' && v.startsWith(PREFIXE_DE_CASE_DE_SORT)) {
    return PREFIXE_DE_CASE_DE_SORT + idDeSortVivant(v.slice(PREFIXE_DE_CASE_DE_SORT.length));
  }
  return undefined;
}

/**
 * Réécrit récursivement tout id FUSIONNÉ d'un document persisté (héros, projet) vers l'id qui l'a
 * absorbé, aux seules places de référence de sort, reconnues par leur FORME : une liste de chaînes sous
 * `LISTES_DE_SORTS` (`listeDeSortsVivants`), une chaîne sous `SCALAIRES_DE_SORT`, la clé d'une case de
 * console au préfixe de sort. Toute autre chaîne
 * traverse INTACTE (`belier` reste une qualité). IDEMPOTENT : un id vivant n'est jamais une clé de
 * `SORTS_FUSIONNES_1897`.
 */
export function remapSortsFusionnesDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(remapSortsFusionnesDeep);
  if (!node || typeof node !== 'object') return node;
  return Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([k, v]) => {
    const reecrite = placeDeSort(k, v);
    return [k, reecrite === undefined ? remapSortsFusionnesDeep(v) : reecrite];
  }));
}

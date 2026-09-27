/**
 * SOURCES DE SPÉCIALISATIONS (#1897, #1463) — la DÉCLARATION UNIQUE de chaque `specsSource` : l'UNIVERS
 * qu'elle admet (validité d'une `spec`) et le POOL qu'elle propose (choix joueur, ⊆ univers), chacun
 * une CLÉ D'ESPACE (`grammaire/cle-d-espace.ts`), dont les filtres sont les paramètres `espace` des defs
 * qui portent la donnée. Lecteurs : `IDS_PAR_ESPACE` (`_ids.generated.ts`, `scripts/gen-espaces.mts`),
 * `SPEC_SOURCES` (`src/data/index.ts`), `specsVivantesDe` (`grammaire/idsVivants.ts`).
 *
 * FEUILLE : aucun import d'exécution.
 */
import type { SpecsSource } from '../../index.ts';
import type { FichierDe } from './cle-d-espace.ts';

export interface SourceDeSpecs {
  /** Espace des ids ADMIS comme spécialisation. */
  readonly univers: string;
  /** Espace des ids PROPOSÉS à un choix joueur (absent = l'univers). */
  readonly pool?: string;
}

/** Corps à corps : `LDB 09 l.160` ; Projectiles : `LDB 09 l.428` ; Focalisation : `LDB 09 l.252`. */
export const SOURCES_DE_SPECS = {
  weaponGroupsMelee: { univers: 'weaponGroups.json?combat=melee' },
  weaponGroupsRanged: { univers: 'weaponGroups.json?combat=ranged' },
  winds: { univers: 'domains.json', pool: 'domains.json?wind' },
  arcaneDomains: { univers: 'domains.json', pool: 'domains.json?arcane' },
  cultBlessings: { univers: 'gods.json', pool: 'gods.json?blessings' },
  cultMiracles: { univers: 'gods.json', pool: 'gods.json?miracles' },
  cultChaos: { univers: 'gods.json', pool: 'gods.json?chaosSpells' },
  seaShanties: { univers: 'sea-shanties.json' },
  groups: { univers: 'groups.json' },
  diseases: { univers: 'maladies.json' },
  sizes: { univers: 'sizes.json#rangedMod' },
  mutations: { univers: 'mutations.json' },
  breathTypes: { univers: 'breath-types.json' },
  damageTypes: { univers: 'damage-types.json' },
  weaponsMelee: { univers: 'trappings.json?categorie=melee' },
  weaponsRanged: { univers: 'trappings.json?categorie=ranged' },
} as const satisfies Record<SpecsSource, SourceDeSpecs>;

/** Fichiers lus par les sources — la clé par laquelle un lecteur fournit leur racine. */
export type DatasetDeSource = FichierDe<(typeof SOURCES_DE_SPECS)[SpecsSource]['univers']>;

/**
 * SOURCES DE SPÉCIALISATIONS (#1897, #1463) — la DÉCLARATION UNIQUE de chaque `specsSource` : l'UNIVERS
 * qu'elle admet (validité d'une `spec`), le POOL qu'elle propose (choix joueur, ⊆ univers), chacun
 * une CLÉ D'ESPACE (`grammaire/cle-d-espace.ts`), dont les filtres sont les paramètres `espace` des defs
 * qui portent la donnée, et le LIBELLÉ d'un de ses ids. Lecteurs : `IDS_PAR_ESPACE` (`_ids.generated.ts`,
 * `scripts/gen-espaces.mts`), `SPEC_SOURCES` (`src/data/index.ts`), `lectureDeLEspace`
 * (`grammaire/collection-cle.ts`).
 *
 * FEUILLE : aucun import d'exécution.
 */
import type { SpecsSource } from '../../index.ts';
import type { NomDeVocabulaire } from './vocabulaires.ts';

/** D'où vient le LIBELLÉ d'un id de la source : les `champs` de son élément dans l'univers (le premier
 *  non vide), ou la table d'un VOCABULAIRE du moteur (`grammaire/vocabulaires.ts`). */
export type LibelleDeSource = { readonly champs: readonly string[] } | { readonly vocabulaire: NomDeVocabulaire };

export interface SourceDeSpecs {
  /** Espace des ids ADMIS comme spécialisation. */
  readonly univers: string;
  /** Espace des ids PROPOSÉS à un choix joueur (absent = l'univers). */
  readonly pool?: string;
  readonly libelle: LibelleDeSource;
}

/** Le libellé d'un élément de collection lu à son champ `label` : celui d'une source qui le déclare, d'une
 *  entrée `specs[]` inline (`specEntryLabel`, `src/data/index.ts`) et d'une clé de libellés sans champs
 *  (`lectureDeLEspace`, `grammaire/collection-cle.ts`). */
export const LIBELLE_AU_LABEL = { champs: ['label'] } as const satisfies LibelleDeSource;

/** Corps à corps : `LDB 09 l.160` ; Projectiles : `LDB 09 l.428` ; Focalisation : `LDB 09 l.252` ;
 *  Corruption : `LDB 85 l.85`, `LDB 19 l.33-56` ; Venin : `LDB 85 l.423`, `LDB 12 l.143-151` ;
 *  Cibles psy : `LDB 21 l.19`, `l.75`. */
export const SOURCES_DE_SPECS = {
  weaponGroupsMelee: { univers: 'weaponGroups.json?combat=melee', libelle: LIBELLE_AU_LABEL },
  weaponGroupsRanged: { univers: 'weaponGroups.json?combat=ranged', libelle: LIBELLE_AU_LABEL },
  winds: { univers: 'domains.json', pool: 'domains.json?wind', libelle: { champs: ['wind', 'label'] } },
  arcaneDomains: { univers: 'domains.json', pool: 'domains.json?arcane', libelle: LIBELLE_AU_LABEL },
  cultBlessings: { univers: 'gods.json', pool: 'gods.json?blessings', libelle: LIBELLE_AU_LABEL },
  cultMiracles: { univers: 'gods.json', pool: 'gods.json?miracles', libelle: LIBELLE_AU_LABEL },
  cultChaos: { univers: 'gods.json', pool: 'gods.json?chaosSpells', libelle: LIBELLE_AU_LABEL },
  seaShanties: { univers: 'sea-shanties.json', libelle: LIBELLE_AU_LABEL },
  ciblesPsy: { univers: 'groups.json', libelle: LIBELLE_AU_LABEL },
  diseases: { univers: 'maladies.json', libelle: LIBELLE_AU_LABEL },
  sizes: { univers: 'sizes.json#rangedMod', libelle: { vocabulaire: 'tailles' } },
  mutations: { univers: 'mutations.json', libelle: LIBELLE_AU_LABEL },
  breathTypes: { univers: 'breath-types.json', libelle: LIBELLE_AU_LABEL },
  damageTypes: { univers: 'damage-types.json', libelle: LIBELLE_AU_LABEL },
  weaponsMelee: { univers: 'trappings.json?categorie=melee', libelle: LIBELLE_AU_LABEL },
  weaponsRanged: { univers: 'trappings.json?categorie=ranged', libelle: LIBELLE_AU_LABEL },
  exposureLevels: { univers: 'vocabulaire:expositions', libelle: { vocabulaire: 'expositions' } },
  difficulties: { univers: 'vocabulaire:difficultes', libelle: { vocabulaire: 'difficultes' } },
} as const satisfies Record<SpecsSource, SourceDeSpecs>;

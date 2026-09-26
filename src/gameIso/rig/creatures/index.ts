/**
 * Registre des créatures — SOURCE UNIQUE dérivée des fichiers `defs/<Nom>.ts` (auto-collectés
 * par le générateur). Tout le routage par nom (plan, espèce quad/ailée) et les tables de props
 * en découlent : plus aucun tableau central à re-maintenir.
 */
import type { QuadProps } from '../quadruped/quadSkeleton';
import type { SerpentProps } from '../serpentine/composeSerpent';
import type { SpiderProps } from '../arachnid/composeSpider';
import type { BirdProps } from '../avian/composeBird';
import type { OctopusProps } from '../cephalopod/composeOctopus';
import type { SpectreProps } from '../spectral/composeSpectre';
import type { SquigProps } from '../squig/composeSquig';
import type { HulkProps } from '../amorphous/composeHulk';
import type { JabberProps } from '../jabberslythe/composeJabber';
import type { CrabProps } from '../crustace/composeCrab';
import type { FishProps } from '../fish/composeFish';
import type { TheropodProps } from '../theropode/composeTheropod';
import type { CreatureDef } from './types';
import { CREATURES } from './_registry.generated';
import { raceById } from '../races';
import { baseSpeciesOf } from '../skeletons';

export { CREATURES };
export type { CreatureDef, CreatureBodyPlan, CreaturePerso } from './types';

const QUAD = CREATURES.filter((c) => c.plan === 'quadruped');
const WING = CREATURES.filter((c) => c.plan === 'winged');
const BIPED = CREATURES.filter((c) => c.plan === 'biped');

/** id d'espèce STABLE d'une def — `id` explicite et OBLIGATOIRE (jamais dérivé du libellé : le label
 *  est de l'affichage multilangue, cf. #637). Unicité garantie par un test au build (`creatures.unique.test.ts`). */
export const defId = (c: CreatureDef): string => c.id;

/** Def bipède par id d'espèce — dérivée des fichiers defs. Les défauts d'apparence (tenue/monster/sex/
 *  parts/colors) vivent sur la Race (cf. `raceById`) ; les surcharges d'une créature non-canonique sur `def.perso`. */
const BIPED_BY_ID: Record<string, CreatureDef> = Object.fromEntries(BIPED.map((c) => [defId(c), c]));
/** Def bipède canonique par id (lookup direct), ou undefined. */
export function bipedDef(id: string): CreatureDef | undefined { return BIPED_BY_ID[id]; }

/** Def par id d'espèce CANONIQUE (lookup EXACT, tous plans) — résolution data-driven : une entité porte
 *  son `appearance.species` (un id) → on lit sa def sans match flou. */
const DEF_BY_ID: Record<string, CreatureDef> = Object.fromEntries(CREATURES.map((c) => [defId(c), c]));
export function defById(id: string): CreatureDef | undefined { return DEF_BY_ID[id]; }
/** Options du sélecteur d'espèce (affiche le libellé, stocke l'id). */
export function creatureSpeciesOptions(): { id: string; label: string }[] { return CREATURES.map((c) => ({ id: defId(c), label: c.label })); }
/** Échelle de token d'une espèce canonique (par id) — bipède via race, non-bipède via props. */
export function speciesScale(id: string): number {
  const d = DEF_BY_ID[id];
  if (!d) return 1;
  if (d.plan === 'biped') return d.perso?.scale ?? raceById(d.race ?? baseSpeciesOf(id)).scale ?? 1;
  return (d.quad ?? d.serpent ?? d.spider ?? d.bird ?? d.octopus ?? d.spectre ?? d.squig ?? d.hulk ?? d.jabber ?? d.crab ?? d.fish ?? d.thero)?.sl ?? 1;
}

/** Tables de props de rendu par id d'espèce — dérivées des fichiers defs. */
export const QUAD_SPECIES: Record<string, QuadProps> = Object.fromEntries(QUAD.map((c) => [defId(c), c.quad!]));
export const WINGED_SPECIES: Record<string, QuadProps> = Object.fromEntries(WING.map((c) => [defId(c), c.quad!]));

/** Ids d'espèce (clés de table) des gabarits quad/ailé/bipède. */
export const quadSpeciesNames = (): string[] => QUAD.map((c) => defId(c));
export const wingedSpeciesNames = (): string[] => WING.map((c) => defId(c));
export const bipedSpeciesNames = (): string[] => BIPED.map((c) => defId(c));

/** Ids d'espèce des gabarits SANS table de props (art statique par vue) : engin de siège, navire,
 *  véhicule terrestre — MÊME dérivation du registre que quad/ailé/bipède. */
const ENGIN = CREATURES.filter((c) => c.plan === 'engin');
const NAVIRE = CREATURES.filter((c) => c.plan === 'navire');
const TERRESTRE = CREATURES.filter((c) => c.plan === 'terrestre');
export const enginSpeciesNames = (): string[] => ENGIN.map((c) => defId(c));
export const navireSpeciesNames = (): string[] => NAVIRE.map((c) => defId(c));
export const terrestreSpeciesNames = (): string[] => TERRESTRE.map((c) => defId(c));

// --- Nouveaux squelettes (serpentin/arachnide/aviaire/céphalopode) : tables de props par id d'espèce,
//     dérivées des defs comme quad/winged. Chaque plan lit son propre champ de props.
export const SERPENT_SPECIES: Record<string, SerpentProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'serpentine').map((c) => [defId(c), c.serpent!]));
export const SPIDER_SPECIES: Record<string, SpiderProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'arachnid').map((c) => [defId(c), c.spider!]));
export const BIRD_SPECIES: Record<string, BirdProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'avian').map((c) => [defId(c), c.bird!]));
export const OCTOPUS_SPECIES: Record<string, OctopusProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'cephalopod').map((c) => [defId(c), c.octopus!]));
export const SPECTRE_SPECIES: Record<string, SpectreProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'spectral').map((c) => [defId(c), c.spectre!]));
export const SQUIG_SPECIES: Record<string, SquigProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'squig').map((c) => [defId(c), c.squig!]));
export const HULK_SPECIES: Record<string, HulkProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'amorphous').map((c) => [defId(c), c.hulk!]));
export const JABBER_SPECIES: Record<string, JabberProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'jabberslythe').map((c) => [defId(c), c.jabber!]));
export const CRAB_SPECIES: Record<string, CrabProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'crustace').map((c) => [defId(c), c.crab!]));
export const FISH_SPECIES: Record<string, FishProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'fish').map((c) => [defId(c), c.fish!]));
export const THEROPOD_SPECIES: Record<string, TheropodProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'theropode').map((c) => [defId(c), c.thero!]));

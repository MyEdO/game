/**
 * Groupes d'appartenance d'un combattant (WFRP4, support des Traits psy ciblés — LDB 21).
 * Un combattant possède plusieurs IDS de Groupe STABLES (jamais traduits, cf. `src/data/groups.json`).
 * DEUX parts : les Groupes DÉCLARÉS, posés une fois sur `Combatant.groups` (espèce, entrée du bestiaire et
 * son genre, statbloc, extras d'éditeur) et les Groupes que l'état VIVANT du porteur confère (Traits portés,
 * carrière et classe, culte du Talent de Prière, mutations), lus en direct par `groupesDe`, SEUL accesseur
 * des Groupes effectifs. Les Cibles des traits psy (Animosité (Elfes), Haine (Skavens)…) sont
 * normalisées en id de Groupe (cf. `psych/registry.ts`) et mises en correspondance avec ces ids. Pur.
 * Cf. spec : docs/superpowers/specs/2026-06-07-psychologie-design.md (§3).
 */
import { norm } from '../lib/normalize';
import type { TraitInstance } from './statEntry';
import { findCareerById, findClassById, findCreatureById, findGodById, findGroupById, findSpeciesById, findTalentById, findTraitById, type CreatureData } from '../data';

/** Groupe de tout porteur d'une mutation (`groups.json`). EDOC 12 l.56, l.181. */
const GROUPE_DES_MUTANTS = 'mutants';

/** Groupes DÉCLARÉS, posés une fois sur `Combatant.groups` : espèce (`SpeciesData.grantGroups`) ∪ entrée du
 *  bestiaire (`CreatureData.grantGroups`, sa catégorie, puis ceux de son `genre`, de genre en genre) ∪ extras
 *  (déjà des ids — `groups` d'un statbloc, saisie d'éditeur). Dédupliqué par id EXACT, ordre stable. */
export function groupsFor(src: { speciesId?: string; creature?: Pick<CreatureData, 'grantGroups' | 'genre'>; extras?: readonly string[] }): string[] {
  const out: string[] = [];
  const pushAll = (gs?: readonly string[]) => {
    for (const g of gs ?? []) if (!out.includes(g)) out.push(g);
  };
  pushAll(findSpeciesById(src.speciesId)?.grantGroups);
  const genres = new Set<string>();
  for (let e = src.creature; e; e = e.genre && !genres.has(e.genre.id) ? (genres.add(e.genre.id), findCreatureById(e.genre.id)) : undefined) pushAll(e.grantGroups);
  pushAll(src.extras);
  return out;
}

/** Ce que `groupesDe` lit d'un porteur : ses Groupes déclarés, ses Traits par leur désignation, sa carrière,
 *  la VUE de ses Talents (`talentId` + `spec` suffisent au culte) et ses mutations. */
export interface PorteurDeGroupes {
  groups?: readonly string[];
  traits?: readonly Pick<TraitInstance, 'id' | 'hidden'>[];
  career?: string;
  talents?: readonly { talentId: string; spec?: string }[];
  mutations?: readonly unknown[];
}

/** Groupes EFFECTIFS d'un porteur, lus en direct : Groupes DÉCLARÉS (`Combatant.groups`) ∪ Traits portés,
 *  octroyés compris (`TraitData.capabilities.grantGroups`) ∪ carrière et classe (`grantGroups`) ∪ culte du
 *  Talent de Prière (`GodData.grantGroups`, via `TalentData.grantSpecGroups`) ∪ Mutants pour le porteur d'au
 *  moins une mutation. Dédupliqué par id EXACT, ordre stable. */
export function groupesDe(c: PorteurDeGroupes): string[] {
  const out: string[] = [];
  const pushAll = (gs?: readonly string[]) => {
    for (const g of gs ?? []) if (!out.includes(g)) out.push(g);
  };
  pushAll(c.groups);
  for (const t of c.traits ?? []) pushAll(findTraitById(t.id)?.capabilities?.grantGroups);
  if (c.career) {
    const career = findCareerById(c.career);
    pushAll(career?.grantGroups);
    pushAll(findClassById(career?.class)?.grantGroups);
  }
  for (const t of c.talents ?? []) {
    if (!t.spec || !findTalentById(t.talentId)?.grantSpecGroups) continue;
    pushAll(findGodById(norm(t.spec))?.grantGroups);
  }
  if (c.mutations?.length) pushAll([GROUPE_DES_MUTANTS]);
  return out;
}

/** Vue PERÇUE des Groupes d'un porteur, celle que lit l'observateur : ses Groupes effectifs moins ceux de ses
 *  Traits dissimulés (`hiddenGroupsOf`). `groupesPercus ⊆ groupesDe`. */
export function groupesPercus(c: PorteurDeGroupes): string[] {
  const caches = hiddenGroupsOf(c);
  return groupesDe(c).filter((g) => !caches.includes(g));
}

/** Ids de Groupe accordés par `capabilities.grantGroups` d'un Trait porté DISSIMULÉ (`TraitInstance.hidden`,
 *  arbitrage `maison` MDG 07 l.250), lus en direct sur `c.traits` : `groupesPercus` les retire des Groupes
 *  effectifs. */
export function hiddenGroupsOf(c: Pick<PorteurDeGroupes, 'traits'>): string[] {
  const out: string[] = [];
  for (const t of c.traits ?? []) {
    if (!t.hidden) continue;
    for (const g of findTraitById(t.id)?.capabilities?.grantGroups ?? []) if (!out.includes(g)) out.push(g);
  }
  return out;
}

/** La Cible d'un Trait psy (déjà un id de Groupe, cf. `psych/registry.ts`) correspond-elle à l'un des
 *  `groups` (ids) du combattant ? Appartenance STRICTE par id — plus de tolérance de pluriel/casse. Un
 *  sous-type sans Groupe dédié dans `groups.json` (ex. « Menteurs, trompeurs, sophistes ») reste INERTE
 *  plutôt que de dériver un sous-groupe inventé (YAGNI). Un Groupe-cible JOKER (`GroupData.matchesAll`,
 *  `groups.json` : `tout` = n'importe qui — Animosité « toutes les créatures !!! » ; `vivant` =
 *  `matchesAll` moins ses `exceptGroups`) est résolu ICI, sur la donnée du Groupe visé. */
export function groupMatch(cibleId: string, groupIds: readonly string[]): boolean {
  const cible = findGroupById(cibleId);
  if (cible?.matchesAll) return !(cible.exceptGroups ?? []).some((g) => groupIds.includes(g));
  return groupIds.includes(cibleId);
}

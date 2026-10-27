/**
 * Groupes d'appartenance d'un combattant (WFRP4, support des Traits psy ciblés — LDB 21).
 * Un combattant possède plusieurs IDS de Groupe STABLES (jamais traduits, cf. `src/data/groups.json`),
 * DÉCLARÉS par les entrées de donnée qu'il porte (espèce, carrière, classe, culte du Talent de Prière,
 * créature du bestiaire) + extras manuels (éditeur : déjà des ids). Les Cibles des traits psy
 * (Animosité (Elfes), Haine (Skavens)…) sont normalisées en id de Groupe (cf. `psych/registry.ts`)
 * et mises en correspondance avec ces ids. Pur.
 * Cf. spec : docs/superpowers/specs/2026-06-07-psychologie-design.md (§3).
 */
import { norm } from '../lib/normalize';
import type { TraitInstance, TraitsDesignes } from './statEntry';
import { findCareerById, findClassById, findGodById, findGroupById, findSpeciesById, findTalentById, findTraitById } from '../data';

/** Ids de Groupe d'appartenance d'un combattant : espèce (`SpeciesData.grantGroups`) ∪ trait(s)
 *  (`TraitData.capabilities.grantGroups`) ∪ carrière et classe (`grantGroups`) ∪ culte du Talent de
 *  Prière (`GodData.grantGroups`, via `TalentData.grantSpecGroups`) ∪ extras manuels (déjà des ids —
 *  dont `CreatureData.grantGroups`, qui porte la catégorie de la créature). Dédupliqué par id EXACT,
 *  ordre stable. */
export function groupsFor(src: {
  speciesId?: string;
  careerId?: string;
  traits?: TraitsDesignes;
  /** VUE d'un Talent porté : `talentId` + `spec` suffisent au culte. `TalentInstance` porte en plus
   *  `times` (requis), que les porteurs dérivés d'un statbloc ne construisent pas. */
  talents?: { talentId: string; spec?: string }[];
  extras?: string[];
}): string[] {
  const out: string[] = [];
  const push = (g?: string | null) => {
    if (g && !out.includes(g)) out.push(g);
  };
  const pushAll = (gs?: string[]) => {
    for (const g of gs ?? []) push(g);
  };
  pushAll(findSpeciesById(src.speciesId)?.grantGroups);
  for (const t of src.traits ?? []) pushAll(findTraitById(t.id)?.capabilities?.grantGroups);
  if (src.careerId) {
    const career = findCareerById(src.careerId);
    pushAll(career?.grantGroups);
    pushAll(findClassById(career?.class)?.grantGroups);
  }
  for (const t of src.talents ?? []) {
    if (!t.spec || !findTalentById(t.talentId)?.grantSpecGroups) continue;
    pushAll(findGodById(norm(t.spec))?.grantGroups);
  }
  (src.extras ?? []).forEach(push);
  return out;
}

/** Ids de Groupe accordés par `capabilities.grantGroups` d'un Trait porté DISSIMULÉ (`TraitInstance.hidden`,
 *  arbitrage `maison` MDG 07 l.250) — lus EN DIRECT sur `c.traits` (pas le `c.groups` figé au spawn, qui ne
 *  recalcule pas si le porteur cache/révèle sa marque). Consommé par `targetedTrigger` pour retirer ces ids
 *  du Groupe effectivement EXPOSÉ à la Cible d'un Trait psy réciproque. */
export function hiddenGroupsOf(c: { traits?: TraitInstance[] }): string[] {
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
export function groupMatch(cibleId: string, groupIds: string[]): boolean {
  const cible = findGroupById(cibleId);
  if (cible?.matchesAll) return !(cible.exceptGroups ?? []).some((g) => groupIds.includes(g));
  return groupIds.includes(cibleId);
}

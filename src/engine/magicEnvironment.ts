/**
 * Magie ENVIRONNEMENTALE (`VDM 14`, folios 189-207) — POINT DE LECTURE UNIQUE des modificateurs de
 * Test apportés par l'état magique du LIEU : palier de Saturation environnementale et phénomènes
 * arcaniques présents (ligne de force, pierre gardienne, nexus, appui arcanique, Tempête, Corruption).
 *
 * Tout est en DONNÉE (`arcane-phenomena.json`) : aucun phénomène n'est nommé ici, et l'ajout d'un
 * phénomène ne coûte pas une ligne de moteur. Gaté par la règle optionnelle
 * `magic-vdm-environnementale` (`policy.ts`, groupe Magie) — désactivée, `environmentTestDR` rend 0
 * et le comportement du moteur est strictement celui du Livre de base.
 *
 * Consommateurs : `resolveCasting` / `castLandProbability` / `resolveFocus` (`engine/magic.ts`).
 * Le CONTEXTE (`MagicEnvironment`) est fourni par l'appelant, comme `WindContext` : le moteur pur ne
 * connaît ni la scène ni le calendrier.
 */
import type { Combatant } from './types';
import { rule } from './policy';
import { chaosDomainOf } from './combatFeatures/dispatch';
import { findSaturationLevelById, findArcanePhenomenonById, findArcaneTableById } from '../data/arcanePhenomena';
import type { CastingNumberMod } from './castingNumber';
import type { ArcaneTableRow, PhenomenonScope, PhenomenonTest, PhenomenonTestMod } from '../data/arcanePhenomena';
import { findTableEntry } from './tables';

export type { PhenomenonTest };

/** Forme MINIMALE d'un sort pour la résolution : le runtime ne lit que le `domainId` (id STABLE). */
type SpellDomainRef = { domainId?: string | null };

/** Une OCCURRENCE de phénomène dans le lieu courant : l'id du phénomène au registre + les paramètres
 *  que le RAW laisse au site (Vents réfractés, DR choisi dans la fourchette imprimée). */
export interface ArcaneOccurrence {
  /** Id d'une entrée `phenomena` d'`arcane-phenomena.json`. */
  id: string;
  /** DR effectif retenu dans la fourchette `[dr, drMax]` du RAW (ou le DR tiré du Round pour un
   *  `drDie`). Absent = borne BASSE de la fourchette, jamais la plus favorable au lanceur. */
  dr?: number;
  /** Vents effectivement réfractés par le site (ids de `domains.json`) : RESTRICTION des seuls
   *  modificateurs qui la déclarent (`windRestricted`), jamais un élargissement de portée. */
  winds?: readonly string[];
}

/** État magique du LIEU courant, fourni par l'appelant (état). Vide = aucun phénomène connu. */
export interface MagicEnvironment {
  /** Id d'un palier de `saturationLevels` (`arcane-phenomena.json`). */
  saturationLevelId?: string;
  /** Vent(s) prépondérant(s) de la zone (ids de `domains.json`). */
  dominantWinds?: readonly string[];
  /** Phénomènes arcaniques présents. */
  phenomena?: readonly ArcaneOccurrence[];
}

/** Le modificateur porte-t-il sur CE Sort ? Plusieurs clés de `scope` = OU (le RAW énumère
 *  « la Sorcellerie, la Magie noire ou le Chaos »). `scope` absent = tous les Domaines. */
function scopeMatches(
  scope: PhenomenonScope | undefined,
  spell: SpellDomainRef,
  env: MagicEnvironment,
  caster: Combatant | undefined,
): boolean {
  if (!scope) return true;
  const domain = spell.domainId ?? null;
  const dominant = env.dominantWinds ?? [];
  if (scope.domains && domain != null && scope.domains.includes(domain)) return true;
  if (scope.domainsExcept && domain != null && !scope.domainsExcept.includes(domain)) return true;
  if (scope.chaosMagic && caster && chaosDomainOf(caster) != null) return true;
  if (scope.dominantWinds && domain != null && dominant.includes(domain)) return true;
  if (scope.nonDominantWinds && domain != null && !dominant.includes(domain)) return true;
  return false;
}

/** Les Vents déclarés par le site RESTREIGNENT le modificateur qui porte `windRestricted`
 *  (`VDM 14` l.161) : il vaut seulement pour ces Domaines. Un modificateur sans ce drapeau est
 *  insensible aux Vents du site — une portée fermée ne s'ouvre JAMAIS par cette voie. */
function windRestrictionHolds(
  mod: PhenomenonTestMod,
  spell: SpellDomainRef,
  winds: readonly string[] | undefined,
): boolean {
  if (!mod.windRestricted || !winds || winds.length === 0) return true;
  return spell.domainId != null && winds.includes(spell.domainId);
}

/** DR retenu pour un modificateur : la valeur choisie par le site si elle tient dans la fourchette
 *  imprimée, sinon la borne BASSE (`dr`) — jamais la plus favorable au lanceur. */
export function modDR(mod: PhenomenonTestMod, chosen?: number): number {
  if (chosen == null) return mod.dr;
  const hi = mod.drMax ?? mod.dr;
  const lo = Math.min(mod.dr, hi);
  return Math.min(Math.max(chosen, lo), Math.max(mod.dr, hi));
}

function modsOf(env: MagicEnvironment): { mod: PhenomenonTestMod; chosen?: number; winds?: readonly string[] }[] {
  const out: { mod: PhenomenonTestMod; chosen?: number; winds?: readonly string[] }[] = [];
  for (const mod of findSaturationLevelById(env.saturationLevelId)?.testMods ?? []) out.push({ mod });
  for (const occ of env.phenomena ?? []) {
    for (const mod of findArcanePhenomenonById(occ.id)?.testMods ?? []) out.push({ mod, chosen: occ.dr, winds: occ.winds });
  }
  return out;
}

/**
 * Delta de DR apporté au Test `test` par l'état magique du lieu — somme des modificateurs du palier
 * de Saturation et des phénomènes présents dont la portée tient. 0 si l'option est désactivée.
 */
export function environmentTestDR(
  spell: SpellDomainRef,
  test: PhenomenonTest,
  env: MagicEnvironment = {},
  caster?: Combatant,
): number {
  if (rule('magic-vdm-environnementale') !== true) return 0;
  let dr = 0;
  for (const { mod, chosen, winds } of modsOf(env)) {
    if (!mod.tests.includes(test)) continue;
    if (!scopeMatches(mod.scope, spell, env, caster)) continue;
    if (!windRestrictionHolds(mod, spell, winds)) continue;
    dr += modDR(mod, chosen);
  }
  return dr;
}

/**
 * Modificateurs de NIVEAU D'INCANTATION apportés par le LIEU (`VDM 14 l.353`, l.437, l.489) — même
 * collecte que `environmentTestDR`, même garde d'option. Aucun lieu n'est nommé : la liste sort des
 * `niMods` des phénomènes présents. Le calcul lui-même vit dans `effectiveCastingNumber`.
 */
export function environmentNIMods(env: MagicEnvironment = {}): CastingNumberMod[] {
  if (rule('magic-vdm-environnementale') !== true) return [];
  const out: CastingNumberMod[] = [];
  for (const occ of env.phenomena ?? []) out.push(...(findArcanePhenomenonById(occ.id)?.niMods ?? []));
  return out;
}

/** L'Incantation Critique est-elle ÉLARGIE aux réussites finissant par 0 (Jonction saturée,
 *  `VDM 14` folio 198) par l'un des phénomènes présents ? */
export function environmentWidensCrit(env: MagicEnvironment = {}): boolean {
  if (rule('magic-vdm-environnementale') !== true) return false;
  return (env.phenomena ?? []).some((occ) => findArcanePhenomenonById(occ.id)?.critOnTens === true);
}

/** Tirage sur une table du chapitre (`findTableEntry` — jamais un lookup recodé). */
export function rollArcaneTable(tableId: string, roll: number): ArcaneTableRow {
  return findTableEntry(findArcaneTableById(tableId).rows, roll);
}

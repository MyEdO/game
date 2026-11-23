/**
 * L'équipement : le catalogue et ce qu'il vend, l'encombrement (LDB 61).
 */
import { fabriqueLocale } from '../../../src/engine/fabriqueDId';
import { doterLePorteur } from '../../../src/engine/bourse';
import { maxEncumbrance, totalEncumbrance, wornArmourPoints } from '../../../src/engine/items';
import { makeRNG } from '../../../src/engine/dice';
import { encumbrancePenalties } from '../../../src/engine/encumbrance';
import { consommableDe, isConsumable } from '../../../src/engine/consumables';
import { evalCondition, type Flow } from '../../../src/engine/flowCore';
import { activityConditionCtx } from '../../../src/engine/activities';
import { refusDeConsommer } from '../../../src/noyau/consumableFlow';
import { attackTestOf, combatBaseValue, weaponGroupSkillMode } from '../../../src/engine/combat';
import { forceDuPorteur } from '../../../src/engine/characteristics';
import { ammoFamily, chargeLArme, isOffHandEligible, isShieldTrapping, reachRankOf, weaponFromItem } from '../../../src/engine/items';
import { effectiveWeaponDamage } from '../../../src/engine/weaponDamage';
import { ZONES_D_ARMURE } from '../../../src/engine/classementDeTrait';
import { armourCastDRPenalty } from '../../../src/engine/magic';
import { castingKindOf } from '../../../src/engine/combatFeatures/dispatch';
import { effectiveTalents } from '../../../src/engine/talentsPossedes';
import { findQualityById, findTrappingById, refLabel, testSkillLabel, trappingsInstanciables } from '../../../src/data';
import type { ArmourPoints, Availability, Combatant, ItemInstance } from '../../../src/engine/types';
export { AVAILABILITIES as DISPONIBILITES, type Availability as Disponibilite } from '../../../src/engine/types';

export type PoidsDArmure = 'legere' | 'moyenne' | 'lourde';

/** Les objets de `c` une fois toute son armure ôtée et les pièces `pieces` revêtues à sa place. */
const sousLesPieces = (c: Pick<Combatant, 'items'>, pieces: readonly ItemInstance[]): ItemInstance[] =>
  [...(c.items ?? []).filter((i) => i.kind !== 'armor'), ...pieces.map((p) => ({ ...p, equipped: true }))];

/** Les DR qu'un lanceur de Magie des Arcanes perdrait à ses Tests d'Incantation s'il portait les pièces `pieces` à la
 *  place de toute son armure, 0 pour qui n'en est pas un. LDB 46 l.150-152 */
export function drPerdusSousLesPieces(c: Combatant, pieces: readonly ItemInstance[]): number {
  if (!effectiveTalents(c).some((t) => castingKindOf(t.talentId) === 'arcane')) return 0;
  return armourCastDRPenalty({ ...c, items: sousLesPieces(c, pieces) });
}

/** Un objet que le catalogue vend : sa catégorie, sa Disponibilité, et s'il se consomme (`isConsumable`). */
export interface ObjetEnRayon { id: string; categorie: string; disponibilite: Availability; consommable: boolean }
/** Les objets instanciables du catalogue (`trappingsInstanciables`) qui ont une Disponibilité du livre et un prix. */
export function objetsEnRayon(): ObjetEnRayon[] {
  return trappingsInstanciables().flatMap((t) => {
    const p = t.price && t.price !== 'ND' ? t.price : undefined;
    if (!t.availability || t.availability === 'ND' || !p || !((p.gold ?? 0) || (p.silver ?? 0) || (p.brass ?? 0))) return [];
    return [{ id: t.id, categorie: t.categorie, disponibilite: t.availability, consommable: isConsumable({ trappingId: t.id }, findTrappingById) }];
  });
}

/** La munition que reçoit chaque arme à distance du catalogue : la première que sa fiche nomme, sinon celle que
 *  `parFamille` donne à sa famille (`ammoFamily`), si elle la charge (`chargeLArme`) ; `null` pour une arme qui
 *  s'utilise seule. Une arme dont aucune munition n'est connue est absente. LDB 62 l.131 */
export function munitionsDesArmes(parFamille: Readonly<Record<string, string>>): Record<string, string | null> {
  const groupe = (id: string) => findTrappingById(id)?.subType?.id;
  return Object.fromEntries(trappingsInstanciables().filter((t) => t.categorie === 'distance').flatMap((t): [string, string | null][] => {
    const famille = ammoFamily(groupe(t.id));
    const m = t.munitions?.[0] ?? (famille ? parFamille[famille] : undefined);
    if (!m) return t.munitions?.length || famille ? [] : [[t.id, null]];
    return chargeLArme(findTrappingById, { trappingId: m, subType: groupe(m) }, { trappingId: t.id, subType: groupe(t.id) }) ? [[t.id, m]] : [];
  }));
}

/** L'objet `it` peut-il se tenir en main secondaire (`isOffHandEligible`) ? LDB 14 l.138 */
export const tenableEnMainSecondaire = (it: ItemInstance): boolean => isOffHandEligible(it);

/** Les objets du catalogue `ids`, nés sous le préfixe d'uid `prefixe` (unique par achat). */
export function doter(ids: readonly string[], prefixe: string): ItemInstance[] {
  return doterLePorteur(ids.map((id) => ({ id })) as never, makeRNG(ids.length), fabriqueLocale(prefixe)).items;
}

/** Ce que le catalogue dit d'un objet : libellé, catégorie, Groupe, Encombrement, prix en couronnes d'or (CO), et pour une arme
 *  ses Dégâts, ses mains, son allonge ou sa portée et si c'est un Bouclier (LDB 62 l.33-35), pour une armure ses PA et
 *  les zones qu'elle couvre, et ses qualités. */
export interface ArticleDuCatalogue { label: string; categorie?: string; groupe?: string; enc: number; prixCO: number; desc?: string; degats?: string; mains?: number; allonge?: string; portee?: number; bouclier?: true; pa?: number; zones?: string; qualites: Qualite[] }
export function articleDuCatalogue(id: string): ArticleDuCatalogue {
  const t = findTrappingById(id);
  const p = t?.price && t.price !== 'ND' ? t.price : { gold: 0, silver: 0, brass: 0 };
  const d = t?.damage as { plusBF?: boolean; flat?: number } | undefined;
  return {
    label: t?.label ?? id, ...(t ? { categorie: t.categorie } : {}), ...(t?.subType ? { groupe: t.subType.id } : {}), enc: Number(t?.enc ?? 0), prixCO: (p.gold ?? 0) + (p.silver ?? 0) / 20 + (p.brass ?? 0) / 240, desc: t?.desc,
    ...(d ? { degats: d.plusBF ? `BF+${d.flat ?? 0}` : String(d.flat ?? 0) } : {}),
    ...(t?.hands ? { mains: Number(t.hands) } : {}), ...(t?.reach ? { allonge: String(t.reach) } : {}), ...(typeof t?.range === 'number' ? { portee: t.range } : {}),
    ...(isShieldTrapping(id) ? { bouclier: true as const } : {}), ...(t?.pa ? { pa: Number(t.pa) } : {}), ...(t?.loc ? { zones: String(t.loc) } : {}),
    qualites: qualitesDites((t?.qualities ?? []) as { id: string; value?: number }[]),
  };
}

/** Une qualité d'objet telle que le livre la dit (`qualities.json`) : son nom, Indice compris, son texte verbatim,
 *  et si c'est un Défaut. */
export interface Qualite { nom: string; texte: string; defaut: boolean }
export const qualitesDites = (qs: readonly { id: string; value?: number }[]): Qualite[] =>
  qs.map((q) => {
    const d = findQualityById(q.id);
    const nom = refLabel('qualities', { id: q.id });
    return { nom: q.value == null ? nom : nom.startsWith('%') ? `${q.value} ${nom}` : `${nom} (${q.value})`, texte: d?.desc ?? '', defaut: d?.polarite === 'defaut' };
  });

/** L'arme `id` du catalogue entre les mains de `c` : la valeur et le nom de son Test d'attaque, si sa Compétence
 *  couvre le Groupe de l'arme, ses Dégâts au Bonus de Force du porteur, le rang de son allonge. LDB 09 l.44 */
/** `maitrise` : `complet`, la Spécialisation du Groupe de l'arme ; `degrade`, une autre Spécialisation de Tir qui garde
 *  son bonus mais fait perdre les Atouts de l'arme (Arbalète, Lancer : LDB 62 l.184) ; `aucun`, la Caractéristique seule. */
export interface Maniement { attaque: number; test: string; maitrise: 'complet' | 'degrade' | 'aucun'; degats: number; rangDAllonge: number | null }
export function maniement(c: Combatant, id: string): Maniement {
  const arme = weaponFromItem(doter([id], 'essai')[0]);
  const genre = arme.type === 'distance' ? 'distance' : 'melee';
  return {
    attaque: combatBaseValue(c, genre, arme), test: testSkillLabel(attackTestOf(c, arme, genre)), maitrise: weaponGroupSkillMode(c, arme, genre),
    degats: effectiveWeaponDamage(arme, forceDuPorteur(c)), rangDAllonge: reachRankOf(arme.reach),
  };
}

/** Des Points d'Armure par localisation, par zone d'armure. */
const parZone = (a: ArmourPoints): { zone: string; pa: number }[] => ZONES_D_ARMURE.map((z) => ({ zone: z.label, pa: Math.max(...z.locs.map((l) => a[l])) }));
/** Les Points d'Armure que porte `c`, par zone d'armure. */
export const protection = (c: Combatant): { zone: string; pa: number }[] => parZone(c.armour);
/** Les Points d'Armure des pièces `pieces` revêtues ensemble (`wornArmourPoints`), par zone d'armure. */
export const protectionDesPieces = (pieces: readonly ItemInstance[]): { zone: string; pa: number }[] => parZone(wornArmourPoints(sousLesPieces({}, pieces)));

/** Pourquoi le héros ne peut pas utiliser maintenant l'objet `uid` (`refusDeConsommer`), ou `null`. */
export function refusDUsage(c: Combatant, uid: string): string | null {
  const it = c.items?.find((i) => i.uid === uid);
  const flux = it && consommableDe(it, findTrappingById);
  return !it || !flux ? 'Rien à utiliser.' : refusDeConsommer(c, it, flux) ?? sansEffet(c, flux);
}

/** Un consommable que rien ne refuse mais qui ne ferait rien : sa condition (`si`) fausse pour ce héros, ou un soin
 *  sur un héros indemne. */
function sansEffet(c: Combatant, flux: Flow): string | null {
  if (flux.kind === 'si' && !evalCondition(flux.condition, activityConditionCtx(c))) return 'Sans effet sur lui dans son état.';
  const effet = flux.kind === 'si' ? flux.alors : flux;
  const soinSeul = effet.kind === 'effet' && effet.effet.type === 'ops' && effet.effet.ops.every((o: { op: string }) => o.op === 'heal');
  return soinSeul && c.wounds.current >= c.wounds.max ? 'Il n’est pas blessé.' : null;
}

/** Encombrement porté et capacité sans pénalité (BF + BE). LDB 61 */
export const encombrement = (c: Combatant): { porte: number; capacite: number; mouvement: number; agilite: number; immobile: boolean } => {
  const p = encumbrancePenalties(c);
  return { porte: totalEncumbrance(c), capacite: maxEncumbrance(c), mouvement: p.movePenalty ?? 0, agilite: p.agilityPenalty, immobile: p.immobile };
};

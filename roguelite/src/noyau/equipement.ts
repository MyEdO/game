/**
 * L'équipement : le catalogue, les armures des règles rapides (LDB 63 l.95-103), l'encombrement (LDB 61).
 */
import { fabriqueLocale } from '../../../src/engine/fabriqueDId';
import { doterLePorteur } from '../../../src/engine/bourse';
import { maxEncumbrance, totalEncumbrance } from '../../../src/engine/items';
import { makeRNG } from '../../../src/engine/dice';
import { encumbrancePenalties } from '../../../src/engine/encumbrance';
import { consommableDe } from '../../../src/engine/consumables';
import { refusDeConsommer } from '../../../src/noyau/consumableFlow';
import { attackTestOf, combatBaseValue, weaponGroupSkillMode } from '../../../src/engine/combat';
import { forceDuPorteur } from '../../../src/engine/characteristics';
import { reachRankOf, weaponFromItem } from '../../../src/engine/items';
import { effectiveWeaponDamage } from '../../../src/engine/weaponDamage';
import { ZONES_D_ARMURE } from '../../../src/engine/classementDeTrait';
import { findQualityById, findTrappingById, refLabel, testSkillLabel } from '../../../src/data';
import type { Combatant, ItemInstance, HitLocation } from '../../../src/engine/types';


const PARTOUT: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];
export type PoidsDArmure = 'legere' | 'moyenne' | 'lourde';
/** « Option : Armure, règles rapides » : trois armures couvrant tous les emplacements. LDB 63 l.95-103 */
export const ARMURES_RAPIDES: Record<PoidsDArmure, { label: string; pa: number; enc: number; matiere: string; qualites: { id: string; value?: number }[] }> = {
  legere: { label: 'Armure légère', pa: 1, enc: 1, matiere: 'cuir-bouilli', qualites: [{ id: 'flexible' }] },
  moyenne: { label: 'Armure moyenne', pa: 2, enc: 5, matiere: 'mailles', qualites: [{ id: 'flexible' }, { id: 'en-perception', value: -10 }, { id: 'en-discretion', value: -10 }] },
  lourde: { label: 'Armure lourde', pa: 3, enc: 6, matiere: 'plate', qualites: [{ id: 'impenetrable' }, { id: 'points-faibles' }, { id: 'en-perception', value: -20 }, { id: 'en-discretion', value: -20 }] },
};

/** L'armure rapide `poids`, née non portée (`equiperLObjet` la fait porter), sous l'uid `uid`. */
export function armureRapide(poids: PoidsDArmure, uid: string): ItemInstance {
  const a = ARMURES_RAPIDES[poids];
  return { uid, label: a.label, kind: 'armor', qualities: a.qualites.map((q) => ({ ...q })), pa: a.pa, locs: [...PARTOUT], enc: a.enc, equipped: false, subType: a.matiere } as ItemInstance;
}

/** Les objets du catalogue `ids`, nés sous le préfixe d'uid `prefixe` (unique par achat). */
export function doter(ids: readonly string[], prefixe: string): ItemInstance[] {
  return doterLePorteur(ids.map((id) => ({ id })) as never, makeRNG(ids.length), fabriqueLocale(prefixe)).items;
}

/** Ce que le catalogue dit d'un objet : libellé, Encombrement, prix en couronnes d'or (CO), et pour une arme ses
 *  Dégâts, ses mains, son allonge ou sa portée et ses qualités. */
export interface ArticleDuCatalogue { label: string; enc: number; prixCO: number; desc?: string; degats?: string; mains?: number; allonge?: string; portee?: number; qualites: Qualite[] }
export function articleDuCatalogue(id: string): ArticleDuCatalogue {
  const t = findTrappingById(id);
  const p = t?.price && t.price !== 'ND' ? t.price : { gold: 0, silver: 0, brass: 0 };
  const d = t?.damage as { plusBF?: boolean; flat?: number } | undefined;
  return {
    label: t?.label ?? id, enc: Number(t?.enc ?? 0), prixCO: (p.gold ?? 0) + (p.silver ?? 0) / 20 + (p.brass ?? 0) / 240, desc: t?.desc,
    ...(d ? { degats: d.plusBF ? `BF+${d.flat ?? 0}` : String(d.flat ?? 0) } : {}),
    ...(t?.hands ? { mains: Number(t.hands) } : {}), ...(t?.reach ? { allonge: String(t.reach) } : {}), ...(t?.range ? { portee: Number(t.range) } : {}),
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
export interface Maniement { attaque: number; test: string; entraine: boolean; degats: number; rangDAllonge: number | null }
export function maniement(c: Combatant, id: string): Maniement {
  const arme = weaponFromItem(doter([id], 'essai')[0]);
  const genre = arme.type === 'distance' ? 'distance' : 'melee';
  return {
    attaque: combatBaseValue(c, genre, arme), test: testSkillLabel(attackTestOf(c, arme, genre)), entraine: weaponGroupSkillMode(c, arme, genre) === 'complet',
    degats: effectiveWeaponDamage(arme, forceDuPorteur(c)), rangDAllonge: reachRankOf(arme.reach),
  };
}

/** Les Points d'Armure que porte `c`, par zone d'armure. */
export const protection = (c: Combatant): { zone: string; pa: number }[] => ZONES_D_ARMURE.map((z) => ({ zone: z.label, pa: Math.max(...z.locs.map((l) => c.armour[l])) }));

/** Pourquoi le héros ne peut pas utiliser maintenant l'objet `uid` (`refusDeConsommer`), ou `null`. */
export function refusDUsage(c: Combatant, uid: string): string | null {
  const it = c.items?.find((i) => i.uid === uid);
  const flux = it && consommableDe(it, findTrappingById);
  return !it || !flux ? 'Rien à utiliser.' : refusDeConsommer(c, it, flux);
}

/** Encombrement porté et capacité sans pénalité (BF + BE). LDB 61 */
export const encombrement = (c: Combatant): { porte: number; capacite: number; mouvement: number; agilite: number; immobile: boolean } => {
  const p = encumbrancePenalties(c);
  return { porte: totalEncumbrance(c), capacite: maxEncumbrance(c), mouvement: p.movePenalty ?? 0, agilite: p.agilityPenalty, immobile: p.immobile };
};

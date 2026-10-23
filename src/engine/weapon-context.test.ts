import { describe, it, expect } from 'vitest';
import { effectiveWeapon, effectiveWeaponDamage } from './weaponDamage';
import { resolveMelee, hasWeaponGroupSkill, combatValue } from './combat';
import { weaponHands, recomputeLoadout, itemFromTrappingById } from './items';
import { dangerousNine, hasQuality } from './qualities/dispatch';
import { makeRNG } from './dice';
import type { Weapon, Combatant } from './types';
import { idNeufDeBanc } from '../lib/entityId.testkit';

// Règles d'arme CONTEXTUELLES de Groupe (Issue #43.1, LDB 62) :
//  - 43.1c Lance de cavalerie hors Charge → Arme improvisée (l.59)
//  - 43.1b Fléau sans la Spécialisation → Défaut Dangereuse, aucun autre Atout (l.146-147)
//  - 43.1a Cavalerie (2M) à pied → vraie arme à Deux Mains (l.142-143)

const lance = (): Weapon => ({
  label: 'Lance de cavalerie', type: 'melee', subType: 'cavalerie', reach: 'Très longue',
  damage: { plusBF: true, flat: 6 }, qualities: [{ id: 'empaleuse' }, { id: 'percutante' }],
});
const fleau = (): Weapon => ({
  label: 'Fléau', type: 'melee', subType: 'fleau', reach: 'Moyenne',
  damage: { plusBF: true, flat: 5 }, qualities: [{ id: 'perturbante' }, { id: 'a-enroulement' }],
});

const CHARS = { 'capacite-de-combat': 55, 'capacite-de-tir': 35, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const combatant = (p: Partial<Combatant>): Combatant => ({
  id: 'c', name: 'X', kind: 'hero', characteristics: CHARS,
  wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
  engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  ...p,
} as unknown as Combatant);

describe('43.1c — Lance de cavalerie hors Charge → Arme improvisée (LDB 62 l.58)', () => {
  it('NON chargé → +BF+1, Inoffensive, Atouts perdus (Empaleuse/Percutante)', () => {
    const w = effectiveWeapon(lance(), { charged: false });
    expect(w.damage).toEqual({ plusBF: true, flat: 1 });
    expect(w.qualities).toEqual([{ id: 'inoffensive' }]);
    expect(effectiveWeaponDamage(w, 4)).toBe(5); // BF4 + 1
    expect(hasQuality(w, 'empaleuse')).toBe(false);
    expect(hasQuality(w, 'percutante')).toBe(false);
  });
  it('CHARGÉ → profil normal inchangé (même référence)', () => {
    const w = lance();
    expect(effectiveWeapon(w, { charged: true })).toBe(w);
    expect(effectiveWeaponDamage(w, 4)).toBe(10); // BF4 + 6
  });
  it("la règle ne vise QUE les lances : Marteau à bec-de-corbin (cavalerie, non-lance) inchangé hors charge", () => {
    const marteau: Weapon = { label: 'Marteau à bec-de-corbin', type: 'melee', subType: 'cavalerie', damage: { plusBF: true, flat: 5 }, qualities: [{ id: 'assommante' }] };
    expect(effectiveWeapon(marteau, { charged: false })).toBe(marteau);
  });
  it('résolution seedée (DR 0) : lance NON chargée = BF+1 (5) ; chargée = BF+6 + Percutante (13)', () => {
    const atk = combatant({ id: 'a', pos: { x: 0, y: 0 } });
    const def = combatant({ id: 'd', kind: 'enemy', pos: { x: 1, y: 0 }, characteristics: { ...CHARS, 'capacite-de-combat': 5 } });
    // funnel pré-appliqué (ce que `firedWeapon` produit selon `chargedThisTurn`).
    const impro = resolveMelee(atk, def, effectiveWeapon(lance(), { charged: false }), makeRNG(6), { defense: 'none' });
    const full = resolveMelee({ ...atk, chargedThisTurn: true } as Combatant, def, effectiveWeapon(lance(), { charged: true }), makeRNG(6), { defense: 'none' });
    expect([impro.hit, full.hit]).toEqual([true, true]);
    expect([impro.netSL, full.netSL]).toEqual([0, 0]); // même jet (seed) → DR 0 des deux côtés
    expect(impro.damage).toBe(5);  // BF4 + 1, Inoffensive annule Percutante/Empaleuse
    expect(full.damage).toBe(13);  // BF4 + 6 (=10) + Percutante (3 unités)
  });
});

describe('43.1b — Fléau sans la Spécialisation → Dangereuse + aucun Atout (LDB 62 l.146-147)', () => {
  it('SANS compétence → Dangereuse ajoutée, Atouts (Perturbante/À Enroulement) retirés', () => {
    const w = effectiveWeapon(fleau(), { hasGroupSkill: false });
    expect(w.qualities).toEqual([{ id: 'dangereuse' }]);
    expect(hasQuality(w, 'perturbante')).toBe(false);
    expect(w.damage).toEqual({ plusBF: true, flat: 5 }); // Dégâts inchangés (seul l'Atout change)
  });
  it('un jet RATÉ incluant un 9 déclenche la Maladresse (Dangereuse)', () => {
    const w = effectiveWeapon(fleau(), { hasGroupSkill: false });
    expect(dangerousNine(w, 19, false)).toBe(true);  // raté + 9 aux unités
    expect(dangerousNine(w, 90, false)).toBe(true);  // raté + 9 aux dizaines
    expect(dangerousNine(w, 19, true)).toBe(false);  // réussite : pas de Maladresse Dangereuse
  });
  it('AVEC compétence → Fléau intact (pas Dangereuse, Atouts conservés)', () => {
    const w = effectiveWeapon(fleau(), { hasGroupSkill: true });
    expect(hasQuality(w, 'dangereuse')).toBe(false);
    expect(hasQuality(w, 'perturbante')).toBe(true);
    expect(dangerousNine(w, 19, false)).toBe(false);
  });
  it('hasWeaponGroupSkill : la Spé « Corps à corps (Fléau) » est détectée (réutilise acceptableSpecs)', () => {
    const sans = combatant({ skills: [] });
    const avec = combatant({ skills: [{ id: 'corps-a-corps', spec: 'fleau', advances: 10 } as any] });
    expect(hasWeaponGroupSkill(sans, fleau(), 'melee')).toBe(false);
    expect(hasWeaponGroupSkill(avec, fleau(), 'melee')).toBe(true);
  });
  it("NON-RÉGRESSION (juge adversarial) : une AUTRE Spé possédée (Épées) ne doit PAS se substituer — combatValue = Caractéristique BRUTE, pas base+avances d'Épées (LDB 62 l.139)", () => {
    // Perso avec Corps à corps (Épées)+20, AUCUNE Spé Fléau : maniant un Fléau sans sa Spé, le Test
    // se fait sur la Caractéristique SEULE — jamais gonflé par les avances d'un AUTRE Groupe.
    const c = combatant({ skills: [{ id: 'corps-a-corps', spec: 'epees', advances: 20 } as any] });
    const w = effectiveWeapon(fleau(), { hasGroupSkill: false });
    expect(w.subType).toBe('fleau'); // le Groupe reste PORTÉ (compétence/talent net-identiques) — seules les qualités changent
    expect(combatValue(c, 'melee', w)).toBe(c.characteristics['capacite-de-combat']); // 55, PAS 55+20=75
  });
});

describe('effectiveWeapon — Groupes d’Armes à distance dégradés (LDB 62 l.184/188)', () => {
  const arbalete = (): Weapon => ({
    label: 'Arbalète', type: 'ranged', subType: 'arbalete', range: 60,
    damage: { plusBF: false, flat: 12 }, qualities: [{ id: 'precise' }, { id: 'imprecise' }],
  });

  it('mode dégradé → tous les Atouts perdus (Précise), Défauts conservés (Imprécise)', () => {
    const w = effectiveWeapon(arbalete(), { groupSkillMode: 'degraded' });
    expect(w.qualities).toEqual([{ id: 'imprecise' }]);
    expect(hasQuality(w, 'precise')).toBe(false);
    expect(hasQuality(w, 'imprecise')).toBe(true);
    expect(w.damage).toEqual({ plusBF: false, flat: 12 }); // Dégâts inchangés
  });

  it('mode plein → profil inchangé (même référence)', () => {
    const w = arbalete();
    expect(effectiveWeapon(w, { groupSkillMode: 'full' })).toBe(w);
  });

  it('mode none (aucune Spé) → profil inchangé', () => {
    const w = arbalete();
    expect(effectiveWeapon(w, { groupSkillMode: 'none' })).toBe(w);
  });

  it('sans ctx.groupSkillMode → profil inchangé (non-régression)', () => {
    const w = arbalete();
    expect(effectiveWeapon(w)).toBe(w);
  });
});

describe('43.1a — Cavalerie (2M) à pied → Deux Mains (LDB 62 l.142-143)', () => {
  it('weaponHands : cavalerie hands:2 → 2 à pied, 1 monté', () => {
    const it = { subType: 'cavalerie', hands: 2 as const };
    expect(weaponHands(it)).toBe(2);                    // ctx absent = à pied (défaut)
    expect(weaponHands(it, { mounted: false })).toBe(2); // à pied : vraie arme à Deux Mains
    expect(weaponHands(it, { mounted: true })).toBe(1);  // monté : maniée à une main (rênes)
  });
  it('n’affecte que la Cavalerie : une arme « deux-mains » reste 2 même montée', () => {
    expect(weaponHands({ subType: 'deux-mains', hands: 2 }, { mounted: true })).toBe(2);
    expect(weaponHands({ subType: 'cavalerie', hands: 1 }, { mounted: false })).toBe(1); // lance 1-main inchangée
  });
  it('recomputeLoadout : Marteau à bec-de-corbin dérive 2 mains à pied, 1 main monté', () => {
    const marteau = itemFromTrappingById('marteau-a-bec-de-corbin', idNeufDeBanc)!;
    expect(marteau.subType).toBe('cavalerie');
    expect(marteau.hands).toBe(2);
    const onFoot = combatant({ items: [{ ...marteau, equipped: true }] });
    recomputeLoadout(onFoot);
    expect(onFoot.weapons.find((w) => w.label.includes('bec-de-corbin'))?.hands).toBe(2);
    const mounted = combatant({ mountId: 'horse', items: [{ ...marteau, equipped: true }] });
    recomputeLoadout(mounted);
    expect(mounted.weapons.find((w) => w.label.includes('bec-de-corbin'))?.hands).toBe(1);
  });
});

import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { effectiveWeapon, effectiveWeaponDamage } from './weaponDamage';
import { resolveMelee, hasWeaponGroupSkill, combatValue, attackTestOf } from './combat';
import { weaponHands, recomputeLoadout, itemFromTrappingById, weaponFromItem, setADeuxMains, loadoutSetSlot, activeLoadout } from './items';
import { maniementRetenu } from './weaponGroup';
import { resolveQualities } from './qualities/dispatch';
import { dangerousNine, hasQuality } from './qualities/dispatch';
import { makeRNG } from './dice';
import type { Weapon, Combatant, SkillInstance } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

// Règles d'arme CONTEXTUELLES de Groupe (Issue #43.1, LDB 62) :
//  - 43.1c Lance de cavalerie hors Charge → Arme improvisée (l.59)
//  - 43.1b Fléau sans la Spécialisation → Défaut Dangereuse, aucun autre Atout (l.146-147)
//  - 43.1a Cavalerie (2M) à pied → vraie arme à Deux Mains (l.142-143)

const lance = (): Weapon => weaponFromItem(itemFromTrappingById('lance-de-cavalerie', idsDeTest)!);
const fleau = (): Weapon => ({
  label: 'Fléau', type: 'melee', subType: 'fleau', reach: 'Moyenne',
  damage: { plusBF: true, flat: 5 }, qualities: [{ id: 'perturbante' }, { id: 'a-enroulement' }],
});

const CHARS = { 'capacite-de-combat': 55, 'capacite-de-tir': 35, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const combatant = (p: Partial<Combatant>): Combatant => (blessuresSurLeProfil({
  id: 'c', name: 'X', kind: 'heros', characteristics: CHARS,
  wounds: blessuresDeBase(20), advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
  engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  ...p,
}) as unknown as Combatant);

describe('43.1c — Lance de cavalerie hors Charge → Arme improvisée (LDB 62 l.58)', () => {
  /** #2967 ; LDB 62 l.58 ; AA 08 l.212 */
  it.each(['lance-de-cavalerie', 'demi-lance-de-cavalerie'])('la %s née conserve ses profils de Charge quand son libellé change', (id) => {
    const item = itemFromTrappingById(id, idsDeTest)!;
    item.label = 'Présent du duc';
    const arme = weaponFromItem(item);
    arme.label = 'Présent du duc';
    expect(effectiveWeapon(arme, { charged: true }).damage).toEqual(item.damage);
    expect(effectiveWeapon(arme, { charged: false }).damage).toEqual({ plusBF: true, flat: 1 });
    expect(effectiveWeapon(arme, { charged: false }).qualities).toEqual([{ id: 'inoffensive' }]);
  });

  it('NON chargé → +BF+1, Inoffensive, Atouts perdus (Empaleuse/Percutante)', () => {
    const w = effectiveWeapon(lance(), { charged: false });
    expect(w.damage).toEqual({ plusBF: true, flat: 1 });
    expect(w.qualities).toEqual([{ id: 'inoffensive' }]);
    expect(effectiveWeaponDamage(w, { bf: 4, passif: 0 })).toBe(5); // BF4 + 1
    expect(hasQuality(w, 'empaleuse')).toBe(false);
    expect(hasQuality(w, 'percutante')).toBe(false);
  });
  it('CHARGÉ → profil normal inchangé (même référence)', () => {
    const w = lance();
    expect(effectiveWeapon(w, { charged: true })).toBe(w);
    expect(effectiveWeaponDamage(w, { bf: 4, passif: 0 })).toBe(10); // BF4 + 6
  });
  it("la règle ne vise QUE les lances : Marteau à bec-de-corbin (cavalerie, non-lance) inchangé hors charge", () => {
    const marteau: Weapon = { label: 'Marteau à bec-de-corbin', type: 'melee', subType: 'cavalerie', damage: { plusBF: true, flat: 5 }, qualities: [{ id: 'assommante' }] };
    expect(effectiveWeapon(marteau, { charged: false })).toBe(marteau);
  });
  it('résolution seedée (DR 0) : lance NON chargée = BF+1 (5) ; chargée = BF+6 + Percutante (13)', () => {
    const atk = combatant({ id: 'a', pos: { x: 0, y: 0 } });
    const def = combatant({ id: 'd', kind: 'ennemi', pos: { x: 1, y: 0 }, characteristics: { ...CHARS, 'capacite-de-combat': 5 } });
    // funnel pré-appliqué (ce que `firedWeapon` produit selon `chargedThisTurn`).
    const impro = resolveMelee(atk, def, effectiveWeapon(lance(), { charged: false }), makeRNG(6), { defense: 'aucune' });
    const full = resolveMelee({ ...atk, chargedThisTurn: true } as Combatant, def, effectiveWeapon(lance(), { charged: true }), makeRNG(6), { defense: 'aucune' });
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
    label: 'Arbalète', type: 'distance', subType: 'arbalete', range: 60,
    damage: { plusBF: false, flat: 12 }, qualities: [{ id: 'precise' }, { id: 'imprecise' }],
  });

  it('mode dégradé → tous les Atouts perdus (Précise), Défauts conservés (Imprécise)', () => {
    const w = effectiveWeapon(arbalete(), { groupSkillMode: 'degrade' });
    expect(w.qualities).toEqual([{ id: 'imprecise' }]);
    expect(hasQuality(w, 'precise')).toBe(false);
    expect(hasQuality(w, 'imprecise')).toBe(true);
    expect(w.damage).toEqual({ plusBF: false, flat: 12 }); // Dégâts inchangés
  });

  it('mode plein → profil inchangé (même référence)', () => {
    const w = arbalete();
    expect(effectiveWeapon(w, { groupSkillMode: 'complet' })).toBe(w);
  });

  it('mode none (aucune Spé) → profil inchangé', () => {
    const w = arbalete();
    expect(effectiveWeapon(w, { groupSkillMode: 'aucun' })).toBe(w);
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
    const marteau = itemFromTrappingById('marteau-a-bec-de-corbin', idsDeTest)!;
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

/** AA 08 l.188 ; AA 08 l.190 */
const cac = (spec: string, advances: number): SkillInstance => ({ id: 'corps-a-corps', characteristic: 'capacite-de-combat', spec, advances });
/** Qualités de `w` maniée par `c` (`maniementRetenu` aux mains qui la tiennent), Groupe compris. */
const qualitesManiees = (c: Combatant, w: Weapon) => resolveQualities(effectiveWeapon(w, { maniement: maniementRetenu(c, w, w.hands) })).map((q) => q.id).sort();

describe('Arme de Cavalerie maniée à pied : Groupe de Corps à corps et Atouts du maniement', () => {
  const sabre = (): Weapon => weaponFromItem(itemFromTrappingById('sabre', idsDeTest)!);
  const marteau = (): Weapon => weaponFromItem(itemFromTrappingById('marteau-a-bec-de-corbin', idsDeTest)!);
  const taillade = (c: Combatant, w: Weapon) =>
    effectiveWeapon(w, { maniement: maniementRetenu(c, w, w.hands) }).qualities.find((q) => q.id === 'taillade')?.value;

  it('sabre à pied avec Corps à Corps (Base) : Test de Base, Taillade (2A)', () => {
    const c = combatant({ skills: [cac('base', 10)] });
    expect(attackTestOf(c, sabre(), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec: 'base' } });
    expect(combatValue(c, 'melee', sabre())).toBe(65);
    expect(taillade(c, sabre())).toBe(2);
  });

  it('sabre à pied avec Corps à Corps (Escrime) : Test d’Escrime, Taillade (1A)', () => {
    const c = combatant({ skills: [cac('escrime', 10)] });
    expect(attackTestOf(c, sabre(), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec: 'escrime' } });
    expect(combatValue(c, 'melee', sabre())).toBe(65);
    expect(taillade(c, sabre())).toBe(1);
  });

  it('sabre monté : Test de Cavalerie, Taillade (1A), aucun maniement à pied', () => {
    const c = combatant({ mountId: 'cheval', skills: [cac('cavalerie', 10), cac('base', 20)] });
    expect(maniementRetenu(c, sabre())).toBeUndefined();
    expect(attackTestOf(c, sabre(), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec: 'cavalerie' } });
    expect(combatValue(c, 'melee', sabre())).toBe(65);
    expect(taillade(c, sabre())).toBe(1);
  });

  it('à pied avec la seule Spé de Cavalerie : Test de Cavalerie, Taillade (1A)', () => {
    const c = combatant({ skills: [cac('cavalerie', 10)] });
    expect(maniementRetenu(c, sabre())).toBeUndefined();
    expect(attackTestOf(c, sabre(), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec: 'cavalerie' } });
    expect(combatValue(c, 'melee', sabre())).toBe(65);
    expect(taillade(c, sabre())).toBe(1);
  });

  it('à pied sans aucune de ces Spés : Caractéristique brute', () => {
    const c = combatant({ skills: [cac('armes-d-hast', 10)] });
    expect(combatValue(c, 'melee', sabre())).toBe(55);
    expect(hasWeaponGroupSkill(c, sabre(), 'melee')).toBe(false);
  });

  it.each([
    ['Base plus haute', [cac('base', 20), cac('escrime', 10), cac('cavalerie', 5)], 'base', 2],
    ['Escrime plus haute', [cac('base', 10), cac('escrime', 20)], 'escrime', 1],
    ['Cavalerie plus haute', [cac('base', 10), cac('cavalerie', 20)], undefined, 1],
    ['Base et Escrime à égalité : le maniement qui garde Taillade (1A)', [cac('base', 10), cac('escrime', 10)], 'escrime', 1],
    ['Base et Cavalerie à égalité : le Groupe de l’arme', [cac('base', 10), cac('cavalerie', 10)], undefined, 1],
  ])('plusieurs Spés à pied, %s', (_cas, skills, groupe, indice) => {
    const c = combatant({ skills });
    expect(maniementRetenu(c, sabre())?.groupe).toBe(groupe);
    expect(taillade(c, sabre())).toBe(indice);
  });

  it('marteau à bec-de-corbin : Corps à Corps (Deux mains) à pied, Cavalerie monté', () => {
    const skills = [cac('deux-mains', 10), cac('cavalerie', 5)];
    const aPied = combatant({ skills });
    expect(attackTestOf(aPied, marteau(), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec: 'deux-mains' } });
    expect(combatValue(aPied, 'melee', marteau())).toBe(65);
    const monte = combatant({ mountId: 'cheval', skills });
    expect(attackTestOf(monte, marteau(), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec: 'cavalerie' } });
    expect(combatValue(monte, 'melee', marteau())).toBe(60);
  });
});

/** AA 08 l.343 */
describe('Épée bâtarde à une main avec Corps à Corps (Base) : Épuisante et Lente', () => {
  const porteur = (skills: SkillInstance[], ids = ['epee-batarde', 'bouclier']): Combatant => {
    const c = combatant({ skills, items: ids.map((id) => ({ ...itemFromTrappingById(id, idsDeTest)!, equipped: true })) });
    recomputeLoadout(c);
    return c;
  };
  const batarde = (c: Combatant) => c.weapons.find((w) => w.trappingId === 'epee-batarde')!;
  const tenirLeBouclier = (c: Combatant) => {
    const lo = activeLoadout(c)!;
    loadoutSetSlot(c, lo.id, 'secondaire', c.items!.find((i) => i.trappingId === 'bouclier')!.uid);
    recomputeLoadout(c);
  };

  it('bouclier en main secondaire : Test de Base, une main, Épuisante et Lente acquises', () => {
    const c = porteur([cac('base', 10), cac('deux-mains', 20)]);
    expect(batarde(c).hands).toBe(2);
    expect(setADeuxMains(c, activeLoadout(c)!)).toBe(false);
    tenirLeBouclier(c);
    expect(batarde(c).hands).toBe(1);
    expect(c.weapons.some((w) => w.hand === 'secondaire' && w.trappingId === 'bouclier')).toBe(true);
    expect(attackTestOf(c, batarde(c), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec: 'base' } });
    expect(combatValue(c, 'melee', batarde(c))).toBe(65);
    expect(qualitesManiees(c, batarde(c))).toEqual(['defensive', 'devastatrice', 'epuisante', 'lente']);
  });

  it('main secondaire libre, Deux mains plus haute : Test de Deux mains, sans ces Défauts', () => {
    const c = porteur([cac('base', 10), cac('deux-mains', 20)], ['epee-batarde']);
    expect(batarde(c).hands).toBe(2);
    expect(attackTestOf(c, batarde(c), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec: 'deux-mains' } });
    expect(combatValue(c, 'melee', batarde(c))).toBe(75);
    expect(qualitesManiees(c, batarde(c))).toEqual(['defensive', 'devastatrice']);
  });

  it('Base et Deux mains à égalité, main secondaire libre : le maniement qui garde les qualités', () => {
    const c = porteur([cac('base', 10), cac('deux-mains', 10)], ['epee-batarde']);
    expect(batarde(c).hands).toBe(2);
    expect(attackTestOf(c, batarde(c), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec: 'deux-mains' } });
  });

  it('la seule Spé de Base : à une main, et le set par défaut lui donne le bouclier', () => {
    const c = porteur([cac('base', 10)]);
    expect(batarde(c).hands).toBe(1);
    expect(c.weapons.some((w) => w.hand === 'secondaire' && w.trappingId === 'bouclier')).toBe(true);
    expect(attackTestOf(c, batarde(c), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec: 'base' } });
  });

  it('sans Corps à Corps (Base) : deux mains, la main secondaire est refusée', () => {
    const c = porteur([cac('deux-mains', 10)]);
    expect(setADeuxMains(c, activeLoadout(c)!)).toBe(true);
    activeLoadout(c)!.secondaire = c.items!.find((i) => i.trappingId === 'bouclier')!.uid;
    recomputeLoadout(c);
    expect(batarde(c).hands).toBe(2);
    expect(c.weapons.some((w) => w.hand === 'secondaire')).toBe(false);
    expect(qualitesManiees(c, batarde(c))).toEqual(['defensive', 'devastatrice']);
  });

  it('hors de tout porteur, l’arme de catalogue reste à deux mains et dans son Groupe', () => {
    const w = weaponFromItem(itemFromTrappingById('epee-batarde', idsDeTest)!);
    expect(w.hands).toBe(2);
    expect(maniementRetenu(combatant({ skills: [cac('base', 10)] }), w, w.hands)).toBeUndefined();
  });
});

/** AA 08 l.194 ; AA 08 l.314 */
describe('Arme d’escrime ou main gauche maniée en Corps à Corps (Base)', () => {
  const arme = (id: string): Weapon => weaponFromItem(itemFromTrappingById(id, idsDeTest)!);

  it.each([
    ['la seule Base : Test de Base, qualités de la rapière', [cac('base', 10)], 'base'],
    ['Escrime : Test d’Escrime', [cac('escrime', 10)], 'escrime'],
    ['Base et Escrime à égalité : Escrime', [cac('base', 10), cac('escrime', 10)], 'escrime'],
  ])('rapière, %s', (_cas, skills, spec) => {
    const c = combatant({ skills });
    expect(attackTestOf(c, arme('rapiere'), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec } });
    expect(combatValue(c, 'melee', arme('rapiere'))).toBe(65);
    expect(qualitesManiees(c, arme('rapiere'))).toEqual(['empaleuse', 'rapide']);
  });

  it('toute arme du Groupe Escrime, sans ligne par arme : le fleuret en Base', () => {
    const c = combatant({ skills: [cac('base', 10)] });
    expect(itemFromTrappingById('fleuret', idsDeTest)!.manieAussi).toBeUndefined();
    expect(attackTestOf(c, arme('fleuret'), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec: 'base' } });
  });

  it('main gauche sans Parade : Test de Base, Défensive perdue', () => {
    const c = combatant({ skills: [cac('base', 10)] });
    expect(attackTestOf(c, arme('main-gauche'), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec: 'base' } });
    expect(qualitesManiees(c, arme('main-gauche'))).toEqual([]);
  });

  it('main gauche avec Parade : Test de Parade, Défensive gardée', () => {
    const c = combatant({ skills: [cac('base', 10), cac('parade', 10)] });
    expect(attackTestOf(c, arme('main-gauche'), 'melee')).toEqual({ skill: { id: 'corps-a-corps', spec: 'parade' } });
    expect(qualitesManiees(c, arme('main-gauche'))).toEqual(['defensive']);
  });
});

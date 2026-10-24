/** #2967 ; LDB 10 l.972 */
import { afterEach, describe, expect, it } from 'vitest';
import { findTrappingById, trappings } from '../data';
import { setDataset } from '../data/overrides';
import { porteurDObjetDeCampagne } from '../scenes/fixtures/objetDeCampagne';
import * as objets from './items';
import { shieldAdvantageLevel } from './combatFeatures/dispatch';
import { applyOps, skillDRBonus } from './ops';
import { desDuTest } from './dice.testkit';
import { isMagicWeapon } from './qualities/dispatch';
import { itemCapability } from './capabilities';
import { combatantLights } from '../noyau/monde/vision';
import { objetDuNarratif } from '../noyau/monde/resolveursDuNarratif';

const catalogue = trappings.slice();
afterEach(() => setDataset('trappings', catalogue));

describe('propriétés intrinsèques de l’objet (#2967)', () => {
  /** #2967 */
  it('la racine de campagne traverse la naissance puis les deux projections sans relire la fiche', () => {
    const { item, objet, resolveTrapping } = porteurDObjetDeCampagne('epee_ebrechee');
    expect(objets.itemFromTrappingById(objet.id, resolveTrapping)).toHaveProperty('shape', { id: 'epee' });
    expect(item).toHaveProperty('shape', { id: 'epee' });
    setDataset('trappings', [...catalogue, { ...objet, shape: { id: 'hache' }, formChoices: ['hache'] }]);
    const arme = objets.weaponFromItem(item);
    expect(arme).toHaveProperty('shape', { id: 'epee' });
    expect(objets.apparencesCandidates(arme)).toEqual(['epee_ebrechee', 'epee']);
    expect(objets.CLES_INTRINSEQUES_D_OBJET).toHaveProperty('shape', true);
  });

  /** #2967 */
  it('la racine fournie à l’invocation reste fixée après édition de sa fiche', () => {
    const item = objets.weaponItem({
      label: 'Arme invoquée', damage: { plusBF: true, flat: 4 },
      shape: findTrappingById('baton-de-combat')!.shape, apparence: 'hache_naine',
    });
    expect(item).toHaveProperty('shape', { id: 'baton' });
    setDataset('trappings', catalogue.map((t) => t.id === 'baton-de-combat' ? { ...t, shape: { id: 'hache' } } : t));
    const arme = objets.weaponFromItem(item);
    expect(arme).toHaveProperty('shape', { id: 'baton' });
    expect(objets.apparencesCandidates(arme)).toEqual(['baton']);
  });

  /** LDB 43 l.281 */
  it.each([
    ['epee_ebrechee', true],
    ['hache_naine', false],
  ] as const)('l’apparence née %s décide de l’admission de l’augmentation d’épée : %s', (apparence, admise) => {
    const { hero, item, objet } = porteurDObjetDeCampagne(apparence);
    setDataset('trappings', [...catalogue, { ...objet, shape: { id: admise ? 'hache' : 'epee' }, formChoices: [] }]);
    applyOps(hero, [{ op: 'augmentWeapon', requiresWeapon: ['epee'], addQualities: ['magique'] }], {
      rng: desDuTest, label: 'Épée de justice', defaultDurationRounds: 4,
    });
    expect(isMagicWeapon(hero.weapons[0])).toBe(admise);
    expect(item.enchants?.length ?? 0).toBe(admise ? 1 : 0);
  });

  it('la marque improvisée de campagne naît sur l’objet', () => {
    const { objet, item, narratif } = porteurDObjetDeCampagne('hache_naine', { improvised: true });
    expect(findTrappingById(objet.id)).toBeUndefined();
    expect(item).toHaveProperty('improvised', true);
    const apresEdition = objetDuNarratif({ ...narratif, objets: [{ ...objet, improvised: undefined }] });
    expect(objets.itemFromGive({ trappingId: objet.id }, undefined, apresEdition)).not.toHaveProperty('improvised');
    expect(item).toHaveProperty('improvised', true);
  });
  it('le bouclier de campagne donne le même Porte-bouclier que sa fiche au catalogue', () => {
    const { hero, objet } = porteurDObjetDeCampagne('hache_naine', { shield: true });
    hero.talents = [{ talentId: 'porte-bouclier', times: 2 }];
    expect(findTrappingById(objet.id)).toBeUndefined();
    const deCampagne = shieldAdvantageLevel(hero, hero.weapons[0]);
    setDataset('trappings', [...catalogue, objet]);
    const it = objets.itemFromTrappingById(objet.id)!;
    const duCatalogue = shieldAdvantageLevel(hero, objets.weaponFromItem(it));
    expect(deCampagne).toBe(2);
    expect(deCampagne).toBe(duCatalogue);
  });

  it('les passifs de campagne restent ceux de la naissance après édition de la fiche', () => {
    const { hero, objet, item } = porteurDObjetDeCampagne('hache_naine', { passive: [
      { op: 'skillDRBonus', skill: { id: 'orientation' }, bonus: 3 },
      { op: 'light', radiusM: 8, tone: 'ambre' },
    ] });
    hero.pos = { x: 2, y: 3 };
    expect(skillDRBonus(hero, 'orientation')).toBe(3);
    expect(combatantLights(hero, 2)[0]?.radiusTiles).toBe(4);
    setDataset('trappings', [...catalogue, { ...objet, passive: [] }]);
    expect(skillDRBonus(hero, 'orientation')).toBe(3);
    expect(combatantLights(hero, 2)[0]?.radiusTiles).toBe(4);
    expect(item).toHaveProperty('passive', objet.passive);
  });

  it('une clé intrinsèque déclarée traverse la naissance et les deux projections d’arme', () => {
    const { item } = porteurDObjetDeCampagne('hache_naine', { organicProjectile: true, shield: true });
    const arme = objets.weaponFromItem(item);
    expect(arme).toHaveProperty('organicProjectile', true);
    expect(arme).toHaveProperty('shield', true);
    const directe = objets.buildWeapon({ label: 'Sonde', damage: { plusBF: true, flat: 1 }, ...{ organicProjectile: true, shield: true } });
    expect(directe).toHaveProperty('shield', true);
    expect(directe).toHaveProperty('organicProjectile', true);
    expect(objets.CLES_INTRINSEQUES_D_OBJET).toHaveProperty('organicProjectile', true);
    expect(objets.CLES_INTRINSEQUES_D_OBJET).toHaveProperty('shield', true);
  });

  it('les capacités et profils imbriqués sont détachés de la fiche de naissance', () => {
    const { objet, item } = porteurDObjetDeCampagne('hache_naine', { capabilities: { isRations: true }, niPerGram: 20, niConsumedPerDR: 2 });
    expect(itemCapability(item, 'isRations')).toBe(true);
    expect(item).toHaveProperty('niPerGram', 20);
    expect(item).toHaveProperty('niConsumedPerDR', 2);
    expect(item.capabilities).not.toBe(objet.capabilities);
    setDataset('trappings', [...catalogue, { ...objet, capabilities: {} }]);
    expect(itemCapability(item, 'isRations')).toBe(true);
  });
});

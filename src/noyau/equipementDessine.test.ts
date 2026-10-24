/**
 * ÉQUIPEMENT DESSINÉ, lu à la surface du noyau (#2948) : la matière d'une pièce est son type d'armure
 * (`subType`), jamais une lecture de libellé ni un palier de PA ; seule l'armure de statbloc synthétisée,
 * dessinée déclarée portée, reçoit la matière de son palier de PA.
 */
import { describe, it, expect } from 'vitest';
import { equipementDessine, equipementDEntite } from './index';
import { armeDeDessin, bouclierDeDessin, pieceDeDessin, RANG_DE_MATIERE } from './equipementDessine';
import { emptyArmour, itemFromGive, loadoutSetActive, loadoutSetSlot, recomputeLoadout, weaponFromItem } from '../engine/items';
import { spawnEnemy } from './monde/spawn';
import { findCreatureById } from '../data';
import weaponGroups from '../data/weaponGroups.json';
import type { Combatant, ItemInstance } from '../engine/types';

const porteur = (over: Partial<Combatant>): Combatant => ({ weapons: [], items: [], armour: emptyArmour(0), ...over }) as unknown as Combatant;
const porte = (trappingId: string): ItemInstance => ({ ...itemFromGive({ trappingId }), equipped: true });
const matieres = (c: Combatant) => equipementDessine(c).armour.map((p) => [p.locs, p.matiere]);

describe('equipementDessine — candidats publiés (#2948)', () => {
  it('publie les candidats des armes tenues, rangées et du bouclier', () => {
    const tenue = { ...porte('arme-simple'), uid: 'tenue', apparence: 'epee_ebrechee' };
    const rangee = { ...porte('arme-simple'), uid: 'rangee', apparence: 'hache_naine' };
    const bouclier = { ...porte('bouclier'), uid: 'bouclier', apparence: 'bouclier_blason' };
    const c = porteur({
      items: [tenue, rangee, bouclier],
      weapons: [weaponFromItem(tenue, 'main'), weaponFromItem(bouclier, 'off')],
      loadouts: [{ id: 'a', main: tenue.uid, off: bouclier.uid }, { id: 'b', main: rangee.uid }],
      activeLoadoutId: 'a',
    });
    const equip = equipementDessine(c);
    expect(equip.weapons.map((w) => w.candidats)).toEqual([['epee_ebrechee', 'epee'], ['bouclier_blason', 'rond']]);
    expect(equip.rangees.map((w) => w.candidats)).toEqual([['hache_naine', 'hache']]);
    expect(equip.shield?.candidats).toEqual(['bouclier_blason', 'rond']);
  });

  it('ignore une apparence non admise sur l’arme et le bouclier projetés', () => {
    expect(armeDeDessin({ ...weaponFromItem(porte('arme-simple')), apparence: 'zweihander' }).candidats).toEqual(['epee']);
    expect(bouclierDeDessin({ trappingId: 'bouclier', apparence: 'hache_naine' }).candidats).toEqual(['rond']);
  });
});

describe('equipementDessine — matière par id (#2948)', () => {
  it('« Plastron de cuir » porté se dessine en cuir bouilli, l’id de son trapping', () => {
    expect(matieres(porteur({ items: [porte('plastron-de-cuir')] }))).toEqual([[['corps'], 'cuir-bouilli']]);
  });

  it('la matière est le subType, quel que soit le PA : « Heaume » (PA 2) en plate, armure du Chaos en armure du Chaos', () => {
    expect(matieres(porteur({ items: [porte('heaume')] }))).toEqual([[['tete'], 'plate']]);
    const chaos = { ...porte('calotte-de-cuir'), subType: 'armure-du-chaos' };
    expect(pieceDeDessin(chaos).matiere).toBe('armure-du-chaos');
  });

  it('une pièce d’armure sans type d’armure est un état invalide, refusé', () => {
    const { subType: _retire, ...sansType } = porte('heaume');
    expect(() => pieceDeDessin(sansType)).toThrow(/pas de type d'armure/);
  });

  it('cuir bouilli par-dessus cuir souple sur le corps', () => {
    const c = porteur({ items: [porte('veste-de-cuir'), porte('plastron-de-cuir')] });
    expect(equipementDessine(c).armour.filter((p) => p.locs?.includes('corps')).map((p) => p.matiere)).toEqual(['cuir-bouilli', 'cuir-souple']);
  });

  it('sans pièce portée, l’armure de statbloc ne se dessine que déclarée portée par l’apparence d’auteur, une matière par palier de PA', () => {
    const armour = { ...emptyArmour(0), tete: 4, corps: 2, brasG: 1, brasD: 1 };
    expect(equipementDessine(porteur({ armour })).armour).toEqual([]);
    expect(equipementDessine(porteur({ armour, appearanceOverride: { armurePortee: true } })).armour.map((p) => [p.locs, p.matiere])).toEqual([
      [['tete'], 'plate'], [['corps'], 'mailles'], [['brasG', 'brasD'], 'cuir-souple'],
    ]);
  });

  it('orc de bestiaire (record `armurePortee`, PA 3 partout) : ses 4 pièces, sans paramètre', () => {
    const orc = spawnEnemy({ presetCreature: findCreatureById('orc')!, presetId: 'orc' }, 'orc-1', { x: 0, y: 0 });
    expect(equipementDessine(orc).armour.map((p) => [p.locs, p.matiere])).toEqual([
      [['corps'], 'mailles'], [['tete'], 'mailles'], [['brasG', 'brasD'], 'mailles'], [['jambeG', 'jambeD'], 'mailles'],
    ]);
  });

  it('l’apparence d’auteur prime sur le record : orc déclaré sans armure portée', () => {
    const orc = spawnEnemy({ presetCreature: findCreatureById('orc')!, presetId: 'orc' }, 'orc-2', { x: 0, y: 0 }, { appearance: { armurePortee: false } });
    expect(equipementDessine(orc).armour).toEqual([]);
  });

  it('entité de scène : même résolution, record ou apparence d’auteur', () => {
    expect(equipementDEntite('orc').armour).toHaveLength(4);
    expect(equipementDEntite('orc', { armurePortee: false }).armour).toEqual([]);
    expect(equipementDEntite(undefined, { armour: 2 }).armour).toEqual([]);
    expect(equipementDEntite(undefined, { armour: 2, armurePortee: true }).armour.map((p) => p.matiere)).toEqual(['mailles', 'mailles', 'mailles', 'mailles']);
  });

  it('les matières rangées sont exactement les Groupes « armour » de weaponGroups.json', () => {
    const ids = weaponGroups.filter((g) => g.kind === 'armour').map((g) => g.id).sort();
    expect(Object.keys(RANG_DE_MATIERE).sort()).toEqual(ids);
  });
});

describe('equipementDessine — armes rangées (#2948)', () => {
  const heros = (...ids: string[]): Combatant => {
    const c = porteur({ kind: 'hero', items: ids.map((id) => ({ ...porte(id), uid: id })) });
    recomputeLoadout(c);
    return c;
  };
  const tenues = (c: Combatant) => equipementDessine(c).weapons.map((w) => [w.subType ?? w.type, w.bouclier]);
  const rangees = (c: Combatant) => equipementDessine(c).rangees.map((w) => [w.subType ?? w.type, w.bouclier]);

  it('deux sets : l’épée et le bouclier tenus, l’arc rangé ; le set change, les rôles s’inversent', () => {
    const c = heros('arme-simple', 'bouclier', 'arc');
    expect(tenues(c)).toEqual([['base', false], ['base', true]]);
    expect(rangees(c)).toEqual([['arc', false]]);
    loadoutSetActive(c, c.loadouts![1].id);
    recomputeLoadout(c);
    expect(tenues(c)).toEqual([['arc', false]]);
    expect(rangees(c)).toEqual([['base', false], ['base', true]]);
  });

  it('arme à deux mains au set actif : l’objet `off` de ce set n’est pas tenu, il est rangé', () => {
    const c = heros('grande-hache', 'dague');
    const lo = c.loadouts![0];
    loadoutSetSlot(c, lo.id, 'main', 'grande-hache');
    loadoutSetSlot(c, lo.id, 'off', 'dague');
    recomputeLoadout(c);
    expect(equipementDessine(c).weapons.map((w) => [w.subType, w.hands])).toEqual([['deux-mains', 2]]);
    expect(equipementDessine(c).rangees.map((w) => [w.subType, w.hands])).toEqual([['base', 1]]);
  });

  it('une machine à Équipe équipée (ADE II 8 l.233) n’entre dans aucun set : ni tenue, ni rangée', () => {
    const c = heros('arme-simple', 'baliste');
    expect(c.loadouts!.map((lo) => lo.main)).toEqual(['arme-simple', undefined]);
    expect(tenues(c)).toEqual([['base', false]]);
    expect(rangees(c)).toEqual([]);
  });

  it('un set inactif qui désigne une machine à Équipe (état de sauvegarde, sans recalcul) : la machine n’est pas rangée', () => {
    const c = porteur({
      kind: 'hero', items: [{ ...porte('arme-simple'), uid: 'arme-simple' }, { ...porte('baliste'), uid: 'baliste' }],
      loadouts: [{ id: 'a', main: 'arme-simple' }, { id: 'b', main: 'baliste' }], activeLoadoutId: 'a',
    });
    expect(rangees(c)).toEqual([['base', false]]);
  });

  it('un statbloc sans set n’a aucune arme rangée', () => {
    expect(equipementDessine(spawnEnemy({ presetCreature: findCreatureById('orc')!, presetId: 'orc' }, 'orc-3', { x: 0, y: 0 })).rangees).toEqual([]);
  });
});

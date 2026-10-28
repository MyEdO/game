/**
 * ÉQUIPEMENT DESSINÉ, lu à la surface du noyau (#2948) : la matière d'une pièce est son type d'armure
 * (`subType`), jamais une lecture de libellé ni un palier de PA ; seule l'armure de statbloc synthétisée,
 * dessinée déclarée portée, reçoit la matière de son palier de PA.
 */
import { describe, it, expect } from 'vitest';
import { equipementDessine, equipementDEntite } from './index';
import { armeDeDessin, bouclierDeDessin, pieceDeDessin, RANG_DE_MATIERE, armesDEntite } from './equipementDessine';
import { deciderApparencesDesArmes, emptyArmour, itemFromGive, loadoutSetActive, loadoutSetSlot, recomputeLoadout, weaponFromItem } from '../engine/items';
import { spawnEnemy } from './monde/spawn';
import { creatures, findCreatureById } from '../data';
import { setDataset } from '../data/overrides';
import weaponGroups from '../data/weaponGroups.json';
import type { Combatant, ItemInstance } from '../engine/types';
import type { TraitList } from '../engine/statEntry';
import { renderWeaponsFromTraits } from '../engine/creatureEquip';
import { equipDe } from './equipementDessine';
import { findTrappingById } from '../data';
import { porteurDObjetDeCampagne } from '../scenes/fixtures/objetDeCampagne';
import { objetDuNarratif } from './monde/resolveursDuNarratif';

const porteur = (over: Partial<Combatant>): Combatant => ({ weapons: [], items: [], armour: emptyArmour(0), ...over }) as unknown as Combatant;
const porte = (trappingId: string, apparence?: string): ItemInstance => ({ ...itemFromGive({ trappingId, ...(apparence ? { apparence: { id: apparence } } : {}) }), equipped: true });
const matieres = (c: Combatant) => equipementDessine(c).armour.map((p) => [p.locs, p.matiere]);

describe('apparences d’objets des porteurs sans instance (#2948)', () => {
  it('la naissance et le dessin partagent les candidats de l’objet de campagne à plusieurs formes', () => {
    const { objet, item, hero, candidats, resolveTrapping } = porteurDObjetDeCampagne('hache_naine');
    expect(findTrappingById(objet.id)).toBeUndefined();
    expect(objet.formChoices).toEqual(['epee', 'hache']);
    expect(item.apparence).toBe('hache_naine');
    expect(candidats).toEqual(['hache_naine', 'hache']);
    expect(equipementDessine(hero).weapons[0].candidats).toEqual(candidats);
    expect(equipementDEntite(resolveTrapping, undefined, { weapon: objet.id, apparencesObjets: { [objet.id]: { id: item.apparence! } } }).weapons[0].candidats).toEqual(candidats);
  });

  it('le dessin conserve le bouclier né dans la campagne après édition de sa fiche', () => {
    const { objet, hero, narratif } = porteurDObjetDeCampagne('hache_naine', { shield: true });
    expect(findTrappingById(objet.id)).toBeUndefined();
    expect(equipementDessine(hero).weapons[0].bouclier).toBe(true);
    const apresEdition = objetDuNarratif({ ...narratif, objets: [{ ...objet, shield: undefined }] });
    expect(itemFromGive({ trappingId: objet.id }, undefined, apresEdition).shield).toBeUndefined();
    expect(equipementDessine(hero).weapons[0].bouclier).toBe(true);
  });

  it('le dessin conserve la forme racine née malgré une édition de shape et des formes proposées', () => {
    const { objet, hero, narratif } = porteurDObjetDeCampagne('hache_naine');
    const apresEdition = objetDuNarratif({ ...narratif, objets: [{ ...objet, shape: { id: 'epee' }, formChoices: ['epee'] }] });
    expect(itemFromGive({ trappingId: objet.id }, undefined, apresEdition).shape).toEqual({ id: 'epee' });
    expect(equipementDessine(hero).weapons[0].candidats).toEqual(['hache_naine', 'hache']);
    expect(equipementDessine(hero).weapons[0].candidats).toEqual(['hache_naine', 'hache']);
  });

  const traits: TraitList = [{ id: 'arme', arg: 'arme-simple', value: 7 }];

  it('sans choix d’auteur, conserve la projection et les armes sans clé apparence', () => {
    const armes = renderWeaponsFromTraits(traits);
    expect(equipementDEntite(findTrappingById, undefined, { traits })).toEqual(equipDe(armes, []));
    for (const arme of armes) expect(arme).not.toHaveProperty('apparence');
  });

  it('projette la variante admise du trait par son id de trapping', () => {
    expect(equipementDEntite(findTrappingById, undefined, { traits, apparencesObjets: { 'arme-simple': { id: 'hache_naine' } } }).weapons[0].candidats)
      .toEqual(['hache_naine', 'hache']);
  });

  it('ignore une racine non admise par le trapping', () => {
    expect(equipementDEntite(findTrappingById, undefined, { traits, apparencesObjets: { 'arme-simple': { id: 'zweihander' } } }).weapons[0].candidats)
      .toEqual(['epee']);
  });

  it('projette aussi le canal weapon, sans trait', () => {
    expect(equipementDEntite(findTrappingById, undefined, { weapon: 'arme-simple', apparencesObjets: { 'arme-simple': { id: 'epee_ebrechee' } } }).weapons[0].candidats)
      .toEqual(['epee_ebrechee', 'epee']);
  });

  it('le bouclier publie les mêmes candidats que son arme projetée', () => {
    const equip = equipementDEntite(findTrappingById, undefined, { weapon: 'bouclier', apparencesObjets: { bouclier: { id: 'bouclier_pointes' } } });
    expect(equip.weapons[0].candidats).toEqual(['bouclier_pointes', 'rond']);
    expect(equip.shield?.candidats).toEqual(equip.weapons[0].candidats);
  });

  it('le record porte son choix et la surcharge gagne par trapping', () => {
    const originales = creatures.slice();
    try {
      setDataset('creatures', originales.map(c => c.id === 'humain' ? { ...c, traits, appearance: { ...c.appearance, apparencesObjets: { 'arme-simple': { id: 'hache_naine' } } } } : c));
      expect(equipementDEntite(findTrappingById, 'humain', { enrolled: true }).weapons[0].candidats).toEqual(['hache_naine', 'hache']);
      const ne = spawnEnemy({ ref: 'humain' }, 'humain-fige', { x: 0, y: 0 });
      expect(ne.weapons[0]).toMatchObject({ shape: { id: 'hache' }, apparence: 'hache_naine' });
      expect(equipementDEntite(findTrappingById, 'humain', { enrolled: true, apparencesObjets: { 'arme-simple': { id: 'epee_ebrechee' } } }).weapons[0].candidats)
        .toEqual(['epee_ebrechee', 'epee']);
      setDataset('creatures', originales);
      expect(equipementDessine(ne).weapons[0].candidats).toEqual(['hache_naine', 'hache']);
      expect(ne.weapons[0].shape).toEqual({ id: 'hache' });
    } finally {
      setDataset('creatures', originales);
    }
  });

  it('le spawn décide la racine mécanique et les candidats de l’arme d’auteur avant le dessin', () => {
    const c = spawnEnemy({ statblock: { type: 'statblock', label: 'Porteur de hache', char: { B: 10 } } }, 'hache-auteur', { x: 0, y: 0 }, {
      weapon: 'arme-simple', appearance: { apparencesObjets: { 'arme-simple': { id: 'hache_naine' } } },
    });
    expect(c.weapons[0]).toMatchObject({ shape: { id: 'hache' }, apparence: 'hache_naine' });
    const avant = structuredClone(c.weapons);
    expect(equipementDessine(c).weapons[0].candidats).toEqual(['hache_naine', 'hache']);
    c.appearanceOverride = { apparencesObjets: { 'arme-simple': { id: 'epee_ebrechee' } } };
    expect(equipementDessine(c).weapons[0].candidats).toEqual(['hache_naine', 'hache']);
    expect(c.weapons).toEqual(avant);
    const armes = armesDEntite(findTrappingById, undefined, { weapon: 'arme-simple', apparencesObjets: { 'arme-simple': { id: 'hache_naine' } } });
    expect(armes[0]).toMatchObject({ shape: { id: 'hache' }, apparence: 'hache_naine' });
  });

  it('une instance conserve son propre choix, même devant une apparence d’auteur', () => {
    const instance = porte('arme-simple', 'epee_sertie');
    const c = porteur({ items: [instance], weapons: [weaponFromItem(instance)], appearanceOverride: { apparencesObjets: { 'arme-simple': { id: 'hache_naine' } } } });
    deciderApparencesDesArmes(findTrappingById, c.weapons, c.appearanceOverride, c.creatureId, c.items);
    expect(c.weapons[0]).toMatchObject({ shape: { id: 'epee' }, apparence: 'epee_sertie' });
    expect(equipementDessine(c).weapons[0].candidats).toEqual(['epee_sertie', 'epee']);
  });
});

describe('equipementDessine — candidats publiés (#2948)', () => {
  it('publie la main explicite et la prise graphique des armes sans loadout', () => {
    expect(armeDeDessin(weaponFromItem(porte('arme-simple'), 'off')).hand).toBe('off');
    expect(armeDeDessin(weaponFromItem(porte('arme-simple'))).hand).toBe('main');
    expect(armeDeDessin(weaponFromItem(porte('bouclier'))).hand).toBe('off');
    const deuxMains = armeDeDessin(weaponFromItem(porte('zweihander')));
    expect([deuxMains.hand, deuxMains.hands]).toEqual(['main', 2]);
  });

  it('répartit deux armes de statbloc sans main entre les attaches libres, sans écrire leurs mains', () => {
    const traits: TraitList = [{ id: 'arme', arg: 'arme-simple', value: 7 }, { id: 'arme', arg: 'dague', value: 4 }];
    const armes = renderWeaponsFromTraits(traits);
    const avant = structuredClone(armes);
    expect(equipDe(armes, []).weapons.map(w => w.hand)).toEqual(['main', 'off']);
    expect(equipementDEntite(findTrappingById, undefined, { traits }).weapons.map(w => w.hand)).toEqual(['main', 'off']);
    expect(armes).toEqual(avant);
  });

  it('réserve les mains explicites sans changer l’ordre publié des armes sources', () => {
    const armes = [weaponFromItem(porte('dague')), weaponFromItem(porte('arme-simple'), 'main')];
    expect(equipDe(armes, []).weapons.map(w => [w.candidats, w.hand])).toEqual([[['dague'], 'off'], [['epee'], 'main']]);
  });

  it('une arme rangée ne publie aucune main, même si sa source en porte une', () => {
    const source = weaponFromItem(porte('arme-simple'), 'off');
    const avant = structuredClone(source);
    const rangee = equipDe([], [], { rangees: [source] }).rangees[0];
    expect(rangee.candidats).toEqual(['epee']);
    expect(rangee).not.toHaveProperty('hand');
    expect(source).toEqual(avant);
    expect(armeDeDessin(source)).toEqual(equipDe([source], []).weapons[0]);
  });

  it('range le surplus graphique, y compris derrière une arme à deux mains', () => {
    const deuxMains = weaponFromItem(porte('zweihander'));
    const autre = weaponFromItem(porte('dague'));
    const dessin = equipDe([deuxMains, autre], []);
    expect(dessin.weapons.map(w => [w.candidats, w.hand, w.hands])).toEqual([[['zweihander'], 'main', 2]]);
    expect(dessin.rangees.map(w => w.candidats)).toEqual([['dague']]);
    const trois = equipDe([weaponFromItem(porte('arme-simple')), autre, weaponFromItem(porte('hache-de-lancer'))], []);
    expect(trois.weapons.map(w => w.hand)).toEqual(['main', 'off']);
    expect(trois.rangees.map(w => w.candidats)).toEqual([['hache_lancer']]);
  });

  it('publie les candidats des armes tenues, rangées et du bouclier', () => {
    const tenue = { ...porte('arme-simple', 'epee_ebrechee'), uid: 'tenue' };
    const rangee = { ...porte('arme-simple', 'hache_naine'), uid: 'rangee' };
    const bouclier = { ...porte('bouclier', 'bouclier_blason'), uid: 'bouclier' };
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
    expect(bouclierDeDessin({ ...porte('bouclier'), apparence: 'hache_naine' }).candidats).toEqual(['rond']);
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
    expect(equipementDEntite(findTrappingById, 'orc').armour).toHaveLength(4);
    expect(equipementDEntite(findTrappingById, 'orc', { armurePortee: false }).armour).toEqual([]);
    expect(equipementDEntite(findTrappingById, undefined, { armour: 2 }).armour).toEqual([]);
    expect(equipementDEntite(findTrappingById, undefined, { armour: 2, armurePortee: true }).armour.map((p) => p.matiere)).toEqual(['mailles', 'mailles', 'mailles', 'mailles']);
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

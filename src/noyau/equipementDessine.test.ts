/**
 * LES ARMES DESSINÉES, lues sur l'état (#2948) : les candidats d'apparence d'une arme tenue ou rangée, la main que
 * lui donne la seule attribution des mains, et les armes qu'une entité de scène déclare.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { armeDeDessin, armesDEntite, armesDuCombattant } from './equipementDessine';
import {
  apparencesCandidates,
  deciderApparencesDesArmes,
  emptyArmour,
  itemFromGive,
  loadoutSetActive,
  loadoutSetSlot,
  recomputeLoadout,
  weaponFromItem,
} from '../engine/items';
import { spawnEnemy } from './monde/spawn';
import { creatures, findCreatureById } from '../data';
import { setDataset } from '../data/overrides';
import type { Combatant, ItemInstance, Weapon } from '../engine/types';
import type { TraitList } from '../engine/statEntry';
import type { TraitPose } from '../data/schemas/grammaire/reference';
import { renderWeaponsFromTraits } from '../engine/creatureEquip';
import { findTrappingById } from '../data';
import { porteurDObjetDeCampagne } from '../scenes/fixtures/objetDeCampagne.testkit';
import { objetDuNarratif } from './monde/resolveursDuNarratif';

const porteur = (over: Partial<Combatant>): Combatant => ({ weapons: [], items: [], armour: emptyArmour(0), ...over }) as unknown as Combatant;
const porte = (trappingId: string, apparence?: string): ItemInstance => ({ ...itemFromGive({ trappingId, ...(apparence ? { apparence: { id: apparence } } : {}) }, idsDeTest), equipped: true });
/** Les candidats de la première arme tenue de `c`. */
const candidatsTenus = (c: Combatant) => apparencesCandidates(armesDuCombattant(c).tenues[0].arme);
const candidatsDe = (armes: readonly Weapon[]) => armes.map((w) => apparencesCandidates(w));

describe('apparences d’objets des porteurs sans instance (#2948)', () => {
  it('la naissance et le dessin partagent les candidats de l’objet de campagne à plusieurs formes', () => {
    const { objet, item, hero, candidats, resolveTrapping } = porteurDObjetDeCampagne(idsDeTest, 'hache_naine');
    expect(findTrappingById(objet.id)).toBeUndefined();
    expect(objet.formChoices).toEqual(['epee', 'hache']);
    expect(item.apparence).toBe('hache_naine');
    expect(candidats).toEqual(['hache_naine', 'hache']);
    expect(candidatsTenus(hero)).toEqual(candidats);
    expect(apparencesCandidates(armesDEntite(resolveTrapping, undefined, { inventaire: { [objet.id]: false }, apparencesObjets: { [objet.id]: { id: item.apparence! } } })[0])).toEqual(candidats);
  });

  it('le dessin conserve le bouclier né dans la campagne après édition de sa fiche', () => {
    const { objet, hero, narratif } = porteurDObjetDeCampagne(idsDeTest, 'hache_naine', { shield: true });
    expect(findTrappingById(objet.id)).toBeUndefined();
    expect(armeDeDessin(armesDuCombattant(hero).tenues[0].arme).bouclier).toBe(true);
    const apresEdition = objetDuNarratif({ ...narratif, objets: [{ ...objet, shield: undefined }] });
    expect(itemFromGive({ trappingId: objet.id }, idsDeTest, undefined, apresEdition).shield).toBeUndefined();
    expect(armeDeDessin(armesDuCombattant(hero).tenues[0].arme).bouclier).toBe(true);
  });

  it('le dessin conserve la forme racine née malgré une édition de shape et des formes proposées', () => {
    const { objet, hero, narratif } = porteurDObjetDeCampagne(idsDeTest, 'hache_naine');
    const apresEdition = objetDuNarratif({ ...narratif, objets: [{ ...objet, shape: { id: 'epee' }, formChoices: ['epee'] }] });
    expect(itemFromGive({ trappingId: objet.id }, idsDeTest, undefined, apresEdition).shape).toEqual({ id: 'epee' });
    expect(candidatsTenus(hero)).toEqual(['hache_naine', 'hache']);
  });

  const traits: TraitList = [{ id: 'arme', arg: 'arme-simple', value: 7 }];

  it('sans choix d’auteur, les armes du trait sans clé apparence', () => {
    const armes = armesDEntite(findTrappingById, undefined, { traits });
    expect(armes.map((w) => armeDeDessin(w))).toEqual(renderWeaponsFromTraits(traits).map((w) => armeDeDessin(w)));
    for (const arme of armes) expect(arme).not.toHaveProperty('apparence');
  });

  it('projette la variante admise du trait par son id de trapping', () => {
    expect(candidatsDe(armesDEntite(findTrappingById, undefined, { traits, apparencesObjets: { 'arme-simple': { id: 'hache_naine' } } }))).toEqual([['hache_naine', 'hache']]);
  });

  it('ignore une racine non admise par le trapping', () => {
    expect(candidatsDe(armesDEntite(findTrappingById, undefined, { traits, apparencesObjets: { 'arme-simple': { id: 'zweihander' } } }))).toEqual([['epee']]);
  });

  it('projette aussi l’arme de l’inventaire, sans trait', () => {
    expect(candidatsDe(armesDEntite(findTrappingById, undefined, { inventaire: { 'arme-simple': false }, apparencesObjets: { 'arme-simple': { id: 'epee_ebrechee' } } }))).toEqual([['epee_ebrechee', 'epee']]);
  });

  it('le bouclier déclaré porte la variante choisie, puis sa racine', () => {
    const [bouclier] = armesDEntite(findTrappingById, undefined, { inventaire: { bouclier: false }, apparencesObjets: { bouclier: { id: 'bouclier_pointes' } } });
    expect(armeDeDessin(bouclier)).toMatchObject({ candidats: ['bouclier_pointes', 'rond'], bouclier: true });
  });

  it('le record porte son choix et la surcharge gagne par trapping', () => {
    const originales = creatures.slice();
    try {
      setDataset('creatures', originales.map(c => c.id === 'humain' ? { ...c, traits, appearance: { ...c.appearance, apparencesObjets: { 'arme-simple': { id: 'hache_naine' } } } } : c));
      expect(candidatsDe(armesDEntite(findTrappingById, 'humain', { enrolled: true }))).toEqual([['hache_naine', 'hache']]);
      const ne = spawnEnemy({ ref: 'humain' }, 'humain-fige', { x: 0, y: 0 });
      expect(ne.weapons[0]).toMatchObject({ shape: { id: 'hache' }, apparence: 'hache_naine' });
      expect(candidatsDe(armesDEntite(findTrappingById, 'humain', { enrolled: true, apparencesObjets: { 'arme-simple': { id: 'epee_ebrechee' } } }))).toEqual([['epee_ebrechee', 'epee']]);
      setDataset('creatures', originales);
      expect(candidatsTenus(ne)).toEqual(['hache_naine', 'hache']);
      expect(ne.weapons[0].shape).toEqual({ id: 'hache' });
    } finally {
      setDataset('creatures', originales);
    }
  });

  it('le spawn décide la racine mécanique et les candidats de l’arme d’auteur avant le dessin', () => {
    const c = spawnEnemy({ statblock: { type: 'statblock', label: 'Porteur de hache', char: { B: 10 } } }, 'hache-auteur', { x: 0, y: 0 }, {
      inventaire: { 'arme-simple': false }, appearance: { apparencesObjets: { 'arme-simple': { id: 'hache_naine' } } },
    });
    expect(c.weapons[0]).toMatchObject({ shape: { id: 'hache' }, apparence: 'hache_naine' });
    const avant = structuredClone(c.weapons);
    expect(candidatsTenus(c)).toEqual(['hache_naine', 'hache']);
    c.appearanceOverride = { apparencesObjets: { 'arme-simple': { id: 'epee_ebrechee' } } };
    expect(candidatsTenus(c)).toEqual(['hache_naine', 'hache']);
    expect(c.weapons).toEqual(avant);
    const armes = armesDEntite(findTrappingById, undefined, { inventaire: { 'arme-simple': false }, apparencesObjets: { 'arme-simple': { id: 'hache_naine' } } });
    expect(armes[0]).toMatchObject({ shape: { id: 'hache' }, apparence: 'hache_naine' });
  });

  it('une instance conserve son propre choix, même devant une apparence d’auteur', () => {
    const instance = porte('arme-simple', 'epee_sertie');
    const c = porteur({ items: [instance], weapons: [weaponFromItem(instance)], appearanceOverride: { apparencesObjets: { 'arme-simple': { id: 'hache_naine' } } } });
    deciderApparencesDesArmes(findTrappingById, c.weapons, c.appearanceOverride, c.creatureId, c.items);
    expect(c.weapons[0]).toMatchObject({ shape: { id: 'epee' }, apparence: 'epee_sertie' });
    expect(candidatsTenus(c)).toEqual(['epee_sertie', 'epee']);
  });
});

describe('armesDEntite — Indice formulé lu sur le profil du statbloc (Middenheim 04 l.29)', () => {
  const traits: TraitPose[] = [{ id: 'arme', value: { sum: [{ bonusOf: 'force' }, 4] }, arg: 'Épée' }];

  it('le statbloc d’éditeur porte la Force qui résout « BF +4 »', () => {
    expect(armesDEntite(findTrappingById, undefined, { traits, char: { force: 40 } })[0].damage).toEqual({ plusBF: false, flat: 8, bfInclus: true }); // LDB 85 l.35
  });

  it('sans profil, le statbloc d’éditeur lit une Force nulle', () => {
    expect(armesDEntite(findTrappingById, undefined, { traits })[0].damage).toEqual({ plusBF: false, flat: 4, bfInclus: true });
  });
});

describe('armes dessinées — mains et candidats (#2948)', () => {
  it('publie la main explicite et la prise graphique des armes sans loadout', () => {
    expect(armeDeDessin(weaponFromItem(porte('arme-simple'), 'secondaire')).hand).toBe('secondaire');
    expect(armeDeDessin(weaponFromItem(porte('arme-simple'))).hand).toBe('main');
    expect(armeDeDessin(weaponFromItem(porte('bouclier'))).hand).toBe('secondaire');
    const deuxMains = armeDeDessin(weaponFromItem(porte('zweihander')));
    expect([deuxMains.hand, deuxMains.hands]).toEqual(['main', 2]);
  });

  it('répartit deux armes de statbloc sans main entre les mains libres, sans écrire leurs mains', () => {
    const traits: TraitList = [{ id: 'arme', arg: 'arme-simple', value: 7 }, { id: 'arme', arg: 'dague', value: 4 }];
    const armes = renderWeaponsFromTraits(traits);
    const avant = structuredClone(armes);
    expect(armesDuCombattant(porteur({ weapons: armes })).tenues.map((t) => t.hand)).toEqual(['main', 'secondaire']);
    expect(armes).toEqual(avant);
  });

  it('réserve les mains explicites sans changer l’ordre publié des armes sources', () => {
    const armes = [weaponFromItem(porte('dague')), weaponFromItem(porte('arme-simple'), 'main')];
    expect(armesDuCombattant(porteur({ weapons: armes })).tenues.map((t) => [apparencesCandidates(t.arme), t.hand])).toEqual([[['dague'], 'secondaire'], [['epee'], 'main']]);
  });

  it('range le surplus graphique, y compris derrière une arme à deux mains', () => {
    const deuxMains = weaponFromItem(porte('zweihander'));
    const autre = weaponFromItem(porte('dague'));
    const dessin = armesDuCombattant(porteur({ weapons: [deuxMains, autre] }));
    expect(dessin.tenues.map((t) => [armeDeDessin(t.arme).candidats, t.hand, armeDeDessin(t.arme).hands])).toEqual([[['zweihander'], 'main', 2]]);
    expect(candidatsDe(dessin.rangees)).toEqual([['dague']]);
    const trois = armesDuCombattant(porteur({ weapons: [weaponFromItem(porte('arme-simple')), autre, weaponFromItem(porte('hache-de-lancer'))] }));
    expect(trois.tenues.map((t) => t.hand)).toEqual(['main', 'secondaire']);
    expect(candidatsDe(trois.rangees)).toEqual([['hache_lancer']]);
  });

  it('les candidats des armes tenues, bouclier compris, et rangées', () => {
    const tenue = { ...porte('arme-simple', 'epee_ebrechee'), uid: 'tenue' };
    const rangee = { ...porte('arme-simple', 'hache_naine'), uid: 'rangee' };
    const bouclier = { ...porte('bouclier', 'bouclier_pointes'), uid: 'bouclier' };
    const c = porteur({
      items: [tenue, rangee, bouclier],
      weapons: [weaponFromItem(tenue, 'main'), weaponFromItem(bouclier, 'secondaire')],
      loadouts: [{ id: 'a', main: tenue.uid, secondaire: bouclier.uid }, { id: 'b', main: rangee.uid }],
      activeLoadoutId: 'a',
    });
    const { tenues, rangees } = armesDuCombattant(c);
    expect(candidatsDe(tenues.map((t) => t.arme))).toEqual([['epee_ebrechee', 'epee'], ['bouclier_pointes', 'rond']]);
    expect(candidatsDe(rangees)).toEqual([['hache_naine', 'hache']]);
  });

  it('ignore une apparence non admise sur l’arme projetée', () => {
    expect(armeDeDessin({ ...weaponFromItem(porte('arme-simple')), apparence: 'zweihander' }).candidats).toEqual(['epee']);
  });
});

describe('armes dessinées — armes rangées (#2948)', () => {
  const heros = (...ids: string[]): Combatant => {
    const c = porteur({ kind: 'heros', items: ids.map((id) => ({ ...porte(id), uid: id })) });
    recomputeLoadout(c);
    return c;
  };
  const tenues = (c: Combatant) => armesDuCombattant(c).tenues.map(({ arme }) => [arme.subType ?? arme.type, armeDeDessin(arme).bouclier]);
  const rangees = (c: Combatant) => armesDuCombattant(c).rangees.map((w) => [w.subType ?? w.type, armeDeDessin(w).bouclier]);

  it('deux sets : l’épée et le bouclier tenus, l’arc rangé ; le set change, les rôles s’inversent', () => {
    const c = heros('arme-simple', 'bouclier', 'arc');
    expect(tenues(c)).toEqual([['base', false], ['base', true]]);
    expect(rangees(c)).toEqual([['arc', false]]);
    loadoutSetActive(c, c.loadouts![1].id);
    recomputeLoadout(c);
    expect(tenues(c)).toEqual([['arc', false]]);
    expect(rangees(c)).toEqual([['base', false], ['base', true]]);
  });

  it('arme à deux mains au set actif : l’objet `secondaire` de ce set n’est pas tenu, il est rangé', () => {
    const c = heros('grande-hache', 'dague');
    const lo = c.loadouts![0];
    loadoutSetSlot(c, lo.id, 'main', 'grande-hache');
    loadoutSetSlot(c, lo.id, 'secondaire', 'dague');
    recomputeLoadout(c);
    const { tenues: tenus, rangees: ranges } = armesDuCombattant(c);
    expect(tenus.map(({ arme }) => [arme.subType, armeDeDessin(arme).hands])).toEqual([['deux-mains', 2]]);
    expect(ranges.map((w) => [w.subType, armeDeDessin(w).hands])).toEqual([['base', 1]]);
  });

  it('une machine à Équipe équipée (ADE II 8 l.233) n’entre dans aucun set : ni tenue, ni rangée', () => {
    const c = heros('arme-simple', 'baliste');
    expect(c.loadouts!.map((lo) => lo.main)).toEqual(['arme-simple', undefined]);
    expect(tenues(c)).toEqual([['base', false]]);
    expect(rangees(c)).toEqual([]);
  });

  it('un set inactif qui désigne une machine à Équipe (état de sauvegarde, sans recalcul) : la machine n’est pas rangée', () => {
    const c = porteur({
      kind: 'heros', items: [{ ...porte('arme-simple'), uid: 'arme-simple' }, { ...porte('baliste'), uid: 'baliste' }],
      loadouts: [{ id: 'a', main: 'arme-simple' }, { id: 'b', main: 'baliste' }], activeLoadoutId: 'a',
    });
    expect(rangees(c)).toEqual([['base', false]]);
  });

  it('un statbloc sans set n’a aucune arme rangée', () => {
    expect(armesDuCombattant(spawnEnemy({ presetCreature: findCreatureById('orc')!, presetId: 'orc' }, 'orc-3', { x: 0, y: 0 })).rangees).toEqual([]);
  });
});

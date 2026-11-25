import { describe, expect, it } from 'vitest';
import { findCreatureById, findTrappingById, traits } from '../data';
import { setDataset } from '../data/overrides';
import { creatureToCombatant, spawnEnemy, statblockToCombatant } from '../noyau/monde/spawn';
import { removeActiveEffects } from './conditions';
import { makeRNG } from './dice';
import { idsDeTest } from './idsDeTest.testkit';
import {
  apparencesCandidates,
  choisirLaMunition,
  endommagerLArmeTenue,
  estUneVraieArme,
  itemFromTrappingById,
  lacherLArme,
  laisserTomber,
  loadWeapon,
  recomputeLoadout,
  setReloadProgress,
} from './items';
import { applyOps } from './ops';
import { entreeEnRencontre, sortieDeRencontre } from './persistence';
import type { Combatant } from './types';
import { loadRegister, weaponLoaded } from './weaponLoad';

const contexte = () => ({ rng: makeRNG(1), idNeuf: idsDeTest, location: 'brasD' as const });
const relire = (c: Combatant): Combatant => JSON.parse(JSON.stringify(c)) as Combatant;

describe('état des armes de Trait', () => {
  it('l’arme de profil lâchée ne revient ni au recompte ni au retour de rencontre (LDB 62 l.28)', () => {
    const ours = creatureToCombatant(findCreatureById('ours')!, 'ours');
    const combat = entreeEnRencontre(ours, { lignes: [], faits: [] });
    const tenue = combat.weapons.find(estUneVraieArme)!;
    const morsure = combat.weapons.find((w) => w.attackKind === 'morsure')!;
    lacherLArme(combat, morsure);
    expect(combat.weapons).toContain(morsure);

    applyOps(combat, [{ op: 'disarm' }], contexte());
    expect(combat.weapons.some(estUneVraieArme)).toBe(false);
    const sorti = sortieDeRencontre(ours, relire(combat), { lignes: [], faits: [] });
    expect(sorti.weapons.some((w) => w.uid === tenue.uid)).toBe(false);
    recomputeLoadout(sorti);
    expect(sorti.weapons.some((w) => w.uid === tenue.uid)).toBe(false);
    expect(sorti.weapons).toEqual(expect.arrayContaining([
      expect.objectContaining({ builtinId: 'mains-nues' }),
      expect.objectContaining({ uid: morsure.uid, natural: true }),
    ]));
  });

  it('le retour d’une rencontre retire aussi l’objet réellement perdu du porteur mixte', () => {
    const h = statblockToCombatant({
      type: 'statblock', label: 'Combattant', char: { force: 39, endurance: 32 }, traits: [{ id: 'arme', value: 7 }],
    }, 'combattant');
    const epee = itemFromTrappingById('arme-simple', idsDeTest)!;
    epee.equipped = true;
    h.items = [epee];
    recomputeLoadout(h);

    const c = entreeEnRencontre(h, { lignes: [], faits: [] });
    const armeDeTrait = c.weapons.find((arme) => arme.uid !== epee.uid && estUneVraieArme(arme))!;
    const tenue = c.weapons.find((arme) => arme.uid === epee.uid)!;
    expect(laisserTomber(c, tenue, idsDeTest)?.uid).toBe(epee.uid);
    lacherLArme(c, armeDeTrait);

    const sorti = sortieDeRencontre(h, c, { lignes: [], faits: [] });
    expect(sorti.items).toEqual([]);
    expect(sorti.weapons).toEqual([expect.objectContaining({ builtinId: 'mains-nues' })]);
  });

  it('le poing de fer résiste au désarmement comme objet et comme arme cataloguée de Trait (ADE II 02 l.695)', () => {
    const sb = { type: 'statblock' as const, label: 'Ogre', char: { force: 50, endurance: 50 } };
    const parTrait = statblockToCombatant({ ...sb, traits: [{ id: 'arme', arg: 'poing-de-fer', value: 8 }] }, 'trait');
    const parObjet = statblockToCombatant(sb, 'objet');
    parObjet.items = [{ ...itemFromTrappingById('poing-de-fer', idsDeTest)!, equipped: true }];
    recomputeLoadout(parObjet);

    for (const c of [parTrait, parObjet]) {
      const uid = c.weapons.find((arme) => arme.trappingId === 'poing-de-fer')!.uid;
      applyOps(c, [{ op: 'disarm' }], contexte());
      recomputeLoadout(c);
      expect(c.weapons.find((arme) => arme.trappingId === 'poing-de-fer')?.uid).toBe(uid);
    }
  });

  it('la conversion d’une arbalète de Trait emporte sa charge et son usure avec un uid neuf (#4330)', () => {
    const c = statblockToCombatant({
      type: 'statblock', label: 'Tireur', char: { 'capacite-de-tir': 43, force: 39, endurance: 32 },
      traits: [{ id: 'a-distance', arg: 'arbalete', value: 9 }, { id: 'a-distance', arg: 'arbalete', value: 9 }],
    }, 'tireur');
    const carreaux = itemFromTrappingById('carreau', idsDeTest)!;
    c.items = [carreaux];
    recomputeLoadout(c);
    const [premiere, seconde] = c.weapons.filter((w) => w.trappingId === 'arbalete');

    expect(endommagerLArmeTenue(c, { ...seconde })).toBe('usee');
    choisirLaMunition(findTrappingById, c, seconde, carreaux.uid);
    setReloadProgress(c, seconde, 1);
    expect(loadRegister(c, seconde).reloadProgress).toBe(1);
    loadWeapon(findTrappingById, c, seconde);
    expect(weaponLoaded(c, premiere)).toBe(false);
    expect(c.liveTraits?.find((t) => t.uid === seconde.uid)?.etatDArme?.loaded).toBeUndefined();

    const retrouve = relire(c);
    expect(laisserTomber(retrouve, premiere, idsDeTest)?.damageTaken).toBeUndefined();
    recomputeLoadout(retrouve);
    const arme = retrouve.weapons.find((w) => w.trappingId === 'arbalete')!;
    expect(arme.uid).toBe(seconde.uid);
    expect(arme.damageTaken).toBe(1);
    expect(weaponLoaded(retrouve, arme)).toBe(true);

    const objet = laisserTomber(retrouve, arme, idsDeTest)!;
    expect(objet.uid).not.toBe(arme.uid);
    expect(objet).toMatchObject({
      trappingId: 'arbalete', loaded: true, reloadProgress: 0,
      ammoUid: carreaux.uid, loadedAmmoUid: carreaux.uid, damageTaken: 1,
    });
    recomputeLoadout(retrouve);
    expect(retrouve.weapons.some((w) => w.trappingId === 'arbalete')).toBe(false);
    expect(laisserTomber(retrouve, arme, idsDeTest)).toBeUndefined();
  });

  it('deux octrois de même source expirent chacun avec leur instance après relecture', () => {
    const c = statblockToCombatant({ type: 'statblock', label: 'Tireur', char: { force: 39, endurance: 32 } }, 'tireur');
    const ctx = { ...contexte(), source: { kind: 'sort' as const, id: 'fixture' } };
    for (const durationRounds of [1, 2]) {
      applyOps(c, [{ op: 'grantTrait', trait: { id: 'a-distance', arg: 'arbalete', value: 9 }, durationRounds }], ctx);
    }
    const [premiere, seconde] = c.weapons.filter((w) => w.trappingId === 'arbalete');
    expect(endommagerLArmeTenue(c, seconde)).toBe('usee');
    const retrouve = relire(c);
    removeActiveEffects(retrouve, (e) => e.duration.scale === 'rounds' && e.duration.left === 1);
    expect(retrouve.weapons.some((w) => w.uid === premiere.uid)).toBe(false);
    expect(retrouve.weapons.find((w) => w.uid === seconde.uid)?.damageTaken).toBe(1);
    removeActiveEffects(retrouve, (e) => e.duration.scale === 'rounds' && e.duration.left === 2);
    expect(retrouve.weapons.some((w) => w.trappingId === 'arbalete')).toBe(false);
  });

  it('expirer une Armure ne réordonne pas les armes de profil et les armes accordées', () => {
    const c = creatureToCombatant(findCreatureById('ours')!, 'ours');
    applyOps(c, [{ op: 'grantNaturalWeapon', label: 'Crocs nouveaux', damage: 1 }], contexte());
    const avant = c.weapons.map((arme) => arme.uid);
    applyOps(c, [{ op: 'grantTrait', trait: { id: 'armure', value: 1 }, durationRounds: 1 }], contexte());
    removeActiveEffects(c, (e) => e.duration.scale === 'rounds' && e.duration.left === 1);
    expect(c.weapons.map((arme) => arme.uid)).toEqual(avant);
  });

  it('l’Indice de Tentacules et son compte résistent à l’ajout d’un objet (LDB 85 l.405)', () => {
    const c = creatureToCombatant(findCreatureById('pieuvre-des-tourbieres')!, 'pieuvre');
    const porte = () => c.weapons.filter((w) => w.attackKind === 'tentacules');
    const uid = porte()[0]?.uid;
    const tentacules = { uid, natural: true, damage: { plusBF: false, flat: 9, bfInclus: true } };
    expect(porte()).toEqual([expect.objectContaining(tentacules)]);
    c.items = [itemFromTrappingById('chemise-de-mailles', idsDeTest)!];
    recomputeLoadout(c);
    expect(porte()).toEqual([expect.objectContaining(tentacules)]);
    expect(c.traits?.find((t) => t.id === 'tentacules')?.count).toBe(8);
  });

  it('les passifs d’arme indépendants sont projetés à l’octroi, au recompte et retirés à l’expiration', () => {
    const imprimes = [...traits];
    setDataset('traits', imprimes.map((t) => t.id !== 'coriace' ? t : {
      ...t,
      passive: [
        ...t.passive ?? [],
        { op: 'grantNaturalWeapon', label: 'Morsure de sonde', damage: 4, plusBF: false, attackKind: 'morsure' },
        { op: 'grantNaturalWeapon', label: 'Cornes de sonde', damage: 1, subType: { id: 'base' }, attackKind: 'cornes' },
      ],
    }));
    try {
      const c = statblockToCombatant({ type: 'statblock', label: 'Testeur', char: { force: 39, endurance: 32 } }, 'testeur');
      const existantes = c.weapons.map((arme) => arme.uid);
      applyOps(c, [{ op: 'grantTrait', trait: { id: 'coriace' }, durationRounds: 1 }], contexte());
      const armes = () => c.weapons.filter((arme) => arme.source?.id === 'coriace');
      expect(armes()).toEqual([
        expect.objectContaining({ attackKind: 'morsure', damage: { plusBF: false, flat: 4, bare: undefined } }),
        expect.objectContaining({ attackKind: 'cornes', subType: 'base', damage: { plusBF: true, flat: 1, bare: undefined } }),
      ]);
      const uids = armes().map((arme) => arme.uid);
      expect(new Set(uids).size).toBe(2);
      recomputeLoadout(c);
      expect(armes().map((arme) => arme.uid)).toEqual(uids);
      removeActiveEffects(c, (e) => e.duration.scale === 'rounds' && e.duration.left === 1);
      expect(c.weapons.map((arme) => arme.uid)).toEqual(existantes);
    } finally {
      setDataset('traits', imprimes);
    }
  });

  it('l’apparence d’auteur suit une arme de Trait devenue objet', () => {
    const c = spawnEnemy({ statblock: {
      type: 'statblock', label: 'Fantassin', char: { force: 39, endurance: 32 },
      traits: [{ id: 'arme', arg: 'arme-simple', value: 7 }],
    } }, 'fantassin', undefined, { appearance: { apparencesObjets: { 'arme-simple': { id: 'hache_naine' } } } });
    const arme = () => c.weapons.find((w) => w.trappingId === 'arme-simple')!;
    const apparence = ['hache_naine', 'hache'];
    expect(apparencesCandidates(arme())).toEqual(apparence);
    recomputeLoadout(c);
    expect(apparencesCandidates(arme())).toEqual(apparence);
    const objet = laisserTomber(c, arme(), idsDeTest)!;
    expect(apparencesCandidates(objet)).toEqual(apparence);
  });
});

import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { checkBattleOver, finishCombatEnd, runEnemyAI } from './combatFlow';
import { chebyshev } from '../engine/grid';
import { initialNet } from './etat';
import { siegeDe } from './sieges';
import { mountablesNear } from './mount';
import { freeTilesNear, inscrireEnBataille } from './summonFlow';
import { spawnEnemy } from './monde/spawn';
import { footprintN, footprintTiles } from './monde/footprint';
import { tileKey } from './monde/path';
import type { Combatant } from '../engine/types';
import { LOCALISATIONS_DE_COUP } from '../engine/types';
import { armourPhysiqueAt } from '../engine/armourBypass';
import { tableTotale } from '../lib/tableTotale';
import { createHero } from '../engine/character';
import { dotationsDuPnj } from '../engine/trappingChoices';
import { testScene } from '../scenes/test-fixture';
import { buildEncounter } from './monde/encounterAuthoring';
import { inBattleId } from './monde/combatants';
import { validateScene } from './validateScene';
import { emptyScene } from './monde/scene';
import { tientDebout } from './monde/combatGeometry';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import type { Scene } from './monde/scene';
import type { Possession } from '../engine/possession';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * #621 — la monture de COMBAT du héros (`heroCombatMount`, `accepteUnCavalier`, LDB 85 l.112) est INDÉPENDANTE du profil
 * EDOC de voyage (`heroMount`/`partyMounts`, qui exige `montures.json` : le `cheval` LDB n'en a pas).
 * Spawnée en ALLIÉ `id = possession.uid`, appairée (`mountUp`).
 */

function makeHero() {
  return createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
}

function startFixtureCombat(hero: ReturnType<typeof makeHero>, possessions: Possession[]) {
  banc.setState({ party: [hero], battle: null });
  banc.getState().lancerLaScene(testScene()); // reset qui vide `possessions` (seedStartingPossessions) — injecter APRÈS
  banc.setState({ possessions });
  banc.getState().lancerLeCombat('enc-mutants');
}

describe('#621 — montures-possession spawnées en combat monté (LDB 14)', () => {
  it('un CHEVAL (LDB) avec-le-groupe, Dressé (Monture) appris, est spawné en allié, appairé au héros', () => {
    const hero = makeHero();
    const cheval: Possession = {
      uid: 'pos-cheval-1', ownerId: hero.id, nature: 'bete', ref: { id: 'cheval' }, learnedTraits: ['dresse-monture'],
      location: { kind: 'avec-le-groupe' }, items: [],
    };
    startFixtureCombat(hero, [cheval]);

    const battle = banc.getState().battle!;
    const mount = battle.combatants.find((c) => c.id === 'pos-cheval-1');
    expect(mount).toBeTruthy();
    expect(mount!.kind).toBe('heros');
    expect(mount!.riderId).toBe(hero.id);
    expect(mount!.mountable).toBe(true);
    const heroCombatant = battle.combatants.find((c) => c.id === hero.id)!;
    expect(heroCombatant.mountId).toBe('pos-cheval-1');
  });

  it('un cheval dont le héros est descendu hors combat entre en compagnon, sans cavalier, voisin de son maître et à son propre tour (#4804)', () => {
    const hero = makeHero();
    banc.setState({ party: [hero], battle: null });
    banc.getState().lancerLaScene(testScene());
    banc.setState({ possessions: [{ uid: 'pos-cheval-1', ownerId: hero.id, nature: 'bete', ref: { id: 'cheval' }, learnedTraits: ['dresse-monture'], location: { kind: 'avec-le-groupe' }, items: [] }] });
    banc.getState().quitterLaSelle('pos-cheval-1');
    expect(banc.getState().possessions[0], 'prémisse : il en est descendu').toMatchObject({ sansCavalier: true });
    banc.getState().lancerLeCombat('enc-mutants');

    const battle = banc.getState().battle!;
    const cavalier = inBattleId(battle, hero.id)!;
    const cheval = inBattleId(battle, 'pos-cheval-1')!;
    expect([cheval.kind, cheval.riderId, cavalier.mountId, cheval.mountable]).toEqual(['heros', undefined, undefined, true]);
    expect(chebyshev(cheval.pos!, cavalier.pos!), 'voisin de son maître').toBe(1);
    expect(battle.order).toContain(cheval.id);
  });

  it('une MULE (Belliqueuse absente de ses traits, Dressé (Monture) inné) est spawnée en allié', () => {
    const hero = makeHero();
    const mule: Possession = {
      uid: 'pos-mule-1', ownerId: hero.id, nature: 'bete', ref: { id: 'mule' },
      location: { kind: 'avec-le-groupe' }, items: [],
    };
    startFixtureCombat(hero, [mule]);

    const battle = banc.getState().battle!;
    const mount = battle.combatants.find((c) => c.id === 'pos-mule-1');
    expect(mount).toBeTruthy();
    expect(mount!.kind).toBe('heros');
    expect(mount!.riderId).toBe(hero.id);
    const heroCombatant = battle.combatants.find((c) => c.id === hero.id)!;
    expect(heroCombatant.mountId).toBe('pos-mule-1');
  });

  it('un HYPPOGRIFFE Belliqueux SANS Dressé (Monture) entre en compagnon, que personne ne monte (LDB 339 ; LDB 75 l.11)', () => {
    const hero = makeHero();
    const hippogriffe: Possession = {
      uid: 'pos-hippo-1', ownerId: hero.id, nature: 'bete', ref: { id: 'hyppogriffe' },
      location: { kind: 'avec-le-groupe' }, items: [],
    };
    startFixtureCombat(hero, [hippogriffe]);

    const battle = banc.getState().battle!;
    const hippo = inBattleId(battle, 'pos-hippo-1')!;
    expect([hippo.kind, hippo.riderId, hippo.mountable, inBattleId(battle, hero.id)!.mountId]).toEqual(['heros', undefined, undefined, undefined]);
    expect(battle.order).toContain(hippo.id);
  });

  it('cavalier SEUL hors d’action, monture encore vivante → DÉFAITE (une monture `mountable` ne compte pas comme héros vivant)', () => {
    const hero = makeHero();
    const cheval: Possession = {
      uid: 'pos-cheval-defaite', ownerId: hero.id, nature: 'bete', ref: { id: 'cheval' }, learnedTraits: ['dresse-monture'],
      location: { kind: 'avec-le-groupe' }, items: [],
    };
    startFixtureCombat(hero, [cheval]);

    const battle = banc.getState().battle!;
    const heroCombatant = battle.combatants.find((c) => c.id === hero.id)!;
    const mount = battle.combatants.find((c) => c.id === 'pos-cheval-defaite')!;
    expect(mount.dead).toBeFalsy(); // la monture VIT
    heroCombatant.dead = true; // le cavalier est hors d'action (`isOutOfAction`)
    banc.setState({ battle: { ...battle } });

    checkBattleOver(banc.getState, banc.setState);
    expect(banc.getState().battle!.over).toBe('defaite');
  });

  it('une bête à statbloc CUSTOM garde son tirage figé et ses traits appris (LDB 77 l.108, LDB 23 l.130)', () => {
    const hero = makeHero();
    const charsRolled = {
      'capacite-de-combat': 31, 'capacite-de-tir': 4, force: 42, endurance: 37, initiative: 23,
      agilite: 33, dexterite: 6, intelligence: 12, 'force-mentale': 9, sociabilite: 7,
    };
    const destrier: Possession = {
      uid: 'pos-destrier-custom', ownerId: hero.id, nature: 'bete',
      ref: { custom: { type: 'statblock', label: 'Destrier', char: { 'capacite-de-combat': 25, force: 40, endurance: 35, M: 8 }, traits: [{ id: 'belliqueux' }] } },
      charsRolled, learnedTraits: ['dresse-monture'],
      location: { kind: 'avec-le-groupe' }, items: [],
    };
    startFixtureCombat(hero, [destrier]);

    const mount = banc.getState().battle!.combatants.find((c) => c.id === 'pos-destrier-custom');
    expect(mount, 'Belliqueux mais Dressé (Monture) appris : montée en combat').toBeTruthy();
    expect(mount!.characteristics).toEqual(charsRolled);
    expect(mount!.traits?.map((t) => t.id)).toContain('dresse-monture');
  });

  it('une bête AU LIEU (pas avec le groupe), même chevauchable, n’est PAS spawnée en combat', () => {
    const hero = makeHero();
    const chevalEnPension: Possession = {
      uid: 'pos-cheval-2', ownerId: hero.id, nature: 'bete', ref: { id: 'cheval' },
      location: { kind: 'au-lieu', placeId: 'ecurie-x' }, items: [],
    };
    startFixtureCombat(hero, [chevalEnPension]);

    const battle = banc.getState().battle!;
    expect(battle.combatants.find((c) => c.id === 'pos-cheval-2')).toBeUndefined();
  });
});

/**
 * #4804 — la bête possédée « avec le groupe » qui ne porte pas son maître entre en compagnon : alliée, voisine de son
 * maître, à son propre tour d'Initiative, au siège de son maître. LDB 75 l.11 ; LDB 13 l.14
 */
function ratier() {
  return createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'ratier', label: 'R', seed: 1 });
}

/** Le Ratier humain lancé en scène (sa dotation pose son chien, `seedStartingPossessions`), puis en rencontre. */
function ratierEnRencontre(): { hero: ReturnType<typeof ratier>; chienUid: string } {
  const hero = ratier();
  banc.setState({ party: [hero], battle: null });
  banc.getState().lancerLaScene(testScene());
  const chien = banc.getState().possessions.find((p) => p.ownerId === hero.id && p.nature === 'bete' && 'id' in p.ref && p.ref.id === 'chien');
  expect(chien, 'prémisse : la dotation du Ratier pose son chien').toBeTruthy();
  banc.getState().lancerLeCombat('enc-mutants');
  return { hero, chienUid: chien!.uid };
}

/** Les cases tenues par l'empreinte de `c`. */
const casesDe = (c: Combatant): string[] => footprintTiles(c.pos!, footprintN(c)).map((t) => tileKey(t.x, t.y, c.pos!.z ?? 0));

describe('#4804 — la bête-compagnon entre en rencontre comme membre du groupe (LDB 75 l.11 ; LDB 13 l.14)', () => {
  it('Ratier humain et son chien : le chien est un allié non monté, voisin de son maître, à son propre tour', () => {
    const { hero, chienUid } = ratierEnRencontre();
    const battle = banc.getState().battle!;
    const chien = inBattleId(battle, chienUid)!;
    const maitre = inBattleId(battle, hero.id)!;
    expect([chien.kind, chien.riderId, chien.mountable, maitre.mountId]).toEqual(['heros', undefined, undefined, undefined]);
    expect(chebyshev(chien.pos!, maitre.pos!), 'voisin de son maître').toBe(1);
    expect(battle.order.filter((id) => id === chienUid), 'un tour d’Initiative à lui').toHaveLength(1);
  });

  it('tous les héros hors de combat, le chien debout : défaite, au constat comme à la clôture de la fin de combat', () => {
    for (const constat of [checkBattleOver, finishCombatEnd]) {
      const { hero, chienUid } = ratierEnRencontre();
      const battle = banc.getState().battle!;
      expect(inBattleId(battle, chienUid)!.dead, 'prémisse : le chien vit').toBeFalsy();
      inBattleId(battle, hero.id)!.dead = true;
      banc.setState({ battle: { ...battle } });
      constat(banc.getState, banc.setState);
      expect(banc.getState().battle!.over, constat.name).toBe('defaite');
    }
  });

  it('objectif « atteindre la zone » du groupe : le chien seul dans la zone ne l’atteint pas pour le groupe', () => {
    const { hero, chienUid } = ratierEnRencontre();
    const battle = banc.getState().battle!;
    const chien = inBattleId(battle, chienUid)!;
    const rect = { x: chien.pos!.x, y: chien.pos!.y, w: 1, h: 1 };
    banc.setState({ battle: { ...battle, victoryCondition: { type: 'reachZone', rect } } });
    expect(checkBattleOver(banc.getState, banc.setState), 'le chien dans la zone').toBe(false);
    const b = banc.getState().battle!;
    inBattleId(b, hero.id)!.pos = { x: rect.x, y: rect.y };
    banc.setState({ battle: { ...b } });
    expect(checkBattleOver(banc.getState, banc.setState), 'son maître dans la zone').toBe(true);
  });

  it('coop : le compagnon est au siège de son maître', () => {
    const { hero, chienUid } = ratierEnRencontre();
    banc.setState({ net: { ...initialNet(), mode: 'hote', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Invité' }, ownership: { [hero.id]: 1 }, slots: [1, 0, 0, 0] } });
    expect([siegeDe(banc.getState(), hero.id), siegeDe(banc.getState(), chienUid)]).toEqual([1, 1]);
  });

  it('deux compagnons ne partagent aucune case, ni entre eux ni avec leur maître (empreinte N×N)', () => {
    const hero = makeHero();
    startFixtureCombat(hero, [
      { uid: 'pos-cheval-pied', ownerId: hero.id, nature: 'bete', ref: { id: 'cheval' }, learnedTraits: ['dresse-monture'], location: { kind: 'avec-le-groupe' }, items: [], sansCavalier: true },
      { uid: 'pos-chien-1', ownerId: hero.id, nature: 'bete', ref: { id: 'chien' }, location: { kind: 'avec-le-groupe' }, items: [] },
    ]);
    const battle = banc.getState().battle!;
    const tenues = [hero.id, 'pos-cheval-pied', 'pos-chien-1'].map((id) => casesDe(inBattleId(battle, id)!));
    expect(footprintN(inBattleId(battle, 'pos-cheval-pied')!), 'prémisse : le cheval tient plus d’une case').toBeGreaterThan(1);
    expect(new Set(tenues.flat()).size, JSON.stringify(tenues)).toBe(tenues.flat().length);
  });

  it('le compagnon naît du côté du mur où se tient son maître, sur une case qu’il joint à pied', () => {
    const scene: Scene = { ...emptyScene('mur', 8, 6), walls: Array.from({ length: 6 }, (_, y) => ({ x: 2, y, side: 'E' as const })) };
    const maitre = combattantDeTest({ id: 'h', kind: 'heros', pos: { x: 3, y: 2 } });
    const chien = combattantDeTest({ id: 'c', kind: 'heros', size: 'petite' });
    expect(tientDebout(emptyScene('nu', 8, 6), maitre.pos!, new Set())(2, 1), 'prémisse : sans le mur, la case voisine à l’ouest est joignable').toBe(true);
    const [pos] = freeTilesNear(scene, { combatants: [maitre], zones: [] }, maitre.pos!, 1, chien);
    expect(chebyshev(pos, maitre.pos!)).toBe(1);
    expect(pos.x, JSON.stringify(pos)).toBeGreaterThan(2);
  });

  it('une invocation alliée ne monte pas le cheval d’un héros démonté ; son propriétaire le remonte', () => {
    const hero = makeHero();
    startFixtureCombat(hero, [
      { uid: 'pos-cheval-pied', ownerId: hero.id, nature: 'bete', ref: { id: 'cheval' }, learnedTraits: ['dresse-monture'], location: { kind: 'avec-le-groupe' }, items: [], sansCavalier: true },
    ]);
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const battle = banc.getState().battle!;
    const cheval = inBattleId(battle, 'pos-cheval-pied')!;
    const invoque = spawnEnemy({ ref: 'mutant' }, 'invocation-alliee', undefined);
    invoque.kind = 'heros';
    invoque.summon = { byId: hero.id };
    invoque.pos = freeTilesNear(banc.getState().scene!, battle, cheval.pos!, 1, invoque)[0];
    inscrireEnBataille(battle, invoque, hero.id);
    banc.setState({ battle: { ...battle, acted: false, movementUsed: 0, turn: battle.order.indexOf(invoque.id), action: null } });
    expect(mountablesNear(banc.getState(), banc.getState().battle!, banc.getState().scene, invoque), 'le cheval n’est pas offert à l’invocation').toEqual([]);
    runEnemyAI(banc.getState, banc.setState, invoque.id);
    banc.abandonner();
    expect(inBattleId(banc.getState().battle!, invoque.id)!.mountId).toBeUndefined();

    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, acted: false, movementUsed: 0, turn: b.order.indexOf(hero.id), action: null } });
    expect(mountablesNear(banc.getState(), banc.getState().battle!, banc.getState().scene, inBattleId(b, hero.id)!).map((m) => m.id)).toEqual([cheval.id]);
    banc.getState().monterEnSelle(cheval.id);
    expect(inBattleId(banc.getState().battle!, hero.id)!.mountId).toBe(cheval.id);
  });
});

/**
 * Combat monté AUTHORÉ (`LDB 14 l.175-187`) — la voie de l'auteur de scène : un membre de rencontre
 * porte `mount: true` (monture rideable), un autre `ridesEntityId` (pré-monté sur elle). Scène
 * CONSTRUITE pour ce banc : le départ du groupe de la fixture + une paire cavalier/monture.
 */
const ENC_CAVALERIE = 'enc-cavalerie';

function cavalerieScene(preMonte: boolean): { scene: Scene; montureId: string; cavalierId: string } {
  const enc = buildEncounter({
    id: ENC_CAVALERIE,
    enemies: [
      { creature: { id: 'cheval' }, pos: { x: 16, y: 11 }, mount: true, optionals: [{ id: 'dresse-monture' }] },
      { creature: { id: 'mutant' }, pos: { x: 19, y: 11 }, ...(preMonte ? { rides: 0 } : {}) },
    ],
  });
  const scene: Scene = {
    ...testScene(),
    id: 'test-cavalerie',
    entities: [...testScene().entities.filter((e) => e.kind === 'heroStart'), ...enc.entities],
    encounters: [enc.encounter],
  };
  return { scene, montureId: enc.entities[0].id, cavalierId: enc.entities[1].id };
}

function startCavalerie(scene: Scene) {
  banc.setState({ party: [makeHero()], battle: null });
  banc.getState().lancerLaScene(scene);
  banc.getState().lancerLeCombat(ENC_CAVALERIE);
  return banc.getState().battle!;
}

describe('Combat monté AUTHORÉ — `mount` / `ridesEntityId` au spawn (LDB 14 l.175-187)', () => {
  it('couple pré-monté : deux Combattants DISTINCTS (l.182), appairés, sur la case de la monture', () => {
    const { scene, montureId, cavalierId } = cavalerieScene(true);
    const battle = startCavalerie(scene);

    const ids = battle.combatants.map((c) => c.id);
    expect(ids).toContain(montureId);
    expect(ids).toContain(cavalierId);
    const monture = battle.combatants.find((c) => c.id === montureId)!;
    const cavalier = battle.combatants.find((c) => c.id === cavalierId)!;
    expect(monture.mountable).toBe(true);
    expect(monture.riderId).toBe(cavalierId);
    expect(cavalier.mountId).toBe(montureId);
    expect(cavalier.pos).toEqual(monture.pos);
  });

  it('membre `mount` SANS `ridesEntityId` : la monture reste chevauchable, personne ne la monte', () => {
    const { scene, montureId, cavalierId } = cavalerieScene(false);
    const battle = startCavalerie(scene);

    const monture = battle.combatants.find((c) => c.id === montureId)!;
    const cavalier = battle.combatants.find((c) => c.id === cavalierId)!;
    expect(monture.mountable).toBe(true);
    expect(monture.riderId).toBeUndefined();
    expect(cavalier.mountId).toBeUndefined();
  });

  it('`ridesEntityId` vers une entité ABSENTE : `validateScene` la dit absente des montures de la rencontre, et le spawn rend les deux combattants sans appairage', () => {
    const { scene, montureId, cavalierId } = cavalerieScene(false);
    const membres = scene.encounters[0].members!;
    membres[1] = { ...membres[1], ridesEntityId: { id: 'monture-absente' } };

    const fautes = validateScene([scene]).filter((w) => w.scope === 'encounter' && w.refId === ENC_CAVALERIE);
    expect(fautes.some((f) => f.level === 'error' && f.message.includes('« monture-absente » est absent du catalogue des montures de la rencontre'))).toBe(true);

    const battle = startCavalerie(scene);
    const monture = battle.combatants.find((c) => c.id === montureId)!;
    const cavalier = battle.combatants.find((c) => c.id === cavalierId)!;
    expect(monture.riderId).toBeUndefined();
    expect(cavalier.mountId).toBeUndefined();
    expect(monture.mountable).toBe(true); // `mount: true` du membre tient : seul l'appairage manque
  });

  it('`ridesEntityId` vers une monture qui refuse le cavalier (`accepteUnCavalier`, LDB 85 l.112) : pas d’appairage', () => {
    const enc = buildEncounter({
      id: ENC_CAVALERIE,
      enemies: [
        { creature: { id: 'chien' }, pos: { x: 16, y: 11 }, mount: true },
        { creature: { id: 'mutant' }, pos: { x: 19, y: 11 }, rides: 0 },
      ],
    });
    const scene: Scene = {
      ...testScene(),
      id: 'test-cavalerie',
      entities: [...testScene().entities.filter((e) => e.kind === 'heroStart'), ...enc.entities],
      encounters: [enc.encounter],
    };
    const battle = startCavalerie(scene);
    const chien = battle.combatants.find((c) => c.id === enc.entities[0].id)!;
    const mutant = battle.combatants.find((c) => c.id === enc.entities[1].id)!;
    expect(chien.riderId).toBeUndefined();
    expect(mutant.mountId).toBeUndefined();
  });
});

describe('Barde authorée au cavalier : le couple pré-monté la passe à sa monture (AA 09 l.184 ; #4135)', () => {
  it('la barde du cavalier, portée par le demigriffon, s’ajoute à son Trait Armure', () => {
    const enc = buildEncounter({
      id: ENC_CAVALERIE,
      enemies: [
        { creature: { id: 'demigriffon' }, pos: { x: 16, y: 11 }, mount: true, optionals: [{ id: 'dresse-monture' }] },
        { creature: { id: 'mutant' }, pos: { x: 19, y: 11 }, rides: 0, inventaire: { barde: false } },
      ],
    });
    const scene: Scene = { ...testScene(), id: 'test-barde', entities: [...testScene().entities.filter((e) => e.kind === 'heroStart'), ...enc.entities], encounters: [enc.encounter] };
    const battle = startCavalerie(scene);

    const monture = battle.combatants.find((c) => c.id === enc.entities[0].id)!;
    const cavalier = battle.combatants.find((c) => c.id === enc.entities[1].id)!;
    expect(tableTotale(LOCALISATIONS_DE_COUP, (loc) => armourPhysiqueAt(monture, loc))).toEqual({ tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 1, jambeD: 1 });
    expect(monture.items?.map((i) => [i.trappingId, i.equipped])).toEqual([['barde', true]]);
    expect(cavalier.items).toEqual([]);
  });
});

describe('Montures du Chevalier commandeur (LDB 08 l.1130, l.1140, l.1148 ; #773, #4355)', () => {
  const destrier = 'destrier-cheval-de-guerre-lourd';

  it('la dotation cumulée de Chevalier 3 liste le cheval de monte et le destrier', () => {
    const betes = dotationsDuPnj('chevalier', 3).filter((ref) => 'type' in ref && ref.type === 'creature');
    expect(betes).toEqual([
      { id: 'cheval-de-monte', type: 'creature' },
      { id: destrier, type: 'creature' },
    ]);
  });

  it.each([
    { situation: 'sans monture posée', monturePosee: false, preMonte: false },
    { situation: 'avec un destrier à côté', monturePosee: true, preMonte: false },
    { situation: 'avec un destrier apparié', monturePosee: true, preMonte: true },
  ])('fait apparaître le Chevalier $situation', ({ monturePosee, preMonte }) => {
    const enc = buildEncounter({
      id: ENC_CAVALERIE,
      enemies: [
        ...(monturePosee ? [{ creature: { id: destrier }, pos: { x: 16, y: 11 }, mount: true }] : []),
        { creature: { id: 'mutant' }, pos: { x: 19, y: 11 }, ...(preMonte ? { rides: 0 } : {}) },
      ],
    });
    const cavalierAuteur = enc.entities[enc.entities.length - 1]!;
    cavalierAuteur.carrieres = { chevalier: 3 };
    const decor = testScene();
    const scene: Scene = {
      ...decor,
      entities: [...decor.entities.filter((entite) => entite.kind === 'heroStart'), ...enc.entities],
      encounters: [enc.encounter],
    };

    const battle = startCavalerie(scene);
    expect(battle.combatants.filter((c) => c.kind === 'ennemi').map((c) => c.id).sort()).toEqual(
      enc.entities.map((entite) => entite.id).sort(),
    );
    const cavalier = inBattleId(battle, cavalierAuteur.id)!;
    const monture = inBattleId(battle, monturePosee ? enc.entities[0].id : undefined);
    expect(cavalier).toMatchObject({ career: 'chevalier', careerLevel: 3 });
    expect(banc.getState().possessions.filter((possession) => possession.ownerId === cavalier.id)).toEqual([]);
    expect(cavalier.mountId).toBe(preMonte ? monture?.id : undefined);
    expect(monture?.riderId).toBe(preMonte ? cavalier.id : undefined);
    expect(monture?.mountable).toBe(monturePosee ? true : undefined);
    expect(cavalier.pos).toMatchObject(preMonte ? enc.entities[0].pos : cavalierAuteur.pos);
    expect(cavalier.items?.filter((item) => item.trappingId === 'barde')).toEqual(
      preMonte ? [] : [expect.objectContaining({ equipped: false })],
    );
    expect(monture?.items?.filter((item) => item.trappingId === 'barde') ?? []).toEqual(
      preMonte ? [expect.objectContaining({ equipped: true })] : [],
    );
  });
});

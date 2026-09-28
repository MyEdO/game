import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { checkBattleOver } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { buildEncounter } from './encounterAuthoring';
import { validateScene } from './validateScene';
import type { Scene } from './scene';
import type { Possession } from '../engine/possession';

/**
 * #621 — la monture de COMBAT du héros (`heroCombatMount`) accepte un cavalier si elle n'est PAS
 * Belliqueuse OU a Dressé (Monture) (LDB 339 l.… ; `possessionCombatRideable`) — INDÉPENDANT du profil
 * EDOC de voyage (`heroMount`/`partyMounts`, qui exige `montures.json` : le `cheval` LDB n'en a pas).
 * Spawnée en ALLIÉ `id = possession.uid`, appairée (`mountUp`).
 */

function makeHero() {
  return createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
}

function startFixtureCombat(hero: ReturnType<typeof makeHero>, possessions: Possession[]) {
  useGame.setState({ party: [hero], battle: null });
  useGame.getState().startScene(testScene()); // reset qui vide `possessions` (seedStartingPossessions) — injecter APRÈS
  useGame.setState({ possessions });
  useGame.getState().startCombat('enc-mutants');
}

describe('#621 — montures-possession spawnées en combat monté (LDB 14)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('un CHEVAL (LDB, non Belliqueux) avec-le-groupe est spawné en allié, appairé au héros', () => {
    const hero = makeHero();
    const cheval: Possession = {
      uid: 'pos-cheval-1', ownerId: hero.id, nature: 'bete', ref: { creatureId: 'cheval' },
      location: { kind: 'avec-le-groupe' }, items: [],
    };
    startFixtureCombat(hero, [cheval]);

    const battle = useGame.getState().battle!;
    const mount = battle.combatants.find((c) => c.id === 'pos-cheval-1');
    expect(mount).toBeTruthy();
    expect(mount!.kind).toBe('hero');
    expect(mount!.riderId).toBe(hero.id);
    expect(mount!.mountable).toBe(true);
    const heroCombatant = battle.combatants.find((c) => c.id === hero.id)!;
    expect(heroCombatant.mountId).toBe('pos-cheval-1');
  });

  it('une MULE (Belliqueuse absente de ses traits, Dressé (Monture) inné) est spawnée en allié', () => {
    const hero = makeHero();
    const mule: Possession = {
      uid: 'pos-mule-1', ownerId: hero.id, nature: 'bete', ref: { creatureId: 'mule' },
      location: { kind: 'avec-le-groupe' }, items: [],
    };
    startFixtureCombat(hero, [mule]);

    const battle = useGame.getState().battle!;
    const mount = battle.combatants.find((c) => c.id === 'pos-mule-1');
    expect(mount).toBeTruthy();
    expect(mount!.kind).toBe('hero');
    expect(mount!.riderId).toBe(hero.id);
    const heroCombatant = battle.combatants.find((c) => c.id === hero.id)!;
    expect(heroCombatant.mountId).toBe('pos-mule-1');
  });

  it('un HYPPOGRIFFE Belliqueux SANS Dressé (Monture) n’est PAS spawné en combat (LDB 339)', () => {
    const hero = makeHero();
    const hippogriffe: Possession = {
      uid: 'pos-hippo-1', ownerId: hero.id, nature: 'bete', ref: { creatureId: 'hyppogriffe' },
      location: { kind: 'avec-le-groupe' }, items: [],
    };
    startFixtureCombat(hero, [hippogriffe]);

    const battle = useGame.getState().battle!;
    expect(battle.combatants.find((c) => c.id === 'pos-hippo-1')).toBeUndefined();
    const heroCombatant = battle.combatants.find((c) => c.id === hero.id)!;
    expect(heroCombatant.mountId).toBeUndefined();
  });

  it('cavalier SEUL hors d’action, monture encore vivante → DÉFAITE (une monture `mountable` ne compte pas comme héros vivant)', () => {
    const hero = makeHero();
    const cheval: Possession = {
      uid: 'pos-cheval-defaite', ownerId: hero.id, nature: 'bete', ref: { creatureId: 'cheval' },
      location: { kind: 'avec-le-groupe' }, items: [],
    };
    startFixtureCombat(hero, [cheval]);

    const battle = useGame.getState().battle!;
    const heroCombatant = battle.combatants.find((c) => c.id === hero.id)!;
    const mount = battle.combatants.find((c) => c.id === 'pos-cheval-defaite')!;
    expect(mount.dead).toBeFalsy(); // la monture VIT
    heroCombatant.dead = true; // le cavalier est hors d'action (`isOutOfAction`)
    useGame.setState({ battle: { ...battle } });

    checkBattleOver(useGame.getState, useGame.setState);
    expect(useGame.getState().battle!.over).toBe('defeat');
  });

  it('une bête AU LIEU (pas avec le groupe), même chevauchable, n’est PAS spawnée en combat', () => {
    const hero = makeHero();
    const chevalEnPension: Possession = {
      uid: 'pos-cheval-2', ownerId: hero.id, nature: 'bete', ref: { creatureId: 'cheval' },
      location: { kind: 'au-lieu', placeId: 'ecurie-x' }, items: [],
    };
    startFixtureCombat(hero, [chevalEnPension]);

    const battle = useGame.getState().battle!;
    expect(battle.combatants.find((c) => c.id === 'pos-cheval-2')).toBeUndefined();
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
      { ref: 'cheval', pos: { x: 16, y: 11 }, mount: true },
      { ref: 'mutant', pos: { x: 19, y: 11 }, ...(preMonte ? { rides: 0 } : {}) },
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
  useGame.setState({ party: [makeHero()], battle: null });
  useGame.getState().startScene(scene);
  useGame.getState().startCombat(ENC_CAVALERIE);
  return useGame.getState().battle!;
}

describe('Combat monté AUTHORÉ — `mount` / `ridesEntityId` au spawn (LDB 14 l.175-187)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

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

  it('`ridesEntityId` vers une entité ABSENTE : `validateScene` nomme la monture inexistante, et le spawn rend les deux combattants sans appairage', () => {
    const { scene, montureId, cavalierId } = cavalerieScene(false);
    const membres = scene.encounters[0].members!;
    membres[1] = { ...membres[1], ridesEntityId: 'monture-absente' };

    const fautes = validateScene([scene]).filter((w) => w.scope === 'encounter' && w.refId === ENC_CAVALERIE);
    expect(fautes.some((f) => f.level === 'error' && f.message.includes('monture-absente'))).toBe(true);

    const battle = startCavalerie(scene);
    const monture = battle.combatants.find((c) => c.id === montureId)!;
    const cavalier = battle.combatants.find((c) => c.id === cavalierId)!;
    expect(monture.riderId).toBeUndefined();
    expect(cavalier.mountId).toBeUndefined();
    expect(monture.mountable).toBe(true); // `mount: true` du membre tient : seul l'appairage manque
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { statblockToCombatant } from './spawn';
import { attackModifiers } from '../engine/combat';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { engage } from '../engine/engagement';
import { buildEncounter } from './encounterAuthoring';
import { testScene } from '../scenes/test-fixture';
import type { CustomStatblock, Scene } from './scene';
import type { Weapon } from '../engine/types';

// Nuée — Trait Nuée (LDB 85 l.251-253).
const bow: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] };

describe('Nuée — Trait Nuée (LDB 85 l.251-253)', () => {
  it('build au spawn : ×5 PB, +10 CC, immunité Psychologie, flag swarm', () => {
    const c = statblockToCombatant({ type: 'statblock', label: 'Nuée de rats', char: { 'capacite-de-combat': 35, force: 30, endurance: 30, B: 5 }, traits: [{ id: 'nuee' }, { id: 'taille', arg: 'Petite' }] }, 'x', { x: 0, y: 0 });
    expect(c.swarm).toBe(true);
    expect(c.psychImmune).toBe(true);
    expect(c.wounds.max).toBe(25); // 5 × 5 (PB d'une créature type)
    expect(c.characteristics['capacite-de-combat']).toBe(45); // 35 + 10
  });

  it('sans le trait : ni swarm ni ×5', () => {
    const c = statblockToCombatant({ type: 'statblock', label: 'Rat', char: { 'capacite-de-combat': 35, B: 5 }, traits: [{ id: 'taille', arg: 'Petite' }] }, 'x', { x: 0, y: 0 });
    expect(c.swarm).toBeUndefined();
    expect(c.wounds.max).toBe(5);
    expect(c.characteristics['capacite-de-combat']).toBe(35);
  });

  it('+40 au tir CONTRE une nuée, et la Taille de la cible est ignorée', () => {
    const swarm = statblockToCombatant({ type: 'statblock', label: 'Nuée', char: { B: 5 }, traits: [{ id: 'nuee' }, { id: 'taille', arg: 'Petite' }] }, 's', { x: 0, y: 0 });
    const shooter = statblockToCombatant({ type: 'statblock', label: 'Tireur', char: {} }, 't', { x: 5, y: 0 });
    const mods = attackModifiers(shooter, swarm, bow, { kind: 'ranged' });
    expect(mods.some((m) => m.label === 'Nuée (tir)' && m.value === 40)).toBe(true);
    expect(mods.some((m) => m.label.startsWith('Taille (cible)'))).toBe(false); // Taille ignorée (l.253)
  });
});

/**
 * Volet SCÈNE : la Nuée d'un statbloc d'AUTEUR (`SceneEntity.statblock`) enrôlée dans une rencontre,
 * spawnée par `startCombat`, puis jouée par le store — build, perte de 1 PB par Round aux Engagés,
 * départ libre d'un Engagement (LDB 85 l.251-253). Scène CONSTRUITE pour ce banc.
 */
const ENC_NUEE = 'enc-nuee';
/** Points de Blessure d'UNE créature type composant la nuée, et sa CC de base : les attendus en DÉRIVENT. */
const PB_UNITE = 5;
const CC_UNITE = 35;

function nueeStatblock(avecTrait: boolean): CustomStatblock {
  return {
    type: 'statblock',
    label: 'Nuée de rats',
    char: { 'capacite-de-combat': CC_UNITE, force: 30, endurance: 30, B: PB_UNITE },
    traits: [...(avecTrait ? [{ id: 'nuee' }] : []), { id: 'taille', arg: 'Petite' }],
  };
}

/** Scène : départ du groupe + la Nuée (statbloc d'auteur) + un mutant TÉMOIN, Engagé avec le héros
 *  mais jamais avec la Nuée. */
function nueeScene(avecTrait = true): { scene: Scene; nueeId: string; temoinId: string } {
  const enc = buildEncounter({
    id: ENC_NUEE,
    enemies: [
      { statblock: nueeStatblock(avecTrait), pos: { x: 16, y: 11 } },
      { ref: 'mutant', pos: { x: 19, y: 13 } },
    ],
  });
  const scene: Scene = {
    ...testScene(),
    id: 'test-nuee',
    entities: [...testScene().entities.filter((e) => e.kind === 'heroStart'), ...enc.entities],
    encounters: [enc.encounter],
  };
  return { scene, nueeId: enc.entities[0].id, temoinId: enc.entities[1].id };
}

function startNuee(scene: Scene) {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero], battle: null, pendingDisengage: null });
  useGame.getState().startScene(scene);
  useGame.getState().startCombat(ENC_NUEE);
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers(); // les tours d'IA du Round sont différés : ce banc ne joue que ses propres gestes
  return { battle: useGame.getState().battle!, heroId: hero.id };
}

/** Franchit le Round par le geste de fin de tour, depuis le dernier index de l'ordre. */
function franchirLeRound(battle: ReturnType<typeof startNuee>['battle']) {
  useGame.setState({ battle: { ...battle, turn: battle.order.length - 1, action: null, acted: false, movementUsed: 0 } });
  useGame.getState().battleEndTurn();
  return useGame.getState().battle!;
}

describe('Nuée AUTHORÉE en scène — spawn et Round joués par le store (LDB 85 l.251-253)', () => {
  const netInitial = useGame.getState().net;
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingDisengage: null, net: netInitial }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); useGame.setState({ net: netInitial }); });

  it('statbloc d’AUTEUR : le spawn de scène applique le build de Nuée (×5 PB, +10 CC, Psychologie ignorée)', () => {
    const { scene, nueeId } = nueeScene();
    const { battle } = startNuee(scene);

    const nuee = battle.combatants.find((c) => c.id === nueeId)!;
    expect(nuee.swarm).toBe(true);
    expect(nuee.psychImmune).toBe(true);
    expect(nuee.wounds.max).toBe(PB_UNITE * 5);
    expect(nuee.characteristics['capacite-de-combat']).toBe(CC_UNITE + 10);
  });

  it('fin de Round : l’Engagé de la Nuée perd 1 PB, l’Engagé d’AUTRE CHOSE garde les siens', () => {
    const { scene, nueeId, temoinId } = nueeScene();
    const { battle, heroId } = startNuee(scene);

    const nuee = battle.combatants.find((c) => c.id === nueeId)!;
    const hero = battle.combatants.find((c) => c.id === heroId)!;
    const temoin = battle.combatants.find((c) => c.id === temoinId)!;
    engage(hero, nuee);
    engage(temoin, hero); // Engagé, mais avec le héros — pas avec la Nuée
    const pvHero = hero.wounds.current;
    const pvTemoin = temoin.wounds.current;
    const round = battle.round;

    const apres = franchirLeRound(battle);

    expect(apres.round).toBe(round + 1);
    expect(apres.combatants.find((c) => c.id === heroId)!.wounds.current).toBe(pvHero - 1);
    expect(apres.combatants.find((c) => c.id === temoinId)!.wounds.current).toBe(pvTemoin);
  });

  it('même scène SANS le Trait : le spawn ne pose pas `swarm`, et l’Engagé ne perd rien à la fin du Round', () => {
    const { scene, nueeId } = nueeScene(false);
    const { battle, heroId } = startNuee(scene);

    const amas = battle.combatants.find((c) => c.id === nueeId)!;
    const hero = battle.combatants.find((c) => c.id === heroId)!;
    expect(amas.swarm).toBeUndefined();
    expect(amas.wounds.max).toBe(PB_UNITE);
    engage(hero, amas);
    const pvHero = hero.wounds.current;

    const apres = franchirLeRound(battle);

    expect(apres.combatants.find((c) => c.id === heroId)!.wounds.current).toBe(pvHero);
  });

  it('la Nuée quitte un Engagement SANS Test, liens levés et déplacement rouvert', () => {
    // Volet joué par la porte JOUEUR (`battleDisengage`) : la Nuée ENNEMIE se pilote sous un siège MJ
    // (`net.gmSeat`, `netOwnership.ts:259-262,301-306`). L'IA, elle, ne joue PAS ce volet : `src/state/ai.ts`
    // n'appelle jamais `startDisengage` — ticket ouvert par l'orchestratrice (#1718).
    const { scene, nueeId } = nueeScene();
    const { battle, heroId } = startNuee(scene);
    useGame.setState({ net: { ...useGame.getState().net, gmSeat: 0 } }); // « contrôle des ennemis » en solo

    const nuee = battle.combatants.find((c) => c.id === nueeId)!;
    const hero = battle.combatants.find((c) => c.id === heroId)!;
    engage(nuee, hero);
    useGame.setState({ battle: { ...battle, turn: battle.order.indexOf(nueeId), action: null, acted: false, movementUsed: 0 } });

    useGame.getState().battleDisengage();

    const st = useGame.getState();
    expect(st.pendingDisengage).toBeNull(); // aucun Test opposé d'Esquive, aucun menu
    expect(st.battle!.combatants.find((c) => c.id === nueeId)!.engagedWith).toEqual([]);
    expect(st.battle!.combatants.find((c) => c.id === heroId)!.engagedWith ?? []).not.toContain(nueeId);
    expect(st.battle!.reachable.size).toBeGreaterThan(0); // le déplacement est rouvert
  });
});

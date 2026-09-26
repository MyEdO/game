import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { pregenParty, PREGEN } from '../data/pregens';
import { applyEffects, EFFECT_HANDLERS, type EffectRefCtx } from './combatEffects';
import type { Effect } from './scene';
import { armyMight, armyStartMight, nomDArmee } from './massBattleFlow';
import type { MassBattleSpec } from '../engine/massBattle';

/** Effet `startMassBattle` authoré typique (armées + situations par Round + rencontres de combat). */
function battleEffect(spec: Partial<MassBattleSpec> = {}): Extract<Effect, { type: 'startMassBattle' }> {
  return {
    type: 'startMassBattle',
    battle: {
      allyName: 'Ost du Reikland', enemyName: 'Horde de Khorne',
      allyMight: 60, enemyMight: 40, plannedRounds: 2, terrain: 'Plaine boueuse',
      scenes: ['pluie-de-fleches', 'ligne-de-mire', 'motivation', 'charge', 'intrus'],
      situations: [['pluie-de-fleches', 'ligne-de-mire'], ['charge', 'intrus']],
      sceneEncounters: { 'pluie-de-fleches': 'enc-pluie', charge: 'enc-charge', intrus: 'enc-intrus' },
      situationSize: 2, allyMod: 10,
      ...spec,
    },
  };
}

function apply(effects: Effect[]) {
  seedBattleRng(1234);
  useGame.setState({ party: pregenParty(PREGEN.soldat, PREGEN.chasseur), battle: null, massBattle: null });
  applyEffects(useGame.getState, useGame.setState, effects);
}

describe('Effet startMassBattle — enregistrement dans le registre', () => {
  it('est exposé dans le registre d\'effets (picker + fabrique) du groupe Combat', () => {
    const h = EFFECT_HANDLERS.startMassBattle;
    expect(h).toBeTruthy();
    expect(h.group).toBe('Combat & social');
    const def = h.make();
    expect(def.type).toBe('startMassBattle');
    expect(def.battle.allyMight).toBeTypeOf('number');
    expect(def.battle.enemyMight).toBeTypeOf('number');
  });
});

describe('Effet startMassBattle — sérialisation (round-trip éditeur)', () => {
  it('un effet authoré round-trippe à l\'identique via JSON', () => {
    const eff = battleEffect();
    const parsed = JSON.parse(JSON.stringify(eff));
    expect(parsed).toEqual(eff);
  });

  it('la fabrique par défaut round-trippe aussi', () => {
    const def = EFFECT_HANDLERS.startMassBattle.make();
    expect(JSON.parse(JSON.stringify(def))).toEqual(def);
  });

  it('la fabrique ne recopie aucun nom d’armée : la bataille lancée porte ceux de `nomDArmee`', () => {
    const def = EFFECT_HANDLERS.startMassBattle.make() as Extract<Effect, { type: 'startMassBattle' }>;
    apply([def]);
    const mb = useGame.getState().massBattle!;
    expect([mb.ally.label, mb.enemy.label]).toEqual([nomDArmee(def.battle, 'ally'), nomDArmee(def.battle, 'enemy')]);
    expect([def.battle.allyName, def.battle.enemyName]).toEqual([undefined, undefined]);
  });
});

describe('Effet startMassBattle — appliqué par applyEffects', () => {
  beforeEach(() => apply([battleEffect()]));

  it('lance la bataille avec les armées, Puissances et Rounds authorés', () => {
    const s = useGame.getState();
    expect(s.screen).toBe('massBattle');
    const mb = s.massBattle!;
    expect(mb.ally.label).toBe('Ost du Reikland');
    expect(mb.enemy.label).toBe('Horde de Khorne');
    // L'armée = un Combattant inanimé à Blessures : PB courantes = Puissance, PB max = Puissance de départ.
    expect(armyMight(mb.ally)).toBe(60);
    expect(armyStartMight(mb.ally)).toBe(60);
    expect(armyMight(mb.enemy)).toBe(40);
    expect(mb.plannedRounds).toBe(2);
    expect(mb.allyMod).toBe(10);          // Modif. permanent (Planification) authoré
    expect(mb.situationSize).toBe(2);
  });

  it('transmet le catalogue, les situations par Round et les rencontres des Scènes de combat', () => {
    const mb = useGame.getState().massBattle!;
    expect(mb.pool).toEqual(['pluie-de-fleches', 'ligne-de-mire', 'motivation', 'charge', 'intrus']);
    expect(mb.situations).toEqual([['pluie-de-fleches', 'ligne-de-mire'], ['charge', 'intrus']]);
    expect(mb.sceneEncounters).toEqual({ 'pluie-de-fleches': 'enc-pluie', charge: 'enc-charge', intrus: 'enc-intrus' });
  });

  it('l\'édition d\'une situation compose EXACTEMENT la liste de Scènes présentées au Round', () => {
    // La situation authorée du Round 1 est présentée telle quelle à l'engagement (pas un tirage).
    useGame.getState().massBattleBegin();
    const mb = useGame.getState().massBattle!;
    // Round 1 = ['pluie-de-fleches','ligne-de-mire'] + la menace « intrus » n'est PAS de ce Round → situation stricte.
    expect(mb.situation).toEqual(['pluie-de-fleches', 'ligne-de-mire']);
  });
});

describe('Effet startMassBattle — sans catalogue ni situations (tirage aléatoire)', () => {
  it('utilise le catalogue complet et tire une situation de « situationSize »', () => {
    apply([battleEffect({ scenes: undefined, situations: undefined, situationSize: 3 })]);
    const mb = useGame.getState().massBattle!;
    expect(mb.pool.length).toBe(12);           // tout le catalogue
    expect(mb.situations).toBeUndefined();
    useGame.getState().massBattleBegin();
    expect(useGame.getState().massBattle!.situation.length).toBe(3); // tirage borné
  });
});

describe('Effet startMassBattle — validation des rencontres (refs)', () => {
  const ctx = (ids: string[]): EffectRefCtx => ({
    sceneIds: new Set(), dialogueIds: new Set(), encounterIds: new Set(ids), entityIds: new Set(), npcSheet: () => undefined, within: () => true,
  });
  it('signale une rencontre mappée inexistante et valide celles présentes', () => {
    const eff = battleEffect({ sceneEncounters: { charge: 'enc-charge', intrus: 'enc-absent' } });
    const issues = EFFECT_HANDLERS.startMassBattle.refs!(eff, ctx(['enc-charge']));
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
    expect(issues[0].message).toContain('enc-absent');
  });
  it('aucun problème quand toutes les rencontres existent', () => {
    const eff = battleEffect({ sceneEncounters: { charge: 'enc-charge' } });
    expect(EFFECT_HANDLERS.startMassBattle.refs!(eff, ctx(['enc-charge']))).toEqual([]);
  });
});

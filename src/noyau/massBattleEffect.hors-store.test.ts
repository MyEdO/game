import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { applyEffects, EFFECT_HANDLERS } from './combatEffects';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import { armyMight, armyStartMight, nomDArmee } from './massBattleFlow';
import type { MassBattleSpec } from '../engine/massBattle';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Effet `startMassBattle` authoré typique (armées + situations par Round + rencontres de combat). */
function battleEffect(spec: Partial<MassBattleSpec> = {}): Extract<Effect, { type: 'startMassBattle' }> {
  return {
    type: 'startMassBattle',
    battle: {
      nomDesAllies: 'Ost du Reikland', nomDesEnnemis: 'Horde de Khorne',
      puissanceAlliee: 60, puissanceEnnemie: 40, plannedRounds: 2, terrain: 'Plaine boueuse',
      scenes: ['pluie-de-fleches', 'ligne-de-mire', 'motivation', 'charge', 'intrus'],
      situations: [['pluie-de-fleches', 'ligne-de-mire'], ['charge', 'intrus']],
      sceneEncounters: { 'pluie-de-fleches': { id: 'enc-pluie' }, charge: { id: 'enc-charge' }, intrus: { id: 'enc-intrus' } },
      situationSize: 2, modificateurAllie: 10,
      ...spec,
    },
  };
}

function apply(effects: Effect[]) {
  seedBattleRng(1234);
  banc.setState({ party: groupeDeScenario(idsDeTest, 'soldat', 'chasseur'), battle: null, massBattle: null });
  applyEffects(banc.getState, banc.setState, effects);
}

describe('Effet startMassBattle — enregistrement dans le registre', () => {
  it('est exposé dans le registre d\'effets (picker + fabrique) du groupe Combat', () => {
    const h = EFFECT_HANDLERS.startMassBattle;
    expect(h).toBeTruthy();
    expect(h.group).toBe('Combat & social');
    const def = h.make();
    expect(def.type).toBe('startMassBattle');
    expect(def.battle.puissanceAlliee).toBeTypeOf('number');
    expect(def.battle.puissanceEnnemie).toBeTypeOf('number');
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
    const mb = banc.getState().massBattle!;
    expect([mb.allie.label, mb.ennemi.label]).toEqual([nomDArmee(def.battle, 'allie'), nomDArmee(def.battle, 'ennemi')]);
    expect([def.battle.nomDesAllies, def.battle.nomDesEnnemis]).toEqual([undefined, undefined]);
  });
});

describe('Effet startMassBattle — appliqué par applyEffects', () => {
  beforeEach(() => apply([battleEffect()]));

  it('lance la bataille avec les armées, Puissances et Rounds authorés', () => {
    const s = banc.getState();
    expect(s.screen).toBe('massBattle');
    const mb = s.massBattle!;
    expect(mb.allie.label).toBe('Ost du Reikland');
    expect(mb.ennemi.label).toBe('Horde de Khorne');
    // L'armée = un Combattant inanimé à Blessures : PB courantes = Puissance, PB max = Puissance de départ.
    expect(armyMight(mb.allie)).toBe(60);
    expect(armyStartMight(mb.allie)).toBe(60);
    expect(armyMight(mb.ennemi)).toBe(40);
    expect(mb.plannedRounds).toBe(2);
    expect(mb.modificateurAllie).toBe(10);          // Modif. permanent (Planification) authoré
    expect(mb.situationSize).toBe(2);
  });

  it('transmet le catalogue, les situations par Round et les rencontres des Scènes de combat', () => {
    const mb = banc.getState().massBattle!;
    expect(mb.pool).toEqual(['pluie-de-fleches', 'ligne-de-mire', 'motivation', 'charge', 'intrus']);
    expect(mb.situations).toEqual([['pluie-de-fleches', 'ligne-de-mire'], ['charge', 'intrus']]);
    expect(mb.sceneEncounters).toEqual({ 'pluie-de-fleches': { id: 'enc-pluie' }, charge: { id: 'enc-charge' }, intrus: { id: 'enc-intrus' } });
  });

  it('l\'édition d\'une situation compose EXACTEMENT la liste de Scènes présentées au Round', () => {
    // La situation authorée du Round 1 est présentée telle quelle à l'engagement (pas un tirage).
    banc.getState().engagerLaBataille();
    const mb = banc.getState().massBattle!;
    // Round 1 = ['pluie-de-fleches','ligne-de-mire'] + la menace « intrus » n'est PAS de ce Round → situation stricte.
    expect(mb.situation).toEqual(['pluie-de-fleches', 'ligne-de-mire']);
  });
});

describe('Effet startMassBattle — sans catalogue ni situations (tirage aléatoire)', () => {
  it('utilise le catalogue complet et tire une situation de « situationSize »', () => {
    apply([battleEffect({ scenes: undefined, situations: undefined, situationSize: 3 })]);
    const mb = banc.getState().massBattle!;
    expect(mb.pool.length).toBe(12);           // tout le catalogue
    expect(mb.situations).toBeUndefined();
    banc.getState().engagerLaBataille();
    expect(banc.getState().massBattle!.situation.length).toBe(3); // tirage borné
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { aiTurnLog, clearAiTurnLog, runEnemyAI } from '../combatFlow';
import { seedBattleRng } from '../battleRng';
import { setAiTrace } from '../monde/ai';
import type { Combatant } from '../../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

/**
 * IA du lanceur (#4821) : la Focalisation (LDB 46 l.128-132) entre dans l'argmax face au lancer immédiat d'un
 * Sort mineur (LDB 46, Fléchette), en combat automatique sur le banc.
 */

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc({ cadence: 'auto' });
  clearAiTurnLog();
  seedBattleRng(1);
  setAiTrace(true);
  return () => setAiTrace(false);
});

const CHARS = (fm: number, be: number) => ({
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: be, initiative: 30,
  agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': fm, sociabilite: 30,
});

function combatant(p: Partial<Combatant> & { id: string; fm: number; be: number; blessures: number }): Combatant {
  const { fm, be, blessures, ...rest } = p;
  return blessuresSurLeProfil({
    label: rest.id, kind: 'heros', characteristics: CHARS(fm, be) as never,
    wounds: blessuresDeBase(blessures), advantage: 0, conditions: [], movement: 0,
    weapons: [], armour: { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 },
    skills: [], talents: [], traits: [], psychState: [], engagedWith: [], size: 'moyenne',
    fortune: 0, resilience: 0, pos: { x: 1, y: 1 },
    ...rest,
  }) as unknown as Combatant;
}

const scene = (w: number) =>
  ({ id: 's', label: '', dimensions: { w, h: 16 }, layers: [{ z: 0, tiles: Array(w * 16).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

/** Sorcier des Cieux : Fléchette (Sort mineur, NI 0) et Arc de T'Essla (NI 7, Dégâts +10), Focalisation (Cieux). */
function sorcier(movement = 0, fm = 70): Combatant {
  return combatant({
    id: 'e', label: 'Sorcier', kind: 'ennemi', fm, be: 30, blessures: 12, pos: { x: 2, y: 8 }, movement,
    skills: [{ id: 'langue', spec: 'magick', advances: 20 }, { id: 'focalisation', spec: 'cieux', advances: 20 }] as never,
    spells: ['flechette', 'arc-de-t-essla'],
  });
}

function poser(heros: Combatant[], foe = sorcier(), w = 16) {
  const order = [foe.id, ...heros.map((h) => h.id)];
  banc.setState({
    mode: 'battle', scene: scene(w), party: [], pendingStateRecovery: null,
    battle: {
      combatants: [foe, ...heros], order, baseOrder: order, turn: 0, round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
      acted: false, log: [], over: null,
    } as never,
  });
  runEnemyAI(banc.getState, banc.setState, foe.id);
}

const actionsDuSorcier = () => aiTurnLog().filter((r) => r.id === 'e').map((r) => r.action);

describe('#4821 — un lanceur focalise un sort de voie que le Sort mineur ne vaut pas', () => {
  it('face à des cibles robustes, il focalise Arc de T’Essla puis le lance', () => {
    poser([
      combatant({ id: 'h1', fm: 30, be: 50, blessures: 30, pos: { x: 8, y: 8 } }),
      combatant({ id: 'h2', fm: 30, be: 50, blessures: 30, pos: { x: 8, y: 10 } }),
    ]);
    banc.jusquA(() => actionsDuSorcier().some((a) => a.startsWith('incantation arc-de-t-essla')), 400);
    const actions = actionsDuSorcier();
    const lance = actions.findIndex((a) => a.startsWith('incantation arc-de-t-essla'));
    expect(actions[0], JSON.stringify(aiTurnLog().find((r) => r.id === 'e')?.top)).toBe('focalisation arc-de-t-essla');
    expect(lance, actions.join(' | ')).toBeGreaterThan(0);
    expect(actions.slice(0, lance).every((a) => a === 'focalisation arc-de-t-essla'), actions.join(' | ')).toBe(true);
  });

  it('face à une cible à 1 Blessure que Fléchette achève, il lance Fléchette', () => {
    const h = combatant({ id: 'h1', fm: 30, be: 30, blessures: 30, pos: { x: 8, y: 8 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } });
    h.wounds.current = 1;
    poser([h]);
    banc.jusquA(() => actionsDuSorcier().length > 0, 50);
    expect(actionsDuSorcier()[0], JSON.stringify(aiTurnLog().find((r) => r.id === 'e')?.top)).toBe('incantation flechette→h1');
  });

  it('hors de toute portée, il approche au lieu de rester sur place à focaliser', () => {
    poser([combatant({ id: 'h1', fm: 30, be: 50, blessures: 30, pos: { x: 30, y: 8 } })], sorcier(4, 40), 32);
    banc.jusquA(() => actionsDuSorcier().length > 0, 50);
    expect(actionsDuSorcier()[0], JSON.stringify(aiTurnLog().find((r) => r.id === 'e')?.top)).toMatch(/^deplacement/);
  });
});

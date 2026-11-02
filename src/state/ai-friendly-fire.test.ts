/**
 * TIR AMI d'une ZdE (retour playtest 2026-06-27 : « pour tuer 2 adversaires, le perso a lancé un sort de
 * zone qui a mis KO 3 alliés »). Une ZdE indiscriminée pleut sur TOUS dans le rayon ; l'IA doit évaluer le
 * mal fait aux ALLIÉS couverts (dégâts ET ÉTATS) et NE PAS s'auto-nuke. Le bug : l'ancien calcul ne comptait
 * que les DÉGÂTS → une ZdE de CONTRÔLE (qui « KO » par un État) n'avait aucune pénalité d'ami.
 */
import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type EnemyTurnInput, type CastableSpell } from '../noyau/monde/ai';
import { spellTargetHarm } from '../noyau/monde/aiSpellValue';
import { emptyScene } from '../noyau/monde/scene';
import type { Combatant } from '../engine/types';
import type { SpellData } from '../data';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

// Sort de ZONE de CONTRÔLE (aveugle tous les couverts) — ZÉRO dégât : tout le « mal » passe par l'État.
const BLIND_AOE: SpellData = {
  id: 'nuee-aveuglante', label: 'Nuée aveuglante', ecole: 'sort', subType: null, family: 'arcane', cn: 0,
  range: null, target: null, duration: null, desc: '', source: { book: 'LDB', page: 0 },
  effects: { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'aveugle' }] } }] },
} as unknown as SpellData;

const castable = (): CastableSpell => ({ id: BLIND_AOE.id, data: BLIND_AOE, cn: 0, range: 20, shape: { area: { radius: 3 } }, landProb: 1, focusState: 'none', active: false });
const scene = emptyScene('scene-test', 20, 20);
function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant {
  return blessuresSurLeProfil({ id, label: id, kind, pos, wounds: blessuresDeBase(12), weapons: [], characteristics: {} as never,
    advantage: 0, conditions: [], armour: {} as never, skills: [], talents: [], movement: 4 }) as Combatant;
}
function input(enemy: Combatant, heroes: Combatant[], squad: Combatant[]): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set([...heroes, ...squad].map((c) => `${c.pos!.x},${c.pos!.y}`)), movement: enemy.movement, spells: [castable()], squad };
}

describe('IA — tir ami d’une ZdE de contrôle', () => {
  it('spellTargetHarm compte l’ÉTAT infligé (pas seulement les dégâts) : > 0 pour une ZdE de contrôle', () => {
    const caster = mk('c', 'enemy', { x: 0, y: 0 });
    const target = mk('t', 'hero', { x: 1, y: 0 });
    expect(spellTargetHarm(caster, target, BLIND_AOE)).toBeGreaterThan(0); // l'aveuglement pèse (CONDITION_THREAT)
  });

  it('NE lance PAS la ZdE si elle prend plus d’alliés que d’ennemis (auto-nuke évité)', () => {
    const caster = mk('e', 'enemy', { x: 5, y: 5 });
    const foe = mk('h', 'hero', { x: 10, y: 10 });           // 1 ennemi
    const a1 = mk('a1', 'enemy', { x: 10, y: 9 });           // 2 alliés DANS le rayon de l'unique centre (la cible)
    const a2 = mk('a2', 'enemy', { x: 9, y: 10 });
    const action = chooseEnemyAction(input(caster, [foe], [a1, a2]));
    expect(action.kind).not.toBe('castArea'); // 1 ennemi vs 2 alliés aveuglés → net < 0 → pas de ZdE
  });

  it('lance la ZdE quand elle ne touche QUE des ennemis (aucun allié dans le rayon)', () => {
    const caster = mk('e', 'enemy', { x: 5, y: 5 });
    const f1 = mk('h1', 'hero', { x: 10, y: 10 });
    const f2 = mk('h2', 'hero', { x: 10, y: 11 });           // 2 ennemis groupés, alliés ailleurs
    const ally = mk('a', 'enemy', { x: 5, y: 6 });            // allié LOIN du rayon
    const action = chooseEnemyAction(input(caster, [f1, f2], [ally]));
    expect(action.kind).toBe('castArea');
  });
});

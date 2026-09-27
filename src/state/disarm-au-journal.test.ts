import { describe, it, expect, beforeEach } from 'vitest';
import { applyCriticalToTarget, aiHandGate } from './combatFlow';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { resolveCritique } from '../engine/critical';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';

const seq = (...vals: number[]): RNG => {
  let i = 0;
  return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
};
const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mk = (over: Partial<Combatant>): Combatant =>
  ({ id: 't', label: 'Cible', kind: 'enemy', characteristics: CHARS, wounds: { current: 10, max: 10 }, conditions: [], skills: [], talents: [], traits: [], activeEffects: [], bodyShape: 'humanoide', size: 'moyenne', weapons: [], items: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over } as unknown as Combatant);

// LDB 18 l.107 « Choc au bras » : `criticals.json` « Lâchez ce que vous teniez. »
describe('op disarm d’un Critique : ses lignes vont au journal (applyCriticalToTarget)', () => {
  beforeEach(() => useGame.setState({ pendingCascade: null, suspendedCascades: [], battle: null }));

  it('statbloc touché en brasD par « Choc au bras » : le journal nomme l’arme lâchée, qui a quitté ses mains', () => {
    seedBattleRng(1);
    const gobelin = mk({ id: 'g', label: 'Gobelin', weapons: [{ uid: 's1', label: 'Hachoir', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }] as never });
    const crit = resolveCritique('ldb', gobelin, 'brasD', seq(5), { overkill: 0 });
    expect(crit.entryId).toBe('choc-au-bras');
    const log: string[] = [];
    applyCriticalToTarget(gobelin, 'brasD', true, 0, log, useGame.setState, { prerolled: crit, get: useGame.getState });
    expect(log).toContain('  ↳ Gobelin lâche Hachoir.');
    expect(gobelin.weapons.some((w) => w.uid === 's1')).toBe(false);
  });

  it('héros : la modale reprend la ligne de disarm, pas celle des Blessures que son bandeau résume', () => {
    seedBattleRng(1);
    const heros = mk({ id: 'h', label: 'Héros', kind: 'hero', items: [{ ...itemFromTrappingById('arme-simple')!, uid: 'w1', equipped: true }], loadouts: [{ id: 'l1', main: 'w1' }] as never, activeLoadoutId: 'l1' });
    recomputeLoadout(heros);
    const crit = resolveCritique('ldb', heros, 'brasD', seq(5), { overkill: 0 });
    const log: string[] = [];
    applyCriticalToTarget(heros, 'brasD', true, 0, log, useGame.setState, { prerolled: crit, get: useGame.getState });
    const c = useGame.getState().pendingCascade!;
    const reveal = c.participants[c.participants.length - 1].reveal!;
    expect(reveal.crit?.woundsLost).toBe(1);
    expect(reveal.details?.map((d) => d.text)).toEqual(['Héros lâche Arme simple.', crit.desc]);
    expect(log.filter((l) => l.startsWith('  ↳ '))).toEqual(['  ↳ Héros subit 1 Blessure(s) (ignorant BE et PA).', '  ↳ Héros lâche Arme simple.', `  ↳ ${crit.desc}`]);
  });

  // LDB 18 l.74
  it('État à valeur TIRÉE (Commotion cérébrale, Sonné 1d10) : la modale donne la valeur réelle, le bandeau ne l’affiche pas', () => {
    seedBattleRng(3);
    const heros = mk({ id: 'h', label: 'Héros', kind: 'hero', wounds: { current: 12, max: 12 } });
    const crit = resolveCritique('ldb', heros, 'tete', seq(78), { overkill: 0 });
    expect(crit.entryId).toBe('commotion-cerebrale');
    applyCriticalToTarget(heros, 'tete', true, 0, [], useGame.setState, { prerolled: crit, get: useGame.getState });
    const sonne = heros.conditions.find((x) => x.id === 'sonne')!.value;
    const c = useGame.getState().pendingCascade!;
    const reveal = c.participants[c.participants.length - 1].reveal!;
    expect(reveal.details?.map((d) => d.text)).toContain(`Héros reçoit ${sonne} État Sonné.`);
    expect(reveal.crit?.conditions?.map((x) => x.id)).toEqual(['assourdi', 'hemorragique']);
  });
});

// AA 07 l.117
describe('Main ensanglantée (aiHandGate) : l’arme qui glisse est nommée au journal', () => {
  beforeEach(() => useGame.setState({ pendingCascade: null, suspendedCascades: [], battle: null }));

  it('Échec du Test de Dextérité : la ligne de disarm suit la ligne du Test', () => {
    const orque = mk({ id: 'o', label: 'Orque', characteristics: { ...CHARS, dexterite: 0 }, handGates: ['main'], weapons: [{ uid: 's1', label: 'Hachoir', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }] as never });
    useGame.setState({ battle: { combatants: [orque], log: [] } as never });
    let seed = 1;
    for (;;) {
      seedBattleRng(seed);
      if (!aiHandGate(useGame.getState, useGame.setState, orque)) break;
      seed++;
      if (seed > 50) throw new Error('aucune graine d’échec');
    }
    const texts = useGame.getState().battle!.log.map((e) => e.text);
    expect(texts[texts.length - 1]).toBe('  ↳ Orque lâche Hachoir.');
    expect(orque.weapons.some((w) => w.uid === 's1')).toBe(false);
  });
});

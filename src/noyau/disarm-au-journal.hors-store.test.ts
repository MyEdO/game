import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { applyCriticalToTarget, aiHandGate } from './combatFlow';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { resolveCritique } from '../engine/critical';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';
import { desEnSuite } from '../engine/dice.testkit';
import { emptyScene } from './monde/scene';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const seq = (...vals: number[]): RNG => desEnSuite(vals, { boucle: true, borne: true });
const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mk = (over: Partial<Combatant>): Combatant =>
  (blessuresSurLeProfil({ id: 't', label: 'Cible', kind: 'ennemi', characteristics: CHARS, wounds: blessuresDeBase(10), conditions: [], skills: [], talents: [], traits: [], activeEffects: [], bodyShape: 'humanoide', size: 'moyenne', weapons: [], items: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over }) as unknown as Combatant);

// LDB 18 l.107 « Choc au bras » : `criticals.json` « Lâchez ce que vous teniez. »
describe('op disarm d’un Critique : ses lignes vont au journal (applyCriticalToTarget)', () => {
  it('statbloc touché en brasD par « Choc au bras » : le journal nomme l’arme lâchée, qui a quitté ses mains', () => {
    seedBattleRng(1);
    const gobelin = mk({ id: 'g', label: 'Gobelin', weapons: [{ uid: 's1', label: 'Hachoir', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }] as never });
    const crit = resolveCritique('ldb', gobelin, 'brasD', seq(5), { overkill: 0 });
    expect(crit.entryId).toBe('choc-au-bras');
    const log: string[] = [];
    applyCriticalToTarget(gobelin, 'brasD', 0, log, banc.setState, { prerolled: crit, get: banc.getState });
    expect(log).toContain('  ↳ Gobelin lâche Hachoir.');
    expect(gobelin.weapons.some((w) => w.uid === 's1')).toBe(false);
  });

  it('héros : la modale reprend la ligne de disarm, pas celle des Blessures que son bandeau résume', () => {
    seedBattleRng(1);
    const heros = mk({ id: 'h', label: 'Héros', kind: 'heros', items: [{ ...itemFromTrappingById('arme-simple', idsDeTest)!, uid: 'w1', equipped: true }], loadouts: [{ id: 'l1', main: 'w1' }] as never, activeLoadoutId: 'l1', pos: { x: 0, y: 0 } });
    banc.setState({ scene: emptyScene('scene-test') });
    recomputeLoadout(heros);
    const crit = resolveCritique('ldb', heros, 'brasD', seq(5), { overkill: 0 });
    const log: string[] = [];
    applyCriticalToTarget(heros, 'brasD', 0, log, banc.setState, { prerolled: crit, get: banc.getState });
    const c = banc.getState().pendingCascade!;
    const etape = c.participants[c.participants.length - 1];
    expect(etape.faits, 'la localisation par son id, puis les Blessures de la ligne').toEqual([
      { genre: 'localisation', cible: 'h', camp: 'groupe', valeur: 'brasD' },
      { genre: 'blessures', cible: 'h', camp: 'groupe', valeur: -1, mitigation: 'sans' },
    ]);
    expect(etape.reveal!.details?.map((d) => d.text)).toEqual(['Héros lâche Arme simple.', crit.desc]);
    expect(log.filter((l) => l.startsWith('  ↳ '))).toEqual(['  ↳ Héros subit 1 Blessure(s) (ignorant BE et PA).', '  ↳ Héros lâche Arme simple.', `  ↳ ${crit.desc}`]);
  });

  // LDB 18 l.74
  it('État à valeur TIRÉE (Commotion cérébrale, Sonné 1d10) : la modale en porte le fait à sa valeur réelle', () => {
    seedBattleRng(3);
    const heros = mk({ id: 'h', label: 'Héros', kind: 'heros', wounds: blessuresDeBase(12) });
    const crit = resolveCritique('ldb', heros, 'tete', seq(78), { overkill: 0 });
    expect(crit.entryId).toBe('commotion-cerebrale');
    applyCriticalToTarget(heros, 'tete', 0, [], banc.setState, { prerolled: crit, get: banc.getState });
    const sonne = heros.conditions.find((x) => x.id === 'sonne')!.value;
    const c = banc.getState().pendingCascade!;
    const etape = c.participants[c.participants.length - 1];
    expect(etape.faits?.[0]).toEqual({ genre: 'localisation', cible: 'h', camp: 'groupe', valeur: 'tete' });
    expect(etape.faits?.flatMap((f) => (f.genre === 'etat' ? [[f.id, f.valeur]] : []))).toEqual([['assourdi', 1], ['hemorragique', 2], ['sonne', sonne], ['extenue', 1]]);
    expect(etape.reveal!.details?.map((d) => d.text), 'la ligne d’un fait reste au journal, le fait la porte').not.toContain(`Héros reçoit ${sonne} État Sonné.`);
  });
});

// AA 07 l.117
describe('Main ensanglantée (aiHandGate) : l’arme qui glisse est nommée au journal', () => {
  it('Échec du Test de Dextérité : la ligne de disarm suit la ligne du Test, en conséquence', () => {
    const orque = mk({ id: 'o', label: 'Orque', pos: { x: 2, y: 1 }, characteristics: { ...CHARS, dexterite: 0 }, handGates: ['main'], weapons: [{ uid: 's1', label: 'Hachoir', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }] as never });
    // Le groupe voit l'Orque, comme dans tout combat du jeu (`lancerLeCombat`) : le journal le nomme (#4017).
    const temoin = mk({ id: 'h', label: 'Témoin', kind: 'heros', pos: { x: 1, y: 1 } });
    banc.setState({ scene: emptyScene('scene-test'), battle: { combatants: [orque, temoin], log: [] } as never });
    let seed = 1;
    for (;;) {
      seedBattleRng(seed);
      if (!aiHandGate(banc.getState, banc.setState, orque)) break;
      seed++;
      if (seed > 50) throw new Error('aucune graine d’échec');
    }
    const log = banc.getState().battle!.log;
    expect(log[log.length - 1], 'la ligne de l’arme lâchée est une conséquence du Test (#4911)').toMatchObject({ kind: 'detail', text: 'Orque lâche Hachoir.' });
    expect(orque.weapons.some((w) => w.uid === 's1')).toBe(false);
  });
});

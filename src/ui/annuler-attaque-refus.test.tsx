// @vitest-environment jsdom
/**
 * L'Annuler de la fenêtre d'attaque = celui que le geste applique (`refusDAnnulerLAttaque`) : refusé, il se
 * ferme avec le texte du noyau ; offert, il reste ouvert. LDB 10 l.767-773 ; LDB 15 l.35 ; LDB 10 l.500
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import type { BattleState } from '../noyau/etat';
import { openAttackCascade } from '../noyau/combatFlow';
import { seedBattleRng } from '../noyau/battleRng';
import { testScene } from '../scenes/test-fixture';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { useAttackJetProps } from './jetProps/useAttackJetProps';
import { RollShell } from './RollShell';
import type { Weapon } from '../engine/types';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

const epee = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;

function ouvrir(pa: Record<string, unknown>): void {
  const hero = combattantDeTest({ id: 'h', label: 'Héros', kind: 'heros', pos: { x: 0, y: 0 }, weapons: [epee] });
  const ennemi = combattantDeTest({ id: 'e', label: 'Ennemi', kind: 'ennemi', pos: { x: 1, y: 0 }, weapons: [epee] });
  const battle = { combatants: [hero, ennemi], order: ['h', 'e'], baseOrder: ['h', 'e'], turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: testScene(), party: [hero], pendingAttack: null, pendingCascade: null, pendingDefense: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {} } });
  seedBattleRng(1);
  openAttackCascade(useGame.getState, useGame.setState, { attackerId: 'h', targetId: 'e', location: null, result: null, weaponUid: 'sw', ...pa } as never, 'Attaque', 'action/attaquer');
}

function AttackModal() {
  const props = useAttackJetProps();
  return props ? <RollShell {...props} /> : null;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingAttack: null, pendingCascade: null, battle: null, party: [] });
});

const annuler = () => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Annuler');

describe('fenêtre d’attaque — l’Annuler suit le verdict du noyau', () => {
  it('attaque ordinaire : Annuler ouvert', () => {
    ouvrir({});
    act(() => { root.render(<AttackModal />); });
    expect(annuler()?.getAttribute('aria-disabled'), 'Annuler offert').toBeNull();
  });
  it('second coup d’un Maniement de deux armes : Annuler fermé, avec la raison du geste', () => {
    ouvrir({ dualSecond: true });
    act(() => { root.render(<AttackModal />); });
    expect(annuler()?.getAttribute('aria-disabled'), 'Annuler refusé').toBe('true');
    expect(host.textContent, 'la raison du noyau est lisible').toContain('Le second coup est engagé : son jet est imposé.');
  });
  it('Charge dont la cible a répondu (sans chargeUndo) : Annuler fermé, avec la raison du geste', () => {
    ouvrir({ fromCharge: true });
    act(() => { root.render(<AttackModal />); });
    expect(annuler()?.getAttribute('aria-disabled'), 'Annuler refusé').toBe('true');
    expect(host.textContent, 'la raison du noyau est lisible').toContain('La Charge est engagée : la cible a répondu, le Test de Corps à corps est dû.');
  });
});

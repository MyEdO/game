// @vitest-environment jsdom
/**
 * #1479 — le champ « Fixer le dé » (#939, POSE seulement #1426) est offert PAR RANGÉE sur une étape
 * en BANDE, et le dé posé sur une rangée pilote SON slot et lui seul.
 *
 * Mesuré sur la VRAIE bande (`openScriptedPsych` → étape `cascadeBatch` à 2 participants, aucun
 * pending forgé) montée dans la VRAIE fenêtre (`CascadeBody`) : le site de composition scope sa clé
 * React par étape (`witnessRowKey`, anti-collision entre deux pas aux mêmes participants), donc le
 * pid RÉEL du participant voyage à part (`RollRowData.pid`) — c'est lui que `rowForcedDie` donne à
 * `flow.slotOf`.
 *
 * Les deux héros ont des Force Mentale DIFFÉRENTES (40 / 60) : la rangée s'identifie par la CIBLE
 * qu'elle annonce, pas par son rang dans le DOM — sinon le test dirait « une rangée » sans jamais
 * dire LAQUELLE, et un champ branché sur le mauvais slot resterait vert.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { openScriptedPsych } from '../state/encounterPsychFlow';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { seedBattleRng } from '../state/battleRng';
import { testScene } from '../scenes/test-fixture';
import { CascadeBody } from './CascadeModal';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const SOLO = { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} };

const hero = (id: string, label: string, fm: number): Combatant => ({
  id, name: id, label, kind: 'hero',
  characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30,
    agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': fm, sociabilite: 30, perception: 30 },
  conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [], weapons: [],
  advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 12, max: 12 },
  resilience: 2, fortune: 2, species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
} as unknown as Combatant);

let host: HTMLDivElement;
let root: Root;

/** Bande de Peur d'Indice 1 sur DEUX héros : une étape `cascadeBatch`, deux slots. */
function bande() {
  const a = hero('h1', 'Anselme', 40);
  const b = hero('h2', 'Brunhilde', 60);
  useGame.setState({
    party: [a, b], battle: null, scene: testScene(), net: SOLO as never,
    pendingCascade: null, suspendedCascades: [], pendingLogQueue: [], journal: [],
  } as never);
  openScriptedPsych(useGame.getState, useGame.setState, 'peur', 1, 'Une ombre au fond du couloir', [a, b]);
}

const render = () => act(() => { root.render(<CascadeBody />); });
const step = () => useGame.getState().pendingCascade!.participants[0];
const slots = () => step().participants!;
const slotOf = (id: string) => slots().find((p) => p.id === id)!;
const prows = () => [...host.querySelectorAll('.prow')] as HTMLElement[];
/** La rangée qui annonce CETTE cible (« 40 à lancer » / « 60 à lancer »), et SON champ de dé. */
const prowAt = (target: number) => prows().find((n) => (n.textContent ?? '').includes(`${target} à lancer`)) ?? null;
const dieInputAt = (target: number) =>
  (prowAt(target)?.querySelector('.rm-die-pick input[type="number"]') as HTMLInputElement | undefined) ?? null;

function typeChar(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Saisie clavier réelle sur la rangée de cible `target`, puis Entrée (geste terminal qui commet, #955). */
function typeOnRow(target: number, value: string) {
  let acc = '';
  for (const ch of value) {
    acc += ch;
    const input = dieInputAt(target);
    expect(input, `le champ de la rangée « ${target} » a disparu après « ${acc.slice(0, -1)} »`).not.toBeNull();
    typeChar(input!, acc);
  }
  act(() => { dieInputAt(target)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
}

beforeEach(() => {
  seedBattleRng(3);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  resetDesFixes();
  useGame.setState({ pendingCascade: null, battle: null, party: [], pendingLogQueue: [] });
});

describe('#1479 — « Fixer le dé » sur une étape en BANDE', () => {
  it('option ON : CHAQUE rangée de la bande porte son champ', () => {
    setDesFixes(true);
    bande();
    expect(slots().map((p) => p.id)).toEqual(['h1', 'h2']);
    expect([slotOf('h1').target, slotOf('h2').target], 'deux cibles distinctes : chaque rangée est identifiable').toEqual([40, 60]);
    render();
    expect(prows().length, 'une rangée par participant').toBe(2);
    expect(dieInputAt(40), 'rangée d’Anselme (Calme 40)').not.toBeNull();
    expect(dieInputAt(60), 'rangée de Brunhilde (Calme 60)').not.toBeNull();
  });

  it('le dé posé sur la rangée de Brunhilde pilote SON résultat — Anselme reste non lancé', () => {
    setDesFixes(true);
    bande();
    render();
    typeOnRow(60, '73');
    expect(slotOf('h2').result?.roll, 'le dé saisi est celui du slot de la rangée saisie').toBe(73);
    expect(slotOf('h2').result?.target, 'et il a été opposé à la cible DE CETTE rangée').toBe(60);
    expect(slotOf('h1').result?.roll, 'la rangée d’Anselme n’a pas été touchée').toBeUndefined();
  });

  it('option OFF : aucune rangée n’offre de champ', () => {
    bande();
    render();
    expect(prows().length).toBe(2);
    expect(dieInputAt(40)).toBeNull();
    expect(dieInputAt(60)).toBeNull();
  });
});

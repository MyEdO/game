// @vitest-environment jsdom
/**
 * #1318 V4 — CONTRAT POSITIF du cycle d'influence : toute affordance RENDUE est EXÉCUTABLE.
 *
 * Les fenêtres de la Chance (`LDB 17 l.23` + `LDB 12 l.40`), du Sombre Pacte (`LDB 19 l.17`) et de
 * la Résilience (`LDB 17 l.68`) ne sont plus recomposées par les modales : elles vivent en prédicats
 * purs au seam (`state/rollFlowFactory.ts`) et la coquille les applique aux FAITS de la rangée. Ce
 * test monte la rangée POUR DE VRAI et lit les boutons — pas les props.
 *
 * La face NÉGATIVE compte autant : un bouton rendu qu'aucune règle n'autorise est une affordance
 * morte (le geste serait refusé par l'op correspondante).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RollRow } from './RollRow';
import { RollShell } from './RollShell';
import { CastModal } from './CastModal';
import { useTestJetProps } from './jetProps/useTestJetProps';
import { testBreakdown } from './breakdown';
import { useGame } from '../state/store';
import type { Combatant } from '../engine/types';

/** L'ÉCRAN RÉEL du Test de compétence (store → `useTestJetProps` → `RollShell`). */
function TestProbe() {
  const props = useTestJetProps();
  return props ? <RollShell {...props} /> : null;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 };
const mk = (kind: 'hero' | 'enemy', over: Partial<Combatant> = {}): Combatant =>
  ({ id: 'a', name: 'A', label: 'A', kind, characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [],
     skills: [], talents: [], items: [], weapons: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 },
     wounds: { current: 10, max: 10 }, resilience: 2, fortune: 2, species: 'humains-reiklander', bodyShape: 'humanoide',
     movement: 4, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over } as unknown as Combatant);

const RATE = testBreakdown('Athlétisme', 45, { roll: 88, target: 45, sl: -4, success: false });
const REUSSI = testBreakdown('Athlétisme', 45, { roll: 12, target: 45, sl: 3, success: true });

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const noop = () => {};

/** Monte une rangée POST-jet offrant les TROIS verbes, et rend les libellés des boutons. */
function boutons(props: Parameters<typeof RollRow>[0]): string[] {
  act(() => { root.render(<RollRow {...props} />); });
  return [...host.querySelectorAll('button')].map((b) => b.textContent ?? '');
}

const posJet = (actor: Combatant, d = RATE, over: Record<string, unknown> = {}) => ({
  actor, row: { combatant: actor, d }, rolled: true, interactive: true, rollFrisson: false,
  onReroll: noop, onBonusSL: noop, onDarkPact: noop, onForce: noop, ...over,
} as Parameters<typeof RollRow>[0]);

describe('#1318 V4 — toute affordance d’influence RENDUE est exécutable', () => {
  it('héros, jet RATÉ, Chance et Résilience en réserve : les trois verbes sont offerts', () => {
    const b = boutons(posJet(mk('hero')));
    expect(b.some((t) => /Relancer/.test(t)), 'Chance (LDB 17 l.23)').toBe(true);
    expect(b.some((t) => /Pacte/.test(t)), 'Sombre Pacte (LDB 19 l.17)').toBe(true);
    expect(b.some((t) => /Résilience/.test(t)), 'Je ne faillirai pas ! (LDB 17 l.68)').toBe(true);
  });

  it('acteur NON-héros : aucun bouton Pacte — `opDarkPact` refuse (LDB 19 l.17, héros seuls)', () => {
    const b = boutons(posJet(mk('enemy')));
    expect(b.some((t) => /Pacte/.test(t))).toBe(false);
  });

  it('héros SANS Point de Chance ni relance gratuite : aucun bouton Relancer', () => {
    const b = boutons(posJet(mk('hero', { fortune: 0 } as Partial<Combatant>)));
    expect(b.some((t) => /Relancer/.test(t))).toBe(false);
  });

  it('relance GRATUITE (Bénédiction de Chance, LDB 41) : Relancer offert même à 0 Point de Chance', () => {
    const beni = mk('hero', { fortune: 0,
      activeEffects: [{ label: 'Bénédiction de Chance', bonus: 0, duration: { scale: 'rounds', left: 6 }, freeReroll: true }],
    } as unknown as Partial<Combatant>);
    const b = boutons(posJet(beni));
    expect(b.some((t) => /Relancer/.test(t))).toBe(true);
  });

  it('relance DÉJÀ consommée (LDB 12 l.40) : plus de Relancer, le Pacte reste (LDB 19 l.17)', () => {
    const b = boutons(posJet(mk('hero'), RATE, { rerolled: true }));
    expect(b.some((t) => /Relancer/.test(t))).toBe(false);
    expect(b.some((t) => /Pacte/.test(t))).toBe(true);
  });

  it('jet RÉUSSI : ni Relancer (Chance = jet raté) ni Résilience, mais le Pacte OUI (V3)', () => {
    const b = boutons(posJet(mk('hero'), REUSSI));
    expect(b.some((t) => /Relancer/.test(t))).toBe(false);
    expect(b.some((t) => /Résilience/.test(t))).toBe(false);
    expect(b.some((t) => /Pacte/.test(t))).toBe(true);
  });

  it('jet réussi mais OPPOSITION perdue : la Résilience reste offerte (LDB 17 l.68, « vous l’emportez »)', () => {
    const b = boutons(posJet(mk('hero'), REUSSI, { winner: 'lose' }));
    expect(b.some((t) => /Résilience/.test(t))).toBe(true);
  });

  it('aucune Résilience en réserve : aucun bouton Résilience sur un jet raté', () => {
    const b = boutons(posJet(mk('hero', { resilience: 0 } as Partial<Combatant>)));
    expect(b.some((t) => /Résilience/.test(t))).toBe(false);
  });

  it('le flux n’OFFRE pas le verbe (aucun handler) : rien n’est rendu, même fenêtre ouverte', () => {
    const nu = { actor: mk('hero'), row: { combatant: mk('hero'), d: RATE }, rolled: true, interactive: true,
      rollFrisson: false, onReroll: noop } as Parameters<typeof RollRow>[0];
    const b = boutons(nu);
    expect(b.some((t) => /Relancer/.test(t)), 'la Chance, elle, est offerte').toBe(true);
    expect(b.some((t) => /Pacte/.test(t))).toBe(false);
    expect(b.some((t) => /Résilience/.test(t))).toBe(false);
  });

  it('jet MASQUÉ (#990) : aucune affordance — elles dériveraient du verdict que le dé cache', () => {
    const b = boutons(posJet(mk('hero'), { ...RATE, mask: 'roll' }));
    expect(b).toEqual([]);
  });

  /** POOLS DISTINCTS (LDB 17 l.59 vs l.68) : la Détermination ne se gate JAMAIS sur la Résilience —
   *  ni sur sa réserve, ni sur sa fenêtre. Mesuré aux deux bornes qui les faisaient diverger. */
  it('Détermination : offerte à 0 Résilience — pool DISTINCT (LDB 17 l.59), jamais gatée par la Résilience', () => {
    const b = boutons(posJet(mk('hero', { resilience: 0 } as Partial<Combatant>), RATE,
      { determination: { resolve: 2, onResolve: noop } }));
    expect(b.some((t) => /Détermination/.test(t))).toBe(true);
    expect(b.some((t) => /Résilience/.test(t)), 'la Résilience, elle, est bien éteinte').toBe(false);
  });

  it('Détermination : offerte sur un jet RÉUSSI — sa fenêtre n’est pas celle de la Résilience', () => {
    const b = boutons(posJet(mk('hero'), REUSSI, { determination: { resolve: 1, onResolve: noop } }));
    expect(b.some((t) => /Détermination/.test(t))).toBe(true);
    expect(b.some((t) => /Résilience/.test(t))).toBe(false);
  });

  it('Détermination : réserve VIDE → aucun bouton (sa propre réserve la gate)', () => {
    const b = boutons(posJet(mk('hero'), RATE, { determination: { resolve: 0, onResolve: noop } }));
    expect(b.some((t) => /Détermination/.test(t))).toBe(false);
  });
});

/**
 * BOUT-EN-BOUT sur les DEUX flux qui portaient la divergence (#1318 V4) — l'issue MÉTIER est
 * défavorable alors que le TEST est réussi. Les deux bouts sont mesurés dans le même test :
 *   (a) la MODALE RÉELLE ne rend AUCUN bouton d'influence de la fenêtre « échec » ;
 *   (b) le SEAM RÉEL refuse le verbe (aucun Point de Chance débité).
 * Une affordance offerte que le seam refuse est un bouton mort ; l'inverse est une règle perdue.
 */
describe('#1318 V4 — issue métier défavorable sur un TEST réussi : rien d’offert, rien d’exécutable', () => {
  const arene = (h: Combatant) => ({
    battle: { combatants: [h], order: [h.id], baseOrder: [h.id], turn: 0, round: 1, action: null,
      selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
      acted: false, log: [], over: null } as never,
    party: [h],
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} } as never,
  });

  afterEach(() => {
    act(() => { useGame.setState({ battle: null, pendingCast: null, pendingTest: null, pendingCascade: null } as never); });
  });

  it('incantation — DR sous le NI (LDB 46 l.23-25 : « Succès mais DR < NI ») : ni Relancer ni Résilience', () => {
    const h = mk('hero', { id: 'A', label: 'A' } as Partial<Combatant>);
    useGame.setState({
      ...arene(h),
      pendingCast: { casterId: 'A', targetId: 'A', spellId: 'drain', missile: false, focused: false,
        // Test RÉUSSI (8 ≤ 45), sort NON lancé (DR 1 sous le NI).
        result: { cast: false, roll: 8, target: 45, sl: 1, isCritical: false, isFumble: false, log: '' } } as never,
    } as never);
    act(() => { root.render(<CastModal />); });
    const b = [...host.querySelectorAll('button')].map((x) => x.textContent ?? '');
    expect(b.some((t) => /Relancer/.test(t)), 'le Test est RÉUSSI : la Chance ne s’offre pas (LDB 17 l.23)').toBe(false);
    expect(b.some((t) => /Résilience/.test(t)), 'le Test est RÉUSSI : la Résilience ne s’offre pas (LDB 17 l.68)').toBe(false);
    // (b) le SEAM refuse aussi — l'affordance absente n'était pas une règle perdue.
    const avant = useGame.getState().battle!.combatants[0].fortune;
    act(() => { (useGame.getState() as unknown as Record<string, () => void>).castReroll(); });
    expect(useGame.getState().battle!.combatants[0].fortune, 'aucun Point de Chance débité').toBe(avant);
  });

  it('Test de compétence — seuil de DR exigé manqué (`requireSL`) : ni Relancer ni Résilience', () => {
    const h = mk('hero', { id: 'A', label: 'A' } as Partial<Combatant>);
    useGame.setState({
      ...arene(h),
      // d100 RÉUSSI (8 ≤ 40), seuil de DR exigé (3) manqué → `success` composé à false.
      pendingTest: { actorId: 'A', skillValue: 40, skillLabel: 'Athlétisme', difficulty: 'intermediaire',
        target: 40, requireSL: 3, roll: 8, sl: 1, success: false } as never,
    } as never);
    act(() => { root.render(<TestProbe />); });
    const b = [...host.querySelectorAll('button')].map((x) => x.textContent ?? '');
    expect(b.some((t) => /Relancer/.test(t)), 'le d100 est RÉUSSI : la Chance ne s’offre pas (LDB 17 l.23)').toBe(false);
    expect(b.some((t) => /Résilience/.test(t)), 'le d100 est RÉUSSI : la Résilience ne s’offre pas (LDB 17 l.68)').toBe(false);
    const avant = useGame.getState().battle!.combatants[0].fortune;
    act(() => { (useGame.getState() as unknown as Record<string, () => void>).testReroll(); });
    expect(useGame.getState().battle!.combatants[0].fortune, 'aucun Point de Chance débité').toBe(avant);
  });
});

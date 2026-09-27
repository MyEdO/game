// @vitest-environment jsdom
/**
 * #1005 — les affordances d'INFLUENCE de la rangée du LANCEUR appartiennent au siège qui PILOTE le
 * lanceur (`influencesLocally`). Montée pour de VRAI (patron `createRoot`/`act` du repo) : un lanceur
 * ENNEMI ne prête plus ses ressources au joueur (Résilience, +1 DR, Pacte, relance), un lanceur HÉROS
 * garde son cycle intact, et sous siège MJ (coop) seul le siège MJ tient la rangée.
 *
 * La mesure porte sur la RANGÉE DU LANCEUR (`.prow`[0]) : la fenêtre entière confondrait les rangées
 * des répondants, qui portent légitimement LEUR offre.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { seedBattleRng } from '../state/battleRng';
import { testScene } from '../scenes/test-fixture';
import { CastModal } from './CastModal';
import type { BattleState } from '../state/store';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, kind: 'hero' | 'enemy'): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [], advantage: 0, size: 'moyenne', pos: { x: kind === 'hero' ? 0 : 1, y: 0 }, wounds: { current: 18, max: 18 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } } as unknown as Combatant);

const SOLO = { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} };
const COOP = (mySeat: number, gmSeat: number) => ({ mode: 'host', mySeat, gmSeat, roomCode: 'AAAA', seatNames: {}, presence: {}, ownership: {} });

/** Jet FIGÉ du lanceur : `cast:false` ⇒ l'offre de Résilience est ARMÉE côté flux (sinon l'absence ne
 *  prouverait rien) ; `cast:true` sert de contre-mesure (le « +1 DR » ne dépend pas du verdict). */
const castResult = (cast: boolean) => ({ cast, roll: cast ? 20 : 45, target: 40, sl: cast ? 3 : 0, isCritical: false, isFumble: false, log: '' });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  seedBattleRng(7);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  // `net`/`mode`/`scene` REMIS avec les pendings : sous `isolate:false` le dernier état COOP fuiterait
  // dans le fichier suivant (flake d'ordre).
  useGame.setState({ pendingCast: null, pendingCastOpposition: null, pendingCounterspell: null, pendingCascade: null,
    battle: null, party: [], net: SOLO as never, mode: 'exploration', scene: null } as never);
});

/** Monte la modale d'incantation sur un lanceur donné et rend le TEXTE de la rangée du lanceur. */
function casterRow(casterKind: 'hero' | 'enemy', cast: boolean, net: unknown = SOLO): string {
  const H = mk('H', 'hero');
  const E = mk('E', 'enemy');
  const casterId = casterKind === 'hero' ? 'H' : 'E';
  useGame.setState({
    battle: { combatants: [H, E], order: ['H', 'E'], baseOrder: ['H', 'E'], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as unknown as BattleState,
    mode: 'battle', scene: testScene(), party: [H], net: net as never,
    pendingDefense: null, pendingAttack: null, pendingCascade: null, pendingCastOpposition: null, pendingCounterspell: null,
    pendingCast: { casterId, targetId: casterKind === 'hero' ? 'E' : 'H', spellId: 'drain', missile: false, focused: false,
      result: castResult(cast) } as never,
  });
  act(() => { root.render(<CastModal />); });
  return host.querySelectorAll('.prow')[0]?.textContent ?? '';
}

describe('#1005 — la rangée du lanceur n’offre ses influences qu’au siège qui le PILOTE', () => {
  it('lanceur ENNEMI en solo : AUCUNE affordance d’influence — que le sort ait RÉUSSI ou RATÉ', () => {
    const rate = casterRow('enemy', false);
    expect(rate, 'la Résilience de l’ennemi n’est pas la ressource du joueur').not.toContain('Résilience');
    expect(rate, 'la Chance de l’ennemi non plus').not.toContain('+1 DR');
    expect(rate).not.toContain('Relancer');
    expect(rate).not.toContain('Pacte');
    act(() => { root.unmount(); });
    root = createRoot(host);
    // Contre-mesure : sur un sort RÉUSSI le « +1 DR » serait offert sans le gate (il ne dépend pas du
    // verdict) — son absence ici ne peut donc pas s'expliquer par l'issue du jet.
    const reussi = casterRow('enemy', true);
    expect(reussi).not.toContain('+1 DR');
    expect(reussi).not.toContain('Résilience');
  });

  it('lanceur HÉROS en solo : le cycle d’influence reste INTACT (Résilience, +1 DR)', () => {
    const t = casterRow('hero', false);
    expect(t).toContain('Résilience ×2');
    expect(t).toContain('+1 DR ×2');
  });

  it('lanceur ENNEMI sous siège MJ : influences rendues au siège MJ, à lui SEUL', () => {
    const mj = casterRow('enemy', false, COOP(0, 0));
    expect(mj, 'le MJ conduit l’ennemi (bac-à-sable) : sa rangée est la sienne').toContain('Résilience ×2');
    expect(mj).toContain('+1 DR ×2');
    act(() => { root.unmount(); });
    root = createRoot(host);
    const joueur = casterRow('enemy', false, COOP(1, 0));
    expect(joueur, 'siège NON-MJ : la rangée de l’ennemi reste un témoin').not.toContain('Résilience');
    expect(joueur).not.toContain('+1 DR');
  });
});

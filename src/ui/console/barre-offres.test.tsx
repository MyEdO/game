// @vitest-environment jsdom
/**
 * L'ÉNUMÉRATION UNIQUE DES OFFRES (#2911, #2898 M1) : la pertinence d'une offre se décide au registre du noyau
 * (`GATES_DE_PERTINENCE`, sélecteurs de candidats), et la barre de la console comme l'hôte texte lisent la même
 * énumération (`offresDeLActif`). Contrat : sur quatre porteurs nommés — à pied, en selle, à un poste, une coque de
 * navire —, l'énumérateur rend EXACTEMENT les actions attendues, et la barre montée au DOM n'a une case que pour une
 * action offerte, avec toutes les cases de situation (geste d'état, cases navales) que l'énumérateur offre.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../../state/store';
import type { BattleState } from '../../noyau/etat';
import type { Combatant, ShipPoste } from '../../engine/types';
import { findVehicleById } from '../../data/index';
import { vehicleCombatant } from '../../engine/vehicle';
import { emptyScene } from '../../noyau/monde/scene';
import { offresDeLActif } from '../../noyau/actionRegistry';
import { CombatConsole } from './CombatConsole';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CHARS = {
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 40, endurance: 30, initiative: 30,
  agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
};

/** Un porteur nu : ni arme, ni objet, ni Compétence, ni talent — seule sa situation compte. */
const porteur = (id: string, over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id, label: id, name: id, kind: 'hero', pos: { x: 5, y: 5 }, size: 'moyenne', characteristics: CHARS,
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], weapons: [], items: [],
    skills: [], talents: [], armour: {}, movement: 4, loaded: true, ...over,
  })) as unknown as Combatant;

/** Une pièce de bord déchargée servie par son chef. */
const poste = (): ShipPoste =>
  ({
    side: 'tribord', loaded: false, reloadProgress: 0, crewIds: ['gunner'],
    item: { uid: 'canon', label: 'Canon moyen', type: 'ranged', damage: { flat: 14, plusBF: false }, range: 75, qualities: [{ id: 'recharge', value: 6 }] },
  }) as unknown as ShipPoste;

/** La coque du groupe (`vehicles.json`, facette `hull`), active, servie par son artilleur. */
function coque(): Combatant {
  const hull = vehicleCombatant(findVehicleById('bateau-de-patrouille')!)!;
  return Object.assign(hull, { id: 'ship', kind: 'hero', pos: { x: 5, y: 5 }, crewIds: ['gunner'], postes: [poste()] });
}

/** Le combat de l'actif `actif` (en tête d'ordre), avec `autres`. */
const combat = (actif: Combatant, autres: Combatant[]): BattleState =>
  ({
    combatants: [actif, ...autres], order: [actif.id, ...autres.map((c) => c.id)], baseOrder: [actif.id, ...autres.map((c) => c.id)],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
    acted: false, runBudget: 4, log: [], over: null, crewActed: {},
  }) as unknown as BattleState;

const adversaire = () => porteur('e1', { kind: 'enemy', pos: { x: 9, y: 9 } });

/** Les quatre porteurs nommés : l'actif et son combat. */
const FIXTURES: Record<string, () => BattleState> = {
  'à pied': () => combat(porteur('h1'), [adversaire()]),
  'en selle': () => combat(porteur('h1', { mountId: 'mule' }), [adversaire()]),
  'à un poste': () => combat(porteur('h1', { mannedPoste: poste() }), [adversaire()]),
  'une coque de navire': () => combat(coque(), [porteur('gunner'), adversaire()]),
};

/** Le corps et la défense : offerts à tout porteur, fermés pour une coque (`fantassin`) ; la Détermination ; la fin
 *  de tour. */
const CORPS = ['course', 'mouvement', 'defend'];
const DETERMINATION = ['resolve-psych-immune', 'resolve-ignore-crit'];
const FIN = ['undo-move', 'end-turn', 'raise-hand'];

/** L'énumération attendue par porteur, dans l'ordre du registre (`actions.json`). L'attaque et la Charge sont
 *  celles d'un fantassin ; le geste d'état, celui de sa situation ; les cases navales, celles de la coque, qui
 *  sert aussi sa pièce de bord (`pieces-servables`). */
const ATTENDU: Record<string, string[]> = {
  'à pied': ['attaque', 'charge', ...CORPS, ...DETERMINATION, ...FIN],
  'en selle': ['attaque', 'charge', ...CORPS, ...DETERMINATION, 'dismount', ...FIN],
  'à un poste': ['attaque', 'charge', ...CORPS, ...DETERMINATION, 'leave-poste', ...FIN],
  'une coque de navire': [...CORPS, ...DETERMINATION, 'man-poste', 'maneuver-ship', 'battery', 'crew-test-rude-epreuve', 'sing-shanty', 'ship-reload', ...FIN],
};

const enumeration = (battle: BattleState) => {
  const active = battle.combatants[0];
  return offresDeLActif({ active, battle, netMode: 'local', gameTime: useGame.getState().gameTime }).map((o) => o.actionId);
};

describe('l’énumérateur rend exactement les offres pertinentes du porteur', () => {
  it.each(Object.keys(FIXTURES))('%s', (nom) => {
    expect(enumeration(FIXTURES[nom]())).toEqual(ATTENDU[nom]);
  });
});

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
  useGame.setState({ battle: null, party: [] });
});

/** Les cases de la barre portées par une action (`data-action`). */
const casesDeLaBarre = () =>
  new Set([...host.querySelectorAll('.combat-console [data-action]')].map((c) => c.getAttribute('data-action')!));

/** Les cases que la SITUATION ouvre : gestes d'état et cases navales. */
const DE_SITUATION = ['dismount', 'leave-poste', 'maneuver-ship', 'battery', 'crew-test-rude-epreuve', 'sing-shanty', 'ship-reload'];

describe('la barre de la console lit l’énumérateur', () => {
  it.each(Object.keys(FIXTURES))('%s : une case n’existe que pour une offre, et chaque offre de situation a sa case', (nom) => {
    const battle = FIXTURES[nom]();
    act(() => {
      useGame.setState({ party: battle.combatants.filter((c) => c.kind === 'hero'), scene: emptyScene('scene-test', 20, 20), battle });
    });
    act(() => { root.render(<CombatConsole />); });
    expect(host.querySelector('.combat-console')!.getAttribute('data-forme'), 'témoin : la barre est ouverte').toBe('complete');
    const offertes = new Set(enumeration(battle));
    const cases = casesDeLaBarre();
    expect([...cases].filter((id) => !offertes.has(id)), 'une case de la barre sans offre de l’énumérateur').toEqual([]);
    expect(DE_SITUATION.filter((id) => offertes.has(id) && !cases.has(id)), 'une offre de situation sans case').toEqual([]);
  });
});

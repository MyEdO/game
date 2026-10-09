// @vitest-environment jsdom
/**
 * CASES FERMÉES DE LA CONSOLE — le refus vit au REGISTRE (`actionGate`, #1678 L3a) : la console montée
 * sur le vrai store, une matrice de héros réels (`createHero`), aucun module mocké.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, type BattleState } from '../state/store';
import { createHero } from '../engine/character';
import type { Combatant, ItemInstance } from '../engine/types';
import { itemFromTrappingById, recomputeLoadout, loadWeapon } from '../engine/items';
import { ACTIONS, findConditionById } from '../data/index';
import { actionGate } from '../state/actionRegistry';
import { t } from '../i18n';
import { CombatConsole } from './CombatConsole';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function objet(id: string, uid: string, over: Partial<ItemInstance> = {}): ItemInstance {
  const it = itemFromTrappingById(id);
  if (!it) throw new Error(`objet absent : ${id}`);
  return Object.assign(it, { uid }, over);
}

function heros(set: string): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 7 });
  h.id = 'h1';
  h.pos = { x: 5, y: 5 };
  h.conditions = [];
  h.psychState = [];
  h.items = [
    objet('dague', 'i-dague'),
    objet('arbalete-lourde', 'i-arb', { loaded: false, reloadProgress: 0 }),
    objet('carreau', 'i-c', { qty: 12 }),
    objet('carreau', 'i-c2', { label: 'Carreau perçant', qty: 5 }),
    objet('potion-de-guerison', 'i-po'),
  ];
  h.loadouts = [{ id: 'lo-melee', main: 'i-dague' }, { id: 'lo-tir', main: 'i-arb' }] as Combatant['loadouts'];
  h.activeLoadoutId = set;
  recomputeLoadout(h);
  h.talents = [...(h.talents ?? []), { talentId: 'battement', times: 1 }, { talentId: 'distraire', times: 1 }] as Combatant['talents'];
  h.spells = ['arme-aethyrique'];
  h.resolve = 2;
  h.advantage = 0;
  return h;
}

function adversaire(engage: boolean): Combatant {
  const e = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Rat', seed: 8 });
  e.id = 'e1';
  e.kind = 'enemy';
  e.pos = engage ? { x: 6, y: 5 } : { x: 12, y: 5 };
  e.conditions = [];
  e.advantage = 0;
  return e;
}

/** SITUATIONS du porteur ; rendre `true` = Action déjà dépensée. */
const SITUATIONS: [string, (h: Combatant) => boolean | void][] = [
  ['base', () => {}],
  ['action-depensee', () => true],
  ['sonne', (h) => { h.conditions = [{ id: 'sonne', value: 1 }] as Combatant['conditions']; }],
  ['frenesie', (h) => { h.psychState = [{ type: 'frenesie' }] as Combatant['psychState']; }],
  ['brise', (h) => { h.conditions = [{ id: 'brise', value: 1 }] as Combatant['conditions']; }],
  ['en-joue', (h) => { h.aiming = true; }],
  ['arme-chargee', (h) => { loadWeapon(h, h.weapons.find((w) => w.type === 'ranged')!); }],
];
const MATRICE = ['lo-melee', 'lo-tir'].flatMap((set) =>
  [false, true].flatMap((engage) => SITUATIONS.map(([nom, prep]) => ({ cle: `${set}|${engage ? 'engage' : 'loin'}|${nom}`, set, engage, prep }))),
);

/** Cases FERMÉES mesurées sur la console AVANT #1678 L3a (sonde `cases.probe.ts`, HEAD 43c2e4e5a) :
 *  `actionId#data-cell`. */
const FERMEES_AVANT: Record<string, string[]> = {
  'lo-melee|loin|base': ['battement#battement'],
  'lo-melee|loin|action-depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'lo-melee|loin|sonne': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'lo-melee|loin|frenesie': ['battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'use-item#q-objet-potion-de-guerison'],
  'lo-melee|loin|brise': ['battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'lo-melee|loin|en-joue': ['battement#battement'],
  'lo-melee|loin|arme-chargee': ['battement#battement'],
  'lo-melee|engage|base': ['charge#g2-charge'],
  'lo-melee|engage|action-depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'lo-melee|engage|sonne': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'lo-melee|engage|frenesie': ['battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'use-item#q-objet-potion-de-guerison'],
  'lo-melee|engage|brise': ['battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'lo-melee|engage|en-joue': ['charge#g2-charge'],
  'lo-melee|engage|arme-chargee': ['charge#g2-charge'],
  'lo-tir|loin|base': ['battement#battement', 'posture-tas#g5-posture-tas'],
  'lo-tir|loin|action-depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'lo-tir|loin|sonne': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'lo-tir|loin|frenesie': ['aim#g3-viser', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'posture-tas#g5-posture-tas', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'lo-tir|loin|brise': ['aim#g3-viser', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'lo-tir|loin|en-joue': ['aim#g3-viser', 'battement#battement', 'posture-tas#g5-posture-tas'],
  'lo-tir|loin|arme-chargee': ['battement#battement', 'posture-tas#g5-posture-tas', 'reload#g4-recharger'],
  'lo-tir|engage|base': ['posture-tas#g5-posture-tas'],
  'lo-tir|engage|action-depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'lo-tir|engage|sonne': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'lo-tir|engage|frenesie': ['aim#g3-viser', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'posture-tas#g5-posture-tas', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'lo-tir|engage|brise': ['aim#g3-viser', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'lo-tir|engage|en-joue': ['aim#g3-viser', 'posture-tas#g5-posture-tas'],
  'lo-tir|engage|arme-chargee': ['posture-tas#g5-posture-tas', 'reload#g4-recharger'],
};

/** Cases fermées SANS raison propre : refus de SITE (`off`, `CombatConsole.tsx`), #1678 L3b. */
const MUETTES_DECLAREES: Record<string, (situation: string) => boolean> = {
  distraire: (s) => s === 'action-depensee' || s === 'sonne',
  aim: (s) => s === 'en-joue',
  reload: (s) => s === 'arme-chargee',
};

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
  useGame.setState({ battle: null });
});

interface CaseLue { cle: string; actionId: string; fermee: boolean; raison: string | null }

function monter(set: string, engage: boolean, prep: (h: Combatant) => boolean | void): CaseLue[] {
  const h = heros(set);
  const f = adversaire(engage);
  if (engage) { h.engagedWith = [f.id]; f.engagedWith = [h.id]; }
  const acted = prep(h) === true;
  act(() => {
    useGame.setState({
      party: [h], localIntent: null, pendingAttack: null, pendingCascade: null,
      battle: {
        combatants: [h, f], order: [h.id, f.id], baseOrder: [h.id, f.id], turn: 0, round: 1, action: null,
        selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted, runBudget: 4, log: [], over: null,
      } as unknown as BattleState,
    });
  });
  act(() => { root.render(<CombatConsole />); });
  return [...host.querySelectorAll('.combat-console button.cc-cell[data-action]')].map((b) => {
    const g = b.querySelector('[data-gate]:not([data-gate-2e])');
    return {
      cle: `${b.getAttribute('data-action')}#${b.getAttribute('data-cell')}`,
      actionId: b.getAttribute('data-action')!,
      fermee: b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true',
      raison: g?.textContent ?? null,
    };
  });
}

const raisonBrise = () => t('agate.actionLocked', { etat: findConditionById('brise')!.label });

describe('cases fermées de la console — le refus vit au registre (#1678 L3a)', () => {
  it.each(MATRICE)('$cle : toute case fermée AVANT l’est encore', ({ cle, set, engage, prep }) => {
    const fermees = new Set(monter(set, engage, prep).filter((c) => c.fermee).map((c) => c.cle));
    expect(FERMEES_AVANT[cle].filter((k) => !fermees.has(k))).toEqual([]);
  });

  it.each(MATRICE)('$cle : toute case fermée porte SA raison', ({ cle, set, engage, prep }) => {
    const situation = cle.split('|')[2];
    const muettes = monter(set, engage, prep)
      .filter((c) => c.fermee && !c.raison && !MUETTES_DECLAREES[c.actionId]?.(situation))
      .map((c) => c.cle);
    expect(muettes).toEqual([]);
  });

  it('Brisé (LDB 16 l.52) : G1 et la Charge se ferment en nommant l’État, la fuite reste ouverte', () => {
    const cases = monter('lo-melee', false, (h) => { h.conditions = [{ id: 'brise', value: 1 }] as Combatant['conditions']; });
    const parId = (id: string) => cases.find((c) => c.actionId === id)!;
    for (const id of ['attaque', 'charge']) {
      expect(parId(id).fermee, id).toBe(true);
      expect(parId(id).raison, id).toBe(raisonBrise());
    }
    for (const id of ['course', 'mouvement', 'end-turn']) expect(parId(id).fermee, id).toBe(false);
  });

  it.each([
    ['À Terre', 'a-terre', 'stand'],
    ['Empêtré', 'empetre', 'free-entangle'],
  ])('Brisé + %s (LDB 16 l.35, l.64-66) : le geste qui rend la fuite possible reste ouvert', (_nom, etat, remede) => {
    const cases = monter('lo-melee', false, (h) => {
      h.conditions = [{ id: 'brise', value: 1 }, { id: etat, value: 1 }] as Combatant['conditions'];
    });
    const parId = (id: string) => cases.find((c) => c.actionId === id);
    expect(parId(remede), `case ${remede} absente`).toBeDefined();
    expect(parId(remede)!.fermee, remede).toBe(false);
    expect(parId('attaque')!.raison).toBe(raisonBrise());
  });
});

describe('verrou d’État d’`actionGate` — toute entrée, sauf celles qui déclarent `echappeAuVerrou`', () => {
  it('sous Brisé, chaque entrée du registre se ferme ou échappe selon SA donnée', () => {
    const h = heros('lo-melee');
    h.conditions = [{ id: 'brise', value: 1 }] as Combatant['conditions'];
    const f = adversaire(true);
    h.engagedWith = [f.id];
    f.engagedWith = [h.id];
    const battle = {
      combatants: [h, f], order: [h.id, f.id], baseOrder: [h.id, f.id], turn: 0, round: 1, action: null,
      selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, runBudget: 4, log: [], over: null,
    } as unknown as BattleState;
    const ecarts = ACTIONS.flatMap((def) => {
      const v = actionGate(def.id, { active: h, battle, netMode: 'local' });
      const verrouillee = !v.ok && v.reason === raisonBrise();
      return verrouillee === !def.echappeAuVerrou ? [] : [`${def.id} (${def.echappeAuVerrou ?? 'sans échappement'}) → ${v.ok ? 'ouverte' : v.reason}`];
    });
    expect(ecarts).toEqual([]);
  });
});

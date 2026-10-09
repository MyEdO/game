// @vitest-environment jsdom
/**
 * CASES FERMÉES DE LA CONSOLE — le refus vit au REGISTRE (`actionGate`, #1678 L3a, L3b) : la console
 * montée sur le vrai store, une matrice de héros réels (`createHero`) et une coque réelle
 * (`vehicleCombatant`), aucun module mocké.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, type BattleState } from '../state/store';
import { createHero } from '../engine/character';
import type { Combatant, ItemInstance, ShipPoste } from '../engine/types';
import { itemFromTrappingById, recomputeLoadout, loadWeapon } from '../engine/items';
import { ACTIONS, findConditionById, findVehicleById } from '../data/index';
import { actionGate, runAction } from '../state/actionRegistry';
import { quartIndex } from '../state/shipCrew';
import { vehicleCombatant } from '../engine/vehicle';
import { emptyScene } from '../state/scene';
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

const etats = (...ids: string[]) => (h: Combatant) => { h.conditions = ids.map((id) => ({ id, value: 1 })) as Combatant['conditions']; };
const frenetique = (h: Combatant) => { h.psychState = [{ type: 'frenesie' }] as Combatant['psychState']; };
const charger = (h: Combatant) => { loadWeapon(h, h.weapons.find((w) => w.type === 'ranged')!); };

/** SITUATIONS du porteur ; rendre `true` = Action déjà dépensée. */
const SITUATIONS: [string, (h: Combatant) => boolean | void][] = [
  ['base', () => {}],
  ['action-depensee', () => true],
  ['sonne', etats('sonne')],
  ['frenesie', frenetique],
  ['brise', etats('brise')],
  ['en-joue', (h) => { h.aiming = true; }],
  ['arme-chargee', charger],
  ['empetre', etats('empetre')],
  ['a-terre', etats('a-terre')],
  ['brise+a-terre', etats('brise', 'a-terre')],
  ['brise+empetre', etats('brise', 'empetre')],
  ['a-terre+depensee', (h) => { etats('a-terre')(h); return true; }],
  ['empetre+depensee', (h) => { etats('empetre')(h); return true; }],
  ['sonne+avantage', (h) => { etats('sonne')(h); h.advantage = 3; }],
  ['surpris', etats('surpris')],
  ['frenesie+chargee', (h) => { frenetique(h); charger(h); }],
  ['sonne+en-joue', (h) => { etats('sonne')(h); h.aiming = true; }],
];
/** `runBudget` : 4 = fixture d'une Course déjà réussie ; `null` = tour réel, aucune Course. */
const MATRICE = ([4, null] as const).flatMap((runBudget) => ['lo-melee', 'lo-tir'].flatMap((set) =>
  [false, true].flatMap((engage) => SITUATIONS.map(([nom, prep]) => ({ cle: `rb${runBudget}|${set}|${engage ? 'engage' : 'loin'}|${nom}`, set, engage, prep, runBudget }))),
));

/** Cases FERMÉES mesurées sur la console à HEAD 701de5a25 (L3a, AVANT L3b ; sonde du juge de diff,
 *  `parite.probe.tsx`) : `actionId#data-cell`. */
const FERMEES_AVANT: Record<string, string[]> = {
  'rb4|lo-melee|loin|base': ['battement#battement'],
  'rb4|lo-melee|loin|action-depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|loin|sonne': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|loin|frenesie': ['battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|loin|brise': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|loin|en-joue': ['battement#battement'],
  'rb4|lo-melee|loin|arme-chargee': ['battement#battement'],
  'rb4|lo-melee|loin|empetre': ['battement#battement', 'charge#g2-charge', 'distraire#distraire'],
  'rb4|lo-melee|loin|a-terre': ['battement#battement'],
  'rb4|lo-melee|loin|brise+a-terre': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|loin|brise+empetre': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|loin|a-terre+depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|loin|empetre+depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'free-entangle#free-entangle', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|loin|sonne+avantage': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|loin|surpris': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|loin|frenesie+chargee': ['battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|loin|sonne+en-joue': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|engage|base': ['charge#g2-charge'],
  'rb4|lo-melee|engage|action-depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|engage|sonne': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|engage|frenesie': ['battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|engage|brise': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|engage|en-joue': ['charge#g2-charge'],
  'rb4|lo-melee|engage|arme-chargee': ['charge#g2-charge'],
  'rb4|lo-melee|engage|empetre': ['charge#g2-charge', 'distraire#distraire'],
  'rb4|lo-melee|engage|a-terre': ['charge#g2-charge'],
  'rb4|lo-melee|engage|brise+a-terre': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|engage|brise+empetre': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|engage|a-terre+depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|engage|empetre+depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'free-entangle#free-entangle', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|engage|sonne+avantage': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|engage|surpris': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|engage|frenesie+chargee': ['battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-melee|engage|sonne+en-joue': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|loin|base': ['battement#battement', 'posture-tas#g5-posture-tas'],
  'rb4|lo-tir|loin|action-depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|loin|sonne': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|loin|frenesie': ['aim#g3-viser', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'posture-tas#g5-posture-tas', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|loin|brise': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|loin|en-joue': ['aim#g3-viser', 'battement#battement', 'posture-tas#g5-posture-tas'],
  'rb4|lo-tir|loin|arme-chargee': ['battement#battement', 'posture-tas#g5-posture-tas', 'reload#g4-recharger'],
  'rb4|lo-tir|loin|empetre': ['battement#battement', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture'],
  'rb4|lo-tir|loin|a-terre': ['battement#battement', 'posture-tas#g5-posture-tas'],
  'rb4|lo-tir|loin|brise+a-terre': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|loin|brise+empetre': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|loin|a-terre+depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|loin|empetre+depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'free-entangle#free-entangle', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|loin|sonne+avantage': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|loin|surpris': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|loin|frenesie+chargee': ['aim#g3-viser', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'posture-tas#g5-posture-tas', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|loin|sonne+en-joue': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|engage|base': ['posture-tas#g5-posture-tas'],
  'rb4|lo-tir|engage|action-depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|engage|sonne': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|engage|frenesie': ['aim#g3-viser', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'posture-tas#g5-posture-tas', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|engage|brise': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|engage|en-joue': ['aim#g3-viser', 'posture-tas#g5-posture-tas'],
  'rb4|lo-tir|engage|arme-chargee': ['posture-tas#g5-posture-tas', 'reload#g4-recharger'],
  'rb4|lo-tir|engage|empetre': ['distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture'],
  'rb4|lo-tir|engage|a-terre': ['posture-tas#g5-posture-tas'],
  'rb4|lo-tir|engage|brise+a-terre': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|engage|brise+empetre': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|engage|a-terre+depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|engage|empetre+depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'free-entangle#free-entangle', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|engage|sonne+avantage': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|engage|surpris': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|engage|frenesie+chargee': ['aim#g3-viser', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'posture-tas#g5-posture-tas', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rb4|lo-tir|engage|sonne+en-joue': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|loin|base': ['battement#battement'],
  'rbnull|lo-melee|loin|action-depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|loin|sonne': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|loin|frenesie': ['battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|loin|brise': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|loin|en-joue': ['battement#battement'],
  'rbnull|lo-melee|loin|arme-chargee': ['battement#battement'],
  'rbnull|lo-melee|loin|empetre': ['battement#battement', 'charge#g2-charge', 'course#course', 'distraire#distraire', 'mouvement#mouvement'],
  'rbnull|lo-melee|loin|a-terre': ['battement#battement'],
  'rbnull|lo-melee|loin|brise+a-terre': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|loin|brise+empetre': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'course#course', 'defend#defend', 'distraire#distraire', 'mouvement#mouvement', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|loin|a-terre+depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|loin|empetre+depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'course#course', 'defend#defend', 'distraire#distraire', 'free-entangle#free-entangle', 'mouvement#mouvement', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|loin|sonne+avantage': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|loin|surpris': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'course#course', 'defend#defend', 'distraire#distraire', 'mouvement#mouvement', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|loin|frenesie+chargee': ['battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|loin|sonne+en-joue': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|engage|base': ['charge#g2-charge'],
  'rbnull|lo-melee|engage|action-depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|engage|sonne': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|engage|frenesie': ['battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|engage|brise': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|engage|en-joue': ['charge#g2-charge'],
  'rbnull|lo-melee|engage|arme-chargee': ['charge#g2-charge'],
  'rbnull|lo-melee|engage|empetre': ['charge#g2-charge', 'course#course', 'distraire#distraire', 'mouvement#mouvement'],
  'rbnull|lo-melee|engage|a-terre': ['charge#g2-charge'],
  'rbnull|lo-melee|engage|brise+a-terre': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|engage|brise+empetre': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'course#course', 'defend#defend', 'distraire#distraire', 'mouvement#mouvement', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|engage|a-terre+depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|engage|empetre+depensee': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'course#course', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'free-entangle#free-entangle', 'mouvement#mouvement', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|engage|sonne+avantage': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|engage|surpris': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'course#course', 'defend#defend', 'distraire#distraire', 'mouvement#mouvement', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|engage|frenesie+chargee': ['battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-melee|engage|sonne+en-joue': ['attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'charge#g2-charge', 'defend#defend', 'distraire#distraire', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|loin|base': ['battement#battement', 'posture-tas#g5-posture-tas'],
  'rbnull|lo-tir|loin|action-depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|loin|sonne': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|loin|frenesie': ['aim#g3-viser', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'posture-tas#g5-posture-tas', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|loin|brise': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|loin|en-joue': ['aim#g3-viser', 'battement#battement', 'posture-tas#g5-posture-tas'],
  'rbnull|lo-tir|loin|arme-chargee': ['battement#battement', 'posture-tas#g5-posture-tas', 'reload#g4-recharger'],
  'rbnull|lo-tir|loin|empetre': ['battement#battement', 'course#course', 'distraire#distraire', 'mouvement#mouvement', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture'],
  'rbnull|lo-tir|loin|a-terre': ['battement#battement', 'posture-tas#g5-posture-tas'],
  'rbnull|lo-tir|loin|brise+a-terre': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|loin|brise+empetre': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'course#course', 'defend#defend', 'distraire#distraire', 'mouvement#mouvement', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|loin|a-terre+depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|loin|empetre+depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'course#course', 'defend#defend', 'distraire#distraire', 'free-entangle#free-entangle', 'mouvement#mouvement', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|loin|sonne+avantage': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|loin|surpris': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'course#course', 'defend#defend', 'distraire#distraire', 'mouvement#mouvement', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|loin|frenesie+chargee': ['aim#g3-viser', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'posture-tas#g5-posture-tas', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|loin|sonne+en-joue': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|engage|base': ['posture-tas#g5-posture-tas'],
  'rbnull|lo-tir|engage|action-depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|engage|sonne': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|engage|frenesie': ['aim#g3-viser', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'posture-tas#g5-posture-tas', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|engage|brise': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|engage|en-joue': ['aim#g3-viser', 'posture-tas#g5-posture-tas'],
  'rbnull|lo-tir|engage|arme-chargee': ['posture-tas#g5-posture-tas', 'reload#g4-recharger'],
  'rbnull|lo-tir|engage|empetre': ['course#course', 'distraire#distraire', 'mouvement#mouvement', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture'],
  'rbnull|lo-tir|engage|a-terre': ['posture-tas#g5-posture-tas'],
  'rbnull|lo-tir|engage|brise+a-terre': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|engage|brise+empetre': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'course#course', 'defend#defend', 'distraire#distraire', 'mouvement#mouvement', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|engage|a-terre+depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|engage|empetre+depensee': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'course#course', 'defend#defend', 'disengage#disengage', 'distraire#distraire', 'free-entangle#free-entangle', 'mouvement#mouvement', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|engage|sonne+avantage': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|engage|surpris': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'course#course', 'defend#defend', 'distraire#distraire', 'mouvement#mouvement', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|engage|frenesie+chargee': ['aim#g3-viser', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'posture-tas#g5-posture-tas', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
  'rbnull|lo-tir|engage|sonne+en-joue': ['aim#g3-viser', 'attaque#g1-attaque', 'battement#battement', 'cast-spell#sort-arme-aethyrique', 'defend#defend', 'distraire#distraire', 'posture-tas#g5-posture-tas', 'posture-tir#g5-posture', 'reload#g4-recharger', 'use-item#q-objet-potion-de-guerison'],
};

/** RÉOUVERTURES déclarées : Distraire se paie en Mouvement (AA 13 l.51), ni l'Action dépensée ni Sonné
 *  ne la ferment. */
const REOUVERTES_DECLAREES: Record<string, (situation: string) => boolean> = {
  'distraire#distraire': (s) => s.includes('depensee') || s.startsWith('sonne'),
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

function monter(set: string, engage: boolean, prep: (h: Combatant) => boolean | void, runBudget: number | null = 4): CaseLue[] {
  const h = heros(set);
  const f = adversaire(engage);
  if (engage) { h.engagedWith = [f.id]; f.engagedWith = [h.id]; }
  const acted = prep(h) === true;
  act(() => {
    useGame.setState({
      party: [h], scene: emptyScene(20, 20), localIntent: null, pendingAttack: null, pendingCascade: null,
      battle: {
        combatants: [h, f], order: [h.id, f.id], baseOrder: [h.id, f.id], turn: 0, round: 1, action: null,
        selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted, runBudget, log: [], over: null,
      } as unknown as BattleState,
    });
  });
  act(() => { root.render(<CombatConsole />); });
  return lireCases();
}

function lireCases(): CaseLue[] {
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
  it.each(MATRICE)('$cle : toute case fermée AVANT l’est encore', ({ cle, set, engage, prep, runBudget }) => {
    const situation = cle.split('|')[3];
    const fermees = new Set(monter(set, engage, prep, runBudget).filter((c) => c.fermee).map((c) => c.cle));
    expect(FERMEES_AVANT[cle].filter((k) => !fermees.has(k) && !REOUVERTES_DECLAREES[k]?.(situation))).toEqual([]);
  });

  it.each(MATRICE)('$cle : toute case fermée porte SA raison', ({ set, engage, prep, runBudget }) => {
    expect(monter(set, engage, prep, runBudget).filter((c) => c.fermee && !c.raison).map((c) => c.cle)).toEqual([]);
  });

  it.each([
    ['action-depensee', (): boolean => true],
    ['sonne', (h: Combatant) => { h.conditions = [{ id: 'sonne', value: 1 }] as Combatant['conditions']; }],
  ] as const)('Distraire (AA 13 l.51) reste ouverte en %s', (_nom, prep) => {
    const distraire = monter('lo-melee', false, prep).find((c) => c.actionId === 'distraire')!;
    expect(distraire.fermee).toBe(false);
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
      const v = actionGate(def.id, { active: h, battle, netMode: 'local', gameTime: 0 });
      const verrouillee = !v.ok && v.reason === raisonBrise();
      return verrouillee === !def.echappeAuVerrou ? [] : [`${def.id} (${def.echappeAuVerrou ?? 'sans échappement'}) → ${v.ok ? 'ouverte' : v.reason}`];
    });
    expect(ecarts).toEqual([]);
  });
});

/** La pièce de bord du chef `gunner`. */
const poste = (loaded: boolean): ShipPoste =>
  ({
    side: 'tribord', loaded, reloadProgress: 0, crewIds: ['gunner'],
    item: { uid: 'canon', label: 'Canon moyen', type: 'ranged', damage: { flat: 14, plusBF: false }, range: 75, qualities: [{ id: 'recharge', value: 6 }] },
  }) as unknown as ShipPoste;

/** SITUATIONS de la coque : ses pièces, l'Action du navire, et un marin qui connaît une Chanson de marin
 *  (MDG 09 l.32-40). `avant` : cases fermées à HEAD 701de5a25 (sonde du juge de diff). */
interface SituationNavire { nom: string; postes: ShipPoste[]; acted: boolean; chanteur?: (c: Combatant) => void; quartChante?: boolean; avant: string[] }
const NAVIRE: SituationNavire[] = [
  { nom: 'base', postes: [poste(false)], acted: false, avant: ['course#course', 'defend#defend', 'mouvement#mouvement', 'resolve-ignore-crit#resolve-ignore-crit', 'resolve-psych-immune#resolve-psych-immune', 'sing-shanty#sing-shanty'] },
  { nom: 'piece-chargee', postes: [poste(true)], acted: false, avant: ['course#course', 'defend#defend', 'mouvement#mouvement', 'resolve-ignore-crit#resolve-ignore-crit', 'resolve-psych-immune#resolve-psych-immune', 'ship-reload#ship-reload', 'sing-shanty#sing-shanty'] },
  { nom: 'sans-poste', postes: [], acted: false, avant: ['battery#battery', 'course#course', 'defend#defend', 'mouvement#mouvement', 'resolve-ignore-crit#resolve-ignore-crit', 'resolve-psych-immune#resolve-psych-immune', 'ship-reload#ship-reload', 'sing-shanty#sing-shanty'] },
  { nom: 'action-depensee', postes: [poste(false)], acted: true, avant: ['battery#battery', 'course#course', 'crew-test-rude-epreuve#crew-test-rude-epreuve', 'defend#defend', 'maneuver-ship#maneuver-ship', 'mouvement#mouvement', 'resolve-ignore-crit#resolve-ignore-crit', 'resolve-psych-immune#resolve-psych-immune', 'sing-shanty#sing-shanty'] },
  { nom: 'chanteur', postes: [poste(false)], acted: false, chanteur: () => {}, avant: ['course#course', 'defend#defend', 'mouvement#mouvement', 'resolve-ignore-crit#resolve-ignore-crit', 'resolve-psych-immune#resolve-psych-immune'] },
  { nom: 'chanteur-quart-chante', postes: [poste(false)], acted: false, chanteur: () => {}, quartChante: true, avant: ['course#course', 'defend#defend', 'mouvement#mouvement', 'resolve-ignore-crit#resolve-ignore-crit', 'resolve-psych-immune#resolve-psych-immune', 'sing-shanty#sing-shanty'] },
  { nom: 'chanteur-inconscient', postes: [poste(false)], acted: false, chanteur: etats('inconscient'), avant: ['course#course', 'defend#defend', 'mouvement#mouvement', 'resolve-ignore-crit#resolve-ignore-crit', 'resolve-psych-immune#resolve-psych-immune', 'sing-shanty#sing-shanty'] },
  { nom: 'chanteur-0-blessure', postes: [poste(false)], acted: false, chanteur: (c) => { c.wounds.current = 0; }, avant: ['course#course', 'defend#defend', 'mouvement#mouvement', 'resolve-ignore-crit#resolve-ignore-crit', 'resolve-psych-immune#resolve-psych-immune'] },
  { nom: 'chanteur-hors-rencontre', postes: [poste(false)], acted: false, chanteur: (c) => { c.outOfRencontre = true; }, avant: ['course#course', 'defend#defend', 'mouvement#mouvement', 'resolve-ignore-crit#resolve-ignore-crit', 'resolve-psych-immune#resolve-psych-immune', 'sing-shanty#sing-shanty'] },
  { nom: 'chanteur-brise', postes: [poste(false)], acted: false, chanteur: etats('brise'), avant: ['course#course', 'defend#defend', 'mouvement#mouvement', 'resolve-ignore-crit#resolve-ignore-crit', 'resolve-psych-immune#resolve-psych-immune'] },
];

/** L'heure de jeu des montages de coque : 10h. */
const HEURE = 600;

function monterNavire({ postes, acted, chanteur, quartChante }: Omit<SituationNavire, 'nom' | 'avant'>): CaseLue[] {
  const crew = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Artilleur', seed: 9 });
  crew.id = 'gunner';
  crew.pos = { x: 6, y: 6 };
  crew.conditions = [];
  const ship = vehicleCombatant(findVehicleById('bateau-de-patrouille')!)!;
  ship.id = 'ship';
  ship.kind = 'hero';
  ship.pos = { x: 5, y: 5 };
  ship.crewIds = ['gunner'];
  ship.postes = postes;
  const combattants: Combatant[] = [ship, crew];
  if (chanteur) {
    const c = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Chanteur', seed: 11 });
    c.id = 'singer';
    c.pos = { x: 7, y: 6 };
    c.conditions = [];
    c.talents = [...(c.talents ?? []), { talentId: 'chanson-de-marin', spec: 'naviguons-tous-ensemble', times: 1 }] as Combatant['talents'];
    chanteur(c);
    combattants.push(c);
    ship.crewIds.push(c.id);
  }
  if (quartChante) ship.lastShantyQuart = quartIndex(HEURE);
  act(() => {
    useGame.setState({
      party: combattants.slice(1), gameTime: HEURE, scene: emptyScene(20, 20), localIntent: null,
      battle: {
        combatants: combattants, order: combattants.map((c) => c.id), baseOrder: combattants.map((c) => c.id), turn: 0, round: 1, action: null,
        selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted, runBudget: 4, log: [], over: null, crewActed: {},
      } as unknown as BattleState,
    });
  });
  act(() => { root.render(<CombatConsole />); });
  return lireCases();
}

describe('cases fermées de la COQUE — chant, recharge et Bordée au registre (#1678 L3b)', () => {
  it.each(NAVIRE)('navire $nom : toute case fermée AVANT l’est encore, et porte SA raison', ({ avant, ...situation }) => {
    const cases = monterNavire(situation);
    const fermees = new Set(cases.filter((c) => c.fermee).map((c) => c.cle));
    expect(avant.filter((k) => !fermees.has(k))).toEqual([]);
    expect(cases.filter((c) => c.fermee && !c.raison).map((c) => c.cle)).toEqual([]);
  });
});

describe('Chanson de marin (MDG 09 l.32-40) : l’aptitude du chanteur, et le quart (l.40)', () => {
  const chanson = (nom: string) => monterNavire(NAVIRE.find((n) => n.nom === nom)!).find((c) => c.actionId === 'sing-shanty')!;

  it.each(['chanteur', 'chanteur-0-blessure'])('%s : la case est OUVERTE', (nom) => {
    expect(chanson(nom).fermee).toBe(false);
  });

  it.each(['chanteur-inconscient', 'chanteur-hors-rencontre'])('%s : la case est FERMÉE, aucun chanteur', (nom) => {
    const c = chanson(nom);
    expect(c.fermee).toBe(true);
    expect(c.raison).toBe(t('agate.noShantySinger'));
  });

  it('quart déjà chanté : la case est FERMÉE, et le dit', () => {
    const c = chanson('chanteur-quart-chante');
    expect(c.fermee).toBe(true);
    expect(c.raison).toBe(t('agate.shantyQuartSung'));
  });

  it('le dispatcher `battleSingShanty` refuse le chanteur Inconscient', () => {
    monterNavire(NAVIRE.find((n) => n.nom === 'chanteur-inconscient')!);
    useGame.setState({ pendingShanty: null });
    useGame.getState().battleSingShanty('ship');
    expect(useGame.getState().pendingShanty).toBeNull();
  });
});

/** Le héros `lo-tir` sur le vrai store, combat ouvert, aucune console montée. */
function poserHeros(prep: (h: Combatant) => void, acted = false): Combatant {
  const h = heros('lo-tir');
  prep(h);
  const f = adversaire(false);
  useGame.setState({
    party: [h], scene: emptyScene(20, 20), localIntent: null, refus: null,
    battle: {
      combatants: [h, f], order: [h.id, f.id], baseOrder: [h.id, f.id], turn: 0, round: 1, action: null,
      selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted, runBudget: null, log: [], over: null,
    } as unknown as BattleState,
  });
  return h;
}

describe('`runAction` — un geste fermé ne passe par aucune porte (#1678 L3b)', () => {
  it.each([
    ['aim', {}],
    ['cast-spell', { spellId: 'arme-aethyrique' }],
  ] as const)('sous Brisé (LDB 16 l.52), runAction(%s) ne change rien et dit le refus', (id, args) => {
    poserHeros((h) => { h.conditions = [{ id: 'brise', value: 1 }] as Combatant['conditions']; });
    const avant = JSON.stringify(useGame.getState().battle, (_k, v) => (v instanceof Map ? [...v] : v));
    runAction(id, useGame.getState, args);
    expect(JSON.stringify(useGame.getState().battle, (_k, v) => (v instanceof Map ? [...v] : v))).toBe(avant);
    expect(useGame.getState().localIntent).toBeNull();
    expect(useGame.getState().refus?.texte).toBe(raisonBrise());
  });

  it('Action dépensée : la Course et la Charge (LDB 15 l.35, l.41) n’arment aucune intention', () => {
    poserHeros(() => {}, true);
    for (const id of ['course', 'charge']) {
      runAction(id, useGame.getState);
      expect(useGame.getState().localIntent, id).toBeNull();
      expect(useGame.getState().refus?.texte, id).toBe(t('agate.actionSpent'));
    }
  });

  it('le désarmement (`toggleOff`) passe outre le verdict', () => {
    poserHeros((h) => { h.conditions = [{ id: 'brise', value: 1 }] as Combatant['conditions']; });
    useGame.setState({ localIntent: { actionId: 'charge' } });
    runAction('charge', useGame.getState, { toggleOff: true });
    expect(useGame.getState().localIntent).toBeNull();
    expect(useGame.getState().refus).toBeNull();
  });

  it('déjà en joue : le dispatcher `battleAim` ne dépense pas une 2ᵉ Action', () => {
    poserHeros((h) => { h.aiming = true; });
    useGame.getState().battleAim();
    expect(useGame.getState().battle!.acted).toBe(false);
  });
});

describe('fermetures du registre — chaque case dit SA raison (#1678 L3b)', () => {
  const caseDe = (cases: CaseLue[], id: string) => cases.find((c) => c.actionId === id)!;

  it.each(['empetre', 'surpris'])('%s (`gating.movement: none`) : Mouvement et Charge se ferment sur la MÊME raison, qui nomme l’État', (etat) => {
    const cases = monter('lo-melee', false, etats(etat), null);
    for (const id of ['mouvement', 'charge']) {
      expect(caseDe(cases, id).fermee, id).toBe(true);
      expect(caseDe(cases, id).raison, id).toBe(t('agate.movementLocked', { etat: findConditionById(etat)!.label }));
    }
  });

  it('Action dépensée : Course et Charge (LDB 15 l.35, l.41) se ferment', () => {
    const cases = monter('lo-melee', false, () => true);
    for (const id of ['course', 'charge']) {
      expect(caseDe(cases, id).fermee, id).toBe(true);
      expect(caseDe(cases, id).raison, id).toBe(t('agate.actionSpent'));
    }
  });

  it('Sonné (LDB 15 l.49 ; LDB 16 l.125) : le Désengagement par l’Esquive se ferme', () => {
    const cases = monter('lo-melee', true, (h) => { h.conditions = [{ id: 'sonne', value: 1 }] as Combatant['conditions']; });
    expect(caseDe(cases, 'disengage').fermee).toBe(true);
    expect(caseDe(cases, 'disengage').raison).toBe(t('agate.unableToAct'));
  });

  it('en joue, arme chargée : Viser et Recharger disent pourquoi', () => {
    expect(caseDe(monter('lo-tir', false, (h) => { h.aiming = true; }), 'aim').raison).toBe(t('agate.alreadyAiming'));
    const chargee = monter('lo-tir', false, (h) => { loadWeapon(h, h.weapons.find((w) => w.type === 'ranged')!); });
    expect(caseDe(chargee, 'reload').raison).toBe(t('agate.weaponAlreadyLoaded'));
  });
});

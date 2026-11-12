/**
 * LE CLIC D'EXPLORATION au noyau (#3059) : `intentionDuClicDExploration` rend ce que joue un clic hors combat, branche par
 * branche, sur l'état du banc ; l'hôte n'en traduit que le pointeur et la marche (`stage/useStagePointer.ts:performClick`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { intentionDuClicDExploration } from './interactionsDExploration';
import { emptyScene, type Scene, type SceneEntity } from './monde/scene';
import type { Pt } from './monde/path';
import type { Combatant } from '../engine/types';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const hero = (): Combatant =>
  combattantDeTest({ id: 'h', label: 'H', kind: 'heros', xp: 0, wounds: blessuresDeBase(12), conditions: [], movement: 4 });

const FOUILLE = { id: 'fouiller', flow: { kind: 'sequence' as const, etapes: [] }, unique: true };
const PRISES = {
  'place-1': { kind: 'entite' as const, entityId: 'a' }, 'place-2': { kind: 'entite' as const, entityId: 'b' },
  'place-3': { kind: 'entite' as const, entityId: 'c' }, 'place-4': { kind: 'entite' as const, entityId: 'd' },
};
/** Table en (5,5) au cap N : abords nord (5,4), est (6,5), sud (5,6), ouest (4,5). */
const table = (usable: SceneEntity['usable']): SceneEntity => ({ id: 'table-1', kind: 'prop', pos: { x: 5, y: 5 }, decor: { id: 'table-ronde-4-tabourets' }, facing: 'N', usable });
const coffre = (actions: typeof FOUILLE[]): SceneEntity => ({ id: 'coffre-1', kind: 'prop', pos: { x: 5, y: 5 }, decor: { id: 'coffre' }, usable: { actions } });
const badaud: SceneEntity = { id: 'pnj-1', kind: 'personnage', creature: { id: 'humain' }, label: 'Le badaud', pos: { x: 5, y: 5 } };
const tonneau = (id: string, x: number, y: number): SceneEntity => ({ id, kind: 'prop', pos: { x, y }, decor: { id: 'tonneau' }, label: 'Un tonneau' });
/** Huit tonneaux autour de (5,5) : aucune case adjacente libre, la cible est injoignable à pied. */
const enceinte = (): SceneEntity[] =>
  [[4, 4], [5, 4], [6, 4], [4, 5], [6, 5], [4, 6], [5, 6], [6, 6]].map(([x, y], i) => tonneau(`mur-${i}`, x, y));

function poser(entities: SceneEntity[], partyPos: Pt, seatAssignments?: Scene['seatAssignments']) {
  const scene = emptyScene('scene-test', 12, 12);
  scene.entities = entities;
  if (seatAssignments) scene.seatAssignments = seatAssignments;
  banc.setState({ scene, party: [hero()], partyPos: { ...partyPos }, mode: 'exploration', dialogue: null, battle: null, pendingInteract: null, flags: {}, journal: [] });
}

const clic = (tuile: Pt, entiteId: string | null) => intentionDuClicDExploration(banc.getState(), tuile, entiteId);
const SUR = { x: 5, y: 5 };

describe('intentionDuClicDExploration — meuble à places', () => {
  it('debout sur l’abord d’une place libre : interagir', () => {
    poser([table({ assise: true })], { x: 5, y: 4 });
    expect(clic(SUR, 'table-1')).toEqual({ kind: 'interagir', id: 'table-1' });
  });

  it('déjà assis au meuble : interagir (le noyau arbitre se relever)', () => {
    poser([table({ assise: true })], { x: 5, y: 4 });
    banc.getState().interagirAvecLEntite('table-1');
    expect(clic(SUR, 'table-1')).toEqual({ kind: 'interagir', id: 'table-1' });
  });

  it('une place libre au loin : rejoindre son abord, le pending sans action', () => {
    poser([table({ assise: true })], { x: 0, y: 0 });
    expect(clic(SUR, 'table-1')).toEqual({ kind: 'rejoindre', plan: expect.objectContaining({ dest: expect.objectContaining({ x: 5, y: 4 }) }), pending: { id: 'table-1', at: expect.objectContaining({ x: 5, y: 4 }) } });
  });

  it('table pleine sans fouille, à portée : rien (zéro offre ouverte)', () => {
    poser([table({ assise: true })], { x: 4, y: 4 }, { 'table-1': PRISES });
    expect(clic(SUR, 'table-1')).toBeNull();
  });

  it('table pleine sans fouille, au loin : rejoindre la case adjacente, le pending sans action', () => {
    poser([table({ assise: true })], { x: 0, y: 0 }, { 'table-1': PRISES });
    expect(clic(SUR, 'table-1')).toEqual({ kind: 'rejoindre', plan: expect.objectContaining({ dest: expect.objectContaining({ x: 4, y: 4 }) }), pending: { id: 'table-1', at: expect.objectContaining({ x: 4, y: 4 }) } });
  });

  it('table pleine qui porte une fouille, à portée : jouer la fouille', () => {
    poser([table({ assise: true, actions: [FOUILLE] })], { x: 4, y: 4 }, { 'table-1': PRISES });
    expect(clic(SUR, 'table-1')).toEqual({ kind: 'jouer', id: 'table-1', actionId: 'fouiller' });
  });

  it('table pleine qui porte une fouille, au loin : rejoindre avec la fouille', () => {
    poser([table({ assise: true, actions: [FOUILLE] })], { x: 0, y: 0 }, { 'table-1': PRISES });
    expect(clic(SUR, 'table-1')).toMatchObject({ kind: 'rejoindre', pending: { id: 'table-1', actionId: 'fouiller', at: { x: 4, y: 4 } } });
  });
});

describe('intentionDuClicDExploration — entité utilisable', () => {
  it('une offre à portée : jouer', () => {
    poser([coffre([FOUILLE])], { x: 5, y: 4 });
    expect(clic(SUR, 'coffre-1')).toEqual({ kind: 'jouer', id: 'coffre-1', actionId: 'fouiller' });
  });

  it('N offres à portée : rien, la pastille les sert', () => {
    poser([coffre([FOUILLE, { ...FOUILLE, id: 'forcer' }])], { x: 5, y: 4 });
    expect(clic(SUR, 'coffre-1')).toBeNull();
  });

  it('une offre au loin : rejoindre la case adjacente avec l’offre', () => {
    poser([coffre([FOUILLE])], { x: 0, y: 0 });
    expect(clic(SUR, 'coffre-1')).toMatchObject({ kind: 'rejoindre', plan: { dest: { x: 4, y: 4 } }, pending: { id: 'coffre-1', actionId: 'fouiller', at: { x: 4, y: 4 } } });
  });

  it('injoignable au loin : rien', () => {
    poser([coffre([FOUILLE]), ...enceinte()], { x: 0, y: 0 });
    expect(clic(SUR, 'coffre-1')).toBeNull();
  });
});

describe('intentionDuClicDExploration — figurant, décor, sol', () => {
  it('figurant à portée : il le dit', () => {
    poser([badaud], { x: 5, y: 4 });
    expect(clic(SUR, 'pnj-1')).toEqual({ kind: 'dire', message: 'Le badaud n’a rien à vous dire.' });
  });

  it('figurant au loin : marcher jusqu’à lui', () => {
    poser([badaud], { x: 0, y: 0 });
    expect(clic(SUR, 'pnj-1')).toMatchObject({ kind: 'marcher', plan: { dest: { x: 4, y: 4 } } });
  });

  it('figurant injoignable : le refus nomme sa case', () => {
    poser([badaud, ...enceinte()], { x: 0, y: 0 });
    expect(clic(SUR, 'pnj-1')).toEqual({ kind: 'injoignable', message: `Marche refusée : aucun chemin du groupe ne mène à (${SUR.x},${SUR.y}).` });
  });

  it('décor bloquant à portée : il le dit', () => {
    poser([tonneau('tonneau-1', 5, 5)], { x: 5, y: 4 });
    expect(clic(SUR, 'tonneau-1')).toEqual({ kind: 'dire', message: 'Un tonneau : rien à en tirer.' });
  });

  it('décor bloquant au loin : marcher jusqu’à lui', () => {
    poser([tonneau('tonneau-1', 5, 5)], { x: 0, y: 0 });
    expect(clic(SUR, 'tonneau-1')).toMatchObject({ kind: 'marcher', plan: { dest: { x: 4, y: 4 } } });
  });

  it('sol : marcher jusqu’à la case', () => {
    poser([], { x: 0, y: 0 });
    expect(clic({ x: 3, y: 2 }, null)).toMatchObject({ kind: 'marcher', plan: { dest: { x: 3, y: 2 } } });
  });

  it('sol sans chemin (la case du groupe) : annuler', () => {
    poser([], { x: 3, y: 2 });
    expect(clic({ x: 3, y: 2 }, null)).toEqual({ kind: 'annuler' });
  });

  it('dialogue ouvert, ou combat : rien', () => {
    poser([], { x: 0, y: 0 });
    banc.setState({ mode: 'battle' });
    expect(clic({ x: 3, y: 2 }, null)).toBeNull();
    banc.setState({ mode: 'exploration', dialogue: banc.getState().dialogue ?? ({} as NonNullable<ReturnType<Banc['getState']>['dialogue']>) });
    expect(clic({ x: 3, y: 2 }, null)).toBeNull();
  });
});

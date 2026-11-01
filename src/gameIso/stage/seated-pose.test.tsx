/**
 * Un groupe attablé : le jeton prend l'ancre de la place, le repère de sol s'éteint, l'œil descend à
 * la hauteur d'assise.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, type Scene, type SceneEntity } from '../../noyau/monde/scene';
import { seatPoseOf, type SeatPose } from '../../noyau/monde/seating';
import { dynamicMarks } from '../builders/dynamicMarks';
import { EYE_H, EYE_H_ASSIS, makeCamera, seatedEyeH } from '../pov/camera';
import { partyTokenOf } from '../builders/tokens';
import type { Combatant } from '../../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';
const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
function scèneAttablée(assis: boolean, species = 'humain'): Scene {
  const s = emptyScene('scene-test', 8, 8);
  s.entities = [
    { id: PROP, kind: 'prop', pos: { x: 2, y: 2 }, ref: TABLE, facing: 'N', usable: { assise: true } },
    { id: 'f1', kind: 'personnage', ref: 'humain', pos: { x: 3, y: 2 }, facing: 'S', appearance: { species } },
  ] as unknown as SceneEntity[];
  if (assis) s.seatAssignments = { [PROP]: { 'place-2': { kind: 'entity', entityId: 'f1' } } };
  return s;
}

const meneur = (): Combatant =>
  (blessuresSurLeProfil({
    id: 'h', label: 'Meneur', kind: 'hero', pos: { x: 3, y: 2 }, size: 'moyenne', wounds: blessuresDeBase(12),
    weapons: [], characteristics: {}, advantage: 0, conditions: [], armour: {}, skills: [], talents: [], movement: 4,
    career: 'soldat', species: 'humain',
  })) as unknown as Combatant;

describe('partyTokenOf — la dérivation UNIQUE du jeton de groupe', () => {
  it('meneur assis : la position de RENDU devient l’ancre, la place voyage avec lui', () => {
    const scene = scèneAttablée(false);
    scene.seatAssignments = { [PROP]: { 'place-2': { kind: 'party', rang: 1 } } };
    const jeton = partyTokenOf(scene, meneur(), { x: 3, y: 2 }, ['h'])!;
    const place = seatPoseOf(scene, { kind: 'party', rang: 1 })!;
    expect(jeton.seat).toEqual(place);
    expect(jeton.pos.x).toBeCloseTo(place.anchor.x, 6);
    expect(jeton.pos.y).toBeCloseTo(place.anchor.y, 6);
    expect(jeton.pos).not.toEqual({ x: 3, y: 2 });
  });

  it('meneur debout : la case logique telle quelle, aucune place', () => {
    const jeton = partyTokenOf(scèneAttablée(false), meneur(), { x: 3, y: 2 }, ['h'])!;
    expect(jeton.pos).toEqual({ x: 3, y: 2 });
    expect(jeton.seat).toBeUndefined();
  });

  it('aucun meneur → aucun jeton', () => {
    expect(partyTokenOf(scèneAttablée(false), undefined, { x: 3, y: 2 }, ['h'])).toBeNull();
  });
});

describe('marque de sol du groupe — cohérente avec la pose', () => {
  const jeton = (seat?: SeatPose) => ({ leader: meneur(), heroIndex: 0, pos: { x: 3, y: 2 }, ...(seat ? { seat } : {}) });

  it('meneur DEBOUT : le repère de sol est posé à sa case', () => {
    const marks = dynamicMarks(null, { x: 3, y: 2 }, [], jeton());
    expect(marks.party).toEqual({ x: 3, y: 2, z: 0 });
  });

  it('meneur ASSIS : le repère s’éteint, l’anneau d’équipe reste (il suit le corps)', () => {
    const place = seatPoseOf(scèneAttablée(true), { kind: 'entity', entityId: 'f1' })!;
    const marks = dynamicMarks(null, { x: 3, y: 2 }, [], jeton(place));
    expect(marks.party).toBeNull();
    expect(marks.rings.map((r) => r.id)).toContain('h');
  });
});

describe('œil POV assis', () => {
  it('descend sous l’œil debout, et se dérive de la hauteur d’assise', () => {
    const scene = scèneAttablée(true);
    const place = seatPoseOf(scene, { kind: 'entity', entityId: 'f1' })!;
    const h = seatedEyeH(scene, place, 0);
    expect(h).toBeCloseTo(place.anchor.h + EYE_H_ASSIS, 6); // sol à 0 dans cette scène
    expect(h).toBeLessThan(EYE_H);
  });

  it('un siège PLUS HAUT lève l’œil d’autant (aucun nombre magique)', () => {
    const scene = scèneAttablée(true);
    const place = seatPoseOf(scene, { kind: 'entity', entityId: 'f1' })!;
    const perche = { anchor: { ...place.anchor, h: place.anchor.h + 0.3 } };
    expect(seatedEyeH(scene, perche, 0) - seatedEyeH(scene, place, 0)).toBeCloseTo(0.3, 6);
  });

  it('`makeCamera` POSE réellement l’œil à la hauteur reçue', () => {
    const scene = scèneAttablée(true);
    const place = seatPoseOf(scene, { kind: 'entity', entityId: 'f1' })!;
    const debout = makeCamera(scene, { x: 3, y: 2 }, 'S');
    const assis = makeCamera(scene, { x: place.anchor.x, y: place.anchor.y }, place.facing, seatedEyeH(scene, place, 0));
    expect(assis.eye.z).toBeLessThan(debout.eye.z);
    expect(debout.eye.z - assis.eye.z).toBeCloseTo(EYE_H - (place.anchor.h + EYE_H_ASSIS), 6);
  });
});

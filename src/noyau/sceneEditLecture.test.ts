/**
 * Les lectures de l'édition de scène (#3508) : les fiches qu'un personnage posé nomme, les profils standard
 * (`LDB 77 l.7`) en tête ; les caps qu'une entité peut prendre, ceux que son type admet (`capDecorAdmis`).
 */
import { describe, expect, it } from 'vitest';
import { creatures, profilsStandard, props, refEstVolumique } from '../data';
import { capsOfferts, fichesDePersonnage } from './sceneEditLecture';

describe('les lectures de l’édition', () => {
  it('les fiches d’un personnage : les créatures qui ont des Blessures, chacune une fois, les profils standard en tête', () => {
    const fiches = fichesDePersonnage().map((c) => c.id);
    const standard = new Set(profilsStandard());
    expect(new Set(fiches)).toEqual(new Set(creatures.filter((c) => typeof c.char.B === 'number').map((c) => c.id)));
    expect(fiches).toHaveLength(new Set(fiches).size);
    const premiere = fiches.findIndex((id) => !standard.has(id));
    expect(fiches.slice(0, premiere).every((id) => standard.has(id)) && fiches.slice(premiere).every((id) => !standard.has(id))).toBe(true);
    expect(premiere).toBeGreaterThan(0);
  });

  it('les caps : les quatre cardinaux d’un décor volumique, les huit sinon', () => {
    const volumique = props.find((p) => refEstVolumique(p.id))!;
    const billboard = props.find((p) => !refEstVolumique(p.id))!;
    const pos = { x: 0, y: 0 };
    expect(capsOfferts({ id: 'a', kind: 'prop', ref: volumique.id, pos })).toEqual(['N', 'E', 'S', 'O']);
    expect(capsOfferts({ id: 'b', kind: 'prop', ref: billboard.id, pos })).toHaveLength(8);
    expect(capsOfferts({ id: 'c', kind: 'personnage', ref: 'humain', pos })).toHaveLength(8);
  });
});

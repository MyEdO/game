/**
 * Un personnage de scène NOMME sa fiche (#1882) : `sceneEntitySchema` (`./scene.ts`) l'exige au parse,
 * par la famille même que le spawn résout.
 */
import { describe, expect, it } from 'vitest';
import { sceneEntitySchema } from './scene';

const FICHE = { type: 'statblock', label: 'Ennemi', char: { B: 10 } };
describe('sceneEntitySchema — un personnage NOMME sa fiche (#1882)', () => {
  it('au SCHÉMA : chaque porteur SEUL suffit, l’absence de tous est l’issue nommée au chemin `ref`', () => {
    const base = { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 } };
    for (const porteur of [{ ref: 'capitaine-du-guet' }, { statblock: FICHE }, { presetId: 'baron' }])
      expect(sceneEntitySchema.safeParse({ ...base, ...porteur }).success, Object.keys(porteur)[0]).toBe(true);
    const r = sceneEntitySchema.safeParse(base);
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
      ['ref', '« ref », « statblock », « presetId » absents — un personnage NOMME sa fiche (bestiaire, statbloc ou preset de PNJ)'],
    ]);
  });

  it('au SCHÉMA : une réf VIDE est une absence, une réf MORTE est refusée en la nommant (#1882)', () => {
    const base = { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 } };
    expect(sceneEntitySchema.safeParse({ ...base, ref: '' }).error?.issues.map((i) => i.message))
      .toEqual(['« ref », « statblock », « presetId » absents — un personnage NOMME sa fiche (bestiaire, statbloc ou preset de PNJ)']);
    expect(sceneEntitySchema.safeParse({ ...base, ref: 'creature-fantome' }).error?.issues.map((i) => i.message))
      .toEqual(['« creature-fantome » ni créature, ni coque de véhicule, ni engin de siège']);
  });

  it('au SCHÉMA : la famille est CELLE du spawn — un équipement sans affut, un véhicule sans coque sont refusés au PARSE (#1882)', () => {
    const base = { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 } };
    for (const ref of ['baton-de-combat', 'barque'])
      expect(sceneEntitySchema.safeParse({ ...base, ref }).success, ref).toBe(false);
    for (const ref of ['humain', 'cogue'])
      expect(sceneEntitySchema.safeParse({ ...base, ref }).success, ref).toBe(true);
  });
});

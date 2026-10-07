/**
 * NORD DE LA CARTE (`Scene.northDeg`, #1176 P2-5) — le champ neuf du schéma de scène : ses BORNES et sa
 * survie à la sauvegarde.
 *
 * Bornes : `northDeg` est un CAP, donc un angle de `[0,360[` — `setNorthDeg` y ramène toute valeur
 * (450° = 90°, −90° = 270°) et REFUSE ce qui n'est pas un angle (NaN/Infini → champ retiré, donc nord
 * implicite). Il n'y a PAS de schéma Zod pour `Scene` dans ce dépôt (les schémas Zod de `src/data/schemas`
 * couvrent les datasets `*.json`, pas le document de scène) : le setter EST la porte de validation, comme
 * pour `metresPerTile`/`ambientLight`.
 *
 * Sauvegarde : champ OPTIONNEL, absent = 0 = le nord implicite. Ce qui se teste ici, c'est que la valeur
 * authorée SURVIT au round-trip et qu'une scène qui ne le porte pas se sauve et se relit.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, type Scene } from './scene';
import { setNorthDeg } from './sceneEdit';
import { exportSave, importSave, snapshotSave } from './saves';
import { FORMAT_SAVE } from './formats.generated';

describe('setNorthDeg — un cap, pas un compteur', () => {
  const base = () => emptyScene(6, 6);

  it('ramène toute valeur dans [0,360[ et retire le champ pour ce qui n’est pas un angle', () => {
    const nord = (v: number | undefined) => setNorthDeg(base(), v).northDeg;
    expect([nord(0), nord(90), nord(359.5), nord(360), nord(450), nord(-90), nord(-360)])
      .toEqual([0, 90, 359.5, 0, 90, 270, 0]);
    expect(nord(undefined)).toBeUndefined();
    expect(nord(Number.NaN)).toBeUndefined();
    expect(nord(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it('une scène neuve n’en porte PAS (le champ est optionnel, son absence = nord implicite)', () => {
    expect(base().northDeg).toBeUndefined();
    expect('northDeg' in setNorthDeg(setNorthDeg(base(), 120), undefined)).toBe(false);
  });

  it('est PUR : la scène d’entrée n’est jamais mutée', () => {
    const avant = base();
    setNorthDeg(avant, 200);
    expect(avant.northDeg).toBeUndefined();
  });
});

describe('Sauvegarde — le nord authoré voyage, son absence ne casse rien', () => {
  /** État minimal ne portant que la scène (le snapshot copie les clés de l'état INITIAL fourni). */
  const etat = (scene: Scene) => ({ scene, gameTime: 9 * 60 });

  it('round-trip export → import : `northDeg` survit à l’octet près', () => {
    const scene = setNorthDeg(emptyScene(5, 5), 90);
    const save = snapshotSave(etat(scene), etat(scene), '2512-01-01T00:00:00Z');
    const relu = importSave(exportSave(save));
    if (typeof relu === 'string') throw new Error(`save refusée : ${relu}`);
    expect(relu.version).toBe(FORMAT_SAVE);
    expect(relu.data.scene).toMatchObject({ northDeg: 90 });
  });

  it('une scène SANS le champ se sauve et se relit, nord implicite', () => {
    const scene = emptyScene(5, 5);
    const save = snapshotSave(etat(scene), etat(scene), '2512-01-01T00:00:00Z');
    const relu = importSave(exportSave(save));
    if (typeof relu === 'string') throw new Error(`save refusée : ${relu}`);
    expect((relu.data.scene as Scene).northDeg).toBeUndefined();
  });
});

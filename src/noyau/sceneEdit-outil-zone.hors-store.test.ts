/**
 * L'outil `zoneTiles` de l'appui (`appliquerOutil`, `sceneEdit.ts`) : contrat déclaré, il peint l'emprise de la zone
 * d'id STABLE (`paintEffectZone`) — une case ajoutée hors de l'aire l'étend, une case retirée la découpe ; une zone
 * inconnue laisse la scène inchangée. Scène FABRIQUÉE.
 */
import { describe, it, expect } from 'vitest';
import { appliquerOutil } from './sceneEdit';
import { emptyScene, type Scene } from './monde/scene';
import { sceneZoneTiles } from './monde/zones';

const geste = { z: 0, brush: 1, encId: '', encRef: '' };
const scene = (): Scene => ({ ...emptyScene('zones', 8, 8), effectZones: [{ id: 'cour', label: 'Cour', area: { kind: 'rect', x: 1, y: 1, w: 2, h: 2 } }] });
const cases = (s: Scene) => sceneZoneTiles(s.effectZones![0]).map((p) => `${p.x},${p.y}`).sort();

describe('appliquerOutil — zoneTiles', () => {
  it('ajouter une case hors de l’aire l’y inclut, l’emprise reste exactement ce qui est peint', () => {
    const out = appliquerOutil(scene(), { mode: 'casesDeZone', zoneId: 'cour', paint: 'add' }, { x: 4, y: 1 }, geste)!;
    expect(cases(out.scene)).toEqual(['1,1', '1,2', '2,1', '2,2', '4,1']);
  });

  it('retirer une case découpe la zone', () => {
    const out = appliquerOutil(scene(), { mode: 'casesDeZone', zoneId: 'cour', paint: 'remove' }, { x: 1, y: 1 }, geste)!;
    expect(cases(out.scene)).toEqual(['1,2', '2,1', '2,2']);
  });

  it('une zone inconnue, ou une case déjà dans l’état peint : la scène reste la même', () => {
    const s = scene();
    expect(appliquerOutil(s, { mode: 'casesDeZone', zoneId: 'absente', paint: 'add' }, { x: 4, y: 1 }, geste)!.scene).toBe(s);
    expect(appliquerOutil(s, { mode: 'casesDeZone', zoneId: 'cour', paint: 'add' }, { x: 1, y: 1 }, geste)!.scene.effectZones![0]).toBe(s.effectZones![0]);
  });
});

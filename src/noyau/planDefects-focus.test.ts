/**
 * Identité et re-résolution d'un défaut de plan suivi (`planDefectKey`, `planFocusAt`) : ce que tout
 * hôte du noyau rend pour amener l'auteur au défaut, contre les avertissements frais de `validateScene`.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, type Scene } from './monde/scene';
import { planDefectKey, planFocusAt } from './planDefects';
import { validateScene } from './validateScene';

describe('planFocusAt / planDefectKey — le défaut suivi est VIVANT (re-résolution contre les avertissements frais)', () => {
  /** Plan de plain-pied 6×2 sur la `route` : les colonnes 0-2 sont ENCLOSES par un périmètre de murs
   *  (le corps de bâtiment), les colonnes 3-5 restent à l'air libre. */
  function planTemoin(zoneW: number): Scene {
    const w = 6, h = 2;
    return {
      ...emptyScene('scene-test', w, h),
      layers: [{ z: 0, tiles: new Array(w * h).fill('route') }],
      walls: [
        { x: 0, y: 0, side: 'N' }, { x: 1, y: 0, side: 'N' }, { x: 2, y: 0, side: 'N' },
        { x: 0, y: 2, side: 'N' }, { x: 1, y: 2, side: 'N' }, { x: 2, y: 2, side: 'N' },
        { x: -1, y: 0, side: 'E' }, { x: -1, y: 1, side: 'E' },
        { x: 2, y: 0, side: 'E' }, { x: 2, y: 1, side: 'E' },
      ],
      effectZones: [
        { id: 'galerie', label: 'Galerie', presentation: 'interior', area: { kind: 'rect', x: 1, y: 0, w: zoneW, h: 2 }, z: 0 },
      ],
    };
  }

  const alertes = (scene: Scene) => validateScene([scene]).filter((w) => w.sceneId === scene.id);
  const cases = (at: ReturnType<typeof planFocusAt>) => (at && at.kind === 'zone' ? at.tiles.length : 0);

  it('les cases allumées FONDENT à mesure que l’auteur retaille la zone, puis la mise en évidence s’éteint', () => {
    const depart = planTemoin(4); // la zone mord 2 colonnes de route → 4 cases fautives
    const suivi = alertes(depart).find((w) => w.plan?.family === 'zone-debordante');
    expect(suivi?.plan).toBeTruthy();
    const key = planDefectKey(suivi!.plan!);
    expect(cases(planFocusAt(alertes(depart), key))).toBe(4);

    // Une colonne rendue à la route : le MÊME défaut, moins de cases.
    expect(cases(planFocusAt(alertes(planTemoin(3)), key))).toBe(2);

    // Zone entièrement bâtie : plus aucun avertissement ne porte ce défaut → l’annotation s’éteint.
    expect(planFocusAt(alertes(planTemoin(2)), key)).toBeNull();
  });

  it('l’identité d’un défaut ne tient PAS à ses cases (elle survit à leur décompte), et distingue deux zones', () => {
    const a = alertes(planTemoin(4)).find((w) => w.plan?.family === 'zone-debordante')!.plan!;
    const b = alertes(planTemoin(3)).find((w) => w.plan?.family === 'zone-debordante')!.plan!;
    expect(planDefectKey(a)).toBe(planDefectKey(b));
    expect(planDefectKey({ family: a.family, at: { kind: 'zone', zoneId: 'cave', z: 0, tiles: [] } })).not.toBe(planDefectKey(a));
  });

  it('une case, une arête et un étage distincts sont trois défauts distincts', () => {
    const cell = planDefectKey({ family: 'mur-en-impasse', at: { kind: 'cell', x: 1, y: 2, z: 0 } });
    expect(planDefectKey({ family: 'mur-en-impasse', at: { kind: 'cell', x: 1, y: 2, z: 0 } })).toBe(cell);
    expect(planDefectKey({ family: 'mur-en-impasse', at: { kind: 'edge', x: 1, y: 2, side: 'N', z: 0 } })).not.toBe(cell);
    expect(planDefectKey({ family: 'mur-en-impasse', at: { kind: 'cell', x: 1, y: 2, z: 1 } })).not.toBe(cell);
    expect(planDefectKey({ family: 'porte-orpheline', at: { kind: 'cell', x: 1, y: 2, z: 0 } })).not.toBe(cell);
  });

  it('parmi plusieurs défauts, rend les cases de CELUI que la clé suit', () => {
    const impasse = { family: 'mur-en-impasse' as const, at: { kind: 'cell' as const, x: 1, y: 1, z: 0 } };
    const porte = { family: 'porte-orpheline' as const, at: { kind: 'edge' as const, x: 3, y: 2, side: 'E' as const, z: 0 } };
    expect(planFocusAt([{ plan: impasse }, {}, { plan: porte }], planDefectKey(porte))).toEqual(porte.at);
  });

  it('sans défaut suivi, rien n’est mis en évidence', () => {
    expect(planFocusAt(alertes(planTemoin(4)), null)).toBeNull();
  });
});

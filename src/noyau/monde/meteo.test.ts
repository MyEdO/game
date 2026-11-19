import { describe, expect, it } from 'vitest';
import { ambiance } from '../../data';
import { sonDEffet } from '../../data/sons/registre';
import { MAX_PRECIP, meteoDuRegard, meteoSurLesBandes, openSkyRuns, sceneGroundSpan, scenePrecip, sceneWeatherFx } from './meteo';
import { emptyScene, sceneMetresPerTile, type BuildingMass, type Scene } from './scene';
import { isSheltered, shelterField } from './volume/toits';

/** Une masse qui coiffe le carré (3,3)-(6,6). */
const TOIT: BuildingMass = {
  id: 'toit-maison',
  z: 0,
  footprint: [{ x: 3, y: 3, w: 4, h: 4 }],
  levels: 1,
  profile: 'gable',
  ridge: 'x',
  pitchDeg: 45,
  material: { id: 'tuile' },
};

function sceneCouverte(weather?: Scene['weather']): Scene {
  const scene = emptyScene('scene-test', 12, 12);
  scene.architecture = [{ id: 'maison', label: 'Maison', style: { id: 'maison' }, storeys: [], facades: [], masses: [TOIT] }];
  return { ...scene, weather };
}

describe('porte de la météo : le registre décide', () => {
  it('un type présent au catalogue rend son entrée, telle quelle', () => {
    expect(sceneWeatherFx({ weather: 'pluie' })).toBe(ambiance.iso.weather.pluie);
    expect(sceneWeatherFx({ weather: 'brouillard' })).toBe(ambiance.iso.weather.brouillard);
  });

  it("un type sans entrée au catalogue ne montre rien, `clair` compris", () => {
    expect(ambiance.iso.weather).not.toHaveProperty('clair');
    expect(sceneWeatherFx({ weather: 'clair' })).toBeNull();
    expect(sceneWeatherFx({ weather: undefined })).toBeNull();
    expect(sceneWeatherFx({ weather: 'forge-de-neant' as unknown as 'pluie' })).toBeNull();
  });

  it("l'intérieur ferme la porte avant le registre", () => {
    expect(sceneWeatherFx({ weather: 'pluie', ambiance: 'interieur' })).toBeNull();
  });

  it('ce qui tombe vient de la donnée, et rien ne tombe du brouillard ni dedans', () => {
    expect(scenePrecip({ weather: 'pluie' })).toBe(ambiance.iso.weather.pluie!.precip);
    expect(scenePrecip({ weather: 'neige' })!.fallMs).toBeLessThan(scenePrecip({ weather: 'pluie' })!.fallMs);
    expect(scenePrecip({ weather: 'tempete' })!.density).toBeGreaterThan(scenePrecip({ weather: 'pluie' })!.density);
    expect(scenePrecip({ weather: 'brouillard' })).toBeNull();
    expect(scenePrecip({ weather: 'pluie', ambiance: 'interieur' })).toBeNull();
  });
});

describe('bandes à ciel ouvert', () => {
  it('carte nue : une bande pleine par rangée', () => {
    const runs = openSkyRuns(emptyScene('scene-test', 12, 12));
    expect(runs.length).toBe(12);
    for (const r of runs) expect([r.x0, r.x1]).toEqual([0, 11]);
  });

  it('sous une masse, la colonne coiffée est retirée par la vérité d’abri du dépôt', () => {
    const scene = sceneCouverte();
    expect(openSkyRuns(scene).filter((r) => r.y === 4).map((r) => [r.x0, r.x1])).toEqual([[0, 2], [7, 11]]);
    const abris = shelterField(scene);
    for (let x = 3; x <= 6; x++) expect(isSheltered(abris, x, 4, 0)).toBe(true);
    expect(isSheltered(abris, 2, 4, 0)).toBe(false);
  });

  it('le sol le plus bas et le plus haut, toutes couches confondues', () => {
    const scene = emptyScene('scene-test', 2, 1);
    scene.layers[0].height = [1, 3];
    expect(sceneGroundSpan(scene)).toEqual({ groundM: 1, topGroundM: 3 });
  });
});

describe('meteoDuRegard', () => {
  it('sans météo à montrer, rien', () => {
    expect(meteoDuRegard(emptyScene('scene-test', 4, 4), 'tactique')).toBeNull();
    expect(meteoDuRegard({ ...emptyScene('scene-test', 4, 4), weather: 'pluie', ambiance: 'interieur' }, 'tactique')).toBeNull();
  });

  it('la pluie tombe au-dessus des seules bandes à ciel ouvert, à la densité de la donnée', () => {
    const scene = sceneCouverte('pluie');
    const pluie = meteoDuRegard(scene, 'tactique')!.pluie!;
    const precip = ambiance.iso.weather.pluie!.precip!;
    const mpt = sceneMetresPerTile(scene);
    const ouvertes = openSkyRuns(scene).reduce((n, r) => n + r.x1 - r.x0 + 1, 0);
    const total = pluie.averses.reduce((n, a) => n + a.nombre, 0);
    expect(total).toBeCloseTo(precip.density * ouvertes * mpt * mpt, -1);
    for (const a of pluie.averses) {
      const [cx, , cz] = a.centre;
      expect(isSheltered(shelterField(scene), cx / mpt, cz / mpt, 0)).toBe(false);
      expect(a.centre[1]).toBe(precip.ceilingM);
    }
    expect(pluie.dureeS).toBeCloseTo(precip.ceilingM / precip.fallMs, 9);
    expect(pluie.vitesseMs * -pluie.sens.y).toBeCloseTo(precip.fallMs, 9);
    expect(pluie.vitesseMs * pluie.sens.x).toBeCloseTo(precip.windMs.x, 9);
    expect(Math.hypot(pluie.sens.x, pluie.sens.y, pluie.sens.z)).toBeCloseTo(1, 9);
    expect([pluie.couleur, pluie.opacite]).toEqual([precip.color, precip.opacity]);
  });

  it('le nombre de particules est écrêté au plafond', () => {
    const scene = { ...emptyScene('scene-test', 80, 80), weather: 'tempete' as const };
    const total = meteoDuRegard(scene, 'tactique')!.pluie!.averses.reduce((n, a) => n + a.nombre, 0);
    expect(total).toBeLessThanOrEqual(MAX_PRECIP + 80);
    expect(total).toBeGreaterThan(MAX_PRECIP - 80);
  });

  it('au plateau, rien ne tombe ni ne se pose en nappe, mais l’orage s’entend', () => {
    expect(meteoDuRegard({ ...emptyScene('scene-test', 4, 4), weather: 'tempete' }, 'plateau')).toEqual({ pluie: null, nappes: [], son: sonDEffet('orage') });
  });

  it('la brume se pose en nappes en tactique, une par couche de la donnée, au-dessus du sol le plus bas', () => {
    const scene = { ...emptyScene('scene-test', 6, 6), weather: 'brouillard' as const };
    scene.layers[0].height = new Array(36).fill(3);
    const brume = ambiance.iso.weather.brouillard!.brume!;
    const { nappes, pluie } = meteoDuRegard(scene, 'tactique')!;
    expect(pluie).toBeNull();
    expect(nappes.map((n) => n.alpha)).toEqual(brume.layers.map((c) => c.alpha));
    nappes.forEach((n, i) => {
      const cotes = new Set(n.positions.filter((_, k) => k % 3 === 1));
      expect([...cotes]).toEqual([3 + brume.layers[i].hM]);
    });
    expect(meteoDuRegard(scene, 'immersion')!.nappes).toEqual([]);
  });
});

describe('meteoSurLesBandes, sans scène (#4081)', () => {
  it('la pluie tombe sur la bande donnée, du plafond au-dessus du sol le plus haut jusqu’au plus bas', () => {
    const precip = ambiance.iso.weather.pluie!.precip!;
    const pluie = meteoSurLesBandes(ambiance.iso.weather.pluie!, [{ y: 1, x0: 0, x1: 4 }], 2, { groundM: -1, topGroundM: 3 }, 'tactique').pluie!;
    expect(pluie.averses).toEqual([{ centre: [4, 3 + precip.ceilingM, 2], demiEtendue: [5, 0, 1], nombre: Math.round(precip.density * 5 * 4) }]);
    expect(pluie.dureeS).toBeCloseTo((4 + precip.ceilingM) / precip.fallMs, 9);
  });

  it('la météo d’une scène est celle de ses bandes, de ses cases et de son sol', () => {
    const scene = { ...sceneCouverte('brouillard') };
    expect(meteoDuRegard(scene, 'tactique')).toEqual(
      meteoSurLesBandes(ambiance.iso.weather.brouillard!, openSkyRuns(scene), sceneMetresPerTile(scene), sceneGroundSpan(scene), 'tactique'),
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  CIEL_OUVERT,
  MAX_PRECIP,
  makeWeatherField,
  precipArea,
  precipBasis,
  precipCount,
  retainWeatherField,
  stepWeatherField,
  writePrecipMatrices,
  type PrecipArea,
} from './weatherParticles';
import { isSheltered, shelterField } from '../../builders/roofs';
import { AMBIANCE, scenePrecip } from '../../catalog/ambiance';
import type { WeatherPrecipDef } from '../../../data/ambiance.types';
import { emptyScene, sceneMetresPerTile, type BuildingMass, type Scene } from '../../../noyau/monde/scene';

/**
 * MÉTÉO VOLUMIQUE (#1176, P2-6) — ce que le semis doit tenir, mesuré sur sa physique PURE :
 *  - SOUS COUVERT : une case coiffée par une nappe ne reçoit AUCUNE particule, et la même case, la
 *    masse ABATTUE, en reçoit — la politique est celle du dégagement (`shelterField`), pas une
 *    seconde vérité recalculée ici ;
 *  - RECYCLAGE : le compte est CONSTANT et les particules restent dans leur volume, sur des centaines
 *    de pas simulés — ni croissance, ni fuite ;
 *  - DONNÉE : un type de météo FORGÉ, absent du jeu comme du code, tombe correctement — aucun nom de
 *    météo ne vit dans ce module.
 */

/** Toit de 4×2 cases posé en (2,2), avec le reste de la carte à ciel ouvert. */
const masse = (patch: Partial<BuildingMass> = {}): BuildingMass => ({
  id: 'nef',
  z: 0,
  footprint: [{ x: 2, y: 2, w: 4, h: 2 }],
  levels: 1,
  profile: 'gable',
  ridge: 'x',
  pitchDeg: 45,
  material: 'tuile',
  ...patch,
});

const sceneAvecToit = (masses: BuildingMass[]): Scene => {
  const scene = emptyScene('scene-test', 12, 12);
  scene.weather = 'pluie';
  scene.architecture = [{ id: 'corps', label: 'Corps', style: 'maison', storeys: [], facades: [], masses }];
  return scene;
};

/** Verdict d'abri en coordonnées MONDE, exactement comme le monte `GameStage3D`. */
const abriDe = (scene: Scene) => {
  const mpt = sceneMetresPerTile(scene);
  const champ = shelterField(scene);
  return (xM: number, zM: number, yM: number) => isSheltered(champ, xM / mpt, zM / mpt, yM);
};

/** Combien de particules, à cet instant, tombent SUR les colonnes `cells` et SOUS la cote `hM`. */
function particulesSous(champ: { pos: Float32Array; n: number }, mpt: number, cells: ReadonlySet<string>, hM: number): number {
  let compte = 0;
  for (let i = 0; i < champ.n; i++) {
    const key = `${Math.round(champ.pos[i * 3] / mpt)},${Math.round(champ.pos[i * 3 + 2] / mpt)}`;
    if (cells.has(key) && champ.pos[i * 3 + 1] < hM) compte++;
  }
  return compte;
}

/** La MÊME mesure, cumulée sur `frames` images : une colonne abritée doit rester à zéro à CHAQUE
 *  image, pas seulement sur l'arrêt sur image de la dernière. */
function cumulSousCouvert(scene: Scene, cells: ReadonlySet<string>, hM: number, frames = 240): number {
  const mpt = sceneMetresPerTile(scene);
  const champ = makeWeatherField(PLUIE, precipArea(scene, PLUIE), 'test');
  let total = 0;
  for (let f = 0; f < frames; f++) {
    stepWeatherField(champ, 1 / 60, abriDe(scene));
    total += particulesSous(champ, mpt, cells, hM);
  }
  return total;
}

const cellules = (x0: number, y0: number, w: number, h: number): Set<string> => {
  const out = new Set<string>();
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.add(`${x},${y}`);
  return out;
};

const PLUIE = AMBIANCE.iso.weather.pluie!.precip!;

describe('Semis de précipitation — SOUS COUVERT (#1176 P2-6)', () => {
  const sousLaNappe = cellules(2, 2, 4, 2); // l'emprise EXACTE de la masse
  const dehors = cellules(7, 7, 4, 4); // un carré de plein ciel, loin du bâti

  it('les cases sous la nappe ne reçoivent AUCUNE particule ; les mêmes, sans la masse, en reçoivent', () => {
    const couverte = sceneAvecToit([masse()]);
    const plafond = shelterField(couverte).get('3,2')!.ceilingM;
    expect(plafond).toBeGreaterThan(0); // le toit EST là (sinon la sonde ne mesurerait rien)

    // Sur 240 images : pas UNE particule sous le toit…
    expect(cumulSousCouvert(couverte, sousLaNappe, plafond)).toBe(0);
    // …alors qu'il pleut bel et bien dehors, à la même cote : la sonde n'est pas inerte.
    expect(cumulSousCouvert(couverte, dehors, plafond)).toBeGreaterThan(0);

    // Le MÊME plan SANS la masse : le ciel est ouvert au même endroit — c'est le plan qui décide, et
    // rien d'autre (ni la vue, ni le dégagement).
    const abattue = sceneAvecToit([]);
    expect(shelterField(abattue).get('3,2')).toBeUndefined();
    expect(cumulSousCouvert(abattue, sousLaNappe, plafond)).toBeGreaterThan(0);
  });

  it('le couvert ne dépend PAS de la vue : la même politique que le dégagement d’architecture', () => {
    const scene = sceneAvecToit([masse()]);
    const champ = shelterField(scene);
    // Sous la nappe : abrité. Au-dessus de son égout : dehors (on est sur le toit).
    const plafond = champ.get('3,2')!.ceilingM;
    expect(isSheltered(champ, 3, 2, plafond - 0.01)).toBe(true);
    expect(isSheltered(champ, 3, 2, plafond + 0.01)).toBe(false);
    expect(isSheltered(champ, 8, 8, 0)).toBe(false); // hors emprise : ciel ouvert
  });
});

describe('Semis de précipitation — RECYCLAGE (#1176 P2-6)', () => {
  const scene = sceneAvecToit([masse()]);
  const aire = () => precipArea(scene, PLUIE);

  it('le compte est CONSTANT et le volume est tenu sur 600 pas — rien ne croît, rien ne fuit', () => {
    const a = aire();
    const champ = makeWeatherField(PLUIE, a, 'recyclage');
    const n0 = champ.n;
    expect(n0).toBeGreaterThan(100);
    for (let f = 0; f < 600; f++) {
      stepWeatherField(champ, 1 / 60, abriDe(scene));
      expect(champ.n).toBe(n0);
      expect(champ.pos.length).toBe(n0 * 3);
    }
    for (let i = 0; i < champ.n; i++) {
      expect(champ.pos[i * 3 + 1]).toBeGreaterThan(a.groundM);
      expect(champ.pos[i * 3 + 1]).toBeLessThanOrEqual(a.topM + 1e-3);
      expect(champ.pos[i * 3]).toBeGreaterThanOrEqual(a.x0);
      expect(champ.pos[i * 3]).toBeLessThanOrEqual(a.x1);
      expect(champ.pos[i * 3 + 2]).toBeGreaterThanOrEqual(a.z0);
      expect(champ.pos[i * 3 + 2]).toBeLessThanOrEqual(a.z1);
    }
  });

  it('une particule qui a touché le sol est REVENUE en haut (le recyclage a bien eu lieu)', () => {
    const a = aire();
    const champ = makeWeatherField(PLUIE, a, 'recyclage');
    // Un pas assez long pour que TOUT le semis traverse le volume — la plus LENTE des particules
    // comprise (jitter minimal 0,8) : tout doit être recyclé.
    const recycles = stepWeatherField(champ, (a.topM - a.groundM) / (PLUIE.fallMs * 0.8), CIEL_OUVERT);
    expect(recycles).toBe(champ.n);
    for (let i = 0; i < champ.n; i++) expect(champ.pos[i * 3 + 1]).toBe(a.topM);
  });

  it('le semis n’alloue RIEN par pas : les mêmes tampons d’un bout à l’autre', () => {
    const champ = makeWeatherField(PLUIE, aire(), 'recyclage');
    const pos = champ.pos;
    const jitter = champ.jitter;
    for (let f = 0; f < 50; f++) stepWeatherField(champ, 1 / 60, abriDe(scene));
    expect(champ.pos).toBe(pos);
    expect(champ.jitter).toBe(jitter);
  });
});

describe('Semis de précipitation — la DONNÉE seule décide (#1176 P2-6)', () => {
  const AIRE: PrecipArea = { x0: 0, x1: 40, z0: 0, z1: 40, groundM: 0, topM: 10 };

  /** Une météo FORGÉE : ni dans `ambiance.json`, ni dans `Scene['weather']`, ni nulle part au code. */
  const GRELE: WeatherPrecipDef = {
    density: 0.1,
    fallMs: 20,
    windMs: { x: -3, z: 1 },
    widthM: 0.12,
    lengthM: 0.2,
    ceilingM: 10,
    color: '#ffffff',
    opacity: 0.9,
  };

  it('un type FORGÉ tombe, sans une ligne de code qui le nomme', () => {
    const champ = makeWeatherField(GRELE, AIRE, 'grele');
    expect(champ.n).toBe(precipCount(GRELE, AIRE));
    const avant = [...champ.pos];
    stepWeatherField(champ, 0.1, CIEL_OUVERT);
    // Chute et dérive EXACTEMENT au rythme de la donnée (jitter de vitesse compris, dans ±20 %).
    for (let i = 0; i < champ.n; i++) {
      if (champ.pos[i * 3 + 1] === AIRE.topM) continue; // recyclée : elle n'a plus d'histoire
      expect(champ.pos[i * 3] - avant[i * 3]).toBeCloseTo(GRELE.windMs.x * 0.1, 5);
      expect(champ.pos[i * 3 + 2] - avant[i * 3 + 2]).toBeCloseTo(GRELE.windMs.z * 0.1, 5);
      const chute = avant[i * 3 + 1] - champ.pos[i * 3 + 1];
      expect(chute).toBeGreaterThanOrEqual(GRELE.fallMs * 0.1 * 0.8 - 1e-4);
      expect(chute).toBeLessThanOrEqual(GRELE.fallMs * 0.1 * 1.2 + 1e-4);
    }
  });

  it('la DENSITÉ de donnée fixe le compte, et le budget dur l’écrête', () => {
    expect(precipCount(GRELE, AIRE)).toBe(Math.round(0.1 * 40 * 40));
    expect(precipCount({ ...GRELE, density: 2 }, { ...AIRE, x1: 400, z1: 400 })).toBe(MAX_PRECIP);
  });

  it('deux semis de même seed sont IDENTIQUES (aucun `Math.random` sur le chemin de rendu)', () => {
    const a = makeWeatherField(GRELE, AIRE, 'meme');
    const b = makeWeatherField(GRELE, AIRE, 'meme');
    stepWeatherField(a, 0.3, CIEL_OUVERT);
    stepWeatherField(b, 0.3, CIEL_OUVERT);
    expect([...a.pos]).toEqual([...b.pos]);
  });

  it('la donnée du JEU est complète pour ce qui TOMBE, et muette pour ce qui ne tombe pas', () => {
    expect(scenePrecip({ weather: 'pluie' })).toBe(AMBIANCE.iso.weather.pluie!.precip);
    expect(scenePrecip({ weather: 'neige' })!.fallMs).toBeLessThan(scenePrecip({ weather: 'pluie' })!.fallMs);
    expect(scenePrecip({ weather: 'tempete' })!.density).toBeGreaterThan(scenePrecip({ weather: 'pluie' })!.density);
    expect(Math.abs(scenePrecip({ weather: 'tempete' })!.windMs.x))
      .toBeGreaterThan(Math.abs(scenePrecip({ weather: 'pluie' })!.windMs.x));
    expect(scenePrecip({ weather: 'brouillard' })).toBeNull(); // le brouillard ne TOMBE pas
    expect(scenePrecip({ weather: 'clair' })).toBeNull();
    expect(scenePrecip({ weather: 'pluie', ambiance: 'interieur' })).toBeNull(); // il ne pleut pas dedans
  });
});

describe('Semis de précipitation — matrices d’instance (#1176 P2-6)', () => {
  const AIRE: PrecipArea = { x0: 0, x1: 10, z0: 0, z1: 10, groundM: 0, topM: 8 };

  it('la BASE est commune : longueur dans le sens de la chute, largeur face à la caméra', () => {
    const base = precipBasis(PLUIE, { x: 0, y: -1, z: 0 });
    const largeur = Math.hypot(base[0], base[1], base[2]);
    const longueur = Math.hypot(base[3], base[4], base[5]);
    expect(largeur).toBeCloseTo(PLUIE.widthM, 6);
    expect(longueur).toBeCloseTo(PLUIE.lengthM, 6);
    // Le vent PENCHE la strie : sa colonne longueur n'est pas verticale.
    expect(base[3]).not.toBeCloseTo(0, 6);
    // Sans vent, elle l'est.
    const sansVent = precipBasis({ ...PLUIE, windMs: { x: 0, z: 0 } }, { x: 0, y: 0, z: -1 });
    expect(sansVent[3]).toBeCloseTo(0, 6);
    expect(sansVent[4]).toBeCloseTo(-PLUIE.lengthM, 6);
  });

  it('les matrices portent la position de CHAQUE particule et la base commune', () => {
    const champ = makeWeatherField(PLUIE, AIRE, 'matrices');
    const base = precipBasis(PLUIE, { x: 0, y: 0, z: -1 });
    const out = new Float32Array(champ.n * 16);
    writePrecipMatrices(out, champ, base, true);
    for (let i = 0; i < champ.n; i++) {
      expect(out[i * 16 + 12]).toBeCloseTo(champ.pos[i * 3], 4);
      expect(out[i * 16 + 13]).toBeCloseTo(champ.pos[i * 3 + 1], 4);
      expect(out[i * 16 + 14]).toBeCloseTo(champ.pos[i * 3 + 2], 4);
      expect(out[i * 16 + 15]).toBe(1);
      expect(out[i * 16]).toBeCloseTo(base[0], 6);
    }
    // Passe LÉGÈRE : seules les translations se réécrivent, la base reste en place.
    stepWeatherField(champ, 1 / 60, CIEL_OUVERT);
    writePrecipMatrices(out, champ, base, false);
    expect(out[13]).toBeCloseTo(champ.pos[1], 4);
    expect(out[0]).toBeCloseTo(base[0], 6);
    expect(out[15]).toBe(1);
  });
});

describe('Semis de précipitation — la DENSITÉ AU SOL ne dépend pas du bâti (#1176 P2-6)', () => {
  /** Une carte de 16×16 (assez large pour tenir une halle ET une rue loin d'elle). */
  const carte = (masses: BuildingMass[]): Scene => {
    const scene = emptyScene('scene-test', 16, 16);
    scene.weather = 'pluie';
    scene.architecture = [{ id: 'corps', label: 'Corps', style: 'maison', storeys: [], facades: [], masses }];
    return scene;
  };
  /** Une halle de 8×8 cases — le quart de la carte sous un même toit. */
  const halle = masse({ footprint: [{ x: 2, y: 2, w: 8, h: 8 }] });
  const rue = cellules(12, 12, 4, 4); // un carré de PLEIN CIEL, à l'opposé de la halle

  /** Particules par image vues au-dessus de la rue, sous 4 m, une fois le régime établi. */
  function densiteDeRue(scene: Scene, images = 900, transitoire = 300): number {
    const mpt = sceneMetresPerTile(scene);
    const champ = makeWeatherField(PLUIE, precipArea(scene, PLUIE), 'densite');
    const abri = abriDe(scene);
    let total = 0;
    for (let f = 0; f < images; f++) {
      stepWeatherField(champ, 1 / 60, abri);
      if (f >= transitoire) total += particulesSous(champ, mpt, rue, 4);
    }
    return total / (images - transitoire);
  }

  it('un grand toit voisin ne fait pas pleuvoir plus fort dans la rue', () => {
    const sans = densiteDeRue(carte([]));
    const avec = densiteDeRue(carte([halle]));
    expect(sans).toBeGreaterThan(1); // la mesure n'est pas inerte
    // La goutte qu'un toit arrête ne va pas grossir l'averse d'à côté : elle repart de SA colonne.
    expect(Math.abs(avec / sans - 1)).toBeLessThan(0.03);
  });
});

describe('Semis de précipitation — RETENU sur ce qui le détermine (#1176 P2-6)', () => {
  const scene = sceneAvecToit([masse()]);

  it('une nouvelle référence du MÊME plan rend le MÊME champ, positions intactes', () => {
    const slot = retainWeatherField(null, scene, PLUIE, 'retenu');
    for (let f = 0; f < 120; f++) stepWeatherField(slot.champ, 1 / 60, abriDe(scene));
    const positions = [...slot.champ.pos];
    // Ce que produit le store à chaque pas d'un combattant : le même plan, une autre référence.
    expect(retainWeatherField(slot, { ...scene }, PLUIE, 'retenu')).toBe(slot);
    expect([...slot.champ.pos]).toEqual(positions);
  });

  it('la scène, la météo authorée et l’emprise renouvellent le semis — rien d’autre', () => {
    const slot = retainWeatherField(null, scene, PLUIE, 'retenu');
    expect(retainWeatherField(slot, { ...scene, id: 'une-autre-scene' }, PLUIE, 'retenu')).not.toBe(slot);
    expect(retainWeatherField(slot, { ...scene, weather: 'neige' }, PLUIE, 'retenu')).not.toBe(slot);
    // Emprise : un plafond de donnée plus haut, c'est un autre volume de semis.
    expect(retainWeatherField(slot, scene, { ...PLUIE, ceilingM: PLUIE.ceilingM + 5 }, 'retenu')).not.toBe(slot);
  });
});

/**
 * LA MÉTÉO À L'ÉCRAN (#3625) : la porte unique de la météo d'une scène (`sceneWeatherFx`) et ce que chaque regard en
 * montre (`meteoDuRegard`), que tout hôte du noyau pose tel quel. Densité, chute, vent, taille, teinte, plafond et nappes
 * viennent de la donnée (`ambiance.json › iso.weather`) ; aucun type de météo n'est nommé ici. Repère des builders :
 * X = est, Y = haut, Z = sud, en mètres, la case centrée sur l'entier.
 */
import { ambiance, type WeatherBrumeDef, type WeatherFxDef, type WeatherPrecipDef } from '../../data';
import type { Regard } from './aretes';
import { sonDEffet, type SonDEffet } from '../../data/sons/registre';
import { heightAt, isIndoor, sceneMetresPerTile, type Scene } from './scene';
import { shelterField, shelterSectionAt } from './volume/toits';

/** Plafond du nombre de particules d'une scène : au-delà de quelques milliers, la pluie est déjà un rideau plein. */
export const MAX_PRECIP = 4000;

/** PORTE UNIQUE de la météo à l'écran (#1176 P2-6) : la météo que la scène montre, `null` en intérieur ou pour un id
 *  sans entrée au catalogue, `clair` compris. Le verdict d'intérieur vient de `isIndoor`, la porte de toutes les vues. */
export function sceneWeatherFx(scene: Pick<Scene, 'weather' | 'ambiance'>): WeatherFxDef | null {
  if (isIndoor(scene)) return null;
  const id = scene.weather;
  if (!id) return null;
  const registre: Partial<Record<string, WeatherFxDef>> = ambiance.iso.weather;
  return registre[id] ?? null;
}

/** Ce qui tombe sous la météo de la scène, `null` pour une météo sans `precip` (le brouillard). */
export function scenePrecip(scene: Pick<Scene, 'weather' | 'ambiance'>): WeatherPrecipDef | null {
  return sceneWeatherFx(scene)?.precip ?? null;
}

/** Les nappes de brume de la météo de la scène (#1247), `null` pour une météo sans `brume` (la pluie, la neige). */
export function sceneBrume(scene: Pick<Scene, 'weather' | 'ambiance'>): WeatherBrumeDef | null {
  return sceneWeatherFx(scene)?.brume ?? null;
}

/** Cotes extrêmes (m) du sol de la carte, toutes couches confondues : la référence verticale de la météo. Ce qui tombe
 *  part du plafond au-dessus du sol le plus haut et cesse au sol le plus bas (une particule passée sous une butte est
 *  cachée par le terrain) ; les nappes s'empilent sur le sol le plus bas. */
export function sceneGroundSpan(scene: Scene): { groundM: number; topGroundM: number } {
  const { w, h } = scene.dimensions;
  let groundM = Infinity;
  let topGroundM = -Infinity;
  for (const layer of scene.layers)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const cote = heightAt(scene, x, y, layer.z);
        if (cote < groundM) groundM = cote;
        if (cote > topGroundM) topGroundM = cote;
      }
  return {
    groundM: Number.isFinite(groundM) ? groundM : 0,
    topGroundM: Number.isFinite(topGroundM) ? topGroundM : 0,
  };
}

/** Une bande continue de colonnes à ciel ouvert sur la rangée `y`, de `x0` à `x1` inclus. */
export interface OpenRun {
  y: number;
  x0: number;
  x1: number;
}

/** Les bandes à ciel ouvert de la carte, rangée par rangée : une colonne coiffée par une masse (`shelterField`, la
 *  vérité d'abri du dépôt) en est exclue à toute hauteur. */
export function openSkyRuns(scene: Scene): OpenRun[] {
  const abris = shelterField(scene);
  const { w, h } = scene.dimensions;
  const runs: OpenRun[] = [];
  for (let y = 0; y < h; y++) {
    let debut = -1;
    for (let x = 0; x <= w; x++) {
      const ouvert = x < w && shelterSectionAt(abris, x, y) === null;
      if (ouvert && debut < 0) debut = x;
      if (!ouvert && debut >= 0) {
        runs.push({ y, x0: debut, x1: x - 1 });
        debut = -1;
      }
    }
  }
  return runs;
}

/** Une averse : la boîte (centre et demi-étendues, m) d'où tombent `nombre` particules au-dessus d'une bande. */
export interface Averse {
  centre: [number, number, number];
  demiEtendue: [number, number, number];
  nombre: number;
}

/** Ce qui tombe : les averses, le sens unitaire de la chute vent compris et sa vitesse (m/s), la taille d'une
 *  particule (m), le temps qu'elle tombe du plafond au sol le plus bas (s), sa teinte et son opacité. */
export interface PluieDuRegard {
  averses: Averse[];
  sens: { x: number; y: number; z: number };
  vitesseMs: number;
  largeurM: number;
  traineeM: number;
  dureeS: number;
  couleur: string;
  opacite: number;
}

/** Une nappe de brume : ses triangles plats (m) au-dessus des bandes à ciel ouvert, sa teinte, son opacité. */
export interface NappeDeBrume {
  positions: number[];
  couleur: string;
  alpha: number;
}

/** La météo qu'un regard montre : ce qui tombe, les nappes de brume, et le son qu'elle joue en boucle (#3834), quel
 *  que soit le regard. */
export interface MeteoDuRegard {
  pluie: PluieDuRegard | null;
  nappes: NappeDeBrume[];
  son: SonDEffet | null;
}

/** Les averses au-dessus des bandes `runs`, `densite` particules par m² de sol écrêtées au plafond du nombre, chacune
 *  posée à la cote `yM`. */
function averses(runs: readonly OpenRun[], mpt: number, densite: number, yM: number): Averse[] {
  const surfaces = runs.map((r) => (r.x1 - r.x0 + 1) * mpt * mpt);
  const total = densite * surfaces.reduce((a, s) => a + s, 0);
  const part = total > MAX_PRECIP ? MAX_PRECIP / total : 1;
  return runs
    .map((r, i) => ({
      centre: [((r.x0 + r.x1) / 2) * mpt, yM, r.y * mpt] as [number, number, number],
      demiEtendue: [((r.x1 - r.x0 + 1) / 2) * mpt, 0, mpt / 2] as [number, number, number],
      nombre: Math.round(densite * surfaces[i] * part),
    }))
    .filter((a) => a.nombre > 0);
}

/** La vitesse (m/s) d'une particule, chute et vent composés. */
const vitesse = (precip: WeatherPrecipDef): number => Math.hypot(precip.windMs.x, precip.fallMs, precip.windMs.z);

/** Deux triangles plats par bande, à la cote `yM` (m). */
export function positionsDeNappe(runs: readonly OpenRun[], mpt: number, yM: number): number[] {
  return runs.flatMap((run) => {
    const x0 = (run.x0 - 0.5) * mpt;
    const x1 = (run.x1 + 0.5) * mpt;
    const z0 = (run.y - 0.5) * mpt;
    const z1 = (run.y + 0.5) * mpt;
    return [x0, yM, z0, x1, yM, z0, x1, yM, z1, x0, yM, z0, x1, yM, z1, x0, yM, z1];
  });
}

/**
 * La météo de la scène sous le regard `regard` (`REGARDS`), `null` sans météo à montrer (`sceneWeatherFx`). Ce qui tombe
 * ne tombe qu'au-dessus des bandes à ciel ouvert, sauf au plateau, où une particule vue dans l'axe de sa chute n'est
 * qu'un point. La brume se pose en nappes en tactique ; au plateau, l'empilement vu d'en haut dégénérerait en voile plein
 * écran ; en immersion, elle resserre la brume de profondeur depuis l'œil (`lumiereDeLaScene`).
 */
export function meteoDuRegard(scene: Scene, regard: Regard): MeteoDuRegard | null {
  const fx = sceneWeatherFx(scene);
  if (!fx) return null;
  const mpt = sceneMetresPerTile(scene);
  const runs = openSkyRuns(scene);
  const { groundM, topGroundM } = sceneGroundSpan(scene);
  const precip = regard === 'plateau' ? null : fx.precip ?? null;
  const brume = fx.brume ?? null;
  return {
    pluie: precip && {
      averses: averses(runs, mpt, precip.density, topGroundM + precip.ceilingM),
      sens: { x: precip.windMs.x / vitesse(precip), y: -precip.fallMs / vitesse(precip), z: precip.windMs.z / vitesse(precip) },
      vitesseMs: vitesse(precip),
      largeurM: precip.widthM,
      traineeM: precip.lengthM,
      dureeS: (topGroundM + precip.ceilingM - groundM) / precip.fallMs,
      couleur: precip.color,
      opacite: precip.opacity,
    },
    nappes: regard === 'tactique' && brume && runs.length
      ? brume.layers.map((couche) => ({ positions: positionsDeNappe(runs, mpt, groundM + couche.hM), couleur: brume.color, alpha: couche.alpha }))
      : [],
    son: fx.son ? sonDEffet(fx.son.id) : null,
  };
}

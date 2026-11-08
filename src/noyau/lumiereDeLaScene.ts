/**
 * LA LUMIÈRE D'UNE SCÈNE (#3476, lot B), que tout hôte du noyau pose telle quelle : le soleil de l'heure (`monde/soleil`),
 * l'ambiante du palier de lumière (`ambientScalar`, `lightLevels.json`), le ciel et la brume de profondeur du lieu
 * (`ambiance.json › pov`), la teinte de la météo (`sceneWeatherFx`) et les sources ponctuelles de la scène
 * (`sceneLightSources`, ton `lightTones.json`, un ton hors catalogue au repli visible `MISSING_TONE`). Les énergies et les teintes de nuit sont des choix de RENDU, aucune
 * règle ne les chiffre. Repère des builders : X = est, Y = haut, Z = sud, en cases.
 */
import { ambiance, DEFAULT_LIGHT_TONE_ID, findLightToneById, type LightToneDef } from '../data';
import { parseHex } from '../lib/couleurHex';
import type { Regard } from './monde/aretes';
import { sceneBrume, sceneWeatherFx } from './monde/meteo';
import { heightAt, isIndoor, type Scene } from './monde/scene';
import { catalogEntry, MISSING_ID, MISSING_LABEL, MISSING_TONE } from './monde/volume/missing';
import { shelterField, shelterSectionAt } from './monde/volume/toits';
import { ambientScalar, FLAME_LIFT_M } from './monde/vision';
import { sceneSun } from './monde/soleil';
import { sceneLightSources, type VisionInput } from './visionState';

/** Énergie du soleil haut, et l'élévation (degrés) sous laquelle il s'allume en fondu depuis l'horizon. */
const ENERGIE_DU_SOLEIL = 1.3;
const FONDU_DU_SOLEIL_DEG = 15;
/** Teinte du soleil à l'horizon et en hauteur, et l'élévation (degrés) où il a pris sa teinte de jour. */
const SOLEIL_RASANT = '#ffb070';
const SOLEIL_HAUT = '#fff3df';
const TEINTE_DE_JOUR_DEG = 30;
/** Énergie de l'ambiante dans le noir complet et en plein jour. */
const AMBIANTE_NOIRE = 0.08;
const AMBIANTE_PLEINE = 0.75;
/** Teintes de l'ambiante, du ciel et de la brume de nuit, vers lesquelles le palier de lumière les tire. */
const NUIT = '#141c33';
/** Teinte de l'ambiante d'un intérieur. */
const AMBIANTE_INTERIEURE = '#e8c9a0';
/** Énergie d'une source de ton d'intensité 1. */
const ENERGIE_DES_SOURCES = 2.5;
/** Le ton de repli visible d'un id hors de `lightTones.json` : la couleur d'alarme, sans vacillement. */
const TON_HORS_CATALOGUE: LightToneDef = { id: MISSING_ID, type: 'lightTones', label: MISSING_LABEL, color: MISSING_TONE, intensity: 1 };

export interface SourceDeLumiere {
  /** Foyer en cases (x, y), sa couche, et sa hauteur (m) au-dessus du zéro de la scène. */
  x: number;
  y: number;
  z: number;
  hM: number;
  rayonCases: number;
  couleur: string;
  energie: number;
  /** Vacillement d'une flamme : part d'énergie qui oscille, et sa fréquence (Hz). */
  scintillement: { amplitude: number; hz: number } | null;
}

export interface LumiereDeLaScene {
  /** Direction unitaire VERS le soleil, null sans soleil (intérieur, nuit). */
  soleil: { vers: { x: number; y: number; z: number }; couleur: string; energie: number } | null;
  ambiante: { couleur: string; energie: number };
  /** Dégradé du ciel d'un extérieur ; null en intérieur, dont le fond est la brume. */
  ciel: { zenith: string; horizon: string } | null;
  /** Brume de profondeur : sa teinte, puis où elle commence et où elle couvre tout, en cases au-delà du point visé, ou
   *  depuis l'œil (`depuisLOeil`) en immersion : celle d'un intérieur quand le groupe est sous un toit (`shelterField`),
   *  sinon resserrée par la brume de la météo (`povTightenK`). */
  brume: { couleur: string; debutCases: number; finCases: number; depuisLOeil: boolean };
  sources: SourceDeLumiere[];
}

const versHex = (c: [number, number, number]): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Mélange de deux couleurs `#rrggbb` : `t = 0` rend `a`, `t = 1` rend `b`. */
function melange(a: string, b: string, t: number): string {
  const [ca, cb] = [parseHex(a)!, parseHex(b)!];
  return versHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * t) as [number, number, number]);
}

/** La lumière de la scène de `etat` à son heure, sous le regard `regard`. */
export function lumiereDeLaScene(etat: VisionInput & { scene: Scene }, regard: Regard): LumiereDeLaScene {
  const { scene, gameTime } = etat;
  const interieur = isIndoor(scene);
  const palier = ambientScalar(scene, gameTime, etat.lightLevel);
  const meteo = sceneWeatherFx(scene);
  const sousLaMeteo = (c: string): string => (meteo ? melange(c, meteo.tint, meteo.alpha) : c);
  const deNuit = (c: string): string => sousLaMeteo(melange(NUIT, c, palier));
  const course = sceneSun(scene, gameTime);
  const soleil = course && course.elevationDeg > 0
    ? {
        vers: course.dir,
        couleur: sousLaMeteo(melange(SOLEIL_RASANT, SOLEIL_HAUT, Math.min(1, course.elevationDeg / TEINTE_DE_JOUR_DEG))),
        energie: ENERGIE_DU_SOLEIL * palier * Math.min(1, course.elevationDeg / FONDU_DU_SOLEIL_DEG) * (1 - (meteo?.alpha ?? 0)),
      }
    : null;
  const { pov } = ambiance;
  const depuisLOeil = regard === 'immersion';
  const dedans = interieur || (depuisLOeil && shelterSectionAt(shelterField(scene), etat.partyPos.x, etat.partyPos.y) !== null);
  const profondeur = dedans ? pov.depth.indoor : pov.depth.outdoor;
  const resserrement = depuisLOeil && !dedans ? sceneBrume(scene)?.povTightenK ?? 1 : 1;
  return {
    soleil,
    ambiante: {
      couleur: interieur ? AMBIANTE_INTERIEURE : deNuit(pov.skyTop),
      energie: AMBIANTE_NOIRE + (AMBIANTE_PLEINE - AMBIANTE_NOIRE) * palier,
    },
    ciel: interieur ? null : { zenith: deNuit(pov.skyTop), horizon: deNuit(pov.fogOutdoor) },
    brume: {
      couleur: dedans ? pov.fogIndoor : deNuit(pov.fogOutdoor),
      debutCases: profondeur.fogStartT * resserrement,
      finCases: profondeur.farTiles * resserrement,
      depuisLOeil,
    },
    sources: sceneLightSources(etat).map((s) => {
      const ton = catalogEntry(findLightToneById, s.tone ?? DEFAULT_LIGHT_TONE_ID, 'lightTones', TON_HORS_CATALOGUE);
      const z = s.z ?? 0;
      return {
        x: s.pos.x + (s.foyer?.x ?? 0),
        y: s.pos.y + (s.foyer?.y ?? 0),
        z,
        hM: heightAt(scene, s.pos.x, s.pos.y, z) + (s.foyer?.h ?? FLAME_LIFT_M),
        rayonCases: s.radiusTiles,
        couleur: ton.color,
        energie: ENERGIE_DES_SOURCES * ton.intensity,
        scintillement: ton.flicker ?? null,
      };
    }),
  };
}

/**
 * COURSE DU SOLEIL EN JEU (#1176, lot P2-5) — le SECOND soleil du dépôt, et le seul qui bouge.
 *
 * DEUX soleils NOMMÉS, qui ne se croisent jamais :
 *  - le soleil de PLANCHE (`SUN_ELEVATION_DEG`/`SUN_AZIMUTH`/`sunRig`, `sceneMeshes.ts`) : élévation et
 *    azimut FIXES. C'est lui, et lui seul, que consomment les planches QC — leurs gardes
 *    l'épinglent, donc une planche ne change pas parce que l'heure de
 *    jeu a tourné ;
 *  - le soleil de JEU (ce module) : l'heure de l'horloge (`state.gameTime`, minutes) et le NORD de la
 *    scène (`Scene.northDeg`) donnent sa direction. C'est lui que monte l'écran de jeu volumique
 *    (`stage/stageLights.ts` → `stage/GameStage3D.tsx`).
 *
 * COURBE (MAISON, assumée) — aucune simulation astronomique : le canon est muet sur l'heure du lever
 * et du coucher (`engine/clock.ts`, `DAY_PHASES`). Une seule arche, symétrique autour de MIDI :
 *  - lever à `dawnMinute` (05:00, la donnée éditable `calendarPhases`), coucher à son symétrique
 *    (19:00) ; hors de cette fenêtre, AUCUN soleil (`null`) — la nuit est gouvernée par les paliers de
 *    `lightLevels.json` (`ambientScalar`), pas par une directionnelle rasante ;
 *  - élévation `MAX·cos(t·π/2)` avec `t ∈ [−1,1]` (−1 = lever, 0 = midi, +1 = coucher) : nulle aux deux
 *    bouts, maximale à midi ;
 *  - azimut EST → SUD → OUEST (hémisphère nord du Vieux Monde) : relèvement `180 + t·90` degrés, compté
 *    depuis le nord dans le sens horaire (90 = est, 180 = sud, 270 = ouest).
 *
 * REPÈRE — `worldTris.ts` : X = est, Y = haut, Z = sud. Le nord IMPLICITE d'une scène est donc `−z`
 * (c'est la forme canonique de `WallSeg.side:'N'`, `state/scene.ts` : l'arête entre (x,y) et (x,y−1)).
 * `northDeg` est la rotation HORAIRE, vue du dessus, du nord réel par rapport à ce `−z` : elle s'ajoute
 * au relèvement du soleil. `northDeg = 0` = le nord implicite d'aujourd'hui.
 */
import { dawnMinute, MINUTES_PER_DAY } from '../../../engine/clock';
import { isIndoor, type Scene } from '../../../state/scene';
import { SUN_ELEVATION_DEG } from './sceneMeshes';

/** Minute de jour de MIDI solaire — le sommet de l'arche. */
export const SOLAR_NOON_MINUTE = 12 * 60;

/** Élévation MAXIMALE (midi) du soleil de jeu. CALÉE sur le soleil de planche, jamais posée à vue :
 *  la courbe passe EXACTEMENT par l'élévation calibrée de planche (38°, mesurée #1176 sur l'occultation
 *  des sols) à mi-matinée et mi-après-midi (`t = ±½`, soit `cos(π/4)`) — d'où `38 / cos(π/4)` = 53,74°. */
export const SUN_JEU_MAX_ELEVATION_DEG = SUN_ELEVATION_DEG / Math.cos(Math.PI / 4);

/** Demi-arche (minutes) : de MIDI au coucher, soit autant que du lever à midi. */
export const sunJeuHalfArcMin = (): number => SOLAR_NOON_MINUTE - dawnMinute();

/** Soleil de jeu à un instant donné. `dir` est la direction unitaire du POINT OÙ IL EST (même
 *  convention que `SUN_AZIMUTH`, le soleil de planche), en repère three (x = est, y = haut, z = sud). */
export interface SunJeu {
  dir: { x: number; y: number; z: number };
  /** Élévation au-dessus de l'horizon (degrés) : 0 aux deux crépuscules, maximale à midi. */
  elevationDeg: number;
  /** Azimut MONDE du soleil (degrés) : 0 = `−z`, sens horaire vu du dessus. Nord de la scène INCLUS. */
  azimuthDeg: number;
}

const deg = (rad: number) => (rad * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
const minuteOfDay = (minutes: number) => ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

/** Position du soleil à l'heure `gameTime` (minutes d'horloge), pour une scène dont le nord est tourné
 *  de `northDeg`. `null` hors de l'arche diurne : la nuit n'a pas de soleil — et `null` aussi pour une
 *  heure qui n'est pas un nombre fini, qui poserait la lampe en `NaN` (une `DirectionalLight` à position
 *  non finie ne rend plus rien, sans une ligne de console). */
export function sunJeu(gameTime: number, northDeg = 0): SunJeu | null {
  const t = (minuteOfDay(gameTime) - SOLAR_NOON_MINUTE) / sunJeuHalfArcMin();
  if (!Number.isFinite(t) || t < -1 || t > 1) return null;
  const elevationDeg = SUN_JEU_MAX_ELEVATION_DEG * Math.cos((t * Math.PI) / 2);
  const nord = Number.isFinite(northDeg) ? northDeg : 0;
  const azimuthDeg = (((180 + t * 90 + nord) % 360) + 360) % 360;
  const e = rad(elevationDeg);
  const a = rad(azimuthDeg);
  return {
    dir: { x: Math.sin(a) * Math.cos(e), y: Math.sin(e), z: -Math.cos(a) * Math.cos(e) },
    elevationDeg,
    azimuthDeg,
  };
}

/** Soleil DIRECT d'une scène : aucun en INTÉRIEUR (même porte que le reste du rendu — `isIndoor`, celle
 *  que `sceneIsDark` et `AmbianceVeils` interrogent déjà), sinon la course de l'heure tournée par le
 *  nord de la scène. */
export function sceneSun(scene: Pick<Scene, 'ambiance' | 'northDeg'>, gameTime: number): SunJeu | null {
  return isIndoor(scene) ? null : sunJeu(gameTime, scene.northDeg ?? 0);
}

/** Élévation (degrés) d'une direction de soleil — l'inverse de la pose, pour les gardes et le diagnostic. */
export function sunElevationOf(dir: { x: number; y: number; z: number }): number {
  return deg(Math.atan2(dir.y, Math.hypot(dir.x, dir.z)));
}

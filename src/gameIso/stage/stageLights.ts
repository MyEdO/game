/**
 * LUMIÈRE DE L'ÉCRAN DE JEU volumique (#1176, lot P2-5) — module PUR à part de `GameStage3D`, au même
 * titre que `boardPose.ts` (pose) et `stage3dCamera.ts` (cadrage) : l'écran MONTE ce que cette passe
 * décide, il ne décide rien lui-même. Aucun DOM, aucun renderer — des scalaires et deux objets `three`.
 *
 * UN SEUL PROPRIÉTAIRE DE LUMINOSITÉ. Le canevas porte TOUTE la luminosité de la scène, dosée sur le
 * palier authoré (`catalog/ambiance.ts`, `ambianceLuminance` → `nightVeilMax`) : ses lampes rendent le
 * COMPLÉMENT du voile de nuit que décrit cette donnée — d'où un plancher non nul à luminosité 0
 * (le palier `tenebres` rend `1 − nightVeilMax`, jamais un écran noir). La grandeur se lit sur une
 * surface HORIZONTALE, la surface de référence de `surfaceLuminance` : depuis le modelé de forme
 * (#1300), une face VERTICALE rend ce plancher multiplié par le facteur de sa famille d'orientation
 * (`AMBIANCE.faceShade`).
 *
 * DEUX lampes au plus, et la seconde a une PORTE :
 *  - l'AMBIANTE existe toujours. Son intensité suit le palier de lumière de la scène (`ambientScalar` →
 *    `lightLevels.json`, le `scalar` de jour/couvert/crépuscule/nuit/ténèbres, ou la mise en scène
 *    `state.lightLevel`) passé par `ambianceLuminance`. Sans soleil, elle porte la scène ENTIÈRE ; sous
 *    le soleil PLEIN, elle redescend à la part `AMBIENT_INTENSITY` du réglage à deux lampes
 *    (`sunContrast`), et le passage de l'une à l'autre suit le FONDU du soleil — donc sans marche ;
 *  - la DIRECTIONNELLE (le soleil, avec ses ombres) n'est montée QUE si la scène en a un : `sceneSun`
 *    — aucun soleil en intérieur (porte `isIndoor`, celle du reste du rendu), aucun hors de l'arche
 *    diurne, et aucun sous l'élévation d'ACNÉ (`sunFade` ci-dessous). Sa direction vient de l'heure
 *    d'horloge et du nord de la scène. Le REGARD est la QUATRIÈME de ces portes (`ombreSoleil`,
 *    `viewPolicy`) et se pose au MÊME endroit que les trois autres, sur le FONDU : une vue sans
 *    soleil rend le régime SANS SOLEIL complet — `fade = 0`, `lit` faux, ambiante pleine, modelé de
 *    forme plein — et non « la même scène amputée de sa lampe ».
 *
 * Les matériaux du monde sont TOUJOURS lambertiens (`GameStage3D`) : c'est ce qui rend la continuité
 * structurelle — il n'y a plus de régime à basculer au crépuscule, seulement des intensités qui
 * tendent vers zéro.
 *
 * Le soleil de PLANCHE (fixe) vit dans `backends/webgl/sceneMeshes.ts` : les gardes QC
 * l'épinglent, et c'est pourquoi il ne se règle pas ici.
 *
 * FRUSTUM D'OMBRE : `sunRigFrom` serre son frustum sur la SPHÈRE englobante des casteurs, donc un cube
 * — à soleil bas, l'essentiel de la carte d'ombre 2048² tombe hors géométrie. Le serrer à la hauteur
 * réelle demande de projeter la boîte dans le repère de la lampe DANS `sunRigFrom`, que le soleil de
 * PLANCHE partage : la planche QC change avec.
 */
import * as THREE from 'three';
import type { Scene } from '../../noyau/monde/scene';
import { ambientScalar } from '../../state/vision';
import { ambianceLuminance, weatherLightScalars, type WeatherLight } from '../catalog/ambiance';
import {
  AMBIENT_INTENSITY,
  LIGHT_COLOR,
  SHADOW_NORMAL_BIAS_TEXELS,
  SUN_INTENSITY,
  sunRigFrom,
} from '../backends/webgl/sceneMeshes';
import { sceneSun, type SunJeu } from '../backends/webgl/sunJeu';

/** Élévation (degrés) SOUS laquelle un receveur rasant acnéise : le décalage de profondeur qu'un texel
 *  d'ombre couvre sur une pente vue à `élévation` vaut `texel / tan(élévation)`, et il dépasse le
 *  décalage de normale (`SHADOW_NORMAL_BIAS_TEXELS` texels) dès `tan(élévation) < 1 / texels`. Le
 *  rapport est SANS DIMENSION : ni la taille de la carte ni celle de la carte d'ombre n'y entrent. */
export const SUN_ACNE_ELEVATION_DEG = (Math.atan(1 / SHADOW_NORMAL_BIAS_TEXELS) * 180) / Math.PI;

/** Élévation (degrés) à partir de laquelle le soleil brille à PLEINE intensité. Entre elle et
 *  `SUN_ACNE_ELEVATION_DEG`, le soleil s'allume en fondu : le lever et le coucher gagnent leur
 *  transition, et l'acné rasante s'éteint avant d'exister. */
export const SUN_FADE_FULL_DEG = SUN_ACNE_ELEVATION_DEG + 8;

/** Part du soleil réellement allumée à cette élévation : 0 au ras (acné), 1 en hauteur, `smoothstep`
 *  entre les deux (dérivée nulle aux deux bouts — aucune cassure à l'allumage ni à l'extinction). */
export function sunFade(elevationDeg: number): number {
  const t = (elevationDeg - SUN_ACNE_ELEVATION_DEG) / (SUN_FADE_FULL_DEG - SUN_ACNE_ELEVATION_DEG);
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** DÉCISION de lumière, en scalaires purs — ce dont l'écran a besoin avant même de monter une lampe. */
export interface StageLightScalars {
  /** La course du soleil de la scène à cette heure (`null` = intérieur ou nuit) — diagnostic. */
  course: SunJeu | null;
  /** Part du soleil allumée (`sunFade` de son élévation) : 0 tant qu'il rase, 1 au-dessus. */
  fade: number;
  /** Un soleil éclaire-t-il RÉELLEMENT la scène (donc : ombres portées, disque de contact inutile). */
  lit: boolean;
  /** Ce que la MÉTÉO authorée fait à la lumière (#1247) — dérivé de `tint`/`alpha`. `dim` est déjà
   *  appliqué aux trois grandeurs ci-dessous ; `tint` et `k` servent à la COULEUR des lampes et du
   *  fond. */
  meteo: WeatherLight;
  /** Intensité de l'ambiante, en unités three (facteur `π` compris). */
  ambientIntensity: number;
  /** Intensité de la directionnelle, en unités three (facteur `π` compris) — 0 quand elle n'est pas montée. */
  sunIntensity: number;
  /** LUMINANCE du seul PALIER d'ambiance (`ambianceLuminance`), soleil exclu — le complément exact du
   *  voile de nuit authoré. C'est le scalaire que COMPLÈTENT les flaques de lampe
   *  (`stagePointLights.ts`) : à 1 (plein jour) il ne reste rien à allumer. Un NOMBRE, sans rapport
   *  avec `Scene.ambiance`, qui est l'id du LIEU (`exterieur`/`interieur`). */
  ambianceLum: number;
  /** LUMINANCE d'une surface horizontale de la scène, en part de son albédo — l'exposition globale de
   *  la frame. C'est le scalaire que multiplient les surfaces NON lambertiennes (billboards), qui n'ont
   *  pas de normale exploitable. Sans soleil, elle vaut exactement `ambianceLuminance(palier)`, soit le
   *  complément du voile de nuit authoré. */
  surfaceLuminance: number;
}

/**
 * Intensités en unités PHYSIQUES (three ≥ r155) : sous le lambertien de three, une ambiante d'intensité
 * `I` rend `albédo · I / π` (`BRDF_Lambert` porte le `RECIPROCAL_PI`) — le facteur `Math.PI` ramène donc
 * l'intensité à sa part d'albédo à l'écran. Même conversion que pour les planches.
 */
export function stageLightScalars(args: {
  scene: Pick<Scene, 'ambiance' | 'northDeg' | 'ambientLight' | 'weather'>;
  gameTime: number;
  lightLevel: number | null | undefined;
  /** Le REGARD porté sur la scène veut-il un soleil (`viewPolicy`, verdict `ombreSoleil`) ? Défaut :
   *  oui. C'est la SEULE porte de vue de cette décision, et elle s'applique ICI, sur le fondu — pas
   *  chez les consommateurs, qui divergeraient un à un. */
  ombreSoleil?: boolean;
}): StageLightScalars {
  const course = sceneSun(args.scene as Scene, args.gameTime);
  const palier = ambientScalar(args.scene as Scene, args.gameTime, args.lightLevel ?? null);
  // MÉTÉO (#1247) : la donnée authorée (`tint`/`alpha`), dérivée en scalaires (`weatherLightScalars`).
  // `dim` est le facteur d'exposition APPARIÉ EN LUMINANCE au voile que cette donnée décrit sur
  // l'albédo de référence — il vaut plus de 1 sous une météo plus CLAIRE que la scène (neige,
  // brouillard). L'orage se joue par les LAMPES, jamais par un rect posé par-dessus.
  const meteo = weatherLightScalars(args.scene);
  const expo = ambianceLuminance(palier) * meteo.dim;
  // RÉGIME SANS SOLEIL, dit UNE fois : le regard qui n'en veut pas (`viewPolicy.ombreSoleil`) éteint
  // le FONDU, et tout ce qui en descend suit ensemble — `lit` tombe à faux (donc aucune lampe montée,
  // et le disque de contact des pions revient), `sunIntensity` à zéro, l'ambiante remonte à sa part
  // pleine, et `surfaceLuminance` perd la part solaire. Les consommateurs (modelé de forme du monde,
  // exposition des billboards, ombres) n'ont AUCUNE porte à poser de leur côté.
  const fade = course && args.ombreSoleil !== false ? sunFade(course.elevationDeg) : 0;
  // L'ambiante cède au soleil À MESURE qu'il s'allume : pleine sans lui, `AMBIENT_INTENSITY` sous lui.
  const partAmbiante = 1 - (1 - AMBIENT_INTENSITY) * fade;
  const partSolaire = course ? SUN_INTENSITY * fade * Math.sin((course.elevationDeg * Math.PI) / 180) : 0;
  return {
    course,
    fade,
    lit: fade > 0,
    meteo,
    // `ambianceLum` reste le PALIER seul : c'est le complément exact du voile de nuit, et le socle que
    // COMPLÈTENT les flaques de lampe (`stagePointLights`). Une flamme ne faiblit pas sous l'averse.
    ambianceLum: ambianceLuminance(palier),
    ambientIntensity: expo * partAmbiante * Math.PI,
    sunIntensity: expo * SUN_INTENSITY * fade * Math.PI,
    surfaceLuminance: expo * (partAmbiante + partSolaire),
  };
}

export interface StageLights extends StageLightScalars {
  /** Ambiante — toujours présente. */
  ambient: THREE.AmbientLight;
  /** Soleil DIRECT (ombres portées) — `null` en intérieur, de nuit, et tant qu'il rase l'horizon. */
  sun: THREE.DirectionalLight | null;
}

/** Lampes de la scène à l'instant `gameTime`. `shadowBox` = la boîte des CASTEURS (géométrie +
 *  billboards, `worldShadowBox`), qui serre le frustum d'ombre. `lightLevel` = la mise en scène runtime
 *  (`state.lightLevel`), prioritaire sur le palier authoré — exactement comme pour les voiles.
 *
 *  COULEUR sous la météo (#1247) : les deux lampes du CIEL se déplacent vers la teinte authorée, du
 *  dosage de son alpha — c'est ce qui rend l'orage bleu-gris et la brume laiteuse. Les lampes
 *  PONCTUELLES (`stagePointLights.ts`, pool à part) n'en reçoivent RIEN : une flamme reste une flamme
 *  sous l'orage, et c'est le CONTRASTE entre un ciel éteint et un braséro intact qui rend l'orage
 *  lisible — la dimmer ferait un écran uniformément gris. */
export function meteoLightColor(meteo: WeatherLight): THREE.Color {
  const base = new THREE.Color(LIGHT_COLOR);
  return meteo.tint ? base.lerp(new THREE.Color(meteo.tint), meteo.k) : base;
}

export type ArgsLampes = {
  scene: Scene;
  gameTime: number;
  lightLevel: number | null | undefined;
  shadowBox: THREE.Box3;
  /** Le REGARD porté sur la scène veut-il un soleil (`viewPolicy`, verdict `ombreSoleil`) — passé tel
   *  quel à la décision ci-dessus, qui l'applique sur le FONDU. Aucune porte ici : `lit` suffit. */
  ombreSoleil?: boolean;
};

/** RÉGLAGE d'un soleil déjà monté sur la décision courante — la seule écriture qu'une heure demande.
 *  Partagée par le montage neuf (`stageLights`) et la repose (`poserLampesDuCiel`) : deux lois de
 *  réglage divergeraient au premier champ ajouté. */
function réglerSoleil(sun: THREE.DirectionalLight, teinte: THREE.Color, intensité: number, rig: ReturnType<typeof sunRigFrom>): void {
  sun.color.copy(teinte);
  sun.intensity = intensité;
  sun.position.copy(rig.position);
  sun.target.position.copy(rig.target);
  sun.castShadow = true;
  const cam = sun.shadow.camera;
  cam.left = -rig.span; cam.right = rig.span; cam.top = rig.span; cam.bottom = -rig.span;
  cam.near = rig.near;
  cam.far = rig.far;
  cam.updateProjectionMatrix();
  // La carte d'ombre est ALLOUÉE à sa taille : la retailler sur une lampe qui vit demande de libérer
  // celle qui est en place, sinon la texture d'avant reste sur le GPU sans lecteur.
  if (sun.shadow.mapSize.x !== rig.mapSize || sun.shadow.mapSize.y !== rig.mapSize) {
    sun.shadow.map?.dispose();
    sun.shadow.map = null as unknown as THREE.DirectionalLightShadow['map'];
    sun.shadow.mapSize.set(rig.mapSize, rig.mapSize);
  }
  // Décalage le long de la NORMALE (jamais un biais de profondeur seul) : c'est lui qui sépare un plan
  // de son propre rendu dans la carte d'ombre. Il ne suffit plus sous `SUN_ACNE_ELEVATION_DEG` — d'où
  // le fondu, qui éteint le soleil avant d'y arriver.
  sun.shadow.normalBias = rig.normalBias;
}

export function stageLights(args: ArgsLampes): StageLights {
  const scalars = stageLightScalars(args);
  const teinte = meteoLightColor(scalars.meteo);
  const ambient = new THREE.AmbientLight(teinte, scalars.ambientIntensity);
  if (!scalars.lit || !scalars.course) return { ...scalars, ambient, sun: null };
  const sun = new THREE.DirectionalLight();
  réglerSoleil(sun, teinte, scalars.sunIntensity, sunRigFrom(args.shadowBox, scalars.course.dir));
  return { ...scalars, ambient, sun };
}

/**
 * LES LAMPES DU CIEL POSÉES DANS UN GROUPE, et REPOSÉES ensuite (#1401) — jamais reconstruites.
 *
 * `stageLights` ci-dessus rend une DÉCISION avec ses objets neufs : c'est ce qu'il faut à une planche
 * QC ou à un instantané (`planSnapshot`), qui montent une scène et la jettent. L'écran de jeu, lui,
 * VIT : son heure avance minute par minute, et une avance d'horloge n'est qu'un réglage d'intensité,
 * de teinte et de direction. Un franchissement d'entrée est une REPOSE — garde
 * `stage/murage-identite.test.tsx`, geste « une heure ».
 *
 * Ce qui reste un MONTAGE, et pourquoi : le SOLEIL ne naît qu'au premier régime éclairé et se démonte
 * en le quittant (`lit` faux — intérieur, nuit, soleil rasant, regard sans soleil). Le compte de
 * lampes directionnelles entre dans la clé de programme de three (`numDirectionalLights`) : le tenir
 * monté à intensité nulle compilerait toute la scène pour une lampe éteinte, et le tenir `castShadow`
 * ferait rendre une carte d'ombre de nuit. Franchir ce régime est donc le SEUL churn de lampes qui
 * reste, et il est structurel.
 */
export interface LampesDuCiel {
  /** L'ambiante, montée UNE fois — elle existe sous tous les régimes. */
  readonly ambiante: THREE.AmbientLight;
  /** Le soleil MONTÉ, ou `null` sous un régime sans soleil. */
  readonly soleil: THREE.DirectionalLight | null;
  /** Applique la décision courante aux lampes en place. Rend les scalaires de cette décision. */
  reposer(args: ArgsLampes): StageLightScalars;
  /** Retire du groupe et libère tout ce qui a été posé. */
  déposer(): void;
}

export function poserLampesDuCiel(groupe: THREE.Group): LampesDuCiel {
  const ambiante = new THREE.AmbientLight();
  groupe.add(ambiante);
  let soleil: THREE.DirectionalLight | null = null;
  return {
    ambiante,
    get soleil(): THREE.DirectionalLight | null { return soleil; },
    reposer(args: ArgsLampes): StageLightScalars {
      const scalars = stageLightScalars(args);
      const teinte = meteoLightColor(scalars.meteo);
      ambiante.color.copy(teinte);
      ambiante.intensity = scalars.ambientIntensity;
      if (!scalars.lit || !scalars.course) {
        if (soleil) {
          groupe.remove(soleil, soleil.target);
          soleil.dispose();
          soleil = null;
        }
        return scalars;
      }
      if (!soleil) {
        soleil = new THREE.DirectionalLight();
        // La CIBLE d'une directionnelle n'oriente la lampe que si elle vit dans le graphe rendu.
        groupe.add(soleil, soleil.target);
      }
      réglerSoleil(soleil, teinte, scalars.sunIntensity, sunRigFrom(args.shadowBox, scalars.course.dir));
      return scalars;
    },
    déposer(): void {
      groupe.remove(ambiante);
      ambiante.dispose();
      if (soleil) {
        groupe.remove(soleil, soleil.target);
        soleil.dispose();
        soleil = null;
      }
    },
  };
}

/**
 * L'ÉCHANTILLONNAGE D'UNE SCÈNE ANIMÉE (#2972, #3098) : pour chaque (clip, t) de la grille à pas fixe et des clés du clip, les positions monde déformées de chaque
 * sommet des meshes demandés (`getVertexPosition` : shape keys et skinning) et les matrices monde des os, joués par
 * `AnimationMixer` ; et la même mesure sur la pose de repos, gabarit et silhouettes appliqués.
 */
import { AnimationMixer, LoopOnce, Vector3, type AnimationClip, type Bone, type Matrix4, type Mesh, type Object3D } from 'three';
import { reposerGabarit, type GabaritPose } from './gabarit.ts';
import seuils from './gardes/seuils.json';

/** Cadence des clips que la chaîne produit et échantillonne. Partagée avec la construction
 *  (`scripts/personnage-3d/seuils.py`) : `gardes/seuils.json`. */
export const IMAGES_PAR_SECONDE: number = seuils.IMAGES_PAR_SECONDE;
/** Le pas d'échantillonnage par défaut, en secondes : une image de `IMAGES_PAR_SECONDE`. */
export const PAS_PAR_DEFAUT = 1 / IMAGES_PAR_SECONDE;

export interface Pose {
  /** Par nom de mesh, les positions monde de ses sommets, à plat (x, y, z). */
  readonly positions: ReadonlyMap<string, Float32Array>;
  /** Par nom d'os, sa matrice monde. */
  readonly os: ReadonlyMap<string, Matrix4>;
}

export interface Echantillon extends Pose {
  readonly clip: string;
  readonly t: number;
}

const sommet = new Vector3();

function poseCourante(scene: Object3D, meshes: readonly Mesh[]): Pose {
  scene.updateMatrixWorld(true);
  const positions = new Map<string, Float32Array>();
  for (const m of meshes) {
    const n = m.geometry.attributes.position.count;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      m.getVertexPosition(i, sommet).applyMatrix4(m.matrixWorld);
      p[i * 3] = sommet.x;
      p[i * 3 + 1] = sommet.y;
      p[i * 3 + 2] = sommet.z;
    }
    positions.set(m.name, p);
  }
  const os = new Map<string, Matrix4>();
  scene.traverse((n) => { if ((n as Bone).isBone) os.set(n.name, n.matrixWorld.clone()); });
  return { positions, os };
}

/** La pose de repos de `scene` (gabarit et silhouettes déjà posés) pour `meshes`. */
export const poseDeRepos = (scene: Object3D, meshes: readonly Mesh[]): Pose => poseCourante(scene, meshes);

/** Deux instants plus proches que cet écart, en secondes, sont un seul instant (clés glTF en float32). */
const INSTANTS_CONFONDUS = 1e-6;

/** Les instants d'échantillonnage de `clip` : l'union de la grille 0, `pas`, 2 `pas`… jusqu'à sa durée et des instants
 *  de toutes les clés de ses pistes, triés, sans doublon. */
export function instants(clip: AnimationClip, pas: number): number[] {
  const grille = Array.from({ length: Math.floor(clip.duration / pas + 1e-9) + 1 }, (_, k) => k * pas);
  const cles = clip.tracks.flatMap((piste) => Array.from(piste.times)).filter((t) => t >= 0 && t <= clip.duration);
  return [...grille, ...cles].sort((a, b) => a - b).filter((t, i, liste) => i === 0 || t - liste[i - 1] > INSTANTS_CONFONDUS);
}

/** Chaque (clip, t) de `clips` joué sur `scene` aux `instants` du clip au pas `pas`, pour `meshes`, `gabarit` reposé sur
 *  chaque instant joué (`reposerGabarit`). La pose de repos est rendue à la fin de chaque clip. */
export function* echantillonner(
  scene: Object3D, meshes: readonly Mesh[], clips: readonly AnimationClip[], pas = PAS_PAR_DEFAUT, gabarit: GabaritPose | null = null,
): Generator<Echantillon> {
  for (const clip of clips) {
    const mixer = new AnimationMixer(scene);
    const action = mixer.clipAction(clip);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    try {
      for (const t of instants(clip, pas)) {
        if (gabarit) reposerGabarit(gabarit, () => mixer.setTime(t));
        else mixer.setTime(t);
        yield { clip: clip.name, t, ...poseCourante(scene, meshes) };
      }
    } finally {
      action.stop();
      mixer.uncacheRoot(scene);
      scene.updateMatrixWorld(true);
    }
  }
}

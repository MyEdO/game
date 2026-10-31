/**
 * LE GABARIT D'UNE BASE POSÉ SUR UNE SCÈNE three (#2972, #3086) : `appliquerGabarit` pose `poseDuGabarit` et la carrure
 * (`hotes/godot/asset/gabarit.ts`) sur une scène fraîchement chargée (`chargerScene`). L'axe d'un os est son +Y local,
 * convention des os glTF exportés de Blender.
 */
import { Vector3, type Bone, type Mesh, type Object3D } from 'three';
import type { GabaritResolu } from '../../../../src/noyau/index.ts';
import type { ManifesteDeBase } from '../manifesteDeBase.ts';
import { poidsDeCarrure, poseDuGabarit } from '../gabarit.ts';

const os = (scene: Object3D, nom: string): Bone => {
  const b = scene.getObjectByName(nom);
  if (!(b as Bone | undefined)?.isBone) throw new Error(`gabarit : ${nom} n’est pas un os de la scène`);
  return b as Bone;
};

/** Pose les shape keys `poids` (silhouettes `feminin`, `corpulence`… ou carrure, par nom) sur chaque mesh de `scene` qui les porte. */
export function poserSilhouettes(scene: Object3D, poids: Readonly<Record<string, number>>): void {
  scene.traverse((n) => {
    const m = n as Mesh;
    if (!m.isMesh || !m.morphTargetDictionary || !m.morphTargetInfluences) return;
    for (const [nom, p] of Object.entries(poids)) {
      const i = m.morphTargetDictionary[nom];
      if (i !== undefined) m.morphTargetInfluences[i] = p;
    }
  });
}

/** La hauteur monde du plus bas des os `pieds`, la matrice monde de `scene` recalculée. */
const piedLePlusBas = (scene: Object3D, pieds: readonly Bone[]): number => {
  scene.updateMatrixWorld(true);
  return Math.min(...pieds.map((pied) => new Vector3().setFromMatrixPosition(pied.matrixWorld).y));
};

/** Le gabarit posé sur une scène par `appliquerGabarit`, que `reposerGabarit` repose sur la pose de chaque instant. */
export interface GabaritPose {
  readonly scene: Object3D;
  readonly racine: Bone;
  readonly echelle: number;
  /** Chaque os enfant d'un os de `enfantsDe` (`poseDuGabarit`), avec son facteur. */
  readonly enfants: readonly (readonly [Bone, number])[];
  /** Les os `pieds` de `poseDuGabarit`. */
  readonly pieds: readonly Bone[];
  /** La pose sans gabarit des os qu'il touche : l'échelle et la position de la racine, la position de chaque enfant. */
  readonly nonModifiee: { readonly echelle: Vector3; readonly position: Vector3; readonly enfants: readonly Vector3[] };
}

/** `jouer` (un clip qui réécrit la pose) sur la pose sans gabarit, puis `gabarit` composé avec la pose jouée, comme
 *  `GabaritDuSquelette` après l'`AnimationMixer` (`hotes/godot/projet/scripts/gabarit_du_squelette.gd`) : l'échelle de la
 *  racine, la position des enfants, puis la racine translatée pour ramener le plus bas des `pieds` à sa hauteur dans la
 *  pose jouée (`hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base »). */
export function reposerGabarit(gabarit: GabaritPose, jouer: () => void): void {
  const { scene, racine, pieds } = gabarit;
  racine.scale.copy(gabarit.nonModifiee.echelle);
  racine.position.copy(gabarit.nonModifiee.position);
  gabarit.enfants.forEach(([enfant], i) => enfant.position.copy(gabarit.nonModifiee.enfants[i]));
  jouer();
  const sol = piedLePlusBas(scene, pieds);
  racine.scale.multiplyScalar(gabarit.echelle);
  for (const [enfant, facteur] of gabarit.enfants) enfant.position.y *= facteur;
  const cible = racine.getWorldPosition(new Vector3());
  cible.y += sol - piedLePlusBas(scene, pieds);
  racine.position.copy(racine.parent ? racine.parent.worldToLocal(cible) : cible);
  scene.updateMatrixWorld(true);
}

/** Applique `facteurs` à la pose de repos de `scene` selon le manifeste de base : `poseDuGabarit` par `reposerGabarit`,
 *  puis la carrure. Rend le gabarit posé. */
export function appliquerGabarit(scene: Object3D, facteurs: GabaritResolu, manifeste: Pick<ManifesteDeBase, 'gabarit' | 'appuis'>): GabaritPose {
  const pose = poseDuGabarit(manifeste, facteurs);
  const racine = os(scene, pose.racine.os);
  const enfants = Object.entries(pose.enfantsDe).flatMap(([nom, facteur]) =>
    os(scene, nom).children.filter((enfant): enfant is Bone => (enfant as Bone).isBone === true).map((enfant) => [enfant, facteur] as const));
  const gabarit: GabaritPose = {
    scene,
    racine,
    echelle: pose.racine.echelle,
    enfants,
    pieds: pose.pieds.map((nom) => os(scene, nom)),
    nonModifiee: { echelle: racine.scale.clone(), position: racine.position.clone(), enfants: enfants.map(([enfant]) => enfant.position.clone()) },
  };
  reposerGabarit(gabarit, () => {});
  poserSilhouettes(scene, poidsDeCarrure(facteurs.st, manifeste.gabarit.st));
  scene.updateMatrixWorld(true);
  return gabarit;
}

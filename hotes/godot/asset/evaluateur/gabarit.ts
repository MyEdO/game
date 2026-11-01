/**
 * LE GABARIT D'UNE BASE POSÉ SUR UNE SCÈNE three (#2972, #3086) : `appliquerGabarit` pose `poseDuGabarit`
 * (`hotes/godot/asset/gabarit.ts`) sur une scène fraîchement chargée (`chargerScene`). L'axe d'un os est son +Y local,
 * convention des os glTF exportés de Blender.
 */
import { Vector3, type Bone, type Matrix4, type Mesh, type Object3D, type Skeleton, type SkinnedMesh } from 'three';
import type { GabaritResolu } from '../../../../src/noyau/index.ts';
import type { ManifesteDeBase } from '../manifesteDeBase.ts';
import { poseDuGabarit, type PoseDuGabarit } from '../gabarit.ts';
import { hauteurDesCandidats, peauxDesCandidats } from './candidatsDAppui.ts';

const os = (scene: Object3D, nom: string): Bone => {
  const b = scene.getObjectByName(nom);
  if (!(b as Bone | undefined)?.isBone) throw new Error(`gabarit : ${nom} n’est pas un os de la scène`);
  return b as Bone;
};

/** Pose chaque forme de `poids` par nom, clés `gabarit_*` comprises, sur chaque mesh de `scene` qui la porte. */
export function poserFormes(scene: Object3D, poids: Readonly<Record<string, number>>): void {
  scene.traverse((n) => {
    const m = n as Mesh;
    if (!m.isMesh || !m.morphTargetDictionary || !m.morphTargetInfluences) return;
    for (const [nom, p] of Object.entries(poids)) {
      const i = m.morphTargetDictionary[nom];
      if (i !== undefined) m.morphTargetInfluences[i] = p;
    }
  });
}

/** Le gabarit posé sur une scène par `appliquerGabarit`, que `reposerGabarit` repose sur la pose de chaque instant. */
export interface GabaritPose {
  readonly scene: Object3D;
  readonly racine: Bone;
  readonly echelle: number;
  /** Chaque os enfant d'un os de `enfantsDe` (`poseDuGabarit`), avec son facteur. */
  readonly enfants: readonly (readonly [Bone, number])[];
  readonly candidats: ReturnType<typeof peauxDesCandidats> | null;
  /** La pose sans gabarit des os qu'il touche : l'échelle et la position de la racine, la position de chaque enfant. */
  readonly nonModifiee: { readonly echelle: Vector3; readonly position: Vector3; readonly enfants: readonly Vector3[] };
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function poserEnfantsDuGabarit(enfants: GabaritPose['enfants']): void {
  for (const [enfant, facteur] of enfants) enfant.position.y *= facteur;
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function enfantsDuGabarit(pose: Pick<PoseDuGabarit, 'enfantsDe'>, trouver: (nom: string) => Bone): GabaritPose['enfants'] {
  return Object.entries(pose.enfantsDe).flatMap(([nom, facteur]) =>
    trouver(nom).children.filter((enfant): enfant is Bone => (enfant as Bone).isBone === true).map((enfant) => [enfant, facteur] as const));
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function bindsAuGabarit(squelette: Skeleton, pose: Pick<PoseDuGabarit, 'enfantsDe'>): Matrix4[] {
  const racines = new Set(squelette.bones.map((b): Object3D => {
    let racine: Object3D = b;
    while (racine.parent) racine = racine.parent;
    return racine;
  }));
  const enfants = enfantsDuGabarit(pose, (nom) => {
    const b = [...racines].map((racine) => racine.getObjectByName(nom)).find((n) => (n as Bone | undefined)?.isBone) as Bone | undefined;
    if (!b) throw new Error(`gabarit : ${nom} n’est pas un os du squelette`);
    return b;
  });
  const matrices = new Map<Object3D, { locale: Matrix4; monde: Matrix4; aMettreAJour: boolean }>();
  for (const racine of racines) racine.traverse((n) => matrices.set(n, { locale: n.matrix.clone(), monde: n.matrixWorld.clone(), aMettreAJour: n.matrixWorldNeedsUpdate }));
  const positions = enfants.map(([enfant]) => enfant.position.clone());
  try {
    for (const racine of racines) racine.updateMatrixWorld(true);
    const repos = squelette.bones.map((b) => b.matrixWorld.clone());
    poserEnfantsDuGabarit(enfants);
    for (const racine of racines) racine.updateMatrixWorld(true);
    return squelette.bones.map((b, i) => b.matrixWorld.clone().invert().multiply(repos[i]).multiply(squelette.boneInverses[i]));
  } finally {
    enfants.forEach(([enfant], i) => enfant.position.copy(positions[i]));
    for (const [n, matrice] of matrices) {
      n.matrix.copy(matrice.locale);
      n.matrixWorld.copy(matrice.monde);
      n.matrixWorldNeedsUpdate = matrice.aMettreAJour;
    }
  }
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function reposerGabarit(gabarit: GabaritPose, jouer: () => void): void {
  const { scene, racine, candidats } = gabarit;
  if (candidats && !candidats.courante.geometry.attributes.position.count) throw new Error('reposerGabarit : candidats vides');
  racine.scale.copy(gabarit.nonModifiee.echelle);
  racine.position.copy(gabarit.nonModifiee.position);
  gabarit.enfants.forEach(([enfant], i) => enfant.position.copy(gabarit.nonModifiee.enfants[i]));
  jouer();
  candidats?.synchroniser();
  const sol = candidats ? hauteurDesCandidats(scene, candidats.neutre) * gabarit.echelle : null;
  racine.scale.multiplyScalar(gabarit.echelle);
  poserEnfantsDuGabarit(gabarit.enfants);
  if (candidats && sol !== null) {
    const cible = racine.getWorldPosition(new Vector3());
    cible.y += sol - hauteurDesCandidats(scene, candidats.courante);
    racine.position.copy(racine.parent ? racine.parent.worldToLocal(cible) : cible);
  }
  scene.updateMatrixWorld(true);
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function appliquerGabarit(scene: Object3D, facteurs: GabaritResolu, manifeste: Pick<ManifesteDeBase, 'gabarit'> & Partial<Pick<ManifesteDeBase, 'appuis'>>, squeletteDeBase?: Skeleton, replacer = true): GabaritPose {
  const pose = poseDuGabarit(manifeste, facteurs);
  const racine = os(scene, pose.racine.os);
  const enfants = enfantsDuGabarit(pose, (nom) => os(scene, nom));
  if (replacer && !manifeste.appuis?.plusBas?.length) throw new Error('appliquerGabarit : appuis.plusBas non vide attendu');
  const candidats = replacer && manifeste.appuis ? peauxDesCandidats(scene, manifeste.appuis.plusBas, squeletteDeBase) : null;
  const squelettes = new Set<Skeleton>();
  scene.traverse((n) => { if ((n as SkinnedMesh).isSkinnedMesh) squelettes.add((n as SkinnedMesh).skeleton); });
  for (const squelette of squelettes) squelette.boneInverses = bindsAuGabarit(squelette, pose);
  if (candidats) candidats.courante.skeleton.boneInverses = bindsAuGabarit(candidats.courante.skeleton, pose);
  const gabarit: GabaritPose = {
    scene,
    racine,
    echelle: pose.racine.echelle,
    enfants,
    candidats,
    nonModifiee: { echelle: racine.scale.clone(), position: racine.position.clone(), enfants: enfants.map(([enfant]) => enfant.position.clone()) },
  };
  reposerGabarit(gabarit, () => {});
  scene.updateMatrixWorld(true);
  return gabarit;
}

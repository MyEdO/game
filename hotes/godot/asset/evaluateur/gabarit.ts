/**
 * LE GABARIT D'UNE BASE POSÉ SUR UNE SCÈNE three (#2972, #3086) : `appliquerGabarit` pose `poseDuGabarit`
 * (`hotes/godot/asset/gabarit.ts`) sur une scène fraîchement chargée (`chargerScene`). L'axe d'un os est son +Y local,
 * convention des os glTF exportés de Blender.
 */
import { Matrix4, Quaternion, Vector3, type Bone, type Mesh, type Object3D, type Skeleton, type SkinnedMesh } from 'three';
import type { GabaritResolu } from '../../../../src/noyau/index.ts';
import { poseDuGabarit, type ManifesteDuGabarit, type PoseDuGabarit } from '../gabarit.ts';
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
  /** Les jambes pliées sur un clip de `clipsPlantes` (`poseDuGabarit`). */
  readonly jambes: readonly JambeDuGabarit[];
  readonly clipsPlantes: readonly string[];
  readonly candidats: ReturnType<typeof peauxDesCandidats>;
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
export interface JambeDuGabarit { readonly cuisse: Bone; readonly mollet: Bone; readonly pied: Bone }

const estOs = (n: Object3D): n is Bone => (n as Bone).isBone === true;

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function jambesDuGabarit(pose: Pick<PoseDuGabarit, 'jambes'>, trouver: (nom: string) => Bone): JambeDuGabarit[] {
  return pose.jambes.flatMap((nom) => {
    const mollet = trouver(nom);
    const cuisse = mollet.parent;
    if (!cuisse || !estOs(cuisse) || !pose.jambes.includes(cuisse.name)) return [];
    const pieds = mollet.children.filter(estOs);
    if (pieds.length !== 1) throw new Error(`gabarit : le mollet ${nom} porte ${pieds.length} os enfant(s), un pied attendu`);
    return [{ cuisse, mollet, pied: pieds[0] }];
  });
}

/** La visée d'une jambe : la matrice monde de son pied et son extension, distance de la hanche au pied rapportée à la
 *  longueur de la jambe. */
export interface ViseeDeJambe { readonly pied: Matrix4; readonly extension: number }

/** La verticale monde de glTF. */
const HAUT = new Vector3(0, 1, 0);

const position = (os: Object3D): Vector3 => new Vector3().setFromMatrixPosition(os.matrixWorld);

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». Les matrices monde à jour. */
export const viseesDesJambes = (jambes: readonly JambeDuGabarit[]): ViseeDeJambe[] => jambes.map(({ cuisse, mollet, pied }) => {
  const [h, k, a] = [position(cuisse), position(mollet), position(pied)];
  return { pied: pied.matrixWorld.clone(), extension: a.distanceTo(h) / (k.distanceTo(h) + a.distanceTo(k)) };
});

const rotationDe = (m: Matrix4): Quaternion => {
  const q = new Quaternion();
  m.decompose(new Vector3(), q, new Vector3());
  return q;
};
const orientation = (os: Object3D): Quaternion => rotationDe(os.matrixWorld);

/** L'os `os` tourné dans le monde de l'arc le plus court qui porte la direction `de` sur `vers`. */
function tournerVers(os: Bone, de: Vector3, vers: Vector3): void {
  const arc = new Quaternion().setFromUnitVectors(de.clone().normalize(), vers.clone().normalize());
  const parent = os.parent ? orientation(os.parent) : new Quaternion();
  os.quaternion.copy(parent.invert().multiply(arc).multiply(orientation(os)));
  os.updateWorldMatrix(false, true);
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function plierLaJambe({ cuisse, mollet, pied }: JambeDuGabarit, visee: ViseeDeJambe): void {
  const [h, k, a, t] = [position(cuisse), position(mollet), position(pied), new Vector3().setFromMatrixPosition(visee.pied)];
  const l1 = k.distanceTo(h), l2 = a.distanceTo(k);
  const axe = t.clone().sub(h);
  const d = Math.min(l1 + l2, Math.max(Math.abs(l1 - l2), axe.length()));
  const u = axe.normalize();
  const genou = k.clone().sub(h);
  const pli = genou.clone().addScaledVector(u, -genou.dot(u));
  if (pli.lengthSq() < 1e-18) pli.setFromMatrixColumn(cuisse.matrixWorld, 2).addScaledVector(u, -new Vector3().setFromMatrixColumn(cuisse.matrixWorld, 2).dot(u));
  pli.normalize();
  const cos = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  tournerVers(cuisse, genou, u.clone().multiplyScalar(l1 * cos).addScaledVector(pli, l1 * Math.sqrt(1 - cos * cos)));
  const k1 = position(mollet);
  tournerVers(mollet, position(pied).sub(k1), h.clone().addScaledVector(u, d).sub(k1));
  pied.quaternion.copy(orientation(mollet).invert().multiply(rotationDe(visee.pied)));
  pied.updateWorldMatrix(false, true);
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». Les matrices monde à jour ; `haut`, la verticale monde. */
export function plierLesJambes(racine: Bone, jambes: readonly JambeDuGabarit[], visees: readonly ViseeDeJambe[], haut: Vector3): void {
  let montee = Infinity;
  jambes.forEach(({ cuisse, mollet, pied }, i) => {
    const [h, k, a] = [position(cuisse), position(mollet), position(pied)];
    const vers = new Vector3().setFromMatrixPosition(visees[i].pied).sub(h);
    const portee = visees[i].extension * (k.distanceTo(h) + a.distanceTo(k));
    const vertical = vers.dot(haut);
    const discriminant = vertical * vertical - vers.lengthSq() + portee * portee;
    if (discriminant >= 0) montee = Math.min(montee, vertical + Math.sqrt(discriminant));
  });
  if (Number.isFinite(montee)) {
    const cible = racine.getWorldPosition(new Vector3()).addScaledVector(haut, montee);
    racine.position.copy(racine.parent ? racine.parent.worldToLocal(cible) : cible);
    racine.updateWorldMatrix(false, true);
  }
  jambes.forEach((jambe, i) => plierLaJambe(jambe, visees[i]));
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». Sur la pose jouée, sans gabarit et matrices monde à jour :
 *  `jambes` vide hors d'un clip planté. */
export function poserLeGabarit(racine: Bone, echelle: number, enfants: GabaritPose['enfants'], jambes: readonly JambeDuGabarit[], haut: Vector3): void {
  racine.scale.multiplyScalar(echelle);
  racine.updateWorldMatrix(true, true);
  const visees = viseesDesJambes(jambes);
  poserEnfantsDuGabarit(enfants);
  racine.updateWorldMatrix(false, true);
  plierLesJambes(racine, jambes, visees, haut);
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
export function reposerGabarit(gabarit: GabaritPose, jouer: () => void, plante = false): void {
  const { scene, racine, candidats } = gabarit;
  if (!candidats.courante.geometry.attributes.position.count) throw new Error('reposerGabarit : candidats vides');
  racine.scale.copy(gabarit.nonModifiee.echelle);
  racine.position.copy(gabarit.nonModifiee.position);
  gabarit.enfants.forEach(([enfant], i) => enfant.position.copy(gabarit.nonModifiee.enfants[i]));
  jouer();
  candidats.synchroniser();
  const sol = hauteurDesCandidats(scene, candidats.neutre) * gabarit.echelle;
  poserLeGabarit(racine, gabarit.echelle, gabarit.enfants, plante ? gabarit.jambes : [], HAUT);
  const cible = racine.getWorldPosition(new Vector3());
  cible.y += sol - hauteurDesCandidats(scene, candidats.courante);
  racine.position.copy(racine.parent ? racine.parent.worldToLocal(cible) : cible);
  scene.updateMatrixWorld(true);
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function appliquerGabarit(scene: Object3D, facteurs: GabaritResolu, manifeste: ManifesteDuGabarit, squeletteDeBase?: Skeleton): GabaritPose {
  const pose = poseDuGabarit(manifeste, facteurs);
  const racine = os(scene, pose.racine.os);
  const enfants = enfantsDuGabarit(pose, (nom) => os(scene, nom));
  if (!manifeste.appuis?.plusBas?.length) throw new Error('appliquerGabarit : appuis.plusBas non vide attendu');
  const candidats = peauxDesCandidats(scene, manifeste.appuis.plusBas, squeletteDeBase);
  const squelettes = new Set<Skeleton>();
  scene.traverse((n) => { if ((n as SkinnedMesh).isSkinnedMesh) squelettes.add((n as SkinnedMesh).skeleton); });
  for (const squelette of squelettes) squelette.boneInverses = bindsAuGabarit(squelette, pose);
  candidats.courante.skeleton.boneInverses = bindsAuGabarit(candidats.courante.skeleton, pose);
  const gabarit: GabaritPose = {
    scene,
    racine,
    echelle: pose.racine.echelle,
    enfants,
    jambes: jambesDuGabarit(pose, (nom) => os(scene, nom)),
    clipsPlantes: pose.clipsPlantes,
    candidats,
    nonModifiee: { echelle: racine.scale.clone(), position: racine.position.clone(), enfants: enfants.map(([enfant]) => enfant.position.clone()) },
  };
  reposerGabarit(gabarit, () => {});
  scene.updateMatrixWorld(true);
  return gabarit;
}

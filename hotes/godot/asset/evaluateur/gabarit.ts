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
  readonly candidats: ReturnType<typeof peauxDesCandidats>;
  /** La pose sans gabarit des os qu'il touche : l'échelle et la position de la racine, la position de chaque enfant. */
  readonly nonModifiee: { readonly echelle: Vector3; readonly position: Vector3; readonly enfants: readonly Vector3[] };
}

/**
 * @contrat Gabarit d'une base
 * - `poserEnfantsDuGabarit(enfants)` (`asset/evaluateur/gabarit.ts`) porte l'étape commune qui multiplie le Y local
 *   des enfants. `reposerGabarit` l'appelle. `enfantsDuGabarit` y sélectionne les enfants os ; `bindsAuGabarit` et
 *   l'évaluateur lisent cette même sélection. Ces fonctions sont typées par three dans l'outillage de l'évaluateur ;
 *   la construction (`scripts/personnage-3d/base/gabarit.ts`), hors des zones du moteur, les importe directement. Le
 *   solveur unique `scripts/personnage-3d/base/laplacien.ts` est appelé par H5 et par
 *   `scripts/personnage-3d/base/laplacien.mjs` pour la correction des silhouettes ;
 *   `scripts/personnage-3d/base/gabarit.test.ts` le vérifie dans la suite principale.
 */
export function poserEnfantsDuGabarit(enfants: GabaritPose['enfants']): void {
  for (const [enfant, facteur] of enfants) enfant.position.y *= facteur;
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function enfantsDuGabarit(pose: Pick<PoseDuGabarit, 'enfantsDe'>, trouver: (nom: string) => Bone): GabaritPose['enfants'] {
  return Object.entries(pose.enfantsDe).flatMap(([nom, facteur]) =>
    trouver(nom).children.filter((enfant): enfant is Bone => (enfant as Bone).isBone === true).map((enfant) => [enfant, facteur] as const));
}

/**
 * @contrat Gabarit d'une base
 * - `bindsAuGabarit(squelette, pose)` (`asset/evaluateur/gabarit.ts`) emploie `poserEnfantsDuGabarit` au repos sans
 *   gabarit et rend tous les binds `Bind′_b = inv(G′_b)·G_b·Bind_b` : G est la matrice monde de repos sans gabarit,
 *   G′ la même après cette seule étape, hors `sl` et hors translation de la racine. L'appel attend le squelette au
 *   repos sans gabarit ; il rend les positions et matrices à leur état d'entrée et ne modifie pas ses binds.
 *   L'évaluateur les pose une fois sur chaque squelette de la scène montée dans `appliquerGabarit`, avant la pose des
 *   os ; cette fonction reçoit aussi le squelette de base comme quatrième argument optionnel, pour que les candidats
 *   emploient ses binds même en présence d’éléments montés, et ne pose aucune shape key. Les parents de la table se
 *   résolvent dans la hiérarchie des os de chaque squelette, y compris quand son skin ne les nomme pas tous. La pose
 *   des binds rendus appartient à l'intégration de chaque hôte. `matricesDuGabarit`
 *   (`scripts/personnage-3d/base/gabarit.ts`) rend K_b = G′_b·S_b·B_b⁻¹, où B_b⁻¹ est le bind inverse stocké, sans
 *   supposer le bind égal au repos. H5 résout sur les positions au repos q_i = P_i·p_i, avec P_i = Σ_b
 *   w_ib·G_b·B_b⁻¹, la peau neutre pondérée du sommet. Ses transformations relatives sont A_i = Σ_b
 *   w_ib·G′_b·S_b·G_b⁻¹, identité au neutre : les cibles d'arêtes sont ½(A_i+A_j)(q_i−q_j) et les ancres A_i·q_i. Le
 *   laplacien minimise Σ_e ‖(r_i−r_j)−½(A_i+A_j)(q_i−q_j)‖² / ℓ₀,e² sous ces mêmes ancres. ℓ₀,e = ‖q₀,i−q₀,j‖ est
 *   mesuré sur le corps neutre après sa peau P_i, dans le repère de cette énergie ; une longueur exactement nulle est
 *   refusée par `arete-de-longueur-nulle`, sans epsilon. Ces poids sont figés à `preparerGabarit`, indépendants du
 *   `repos` passé à `resoudre` : la matrice reste constante, les seconds membres et les ancres linéaires en `repos`
 *   et en chaque facteur, ce qui conserve la superposition des clés cuites et croisées. La correction des silhouettes
 *   emploie la même règle `poidsRelatifsDesAretes` et le même laplacien : elle minimise Σ_e ‖(d−d₀)_i−(d−d₀)_j‖² /
 *   ℓ₀,e², avec ℓ₀ mesuré sur ses positions neutres monde avant le quotient des sommets jumeaux ; ses contraintes de
 *   centre, d'épaisseur et de sommets fixes restent identiques. `resoudre` reçoit les positions avant skinning,
 *   applique P_i, résout dans le repère du repos puis ramène la solution par P_i⁻¹ dans le repère avant skinning ;
 *   `cuire` emploie directement cette même sortie pour calculer les deltas des clés et des clés croisées. La
 *   reconstruction est vérifiée au repos égal au bind, avec un décalage affine commun et avec des binds propres à
 *   chaque os, au neutre et sur tous les états de la fixture. Si B_b = G_b, P_i = I, q_i = p_i et K_b =
 *   G′_b·S_b·G_b⁻¹ : cette forme retrouve H5 sur les positions p_i du design #3104, point 2
 *   d'issuecomment-6543352958.
 *
 * En nommant T la transformation monde de la racine entre son repos sans gabarit et son repos posé, `sl` et
 * translation R2 comprises, la peau vaut T·P_i avec les binds compensés et les clés `gabarit_*` aux poids de
 * `poidsDuGabarit`, ce qui reconstruit H5 ; sans les binds compensés, chaque os contribue par T·G′_b·B_b⁻¹, sans le
 * facteur S_b de K_b, et s'écarte de H5 de 0,12 à 0,31 m sur la fixture
 * (`asset/evaluateur/evaluateur.hors-store.test.ts`, « repos posé A·P »).
 */
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

/**
 * @contrat Gabarit d'une base
 * À chaque pose, repos compris, l'évaluateur suit le chemin unique `reposerGabarit`, appelé par `appliquerGabarit` et
 * par `echantillonner` : (1) restaure les composantes sans gabarit, joue le clip à l'instant demandé et mesure le
 * plus bas des candidats avec les binds d'origine, les silhouettes courantes et les clés `gabarit_*` nulles ; (2)
 * compose l'échelle animée de la racine avec `sl` et le Y animé des enfants avec leur facteur, puis mesure les mêmes
 * candidats avec les binds compensés et toutes les formes courantes ; (3) translate verticalement la racine pour
 * ramener ce minimum à `sl` multiplié par celui de (1), dans le repère du parent de la racine. La translation est
 * recalculée depuis la pose sans gabarit, sans cumul. Sans candidat, `appliquerGabarit` refuse de poser le gabarit
 * (`appuis.plusBas non vide attendu`). Les deux peaux de candidats utilisent le skinning de three ; leurs géométries
 * sont des copies indépendantes des meshes évalués. `piedsAuSol` mesure toujours les sommets du corps entier, sans
 * lire les candidats.
 */
export function reposerGabarit(gabarit: GabaritPose, jouer: () => void): void {
  const { scene, racine, candidats } = gabarit;
  if (!candidats.courante.geometry.attributes.position.count) throw new Error('reposerGabarit : candidats vides');
  racine.scale.copy(gabarit.nonModifiee.echelle);
  racine.position.copy(gabarit.nonModifiee.position);
  gabarit.enfants.forEach(([enfant], i) => enfant.position.copy(gabarit.nonModifiee.enfants[i]));
  jouer();
  candidats.synchroniser();
  const sol = hauteurDesCandidats(scene, candidats.neutre) * gabarit.echelle;
  racine.scale.multiplyScalar(gabarit.echelle);
  poserEnfantsDuGabarit(gabarit.enfants);
  const cible = racine.getWorldPosition(new Vector3());
  cible.y += sol - hauteurDesCandidats(scene, candidats.courante);
  racine.position.copy(racine.parent ? racine.parent.worldToLocal(cible) : cible);
  scene.updateMatrixWorld(true);
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function appliquerGabarit(scene: Object3D, facteurs: GabaritResolu, manifeste: Required<Pick<ManifesteDeBase, 'gabarit'>> & Partial<Pick<ManifesteDeBase, 'appuis'>>, squeletteDeBase?: Skeleton): GabaritPose {
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
    candidats,
    nonModifiee: { echelle: racine.scale.clone(), position: racine.position.clone(), enfants: enfants.map(([enfant]) => enfant.position.clone()) },
  };
  reposerGabarit(gabarit, () => {});
  scene.updateMatrixWorld(true);
  return gabarit;
}

/**
 * LE GABARIT D'UNE BASE POSÉ SUR UNE SCÈNE three (#2972, #3086) : `appliquerGabarit` pose `poseDuGabarit`
 * (`hotes/godot/asset/gabarit.ts`) sur une scène fraîchement chargée (`chargerScene`). L'axe d'un os est son +Y local,
 * convention des os glTF exportés de Blender.
 */
import { Matrix4, Quaternion, Vector3, type Bone, type Mesh, type Object3D, type Skeleton, type SkinnedMesh } from 'three';
import type { GabaritResolu } from '../../../../src/noyau/index.ts';
import { poseDuGabarit, type ManifesteDuGabarit, type PoseDuGabarit } from '../gabarit.ts';
import { hauteurDesCandidats, peauxDesCandidats } from './candidatsDAppui.ts';

type Triplet = readonly [number, number, number];

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
  /** Chaque os que la pose déplace (`enfantsDuGabarit`), avec son facteur et sa translation. */
  readonly enfants: readonly (readonly [Bone, number, Triplet])[];
  /** Les jambes pliées sur un clip de `clipsPlantes` (`poseDuGabarit`). */
  readonly jambes: readonly JambeDuGabarit[];
  readonly clipsPlantes: readonly string[];
  readonly candidats: ReturnType<typeof peauxDesCandidats>;
  /** La pose sans gabarit des os qu'il touche : l'échelle et la position de la racine, la position de chaque os de `enfants`. */
  readonly nonModifiee: { readonly echelle: Vector3; readonly position: Vector3; readonly enfants: readonly Vector3[] };
}

/**
 * @contrat Gabarit d'une base
 * - `poserEnfantsDuGabarit(enfants)` (`asset/evaluateur/gabarit.ts`) porte l'étape commune qui multiplie le Y local
 *   de chaque os de `enfants` par son facteur puis y ajoute sa translation. `reposerGabarit` l'appelle.
 * - `enfantsDuGabarit` y sélectionne la liste unique des os que la pose déplace : chaque enfant os d'un os de
 *   `enfantsDe`, au facteur de son parent, et chaque os de `deplacementsDesOs`, à sa translation ; facteur 1 sans
 *   parent dans `enfantsDe`, translation nulle sans déplacement. `bindsAuGabarit`, `reposerGabarit` et l'évaluateur
 *   lisent cette même sélection.
 * - Ces fonctions sont typées par three dans l'outillage de l'évaluateur ;
 *   la construction (`scripts/personnage-3d/base/gabarit.ts`), hors des zones du moteur, les importe directement. Le
 *   solveur unique `scripts/personnage-3d/base/laplacien.ts` est appelé par H5 et par
 *   `scripts/personnage-3d/base/laplacien.mjs` pour la correction des silhouettes ;
 *   `scripts/personnage-3d/base/gabarit.test.ts` le vérifie dans la suite principale.
 */
export function poserEnfantsDuGabarit(enfants: GabaritPose['enfants']): void {
  for (const [enfant, facteur, [x, y, z]] of enfants) {
    enfant.position.y *= facteur;
    enfant.position.x += x;
    enfant.position.y += y;
    enfant.position.z += z;
  }
}

const NUL: Triplet = [0, 0, 0];

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function enfantsDuGabarit(pose: Pick<PoseDuGabarit, 'enfantsDe' | 'deplacementsDesOs'>, trouver: (nom: string) => Bone): GabaritPose['enfants'] {
  const facteurs = new Map<Bone, number>();
  for (const [nom, facteur] of Object.entries(pose.enfantsDe)) {
    for (const enfant of trouver(nom).children) if ((enfant as Bone).isBone) facteurs.set(enfant as Bone, facteur);
  }
  const translations = new Map(Object.entries(pose.deplacementsDesOs).map(([nom, t]) => [trouver(nom), t] as const));
  return [...new Set([...facteurs.keys(), ...translations.keys()])].map((b) => [b, facteurs.get(b) ?? 1, translations.get(b) ?? NUL] as const);
}

/** Le déplacement monde de chaque objet de `mesures` sous les seules translations de `deplaces`, matrices monde à jour
 *  en entrée ; positions et matrices rendues à leur état d'entrée. */
export function deplacementsMondeDesOs(deplaces: readonly (readonly [Bone, Triplet])[], mesures: readonly Object3D[]): Vector3[] {
  const avant = mesures.map(position);
  const positions = deplaces.map(([b]) => b.position.clone());
  try {
    for (const [b, [x, y, z]] of deplaces) b.position.add(new Vector3(x, y, z));
    for (const [b] of deplaces) b.updateWorldMatrix(false, true);
    return mesures.map((m, i) => position(m).sub(avant[i]));
  } finally {
    deplaces.forEach(([b], i) => b.position.copy(positions[i]));
    for (const [b] of deplaces) b.updateWorldMatrix(false, true);
  }
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

/**
 * @contrat Gabarit d'une base
 * - `poserLeGabarit(racine, echelle, enfants, jambes, haut)` (`asset/evaluateur/gabarit.ts`) est l'étape (2) commune à
 *   l'évaluateur et à la construction, sur la pose jouée sans gabarit : l'échelle `sl` de la racine, puis, sur un clip
 *   de `clipsPlantes`, la visée de chaque jambe (`viseesDesJambes`), la matrice monde de son pied et son extension,
 *   distance de la hanche au pied rapportée à la longueur de la jambe ; puis le Y et la translation des os de
 *   `enfants` (`poserEnfantsDuGabarit`) ; puis les jambes pliées (`plierLesJambes`). La matrice monde de chaque visée
 *   est translatée du déplacement monde que les seules translations de `enfants` donnent à son pied
 *   (`deplacementsMondeDesOs`), mesuré à l'échelle `sl` déjà posée, avant le Y multiplié et le pli : la foulée suit
 *   les os déplacés. Une jambe (`jambesDuGabarit`) est un os de `jambes` dont le parent, sa
 *   cuisse, est aussi dans `jambes` : le mollet ; son unique os enfant est le pied, et un mollet à zéro ou plusieurs os
 *   enfants est refusé. `plierLesJambes` monte la racine le long de `haut`, la verticale monde, du plus petit
 *   déplacement qui rend à une jambe son extension de la visée, puis plie chaque jambe par l'IK analytique à deux os :
 *   la cuisse et le mollet tournés de l'arc le plus court, le genou dans le plan de la hanche, de la cible et du genou
 *   courant, la distance bornée à la portée de la jambe, et le pied tourné à l'orientation monde de sa visée. Chaque
 *   pied garde ainsi la matrice monde du clip neutre à l'échelle `sl` de la racine : la foulée suit `sl` et non `legs`.
 *   À `legs` 1, l'étape est l'identité ; hors d'un clip planté, `jambes` est vide et rien ne se plie : une IK sur tous
 *   les clips tend les jambes assises, agenouillées ou roulées.
 *
 * La construction rend le pied rigide sous la cheville après la pose au sol (`rigidifier_les_pieds`,
 * `scripts/personnage-3d/base/sol.py`) : chaque sommet de la surface d'un pied que la chaîne du pied mène au moins à
 * `MAJORITE_DU_POIDS` et dont la hauteur de repos est sous la tête de l'os du pied ne garde que les poids de cette
 * chaîne, renormalisés ; un talon que le mollet mène en partie se déplacerait avec le genou plié.
 */
/** Sur la pose jouée, sans gabarit et matrices monde à jour : `jambes` vide hors d'un clip planté. */
export function poserLeGabarit(racine: Bone, echelle: number, enfants: GabaritPose['enfants'], jambes: readonly JambeDuGabarit[], haut: Vector3): void {
  racine.scale.multiplyScalar(echelle);
  racine.updateWorldMatrix(true, true);
  const translations = deplacementsMondeDesOs(enfants.map(([b, , t]) => [b, t] as const), jambes.map(({ pied }) => pied));
  const visees = viseesDesJambes(jambes).map((v, i) => ({ ...v, pied: new Matrix4().makeTranslation(translations[i]).multiply(v.pied) }));
  poserEnfantsDuGabarit(enfants);
  racine.updateWorldMatrix(false, true);
  plierLesJambes(racine, jambes, visees, haut);
}

/**
 * @contrat Gabarit d'une base
 * - `bindsAuGabarit(squelette, pose)` (`asset/evaluateur/gabarit.ts`) emploie `poserEnfantsDuGabarit`, facteurs et
 *   translations de `deplacementsDesOs` compris, au repos sans gabarit et rend tous les binds `Bind′_b = inv(G′_b)·G_b·Bind_b` : G est la matrice monde de repos sans gabarit,
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
export function bindsAuGabarit(squelette: Skeleton, pose: Pick<PoseDuGabarit, 'enfantsDe' | 'deplacementsDesOs'>): Matrix4[] {
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
 * par `echantillonner` : (1) restaure les composantes sans gabarit, joue le clip à l'instant demandé et mesure le plus
 * bas des candidats avec les binds d'origine, les silhouettes courantes et les clés `gabarit_*` nulles ; (2) compose
 * l'échelle animée de la racine avec `sl` et la position animée de chaque os de `enfants` avec son facteur et sa
 * translation, jambes pliées sur un clip de
 * `clipsPlantes` (`poserLeGabarit`), puis mesure les mêmes candidats avec les binds compensés et toutes les formes
 * courantes ; (3) translate verticalement la racine pour ramener ce minimum à `sl` multiplié par celui de (1), dans le
 * repère du parent de la racine. La translation est recalculée depuis la pose sans gabarit, sans cumul. Sans candidat,
 * `appliquerGabarit` refuse de poser le gabarit (`appuis.plusBas non vide attendu`). Les deux peaux de candidats
 * utilisent le skinning de three ; leurs géométries sont des copies indépendantes des meshes évalués. `piedsAuSol`
 * mesure toujours les sommets du corps entier, sans lire les candidats.
 */
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
export function appliquerGabarit(scene: Object3D, facteurs: GabaritResolu, manifeste: ManifesteDuGabarit, silhouettes: Readonly<Record<string, number>>, squeletteDeBase?: Skeleton): GabaritPose {
  const pose = poseDuGabarit(manifeste, facteurs, silhouettes);
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

/**
 * GARDE DES SILHOUETTES DE LA BASE (#2972, #3101 issuecomment-6483618640, décision 7) : au repos, gabarit de
 * l'évaluation appliqué, sur les meshes du corps. Référence : silhouettes à 0, formes dérivées recalculées, formes indépendantes à leur influence d'entrée.
 * Avec `st` et les deux formes de carrure, chaque silhouette hors carrure est prise à 1, seule ; la carrure par
 * `poidsDeCarrure` aux `st` de `pointsDeCarrure`. Sinon, chaque silhouette est prise seule à 1, même nommée carrure,
 * et la mesure de carrure vaut `null`. Sous chaque
 * silhouette et la carrure à une borne de `st`, le centre de chaque anneau articulaire (`anneauxArticulaires`) reste à
 * moins de `FRACTION_DU_RAYON` × son rayon de repos, et au moins un sommet du corps bouge de plus de
 * `DEPLACEMENT_INERTE_M`. L'épaisseur (rayon de l'anneau le plus épais au repos) suit `st` à `TOLERANCE_EPAISSEUR`
 * près, en écart relatif ; l'écart des 5 rapports au segment entre les extrêmes (linéarité) se rapporte. L'état des
 * shape keys trouvé à l'entrée est restauré à la sortie.
 */
import { Vector3, type Matrix4, type Mesh, type Object3D, type SkinnedMesh } from 'three';
import { tableTotale } from '../../../../../src/lib/tableTotale.ts';
import type { Ecart } from '../ecart.ts';
import { poseDeRepos, type Pose } from '../echantillonnage.ts';
import { CARRURE_MOINS, CARRURE_PLUS, poidsDeCarrure } from '../../gabarit.ts';
import type { TableDeGabarit } from '../../manifesteDeBase.ts';
import { SOL_TOLERANCE_M } from './piedsAuSol.ts';
import { POIDS_NEGLIGEABLE } from './poids.ts';
import { poserSilhouettes } from '../gabarit.ts';

/** Le déplacement admis du centre d'un anneau, en fraction de son rayon de repos. Un dixième : l'os, que les shape
 *  keys ne déplacent pas, reste dans le dixième central de la section de la peau qui plie autour de lui ; un centre qui
 *  s'en écarte davantage fait plier la peau autour d'un pivot excentré, d'autant plus que le membre est fin. Ordre de
 *  grandeur posé par principe, jamais réglé sur une mesure de la base. */
export const FRACTION_DU_RAYON = 0.1;
/** Le déplacement de sommet, en mètres, sous lequel une silhouette est inerte : `SOL_TOLERANCE_M`, distance que la
 *  chaîne tient pour nulle entre deux positions d'un sommet du corps. */
export const DEPLACEMENT_INERTE_M = SOL_TOLERANCE_M;
/** L'écart relatif admis entre le rapport d'épaisseur et `st`, |rapport − st| / st (#3101 issuecomment-6484977455). */
export const TOLERANCE_EPAISSEUR = 0.02;
/** Le nombre minimal de sommets d'un anneau : trois points non alignés posent une section. */
export const SOMMETS_MIN_DE_L_ANNEAU = 3;

const GARDE = 'silhouettes';

type Point = readonly [number, number, number];

/** L'anneau articulaire de l'os `os` : les sommets du corps dans la bande de mélange de son articulation avec son parent. */
export interface Anneau {
  readonly os: string;
  readonly sommets: readonly { readonly mesh: string; readonly indice: number }[];
}

/** L'état d'un anneau dans une pose : `centre` = centroïde de ses sommets, `rayon` = leur distance moyenne à la droite
 *  qui passe par `centre` dans la direction de l'os de l'anneau. */
export interface Section {
  readonly centre: Point;
  readonly rayon: number;
}

/** La section d'un anneau au repos, et l'axe de son os au repos, direction de la droite de son rayon dans toute pose. */
export interface SectionDeRepos extends Section {
  readonly axe: Point;
}

export interface MesureDeSilhouette {
  readonly nom: string;
  readonly poids: Readonly<Record<string, number>>;
  /** Le plus grand déplacement d'un sommet du corps depuis la référence, en mètres. */
  readonly deplacementMax: number;
  /** L'anneau au plus grand déplacement de centre, en fraction de son rayon de repos ; `null` sans anneau. */
  readonly centrePire: { readonly os: string; readonly rapport: number } | null;
}

export interface MesuresDeCarrure {
  /** L'os de l'anneau le plus épais au repos, et son rayon. */
  readonly os: string;
  readonly rayonDeRepos: number;
  /** Aux `st` de `pointsDeCarrure`, le rapport du rayon de cet anneau à son rayon de repos. */
  readonly points: readonly { readonly st: number; readonly rapport: number }[];
  /** Le plus grand |rapport − st| / st des points. */
  readonly ecartASt: number;
  /** Le plus grand écart d'un point au segment qui joint les points extrêmes. */
  readonly ecartAuSegment: number;
}

export interface MesuresDesSilhouettes {
  readonly anneaux: number;
  readonly silhouettes: readonly MesureDeSilhouette[];
  readonly carrure: MesuresDeCarrure | null;
}

/**
 * Les anneaux articulaires de `meshes`, par os. Un sommet appartient à l'anneau de l'os b quand ses deux plus fortes
 * influences, la seconde au-dessus de `POIDS_NEGLIGEABLE`, sont b et le parent de b. En skinning linéaire, un tel
 * sommet est mélangé entre les deux os qui se rencontrent à la tête de b : il est dans la bande qui plie à cette
 * articulation, et cette bande l'entoure. Les deux plus FORTES influences, et non deux influences quelconques, écartent
 * les sommets menés d'abord par un troisième os, qui entourent une autre articulation. Un anneau garde au moins
 * `SOMMETS_MIN_DE_L_ANNEAU` sommets.
 */
export function anneauxArticulaires(meshes: readonly SkinnedMesh[]): Anneau[] {
  const parOs = new Map<string, { mesh: string; indice: number }[]>();
  for (const m of meshes) {
    const os = m.skeleton.bones;
    const indices = m.geometry.attributes.skinIndex;
    const poids = m.geometry.attributes.skinWeight;
    for (let i = 0; i < indices.count; i++) {
      let j1 = -1, j2 = -1, w1 = 0, w2 = 0;
      for (let k = 0; k < indices.itemSize; k++) {
        const w = poids.getComponent(i, k), j = indices.getComponent(i, k);
        if (w > w1) { j2 = j1; w2 = w1; j1 = j; w1 = w; } else if (w > w2) { j2 = j; w2 = w; }
      }
      if (w2 <= POIDS_NEGLIGEABLE || j1 === j2) continue;
      const a = os[j1], b = os[j2];
      const enfant = a?.parent === b ? a : b?.parent === a ? b : undefined;
      if (!enfant) continue;
      const liste = parOs.get(enfant.name);
      if (liste) liste.push({ mesh: m.name, indice: i });
      else parOs.set(enfant.name, [{ mesh: m.name, indice: i }]);
    }
  }
  return [...parOs].filter(([, sommets]) => sommets.length >= SOMMETS_MIN_DE_L_ANNEAU).map(([os, sommets]) => ({ os, sommets }));
}

/** La direction de l'os `nom` dans la pose `os` : l'axe Y de sa matrice monde, image de l'axe tête → queue de l'os
 *  Blender, défini aussi pour un os sans enfant. */
function axeDeLOs(os: ReadonlyMap<string, Matrix4>, nom: string): Point {
  const matrice = os.get(nom);
  if (!matrice) throw new Error(`silhouettes : os absent ${nom}`);
  const { x, y, z } = new Vector3().setFromMatrixColumn(matrice, 1).normalize();
  return [x, y, z];
}

function section(anneau: Anneau, positions: ReadonlyMap<string, Float32Array>, axe: Point): Section {
  const points = anneau.sommets.map(({ mesh, indice }): Point => {
    const p = positions.get(mesh);
    if (!p) throw new Error(`silhouettes : mesh absent ${mesh}`);
    return [p[indice * 3], p[indice * 3 + 1], p[indice * 3 + 2]];
  });
  const moyenne = (c: 0 | 1 | 2) => points.reduce((s, p) => s + p[c], 0) / points.length;
  const centre: Point = [moyenne(0), moyenne(1), moyenne(2)];
  const aLaDroite = (p: Point) => {
    const d = [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]];
    const le = d[0] * axe[0] + d[1] * axe[1] + d[2] * axe[2];
    return Math.hypot(d[0] - le * axe[0], d[1] - le * axe[1], d[2] - le * axe[2]);
  };
  return { centre, rayon: points.reduce((s, p) => s + aLaDroite(p), 0) / points.length };
}

/** La section de repos de chaque anneau de `anneaux` dans la pose `repos`, axe de son os compris. */
export const sectionsDeRepos = (anneaux: readonly Anneau[], repos: Pose): SectionDeRepos[] =>
  anneaux.map((a) => {
    const axe = axeDeLOs(repos.os, a.os);
    return { ...section(a, repos.positions, axe), axe };
  });

/** L'indice de l'anneau le plus épais (plus grand rayon) parmi `sections`, celui dont la carrure mesure l'épaisseur. */
export const anneauLePlusEpais = (sections: readonly Section[]): number =>
  sections.reduce((p, s, i) => (s.rayon > sections[p].rayon ? i : p), 0);

function deplacementMax(de: ReadonlyMap<string, Float32Array>, a: ReadonlyMap<string, Float32Array>): number {
  let max = 0;
  for (const [mesh, p] of de) {
    const q = a.get(mesh);
    for (let i = 0; q && i < p.length; i += 3) max = Math.max(max, Math.hypot(q[i] - p[i], q[i + 1] - p[i + 1], q[i + 2] - p[i + 2]));
  }
  return max;
}

/** Les `st` de la carrure mesurée : les bornes, 1, et les milieux de chaque moitié. */
export const pointsDeCarrure = (bornes: TableDeGabarit['st']): number[] => [bornes.min, (bornes.min + 1) / 2, 1, (1 + bornes.max) / 2, bornes.max];

const meshesAFormes = (scene: Object3D): Mesh[] => {
  const liste: Mesh[] = [];
  scene.traverse((n) => { const m = n as Mesh; if (m.isMesh && m.morphTargetInfluences && m.morphTargetDictionary) liste.push(m); });
  return liste;
};

/** Pose les silhouettes de la liste à `poids`, ou à 0 si leur poids est absent ; refuse tout poids hors de la liste. */
function poserSeules(scene: Object3D, silhouettes: readonly string[], poids: Readonly<Record<string, number>>, poidsDesFormes: PoidsDesFormes): void {
  for (const nom of Object.keys(poids)) {
    if (!silhouettes.includes(nom)) throw new Error(`silhouettes : poids demandé hors silhouettes : ${nom}`);
  }
  poserSilhouettes(scene, poidsDesFormes(tableTotale(silhouettes, (nom) => poids[nom] ?? 0)));
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export type PoserSeules = (poids: Readonly<Record<string, number>>, meshes: readonly Mesh[]) => Pose;
export type PoidsDesFormes = (silhouettes: Readonly<Record<string, number>>) => Readonly<Record<string, number>>;

/** Rend `mesurer(poser)` ; l'état des shape keys de `scene` trouvé à l'entrée est restauré à la sortie. */
export function sousLesFormes<T>(scene: Object3D, silhouettes: readonly string[], mesurer: (poser: PoserSeules) => T, poidsDesFormes: PoidsDesFormes = (poids) => poids): T {
  const formes = meshesAFormes(scene);
  const entree = formes.map((m) => [...(m.morphTargetInfluences as number[])]);
  try {
    return mesurer((poids, meshes) => {
      poserSeules(scene, silhouettes, poids, poidsDesFormes);
      return poseDeRepos(scene, meshes);
    });
  } finally {
    formes.forEach((m, i) => { (m.morphTargetInfluences as number[]).splice(0, entree[i].length, ...entree[i]); });
    scene.updateMatrixWorld(true);
  }
}

export interface SujetDeSilhouettes {
  readonly scene: Object3D;
  readonly corps: readonly SkinnedMesh[];
  /** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
  readonly silhouettes: readonly string[];
  readonly st?: TableDeGabarit['st'];
  readonly poidsDesFormes?: PoidsDesFormes;
}

export function mesurerSilhouettes({ scene, corps, silhouettes, st, poidsDesFormes }: SujetDeSilhouettes): { mesures: MesuresDesSilhouettes; ecarts: Ecart[] } {
  const anneaux = anneauxArticulaires(corps);
  const ecarts: Ecart[] = [];
  return sousLesFormes(scene, silhouettes, (poserSur) => {
    const poser = (poids: Readonly<Record<string, number>>) => poserSur(poids, corps);
    const repos = poser({});
    const deRepos = sectionsDeRepos(anneaux, repos);
    const sections = (positions: ReadonlyMap<string, Float32Array>) => anneaux.map((a, i) => section(a, positions, deRepos[i].axe));
    const mesurer = (poids: Readonly<Record<string, number>>) => {
      const { positions } = poser(poids);
      return { positions, sections: sections(positions) };
    };
    const reference = { positions: repos.positions, sections: deRepos };
    const aCarrure = st && silhouettes.includes(CARRURE_MOINS) && silhouettes.includes(CARRURE_PLUS);
    const etats = [
      ...silhouettes.filter((s) => !aCarrure || (s !== CARRURE_MOINS && s !== CARRURE_PLUS)).map((nom) => ({ nom, poids: { [nom]: 1 } })),
      ...(aCarrure ? [st.min, st.max].map((s) => ({ nom: `st=${s}`, poids: poidsDeCarrure(s, st) })) : []),
    ];
    if (etats.length && !anneaux.length) ecarts.push({ garde: GARDE, code: 'anneau-indetectable', valeur: 0, seuil: SOMMETS_MIN_DE_L_ANNEAU, detail: 'aucun anneau articulaire dans le corps : ni centre ni épaisseur mesurables' });
    const mesures = etats.map(({ nom, poids }): MesureDeSilhouette => {
      const { positions, sections } = mesurer(poids);
      const deplacement = deplacementMax(reference.positions, positions);
      if (deplacement <= DEPLACEMENT_INERTE_M) ecarts.push({ garde: GARDE, code: 'silhouette-inerte', valeur: deplacement, seuil: DEPLACEMENT_INERTE_M, detail: `${nom} : plus grand déplacement d’un sommet du corps, en m` });
      const rapports = sections.map((s, i) => {
        const r = reference.sections[i];
        return r.rayon > 0 ? Math.hypot(s.centre[0] - r.centre[0], s.centre[1] - r.centre[1], s.centre[2] - r.centre[2]) / r.rayon : 0;
      });
      const pire = rapports.reduce((p, r, i) => (r > rapports[p] ? i : p), 0);
      const hors = rapports.filter((r) => r > FRACTION_DU_RAYON).length;
      if (hors) ecarts.push({ garde: GARDE, code: 'centre-deplace', valeur: rapports[pire], seuil: FRACTION_DU_RAYON, detail: `${nom} : centre de l’anneau de ${anneaux[pire].os} déplacé, en fraction de son rayon de repos ; ${hors}/${anneaux.length} anneau(x) au-delà` });
      return { nom, poids, deplacementMax: deplacement, centrePire: anneaux.length ? { os: anneaux[pire].os, rapport: rapports[pire] } : null };
    });
    let carrure: MesuresDeCarrure | null = null;
    if (aCarrure && anneaux.length) {
      const epais = anneauLePlusEpais(reference.sections);
      const rayonDeRepos = reference.sections[epais].rayon;
      const points = pointsDeCarrure(st).map((s) => ({ st: s, rapport: mesurer(poidsDeCarrure(s, st)).sections[epais].rayon / rayonDeRepos }));
      const [premier, dernier] = [points[0], points[points.length - 1]];
      const surSegment = (s: number) => premier.rapport + (dernier.rapport - premier.rapport) * (s - premier.st) / (dernier.st - premier.st);
      const relatif = (p: { st: number; rapport: number }) => Math.abs(p.rapport - p.st) / p.st;
      const ecartASt = Math.max(...points.map(relatif));
      carrure = { os: anneaux[epais].os, rayonDeRepos, points, ecartASt, ecartAuSegment: Math.max(...points.map((p) => Math.abs(p.rapport - surSegment(p.st)))) };
      const pire = points.find((p) => relatif(p) === ecartASt) ?? points[0];
      if (ecartASt > TOLERANCE_EPAISSEUR) ecarts.push({ garde: GARDE, code: 'epaisseur-hors-st', valeur: ecartASt, seuil: TOLERANCE_EPAISSEUR, detail: `st=${pire.st} : écart relatif à st ; épaisseur de l’anneau de ${carrure.os} à ${pire.rapport} fois celle du repos` });
    }
    return { mesures: { anneaux: anneaux.length, silhouettes: mesures, carrure }, ecarts };
  }, poidsDesFormes);
}

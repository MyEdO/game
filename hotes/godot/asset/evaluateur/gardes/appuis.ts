import { Vector3, type Bone, type SkinnedMesh } from 'three';
import type { Echantillon } from '../echantillonnage.ts';
import type { Ecart } from '../ecart.ts';
import { SOL_TOLERANCE_M } from './piedsAuSol.ts';
import seuils from './seuils.json';

/** La part du poids d'un sommet, liée au pied ou à ses descendants, qui le range dans la surface du pied. */
export const MAJORITE_DU_POIDS: number = seuils.MAJORITE_DU_POIDS;

type Point = readonly [number, number, number];
export interface SurfaceDuPied {
  readonly pied: string;
  readonly sommets: readonly { readonly mesh: string; readonly indice: number }[];
}
export interface PoseDuPied {
  readonly clip: string;
  readonly t: number;
  readonly pied: string;
  readonly racine: Point;
  readonly os: Point;
  readonly sommets: readonly Point[];
}
export interface MesureDAppui {
  readonly pied: string;
  readonly vitesseAuSol: number | null;
  readonly duree: number;
  readonly intervalles: number;
  readonly contactMax: number | null;
  readonly glissementMax: number | null;
}
export interface AppuisDuClip {
  readonly clip: string;
  readonly vitesseDeclaree: number;
  readonly vitesseAuSol: number | null;
  readonly direction: readonly [number, number];
  readonly pieds: readonly MesureDAppui[];
}

export function sommetDuPied(indices: readonly number[], poids: readonly number[], appartient: (indice: number) => boolean): boolean {
  return indices.reduce((somme, indice, k) => somme + (appartient(indice) ? poids[k] : 0), 0) >= MAJORITE_DU_POIDS;
}

/** Les sommets dont la majorité du poids appartient au pied ou à ses descendants. */
export function surfacesDesPieds(meshes: readonly SkinnedMesh[], pieds: readonly string[]): SurfaceDuPied[] {
  return pieds.map((pied) => ({ pied, sommets: meshes.flatMap((m) => {
    const appartient = (b: Bone): boolean => b.name === pied || ((b.parent as Bone | null)?.isBone === true && appartient(b.parent as Bone));
    const joints = new Set(m.skeleton.bones.flatMap((b, i) => appartient(b) ? [i] : []));
    const indices = m.geometry.attributes.skinIndex;
    const poids = m.geometry.attributes.skinWeight;
    return Array.from({ length: indices.count }, (_, indice) => {
      const os = Array.from({ length: indices.itemSize }, (_, k) => indices.getComponent(indice, k));
      const valeurs = Array.from({ length: poids.itemSize }, (_, k) => poids.getComponent(indice, k));
      return sommetDuPied(os, valeurs, (joint) => joints.has(joint)) ? [{ mesh: m.name, indice }] : [];
    }).flat();
  }) }));
}

export function poserPieds(e: Echantillon, surfaces: readonly SurfaceDuPied[], racine: string): PoseDuPied[] {
  const position = (nom: string): Point => {
    const m = e.os.get(nom);
    if (!m) throw new Error(`appuis : os absent ${nom}`);
    return new Vector3().setFromMatrixPosition(m).toArray() as [number, number, number];
  };
  return surfaces.map((s) => ({ clip: e.clip, t: e.t, pied: s.pied, racine: position(racine), os: position(s.pied),
    sommets: s.sommets.map(({ mesh, indice }): Point => {
      const p = e.positions.get(mesh);
      if (!p) throw new Error(`appuis : mesh absent ${mesh}`);
      return [p[indice * 3], p[indice * 3 + 1], p[indice * 3 + 2]];
    }),
  }));
}

const relatif = (p: PoseDuPied): readonly [number, number] => [p.os[0] - p.racine[0], p.os[2] - p.racine[2]];

/** L'axe principal de l'excursion des pieds, orienté par le sens de parcours le plus bas en moyenne ; une racine mobile
 *  donne directement le sens. La hauteur choisit le sens de l'axe, jamais les intervalles d'appui. */
function directionDe(listes: readonly (readonly PoseDuPied[])[]): readonly [number, number] {
  const premiere = listes[0]?.[0], derniere = listes[0]?.[listes[0].length - 1];
  if (!premiere || !derniere) return [0, 0];
  const dx = derniere.racine[0] - premiere.racine[0], dz = derniere.racine[2] - premiere.racine[2];
  if (Math.hypot(dx, dz) > SOL_TOLERANCE_M) return [dx / Math.hypot(dx, dz), dz / Math.hypot(dx, dz)];
  let xx = 0, zz = 0, xz = 0;
  for (const liste of listes) {
    const points = liste.map(relatif);
    const x = points.reduce((s, p) => s + p[0], 0) / points.length;
    const z = points.reduce((s, p) => s + p[1], 0) / points.length;
    for (const p of points) { xx += (p[0] - x) ** 2; zz += (p[1] - z) ** 2; xz += (p[0] - x) * (p[1] - z); }
  }
  if (xx + zz === 0) return [0, 0];
  const angle = Math.atan2(2 * xz, xx - zz) / 2;
  let x = Math.cos(angle), z = Math.sin(angle), basNegatif = 0, basPositif = 0, dureeNegative = 0, dureePositive = 0;
  for (const liste of listes) for (let i = 1; i < liste.length; i++) {
    const a = liste[i - 1], b = liste[i], ra = relatif(a), rb = relatif(b);
    const projection = (rb[0] - ra[0]) * x + (rb[1] - ra[1]) * z;
    const h = (a.os[1] + b.os[1]) / 2;
    const dt = b.t - a.t;
    if (projection < 0) { basNegatif += h * dt; dureeNegative += dt; }
    if (projection > 0) { basPositif += h * dt; dureePositive += dt; }
  }
  if (dureeNegative && dureePositive && basNegatif / dureeNegative > basPositif / dureePositive) { x = -x; z = -z; }
  return [x, z];
}

/** #2972 issuecomment-6395825088, « La cadence des clips ».
 * Appui cinématique = recul de l'os relativement à la racine. Pour chaque intervalle, le sommet dont la hauteur
 * maximale aux deux bornes est la plus basse sert de point de contact (talon ou avant-pied). On suit CE sommet aux
 * deux bornes. La translation native de racine est remplacée par direction × vitesse déclarée × t, sans la doubler.
 * Les distances de contact et de glissement reprennent `SOL_TOLERANCE_M` (`piedsAuSol.ts`) ; la tolérance de vitesse
 * autorise une dérive de deux fois cette distance sur la durée d'appui mesurée (erreur aux deux bornes).
 */
export function mesurerAppuis(poses: readonly PoseDuPied[], vitessesDeclarees: Readonly<Record<string, number>>): { mesures: AppuisDuClip[]; ecarts: Ecart[] } {
  return mesurerAppuisAvecTranslation(poses, vitessesDeclarees, (a, b, direction, vitesse) => [
    direction[0] * vitesse * (b.t - a.t), direction[1] * vitesse * (b.t - a.t),
  ]);
}

export type TranslationDeReference = (a: PoseDuPied, b: PoseDuPied, direction: readonly [number, number], vitesseDeclaree: number) => readonly [number, number];

export function mesurerAppuisAvecTranslation(poses: readonly PoseDuPied[], vitessesDeclarees: Readonly<Record<string, number>>, translation: TranslationDeReference): { mesures: AppuisDuClip[]; ecarts: Ecart[] } {
  const mesures: AppuisDuClip[] = [], ecarts: Ecart[] = [];
  for (const [clip, vitesseDeclaree] of Object.entries(vitessesDeclarees)) {
    const duClip = poses.filter((p) => p.clip === clip);
    if (!duClip.length) continue;
    const listes = [...new Set(duClip.map((p) => p.pied))].map((pied) => duClip.filter((p) => p.pied === pied));
    const direction = directionDe(listes);
    const pieds = listes.map((liste): MesureDAppui => {
      const pied = liste[0].pied;
      const refus = (code: string, valeur: number | string, seuil: number | null, detail: string, t?: number) => ecarts.push({ garde: 'appuis', code, clip, valeur, seuil, detail: `${pied} : ${detail}`, ...(t === undefined ? {} : { t }) });
      let duree = 0, distance = 0, intervalles = 0, contactMax = 0, glissementMax = 0, tContact = 0, tGlissement = 0;
      let deriveX = 0, deriveZ = 0;
      for (let i = 1; i < liste.length; i++) {
        const a = liste[i - 1], b = liste[i], ra = relatif(a), rb = relatif(b), dt = b.t - a.t;
        if (dt <= 0 || (rb[0] - ra[0]) * direction[0] + (rb[1] - ra[1]) * direction[1] >= 0) { deriveX = 0; deriveZ = 0; continue; }
        if (!a.sommets.length) continue;
        let indice = 0;
        for (let k = 1; k < a.sommets.length; k++) if (Math.max(a.sommets[k][1], b.sommets[k][1]) < Math.max(a.sommets[indice][1], b.sommets[indice][1])) indice = k;
        const pa = a.sommets[indice], pb = b.sommets[indice];
        const dx = pb[0] - pa[0] - (b.racine[0] - a.racine[0]);
        const dz = pb[2] - pa[2] - (b.racine[2] - a.racine[2]);
        distance -= dx * direction[0] + dz * direction[1];
        duree += dt; intervalles++;
        const contact = Math.max(Math.abs(Math.min(...a.sommets.map((p) => p[1]))), Math.abs(Math.min(...b.sommets.map((p) => p[1]))));
        const reference = translation(a, b, direction, vitesseDeclaree);
        deriveX += dx + reference[0];
        deriveZ += dz + reference[1];
        const glissement = Math.hypot(deriveX, deriveZ);
        if (contact > contactMax) { contactMax = contact; tContact = b.t; }
        if (glissement > glissementMax) { glissementMax = glissement; tGlissement = b.t; }
      }
      if (!intervalles) {
        refus(liste[0].sommets.length ? 'appui-indetectable' : 'pied-sans-surface', 0, null, 'aucun intervalle d’appui mesurable');
        return { pied, vitesseAuSol: null, duree, intervalles, contactMax: null, glissementMax: null };
      }
      const vitesseAuSol = distance / duree;
      const tolerance = 2 * SOL_TOLERANCE_M / duree;
      if (Math.abs(vitesseAuSol - vitesseDeclaree) > tolerance) refus('vitesse-declaree', Math.abs(vitesseAuSol - vitesseDeclaree), tolerance, `mesurée ${vitesseAuSol} m/s, déclarée ${vitesseDeclaree} m/s`);
      if (contactMax > SOL_TOLERANCE_M) refus('contact', contactMax, SOL_TOLERANCE_M, 'distance au sol pendant l’appui, en m', tContact);
      if (glissementMax > SOL_TOLERANCE_M) refus('glissement', glissementMax, SOL_TOLERANCE_M, 'dérive horizontale maximale cumulée du contact dans le monde pendant un appui, en m', tGlissement);
      return { pied, vitesseAuSol, duree, intervalles, contactMax, glissementMax };
    });
    const duree = pieds.reduce((s, p) => s + p.duree, 0);
    mesures.push({ clip, vitesseDeclaree, direction, pieds, vitesseAuSol: duree ? pieds.reduce((s, p) => s + (p.vitesseAuSol ?? 0) * p.duree, 0) / duree : null });
  }
  return { mesures, ecarts };
}

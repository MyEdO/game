/**
 * GARDE D'AMPLITUDE ARTICULAIRE (#2992 ; #2972, commentaire 6395825088, « Gardes qui jugent un corps », P2) : sur les
 * échantillons joués, la rotation locale de chaque os borné au manifeste du corps (`ManifesteDeBase.bornesArticulaires`)
 * depuis son repos reste dans ses bornes. La rotation se lit en vecteur de rotation (`vecteurDeRotation`) dans le repère de
 * l'os au repos ; l'os est nommé comme `AnimationMixer` le trouve dans la scène (`chargement.ts`).
 */
import { Quaternion, type Object3D } from 'three';
import type { Ecart } from '../ecart.ts';
import { rotationLocale, type Echantillon, type Pose } from '../echantillonnage.ts';
import { AXES_ARTICULAIRES, type BornesArticulaires } from '../../manifesteDeBase.ts';

const GARDE = 'amplitude';

const DEGRES = 180 / Math.PI;

/** Le vecteur de rotation de `q` (axe × angle, en degrés, angle dans [0, 180]). */
export function vecteurDeRotation(q: Quaternion): Readonly<Record<typeof AXES_ARTICULAIRES[number], number>> {
  const signe = q.w < 0 ? -1 : 1;
  const w = Math.min(1, signe * q.w);
  const sinus = Math.sqrt(1 - w * w);
  const facteur = sinus > 0 ? (2 * Math.acos(w) * DEGRES) / sinus : 2 * DEGRES;
  return { x: signe * q.x * facteur, y: signe * q.y * facteur, z: signe * q.z * facteur };
}

interface Depassement { readonly valeur: number; readonly borne: number; readonly t: number }

/** Le suivi des amplitudes sur les échantillons : `echantillon` à chaque (clip, t) joué, `ecarts` à la fin, le pire
 *  dépassement par (clip, os, axe). */
export function suivreLesAmplitudes(scene: Object3D, bornes: BornesArticulaires, repos: Pose) {
  const parents = new Map<string, string | undefined>();
  const auRepos = new Map<string, Quaternion>();
  for (const os of Object.keys(bornes)) {
    const noeud = scene.getObjectByName(os);
    if (!noeud) throw new Error(`${GARDE} : os ${os} absent de la scène`);
    parents.set(os, noeud.parent?.name);
    auRepos.set(os, rotationLocale(repos, os, noeud.parent?.name, new Quaternion()).invert());
  }
  const pires = new Map<string, Depassement & { readonly clip: string; readonly os: string; readonly axe: typeof AXES_ARTICULAIRES[number] }>();
  const courante = new Quaternion();
  const lue = new Quaternion();
  return {
    echantillon(e: Echantillon): void {
      for (const [os, parAxe] of Object.entries(bornes)) {
        const v = vecteurDeRotation(courante.copy(auRepos.get(os) as Quaternion).multiply(rotationLocale(e, os, parents.get(os), lue)));
        for (const axe of AXES_ARTICULAIRES) {
          const [min, max] = parAxe[axe];
          const borne = v[axe] < min ? min : v[axe] > max ? max : null;
          if (borne === null) continue;
          const cle = `${e.clip}\u0000${os}\u0000${axe}`;
          const pire = pires.get(cle);
          if (!pire || Math.abs(v[axe] - borne) > Math.abs(pire.valeur - pire.borne)) pires.set(cle, { clip: e.clip, os, axe, valeur: v[axe], borne, t: e.t });
        }
      }
    },
    ecarts(): Ecart[] {
      return [...pires.values()].map((p) => ({
        garde: GARDE, code: 'amplitude-hors-bornes', clip: p.clip, t: p.t, valeur: p.valeur, seuil: p.borne,
        detail: `${p.os}.${p.axe} : ${p.valeur.toFixed(1)}° hors de [${bornes[p.os][p.axe].join(', ')}]°`,
      }));
    },
  };
}

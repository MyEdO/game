/** L'ÉCART D'UNE GARDE DE L'ÉVALUATEUR (#2972) : ce que chaque garde de `gardes/` rend, et que `evaluer.ts` compose. */
import type { Mesh } from 'three';
import type { SceneChargee } from './chargement.ts';

/** Le libellé d'un mesh dans un rapport (`libellesDesMeshes`). */
export type LibelleDeMesh = (m: Mesh) => string;

/** Le libellé de chaque mesh des scènes `scenes` de l'évaluation, 0 la base, k le k-ième élément :
 *  `<fichier>/<nœud glTF>#<primitive>`. Le fichier ne contient pas de `/` et la primitive suit le dernier `#` : deux
 *  meshes distincts ont deux libellés distincts. */
export function libellesDesMeshes(scenes: readonly Pick<SceneChargee, 'origines'>[]): LibelleDeMesh {
  const libelles = new Map(scenes.flatMap((s, k) => [...s.origines].map(([m, o]) => [m, `${k ? `élément ${k}` : 'base'}/${o.noeud}#${o.primitive}`] as const)));
  return (m) => {
    const libelle = libelles.get(m);
    if (libelle === undefined) throw new Error(`rapport : mesh ${m.name} hors des scènes évaluées`);
    return libelle;
  };
}

export interface Ecart {
  /** Le nom de la garde (son fichier sous `gardes/`, ou `manifeste`). */
  readonly garde: string;
  readonly code: string;
  /** Le libellé du mesh (`libellesDesMeshes`). */
  readonly mesh?: string;
  readonly clip?: string;
  /** L'instant de l'échantillon, en secondes. */
  readonly t?: number;
  readonly valeur: number | string;
  readonly seuil: number | string | null;
  readonly detail: string;
}

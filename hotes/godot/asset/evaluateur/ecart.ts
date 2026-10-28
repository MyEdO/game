/** L'ÉCART D'UNE GARDE DE L'ÉVALUATEUR (#2972) : ce que chaque garde de `gardes/` rend, et que `evaluer.ts` compose. */

export interface Ecart {
  /** Le nom de la garde (son fichier sous `gardes/`, ou `manifeste`). */
  readonly garde: string;
  readonly code: string;
  readonly mesh?: string;
  readonly clip?: string;
  /** L'instant de l'échantillon, en secondes. */
  readonly t?: number;
  readonly valeur: number | string;
  readonly seuil: number | string | null;
  readonly detail: string;
}

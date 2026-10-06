import type { Ajout, BlocDuFil, ChapitreParse, DescRef, ErreurResolution } from '../../src/data/source/decoupe.ts';

/** Une adresse FIGÉE d'une table de migration : un intervalle d'une section, et l'`ajoute` consigné. */
export interface CibleFigee { ch: string; sec: string; secOcc: number; b0: number; b1: number; ajoute?: readonly Ajout[] }
export interface Lieu { ch: string; depart: BlocDuFil; fin: BlocDuFil; blocs: number }

export function lieuxDe(livre: string, desc: string): Lieu[];
export function plusPetiteUnite(livre: string, ch: string, chapitre: ChapitreParse, lieu: Pick<Lieu, 'depart' | 'fin'>): DescRef | ErreurResolution;
export function ouDeLaCible(cible: CibleFigee): string;
export function prouver(
  entree: { id: string; desc: string; source: { book: string } },
  cible: CibleFigee,
): { ref: DescRef; preuve: { unites: number; ajoute: Ajout[]; ecartDeLongueurNormalisee: number; lieux: number }; erreur?: undefined }
  | { erreur: string; ref?: undefined; preuve?: undefined };

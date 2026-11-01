/**
 * LE GABARIT D'UNE BASE (#2972, #3086) : la pose du gabarit (`poseDuGabarit`), les poids des shape keys de silhouette
 * (`poidsDeSilhouettes`) et la marche de la base (`marcheDeLaBase`), calculés une fois ici pour l'évaluateur
 * (`evaluateur/gabarit.ts`, qui les pose sur une scène three) et pour l'hôte (`hotes/godot/pont/CONTRAT.md`, « Gabarit
 * d'une base »). PUR : ni three ni le noyau à l'exécution (`chargerEvaluateur`, `charger.mjs`).
 */
import type { GabaritResolu, Sexe } from '../../../src/noyau/index.ts';
import { BUILD_NEUTRE } from '../../../src/lib/corpulence.ts';
import { CLES_DU_GABARIT, PREFIXE_DES_CLES_DU_GABARIT, fauteDeBornesDuGabarit, type BornesDuGabarit, type ManifesteDeBase, type TableDeGabarit } from './manifesteDeBase.ts';

export const FACTEURS_NEUTRES: GabaritResolu = Object.freeze({ sl: 1, legs: 1, arms: 1, head: 1, st: 1 });

export const CARRURE_MOINS = 'carrure_moins';
export const CARRURE_PLUS = 'carrure_plus';
export const FEMININ = 'feminin';
export const CORPULENCE = 'corpulence';

const borne = (x: number): number => Math.min(1, Math.max(0, x));

export type CleDuGabarit = typeof CLES_DU_GABARIT[number];
export type SensDuGabarit = 'moins' | 'plus';
export type { BornesDuGabarit } from './manifesteDeBase.ts';

export const nomDeCleDuGabarit = (cle: CleDuGabarit, sens: SensDuGabarit, silhouette?: string): string =>
  `${PREFIXE_DES_CLES_DU_GABARIT}${cle}_${sens}${silhouette === undefined ? '' : `_${silhouette}`}`;

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function sensCuitsDuGabarit(bornes: BornesDuGabarit): readonly { readonly cle: CleDuGabarit; readonly sens: SensDuGabarit; readonly extremite: number }[] {
  return CLES_DU_GABARIT.flatMap((cle) => {
    const faute = fauteDeBornesDuGabarit(bornes[cle]);
    if (faute) throw new Error(`gabarit.${cle} : ${faute}`);
    return (['moins', 'plus'] as const).flatMap((sens) => {
      const extremite = bornes[cle][sens === 'moins' ? 'min' : 'max'];
      return extremite === 1 ? [] : [{ cle, sens, extremite }];
    });
  });
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function poidsDuGabarit(facteurs: GabaritResolu, bornes: BornesDuGabarit, silhouettes: Readonly<Record<string, number>>): Record<string, number> {
  const poids: Record<string, number> = {};
  const sensCuits = sensCuitsDuGabarit(bornes);
  for (const cle of CLES_DU_GABARIT) {
    const { min, max } = bornes[cle];
    const facteur = facteurs[cle];
    const sens = facteur < 1 ? 'moins' : facteur > 1 ? 'plus' : null;
    if (sens && !sensCuits.some((cuit) => cuit.cle === cle && cuit.sens === sens)) throw new Error(`gabarit.${cle} : facteur ${facteur} refusé pour les bornes [${min}, ${max}]`);
  }
  for (const { cle, sens, extremite } of sensCuits) {
    const p = Math.max(0, (facteurs[cle] - 1) / (extremite - 1));
    poids[nomDeCleDuGabarit(cle, sens)] = p;
    for (const [silhouette, w] of Object.entries(silhouettes)) poids[nomDeCleDuGabarit(cle, sens, silhouette)] = w * p;
  }
  return poids;
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export interface PoseDuGabarit {
  readonly racine: { readonly os: string; readonly echelle: number };
  readonly enfantsDe: Readonly<Record<string, number>>;
  readonly echellesDesOs: Readonly<Record<string, readonly [number, number, number]>>;
  readonly pieds: readonly string[];
}

export function poseDuGabarit({ gabarit, appuis }: Pick<ManifesteDeBase, 'gabarit'> & Partial<Pick<ManifesteDeBase, 'appuis'>>, facteurs: GabaritResolu): PoseDuGabarit {
  const enfantsDe: Record<string, number> = {};
  const echellesDesOs: Record<string, readonly [number, number, number]> = {};
  for (const cle of CLES_DU_GABARIT) {
    for (const nom of gabarit[cle]) {
      const facteur = facteurs[cle];
      enfantsDe[nom] = facteur;
      echellesDesOs[nom] = cle === 'head' ? [facteur, facteur, facteur] : [1, facteur, 1];
    }
  }
  return { racine: { os: gabarit.racine, echelle: facteurs.sl }, enfantsDe, echellesDesOs, pieds: appuis?.pieds ?? [] };
}

/** Les poids des shape keys de carrure pour `st` : `carrure_moins` sur [min ; 1], `carrure_plus` sur [1 ; max], jamais les deux. */
export const poidsDeCarrure = (st: number, bornes: TableDeGabarit['st']): Record<string, number> => ({
  [CARRURE_MOINS]: st < 1 ? borne((1 - st) / (1 - bornes.min)) : 0,
  [CARRURE_PLUS]: st > 1 ? borne((st - 1) / (bornes.max - 1)) : 0,
});

/** Les poids des shape keys de silhouette d'un corps : la carrure (`poidsDeCarrure`), `feminin` par le sexe,
 *  `corpulence` par `build` (`hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base »). */
export const poidsDeSilhouettes = ({ sex, build, st }: { sex: Sexe; build: number; st: number }, table: TableDeGabarit): Record<string, number> => ({
  ...poidsDeCarrure(st, table.st),
  [FEMININ]: sex === 'F' ? 1 : 0,
  [CORPULENCE]: borne((build - BUILD_NEUTRE) / (1 - BUILD_NEUTRE)),
});

/** La marche d'une base, ou son refus : `marche-ambigue` quand `appuis.vitessesAuSol` n'a pas exactement un clip. */
export type MarcheDeLaBase =
  | { readonly ok: true; readonly clip: string; readonly vitesse: number }
  | { readonly ok: false; readonly code: 'marche-ambigue'; readonly detail: string };

/** Le clip de marche de la base, l'unique clé de `appuis.vitessesAuSol`, et sa vitesse au sol, `vitessesAuSol[clip]` (#3104). */
export function marcheDeLaBase(manifeste: Pick<ManifesteDeBase, 'appuis'>): MarcheDeLaBase {
  const clips = Object.keys(manifeste.appuis.vitessesAuSol);
  if (clips.length !== 1) {
    return { ok: false, code: 'marche-ambigue', detail: `${clips.length} clip(s) dans appuis.vitessesAuSol (${clips.join(', ') || 'aucun'}), un seul attendu` };
  }
  const [clip] = clips;
  return { ok: true, clip, vitesse: manifeste.appuis.vitessesAuSol[clip] };
}

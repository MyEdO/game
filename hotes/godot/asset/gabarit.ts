/**
 * LE GABARIT D'UNE BASE (#2972, #3086) : la pose du gabarit (`poseDuGabarit`), les poids des shape keys de silhouette
 * (`poidsDeSilhouettes`), calculés une fois ici pour l'évaluateur
 * (`evaluateur/gabarit.ts`, qui les pose sur une scène three) et pour l'hôte (`hotes/godot/pont/CONTRAT.md`, « Gabarit
 * d'une base »). PUR : ni three ni le noyau à l'exécution (`chargerEvaluateur`, `charger.mjs`).
 */
import type { GabaritResolu, Sexe } from '../../../src/noyau/index.ts';
import { BUILD_NEUTRE } from '../../../src/lib/corpulence.ts';
import { SEXES } from '../../../src/lib/sexe.ts';
import { tableTotale } from '../../../src/lib/tableTotale.ts';
import { CARRURE_MOINS, CARRURE_PLUS, FEMININ, CORPULENCE, NOMS_DES_SILHOUETTES, estSilhouette } from './silhouettes.ts';
import { CLES_DU_GABARIT, PREFIXE_DES_CLES_DU_GABARIT, fauteDeBornesDuGabarit, type BornesDuGabarit, type ManifesteDeBase, type TableDeGabarit } from './manifesteDeBase.ts';
import { FACTEURS_NEUTRES } from './facteursDuGabarit.ts';

const borne = (x: number): number => Math.min(1, Math.max(0, x));

export type CleDuGabarit = typeof CLES_DU_GABARIT[number];
export type SensDuGabarit = 'moins' | 'plus';

export const nomDeCleDuGabarit = (cle: CleDuGabarit, sens: SensDuGabarit, silhouette?: string): string =>
  `${PREFIXE_DES_CLES_DU_GABARIT}${cle}_${sens}${silhouette === undefined ? '' : `_${silhouette}`}`;

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function sensCuitsDuGabarit(bornes: BornesDuGabarit): readonly { readonly cle: CleDuGabarit; readonly sens: SensDuGabarit; readonly extremite: number }[] {
  return CLES_DU_GABARIT.flatMap((cle) => {
    const faute = fauteDeBornesDuGabarit(bornes[cle], FACTEURS_NEUTRES[cle]);
    if (faute) throw new Error(`gabarit.${cle} : ${faute}`);
    return (['moins', 'plus'] as const).flatMap((sens) => {
      const extremite = bornes[cle][sens === 'moins' ? 'min' : 'max'];
      return extremite === FACTEURS_NEUTRES[cle] ? [] : [{ cle, sens, extremite }];
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
    const sens = facteur < FACTEURS_NEUTRES[cle] ? 'moins' : facteur > FACTEURS_NEUTRES[cle] ? 'plus' : null;
    if (sens && !sensCuits.some((cuit) => cuit.cle === cle && cuit.sens === sens)) throw new Error(`gabarit.${cle} : facteur ${facteur} refusé pour les bornes [${min}, ${max}]`);
  }
  for (const { cle, sens, extremite } of sensCuits) {
    const p = Math.max(0, (facteurs[cle] - FACTEURS_NEUTRES[cle]) / (extremite - FACTEURS_NEUTRES[cle]));
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
  readonly jambes: readonly string[];
  readonly clipsPlantes: readonly string[];
  readonly echelleDeVitesse: number;
}

/** Ce que `poseDuGabarit` lit d'un manifeste de base ; la construction n'en a que la table. */
export type ManifesteDuGabarit = Required<Pick<ManifesteDeBase, 'gabarit'>> & Partial<Pick<ManifesteDeBase, 'appuis' | 'clips' | 'clipsDeuxMains'>>;

/** Les clips plantés de la base : le clip du rôle `walk`, à une main et à deux mains. */
export const clipsPlantes = ({ clips, clipsDeuxMains }: Partial<Pick<ManifesteDeBase, 'clips' | 'clipsDeuxMains'>>): string[] =>
  [...new Set([clips?.walk, ...Object.values(clipsDeuxMains ?? {}).map((table) => table.walk)].filter((clip): clip is string => clip !== undefined))];

export function poseDuGabarit({ gabarit, appuis, ...clips }: ManifesteDuGabarit, facteurs: GabaritResolu): PoseDuGabarit {
  const enfantsDe: Record<string, number> = {};
  const echellesDesOs: Record<string, readonly [number, number, number]> = {};
  for (const cle of CLES_DU_GABARIT) {
    for (const nom of gabarit[cle]) {
      const facteur = facteurs[cle];
      enfantsDe[nom] = facteur;
      echellesDesOs[nom] = cle === 'head' ? [facteur, facteur, facteur] : [1, facteur, 1];
    }
  }
  return { racine: { os: gabarit.racine, echelle: facteurs.sl }, enfantsDe, echellesDesOs, pieds: appuis?.pieds ?? [], jambes: gabarit.legs, clipsPlantes: clipsPlantes(clips), echelleDeVitesse: facteurs.sl };
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export const poidsDeCarrure = (st: number, bornes: TableDeGabarit['st']): Record<typeof CARRURE_MOINS | typeof CARRURE_PLUS, number> => ({
  [CARRURE_MOINS]: st < FACTEURS_NEUTRES.st ? borne((FACTEURS_NEUTRES.st - st) / (FACTEURS_NEUTRES.st - bornes.min)) : 0,
  [CARRURE_PLUS]: st > FACTEURS_NEUTRES.st ? borne((st - FACTEURS_NEUTRES.st) / (bornes.max - FACTEURS_NEUTRES.st)) : 0,
});

/** Les poids des shape keys de silhouette d'un corps : la carrure (`poidsDeCarrure`), `feminin` par le sexe,
 *  `corpulence` par `build` ; `carrure_plus` ne se cumule avec aucune autre silhouette : un corps féminin la perd, un
 *  corps masculin ne la garde que plus forte que `corpulence` (#3104, #3280). `hotes/godot/pont/CONTRAT.md`, « Gabarit
 *  d'une base ». */
export const poidsDeSilhouettes = ({ sex, build, st }: { sex: Sexe; build: number; st: number }, table: TableDeGabarit): Record<string, number> => {
  const carrure = poidsDeCarrure(st, table.st);
  const corpulence = borne((build - BUILD_NEUTRE) / (1 - BUILD_NEUTRE));
  const plusSeule = sex === 'M' && carrure[CARRURE_PLUS] > corpulence;
  return tableTotale(NOMS_DES_SILHOUETTES, (nom) => nom === FEMININ ? (sex === 'F' ? 1 : 0)
    : nom === CORPULENCE ? (plusSeule ? 0 : corpulence) : nom === CARRURE_PLUS ? (plusSeule ? carrure[nom] : 0) : carrure[nom]);
};

export interface CelluleDeSilhouettes {
  readonly nom: string;
  readonly origine: Readonly<Record<string, number>>;
  readonly colonnes: readonly [Readonly<Record<string, number>>, Readonly<Record<string, number>>];
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function cellulesDeSilhouettesAtteignables(table: TableDeGabarit, silhouettes: readonly string[]): CelluleDeSilhouettes[] {
  for (const nom of silhouettes) {
    if (!estSilhouette(nom)) throw new Error(`silhouette-inconnue : ${nom}`);
  }
  if (!silhouettes.length) return [];
  const poids = (sex: Sexe, build: number, st: number) => {
    const valeurs = poidsDeSilhouettes({ sex, build, st }, table);
    return tableTotale(silhouettes, (nom) => valeurs[nom]);
  };
  return SEXES.flatMap((sex) => [table.st.min, table.st.max].map((st, branche) => {
    const origine = poids(sex, BUILD_NEUTRE, FACTEURS_NEUTRES.st);
    const [corpulence, carrure] = [poids(sex, 1, FACTEURS_NEUTRES.st), poids(sex, BUILD_NEUTRE, st)]
      .map((bout) => tableTotale(silhouettes, (nom) => bout[nom] - origine[nom]));
    const coin = poids(sex, 1, st);
    const cumul = silhouettes.every((nom) => coin[nom] === origine[nom] + corpulence[nom] + carrure[nom]);
    return { nom: `${sex}_${branche}`, origine,
      colonnes: [cumul ? corpulence : tableTotale(silhouettes, () => 0), carrure] as [Record<string, number>, Record<string, number>] };
  }));
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function coinsDeSilhouettesAtteignables(table: TableDeGabarit, silhouettes: readonly string[]): Record<string, number>[] {
  if (!silhouettes.length) return [{}];
  const coins = cellulesDeSilhouettesAtteignables(table, silhouettes).flatMap(({ origine, colonnes }) =>
    [0, 1].flatMap((u) => [0, 1].map((v) => tableTotale(silhouettes,
      (nom) => origine[nom] + u * colonnes[0][nom] + v * colonnes[1][nom]))));
  return coins.filter((coin, i) => !coins.slice(0, i).some((avant) =>
    silhouettes.every((nom) => avant[nom] === coin[nom])));
}

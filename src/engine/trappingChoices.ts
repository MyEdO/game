/**
 * Emplacements de DOTATION (`{pick, of}`, `{wildcard}`, `{id, qualityChoice}` des `TrappingRef`, et l'Atout au choix
 * d'un `{wildcard, qualityChoice}`) d'une liste de dotations (`dotationsDuHeros`, `dotationsDuPnj`) : leur énumération
 * canonique, `emplacementsDeDotation`, et leur résolveur, `resolveTrappingChoices`. Un lot (`{lot}`, option d'un
 * `{pick, of}`) n'est pas un emplacement. Chaque emplacement a une adresse `adresseDeCreation.dotation(chemin)` ; les
 * choix du joueur (`ChoixDeCreation.trappingChoices`) ou de l'auteur d'un PNJ sont rangés par ces adresses. Seul ce
 * module LIT la valeur d'un choix (`brancheChoisie`, `idChoisi`).
 */
import {
  armesChoisissables,
  fabricationAtouts,
  findCareerById,
  findClassById,
  findQualityById,
  findTrappingById,
  firstLevel,
  levelsForCareer,
  trappingRefLabel,
  DEFAULT_FABRICATION_ATOUT,
  fabricationAtoutQuality,
  type BrancheDeDotation,
  type JokerDArme,
  type TrappingRef,
} from '../data/index';
import { adresseDeCreation, type AdresseDeCreation } from './adresseDeCreation';

/** Choix de dotation : index de branche d'un `{pick, of}`, id d'objet d'un `{wildcard}`, id d'Atout d'un
 *  `{id, qualityChoice}` ou d'un `{wildcard, qualityChoice}`. */
export type ChoixDeDotation = Record<AdresseDeCreation, number | string>;

type Situe<T> = { adresse: AdresseDeCreation; chemin: readonly number[] } & T;
/** Un emplacement que porte une dotation elle-même (`emplacement`). */
type EmplacementPorte = Situe<
  | { sorte: 'branches'; ref: Extract<TrappingRef, { pick: 1 }> }
  | { sorte: 'joker'; ref: JokerDArme }
  | { sorte: 'atout'; ref: Extract<TrappingRef, { id: string; type?: never }> }
>;
/** Un emplacement de dotation, à son adresse. `chemin` : cf. `adresseDeCreation.dotation`. L'emplacement `atout` porte
 *  la dotation à `qualityChoice` qui le demande : un objet du catalogue, ou un joker (son sous-emplacement). */
export type EmplacementDeDotation = EmplacementPorte | Situe<{ sorte: 'atout'; ref: JokerDArme }>;
type EmplacementABranches = Extract<EmplacementDeDotation, { sorte: 'branches' }>;
type EmplacementJoker = Extract<EmplacementDeDotation, { sorte: 'joker' }>;

/** Dotations d'un héros : celles de sa Classe puis de son Niveau de carrière (`careerLevel` défaut 1, la création). */
export function dotationsDuHeros(careerId: string, careerLevel: number = 1): TrappingRef[] {
  const level = levelsForCareer(careerId).find((l) => l.level === careerLevel) ?? firstLevel(careerId);
  return [...(findClassById(findCareerById(careerId)?.class.id)?.trappings ?? []), ...(level?.trappings ?? [])];
}

/** Dotations d'un PNJ de carrière : celles des Niveaux 1 à `niveau` de sa carrière actuelle, sans celles de sa
 *  Classe. EDO 11 l.19 */
export function dotationsDuPnj(careerId: string, niveau: number): TrappingRef[] {
  return levelsForCareer(careerId).filter((l) => l.level <= niveau).flatMap((l) => l.trappings);
}

function emplacement(ref: BrancheDeDotation, chemin: readonly number[]): EmplacementPorte | undefined {
  const adresse = adresseDeCreation.dotation(chemin);
  if ('pick' in ref) return { adresse, chemin, sorte: 'branches', ref };
  if ('wildcard' in ref) return { adresse, chemin, sorte: 'joker', ref };
  if ('qualityChoice' in ref && ref.qualityChoice) return { adresse, chemin, sorte: 'atout', ref };
  return undefined;
}

/** `ref` est-elle un emplacement de dotation (sinon une ref concrète) ? */
export function estEmplacementDeDotation(ref: TrappingRef): boolean {
  return emplacement(ref, []) !== undefined;
}

/** L'emplacement que porte la branche `j` d'un `{pick, of}`, s'il y en a un. */
export function sousEmplacement(e: EmplacementABranches, j: number): EmplacementDeDotation | undefined {
  const branche = e.ref.of[j];
  return branche ? emplacement(branche, [...e.chemin, j]) : undefined;
}

/** L'Atout au choix d'un joker à `qualityChoice`, à l'adresse `[...chemin, 0]`. */
function atoutDuJoker(e: EmplacementJoker): EmplacementDeDotation | undefined {
  const chemin = [...e.chemin, 0];
  return e.ref.qualityChoice ? { adresse: adresseDeCreation.dotation(chemin), chemin, sorte: 'atout', ref: e.ref } : undefined;
}

/** Les emplacements qui suivent `e` : celui de chaque branche d'un `{pick, of}` qui en porte un, l'Atout au choix
 *  d'un joker à `qualityChoice`. */
export function sousEmplacements(e: EmplacementDeDotation): EmplacementDeDotation[] {
  if (e.sorte === 'branches') return e.ref.of.flatMap((_, j) => sousEmplacement(e, j) ?? []);
  const atout = e.sorte === 'joker' ? atoutDuJoker(e) : undefined;
  return atout ? [atout] : [];
}

/** L'emplacement qui suit `e` selon `choices` : celui de la branche choisie d'un `{pick, of}`, l'Atout au choix
 *  d'un joker à `qualityChoice`. */
export function sousEmplacementActif(e: EmplacementDeDotation, choices: ChoixDeDotation): EmplacementDeDotation | undefined {
  if (e.sorte === 'branches') {
    const j = brancheChoisie(e, choices);
    return j === undefined ? undefined : sousEmplacement(e, j);
  }
  return e.sorte === 'joker' ? atoutDuJoker(e) : undefined;
}

function aplatir(e: EmplacementDeDotation): EmplacementDeDotation[] {
  return [e, ...sousEmplacements(e).flatMap(aplatir)];
}

/** Les emplacements de la liste `dotations`, chacun suivi des emplacements qui le suivent (`sousEmplacements`). */
export function emplacementsDeDotation(dotations: readonly TrappingRef[]): EmplacementDeDotation[] {
  return dotations.flatMap((ref, i) => {
    const e = emplacement(ref, [i]);
    return e ? aplatir(e) : [];
  });
}

/** Un emplacement porté directement par la liste des dotations, et non par une branche ou un joker. */
export function estEmplacementRacine(e: EmplacementDeDotation): boolean {
  return e.chemin.length === 1;
}

/** La branche choisie d'un `{pick, of}`, si `choices` en désigne une qui existe. */
export function brancheChoisie(e: EmplacementABranches, choices: ChoixDeDotation): number | undefined {
  const j = choices[e.adresse];
  return typeof j === 'number' && j >= 0 && j < e.ref.of.length ? j : undefined;
}

/** L'objet choisi d'un `{wildcard}`, ou l'Atout choisi d'un emplacement `atout`. */
export function idChoisi(e: EmplacementDeDotation, choices: ChoixDeDotation): string | undefined {
  const v = choices[e.adresse];
  return typeof v === 'string' && v ? v : undefined;
}

/** Le joueur a-t-il tranché l'emplacement ? Un `{pick, of}` exige sa branche, un `{wildcard}` un objet ; un `atout`
 *  l'est toujours (défaut `DEFAULT_FABRICATION_ATOUT`). L'emplacement qui suit (`sousEmplacementActif`) doit l'être
 *  aussi. */
export function emplacementTranche(e: EmplacementDeDotation, choices: ChoixDeDotation): boolean {
  const tranche = e.sorte === 'branches' ? brancheChoisie(e, choices) !== undefined : e.sorte === 'joker' ? idChoisi(e, choices) !== undefined : true;
  const sous = tranche ? sousEmplacementActif(e, choices) : undefined;
  return tranche && (!sous || emplacementTranche(sous, choices));
}

/** Les valeurs qu'un choix peut poser sur l'emplacement `e` : l'index de chaque branche d'un `{pick, of}`, chaque arme
 *  choisissable d'un `{wildcard}` (`armesChoisissables`), du seul Groupe `groupe` s'il en nomme un, chaque Atout de
 *  Fabrication d'un `atout` (`fabricationAtouts`, LDB 60 l.9-32). */
export function valeursDeLEmplacement(e: EmplacementDeDotation): (number | string)[] {
  if (e.sorte === 'branches') return e.ref.of.map((_, j) => j);
  if (e.sorte === 'atout') return fabricationAtouts();
  const groupe = e.ref.groupe?.id;
  return armesChoisissables().filter((a) => groupe === undefined || a.groupe === groupe).map((a) => a.id);
}

/** Le libellé de la valeur `v` de l'emplacement `e` (`valeursDeLEmplacement`) : sa branche, son arme ou son Atout. */
export function libelleDeLaValeur(e: EmplacementDeDotation, v: number | string): string {
  if (e.sorte === 'branches') return trappingRefLabel(e.ref.of[Number(v)]);
  return (e.sorte === 'joker' ? findTrappingById(String(v)) : findQualityById(String(v)))!.label;
}

/** La liste `dotations` aux emplacements résolus par `choices`. Un emplacement non tranché (`{pick, of}`
 *  sans branche, `{wildcard}` sans objet) reste tel quel, ignoré par le matérialiseur ; un emplacement `atout` reçoit
 *  l'Atout choisi, sinon `DEFAULT_FABRICATION_ATOUT` (LDB 60 l.11). Un lot choisi rend ses membres, à sa place. */
export function resolveTrappingChoices(dotations: readonly TrappingRef[], choices: ChoixDeDotation): TrappingRef[] {
  return dotations.flatMap((ref, i) => resoudre(ref, [i], choices));
}

/** L'Atout que pose l'emplacement `atout` `e`. */
const atoutPose = (e: EmplacementDeDotation, choices: ChoixDeDotation) => fabricationAtoutQuality(idChoisi(e, choices) ?? DEFAULT_FABRICATION_ATOUT);

function resoudre(ref: BrancheDeDotation, chemin: readonly number[], choices: ChoixDeDotation): TrappingRef[] {
  if ('lot' in ref) return ref.lot;
  const e = emplacement(ref, chemin);
  if (!e) return [ref];
  if (e.sorte === 'branches') {
    const j = brancheChoisie(e, choices);
    return j === undefined ? [ref] : resoudre(e.ref.of[j], [...chemin, j], choices);
  }
  if (e.sorte === 'joker') {
    const id = idChoisi(e, choices);
    const atout = sousEmplacementActif(e, choices);
    return [id ? { id, ...(atout ? { qualities: [atoutPose(atout, choices)] } : {}) } : ref];
  }
  return [{ id: e.ref.id, spec: e.ref.spec, count: e.ref.count, ...(e.ref.valeur ? { valeur: e.ref.valeur } : {}), qualities: [atoutPose(e, choices)] }];
}

/**
 * Emplacements de DOTATION (`{choice}`, `{wildcard}`, `{id, qualityChoice}` des `TrappingRef`) d'une liste de
 * dotations (`dotationsDuHeros`, `dotationsDuPnj`) : leur énumération canonique, `emplacementsDeDotation`, et leur
 * résolveur, `resolveTrappingChoices`. Chaque emplacement a une adresse `adresseDeCreation.dotation(chemin)` ; les
 * choix du joueur (`ChoixDeCreation.trappingChoices`) ou de l'auteur d'un PNJ sont rangés par ces adresses. Seul ce
 * module LIT la valeur d'un choix (`brancheChoisie`, `idChoisi`).
 */
import { armesChoisissables, fabricationAtouts, findCareerById, findClassById, findQualityById, findTrappingById, firstLevel, levelsForCareer, trappingRefLabel, DEFAULT_FABRICATION_ATOUT, fabricationAtoutQuality, type TrappingRef } from '../data/index';
import { adresseDeCreation, type AdresseDeCreation } from './adresseDeCreation';

/** Choix de dotation : index de branche d'un `{choice}`, id d'objet d'un `{wildcard}`, id d'Atout d'un
 *  `{id, qualityChoice}`. */
export type ChoixDeDotation = Record<AdresseDeCreation, number | string>;

/** Un emplacement de dotation, à son adresse. `chemin` : cf. `adresseDeCreation.dotation`. */
export type EmplacementDeDotation = { adresse: AdresseDeCreation; chemin: readonly number[] } & (
  | { sorte: 'branches'; ref: Extract<TrappingRef, { choice: TrappingRef[] }> }
  | { sorte: 'joker'; ref: Extract<TrappingRef, { wildcard: string }> }
  | { sorte: 'atout'; ref: Extract<TrappingRef, { id: string; type?: never }> }
);
type EmplacementABranches = Extract<EmplacementDeDotation, { sorte: 'branches' }>;

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

function emplacement(ref: TrappingRef, chemin: readonly number[]): EmplacementDeDotation | undefined {
  const adresse = adresseDeCreation.dotation(chemin);
  if ('choice' in ref) return { adresse, chemin, sorte: 'branches', ref };
  if ('wildcard' in ref) return { adresse, chemin, sorte: 'joker', ref };
  if ('qualityChoice' in ref && ref.qualityChoice) return { adresse, chemin, sorte: 'atout', ref };
  return undefined;
}

/** `ref` est-elle un emplacement de dotation (sinon une ref concrète) ? */
export function estEmplacementDeDotation(ref: TrappingRef): boolean {
  return emplacement(ref, []) !== undefined;
}

/** L'emplacement que porte la branche `j` d'un `{choice}`, s'il y en a un. */
export function sousEmplacement(e: EmplacementABranches, j: number): EmplacementDeDotation | undefined {
  const branche = e.ref.choice[j];
  return branche ? emplacement(branche, [...e.chemin, j]) : undefined;
}

function aplatir(e: EmplacementDeDotation | undefined): EmplacementDeDotation[] {
  if (!e) return [];
  return [e, ...(e.sorte === 'branches' ? e.ref.choice.flatMap((_, j) => aplatir(sousEmplacement(e, j))) : [])];
}

/** Les emplacements de la liste `dotations`, chacun suivi des emplacements de ses branches. */
export function emplacementsDeDotation(dotations: readonly TrappingRef[]): EmplacementDeDotation[] {
  return dotations.flatMap((ref, i) => aplatir(emplacement(ref, [i])));
}

/** Un emplacement porté directement par la liste des dotations, et non par une branche. */
export function estEmplacementRacine(e: EmplacementDeDotation): boolean {
  return e.chemin.length === 1;
}

/** La branche choisie d'un `{choice}`, si `choices` en désigne une qui existe. */
export function brancheChoisie(e: EmplacementABranches, choices: ChoixDeDotation): number | undefined {
  const j = choices[e.adresse];
  return typeof j === 'number' && j >= 0 && j < e.ref.choice.length ? j : undefined;
}

/** L'objet choisi d'un `{wildcard}`, ou l'Atout choisi d'un `{id, qualityChoice}`. */
export function idChoisi(e: EmplacementDeDotation, choices: ChoixDeDotation): string | undefined {
  const v = choices[e.adresse];
  return typeof v === 'string' && v ? v : undefined;
}

/** Le joueur a-t-il tranché l'emplacement ? Un `{choice}` exige sa branche, et que l'emplacement de
 *  cette branche soit lui-même tranché ; un `{wildcard}` exige un objet ; un `{id, qualityChoice}` l'est
 *  toujours (défaut `DEFAULT_FABRICATION_ATOUT`). */
export function emplacementTranche(e: EmplacementDeDotation, choices: ChoixDeDotation): boolean {
  if (e.sorte === 'branches') {
    const j = brancheChoisie(e, choices);
    if (j === undefined) return false;
    const sous = sousEmplacement(e, j);
    return !sous || emplacementTranche(sous, choices);
  }
  if (e.sorte === 'joker') return idChoisi(e, choices) !== undefined;
  return true;
}

/** Les valeurs qu'un choix peut poser sur l'emplacement `e` : l'index de chaque branche d'un `{choice}`, chaque arme
 *  choisissable d'un `{wildcard}` (`armesChoisissables`), chaque Atout de Fabrication d'un `{id, qualityChoice}`
 *  (`fabricationAtouts`, LDB 60 l.9-32). */
export function valeursDeLEmplacement(e: EmplacementDeDotation): (number | string)[] {
  if (e.sorte === 'branches') return e.ref.choice.map((_, j) => j);
  return e.sorte === 'joker' ? armesChoisissables().map((a) => a.id) : fabricationAtouts();
}

/** Le libellé de la valeur `v` de l'emplacement `e` (`valeursDeLEmplacement`) : sa branche, son arme ou son Atout. */
export function libelleDeLaValeur(e: EmplacementDeDotation, v: number | string): string {
  if (e.sorte === 'branches') return trappingRefLabel(e.ref.choice[Number(v)]);
  return (e.sorte === 'joker' ? findTrappingById(String(v)) : findQualityById(String(v)))!.label;
}

/** La liste `dotations` aux emplacements résolus par `choices`. Un emplacement non tranché (`{choice}`
 *  sans branche, `{wildcard}` sans objet) reste tel quel, ignoré par le matérialiseur ; un
 *  `{id, qualityChoice}` reçoit l'Atout choisi, sinon `DEFAULT_FABRICATION_ATOUT` (LDB 60 l.11). */
export function resolveTrappingChoices(dotations: readonly TrappingRef[], choices: ChoixDeDotation): TrappingRef[] {
  return dotations.map((ref, i) => resoudre(ref, emplacement(ref, [i]), choices));
}

function resoudre(ref: TrappingRef, e: EmplacementDeDotation | undefined, choices: ChoixDeDotation): TrappingRef {
  if (!e) return ref;
  if (e.sorte === 'branches') {
    const j = brancheChoisie(e, choices);
    return j === undefined ? ref : resoudre(e.ref.choice[j], sousEmplacement(e, j), choices);
  }
  if (e.sorte === 'joker') {
    const id = idChoisi(e, choices);
    return id ? { id } : ref;
  }
  return { id: e.ref.id, spec: e.ref.spec, count: e.ref.count, ...(e.ref.valeur ? { valeur: e.ref.valeur } : {}), qualities: [fabricationAtoutQuality(idChoisi(e, choices) ?? DEFAULT_FABRICATION_ATOUT)] };
}

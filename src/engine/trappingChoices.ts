/**
 * Emplacements de DOTATION (`{pick, of}`, `{wildcard}`, `{id, qualityChoice}` des `TrappingRef`, et les Atouts au choix
 * d'un `{wildcard, qualityChoice}`) d'une liste de dotations (`dotationsDuHeros`, `dotationsDuPnj`) : leur énumération
 * canonique, `emplacementsDeDotation`, et leur résolveur, `resolveTrappingChoices`. Un lot (`{lot}`, option d'un
 * `{pick, of}`) n'est pas un emplacement. Chaque emplacement a une adresse `adresseDeCreation.dotation(chemin)` ; les
 * choix du joueur (`ChoixDeCreation.trappingChoices`) ou de l'auteur d'un PNJ sont rangés par ces adresses. Seul ce
 * module LIT la valeur d'un choix (`brancheChoisie`, `idChoisi`, `atoutChoisi`).
 */
import { armesChoisissables, fabricationAtouts, findCareerById, findClassById, findQualityById, findTrappingById, firstLevel, levelsForCareer, trappingRefLabel, DEFAULT_FABRICATION_ATOUT, fabricationAtoutQuality, type BrancheDeDotation, type JokerDArme, type QualityRef, type TrappingRef } from '../data/index';
import { adresseDeCreation, type AdresseDeCreation } from './adresseDeCreation';
import { atoutsMinimaux } from './qualities/craftEconomy';

/** Choix de dotation : index de branche d'un `{pick, of}`, id d'objet d'un `{wildcard}`, clé de combinaison d'Atouts
 *  d'un `{id, qualityChoice}` ou d'un `{wildcard, qualityChoice}` (`valeursDeLEmplacement`). */
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
type EmplacementAtout = Extract<EmplacementDeDotation, { sorte: 'atout' }>;

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

/** Les Atouts au choix d'un joker à `qualityChoice`, à l'adresse `[...chemin, 0]`. */
function atoutDuJoker(e: EmplacementJoker): EmplacementDeDotation | undefined {
  const chemin = [...e.chemin, 0];
  return e.ref.qualityChoice ? { adresse: adresseDeCreation.dotation(chemin), chemin, sorte: 'atout', ref: e.ref } : undefined;
}

/** Les emplacements qui suivent `e` : celui de chaque branche d'un `{pick, of}` qui en porte un, les Atouts au choix
 *  d'un joker à `qualityChoice`. */
export function sousEmplacements(e: EmplacementDeDotation): EmplacementDeDotation[] {
  if (e.sorte === 'branches') return e.ref.of.flatMap((_, j) => sousEmplacement(e, j) ?? []);
  const atout = e.sorte === 'joker' ? atoutDuJoker(e) : undefined;
  return atout ? [atout] : [];
}

/** L'emplacement qui suit `e` selon `choices` : celui de la branche choisie d'un `{pick, of}`, les Atouts au choix
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

/** L'objet choisi d'un `{wildcard}` : la chaîne posée à son adresse. */
export function idChoisi(e: EmplacementDeDotation, choices: ChoixDeDotation): string | undefined {
  const v = choices[e.adresse];
  return typeof v === 'string' && v ? v : undefined;
}

/** Le joueur a-t-il tranché l'emplacement ? Un `{pick, of}` exige sa branche, un `{wildcard}` un objet ; un `atout`
 *  l'est toujours (`valeurParDefaut`). L'emplacement qui suit (`sousEmplacementActif`) doit l'être
 *  aussi. */
export function emplacementTranche(e: EmplacementDeDotation, choices: ChoixDeDotation): boolean {
  const tranche = e.sorte === 'branches' ? brancheChoisie(e, choices) !== undefined : e.sorte === 'joker' ? idChoisi(e, choices) !== undefined : true;
  const sous = tranche ? sousEmplacementActif(e, choices) : undefined;
  return tranche && (!sous || emplacementTranche(sous, choices));
}

/** Une combinaison d'Atouts de Fabrication qu'offre un emplacement `atout` : sa clé (ses ids triés par id, joints par
 *  `+`), ses ids et les `qualities` qu'elle pose (`fabricationAtoutQuality`). */
type CombinaisonDAtouts = { cle: string; ids: string[]; qualities: QualityRef[] };

/** Le nombre d'Atouts de l'emplacement `atout` `e` (`atoutsMinimaux`), sur l'Encombrement de l'objet doté. */
function nombreDAtouts(e: EmplacementAtout): number {
  if ('wildcard' in e.ref) return atoutsMinimaux(e.ref.qualityChoice!);
  const enc = findTrappingById(e.ref.id)?.enc;
  return atoutsMinimaux(e.ref.qualityChoice!, typeof enc === 'number' ? enc : 0);
}

/** Les multi-ensembles de `n` Atouts de `atouts` pris à partir du rang `depuis`, dans leur ordre : un Atout qui n'est pas
 *  `repetable` y figure au plus une fois. LDB 60 l.26 ; LDB 60 l.30 */
function multiEnsembles(atouts: readonly string[], n: number, depuis = 0): string[][] {
  if (n === 0) return [[]];
  return atouts.slice(depuis).flatMap((id, k) => {
    const suivant = findQualityById(id)?.capabilities?.repetable ? depuis + k : depuis + k + 1;
    return multiEnsembles(atouts, n - 1, suivant).map((suite) => [id, ...suite]);
  });
}

/** Les combinaisons d'Atouts de Fabrication (`fabricationAtouts`) qu'offre l'emplacement `atout` `e`. */
function combinaisonsDAtouts(e: EmplacementAtout): CombinaisonDAtouts[] {
  return multiEnsembles(fabricationAtouts(), nombreDAtouts(e)).map((ids) => ({
    cle: [...ids].sort().join('+'),
    ids,
    qualities: [...new Set(ids)].flatMap((id) => fabricationAtoutQuality(id, ids.filter((x) => x === id).length)),
  }));
}

/** La valeur de l'emplacement `atout` `e` sans choix : sa combinaison de `DEFAULT_FABRICATION_ATOUT` seul. */
export function valeurParDefaut(e: EmplacementAtout): string {
  return Array.from({ length: nombreDAtouts(e) }, () => DEFAULT_FABRICATION_ATOUT).join('+');
}

/** La combinaison que `choices` pose sur l'emplacement `atout` `e` : celle dont la clé est la valeur choisie, sinon
 *  celle de `valeurParDefaut`. */
function combinaisonChoisie(e: EmplacementAtout, choices: ChoixDeDotation): CombinaisonDAtouts {
  const combinaisons = combinaisonsDAtouts(e);
  const v = choices[e.adresse];
  return combinaisons.find((c) => c.cle === v) ?? combinaisons.find((c) => c.cle === valeurParDefaut(e))!;
}

/** La valeur que `choices` pose sur l'emplacement `atout` `e`, parmi `valeursDeLEmplacement(e)`. */
export function atoutChoisi(e: EmplacementAtout, choices: ChoixDeDotation): string {
  return combinaisonChoisie(e, choices).cle;
}

/** Les valeurs qu'un choix peut poser sur l'emplacement `e` : l'index de chaque branche d'un `{pick, of}`, chaque arme
 *  choisissable d'un `{wildcard}` (`armesChoisissables`), du seul Groupe `groupe` s'il en nomme un, la clé de chaque
 *  combinaison d'Atouts de Fabrication d'un `atout` (LDB 60 l.7-32). */
export function valeursDeLEmplacement(e: EmplacementDeDotation): (number | string)[] {
  if (e.sorte === 'branches') return e.ref.of.map((_, j) => j);
  if (e.sorte === 'atout') return combinaisonsDAtouts(e).map((c) => c.cle);
  const groupe = e.ref.groupe?.id;
  return armesChoisissables().filter((a) => groupe === undefined || a.groupe === groupe).map((a) => a.id);
}

/** Le libellé de la valeur `v` de l'emplacement `e` (`valeursDeLEmplacement`) : sa branche, son arme ou ses Atouts. */
export function libelleDeLaValeur(e: EmplacementDeDotation, v: number | string): string {
  if (e.sorte === 'branches') return trappingRefLabel(e.ref.of[Number(v)]);
  if (e.sorte === 'joker') return findTrappingById(String(v))!.label;
  return combinaisonsDAtouts(e).find((c) => c.cle === v)!.ids.map((id) => findQualityById(id)!.label).join(', ');
}

/** La liste `dotations` aux emplacements résolus par `choices`. Un emplacement non tranché (`{pick, of}`
 *  sans branche, `{wildcard}` sans objet) reste tel quel, ignoré par le matérialiseur ; un emplacement `atout` reçoit
 *  les Atouts de sa combinaison choisie (`atoutChoisi`). Un lot choisi rend ses membres, à sa place. */
export function resolveTrappingChoices(dotations: readonly TrappingRef[], choices: ChoixDeDotation): TrappingRef[] {
  return dotations.flatMap((ref, i) => resoudre(ref, [i], choices));
}

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
    return [id ? { id, ...(atout?.sorte === 'atout' ? { qualities: combinaisonChoisie(atout, choices).qualities } : {}) } : ref];
  }
  return [{ id: e.ref.id, spec: e.ref.spec, count: e.ref.count, ...(e.ref.valeur ? { valeur: e.ref.valeur } : {}), qualities: combinaisonChoisie(e, choices).qualities }];
}

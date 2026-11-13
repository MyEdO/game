/**
 * CE QUE PORTE UN COMBATTANT (#2972 J5, #3253, #3456) : un autre producteur des `Portee` d'une composition
 * (`porteeDeComposition`), lu sur son état : sa race de rendu, sa tête, ses armes tenues puis rangées, ses objets
 * équipés qui revêtent des pièces, son armure (`armuresDuCombattant`), chacun par le seul assembleur d'objet
 * (`porteesDesObjets`), la tenue de sa carrière, son emblème et ses couleurs ; ou, véhicule ou engin, sa fiche, son
 * empreinte, son cap, ses couleurs et les pièces de ses postes à un bord (`vehiculeDuCombattant`, #2987).
 */
import type { Combatant, FireArc, HitLocation, ItemInstance } from '../../engine/types';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import type { Dir8 } from '../../geometry/dir8';
import { LOCALISATIONS_DE_COUP } from '../../engine/types';
import { apparencesCandidates } from '../../engine/items';
import { findTierEntry } from '../../engine/tables';
import {
  findCreatureById,
  findFicheDeVehicule,
  findNavalTrait,
  findGroupeDArmureById,
  findPlanDEspeceById,
  findSpeciesById,
  findTenueDeCarriere,
  findTeteById,
  findVehicleById,
  piecesDeLObjet,
  raceAppearance,
  sexeDuPorteur,
  weaponGroups,
  type GroupeDArmure,
} from '../../data';
import { armesDuCombattant, emblemeDe } from '../equipementDessine';
import {
  facteursDeComposition,
  porteesDeLaTenue,
  porteesDesObjets,
  teinteDeLObjet,
  type ObjetPorte,
  type Portee,
  type PorteeDeComposition,
} from './composition';
import { pieceRacine, type EmblemeResolu } from './gardeRobe';
import { footprintN } from '../monde/footprint';
import { hullNavalTraits } from '../../engine/navalTraits';

/** La race de rendu d'une espèce : celle que le plan de bestiaire (`findPlanDEspeceById`, #2993) donne à la race
 *  d'apparence d'une espèce jouable (`refChar`), sinon à l'espèce ; aucune si l'espèce n'y porte pas la base humanoïde. */
const raceDeRendu = (species: string | undefined) => {
  const race = findPlanDEspeceById(findSpeciesById(species)?.refChar ?? species)?.race;
  return race && raceAppearance.find((r) => r.id === race.id);
};

/** Le Groupe d'armure dont l'armure de statbloc a `pa` PA : son palier atteint (`findTierEntry`), le schéma de
 *  `weaponGroups.json` en exigeant un au seuil 0 (#2948). */
function groupeDuPalier(pa: number): GroupeDArmure {
  return findTierEntry(weaponGroups.filter((g): g is GroupeDArmure & { seuil: number } => g.kind === 'armour' && g.seuil !== undefined), pa)!;
}

/** La teinte d'un objet (`teinteDeLObjet`), à étaler dans son `ObjetPorte`. */
const saTeinte = (o: { teinte?: string; subType?: string }): Pick<ObjetPorte, 'teinte'> => {
  const teinte = teinteDeLObjet(o);
  return teinte ? { teinte } : {};
};

/** Un objet de l'armure : l'objet porté et la couche de son Groupe, -1 sans Groupe d'armure. */
type Armure = { objet: ObjetPorte; couche: number };

/** L'armure équipée `i` : ses localisations et sa teinte (`teinteDeLObjet`). */
const armureEquipee = (i: ItemInstance): Armure => ({
  objet: { nom: i.trappingId ?? i.label, trappingId: i.trappingId, candidats: [], locs: i.locs ?? [], ...saTeinte(i) },
  couche: findGroupeDArmureById(i.subType)?.couche ?? -1,
});

/** L'armure de statbloc de `c` (PA par localisation, `c.armour`), si son apparence la déclare portée (`armurePortee`, son
 *  apparence d'auteur, sinon sa créature ; #774) : par Groupe d'armure atteint, les localisations dont les PA ont ce Groupe
 *  pour palier (`groupeDuPalier`), à sa teinte. */
function armureDeStatbloc(c: Combatant): Armure[] {
  if (!(c.appearanceOverride?.armurePortee ?? findCreatureById(c.creatureId)?.appearance?.armurePortee)) return [];
  const parGroupe = new Map<GroupeDArmure, HitLocation[]>();
  for (const loc of LOCALISATIONS_DE_COUP) {
    if (!(c.armour[loc] > 0)) continue;
    const groupe = groupeDuPalier(c.armour[loc]);
    parGroupe.set(groupe, [...(parGroupe.get(groupe) ?? []), loc]);
  }
  return [...parGroupe].map(([groupe, locs]) => ({ objet: { nom: groupe.label, candidats: [], locs, ...(groupe.teinte ? { teinte: groupe.teinte.id } : {}) }, couche: groupe.couche }));
}

/** L'armure de `c` : ses armures équipées qui revêtent des pièces, sinon son armure de statbloc déclarée portée ; de la
 *  couche la plus haute à la plus basse, pour qu'une pièce que revêtent deux armures soit celle du dessus. */
function armuresDuCombattant(c: Combatant, armes: ReadonlySet<string>): ObjetPorte[] {
  const equipees = (c.items ?? []).filter((i) => i.equipped && i.kind === 'armor' && !armes.has(i.uid) && piecesDeLObjet(i.trappingId, i.locs).length > 0).map(armureEquipee);
  return (equipees.length ? equipees : armureDeStatbloc(c)).sort((a, b) => b.couche - a.couche).map((a) => a.objet);
}

/** `portees` où chaque pièce n'est portée qu'une fois, à sa première occurrence (par sa pièce racine, `pieceRacine`). */
function uneFoisParPiece(portees: readonly Portee[]): Portee[] {
  const vues = new Set<string>();
  return portees.filter(({ cle }) => {
    if (cle.champ !== 'piece') return true;
    const racine = pieceRacine(cle.id)?.id ?? cle.id;
    if (vues.has(racine)) return false;
    vues.add(racine);
    return true;
  });
}

/** Les couleurs de `c` : celles de l'apparence de sa créature, chacune remplacée par celle de son apparence d'auteur
 *  (`appearanceOverride`) ; absentes si aucune ne colore un emplacement. */
function couleursDuCombattant(c: Combatant): Pick<EntityAppearance, 'couleurs'> {
  const couleurs = { ...findCreatureById(c.creatureId)?.appearance?.couleurs, ...c.appearanceOverride?.couleurs };
  return Object.keys(couleurs).length ? { couleurs } : {};
}

/** Ce que porte `c`, `null` si son espèce n'a aucune race de rendu (#2993) : sa tête, ses armes tenues puis rangées,
 *  ses objets équipés qui revêtent des pièces (`piecesDeLObjet`), son armure (`armuresDuCombattant`), puis la tenue de
 *  sa carrière (`findTenueDeCarriere`) ; une pièce n'est portée qu'une fois, par le premier qui la revêt. */
export function porteeDuCombattant(c: Combatant): PorteeDeComposition | null {
  const race = raceDeRendu(c.species);
  if (!race) return null;
  const tete = findTeteById(race.id);
  const { tenues, rangees } = armesDuCombattant(c);
  const armes = new Set([...tenues.map((t) => t.arme), ...rangees].flatMap((w) => (w.uid ? [w.uid] : [])));
  const objets: ObjetPorte[] = [
    ...tenues.filter(({ arme }) => !arme.natural).map(({ arme, hand }) => ({ nom: arme.trappingId ?? arme.label, trappingId: arme.trappingId, candidats: apparencesCandidates(arme), prise: hand, ...saTeinte(arme) })),
    ...rangees.filter((w) => !w.natural).map((w) => ({ nom: w.trappingId ?? w.label, trappingId: w.trappingId, candidats: apparencesCandidates(w), ...saTeinte(w) })),
    ...(c.items ?? [])
      .filter((i) => i.equipped && i.kind !== 'armor' && !armes.has(i.uid) && i.trappingId !== undefined && piecesDeLObjet(i.trappingId).length > 0)
      .map((i) => ({ nom: i.trappingId!, trappingId: i.trappingId, candidats: [], ...saTeinte(i) })),
    ...armuresDuCombattant(c, armes),
  ];
  const { portees, rapport } = porteesDesObjets(objets);
  const tenue = findTenueDeCarriere(c.career);
  const embleme = emblemeDe(c.appearanceOverride, c.creatureId);
  return {
    portees: uneFoisParPiece([...(tete ? [{ cle: { champ: 'tete', id: tete.id }, label: tete.label } satisfies Portee] : []), ...portees, ...(tenue ? porteesDeLaTenue(tenue.id) : [])]),
    rapport,
    ...(embleme ? { embleme } : {}),
    ...couleursDuCombattant(c),
    facteurs: facteursDeComposition(undefined, race),
    // #3253
    sex: sexeDuPorteur(c) ?? 'M',
  };
}

/** La pièce d'un poste à un bord d'un véhicule (`Combatant.postes`, MDG 12) : l'id de sa fiche (`item.trappingId`), son
 *  bord et sa teinte (`teinteDeLObjet`). */
export interface PosteDuVehicule {
  readonly definition: string;
  readonly bord: FireArc;
  readonly teinte?: string;
}

/** Un véhicule ou un engin de siège au combat : l'id de sa fiche, que nomme la clé `definition` d'un élément 3D
 *  `vehicule`, le côté N de son empreinte (`footprintN`), sa taille, son cap (`Jeu.facing`, le nord sans cap, comme au
 *  combat), ses couleurs, celles de son apparence d'auteur, les pièces de ses postes à un bord, dans leur ordre, et les
 *  Améliorations de sa coque (`hullNavalTraits`, MDG 12), sans ses Traits, et son emblème (`emblemeDe`), que reçoivent
 *  les surfaces `blason` de son élément, ses voiles et son pavillon. Un
 *  engin de siège a sa taille réelle ; une coque remplit son empreinte, sa taille réelle à terre étant le plateau de son
 *  pont (arbitrage de Clément du 2026-11-08, #2987). */
export interface VehiculeDuCombattant extends Pick<EntityAppearance, 'couleurs'> {
  readonly definition: string;
  readonly empreinte: number;
  readonly taille: 'reelle' | 'empreinte';
  readonly cap: Dir8;
  readonly postes: readonly PosteDuVehicule[];
  readonly ameliorations: readonly string[];
  readonly embleme?: EmblemeResolu;
}

/** Le véhicule que `c`, au cap `cap`, est, si sa fiche est une coque ou un engin de siège (`findFicheDeVehicule`, #2987),
 *  sinon `null`. */
export function vehiculeDuCombattant(c: Combatant, cap: Dir8 | undefined): VehiculeDuCombattant | null {
  if (c.creatureId === undefined || !findFicheDeVehicule(c.creatureId)) return null;
  const postes = (c.postes ?? []).flatMap(({ item, side }) => (side && item.trappingId ? [{ definition: item.trappingId, bord: side, ...saTeinte(item) }] : []));
  const taille = findVehicleById(c.creatureId)?.hull ? 'empreinte' : 'reelle';
  const ameliorations = hullNavalTraits(c).flatMap(({ id }) => (findNavalTrait(id)?.kind === 'amelioration' ? [id] : []));
  const embleme = emblemeDe(c.appearanceOverride, c.creatureId);
  return { definition: c.creatureId, empreinte: footprintN(c), taille, cap: cap ?? 'N', ...couleursDuCombattant(c), postes, ameliorations, ...(embleme ? { embleme } : {}) };
}

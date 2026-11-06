/**
 * CE QUE PORTE UN COMBATTANT (#2972 J5, #3253, #3456) : un autre producteur des `Portee` d'une composition
 * (`porteeDeComposition`), lu sur son état : sa race de rendu, sa tête, ses armes tenues puis rangées, ses objets
 * équipés qui revêtent des pièces, son armure (`armuresDuCombattant`), chacun par le seul assembleur d'objet
 * (`porteesDesObjets`), la tenue de sa carrière, et son emblème.
 */
import type { Combatant, HitLocation, ItemInstance } from '../../engine/types';
import { LOCALISATIONS_DE_COUP } from '../../engine/types';
import { apparencesCandidates } from '../../engine/items';
import { findTierEntry } from '../../engine/tables';
import { findCreatureById, findGroupeDArmureById, findSpeciesById, findTenueDeCarriere, findTeteById, piecesDeLObjet, raceAppearance, weaponGroups, type GroupeDArmure } from '../../data';
import { armesDuCombattant, emblemeDe } from '../equipementDessine';
import { facteursDeComposition, porteesDeLaTenue, porteesDesObjets, teinteDeLObjet, type ObjetPorte, type Portee, type PorteeDeComposition } from './composition';
import { pieceRacine } from './gardeRobe';

/** La race de rendu d'une espèce : la race d'apparence d'une espèce jouable (`refChar`), sinon l'espèce si elle est une
 *  race de `raceAppearance.json`. */
const raceDeRendu = (species: string | undefined) => {
  const id = findSpeciesById(species)?.refChar ?? species;
  return raceAppearance.find((r) => r.id === id);
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

/** Ce que porte `c`, `null` si son espèce n'a aucune race de rendu (#2973) : sa tête, ses armes tenues puis rangées,
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
    facteurs: facteursDeComposition(undefined, race),
    // #3253
    sex: c.appearance?.sex ?? 'M',
  };
}

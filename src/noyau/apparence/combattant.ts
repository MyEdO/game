/**
 * CE QUE PORTE UN COMBATTANT (#2972 J5, #3253) : un autre producteur des `Portee` d'une composition
 * (`porteeDeComposition`), lu sur son état : sa race de rendu, sa tête, ses armes tenues puis rangées et les objets
 * équipés qu'un ensemble habille, chacun par le seul assembleur d'objet (`porteesDesObjets`), et son emblème.
 */
import type { Combatant } from '../../engine/types';
import { apparencesCandidates } from '../../engine/items';
import { findSpeciesById, findTeteById, raceAppearance } from '../../data';
import { armesDuCombattant, emblemeDe } from '../equipementDessine';
import { facteursDeComposition, porteesDesObjets, type ObjetPorte, type Portee, type PorteeDeComposition } from './composition';
import { piecesDEnsemble } from './gardeRobe';

/** La race de rendu d'une espèce : la race d'apparence d'une espèce jouable (`refChar`), sinon l'espèce si elle est une
 *  race de `raceAppearance.json`. */
const raceDeRendu = (species: string | undefined) => {
  const id = findSpeciesById(species)?.refChar ?? species;
  return raceAppearance.find((r) => r.id === id);
};

/** Ce que porte `c`, `null` si son espèce n'a aucune race de rendu (#2973). */
export function porteeDuCombattant(c: Combatant): PorteeDeComposition | null {
  const race = raceDeRendu(c.species);
  if (!race) return null;
  const tete = findTeteById(race.id);
  const { tenues, rangees } = armesDuCombattant(c);
  const armes = new Set([...tenues.map((t) => t.arme), ...rangees].flatMap((w) => (w.uid ? [w.uid] : [])));
  const objets: ObjetPorte[] = [
    ...tenues.filter(({ arme }) => !arme.natural).map(({ arme, hand }) => ({ nom: arme.trappingId ?? arme.label, trappingId: arme.trappingId, apparence: apparencesCandidates(arme)[0], prise: hand })),
    ...rangees.filter((w) => !w.natural).map((w) => ({ nom: w.trappingId ?? w.label, trappingId: w.trappingId, apparence: apparencesCandidates(w)[0] })),
    ...(c.items ?? [])
      .filter((i) => i.equipped && !armes.has(i.uid) && i.trappingId !== undefined && piecesDEnsemble({ type: 'trapping', id: i.trappingId }).length > 0)
      .map((i) => ({ nom: i.trappingId!, trappingId: i.trappingId })),
  ];
  const { portees, rapport } = porteesDesObjets(objets);
  const embleme = emblemeDe(c.appearanceOverride, c.creatureId);
  return {
    portees: [...(tete ? [{ cle: { champ: 'tete', id: tete.id }, label: tete.label } satisfies Portee] : []), ...portees],
    rapport,
    ...(embleme ? { embleme } : {}),
    facteurs: facteursDeComposition(undefined, race),
    // #3253
    sex: c.appearance?.sex ?? 'M',
  };
}

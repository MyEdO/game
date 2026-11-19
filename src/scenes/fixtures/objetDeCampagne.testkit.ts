/** Porteur équipé d’un objet narratif à plusieurs formes, absent du catalogue. #2948 */
import type { FabriqueDId } from '../../engine/fabriqueDId';
import { findTrappingById, type TrappingData } from '../../data';
import { createHero } from '../../engine/character';
import { apparencesCandidates, itemFromGive, loadoutCreate, loadoutSetSlot, recomputeLoadout } from '../../engine/items';
import { emptyNarratif } from '../../noyau/monde/campaignNarratif';
import { objetDuNarratif } from '../../noyau/monde/resolveursDuNarratif';
import { entree as trappingEntree } from '../../data/schemas/defs/trappings';

/** Un objet de campagne : une entrée ENTIÈRE du catalogue des possessions, sous son id de campagne, entrée par le parse de
 *  son schéma (#4171). */
export function objetDeCampagne(proprietes: Partial<TrappingData> = {}) {
  return trappingEntree.parse({ ...findTrappingById('arme-simple')!, type: 'trappings', id: 'arme-de-campagne', label: 'Arme de campagne', shape: { id: 'epee' }, formChoices: ['epee', 'hache'], ...proprietes });
}

export function porteurDObjetDeCampagne(idNeuf: FabriqueDId, apparence: string, proprietes: Partial<TrappingData> = {}) {
  const objet = objetDeCampagne(proprietes);
  const narratif = { ...emptyNarratif(), objets: [objet] };
  const resolveTrapping = objetDuNarratif(narratif);
  const item = itemFromGive({ trappingId: objet.id, apparence: { id: apparence } }, idNeuf, undefined, resolveTrapping);
  const hero = createHero({ idNeuf, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Porteur de campagne', seed: 3 });
  hero.items = [item];
  hero.loadouts = [];
  const set = loadoutCreate(hero);
  loadoutSetSlot(hero, set, 'main', item.uid);
  recomputeLoadout(hero);
  return { objet, narratif, resolveTrapping, item, hero, candidats: apparencesCandidates(item) };
}

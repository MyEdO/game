/** Porteur équipé d’un objet narratif à plusieurs formes, absent du catalogue. #2948 */
import { findTrappingById } from './data';
import { createHero } from './engine/character';
import { apparencesCandidates, itemFromGive, loadoutCreate, loadoutSetSlot, recomputeLoadout } from './engine/items';
import { emptyNarratif } from './noyau/monde/campaignNarratif';
import { objetDuNarratif } from './noyau/monde/resolveursDuNarratif';

export function porteurDObjetDeCampagne() {
  const objet = { ...findTrappingById('arme-simple')!, id: 'arme-de-campagne', label: 'Arme de campagne', shape: 'epee', formChoices: ['epee', 'hache'] };
  const narratif = { ...emptyNarratif(), objets: [objet] };
  const resolveTrapping = objetDuNarratif(narratif);
  const item = itemFromGive({ trappingId: objet.id, apparence: { id: 'hache_naine' } }, undefined, resolveTrapping);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Porteur de campagne', seed: 3 });
  hero.items = [item];
  hero.loadouts = [];
  const set = loadoutCreate(hero);
  loadoutSetSlot(hero, set, 'main', item.uid);
  recomputeLoadout(hero);
  return { objet, narratif, resolveTrapping, item, hero, candidats: apparencesCandidates(item, resolveTrapping) };
}

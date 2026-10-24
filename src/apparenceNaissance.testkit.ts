import { apparences } from './data';
import { setDataset } from './data/overrides';
import { createHero } from './engine/character';

type Apparence = (typeof apparences)[number];
let catalogueInitial: Apparence[] | undefined;

export function varianteDeNaissance(patch: Partial<Apparence> = {}): Apparence {
  return { id: 'naissance-naine', type: 'apparences', label: 'Variante de naissance', forme: 'epee', especes: ['nains'], ...patch };
}

export function poserVariantesDeNaissance(...variantes: Apparence[]): void {
  catalogueInitial ??= apparences.slice();
  setDataset('apparences', [...catalogueInitial.filter((a) => !a.forme), ...variantes]);
}

export function restaurerApparencesDeNaissance(): void {
  if (!catalogueInitial) return;
  setDataset('apparences', catalogueInitial);
  catalogueInitial = undefined;
}

export function herosDeNaissance(speciesId = 'nains', careerId = 'soldat') {
  return createHero({ speciesId, careerId, label: 'Porteur de naissance', seed: 3 });
}

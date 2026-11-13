import { idsDeTest } from './idsDeTest.testkit';
import { apparences } from '../data';
import { setDataset } from '../data/overrides';
import type { EntreeVivante } from '../data/datasets';
import { idDeFixture } from '../data/idDeFixture.testkit';
import { createHero } from './character';

type Apparence = (typeof apparences)[number];
let catalogueInitial: Apparence[] | undefined;

/** Ce qu'un test règle d'une variante, en ids d'AUTEUR ; `especes: undefined` retire l'étiquette d'espèce. */
interface ReglageDeVariante { id?: string; forme?: { id: string }; especes?: string[]; classes?: string[]; qualites?: string[] }

export function varianteDeNaissance(reglage: ReglageDeVariante = {}): EntreeVivante<Apparence> {
  const especes = 'especes' in reglage ? reglage.especes : ['nains'];
  return {
    id: reglage.id ?? 'naissance-naine',
    type: 'apparences',
    label: 'Variante de naissance',
    forme: { id: idDeFixture('apparence', reglage.forme?.id ?? 'epee') },
    ...(especes && { especes: especes.map((e) => idDeFixture('species', e)) }),
    ...(reglage.classes && { classes: reglage.classes.map((c) => idDeFixture('classe', c)) }),
    ...(reglage.qualites && { qualites: reglage.qualites.map((q) => idDeFixture('quality', q)) }),
  };
}

export function poserVariantesDeNaissance(...variantes: EntreeVivante<Apparence>[]): void {
  catalogueInitial ??= apparences.slice();
  setDataset('apparences', [...catalogueInitial.filter((a) => !a.forme), ...variantes]);
}

export function restaurerApparencesDeNaissance(): void {
  if (!catalogueInitial) return;
  setDataset('apparences', catalogueInitial);
  catalogueInitial = undefined;
}

export function herosDeNaissance(speciesId = 'nains', careerId = 'soldat') {
  return createHero({ idNeuf: idsDeTest, speciesId, careerId, label: 'Porteur de naissance', seed: 3 });
}

/**
 * Le navire à ponts du livre de test (#5070) : une entrée déclarée, sous un id que seul porte le catalogue d'une suite,
 * absent de la base vivante et de l'index des ids. Ses ponts et l'empreinte de sa coque décident de sa pose
 * (`rectangleDesPonts`, `src/data/schemas/catalogue/poseDesPonts.ts`).
 */
import type { LivreDeTest } from '../data/schemas/catalogue/catalogueDeTest.testkit';
import type { SceneEntity } from './monde/scene';

export const NAVIRE = 'navire-a-ponts-du-livre-de-test';

type Vehicule = NonNullable<LivreDeTest['vehicles.json']>[number];

/** Un pont d'une rangée de `w` cases au glyphe `c`, sans arête. */
const pont = (w: number) => ['+' + ' +'.repeat(w), ' ' + 'c '.repeat(w), '+' + ' +'.repeat(w)].join('\n');

/** L'entrée du véhicule `id` sans ponts, à coque maritime d'empreinte 3. */
export const vehiculeDuLivreDeTest = (id: string): Vehicule => ({
  id, type: 'vehicles', label: id, source: { book: 'livre-du-navire-de-test', page: 1 },
  hull: { char: { endurance: 1, B: 1 }, bodyShape: 'vehicule', propulsion: 'maritime', footprint: 3 },
});

/** L'entrée du navire `NAVIRE` : un pont de 17 cases sur une coque d'empreinte 3, posé du bord de la carte quand
 *  le navire est en case 7 au cap O ou E. */
export const navireDuLivreDeTest = (): Vehicule => ({ ...vehiculeDuLivreDeTest(NAVIRE), ponts: [[pont(17)], { c: 0 }] });

/** L'entité `n` du navire au cap `facing`, en (10, 2), et le corps `corps`. */
export const navire = (facing: SceneEntity['facing'], corps: Partial<SceneEntity> = {}): SceneEntity =>
  ({ id: 'n', kind: 'personnage', pos: { x: 10, y: 2 }, vehicule: { id: NAVIRE }, facing, ...corps });

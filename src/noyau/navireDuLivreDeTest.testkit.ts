/**
 * Le navire à ponts du livre de test (#5070) : la caraque copiée sous un id que seul porte le catalogue d'une suite
 * (`catalogueAvec`), absent de la base vivante et de l'index des ids.
 */
import { catalogueDuProcessus } from '../data/catalogueDuProcessus';
import { garanti } from '../lib/garanti';
import type { SceneEntity } from './monde/scene';

export const NAVIRE = 'navire-a-ponts-du-livre-de-test';

/** La copie de l'entrée `id` des entrées `entrees` sous l'id `neuf`. */
export const copie = <E extends { id: string }>(entrees: readonly E[], id: string, neuf: string): E => ({ ...garanti(entrees.find((e) => e.id === id), id, 'entrée copiée'), id: neuf });

/** L'entrée du navire : la caraque du catalogue du processus, sous l'id `NAVIRE`. */
export const navireDuLivreDeTest = () => copie(catalogueDuProcessus()['vehicles.json'], 'caraque', NAVIRE);

/** L'entité `n` du navire au cap `facing`, en (10, 2), et le corps `corps`. */
export const navire = (facing: SceneEntity['facing'], corps: Partial<SceneEntity> = {}): SceneEntity =>
  ({ id: 'n', kind: 'personnage', pos: { x: 10, y: 2 }, vehicule: { id: NAVIRE }, facing, ...corps });

/**
 * IDENTITÉ d'une `ModLine` en test : son renvoi `ref` (catégorie + id STABLES de la règle ou de l'entité
 * qui octroie le modificateur), jamais son `label`, qui est de l'AFFICHAGE. Fiche
 * `user-doctrine-ids-stables-labels-affichage`, #1463 LD.2b.
 */
import type { CodexTarget } from './ruleRefs';
import { memeSource } from './suspension';
import type { ModLine } from './types';

/** La ligne porte-t-elle ce renvoi ? */
export const renvoieA = (ref: CodexTarget) => (m: ModLine): boolean => memeSource(m.ref, ref);

/** La ligne qui porte ce renvoi. */
export const ligneDe = (mods: readonly ModLine[] | undefined, ref: CodexTarget): ModLine | undefined => mods?.find(renvoieA(ref));

/** Les lignes qui portent ce renvoi, dans leur ordre. */
export const lignesDe = (mods: readonly ModLine[] | undefined, ref: CodexTarget): ModLine[] => mods?.filter(renvoieA(ref)) ?? [];

/**
 * Types canoniques de la plomberie des flux : tout module qui reçoit le couple (get, set) de son
 * propriétaire d'état les importe d'ici, typés sur `Jeu` (#2817 D5) ; l'adaptateur les paramètre sur son état
 * entier. `Set` accepte l'objet partiel ET la forme à updater fonctionnel, comme le `set` de Zustand.
 */
import type { Jeu } from './etat';

export type Get<E = Jeu> = () => E;
/** Les clés RÉSERVÉES : aucun flux ne les écrit par son patch. `journal` a pour écrivains `log`
 *  (`journal.ts`) et `startScene` (`entreeEnScene.ts`) (#319, #2724) ; `gameTime`, `avancerLHorloge`
 *  (`horloge.ts`, #668, #2817 D7). Tous passent par `SetDesClesReservees`, et le remplacement d'état par
 *  `RemplacerLEtat` (`src/state/store.ts`). */
export type CleReservee = 'journal' | 'gameTime';
/** Le patch d'un flux : aucune clé réservée n'y figure. */
export type PatchDeFlux<E = Jeu> = Partial<Omit<E, CleReservee>> & { [K in CleReservee]?: never };
/** Un patch ou un updater qui écrit une clé hors de `K` devient `never`, littéral ou non : le compilateur
 *  refuse alors l'appel (#2817 D5). */
type DansLEtat<P, K> = [Exclude<keyof P, K>] extends [never] ? unknown : never;
export type Set<E = Jeu> = <P extends PatchDeFlux<E>>(partial: (P | ((s: E) => P)) & NoInfer<DansLEtat<P, keyof PatchDeFlux<E>>>) => void;
/** Le `set` d'un écrivain d'une clé réservée : `Set`, plus les clés `CleReservee`. */
export type SetDesClesReservees<E = Jeu> = <P extends Partial<E>>(partial: (P | ((s: E) => P)) & NoInfer<DansLEtat<P, keyof E>>) => void;

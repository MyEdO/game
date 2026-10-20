/**
 * Types canoniques de la plomberie des flux : tout module qui reçoit le couple (get, set) de son
 * propriétaire d'état les importe d'ici, typés sur `Jeu` (#2817 D5) ; l'adaptateur les paramètre sur son état
 * entier. `Set` accepte l'objet partiel ET la forme à updater fonctionnel, comme le `set` de Zustand.
 */
import type { Jeu } from './etat';

export type Get<E = Jeu> = () => E;
/** Le patch d'un flux : `journal` n'y figure pas ; ses écrivains sont `log` (`journal.ts`), `startScene`
 *  (`entreeEnScene.ts`), par `SetDuJournal`, et le remplacement d'état (`RemplacerLEtat`, `src/state/store.ts`)
 *  (#319, #2724). */
export type PatchDeFlux<E = Jeu> = Partial<Omit<E, 'journal'>> & { journal?: never };
/** Un patch ou un updater qui écrit une clé hors de `K` devient `never`, littéral ou non : le compilateur
 *  refuse alors l'appel (#2817 D5). */
type DansLEtat<P, K> = [Exclude<keyof P, K>] extends [never] ? unknown : never;
export type Set<E = Jeu> = <P extends PatchDeFlux<E>>(partial: (P | ((s: E) => P)) & NoInfer<DansLEtat<P, keyof PatchDeFlux<E>>>) => void;
/** Le `set` d'un écrivain du journal : `Set`, plus le champ `journal`. */
export type SetDuJournal<E = Jeu> = <P extends Partial<E>>(partial: (P | ((s: E) => P)) & NoInfer<DansLEtat<P, keyof E>>) => void;

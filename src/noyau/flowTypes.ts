/**
 * Types canoniques de la plomberie des flux : tout module qui reçoit le couple (get, set) de son
 * propriétaire d'état les importe d'ici, typés sur `Jeu` (#2817 D5), le `get` sur `JeuDuNoyau` (#3370) ; l'adaptateur les paramètre sur son état
 * entier. `Set` accepte l'objet partiel ET la forme à updater fonctionnel, comme le `set` de Zustand.
 */
import type { Jeu } from './etat';
import type { JeuDuNoyau } from './machinerieDuNoyau';

/** Le `get` d'un flux du noyau : l'état, les verbes et la machinerie (`JeuDuNoyau`). Un hôte lit `Get<Jeu>`. */
export type Get<E = JeuDuNoyau> = () => E;
/** Les clés RÉSERVÉES : aucun flux ne les écrit par son patch. `journal` et `lignesAuJournal` ont pour écrivains
 *  `ecrireAuJournal` (`journal.ts`) et `lancerLaScene` (`entreeEnScene.ts`) (#319, #2724, #3009) ; `gameTime`,
 *  `avancerLHorloge` (`horloge.ts`, #668, #2817 D7) ; `prochainId`, `forgerUnId`, et `combatsOuverts`, `marquerUnCombatOuvert`
 *  (`idsDuMonde.ts`, #2907, #3009), que `lancerLaScene` garde. Tous passent par `SetDesClesReservees`, et le
 *  remplacement d'état par `RemplacerLEtat`. */
export type CleReservee = 'journal' | 'lignesAuJournal' | 'gameTime' | 'prochainId' | 'combatsOuverts';
/** Le patch d'un flux : aucune clé réservée n'y figure. */
export type PatchDeFlux<E = Jeu> = Partial<Omit<E, CleReservee>> & { [K in CleReservee]?: never };
/** Un patch ou un updater qui écrit une clé hors de `K` devient `never`, littéral ou non : le compilateur
 *  refuse alors l'appel (#2817 D5). */
type DansLEtat<P, K> = [Exclude<keyof P, K>] extends [never] ? unknown : never;
export type Set<E = Jeu> = <P extends PatchDeFlux<E>>(partial: (P | ((s: E) => P)) & NoInfer<DansLEtat<P, keyof PatchDeFlux<E>>>) => void;
/** Le `set` d'un écrivain d'une clé réservée : `Set`, plus les clés `CleReservee`. */
export type SetDesClesReservees<E = Jeu> = <P extends Partial<E>>(partial: (P | ((s: E) => P)) & NoInfer<DansLEtat<P, keyof E>>) => void;

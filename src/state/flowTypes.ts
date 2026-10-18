/**
 * Types canoniques de la plomberie des flux du store : tout module `state/*` qui reçoit le
 * couple (get, set) de Zustand les importe d'ici — fini les alias `Get`/`Set` redéclarés par
 * fichier (et les `set: any`). `Set` accepte l'objet partiel ET la forme à updater fonctionnel,
 * comme le `set` de Zustand. Import de TYPE seulement (pas de cycle d'exécution avec le store).
 */
import type { GameState } from './store';

export type Get = () => GameState;
/** Le patch d'un flux : `journal` n'y figure pas ; ses écrivains sont l'action `log` du store, `startScene` et
 *  le remplacement d'état (`RemplacerLEtat`) (#319, #2724). */
export type PatchDeFlux = Partial<Omit<GameState, 'journal'>> & { journal?: never };
export type Set = (partial: PatchDeFlux | ((s: GameState) => PatchDeFlux)) => void;
/** Le `set` brut du store, réservé au REMPLACEMENT d'état (sauvegarde chargée, snapshot de l'hôte), qui
 *  porte `journal` avec le reste (#2724). */
export type RemplacerLEtat = (etat: Partial<GameState>) => void;

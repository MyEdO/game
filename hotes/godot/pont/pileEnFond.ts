/**
 * LA PILE DES COUCHES RÉSOLUE HORS DU FIL DE L'IMAGE (#3842), par la page : un fil de fond (`pile.worker.ts`), créé à la
 * première demande, les résout l'une après l'autre.
 */
import FilDeLaPile from './pile.worker?worker&inline';

let fil: Worker | null = null;
const attentes: ((reponse: string) => void)[] = [];

/** Résout la pile `demande` (`PileDemandee`, en JSON) ; `rendre` reçoit sa réponse (`PileResolue`, en JSON). */
export function resoudreLaPile(demande: string, rendre: (reponse: string) => void): void {
  if (!fil) {
    fil = new FilDeLaPile();
    fil.addEventListener('message', (message: MessageEvent<string>) => attentes.shift()!(message.data));
  }
  attentes.push(rendre);
  fil.postMessage(demande);
}

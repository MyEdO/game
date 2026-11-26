/**
 * LES SORTIES D'ÉTAT D'UNE FIXTURE (#4993) : le test déclare `EtatData.aLaSortie` de chaque État ; aucun État ne garde
 * la sortie que la donnée livrée lui déclare.
 */
import { poserLeDataset } from '../data/datasetDeTest.testkit';
import type { GameOp } from './ops';

type PoseDeSortie = Extract<GameOp, { op: 'condition' }>;

/** Pose, pour chaque test du fichier, les sorties `sorties` (id d'État → poses) et elles seules. */
export function declarerLesSorties(sorties: Readonly<Record<string, readonly PoseDeSortie[]>>): void {
  poserLeDataset('etats', (livre) => livre.map(({ aLaSortie: _, ...e }) => (sorties[e.id] ? { ...e, aLaSortie: [...sorties[e.id]] } : e)));
}

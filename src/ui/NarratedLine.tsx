import { narrateEvent } from '../gameIso/combatNarration';
import type { CombatEvent } from '../state/combatLog';
import { Icon } from './Icon';
import { TeamSegments } from './TeamSegments';

/** Forme minimale d'un combattant pour colorer les noms par camp (id/label/kind). */
interface ComLite { id: string; label: string; kind: string; }

/** Icône + texte coloré par camp d'un événement narré — cœur du JOURNAL (`LogDrawer`). L'issue d'une
 *  modale de jet, elle, est une DONNÉE (`RecapLine`) rendue par `RecapLineRow` (#1078). */
export function NarratedSegments({ event, combatants }: { event: CombatEvent; combatants?: ComLite[] }) {
  const n = narrateEvent(event, combatants ?? []);
  return (
    <>
      <span className="jr-ic"><Icon id={n.icon} size="sm" /></span>
      <div className="jr-tx"><TeamSegments segments={n.segments} /></div>
    </>
  );
}

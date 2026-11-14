import { Icon } from './Icon';
import { refLabel } from '../data';
import type { MenaceId } from '../engine/menace';

/**
 * Bouton « Résistance (Menace) » (LDB 10 l.1016-1020) : auto-succès du premier Test pour résister à
 * la menace spécifiée (DR = Bonus d'Endurance), UNE fois par spec et par séance de jeu. Pendant UI du
 * verbe `resister` de la fabrique rollFlow — frère de `ResilienceButton` (même mécanisme, autre
 * ressource). Affiché seulement quand le talent est DISPONIBLE (spec couvrant la menace du Test, non
 * consommée) ET que l'issue n'est pas déjà favorable (`show`). Le libellé affiché vient du CATALOGUE
 * (`refLabel` sur la spec du talent) — `menace` est un id stable, jamais un texte d'écran.
 */
export function ResistButton({ menace, show, onResist }: { menace: MenaceId; show: boolean; onResist: () => void }) {
  if (!show) return null;
  const nom = refLabel('talents', { id: 'resistance', spec: menace });
  return (
    <button
      className="btn btn-resource"
      onClick={onResist}
      title={`${nom} : réussit automatiquement ce Test (DR = Bonus d'Endurance) — une fois par séance de jeu`}
    >
      <Icon id="action/se-defendre" size="sm" /> {nom}
    </button>
  );
}

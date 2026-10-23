import { Icon } from './Icon';
import type { IconId } from './icons';

/**
 * Mini-chip d'une conséquence mécanique NON-État : « −1 Activité », « Revenus +20 % »…
 * Icône du registre + libellé en clair. Complète StateChips/EffectChips (réservés aux États
 * réels) dans la MÊME famille visuelle `.fx-chip` — les ops sont structurées, ceci n'est qu'un
 * RENDU (aucun parsing de texte).
 */
export function FxChip({ icon, label }: { icon: IconId; label: string }) {
  return (
    <span className="fx-chip">
      <Icon id={icon} size="sm" />
      <span className="fx-chip-label">{label}</span>
    </span>
  );
}

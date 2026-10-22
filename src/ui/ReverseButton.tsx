import { Icon } from './Icon';
import { fmtD100 } from './Dice';
import { t } from '../i18n';

/**
 * Bouton « Inverser » (LDB 23 l.209 « Entraînement au Combat » / l.218 « Observer une cible » ; LDB 10,
 * Talents Sociable/Studieux/Lecture rapide/Pharmacologie/Chat de gouttière/Noctambule/Pansement de
 * fortune/Pilote : « vous pouvez inverser un Test raté ») : intervertit les chiffres du d100 d'un jet —
 * un CHOIX du joueur, jamais un automatisme (#558). Pendant UI du verbe `reverse` de la fabrique
 * rollFlow — frère de `ResistButton`/`ResilienceButton`. Affiché quand une voie APPLICABLE existe
 * (`show` — Talent : convertirait l'échec en réussite ; jeton : libre, réussi ou raté). `preview` rend
 * l'issue LISIBLE avant le clic (dé renversé + DR/succès, `reversePreview`) — le jeton peut dégrader
 * un succès existant, le joueur voit le résultat avant de choisir.
 */
export function ReverseButton({
  show, onReverse, preview,
}: {
  show: boolean;
  onReverse: () => void;
  preview?: { roll: number; sl: number; success: boolean } | null;
}) {
  if (!show) return null;
  const previewLabel = preview
    ? ` → ${fmtD100(preview.roll)} (${preview.success ? 'RS' : 'échec'} ${preview.sl >= 0 ? '+' : ''}${preview.sl})`
    : '';
  return (
    <button
      className="btn btn-resource"
      onClick={onReverse}
      title="Inverser ce Test : intervertit les chiffres du d100"
    >
      <Icon id="nav/dice" size="sm" /> {t('verbe.reverse')}{previewLabel}
    </button>
  );
}

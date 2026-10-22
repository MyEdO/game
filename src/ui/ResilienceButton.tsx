import { Icon } from './Icon';
import { CodexRef } from './compendium/CodexRef';
import { t } from '../i18n';

/**
 * Bouton « Je ne faillirai pas ! » (Résilience, LDB 17 l.68) : sacrifie un Point de Résilience
 * pour une réussite garantie (Test opposé : l'emporte avec DR +1). Affiché uniquement quand il
 * reste de la Résilience ET que l'issue est défavorable (`show`).
 *
 * MÊME forme que ses sœurs de pool (Chance, Détermination) : « ressource ×N restants », et le BOUTON
 * est l'affordance de sa RÈGLE — englobé par `CodexRef wrap`, qui rend le texte au survol/focus sans
 * intercepter le clic (#1078). La règle vit sur l'ENTITÉ qui la porte (amendement A, #1117) : la FICHE
 * est `characteristics/resilience` et son `instance` NOMME la dépense — le popover titre « Je ne
 * faillirai pas ! » au-dessus de « Résilience », dont la section « Dépenses » porte le verbatim.
 */
export function ResilienceButton({ resilience, show, onForce }: { resilience: number; show: boolean; onForce: () => void }) {
  if (resilience <= 0 || !show) return null;
  const label = <><Icon id="fire/flame" size="sm" /> {t('verbe.forceSuccess')} ×{resilience}</>;
  return (
    <CodexRef category="characteristics" id="resilience" label="Résilience" instance="Je ne faillirai pas !" wrap>
      <button
        className="btn btn-resource"
        onClick={onForce}
        title="« Je ne faillirai pas ! » : sacrifie un Point de Résilience pour une réussite garantie (avant le jet ou après un échec)"
      >
        {label}
      </button>
    </CodexRef>
  );
}

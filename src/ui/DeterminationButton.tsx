import { useState } from 'react';
import type { Combatant } from '../engine/types';
import { conditionMeta } from '../gameIso/effectIcons';
import { conditionLabel } from '../data';
import { Icon } from './Icon';
import { CodexRef } from './compendium/CodexRef';
import { GatedAction } from './GatedAction';
import { refusDeDetermination } from '../engine/conditions';
import { RULE_REF } from '../engine/ruleRefs';
import { t } from '../i18n';

/**
 * Détermination en modale de jet (LDB 17 l.61) : AVANT de lancer, tout combattant porteur d'États
 * (le panneau pré-rempli recalcule alors ses modificateurs). Bouton « Détermination ×n » → mini-picker
 * des États présents. Existence et refus par État : verdict `refusDeDetermination`, celui du gate
 * `determination-en-reserve` et du geste `depenserLaDetermination`.
 */
export function DeterminationButton({ combatant, onSpend }: { combatant?: Combatant | null; onSpend: (condition: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!combatant || refusDeDetermination(combatant) || combatant.conditions.length === 0) return null;
  const resolve = combatant.resolve ?? 0;
  const conds = combatant.conditions;
  return (
    <>
      <CodexRef category={RULE_REF.determination.category} id={RULE_REF.determination.id} label="Détermination" wrap sourdine={open}>
        <button
          className="btn btn-resource"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon id="ressource/determination" size="sm" /> {t('verbe.depenserLaDetermination')} ×{resolve}
        </button>
      </CodexRef>
      {open &&
        conds.map((c) => {
          // Un État que rien ne lève (LDB 20 l.188) reste OFFERT et porte sa raison au survol/focus —
          // jamais retiré en silence, jamais un bouton muet (arbitrage user 2026-08-24).
          const refus = refusDeDetermination(combatant, c.id);
          return (
            <GatedAction
              key={c.id}
              id={`determination-${c.id}`}
              enabled={!refus}
              reason={refus ?? ''}
              primary={false}
              btnClassName="btn-resource"
              ariaLabel={`Retirer 1 pion ${conditionLabel(c.id)}`}
              onClick={() => {
                setOpen(false);
                onSpend(c.id);
              }}
              label={
                <>
                  <Icon id={conditionMeta(c.id).icon} size="sm" /> {conditionLabel(c.id)}
                  {c.value > 1 ? ` ×${c.value}` : ''}
                </>
              }
            />
          );
        })}
    </>
  );
}

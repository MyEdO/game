import { useState } from 'react';
import type { Combatant } from '../engine/types';
import { conditionMeta } from '../gameIso/effectIcons';
import { conditionLabel } from '../data';
import { Icon } from './Icon';
import { CodexRef } from './compendium/CodexRef';
import { GatedAction } from './GatedAction';
import { raisonRefusDetermination } from '../engine/conditions';
import { RULE_REF } from '../engine/ruleRefs';

/**
 * Détermination en modale de jet (LDB 17 l.59-61) : AVANT de lancer, un héros qui subit des
 * États négatifs (À Terre, Sonné, Aveuglé… → malus au jet) peut en retirer un — le panneau
 * pré-rempli recalcule alors ses modificateurs. Bouton « Détermination ×n » → mini-picker des
 * États présents (même règle que `battleSpendResolve` de la barre d'action).
 */
export function DeterminationButton({ combatant, onSpend }: { combatant?: Combatant | null; onSpend: (condition: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!combatant || combatant.kind !== 'hero') return null;
  const resolve = combatant.resolve ?? 0;
  const conds = combatant.conditions ?? [];
  if (resolve <= 0 || conds.length === 0) return null;
  return (
    <>
      <CodexRef category={RULE_REF.determination.category} id={RULE_REF.determination.id} label="Détermination" wrap suppressPopover={open}>
        <button
          className="btn btn-resource"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon id="resource/resolve" size="sm" /> Détermination ×{resolve}
        </button>
      </CodexRef>
      {open &&
        conds.map((c) => {
          // Un État que rien ne lève (LDB 20 l.188) reste OFFERT et porte sa raison au survol/focus —
          // jamais retiré en silence, jamais un bouton muet (arbitrage user 2026-08-24).
          const refus = raisonRefusDetermination(combatant, c.id);
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

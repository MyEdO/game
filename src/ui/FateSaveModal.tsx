import { useGame } from '../state/store';
import { Modal } from './Modal';
import { OptionChooser } from './OptionChooser';
import { Icon } from './Icon';
import { Stack } from './Layout';
import type { IconId } from './icons';
import { flowStakeRef, type FlowStakeId } from '../data';
import { StakeNote, StakeRule, stakeRuleOf } from './StakeNote';
import { fateSaveOptions, type FateSaveOption } from '../engine/fortune';

const OPTION: Record<FateSaveOption, { icon: IconId; label: string }> = {
  survive: { icon: 'resource/lifeline', label: 'Meurs un autre jour' },
  negate: { icon: 'resource/fortune', label: 'Comment ça a pu rater ?' },
};

/** Enjeu servi par chaque fenêtre du sauvetage par le Destin. */
const FATE_SAVE_STAKE: Record<FateSaveOption | 'choice', FlowStakeId> = { choice: 'fate-save-choice', survive: 'fate-save-survive', negate: 'fate-save-negate' };

/**
 * Sauvetage par le Destin : LDB 17 l.29 ; options l.31 (`survive`) et l.32 (`negate`), offertes par
 * `fateSaveOptions`, que le groupe de choix ET l'enjeu lisent (chaque option porte sa note, puis celle
 * du refus, `fate-save-choice`, dont la règle est aussi celle du titre).
 * Pied : « Accepter le sort », la sortie de l'état courant (`docs/charte-ui.md`, `.btn-ghost` et
 * `.btn.danger`).
 */
export function FateSaveModal() {
  const p = useGame((s) => s.pendingFateSave);
  const battle = useGame((s) => s.battle);
  const negate = useGame((s) => s.fateNegate);
  const survive = useGame((s) => s.fateSurvive);
  const accept = useGame((s) => s.fateAccept);
  if (!p || !battle) return null;
  const hero = battle.combatants.find((c) => c.id === p.heroId);
  if (!hero) return null;
  const fate = hero.fate ?? 0;
  const offre = fateSaveOptions(p.source);
  const choisir: Record<FateSaveOption, () => void> = { survive, negate };
  const refus = flowStakeRef(FATE_SAVE_STAKE.choice);

  return (
    <Modal
      title={<><Icon id="resource/fate" size="sm" /> Le Destin <StakeRule rule={stakeRuleOf(refus)} /></>}
      subject={hero}
      champ
      footer={<button type="button" className="btn btn-ghost danger" onClick={accept} title="Le héros meurt"><Icon id="journal/death" size="sm" /> Accepter le sort</button>}
    >
      <Stack gap="md">
        <p className="modal-log">
          {p.source === 'hit' ? 'Un coup fatal le frappe !' : 'Ses blessures l’emportent…'} Sacrifier un Point de Destin ?
          (il en reste {fate})
        </p>
        <div className="rm-options">
          <OptionChooser
            layout="grid"
            options={offre.map((o) => ({
              key: o,
              label: <><Icon id={OPTION[o].icon} size="sm" /> {OPTION[o].label}</>,
              note: <StakeNote stake={flowStakeRef(FATE_SAVE_STAKE[o])} />,
              onSelect: choisir[o],
            }))}
          />
        </div>
        <StakeNote stake={refus} />
      </Stack>
    </Modal>
  );
}

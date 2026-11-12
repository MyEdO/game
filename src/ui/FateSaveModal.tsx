import { useGame } from '../state/store';
import { Modal } from './Modal';
import { OptionChooser } from './OptionChooser';
import { Icon } from './Icon';
import { Stack } from './Layout';
import type { IconId } from '../data/icons';
import { flowStakeRef, type FlowStakeId } from '../data';
import { StakeNote, StakeRule, stakeRuleOf } from './StakeNote';
import { fateSaveOptions, type FateSaveOption } from '../engine/fortune';
import { porteurParId } from '../noyau/monde/combatants';

const OPTION: Record<FateSaveOption, { icon: IconId; label: string }> = {
  survivre: { icon: 'ressource/survivre', label: 'Meurs un autre jour' },
  eviter: { icon: 'ressource/chance', label: 'Comment ça a pu rater ?' },
};

/** Enjeu servi par chaque fenêtre du sauvetage par le Destin. */
const FATE_SAVE_STAKE: Record<FateSaveOption | 'choice', FlowStakeId> = { choice: 'sauvetage-destin-choix', survivre: 'sauvetage-destin-survivre', eviter: 'sauvetage-destin-annuler' };

/**
 * Sauvetage par le Destin : LDB 17 l.29 ; options l.31 (`survivre`) et l.32 (`eviter`), offertes par
 * `fateSaveOptions`, que le groupe de choix ET l'enjeu lisent (chaque option porte sa note, puis celle
 * du refus, `sauvetage-destin-choix`, dont la règle est aussi celle du titre).
 * Pied : « Accepter le sort », la sortie de l'état courant (`docs/charte-ui.md`, `.btn-ghost` et
 * `.btn.danger`).
 */
export function FateSaveModal() {
  const p = useGame((s) => s.pendingFateSave);
  const hero = useGame((s) => (s.pendingFateSave ? porteurParId(s, s.pendingFateSave.heroId) : undefined));
  const choisirLIssue = useGame((s) => s.fenetreChoisir);
  if (!p || !hero) return null;
  const fate = hero.fate ?? 0;
  const offre = fateSaveOptions(p.source);
  const choisir = (issue: FateSaveOption | 'accepter') => () => choisirLIssue('destin', 'issue', issue);
  const refus = flowStakeRef(FATE_SAVE_STAKE.choice);

  return (
    <Modal
      title={<><Icon id="ressource/destin" size="sm" /> Le Destin <StakeRule rule={stakeRuleOf(refus)} /></>}
      subject={hero}
      champ
      footer={<button type="button" className="btn btn-ghost danger" onClick={choisir('accepter')} title="Le héros meurt"><Icon id="journal/mort" size="sm" /> Accepter le sort</button>}
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
              onSelect: choisir(o),
            }))}
          />
        </div>
        <StakeNote stake={refus} />
      </Stack>
    </Modal>
  );
}

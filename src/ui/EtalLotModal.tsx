import { useGame } from '../state/store';
import { RollShell, type RollAction } from './RollShell';
import { tableRow, type BuiltRollRow } from './rollRowBuild';
import { Icon } from './Icon';
import { flowStakeRef } from '../data';

/**
 * FENÊTRE DE LOT d'un étal (#1426) — les tirages d'ouverture d'un marché/port, tous ensemble, chacun
 * posable, validés d'un bloc.
 *
 * Ce n'est PAS une coquille de plus : c'est `RollShell` en mode MULTI (le mono = N=1, plusieurs
 * rangées), servie par le flux `etalLot` de la fabrique — le sélecteur de dé de chaque rangée est
 * dérivé par la coquille elle-même (`flowKey` + `key`), au site UNIQUE de la pose
 * (`ui/forcedDieRow.ts`). Aucun cycle d'influence : on ne dépense pas de Chance sur la marchandise
 * d'un étal, on pose son dé ou on le subit.
 *
 * Les rangées n'ont AUCUN acteur — ce sont des dés du monde. D'où `tableRow` (la rangée
 * porte-sélecteur, déjà employée par les étapes à table) plutôt que la rangée-participant, qui exige
 * un portrait.
 */
export function EtalLotModal() {
  const p = useGame((s) => s.pendingEtalLot);
  const confirm = useGame((s) => s.etalLotConfirm);
  const cancel = useGame((s) => s.etalLotCancel);
  if (!p) return null;

  const rows: BuiltRollRow[] = p.participants.map((r) => tableRow({
    key: r.id,
    row: { pending: { label: r.label, base: r.value, target: r.max } },
  }));

  const actions: RollAction[] = [
    // Les DEUX gestes mènent au même dénouement : un étal existe de toute façon. « Laisser le hasard »
    // ne l'annule pas, il le prend tel qu'il est tombé — d'où un libellé qui ne promet pas l'inverse.
    { key: 'cancel', label: 'Laisser le hasard', onClick: cancel, when: 'always' },
    { key: 'confirm', label: 'Ouvrir l’étal', onClick: confirm, when: 'always' },
  ];

  return (
    <RollShell
      flowKey="etalLot"
      title={<><Icon id="nav/dice" size="sm" /> {p.label}</>}
      instruction="Les dés de l’étal sont tombés — posez ceux que vous voulez fixer, puis ouvrez."
      rows={rows}
      stake={flowStakeRef('etal-lot')}
      rolled
      actions={actions}
      onCancel={cancel}
    />
  );
}

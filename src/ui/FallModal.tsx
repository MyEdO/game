import { useGame } from '../state/store';
import { flowStakeRef, type FlowStakeId } from '../data';
import type { PendingFall } from '../state/pendings';
import { testValue } from '../engine/skills';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { OptionChooser } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { Icon } from './Icon';
import { resultLines, freeCons } from '../state/rollSeam';

/** Enjeu servi par chaque fenêtre de la chute. */
const FALL_STAKE: Record<PendingFall['phase'], FlowStakeId> = { choice: 'fall-choice', roll: 'fall-roll' };

/**
 * Modale de Chute VOLONTAIRE (LDB 15 l.82) : le pré-jet est le CHOIX RAW « vous pouvez tenter un Test
 * d'Athlétisme » — `OptionChooser` en grille (Sauter directement / Tenter le Test), patron `ShantyModal` (menu
 * pré-jet). Choisir « Sauter » résout IMMÉDIATEMENT (`fallChoose(false)`, hors modale) ; choisir
 * « Tenter » ouvre le jet (Lancer → Chance/Pacte/Résilience → Appliquer, patron `RunModal`).
 */
export function FallModal() {
  const p = useGame((s) => s.pendingFall);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.fallRoll);
  const reroll = useGame((s) => s.fallReroll);
  const bonusSL = useGame((s) => s.fallBonusSL);
  const darkPact = useGame((s) => s.fallDarkPact);
  const force = useGame((s) => s.fallForceSuccess);
  const confirm = useGame((s) => s.fallConfirm);
  const cancel = useGame((s) => s.fallCancel);
  const choose = useGame((s) => s.fallChoose);
  if (!p) return null;
  const c = (battle?.combatants ?? party).find((x) => x.id === p.combatantId);
  if (!c) return null;

  // La PHASE est un champ d'ÉTAT du pending (#1117) — la fenêtre la LIT, elle ne la déduit pas.
  if (p.phase === 'choice') {
    return (
      <RollShell
        etape={p.phase}
        flowKey="fall"
        stake={flowStakeRef(FALL_STAKE[p.phase], { values: { metres: p.metres } })}
        title={<><Icon id="melee/flee" size="sm" /> Chute volontaire</>}
        subtitle={<><strong>{c.label}</strong> se tient au bord d'un dénivelé de {p.metres} m</>}
        rows={[]}
        rolled={false}
        setup={
          <OptionChooser
            layout="grid"
            options={[
              { key: 'jump', label: `Sauter (chute pleine, ${p.metres} m)`, onSelect: () => choose(false) },
              { key: 'attempt', label: "Tenter un Test d'Athlétisme", primary: true, onSelect: () => choose(true) },
            ]}
          />
        }
        actions={[{ key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' }]}
        onCancel={cancel}
      />
    );
  }

  const r = p.result;
  const rolled = !!r;
  const actorRow: BuiltRollRow = buildRollRow({
    actor: c,
    row: {
      combatant: c,
      d: r ? testBreakdown('Athlétisme', testValue(c, 'athletisme'), { roll: r.roll, target: r.target, sl: r.dr, success: r.success }, 'accessible') : undefined,
      pending: testPending('Athlétisme', testValue(c, 'athletisme'), undefined, 'accessible'),
    },
    onRoll: roll,
    rerolled: !!p.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      etape={p.phase}
      flowKey="fall"
      stake={flowStakeRef(FALL_STAKE[p.phase], { values: { metres: p.metres } })}
      title={<><Icon id="melee/flee" size="sm" /> Chute volontaire</>}
      /* Z1 : acteur + la SITUATION que rien d'autre ne porte (la hauteur). La Compétence est le label
         de la ligne et le « +20 » sa Difficulté (`accessible`, `.rm-roll-diff` #1072) — pas ici. */
      subtitle={<><strong>{c.label}</strong> — dénivelé de {p.metres} m</>}
      rows={[actorRow]}
      rolled={rolled}
      outcome={r
        ? resultLines(freeCons([r.effectiveMetres <= 0
            ? 'La chute est amortie : aucun Dégât.'
            : `${r.effectiveMetres} m de chute (réduite de ${Math.max(0, p.metres - r.effectiveMetres)} m).`]))
        : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}

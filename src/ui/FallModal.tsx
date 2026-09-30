import { useGame } from '../state/store';
import { flowStakeRef, type FlowStakeId } from '../data';
import type { TombantParticipant } from '../state/pendings';
import { metresRetenus, phaseDeChute } from '../state/fallMove';
import { testValue } from '../engine/skills';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { useOwns } from './ownership';
import { Icon } from './Icon';
import { resultLine, freeCons } from '../state/rollSeam';
import { refusDuTestDeChute, refusDeLaSuspension } from '../state/gesteDArete';
import { t } from '../i18n';

/** Enjeu servi par chaque phase de la chute. */
const FALL_STAKE: Record<'choice' | 'roll', FlowStakeId> = { choice: 'fall-choice', roll: 'fall-roll' };

/**
 * Modale de Chute VOLONTAIRE (LDB 15 l.82 ; EDO 01 l.231) : une rangée par TOMBANT, patron de la rangée
 * de Contre-sort (`CastModal`). Chaque rangée DÉCLARE depuis le siège de son héros (Sauter / Tenter le
 * Test d'Athlétisme) ; une rangée qui saute ne lance rien. Les jets s'ouvrent quand toutes ont déclaré
 * (`phaseDeChute`), puis « Appliquer » résout l'étape entière.
 */
export function FallModal() {
  const p = useGame((s) => s.pendingFall);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const owns = useOwns();
  const roll = useGame((s) => s.fallRoll);
  const reroll = useGame((s) => s.fallReroll);
  const bonusSL = useGame((s) => s.fallBonusSL);
  const darkPact = useGame((s) => s.fallDarkPact);
  const force = useGame((s) => s.fallForceSuccess);
  const confirm = useGame((s) => s.fallConfirm);
  const cancel = useGame((s) => s.fallCancel);
  const choose = useGame((s) => s.fallChoose);
  if (!p) return null;
  const pool = battle?.combatants ?? party;
  const phase = phaseDeChute(p);

  const rangee = (part: TombantParticipant): BuiltRollRow[] => {
    const c = pool.find((x) => x.id === part.id);
    if (!c) return [];
    const m = metresRetenus(p, part);
    const owned = owns(part.id) && !!part.interactive;
    const r = part.result;
    const val = testValue(c, 'athletisme');
    // La rangée DIT sa situation : attente d'un autre siège, chute pleine, ou l'issue du Test.
    const situation = part.attempt === null
      ? (owned ? null : `en attente de la déclaration de ${c.label}`)
      : part.attempt === false
        ? (!part.interactive ? `n’est pas debout — chute pleine de ${m} m, sans Test` : part.suspendre ? `se suspend puis se lâche, sans Test — chute de ${m} m` : `saute sans Test — chute pleine de ${m} m`)
        : r
          ? (r.effectiveMetres <= 0 ? 'La chute est amortie : aucun Dégât.' : `${r.effectiveMetres} m de chute (réduite de ${Math.max(0, m - r.effectiveMetres)} m).`)
          : null;
    const note = situation ? <div className="hint">{resultLine(freeCons([situation]))}</div> : null;
    const declarer = owned && part.attempt === null;
    const refusTest = declarer ? refusDuTestDeChute(useGame.getState(), part.id) : null;
    const refusSusp = declarer && p.suspendu !== undefined ? refusDeLaSuspension(useGame.getState(), part.id) : null;
    const refusDe = (v: typeof refusTest) => (v ? { refus: t(v.refus, v.vars) } : {});
    // Axe HAUTEUR (EDO 01 l.231) : offert par la croisée, déclaré avec le Test, dans la même rangée.
    const suspensions = p.suspendu !== undefined
      ? [
        { key: 'suspendre-jump', label: `Se suspendre, puis se lâcher (chute de ${p.suspendu} m)`, ...refusDe(refusSusp) },
        { key: 'suspendre-attempt', label: `Se suspendre, puis tenter un Test d'Athlétisme (${p.suspendu} m)`, ...refusDe(refusSusp ?? refusTest) },
      ]
      : [];
    return [buildRollRow({
      actor: c,
      row: {
        combatant: c,
        ...(r
          ? { d: testBreakdown('Athlétisme', val, { roll: r.roll, target: r.target, sl: r.dr, success: r.success }, 'accessible') }
          : { pending: testPending('Athlétisme', val, undefined, 'accessible') }),
        note,
      },
      ...(part.attempt === true ? { onRoll: () => roll(part.id) } : {}),
      rerolled: !!part.rerolled,
      onReroll: () => reroll(part.id),
      onBonusSL: () => bonusSL(part.id),
      onDarkPact: () => darkPact(part.id),
      onForce: () => force(part.id),
    }, {
      key: part.id,
      interactive: owned && part.attempt !== false,
      ...(part.attempt === true && phase === 'choice' ? { rollBlocked: 'En attente des déclarations de la fenêtre' } : {}),
      ...(owned && part.attempt === null
        ? {
          declare: {
            onChoose: (k: string) => choose(part.id, k.endsWith('attempt'), p.suspendu !== undefined ? k.startsWith('suspendre') : undefined),
            options: [
              { key: 'jump', label: `Sauter (chute pleine, ${m} m)` },
              { key: 'attempt', label: "Tenter un Test d'Athlétisme", ...refusDe(refusTest) },
              ...suspensions,
            ],
          },
        }
        : {}),
    })];
  };
  const rows = p.participants.flatMap(rangee);
  const aLancer = p.participants.filter((x) => x.attempt === true);
  const rolled = phase === 'roll' && aLancer.every((x) => !!x.result);
  const unJet = aLancer.some((x) => !!x.result);

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      etape={phase}
      flowKey="fall"
      stake={flowStakeRef(FALL_STAKE[phase], { values: { metres: p.metres } })}
      title={<><Icon id="melee/flee" size="sm" /> Chute volontaire</>}
      /* Z1 : la SITUATION que rien d'autre ne porte (la hauteur). La Compétence est le label de la ligne
         et le « +20 » sa Difficulté (`accessible`, `.rm-roll-diff` #1072) — pas ici. */
      subtitle={<>Dénivelé de {p.metres} m{p.suspendu !== undefined ? ` · ${p.suspendu} m en se suspendant d’abord` : ''}</>}
      rows={rows}
      rolled={rolled}
      actions={actions}
      onCancel={unJet ? undefined : cancel}
    />
  );
}

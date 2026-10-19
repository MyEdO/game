import { useGame, type GameState } from '../state/store';
import { useShallow } from 'zustand/react/shallow';
import { flowStakeRef, refLabel, type FlowStakeId } from '../data';
import type { TombantParticipant } from '../noyau/pendings';
import { metresRetenus, phaseDeChute } from '../state/fallMove';
import { valeurDecomposee } from '../engine/skills';
import { cibleMesuree } from '../engine/tests';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { useOwns } from './ownership';
import { Icon } from './Icon';
import { resultLine, freeCons } from '../noyau/rollSeam';
import { refusDuTestDeChute, refusDeLaSuspension, type RefusGeste } from '../state/gesteDArete';
import type { RollSegOption } from './OptionChooser';
import { t } from '../i18n';

/** Enjeu servi par chaque phase de la chute. */
const FALL_STAKE: Record<'choice' | 'roll', FlowStakeId> = { choice: 'fall-choice', roll: 'fall-roll' };

/** Ce qu'une option de la rangée DÉCLARE à `fallChoose` : le choix lit cette donnée, jamais sa clé. */
type DeclarationDeChute = { attempt: boolean; suspendre?: boolean };

/** Refus TRADUIT de chaque tombant qui doit encore déclarer — valeurs chaînes, stables pour `useShallow`. */
function refusParTombant(s: GameState, lire: (s: GameState, id: string) => RefusGeste | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of s.pendingFall?.participants ?? []) {
    if (!part.interactive || part.attempt !== null) continue;
    const v = lire(s, part.id);
    if (v) out[part.id] = t(v.refus, v.vars);
  }
  return out;
}
const refusDesTests = (s: GameState) => refusParTombant(s, refusDuTestDeChute);
const refusDesSuspensions = (s: GameState) => (s.pendingFall?.suspendu !== undefined ? refusParTombant(s, refusDeLaSuspension) : {});

/**
 * Modale de Chute VOLONTAIRE (LDB 15 l.82 ; EDO 01 l.231) : une rangée par TOMBANT, patron de la rangée
 * de Contre-sort (`CastModal`). Chaque rangée DÉCLARE depuis le siège de son héros (Sauter / Tenter le
 * Test) ; une rangée qui saute ne lance rien. Les jets s'ouvrent quand toutes ont déclaré
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
  const refusTests = useGame(useShallow(refusDesTests));
  const refusSuspensions = useGame(useShallow(refusDesSuspensions));
  if (!p) return null;
  const pool = battle?.combatants ?? party;
  const phase = phaseDeChute(p);
  const competence = refLabel('skills', p.test.skill);

  const rangee = (part: TombantParticipant): BuiltRollRow[] => {
    const c = pool.find((x) => x.id === part.id);
    if (!c) return [];
    const m = metresRetenus(p, part);
    const owned = owns(part.id) && !!part.interactive;
    const r = part.result;
    const { base, mods } = valeurDecomposee(c, p.test);
    // La rangée DIT sa situation : attente d'un autre siège, sa déclaration, ou l'issue du Test.
    const situation = part.attempt === null
      ? (owned ? null : t('declaration.attente', { name: c.label }))
      : part.attempt === false
        ? t(!part.interactive ? 'fall.situation.nonDebout' : part.suspendre ? 'fall.situation.suspendSansTest' : 'fall.situation.sauteSansTest', { metres: m })
        : r
          ? (r.effectiveMetres <= 0 ? t('fall.situation.amortie') : t('fall.situation.reduite', { metres: r.effectiveMetres, reduction: Math.max(0, m - r.effectiveMetres) }))
          : t(part.suspendre ? 'fall.situation.suspendTente' : 'fall.situation.tente', { metres: m });
    const note = situation ? <div className="hint">{resultLine(freeCons([situation]))}</div> : null;
    const refusTest = refusTests[part.id];
    const refusSusp = refusSuspensions[part.id];
    const refusDe = (v: string | undefined) => (v ? { refus: v } : {});
    // Axe HAUTEUR (EDO 01 l.231) : offert par la croisée, déclaré avec le Test, dans la même rangée.
    const suspendu = p.suspendu;
    const offerte = suspendu !== undefined;
    const declarations: { option: RollSegOption; declaration: DeclarationDeChute }[] = [
      { option: { key: 'jump', label: t('fall.option.sauter', { metres: m }) }, declaration: { attempt: false, ...(offerte ? { suspendre: false } : {}) } },
      { option: { key: 'attempt', label: t('fall.option.tenter'), ...refusDe(refusTest) }, declaration: { attempt: true, ...(offerte ? { suspendre: false } : {}) } },
      ...(suspendu !== undefined
        ? [
          { option: { key: 'suspendre-jump', label: t('fall.option.suspendreSauter', { metres: suspendu }), ...refusDe(refusSusp) }, declaration: { attempt: false, suspendre: true } },
          { option: { key: 'suspendre-attempt', label: t('fall.option.suspendreTenter', { metres: suspendu }), ...refusDe(refusSusp ?? refusTest) }, declaration: { attempt: true, suspendre: true } },
        ]
        : []),
    ];
    return [buildRollRow({
      actor: c,
      row: {
        combatant: c,
        // Une rangée déclarée SANS Test (LDB 15 l.82) n'a aucune ligne de jet.
        ...(r
          ? { d: testBreakdown(competence, base, { roll: r.roll, ...cibleMesuree(r), sl: r.dr, success: r.success }, p.test.difficulty, mods) }
          : part.attempt === false ? {} : { pending: testPending(competence, base, undefined, p.test.difficulty, mods) }),
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
      ...(part.attempt === true && phase === 'choice' ? { rollBlocked: t('declaration.attenteFenetre') } : {}),
      ...(owned && part.attempt === null
        ? {
          declare: {
            onChoose: (k: string) => {
              const d = declarations.find((x) => x.option.key === k)?.declaration;
              if (d) choose(part.id, d.attempt, d.suspendre);
            },
            options: declarations.map((x) => x.option),
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
      title={<><Icon id="melee/flee" size="sm" /> {p.test.label}</>}
      /* Z1 : la SITUATION que rien d'autre ne porte (la hauteur) ; Compétence et Difficulté sont à la
         ligne (`.rm-roll-diff`, #1072). */
      subtitle={p.suspendu !== undefined ? t('fall.modale.deniveleSuspendu', { metres: p.metres, suspendu: p.suspendu }) : t('fall.modale.denivele', { metres: p.metres })}
      rows={rows}
      rolled={rolled}
      actions={actions}
      onCancel={unJet ? undefined : cancel}
    />
  );
}

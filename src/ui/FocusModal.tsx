import { useGame } from '../state/store';
import { findSpellById } from '../data/index';
import { castingValue } from '../engine/magic';
import { windsMagicLineOf } from '../state/combatOrParty';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { describeFocus } from '../state/flowOutcomes';
import { Icon } from './Icon';

/**
 * Modale de Focalisation (LDB — Test étendu de Focalisation) : « Lancer » accumule du DR vers le NI,
 * « Chance » rejoue/ajoute, « Appliquer » fige l'accumulation.
 */
export function FocusModal() {
  const pf = useGame((s) => s.pendingFocus);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.focusRoll);
  const reroll = useGame((s) => s.focusReroll);
  const bonusSL = useGame((s) => s.focusBonusSL);
  const darkPact = useGame((s) => s.focusDarkPact);
  const force = useGame((s) => s.focusForceSuccess);
  const confirm = useGame((s) => s.focusConfirm);
  const cancel = useGame((s) => s.focusCancel);
  if (!pf) return null;
  const caster = (battle?.combatants ?? party).find((c) => c.id === pf.casterId); // combat (file) ou hors combat (groupe)
  if (!caster) return null;
  const spell = findSpellById(pf.spellId);
  const ni = spell?.cn ?? 0;
  const prev = caster.focus?.spell === pf.spellId ? caster.focus.dr : 0;
  const r = pf.result;
  const rolled = !!r;
  // Vents Tourbillonnants (LDB 46 l.179-190) : mod visible au pré-jet SEULEMENT si révélés (Seconde
  // vue), toujours visible au breakdown post-jet (déjà appliqué au Test — cf. `resolveFocus`).
  const windsLine = windsMagicLineOf(battle);
  const windsMods = windsLine ? [windsLine] : undefined;

  const actorRow: BuiltRollRow = buildRollRow({
    actor: caster,
    row: {
      combatant: caster,
      d: r ? testBreakdown('Focalisation', castingValue(caster, 'focalisation'), { roll: r.roll, target: r.target, sl: r.sl ?? r.dr, success: r.dr > 0 }, undefined, windsMods) : undefined,
      pending: testPending('Focalisation', castingValue(caster, 'focalisation'), undefined, undefined, battle?.windsOfMagic?.revealed ? windsMods : undefined),
    },
    onRoll: roll,
    rerolled: !!pf.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    /* Test ÉTENDU (Focalisation) : barre de DR de RANGÉE — site unique `RollRow` (arbitrage user 2026-07-11). */
    extendedDr: { cum: Math.min(ni, prev + (r?.dr ?? 0)), target: ni },
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'always' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="focus"
      title={<><Icon id="flag/focus" size="sm" /> Focalisation</>}
      /* Z1 : QUI focalise QUOI. La PROGRESSION (DR cumulé vers le NI) n'est PAS ici — elle a sa zone
         unique, la barre de DR de la rangée (`extendedDr`, ci-dessus). */
      subtitle={
        <>
          <strong>{caster.label}</strong> — Focalisation de <strong>{spell?.label ?? pf.spellId}</strong>
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      /* L'issue ne s'ouvre que pour ce qu'aucune autre zone n'énonce (le NI atteint) : `describeFocus`
         rend '' tant que la Focalisation progresse — pas de cadre vide, pas de progression redite. */
      outcome={r && describeFocus(pf, prev, ni) ? [recapLineOfEvent(ev('focus', describeFocus(pf, prev, ni), caster.id), battle?.combatants ?? party)] : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}

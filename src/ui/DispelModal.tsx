import { useGame } from '../state/store';
import { flowStakeRef } from '../data';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { Icon } from './Icon';
import { ev } from '../noyau/combatLog';
import { resultLine, freeCons } from '../noyau/rollSeam';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { progresDeDissipation } from '../noyau/progresEtendu';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';

/**
 * Modale de Dissipation permanente (LDB 46 l.158-162 : Test étendu de Langue (Magick) → NI). « Lancer »
 * accumule du DR vers le NI du sort visé ; quand le DR cumulé atteint le NI, le sort est dissipé. Action
 * RÉPÉTÉE chaque Round (le DR persiste sur `caster.dispel`). Calque `FocusModal`.
 */
export function DispelModal() {
  const pd = useGame((s) => s.pendingDispel);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGesteDeJet('jetLancer', 'dissipation');
  const reroll = useGesteDeJet('jetRelancer', 'dissipation');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'dissipation');
  const darkPact = useGesteDeJet('jetPactiser', 'dissipation');
  const force = useGesteDeJet('jetForcerLaReussite', 'dissipation');
  const confirm = useGesteDeJet('jetValider', 'dissipation');
  const cancel = useGesteDeJet('jetAnnuler', 'dissipation');
  if (!pd) return null;
  const caster = (battle?.combatants ?? party).find((c) => c.id === pd.casterId);
  if (!caster) return null;
  const r = pd.result;
  const { prev, step } = progresDeDissipation(pd, caster);
  const cum = Math.min(pd.ni, step?.total ?? prev);
  // La ligne figée à l'ouverture (`pd.ligne`) : Soutien et composantes de la valeur nommés (LDB 12 ; #1178).
  const { base, mods: supMods } = pd.ligne;
  const rolled = !!r;

  const actorRow: BuiltRollRow = buildRollRow({
    actor: caster,
    row: {
      combatant: caster,
      d: r ? testBreakdown(libelleDeTest('langue-magick'), base, r, undefined, supMods) : undefined,
      pending: testPending(libelleDeTest('langue-magick'), base, undefined, undefined, supMods),
    },
    onRoll: roll,
    rerolled: !!pd.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    /* Test ÉTENDU (Dissipation) : barre de DR de RANGÉE — site unique `RollRow` (arbitrage user 2026-07-11). */
    extendedDr: { cum, target: pd.ni },
  });

  const actions: RollAction[] = [
    { key: 'abandonner', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="dissipation"
      stake={flowStakeRef('dissipation-test', { values: { ni: pd.ni } })}
      title={<><Icon id="action/dissiper" size="sm" /> Dissipation</>}
      /* Z1 : QUI dissipe QUOI. La PROGRESSION (DR cumulé vers le NI) n'est PAS ici — elle a sa zone
         unique, la barre de DR de la rangée (`extendedDr`, ci-dessus). */
      subtitle={
        <>
          <strong>{caster.label}</strong> dissipe <strong>{pd.label}</strong>
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      /* La PROGRESSION (DR du Round, cumul vers le NI) vit dans ses zones : ✓/✗ ±DR sur la ligne de
         jet, cumul/cible sur la barre de DR de la rangée. Reste à l'issue le seul fait que rien
         d'autre n'énonce — le sort a cédé. */
      outcome={step?.done ? [recapLineOfEvent(
        ev('sort', resultLine(freeCons([`${caster.label} — ${pd.label} est dissipé !`])), caster.id),
        battle?.combatants ?? party,
      )] : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}

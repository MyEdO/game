import { useGame } from '../state/store';
import { findSpellById } from '../data/index';
import { ligneDeFocalisation } from '../noyau/fenetreDIncantation';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { describeFocus } from '../noyau/flowOutcomes';
import { progresDeFocalisation } from '../noyau/progresEtendu';
import { Icon } from './Icon';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';

/**
 * Modale de Focalisation (LDB — Test étendu de Focalisation) : « Lancer » accumule du DR vers le NI,
 * « Chance » rejoue/ajoute, « Appliquer » fige l'accumulation.
 */
export function FocusModal() {
  const pf = useGame((s) => s.pendingFocus);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGesteDeJet('jetLancer', 'focalisation');
  const reroll = useGesteDeJet('jetRelancer', 'focalisation');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'focalisation');
  const darkPact = useGesteDeJet('jetPactiser', 'focalisation');
  const force = useGesteDeJet('jetForcerLaReussite', 'focalisation');
  const confirm = useGesteDeJet('jetValider', 'focalisation');
  const cancel = useGesteDeJet('jetAnnuler', 'focalisation');
  if (!pf) return null;
  const caster = (battle?.combatants ?? party).find((c) => c.id === pf.casterId); // combat (file) ou hors combat (groupe)
  if (!caster) return null;
  const spell = findSpellById(pf.spellId);
  // NI, valeur et Vents annoncés : la ligne du noyau (`ligneDeFocalisation`), celle que le résolveur jette.
  const ligne = ligneDeFocalisation(useGame.getState());
  if (!ligne) return null;
  const { ni } = ligne;
  const r = pf.result;
  const { prev, step } = progresDeFocalisation(pf, caster, ni);
  const rolled = !!r;
  const mods = ligne.mods.length ? ligne.mods : undefined;

  const actorRow: BuiltRollRow = buildRollRow({
    actor: caster,
    row: {
      combatant: caster,
      d: r ? testBreakdown(libelleDeTest('focalisation'), ligne.base, { roll: r.roll, target: r.target, sl: r.sl ?? r.dr, success: r.success }, undefined, mods) : undefined,
      pending: testPending(libelleDeTest('focalisation'), ligne.base, undefined, undefined, mods),
    },
    onRoll: roll,
    rerolled: !!pf.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    /* Test ÉTENDU (Focalisation) : barre de DR de RANGÉE — site unique `RollRow` (arbitrage user 2026-07-11). */
    extendedDr: { cum: Math.min(ni, step?.total ?? prev), target: ni },
  });

  const actions: RollAction[] = [
    { key: 'abandonner', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="focalisation"
      title={<><Icon id="drapeau/focalisation" size="sm" /> Focalisation</>}
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
      outcome={describeFocus(step) ? [recapLineOfEvent(ev('focalisation', describeFocus(step), caster.id), battle?.combatants ?? party)] : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}

import { cibleMesuree } from '../engine/tests';
import { useGame } from '../state/store';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { Icon } from './Icon';
import { resultLines, freeCons } from '../noyau/rollSeam';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { nomEnVue } from '../noyau/visionDuGroupe';
import { garanti } from '../lib/garanti';
import { useGesteDeJet } from './useGesteDeJet';

/**
 * Test de Dextérité (+20) PAR ACTION de « Main ensanglantée » (Aux Armes bras 46-50, l.2569) : interposé
 * AVANT l'ouverture d'une Action d'attaque quand l'arme employée est tenue dans une main gatée. « Lancer »
 * → Chance (relance / +1 DR) / Sombre Pacte → Résilience → « Appliquer ». Sur RÉUSSITE, l'Action figée
 * s'ouvre ; sur ÉCHEC, l'objet glisse (op `disarm`) et rien d'autre n'est consommé (calque le gate de
 * Bénédiction de Protection). Coquille UNIQUE `RollShell` (calque `ReloadModal`/`HealModal`).
 */
export function HandGateModal() {
  const pg = useGame((s) => s.pendingHandGate);
  const battle = useGame((s) => s.battle);
  const nom = useGame((s) => (s.pendingHandGate ? nomEnVue(s, s.pendingHandGate.attackerId) : null));
  const roll = useGesteDeJet('jetLancer', 'mainEnsanglantee');
  const reroll = useGesteDeJet('jetRelancer', 'mainEnsanglantee');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'mainEnsanglantee');
  const darkPact = useGesteDeJet('jetPactiser', 'mainEnsanglantee');
  const force = useGesteDeJet('jetForcerLaReussite', 'mainEnsanglantee');
  const confirm = useGesteDeJet('jetValider', 'mainEnsanglantee');
  const cancel = useGesteDeJet('jetAnnuler', 'mainEnsanglantee');
  if (!pg || !battle) return null;
  const actor = battle.combatants.find((c) => c.id === pg.attackerId);
  const rolled = pg.roll != null;
  const fortune = actor?.fortune ?? 0;
  const l = pg.ligne; // figée à l'ouverture (`poserLeTestDeMain`) : celle que le résolveur jette

  const actorRow: BuiltRollRow = buildRollRow({
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown(libelleDeTest('dexterite'), l.base, { roll: pg.roll!, ...cibleMesuree(pg), sl: pg.sl, success: pg.success }, l.difficulty, l.mods) : undefined,
      pending: testPending(libelleDeTest('dexterite'), l.base, cibleMesuree(l), l.difficulty, l.mods),
    },
    rerolled: !!pg.rerolled,
    onRoll: roll,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    fortune,
    resilience: actor?.resilience ?? 0,
  });

  const actions: RollAction[] = [
    { key: 'abandonner', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="mainEnsanglantee"
      title={<><Icon id="etat/hemorragique" size="sm" /> Main ensanglantée</>}
      subtitle={
        <>
          <strong>{garanti(nom, pg.attackerId, 'porteur de la main ensanglantée')}</strong> raffermit sa prise{' '}
          <span className="rm-weapon">(Dextérité, Accessible +20)</span>
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={rolled ? resultLines(freeCons([pg.success ? 'Il garde son arme bien en main.' : 'L’arme lui glisse des doigts.'])) : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}

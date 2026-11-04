import { cibleMesuree } from '../engine/tests';
import { valeurDecomposee } from '../engine/skills';
import { useGame } from '../state/store';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { Icon } from './Icon';
import { resultLines, freeCons } from '../noyau/rollSeam';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { t } from '../i18n';
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
  const roll = useGesteDeJet('jetRoll', 'handGate');
  const reroll = useGesteDeJet('jetReroll', 'handGate');
  const bonusSL = useGesteDeJet('jetBonusSL', 'handGate');
  const darkPact = useGesteDeJet('jetDarkPact', 'handGate');
  const force = useGesteDeJet('jetForceSuccess', 'handGate');
  const confirm = useGesteDeJet('jetConfirm', 'handGate');
  const cancel = useGesteDeJet('jetCancel', 'handGate');
  if (!pg || !battle) return null;
  const actor = battle.combatants.find((c) => c.id === pg.attackerId);
  const rolled = pg.roll != null;
  const fortune = actor?.fortune ?? 0;
  const dex = actor ? valeurDecomposee(actor, { char: 'dexterite' }) : { base: pg.skillValue, mods: [] };

  const actorRow: BuiltRollRow = buildRollRow({
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown(libelleDeTest('dexterite'), dex.base, { roll: pg.roll!, ...cibleMesuree(pg), sl: pg.sl, success: pg.success }, pg.difficulty, dex.mods) : undefined,
      pending: testPending(libelleDeTest('dexterite'), dex.base, cibleMesuree(pg), pg.difficulty, dex.mods),
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
    { key: 'cancel', label: t('verbe.cancel'), onClick: cancel, verbe: 'cancel' },
    { key: 'confirm', label: t('verbe.confirm'), onClick: confirm, verbe: 'confirm' },
  ];

  return (
    <RollShell
      flowKey="handGate"
      title={<><Icon id="condition/bleeding" size="sm" /> Main ensanglantée</>}
      subtitle={
        <>
          <strong>{pg.actorName}</strong> raffermit sa prise{' '}
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

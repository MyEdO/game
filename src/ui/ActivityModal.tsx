import { useGame } from '../state/store';
import type { ModLine } from '../engine/combat';
import { evaluateTest } from '../engine/tests';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, witnessRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending, opposedLines } from './breakdown';
import { activityModLines } from '../engine/activities';
import { describeActivity } from '../noyau/flowOutcomes';
import { progresDActivite } from '../noyau/progresEtendu';
import { resultLines, freeCons } from '../noyau/rollSeam';
import { activityStakeRef, hasActivityStake } from '../data';
import { libelleDePuissance } from '../noyau/jetsEnVue';
import { FLOWS } from '../noyau/rollFlowSpecs';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';

/**
 * Jet d'Activité (LDB 23 interlude / ADE II 8 BATAILLE de masse) : même coquille `RollShell` que
 * les autres modales de jet. Interlude = Revenus (Test Accessible) ou Artisanat (Test ÉTENDU, barre de
 * DR). BATAILLE = le contexte de la Scène/Activité est RENDU via les primitives de la coquille :
 * modificateur de SITUATION (Menace −20 / Planification) et Soutien multi-PJ en LIGNES de mod du
 * breakdown ; Test COMBINÉ (deux compétences, un jet) en 2ᵉ rangée témoin ; Test OPPOSÉ « Tenez votre
 * position » en rangée témoin figée de l'ennemi (winner + DR net). Le cycle d'influence reste piloté par
 * les verbes du flux `activite`.
 */
export function ActivityModal() {
  const pa = useGame((s) => s.pendingActivity);
  const party = useGame((s) => s.party);
  const massBattle = useGame((s) => s.massBattle);
  const roll = useGesteDeJet('jetLancer', 'activite');
  const reroll = useGesteDeJet('jetRelancer', 'activite');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'activite');
  const darkPact = useGesteDeJet('jetPactiser', 'activite');
  const force = useGesteDeJet('jetForcerLaReussite', 'activite'); // Résilience (LDB 17 l.68)
  const reverse = useGesteDeJet('jetInverser', 'activite'); // Inversion (LDB 12 l.42)
  const cancel = useGesteDeJet('jetAnnuler', 'activite');
  const confirm = useGesteDeJet('jetValider', 'activite');
  if (!pa) return null;
  const actor = party.find((c) => c.id === pa.heroId);
  const rolled = pa.roll != null;
  const progres = progresDActivite(pa);

  // Ligne montée à l'ouverture (`pa.ligne` : pré-jet d'Activité ou Test de bataille, Soutien et
  // modificateur de situation compris).
  const { base, mods: extraMods } = pa.ligne;

  // « Échec » CANONIQUE : l'issue du flux `activite` (`FLOWS.activite.outcomeOf`), dont dérive aussi le
  // gating Chance/Pacte/Résilience du noyau.
  const failed = rolled && !FLOWS.activite.outcomeOf(useGame.getState)?.won;

  const actorRow: BuiltRollRow = buildRollRow({
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown(pa.skillLabel, base, { roll: pa.roll!, target: pa.target, sl: pa.sl, success: pa.success }, pa.difficulty, extraMods.length ? extraMods : undefined) : undefined,
      pending: testPending(pa.skillLabel, base, undefined, pa.difficulty, extraMods.length ? extraMods : undefined),
    },
    // Test COMBINÉ : un volet qui tombe reste un échec global (LDB 12 l.202-208) même quand la ligne
    // affiche la réussite de skill-1 — c'est ce `lost` qui garde la Résilience offerte.
    lost: failed,
    rerolled: !!pa.rerolled,
    onRoll: roll,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    key: 'actor',
    fortune: actor?.fortune ?? 0,
    /* Test ÉTENDU (Artisanat) : barre de DR de RANGÉE — site unique `RollRow` (arbitrage user 2026-07-11). */
    extendedDr: progres ? { cum: rolled ? progres.total : pa.drBefore ?? 0, target: progres.cible } : undefined,
    // Offre et aperçu de l'inversion : verdicts du flux (`FLOWS.activite`).
    ...(FLOWS.activite.reverseAvailable(useGame.getState) ? { reverse: { onReverse: reverse, preview: FLOWS.activite.reversePreview(useGame.getState) } } : {}),
  });

  const rows: BuiltRollRow[] = [actorRow];

  // Test COMBINÉ (Infiltration/Repérage, l.75/102 — UN jet vs DEUX compétences, LDB 12 l.202-206) : 2ᵉ rangée
  // TÉMOIN de la seconde compétence (même dé), l'issue lit `combinedLevel` (full/partial/fail) via `describeActivity`.
  if (pa.target2 != null && pa.skill2) {
    const situationLines = activityModLines(pa.mod, pa.modLabel);
    const secondMods = situationLines.length ? situationLines : undefined; // le Soutien ne porte que sur la compétence menante
    rows.push(buildRollRow({
      row: {
        d: rolled ? testBreakdown(pa.skill2, pa.skillValue2 ?? 0, { roll: pa.roll!, target: pa.target2, sl: pa.sl2 ?? 0, success: pa.success2 }, pa.difficulty, secondMods) : undefined,
        pending: testPending(pa.skill2, pa.skillValue2 ?? 0, undefined, pa.difficulty, secondMods),
      },
    }, {
      key: 'skill2',
      interactive: false,
    }));
  }

  // Test OPPOSÉ « Tenez votre position » (l.161) : rangée TÉMOIN de l'ennemi (jet FIGÉ à l'ouverture),
  // montrée post-jet comme les autres modales opposées (Marchandage/Se libérer). L'issue lit `enemySL`.
  const enemyT = rolled && pa.enemyValue != null && pa.enemyRoll != null ? evaluateTest(pa.enemyRoll, pa.enemyValue) : undefined;
  const opposed = !!enemyT;
  if (enemyT) {
    // Seul producteur de l'opposition : `openHoldScene` (`massBattleFlow.ts`), sous bataille ouverte (#1906).
    if (!massBattle) throw new Error('[activité] opposition « Tenez votre position » sans bataille de masse ouverte (#1906)');
    const enemyName = massBattle.ennemi.label;
    // La ligne montre la grandeur qui TRANCHE à DR égal (LDB 12 l.160) : la Puissance NUE en base, le
    // bonus cumulatif des Rounds tenus (ADE II 08 l.163) en ligne de mod NOMMÉE — même patron que le
    // Soutien du PJ ci-dessus (`supportSplit`). Sans Puissance nue posée, la base reste la cible jetée.
    const enemyBase = pa.enemyBase ?? pa.enemyValue!;
    const holdMods: ModLine[] = pa.enemyValue! !== enemyBase ? [{ label: 'Rounds tenus', value: pa.enemyValue! - enemyBase, famille: 'jet' }] : [];
    rows.push(witnessRow({
      key: 'enemy',
      // La Difficulté de l'opposition est celle DÉCLARÉE par le flux, à défaut Intermédiaire (LDB 12 l.166).
      row: opposedLines([{ label: libelleDePuissance(enemyName), base: enemyBase, r: enemyT, mods: holdMods.length ? holdMods : undefined }], pa.difficulty)[0],
    }));
  }
  // Vainqueur du Test opposé : le PJ TIENT (`pa.success`) → rangée 0 accentuée, sinon l'ennemi (rangée 1).
  // DR net rapporté au PJ (positif = la position tient de cette marge) : `−enemySL` (enemySL positif = l'ennemi progresse).
  const winnerIndex = opposed ? (pa.success ? 0 : rows.length - 1) : null;
  const netSL = opposed ? -(pa.enemySL ?? 0) : undefined;

  const issue = rolled ? describeActivity(pa) : '';

  const actions: RollAction[] = [
    { key: 'abandonner', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="activite"
      title={pa.label}
      /* Z3b : l'enjeu vient de l'ACTIVITÉ jouée (donnée éditable) — le ⓘ du titre s'accole tout seul
         (RollShell), et le foyer de règle est l'Activité elle-même à défaut d'un autre déclaré. */
      stake={pa.activityId && hasActivityStake(pa.activityId) ? activityStakeRef(pa.activityId) : undefined}
      /* QUI fait l'Activité → portrait dans la ligne de jet ; la compétence vit dans le cadre. */
      subtitle={null}
      rows={rows}
      rolled={rolled}
      winnerIndex={winnerIndex}
      netSL={netSL}
      /* Une SEULE issue, à toute cardinalité (mono, combiné, opposé) : `describeActivity` est la ligne
         d'issue du jet, pas un agrégat de rangées — elle vit donc en `outcome`, et la coquille seule
         décide de son affichage. Aucun bandeau `summary` : il n'y a rien à agréger en plus. */
      outcome={rolled ? resultLines(freeCons([issue])) : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}

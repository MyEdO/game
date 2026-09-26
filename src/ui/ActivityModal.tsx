import { useGame } from '../state/store';
import type { ModLine } from '../engine/combat';
import { evaluateTest } from '../engine/tests';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, witnessRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending, testValueSplit, opposedLines } from './breakdown';
import { activityById, activityModLines } from '../engine/activities';
import { describeActivity } from '../state/flowOutcomes';
import { resultLines, freeCons } from '../state/rollSeam';
import { activityStakeRef, hasActivityStake } from '../data';

/**
 * Jet d'Activité (LDB 23 interlude / ADE II 8 BATAILLE de masse) : même coquille `RollShell` que
 * les autres modales de jet. Interlude = Revenus (Test Accessible) ou Artisanat (Test ÉTENDU, barre de
 * DR). BATAILLE = le contexte de la Scène/Activité est RENDU via les primitives de la coquille :
 * modificateur de SITUATION (Menace −20 / Planification) et Soutien multi-PJ en LIGNES de mod du
 * breakdown ; Test COMBINÉ (deux compétences, un jet) en 2ᵉ rangée témoin ; Test OPPOSÉ « Tenez votre
 * position » en rangée témoin figée de l'ennemi (winner + DR net). Le cycle d'influence reste piloté par
 * les verbes du flux `activity`.
 */
export function ActivityModal() {
  const pa = useGame((s) => s.pendingActivity);
  const party = useGame((s) => s.party);
  const massBattle = useGame((s) => s.massBattle);
  const roll = useGame((s) => s.activityRoll);
  const reroll = useGame((s) => s.activityReroll);
  const bonusSL = useGame((s) => s.activityBonusSL);
  const darkPact = useGame((s) => s.activityDarkPact);
  const cancel = useGame((s) => s.activityCancel);
  const confirm = useGame((s) => s.activityConfirm);
  if (!pa) return null;
  const actor = party.find((c) => c.id === pa.heroId);
  const rolled = pa.roll != null;
  const after = Math.max(0, (pa.drBefore ?? 0) + pa.sl);

  // Contexte de BATAILLE rendu en LIGNES de mod (source unique « base + mods » de la coquille), pas en
  // sous-titre ad hoc : Soutien multi-PJ (LDB 12, fondu dans `skillValue` → base RÉELLE = value − bonus,
  // même patron que la Dissipation à plusieurs) et modificateur de SITUATION (Menace/Planification).
  // #1178 : les composantes de la valeur de Test (États, séquelles, passifs, effets) prennent aussi
  // leur ligne NOMMÉE, quand la Compétence testée est DÉSIGNABLE par id — celle CHOISIE par le
  // résolveur (`chosenSkill`), sinon l'unique Compétence déclarée par l'Activité (`activities.json`).
  const actDef = pa.activityId ? activityById(pa.activityId) : undefined;
  const onlySkill = actDef?.skills?.length === 1 ? actDef.skills[0] : undefined;
  const tested = pa.chosenSkill ? { id: pa.chosenSkill, spec: pa.chosenSkillSpec } : onlySkill;
  const { base, mods: supMods } = testValueSplit(actor, pa.skillValue, {
    support: pa.support, skill: tested?.id, characteristic: tested ? undefined : actDef?.char, spec: tested?.spec,
  });
  const extraMods: ModLine[] = [...supMods, ...activityModLines(pa.mod, pa.modLabel)];
  // Cible affichée : celle du jet (pré-cuite dès l'ouverture en bataille, sinon dérivée base+Difficulté).
  const target1 = rolled ? pa.target : undefined;

  // « Échec » CANONIQUE (gate des relances Chance/Pacte), aligné sur le `failed` du flux `activity` : un
  // Test combiné non-`full` (un `partial` = échec global RAW) OU une tenue perdue (opposition) OU un jet
  // simple raté (d100 > cible). Sans quoi Chance serait mal offerte quand skill-1 passe mais le combiné échoue.
  const failed = pa.combinedLevel != null
    ? pa.combinedLevel !== 'full'
    : pa.enemyValue != null
      ? !pa.success
      : (pa.roll ?? 0) > pa.target;

  const actorRow: BuiltRollRow = buildRollRow({
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown(pa.skillLabel, base, { roll: pa.roll!, target: pa.target, sl: pa.sl, success: pa.success }, pa.difficulty, extraMods.length ? extraMods : undefined) : undefined,
      pending: testPending(pa.skillLabel, base, target1, pa.difficulty, extraMods.length ? extraMods : undefined),
    },
    // Test COMBINÉ : un volet qui tombe reste un échec global (LDB 12 l.202-208) même quand la ligne
    // affiche la réussite de skill-1 — c'est ce `lost` qui garde la Résilience offerte.
    lost: failed,
    rerolled: !!pa.rerolled,
    onRoll: roll,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
  }, {
    key: 'actor',
    fortune: actor?.fortune ?? 0,
    /* Test ÉTENDU (Artisanat) : barre de DR de RANGÉE — site unique `RollRow` (arbitrage user 2026-07-11). */
    extendedDr: pa.drTarget != null ? { cum: rolled ? after : pa.drBefore ?? 0, target: pa.drTarget } : undefined,
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
        pending: testPending(pa.skill2, pa.skillValue2 ?? 0, rolled ? pa.target2 : undefined, pa.difficulty, secondMods),
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
    const enemyName = massBattle.enemy.label;
    // La ligne montre la grandeur qui TRANCHE à DR égal (LDB 12 l.160) : la Puissance NUE en base, le
    // bonus cumulatif des Rounds tenus (ADE II 08 l.163) en ligne de mod NOMMÉE — même patron que le
    // Soutien du PJ ci-dessus (`supportSplit`). Sans Puissance nue posée, la base reste la cible jetée.
    const enemyBase = pa.enemyBase ?? pa.enemyValue!;
    const holdMods: ModLine[] = pa.enemyValue! !== enemyBase ? [{ label: 'Rounds tenus', value: pa.enemyValue! - enemyBase, famille: 'jet' }] : [];
    rows.push(witnessRow({
      key: 'enemy',
      // La Difficulté de l'opposition est celle DÉCLARÉE par le flux, à défaut Intermédiaire (LDB 12 l.166).
      row: opposedLines([{ label: `${enemyName} · Puissance`, base: enemyBase, r: enemyT, mods: holdMods.length ? holdMods : undefined }], pa.difficulty)[0],
    }));
  }
  // Vainqueur du Test opposé : le PJ TIENT (`pa.success`) → rangée 0 accentuée, sinon l'ennemi (rangée 1).
  // DR net rapporté au PJ (positif = la position tient de cette marge) : `−enemySL` (enemySL positif = l'ennemi progresse).
  const winnerIndex = opposed ? (pa.success ? 0 : rows.length - 1) : null;
  const netSL = opposed ? -(pa.enemySL ?? 0) : undefined;

  const issue = rolled ? describeActivity(pa) : '';

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="activity"
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

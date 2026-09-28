import { useGame } from '../state/store';
import { flowStakeRef, type FlowStakeId } from '../data';
import { StakeNote, StakeRule, stakeRuleOf } from './StakeNote';
import { defenseValue, combatValue, defenseModifiers, baseTestModLines } from '../engine/combat';
import { calmeValue } from '../engine/psychology';
import { groupAdvantage } from '../engine/advantagePool';
import { retreatAdvantageCost } from '../engine/combatFeatures/dispatch';
import { ResilienceButton } from './ResilienceButton';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction } from './RollShell';
import { buildParticipantRows, type ParticipantRow } from './buildParticipantRows';
import { VsHeader } from './VsHeader';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { describeDisengage, describeDisengageFlee } from '../state/flowOutcomes';
import { fleeBackstab, fleeCalme, fleeNeedCalme, type PendingDisengage } from '../state/pendings';
import { Modal } from './Modal';
import { Stack } from './Layout';
import { Icon } from './Icon';
import { opposedLines, testBreakdown } from './breakdown';
import { opposedResponded } from './opposedFrozen';
import { buildRollRow, frozenOpposedRow, type BuiltRollRow } from './rollRowBuild';

/** Enjeu servi par chaque fenêtre du Désengagement. */
const DISENGAGE_STAKE: Record<PendingDisengage['phase'], FlowStakeId> = { choice: 'disengage-choice', esquive: 'disengage-esquive', fuir: 'disengage-fuir' };

/**
 * Modale de Désengagement (LDB 15 l.43-68). Trois phases, une seule coquille de jet PARTAGÉE :
 * - **'choice'** : PAS un jet — le MENU d'options (`OptionChooser`) Sacrifier l'Avantage / Esquiver /
 *   Fuir + Résilience pré-jet, rendu dans un `Modal` simple (RollShell ne fait pas les menus).
 * - **'esquive'** : `RollShell` opposé (2 rangées) — [0] Corps à corps du foe FIGÉ (témoin) vs
 *   [1] Esquive du mover INTERACTIVE (cycle d'influence), `winnerIndex`/`outcome`. Appliquer = `disengageConfirm`.
 * - **'fuir'** : `RollShell` (flux MULTI `flee`, 2 slots) — [0] le coup dans le dos du FRAPPEUR,
 *   [1] le Test de Calme du FUYARD (présent seulement si le coup a fait des Blessures). Chaque rangée
 *   est INTERACTIVE pour son contrôleur humain, TÉMOIN sinon. Appliquer = `fleeConfirm`.
 */
export function DisengageModal() {
  const pd = useGame((s) => s.pendingDisengage);
  const battle = useGame((s) => s.battle);
  const sacrifice = useGame((s) => s.disengageConfirmA);
  const esquiver = useGame((s) => s.disengageRoll);
  const reroll = useGame((s) => s.disengageReroll);
  const bonusSL = useGame((s) => s.disengageBonusSL);
  const darkPact = useGame((s) => s.disengageDarkPact);
  const forceSuccess = useGame((s) => s.disengageForceSuccess);
  const confirm = useGame((s) => s.disengageConfirm);
  const flee = useGame((s) => s.disengageFlee);
  const fleeRoll = useGame((s) => s.fleeRoll);
  const fleeReroll = useGame((s) => s.fleeReroll);
  const fleeBonusSL = useGame((s) => s.fleeBonusSL);
  const fleeDarkPact = useGame((s) => s.fleeDarkPact);
  const fleeForce = useGame((s) => s.fleeForceSuccess);
  const fleeConfirm = useGame((s) => s.fleeConfirm);
  const cancel = useGame((s) => s.disengageCancel);
  if (!pd || !battle) return null;
  const mover = battle.combatants.find((c) => c.id === pd.moverId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!mover || !foe) return null;
  const header = <VsHeader actor={mover} target={foe} label="quitter le corps à corps" verb="melee/disengage" />;

  // ── Phase 'choice' : MENU d'options (pas un jet) — Modal simple + OptionChooser + Résilience pré-jet. ──
  if (pd.phase === 'choice') {
    // « Avantage de groupe » (AA 11 l.37) : l'option A devient « Retraite stratégique » à coût FIXE (2 Av,
    // 1 avec Impitoyable) débité de la réserve du camp ; sinon LDB « Sacrifier l'Avantage » (→ 0).
    const groupMode = groupAdvantage();
    const retreatCost = retreatAdvantageCost(mover);
    const choiceStake = flowStakeRef(DISENGAGE_STAKE[pd.phase]);
    const sacrificeLabel = <><Icon id="melee/disengage" size="sm" /> {groupMode ? `Retraite stratégique (${retreatCost} Av)` : "Sacrifier l'Avantage"}</>;
    const sacrificeTitle = groupMode
      ? `Dépense ${retreatCost} Avantage(s) de la réserve du camp pour rompre le combat, sans coût d'Action`
      : "Tu as l'Avantage supérieur : pars librement, sans coût d'Action";
    const offertes = [
      { stake: groupMode ? flowStakeRef('disengage-retraite', { values: { cout: retreatCost } }) : flowStakeRef('disengage-sacrifice'),
        option: { key: 'sacrifice', label: sacrificeLabel, hidden: !pd.canSacrifice, onSelect: sacrifice, title: sacrificeTitle } },
      { stake: flowStakeRef('disengage-esquive'),
        option: { key: 'esquive', label: <><Icon id="melee/tumble" size="sm" /> Esquiver</>, value: defenseValue(mover, 'esquive'), hidden: pd.canEsquive === false, onSelect: esquiver, title: "Test opposé d'Esquive — coûte ton Action" } },
      { stake: flowStakeRef('disengage-fuir'),
        option: { key: 'fuir', label: <><Icon id="melee/flee" size="sm" /> Fuir (coup dans le dos)</>, hidden: pd.canEsquive === false, onSelect: flee, title: 'Tu tournes le dos : attaque gratuite contre toi (+20), puis tu cours' } },
    ].filter((o) => !o.option.hidden);
    return (
      /* Décision DE COMBAT, champ lisible : les adversaires au contact se lisent sous la fenêtre. */
      <Modal title={<>Se désengager <StakeRule rule={stakeRuleOf(choiceStake)} /></>} champ onClose={cancel} etape={pd.phase}
        footer={
          <>
            <button className="btn btn-ghost" onClick={cancel}>
              Renoncer
            </button>
          </>
        }
      >
        <Stack gap="md">
          {header}
          <div className="rm-options">
            {/* Menu d'options PARTAGÉ (OptionChooser) — chaque option porte sa note d'enjeu ; Esquiver
                montre sa valeur effective d'Esquive. */}
            <OptionChooser layout="grid" options={offertes.map((o) => ({ ...o.option, note: <StakeNote stake={o.stake} /> }))} />
            {pd.canEsquive === false && (
              <p className="modal-log">Action déjà dépensée : seul « {groupMode ? 'Retraite stratégique' : "Sacrifier l'Avantage"} » (sans coût d'Action) reste possible.</p>
            )}
          </div>
          {/* Le renoncement (`disengage-choice`) : note du geste « Renoncer » du pied. */}
          <StakeNote stake={choiceStake} />
          <div className="rm-influence">
            {/* Résilience AVANT le jet (LDB 17 l.68) : Esquive forcée en réussite. */}
            {pd.canEsquive !== false && (
              <ResilienceButton resilience={mover.resilience ?? 0} show={(mover.resilience ?? 0) > 0} onForce={() => { esquiver(); forceSuccess(); }} />
            )}
          </div>
        </Stack>
      </Modal>
    );
  }

  // ── Phase 'fuir' : DEUX rangées, une par acteur — coup dans le dos du frappeur, Test de Calme du
  //    fuyard. Les DÉRIVATIONS d'influence viennent de la primitive PARTAGÉE `buildParticipantRows`
  //    (source unique des 6 modales multi) ; la modale ne fournit que la PRÉSENTATION de ses rangées. ──
  if (pd.phase === 'fuir') {
    const bs = fleeBackstab(pd);
    const calmeSlot = fleeCalme(pd);
    const res = bs?.result;
    const calme = calmeSlot?.calme;
    const needCalme = fleeNeedCalme(pd); // coup qui touche → Test de Calme (LDB 15 l.66)
    const fleeOutcome = describeDisengageFlee(pd);

    // Projection des slots HÉTÉROGÈNES vers la forme `ParticipantRow` attendue par la primitive : le
    // jet de l'acteur (dé/cible/DR/réussite) — coup dans le dos = son `attackerDetail`, Calme = son jet.
    const parts: ParticipantRow[] = [
      ...(bs ? [{ id: bs.id, interactive: bs.interactive, rerolled: bs.rerolled, result: res?.attackerDetail ?? null }] : []),
      ...(needCalme && calmeSlot
        ? [{ id: calmeSlot.id, interactive: calmeSlot.interactive, rerolled: calmeSlot.rerolled, result: calme ? { ...calme, target: calme.target ?? 0 } : null }]
        : []),
    ];
    const isBackstab = (id: string) => id === bs?.id;
    const rows = buildParticipantRows(parts, battle.combatants, {
      onRoll: fleeRoll,
      onReroll: fleeReroll,
      onBonusSL: fleeBonusSL,
      onDarkPact: fleeDarkPact,
      onForce: fleeForce,
      row: (part, actor) => (isBackstab(part.id)
        ? { combatant: actor, d: res?.attackerDetail ? { ...res.attackerDetail, label: 'Corps à corps (dans le dos)' } : undefined }
        : { combatant: actor, d: calme ? testBreakdown('Calme', calmeValue(mover), calme, 'intermediaire') : undefined }),
      // Issue courte sous la ligne du coup : « Touché · N Blessure(s) » / « Manqué ».
      note: (part) => (isBackstab(part.id) && res
        ? <p className="modal-log">{res.hit ? `Touché · ${res.woundsLost ?? 0} Blessure${(res.woundsLost ?? 0) > 1 ? 's' : ''}` : 'Manqué'}</p>
        : undefined),
    // Les rangées de cette coquille appartiennent au flux `flee` (≠ `disengage` de la coquille).
    }).map((r) => ({ ...r, flowKey: 'flee' as const })).map((r) => (isBackstab(String(r.key))
      ? { ...r, rollLabel: <><Icon id="nav/dice" size="sm" /> Lancer le coup dans le dos</> }
      : { ...r, rollLabel: <><Icon id="nav/dice" size="sm" /> Lancer le Test de Calme</> }));

    const rolled = !!res && (!needCalme || !!calme);
    const actions: RollAction[] = [{ key: 'confirm', label: 'Appliquer', onClick: fleeConfirm, when: 'post' }];

    return (
      <RollShell
        etape={pd.phase}
        flowKey="disengage"
        stake={flowStakeRef(DISENGAGE_STAKE[pd.phase])}
        title="Se désengager"
        extra={header}
        rows={rows}
        rolled={rolled}
        outcome={fleeOutcome
          ? [recapLineOfEvent(ev(needCalme ? 'fear' : 'flee', fleeOutcome, mover.id, foe.id), battle.combatants)]
          : undefined}
        actions={actions}
      />
    );
  }

  // ── Phase 'esquive' : Test OPPOSÉ (2 rangées) — le jet est déjà lancé en entrant ici. ──
  const outcome = describeDisengage(pd);
  const winnerIndex = pd.result === 'success' ? 1 : pd.result === 'failure' ? 0 : null;

  // Test OPPOSÉ Corps à corps (foe) / Esquive (mover) : la Difficulté est DÉCLARÉE UNE fois pour
  // l'opposition entière (LDB 12 l.166 ; jet de combat, LDB 13 l.118).
  // Modificateurs NOMMÉS de chaque côté, pris à la SOURCE que roule le résolveur : `baseTestMods` pour
  // le Corps à corps « brut » du foe (`rollDisengageAttack`), `defenseModifiers` pour l'Esquive du mover
  // (`rollMeleeDefender`) — jamais un +N anonyme dans la cible.
  const [foeLine, moverLine] = opposedLines([
    { label: 'Corps à corps', base: combatValue(foe, 'melee'), r: pd.atk, mods: baseTestModLines(foe, 'capacite-de-combat') },
    { label: 'Esquive', base: defenseValue(mover, 'esquive'), r: pd.def, mods: defenseModifiers(mover, 'esquive') },
  ]);
  // Rangée [0] = TÉMOIN : Corps à corps du foe, figé à l'ouverture (jamais relancé, aucun bouton) —
  // même calendrier de découverte que les autres jets figés (#990 : `pd.def` = la réponse du mover).
  const foeRow: BuiltRollRow = {
    key: 'foe',
    ...frozenOpposedRow(useGame.getState(), {
      ownerId: pd.foeId,
      responded: opposedResponded(useGame.getState(), [{ id: pd.moverId, interactive: true, result: pd.def }]),
      row: { combatant: foe, d: foeLine.d },
    }),
  };
  // Rangée [1] = INTERACTIVE : Esquive du mover, porteuse de son cycle d'influence.
  const moverRow: BuiltRollRow = buildRollRow({
    actor: mover,
    row: { combatant: mover, d: moverLine.d },
    rerolled: !!pd.rerolled,
    // Égalité comprise : l'opposition n'est pas emportée (LDB 17 l.68).
    lost: pd.result !== 'success',
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: forceSuccess,
  }, { key: 'mover' });

  const actions: RollAction[] = [
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      etape={pd.phase}
      flowKey="disengage"
      stake={flowStakeRef(DISENGAGE_STAKE[pd.phase])}
      title="Se désengager"
      extra={header}
      rows={[foeRow, moverRow]}
      rolled
      winnerIndex={winnerIndex}
      outcome={[recapLineOfEvent(ev(pd.result === 'success' ? 'dodge' : 'attack', outcome, mover.id, foe.id), battle.combatants)]}
      actions={actions}
    />
  );
}

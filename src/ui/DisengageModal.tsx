import { useGame } from '../state/store';
import { flowStakeRef, type FlowStakeId } from '../data';
import { StakeNote, StakeRule, stakeRuleOf } from './StakeNote';
import { groupAdvantage } from '../engine/advantagePool';
import { retreatAdvantageCost } from '../engine/combatFeatures/dispatch';
import { voieDAvantage, ligneDEsquiveDeDesengagement } from '../noyau/combat/desengagement';
import { ligneDeCorpsACorpsBrut } from '../noyau/combatManeuvers';
import { cibleBrute, cibleMesuree } from '../engine/tests';
import { ligneDuTestNomme } from '../noyau/rollFlowSpecs';
import { ResilienceButton } from './ResilienceButton';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction } from './RollShell';
import { buildParticipantRows, type ParticipantRow } from './buildParticipantRows';
import { VsHeader } from './VsHeader';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { describeDisengage, describeDisengageFlee } from '../noyau/flowOutcomes';
import { fleeBackstab, fleeTouche, fleeToucheDu, type PendingDisengage } from '../noyau/pendings';
import { Modal } from './Modal';
import { Stack } from './Layout';
import { Icon } from './Icon';
import { opposedLines, testBreakdown, testPending } from './breakdown';
import { opposedResponded } from './opposedFrozen';
import { buildRollRow, frozenOpposedRow, type BuiltRollRow } from './rollRowBuild';
import { libelleDeTest, libelleDuTestNomme } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';

/** Enjeu servi par chaque fenêtre du Désengagement. */
const DISENGAGE_STAKE: Record<PendingDisengage['phase'], FlowStakeId> = { choice: 'disengage-choice', esquive: 'disengage-esquive', fuir: 'disengage-fuir' };

/**
 * Modale de Désengagement (LDB 15 l.43-68). Trois phases, une seule coquille de jet PARTAGÉE :
 * - **'choice'** : PAS un jet — le MENU d'options (`OptionChooser`) Sacrifier l'Avantage / Esquiver /
 *   Fuir + Résilience pré-jet, rendu dans un `Modal` simple (RollShell ne fait pas les menus).
 * - **'esquive'** : `RollShell` opposé (2 rangées) — [0] Corps à corps du foe FIGÉ (témoin) vs
 *   [1] Esquive du mover INTERACTIVE (cycle d'influence), `winnerIndex`/`outcome`. Appliquer = `jetConfirm('disengage')`.
 * - **'fuir'** : `RollShell` (flux MULTI `flee`, 2 slots) — [0] le coup dans le dos du FRAPPEUR,
 *   [1] le Test du FUYARD (fiche `fuite`, présent seulement si le coup a fait des Blessures). Chaque rangée
 *   est INTERACTIVE pour son contrôleur humain, TÉMOIN sinon. Appliquer = `jetConfirm('flee')`.
 */
export function DisengageModal() {
  const pd = useGame((s) => s.pendingDisengage);
  const battle = useGame((s) => s.battle);
  const regler = useGame((s) => s.jetRegler);
  const esquiver = useGesteDeJet('jetRoll', 'disengage');
  const reroll = useGesteDeJet('jetReroll', 'disengage');
  const bonusSL = useGesteDeJet('jetBonusSL', 'disengage');
  const darkPact = useGesteDeJet('jetDarkPact', 'disengage');
  const forceSuccess = useGesteDeJet('jetForceSuccess', 'disengage');
  const confirm = useGesteDeJet('jetConfirm', 'disengage');
  const fleeRoll = useGesteDeJet('jetRoll', 'flee');
  const fleeReroll = useGesteDeJet('jetReroll', 'flee');
  const fleeBonusSL = useGesteDeJet('jetBonusSL', 'flee');
  const fleeDarkPact = useGesteDeJet('jetDarkPact', 'flee');
  const fleeForce = useGesteDeJet('jetForceSuccess', 'flee');
  const fleeConfirm = useGesteDeJet('jetConfirm', 'flee');
  const cancel = useGesteDeJet('jetCancel', 'disengage');
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
    // L'intitulé suit la VOIE que le verdict a ouverte (`voieDAvantage`), jamais une supposition.
    const voie = voieDAvantage({ active: mover, battle });
    const sacrificeTitle = voie ? {
      'retraite-strategique': `Dépense ${retreatCost} Avantage(s) de la réserve du camp pour rompre le combat, sans coût d'Action`,
      impitoyable: "Impitoyable : dépense ton Avantage pour partir librement, sans coût d'Action",
      'avantage-superieur': "Tu as l'Avantage supérieur : pars librement, sans coût d'Action",
    }[voie] : undefined;
    const offertes = [
      { stake: groupMode ? flowStakeRef('disengage-retraite', { values: { cout: retreatCost } }) : flowStakeRef('disengage-sacrifice'),
        option: { key: 'sacrifice', label: sacrificeLabel, hidden: !pd.canSacrifice, onSelect: () => regler('disengage', 'sacrifier', true), title: sacrificeTitle } },
      { stake: flowStakeRef('disengage-esquive'),
        option: { key: 'esquive', label: <><Icon id="melee/tumble" size="sm" /> Esquiver</>, value: ligneDEsquiveDeDesengagement(useGame.getState(), mover).target, hidden: !!pd.refusEsquive, onSelect: esquiver, title: "Test opposé d'Esquive — coûte ton Action" } },
      { stake: flowStakeRef('disengage-fuir'),
        option: { key: 'fuir', label: <><Icon id="melee/flee" size="sm" /> Fuir (coup dans le dos)</>, hidden: pd.canFuir === false, onSelect: () => regler('disengage', 'fuir', true), title: 'Tu tournes le dos : attaque gratuite contre toi (+20), puis tu cours si tu en es encore capable' } },
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
            {pd.refusEsquive && <p className="modal-log">Esquive fermée : {pd.refusEsquive}.</p>}
          </div>
          {/* Le renoncement (`disengage-choice`) : note du geste « Renoncer » du pied. */}
          <StakeNote stake={choiceStake} />
          <div className="rm-influence">
            {/* Résilience AVANT le jet (LDB 17 l.68) : Esquive forcée en réussite. */}
            {!pd.refusEsquive && (
              <ResilienceButton resilience={mover.resilience ?? 0} show={(mover.resilience ?? 0) > 0} onForce={() => { esquiver(); forceSuccess(); }} />
            )}
          </div>
        </Stack>
      </Modal>
    );
  }

  // ── Phase 'fuir' : DEUX rangées, une par acteur — coup dans le dos du frappeur, Test de la fiche
  //    `fuite` du fuyard. Les DÉRIVATIONS d'influence viennent de la primitive PARTAGÉE `buildParticipantRows`
  //    (source unique des 6 modales multi) ; la modale ne fournit que la PRÉSENTATION de ses rangées. ──
  if (pd.phase === 'fuir') {
    const bs = fleeBackstab(pd);
    const toucheSlot = fleeTouche(pd);
    const res = bs?.result;
    const jet = toucheSlot?.jet;
    const toucheDu = fleeToucheDu(pd); // LDB 15 l.66
    const fleeOutcome = describeDisengageFlee(pd);

    // Projection des slots HÉTÉROGÈNES vers la forme `ParticipantRow` attendue par la primitive : le
    // jet de l'acteur (dé/cible/DR/réussite) — coup dans le dos = son `attackerDetail`, Test `fuite` = son jet.
    const parts: ParticipantRow[] = [
      ...(bs ? [{ id: bs.id, interactive: bs.interactive, rerolled: bs.rerolled, result: res?.attackerDetail ?? null }] : []),
      ...(toucheDu && toucheSlot
        ? [{ id: toucheSlot.id, interactive: toucheSlot.interactive, rerolled: toucheSlot.rerolled, result: jet ? { ...jet, target: jet.target ?? 0 } : null }]
        : []),
    ];
    const isBackstab = (id: string) => id === bs?.id;
    // Le Test du fuyard (fiche `fuite`) : sa ligne AVANT le jet comme après, par les mêmes primitives.
    const ligneDuTest = (test: NonNullable<typeof toucheSlot>['test'], r: typeof jet) => {
      const label = libelleDuTestNomme(test);
      const l = ligneDuTestNomme(mover, test); // la ligne que le résolveur `flee` jette
      return r ? { d: testBreakdown(label, l.base, r, l.difficulty, l.mods) } : { pending: testPending(label, l.base, cibleMesuree(l), l.difficulty, l.mods) };
    };
    const rows = buildParticipantRows(parts, battle.combatants, {
      onRoll: fleeRoll,
      onReroll: fleeReroll,
      onBonusSL: fleeBonusSL,
      onDarkPact: fleeDarkPact,
      onForce: fleeForce,
      row: (part, actor) => (isBackstab(part.id)
        ? { combatant: actor, d: res?.attackerDetail ? { ...res.attackerDetail, label: libelleDeTest('dans-le-dos') } : undefined }
        : { combatant: actor, ...(toucheSlot ? ligneDuTest(toucheSlot.test, jet) : {}) }),
      // Issue courte sous la ligne du coup : « Touché · N Blessure(s) » / « Manqué ».
      note: (part) => (isBackstab(part.id) && res
        ? <p className="modal-log">{res.hit ? `Touché · ${res.woundsLost ?? 0} Blessure${(res.woundsLost ?? 0) > 1 ? 's' : ''}` : 'Manqué'}</p>
        : undefined),
    // Les rangées de cette coquille appartiennent au flux `flee` (≠ `disengage` de la coquille).
    }).map((r) => ({ ...r, flowKey: 'flee' as const })).map((r) => (isBackstab(String(r.key))
      ? { ...r, rollLabel: <><Icon id="nav/dice" size="sm" /> Lancer le coup dans le dos</> }
      : { ...r, rollLabel: <><Icon id="nav/dice" size="sm" /> Lancer le Test</> }));

    const rolled = !!res && (!toucheDu || !!jet);
    const actions: RollAction[] = [{ key: 'confirm', label: t('verbe.confirm'), onClick: fleeConfirm, verbe: 'confirm', flux: 'flee' }];

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
          ? [recapLineOfEvent(ev(toucheDu ? 'fear' : 'flee', fleeOutcome, mover.id, foe.id), battle.combatants)]
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
  // Lignes : `ligneDeCorpsACorpsBrut` (foe) et `ligneDEsquiveDeDesengagement` (mover), celles des résolveurs.
  const foeL = ligneDeCorpsACorpsBrut(foe);
  const esq = ligneDEsquiveDeDesengagement(useGame.getState(), mover);
  const [foeLine, moverLine] = opposedLines([
    { label: libelleDeTest('corps-a-corps'), base: foeL.base, target: cibleBrute(foeL), r: pd.atk, mods: foeL.mods },
    { label: libelleDeTest('esquive'), base: esq.base, target: cibleBrute(esq), r: pd.def, mods: [...esq.mods, ...(esq.difficultyParts ?? [])] },
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
    { key: 'confirm', label: t('verbe.confirm'), onClick: confirm, verbe: 'confirm' },
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

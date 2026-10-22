import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { FLOWS, opposedForcingCancelled, OPPOSED_FORCING_CANCELLED_NOTE } from '../../noyau/rollFlowSpecs';
import { fenetreDeDefense } from '../../noyau/fenetreDeDefense';
import { libelleDuJet } from '../../noyau/libelles';
import { t } from '../../i18n';
import { defenseDodgeMods, defenseGagneeEnMelee } from '../../noyau/combatFlow';
import { defenseValue, defenseBaseValue, defenseValueModParts, defenseModifiers, defenseTestOf, issueAuJet, coupAApplique, type DefenseMode } from '../../engine/combat';
import { shieldReactionCost, contreSurDefenseGagnee, contresEpuisees } from '../../engine/combatFeatures/dispatch';
import { composeRollLabel } from '../../noyau/rollSeam';
import { RollShell, type RollAction } from '../RollShell';
import { opposedResponded } from '../opposedFrozen';
import { buildRollRow, frozenOpposedRow } from '../rollRowBuild';
import { OptionChooser } from '../OptionChooser';
import { optionValue, opposedLines } from '../breakdown';
import { VsHeader } from '../VsHeader';
import { DeterminationButton } from '../DeterminationButton';
import { recapLineOfEvent } from '../../gameIso/combatNarration';
import { ev } from '../../noyau/combatLog';
import { Icon } from '../Icon';
import { CodexRef } from '../compendium/CodexRef';

/** Le titre d'une réaction de Défense, au survol de son option. */
function titreDeLaReaction(mode: DefenseMode, libelle: string): string {
  if (mode === 'parade') return 'Parer avec son arme (Corps à corps)';
  if (mode === 'esquive') return 'Esquiver (Agilité)';
  return `${libelle} à la place de Corps à corps : l’attaquant a peur de vous`;
}

/**
 * PARAMÉTRAGE de la coquille partagée `RollShell` pour le JET de défense réactive — hook à part de
 * `DefenseModal`, pour être rendu à l'IDENTIQUE par la séquence de combat (`CascadeModal` rend l'étape-jet
 * `jet:'defense'` via ce hook, sans démonter la coquille → la défense ET son Critique/Maladresse vivent
 * dans UNE seule fenêtre). Renvoie les props de `RollShell`, ou `null` si aucune défense en attente.
 * La rangée de l'ATTAQUANT est FIGÉE (`interactive:false`) ; MA rangée porte le cycle d'influence.
 * PAS de « Subir » : le RAW n'offre aucune non-défense volontaire (mêlée = Test opposé, LDB 13 l.123)
 * — la défense est obligatoire une fois la modale ouverte. AUCUNE mécanique générique réécrite : que du métier.
 */
export function useDefenseJetProps(): ComponentProps<typeof RollShell> | null {
  const pd = useGame((s) => s.pendingDefense);
  const battle = useGame((s) => s.battle);
  const setMode = useGame((s) => s.defenseSetMode);
  const setParry = useGame((s) => s.defenseSetParryWeapon);
  const setShieldReaction = useGame((s) => s.defenseSetShieldReaction);
  const setRiposte = useGame((s) => s.defenseSetRiposte);
  const roll = useGame((s) => s.defenseRoll);
  const reroll = useGame((s) => s.defenseReroll);
  const bonusSL = useGame((s) => s.defenseBonusSL);
  const darkPact = useGame((s) => s.defenseDarkPact);
  const forceSuccess = useGame((s) => s.defenseForceSuccess);
  const reverseVerb = useGame((s) => s.defenseReverse);
  const confirm = useGame((s) => s.defenseConfirm);
  const spendResolve = useGame((s) => s.spendResolveCondition);
  const vue = pd && battle ? fenetreDeDefense(useGame.getState()) : null;
  if (!pd || !battle || !vue) return null;
  const attacker = battle.combatants.find((c) => c.id === vue.attaquantId);
  const defender = battle.combatants.find((c) => c.id === vue.defenseurId);
  if (!attacker || !defender) return null;
  const res = pd.result;
  const issue = res ? issueAuJet(defender, coupAApplique(res, pd.suite.mode === 'pilotee' ? pd.suite.pa.grapple : pd.suite.coup.grapple, defender), pd.weapon, attacker) : null;
  const rolled = !!res;
  // Armes pouvant parer et arme de parade du jet : la fenêtre de Défense du noyau (`fenetreDeDefense`).
  const chosenParry = vue.parade;
  // Lignes d'Esquive du contexte (neige, monté) : MÊME source que le jet résolu (`defenseDodgeMods`).
  const dodgeMods = defenseDodgeMods(useGame.getState(), defender);
  // Substitution sociale de la réaction : la fenêtre de Défense du noyau (`fenetreDeDefense.social`).
  const sub = vue.social;
  // Base de la défense sociale (mode 'social') = valeur de Test de la Compétence substituée.
  const socialBase = pd.mode === 'social' ? sub?.valeur : undefined;
  // MA ligne pré-remplie : valeur + mods de la défense CHOISIE (recalculés à chaque changement). La météo
  // « Tests physiques » du jour (#341) arrive par le CANAL UNIQUE : `defenseModifiers` lit `defender.envWeather`
  // et pousse la ligne « Météo » scopée par la carac du mode (Parade→CC, Esquive→Agilité) — zéro câblage ici.
  // Base NUE + modificateurs de la VALEUR nommés (`defenseValueModParts`) + modificateurs du jet : la Σ reste
  // la valeur jetée.
  const myMods = [...defenseValueModParts(defender, pd.mode, chosenParry), ...defenseModifiers(defender, pd.mode, dodgeMods, pd.mode === 'parade' ? chosenParry : undefined)];
  const myBase = defenseBaseValue(defender, pd.mode, chosenParry, socialBase);
  const myLabel = vue.test;
  // Z1 (`docs/charte-ui.md`) : le DÉFENSEUR, et les ids du Test du mode CHOISI (`defenseTestOf`, LDB 13 l.161-167).
  const defenseTest = defenseTestOf(defender, pd.mode, chosenParry, pd.substituteSkillId ?? sub?.skillId);
  // Valeurs affichées sur le segmented control (chaque option montre SA valeur effective).
  const segVal = (mode: DefenseMode) =>
    optionValue(defenseValue(defender, mode, chosenParry, mode === 'social' ? sub?.valeur : undefined), defenseModifiers(defender, mode, dodgeMods, mode === 'parade' ? chosenParry : undefined));
  // Inversion de Test (LDB 23 l.209/218, LDB 10 — CHOIX du joueur, #558) : offerte dès qu'une voie
  // (Talent/jeton) est applicable (`reverseAvailable`, pure) ; `reversePreview` rend l'issue LISIBLE
  // avant le clic (le jeton, libre, peut dégrader un succès existant).
  const reverseAvail = rolled && FLOWS.defense.reverseAvailable(useGame.getState);
  const reversePreview = reverseAvail ? FLOWS.defense.reversePreview(useGame.getState) : null;

  // Réaction de Porte-Bouclier (variante « Avantage de groupe », AA 13 l.84) : offerte quand on se défend
  // au Bouclier (parade), 1×/Round, si la réserve du camp (projetée sur `defender.advantage`) couvre le coût.
  // Coût + éligibilité viennent de la DONNÉE (`shieldReactionCost`), jamais d'un nom en dur.
  const reactionCost = pd.mode === 'parade' ? shieldReactionCost(defender, chosenParry) : 0;
  const canReact = reactionCost > 0 && !defender.usedShieldReactionRound && (defender.advantage ?? 0) >= reactionCost;
  const toggleReaction = (kind: 'damage' | 'push') => setShieldReaction(pd.shieldReaction === kind ? null : kind);
  // LDB 10 l.1037
  const contre = pd.mode === 'parade' ? contreSurDefenseGagnee(defender, chosenParry) : null;
  const riposteChoisie = !!contre?.choisie;
  const ripostesPortees = contre ? contresEpuisees(defender, contre) : null;
  const refusRiposte = ripostesPortees != null ? `Riposte déjà portée ${ripostesPortees} fois ce Round : Niveau ${contre!.plafond}.` : undefined;
  const riposte = !refusRiposte && pd.riposte !== false;
  const JET_LANCE = 'Le jet est lancé : la réaction se déclare avant.';
  const defenseGagnee = !!res && defenseGagneeEnMelee(attacker, defender, pd.weapon, res);
  /** La cause du refus d'une option de Porte-bouclier, une phrase par cause. AA 13 l.84 ; LDB 13 l.123. */
  const refusReaction = (kind: 'damage' | 'push'): string | undefined => {
    if (res) return kind === 'damage' && !defenseGagnee ? 'Défense non gagnée : pas de Dégâts.' : JET_LANCE;
    if (canReact || pd.shieldReaction === kind) return undefined;
    // Le volet n'existe que sous `reactionCost > 0` : des trois conditions de `canReact`, l'une des DEUX
    // restantes est fausse — la dernière est le reste.
    if (defender.usedShieldReactionRound) return 'Réaction de Porte-Bouclier déjà utilisée ce Round.';
    return `Il faut ${reactionCost} Avantages : ${defender.label} en a ${defender.advantage ?? 0}.`;
  };
  // Une réaction DÉCLARÉE reste à l'écran après le jet (`postRollExtra`), figée, avec sa cause.
  const refusOui = refusRiposte ?? (res ? (defenseGagnee ? JET_LANCE : 'Défense non gagnée : pas de Riposte.') : undefined);
  const riposteChoix = riposteChoisie && (
    <OptionChooser
      layout="seg"
      groupLabel={<CodexRef category="talents" id="riposte" label="Riposte" />}
      options={[
        { key: 'oui', label: t('valeur.oui'), selected: riposte, refus: refusOui, onSelect: () => setRiposte(true) },
        { key: 'non', label: t('valeur.non'), selected: !refusRiposte && !riposte, refus: refusRiposte ?? (res ? JET_LANCE : undefined), onSelect: () => setRiposte(false) },
      ]}
    />
  );
  const porteBouclier = reactionCost > 0 && (
    <OptionChooser
      layout="seg"
      groupLabel={<CodexRef category="talents" id="porte-bouclier" label="Porte-bouclier">Porte-bouclier ({reactionCost} Av.)</CodexRef>}
      options={[
        { key: 'damage', label: t('valeur.damage'), selected: pd.shieldReaction === 'damage', refus: refusReaction('damage'), onSelect: () => toggleReaction('damage') },
        { key: 'push', label: t('valeur.push'), selected: pd.shieldReaction === 'push', refus: refusReaction('push'), onSelect: () => toggleReaction('push') },
      ]}
    />
  );

  // NATURE de l'attaque figée, telle que la frappe l'a DÉCLARÉE en ouvrant la fenêtre (#1858) : une
  // gratuite de créature s'annonce par la sienne (Morsure, Attaque caudale… LDB 85), le reste est une
  // Attaque. L'affichage ne devine rien — il lit la suite portée par la fenêtre.
  const kindGratuit = pd.suite.mode === 'machine' ? pd.suite.coup.manoeuvre?.kind : undefined;
  // Attaque et défense sont les DEUX lignes d'un même Test opposé : la Difficulté est déclarée UNE
  // fois à la fabrique (LDB 12 l.166 ; jet de Combat, LDB 13 l.118).
  const [attackLine, defenseLine] = opposedLines([
    {
      label: kindGratuit ? pd.weapon.label : 'Attaque',
      base: pd.atk.target,
      r: { roll: pd.atk.roll, target: pd.atk.target, sl: pd.atk.sl, success: pd.atk.success },
    },
    { label: myLabel, base: myBase, mods: myMods },
  ]);
  // Rangée [0] = TÉMOIN : l'attaque FIGÉE (jet déjà eu lieu, aucun bouton), MASQUÉE tant que ce siège
  // n'a pas répondu (#990, calendrier unique `frozenOpposedRow` — mono = N=1 participant : moi).
  const attackerRow = frozenOpposedRow(useGame.getState(), {
    ownerId: pd.attackerId,
    responded: opposedResponded(useGame.getState(), [{ id: pd.defenderId, interactive: true, result: res }]),
    row: {
      combatant: attacker,
      d: res ? res.attackerDetail : attackLine.d,
    },
  });
  // Rangée [1] = INTERACTIVE : MA défense (pré-remplie puis résolue), porteuse du cycle d'influence.
  const defenderRow = buildRollRow({
    actor: defender,
    row: res
      ? { combatant: defender, d: res.defenderDetail }
      : { combatant: defender, pending: defenseLine.pending },
    onRoll: roll,
    rerolled: !!pd.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: forceSuccess,
  }, {
    rollFrisson: true,
    fortune: defender.fortune ?? 0,
    resilience: defender.resilience ?? 0,
    preRollForce: () => { roll(); forceSuccess(); },
    reverse: reverseAvail ? { onReverse: reverseVerb, preview: reversePreview } : undefined,
  });

  const actions: RollAction[] = [
    { key: 'confirm', label: t('verbe.confirm'), onClick: confirm, when: 'post' },
  ];

  return {
    flowKey: 'defense',
    title: libelleDuJet('defense'),
    subtitle: composeRollLabel(defender, libelleDuJet('defense'), defenseTest),
    extra: <VsHeader actor={attacker} target={defender} label={vue.arme} />,
    disableEscClose: true,
    rolled,
    /* Options pré-jet (Parade/Esquive/social + arme de parade) + bouton Détermination (retirer un État). */
    setup: (
      <>
        <div className="rm-options">
          {/* Réaction : segmented control PARTAGÉ — chaque option affiche SA valeur effective (mods compris). */}
          <OptionChooser
            layout="seg"
            groupLabel={vue.reaction.libelle}
            options={vue.reaction.options.map((o) => {
              const mode = o.valeur as DefenseMode;
              return { key: mode, label: o.libelle, value: segVal(mode), selected: pd.mode === mode, title: titreDeLaReaction(mode, o.libelle), onSelect: () => setMode(mode, mode === 'social' ? sub?.skillId : undefined) };
            })}
          />
          {vue.armeDeParade && (
            <div className="rm-loc-inline">
              <span className="mini-title">{vue.armeDeParade.libelle}</span>
              <select
                className="rm-loc-select"
                value={vue.armeDeParade.choisie ?? ''}
                onChange={(e) => setParry(e.target.value || null)}
              >
                {vue.armeDeParade.options.map((o) => (
                  <option key={o.valeur ?? ''} value={o.valeur ?? ''}>{o.libelle}</option>
                ))}
              </select>
              <CodexRef category="regles" id="main-secondaire" label="Attaque de la main secondaire" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
            </div>
          )}
          {porteBouclier}
          {riposteChoix}
        </div>
        <DeterminationButton combatant={defender} onSpend={(name) => spendResolve(defender.id, name)} />
      </>
    ),
    rows: [attackerRow, defenderRow],
    winnerIndex: res?.defenderDetail ? (res.hit ? 0 : 1) : undefined,
    netSL: res?.defenderDetail ? res.netSL : undefined,
    outcome: res
      ? [recapLineOfEvent(
          ev(issue?.compte.critiques.length ? 'crit' : res.hit ? 'damage' : pd.mode === 'parade' ? 'parry' : 'dodge', issue?.ligne ?? res.log, attacker.id, defender.id),
          battle.combatants,
        )]
      : undefined,
    /* #1000 : les deux camps ont forcé — l'arbitrage APPLIQUÉ (garanties éteintes) est AFFICHÉ. */
    postRollExtra: res && (
      <>
        {((pd.shieldReaction && porteBouclier) || (!refusRiposte && riposteChoix)) && (
          <div className="rm-options">
            {pd.shieldReaction && porteBouclier}
            {!refusRiposte && riposteChoix}
          </div>
        )}
        {opposedForcingCancelled(pd) && <p className="rm-note">{OPPOSED_FORCING_CANCELLED_NOTE}</p>}
      </>
    ),
    actions,
  };
}

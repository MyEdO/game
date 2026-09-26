import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { garanti } from '../../state/combatants';
import { FLOWS, opposedForcingCancelled, OPPOSED_FORCING_CANCELLED_NOTE } from '../../state/rollFlowSpecs';
import { defenseValue, defenseModifiers, DEFENSE_LABEL, FREE_ATTACK_LABEL, type DefenseMode } from '../../engine/combat';
import { shieldReactionCost } from '../../engine/combatFeatures/dispatch';
import { combatSubstitute } from '../../engine/skillCombatApps';
import { byId } from '../../data/index';
import { composeRollLabel } from '../../state/rollSeam';
import { isUnarmed } from '../../engine/items';
import { RollShell, type RollAction } from '../RollShell';
import { opposedResponded } from '../opposedFrozen';
import { buildRollRow, frozenOpposedRow } from '../rollRowBuild';
import { OptionChooser } from '../OptionChooser';
import { optionValue, opposedLines } from '../breakdown';
import { VsHeader } from '../VsHeader';
import { DeterminationButton } from '../DeterminationButton';
import { recapLineOfEvent } from '../../gameIso/combatNarration';
import { ev } from '../../state/combatLog';
import { Icon } from '../Icon';
import { CodexRef } from '../compendium/CodexRef';

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
  const roll = useGame((s) => s.defenseRoll);
  const reroll = useGame((s) => s.defenseReroll);
  const bonusSL = useGame((s) => s.defenseBonusSL);
  const darkPact = useGame((s) => s.defenseDarkPact);
  const forceSuccess = useGame((s) => s.defenseForceSuccess);
  const reverseVerb = useGame((s) => s.defenseReverse);
  const confirm = useGame((s) => s.defenseConfirm);
  const spendResolve = useGame((s) => s.spendResolveCondition);
  if (!pd || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
  const defender = battle.combatants.find((c) => c.id === pd.defenderId);
  if (!attacker || !defender) return null;
  const res = pd.result;
  const rolled = !!res;
  // Armes pouvant parer (hors Mains nues) ; arme de parade choisie (défaut = main principale).
  const parryPickable = defender.weapons.filter((w) => !isUnarmed(w) && !!w.uid);
  const chosenParry = pd.parryWeaponUid ? defender.weapons.find((w) => w.uid === pd.parryWeaponUid) : defender.weapons[0];
  // Substitution sociale (LDB 09 l.207/287) : proposée en MÊLÉE quand une Compétence sociale
  // (Intimidation/Dressage `combatSubstitute`) est utilisable en défense — l'attaquant a PEUR du
  // défenseur (gate `fear`). Data-driven : l'option existe parce que la donnée+le gate le disent.
  const sub = pd.weapon.type === 'melee' ? combatSubstitute(defender, attacker, 'defense') : null;
  const socialLabel = sub ? garanti(byId('skill', sub.skillId), sub.skillId, 'compétence de substitution').label : undefined;
  // Base de la défense sociale (mode 'social') = valeur de Test de la Compétence substituée.
  const socialBase = pd.mode === 'social' ? sub?.value : undefined;
  // MA ligne pré-remplie : valeur + mods de la défense CHOISIE (recalculés à chaque changement). La météo
  // « Tests physiques » du jour (#341) arrive par le CANAL UNIQUE : `defenseModifiers` lit `defender.envWeather`
  // et pousse la ligne « Météo » scopée par la carac du mode (Parade→CC, Esquive→Agilité) — zéro câblage ici.
  const myMods = defenseModifiers(defender, pd.mode, 0, pd.mode === 'parade' ? chosenParry : undefined);
  const myBase = defenseValue(defender, pd.mode, chosenParry, socialBase);
  const myLabel = pd.mode === 'social' ? (socialLabel ?? 'Intimidation') : DEFENSE_LABEL[pd.mode];
  // Résolution alternative de l'arme de parade (`Weapon.resolveChar`) : la base vient déjà d'elle
  // (`defenseValue`), le sous-titre nomme donc la MÊME Caractéristique (#203+, `attackTestLabel`).
  // Z1 (`docs/charte-ui.md`) : l'acteur du jet est le DÉFENSEUR, sa Compétence celle du mode CHOISI —
  // Parade = Corps à corps, Esquive = Esquive, substitution = la Compétence figée sur le pending
  // (`substituteSkillId`, LDB 13 l.161-167). Ids stables : le libellé est dérivé par `composeRollLabel`.
  const defenseTest = pd.mode === 'parade' && chosenParry?.resolveChar
    ? { char: chosenParry.resolveChar }
    : { skill: pd.mode === 'social' ? pd.substituteSkillId ?? sub?.skillId : pd.mode === 'esquive' ? 'esquive' : 'corps-a-corps' };
  // Valeurs affichées sur le segmented control (chaque option montre SA valeur effective).
  const segVal = (mode: DefenseMode) =>
    optionValue(defenseValue(defender, mode, chosenParry, mode === 'social' ? sub?.value : undefined), defenseModifiers(defender, mode, 0, mode === 'parade' ? chosenParry : undefined));
  // Inversion de Test (LDB 23 l.209/218, LDB 10 — CHOIX du joueur, #558) : offerte dès qu'une voie
  // (Talent/jeton) est applicable (`reverseAvailable`, pure) ; `reversePreview` rend l'issue LISIBLE
  // avant le clic (le jeton, libre, peut dégrader un succès existant).
  const reverseAvail = rolled && FLOWS.defense.reverseAvailable(useGame.getState, useGame.setState);
  const reversePreview = reverseAvail ? FLOWS.defense.reversePreview(useGame.getState, useGame.setState) : null;
  // `pd.modes` (tir) limite les réactions proposées ; absent = mêlée (Parade + Esquive). Filtre seul.
  const allowMode = (m: 'parade' | 'esquive') => !pd.modes || pd.modes.includes(m);

  // Réaction de Porte-Bouclier (variante « Avantage de groupe », AA 13 l.84) : offerte quand on se défend
  // au Bouclier (parade), 1×/Round, si la réserve du camp (projetée sur `defender.advantage`) couvre le coût.
  // Coût + éligibilité viennent de la DONNÉE (`shieldReactionCost`), jamais d'un nom en dur.
  const reactionCost = pd.mode === 'parade' ? shieldReactionCost(defender, chosenParry) : 0;
  const canReact = reactionCost > 0 && !defender.usedShieldReactionRound && (defender.advantage ?? 0) >= reactionCost && !rolled;
  const toggleReaction = (kind: 'damage' | 'push') => setShieldReaction(pd.shieldReaction === kind ? null : kind);
  /** La CAUSE du refus d'une réaction, dans l'ordre où `canReact` la décide — une phrase par cause, pas
   *  la description de l'option (qui reste en `title` quand elle est offerte). */
  const refusReaction = (kind: 'damage' | 'push'): string | undefined => {
    if (canReact || pd.shieldReaction === kind) return undefined;
    // Le volet n'existe que sous `reactionCost > 0` (plus bas) et `canReact` est FAUX ici : des quatre
    // conditions de `canReact` (:90), le coût est vrai, donc l'une des TROIS autres est fausse. Elles
    // sont énumérées dans l'ordre où `canReact` les décide, et la dernière est le reste — aucun repli
    // à écrire, il ne serait jamais lu.
    if (defender.usedShieldReactionRound) return 'Réaction de Porte-Bouclier déjà utilisée ce Round.';
    if ((defender.advantage ?? 0) < reactionCost) return `Il faut ${reactionCost} Avantages : ${defender.label} en a ${defender.advantage ?? 0}.`;
    return 'Le jet est lancé : la réaction se déclare avant.';
  };

  // NATURE de l'attaque figée, telle que la frappe l'a DÉCLARÉE en ouvrant la fenêtre (#1858) : une
  // gratuite de créature s'annonce par la sienne (Morsure, Attaque caudale… LDB 85), le reste est une
  // Attaque. L'affichage ne devine rien — il lit la suite portée par la fenêtre.
  const kindGratuit = pd.suite.mode === 'machine' ? pd.suite.coup.freeAttack?.kind : undefined;
  // Attaque et défense sont les DEUX lignes d'un même Test opposé : la Difficulté est déclarée UNE
  // fois à la fabrique (LDB 12 l.166 ; jet de Combat, LDB 13 l.118).
  const [attackLine, defenseLine] = opposedLines([
    {
      label: kindGratuit ? FREE_ATTACK_LABEL[kindGratuit] ?? 'Attaque gratuite' : 'Attaque',
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
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return {
    flowKey: 'defense',
    title: 'Défense',
    subtitle: composeRollLabel(defender, 'Défense', defenseTest),
    extra: <VsHeader actor={attacker} target={defender} label={pd.weapon?.label ?? 'Mains nues'} />,
    disableEscClose: true,
    rolled,
    /* Options pré-jet (Parade/Esquive/social + arme de parade) + bouton Détermination (retirer un État). */
    setup: (
      <>
        <div className="rm-options">
          {/* Réaction : segmented control PARTAGÉ — chaque option affiche SA valeur effective (mods compris). */}
          <OptionChooser
            layout="seg"
            groupLabel="Réaction"
            options={[
              ...(allowMode('parade') ? [{ key: 'parade', label: 'Parade', value: segVal('parade'), selected: pd.mode === 'parade', title: 'Parer avec son arme (Corps à corps)', onSelect: () => setMode('parade') }] : []),
              ...(allowMode('esquive') ? [{ key: 'esquive', label: 'Esquive', value: segVal('esquive'), selected: pd.mode === 'esquive', title: 'Esquiver (Agilité)', onSelect: () => setMode('esquive') }] : []),
              ...(sub ? [{ key: 'social', label: socialLabel!, value: segVal('social'), selected: pd.mode === 'social', title: `${socialLabel} à la place de Corps à corps : l’attaquant a peur de vous`, onSelect: () => setMode('social', sub.skillId) }] : []),
            ]}
          />
          {pd.mode === 'parade' && parryPickable.length >= 2 && (
            <div className="rm-loc-inline">
              <span className="mini-title">Parer avec</span>
              <select
                className="rm-loc-select"
                value={pd.parryWeaponUid ?? chosenParry?.uid ?? ''}
                onChange={(e) => setParry(e.target.value || null)}
              >
                {parryPickable.map((w) => (
                  <option key={w.uid} value={w.uid}>{w.label}{w.hand === 'off' ? ' (2nde)' : ''}</option>
                ))}
              </select>
              <CodexRef category="regles" id="main-secondaire" label="Attaque de la main secondaire" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
            </div>
          )}
          {reactionCost > 0 && (
            <OptionChooser
              layout="seg"
              groupLabel={`Porte-Bouclier (${reactionCost} Av.)`}
              options={[
                // Une réaction hors de portée porte sa CAUSE au survol/focus/tap (`refus`) — pas la
                // description de l'option, qui reste en `title` quand elle est offerte.
                { key: 'damage', label: 'Dégâts', selected: pd.shieldReaction === 'damage', refus: refusReaction('damage'), title: refusReaction('damage') ? undefined : `Dépenser ${reactionCost} Avantages pour causer des Dégâts comme s’il s’agissait de votre Action (AA — 1×/Round)`, onSelect: () => toggleReaction('damage') },
                { key: 'push', label: 'Repousser', selected: pd.shieldReaction === 'push', refus: refusReaction('push'), title: refusReaction('push') ? undefined : `Dépenser ${reactionCost} Avantages pour repousser l’attaquant de 2 m et vous désengager (AA — 1×/Round)`, onSelect: () => toggleReaction('push') },
              ]}
            />
          )}
        </div>
        <DeterminationButton combatant={defender} onSpend={(name) => spendResolve(defender.id, name)} />
      </>
    ),
    rows: [attackerRow, defenderRow],
    winnerIndex: res?.defenderDetail ? (res.hit ? 0 : 1) : undefined,
    netSL: res?.defenderDetail ? res.netSL : undefined,
    outcome: res
      ? [recapLineOfEvent(
          ev(res.critical ? 'crit' : res.hit ? 'damage' : pd.mode === 'parade' ? 'parry' : 'dodge', res.log, attacker.id, defender.id),
          battle.combatants,
        )]
      : undefined,
    /* #1000 : les deux camps ont forcé — l'arbitrage APPLIQUÉ (garanties éteintes) est AFFICHÉ. */
    postRollExtra: res && opposedForcingCancelled(pd) ? <p className="rm-note">{OPPOSED_FORCING_CANCELLED_NOTE}</p> : undefined,
    actions,
  };
}

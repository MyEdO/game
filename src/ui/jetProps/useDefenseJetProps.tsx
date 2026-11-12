import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { FLOWS, opposedForcingCancelled, OPPOSED_FORCING_CANCELLED_NOTE } from '../../noyau/rollFlowSpecs';
import { fenetreDeDefense } from '../../noyau/fenetreDeDefense';
import { libelleDuJet } from '../../noyau/libelles';
import { t } from '../../i18n';
import { defenseTestOf, type DefenseMode } from '../../engine/combat';
import { composeRollLabel } from '../../noyau/rollSeam';
import { RollShell, type RollAction } from '../RollShell';
import { JET_FIGE, jetFigeRevele } from '../../noyau/netOwnership';
import { libelleDeLAttaqueFigee } from '../../noyau/jetsEnVue';
import { buildRollRow, frozenOpposedRow } from '../rollRowBuild';
import { OptionChooser } from '../OptionChooser';
import { opposedLines } from '../breakdown';
import { VsHeader } from '../VsHeader';
import { DeterminationButton } from '../DeterminationButton';
import { recapLineOfEvent } from '../../gameIso/combatNarration';
import { ev } from '../../noyau/combatLog';
import { Icon } from '../Icon';
import { CodexRef } from '../compendium/CodexRef';
import { useGesteDeJet } from '../useGesteDeJet';
import type { ReglagesDuJet } from '../../noyau/reglagesDuJet';

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
  const regler = useGame((s) => s.jetRegler);
  const setMode = (v: ReglagesDuJet['defense']['reaction']) => regler('defense', 'reaction', v);
  const setParry = (v: ReglagesDuJet['defense']['armeDeParade']) => regler('defense', 'armeDeParade', v);
  const setShieldReaction = (v: ReglagesDuJet['defense']['porteBouclier']) => regler('defense', 'porteBouclier', v);
  const setRiposte = (v: ReglagesDuJet['defense']['riposte']) => regler('defense', 'riposte', v);
  const roll = useGesteDeJet('jetLancer', 'defense');
  const reroll = useGesteDeJet('jetRelancer', 'defense');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'defense');
  const darkPact = useGesteDeJet('jetPactiser', 'defense');
  const forceSuccess = useGesteDeJet('jetForcerLaReussite', 'defense');
  const reverseVerb = useGesteDeJet('jetInverser', 'defense');
  const confirm = useGesteDeJet('jetValider', 'defense');
  const spendResolve = useGame((s) => s.depenserLaDetermination);
  const vue = pd && battle ? fenetreDeDefense(useGame.getState()) : null;
  if (!pd || !battle || !vue) return null;
  const attacker = battle.combatants.find((c) => c.id === vue.attaquantId);
  const defender = battle.combatants.find((c) => c.id === vue.defenseurId);
  if (!attacker || !defender) return null;
  const res = pd.result;
  const rolled = !!res;
  // Z1 (`docs/charte-ui.md`) : le DÉFENSEUR, et les ids du Test du mode CHOISI (`defenseTestOf`, LDB 13 l.161-167).
  const defenseTest = defenseTestOf(defender, pd.mode, vue.parade, pd.substituteSkillId ?? vue.social?.skillId);
  // Inversion de Test (LDB 23 l.209/218, LDB 10 — CHOIX du joueur, #558) : offerte dès qu'une voie
  // (Talent/jeton) est applicable (`reverseAvailable`, pure) ; `reversePreview` rend l'issue LISIBLE
  // avant le clic (le jeton, libre, peut dégrader un succès existant).
  const reverseAvail = FLOWS.defense.reverseAvailable(useGame.getState);
  const reversePreview = reverseAvail ? FLOWS.defense.reversePreview(useGame.getState) : null;

  // Porte-Bouclier et Riposte : la fenêtre de Défense du noyau (`fenetreDeDefense`), chaque option avec sa raison de refus.
  const riposte = vue.riposte;
  const riposteChoix = riposte && (
    <OptionChooser
      layout="seg"
      groupLabel={<CodexRef category="talents" id="riposte" label={riposte.libelle} />}
      options={riposte.options.map((o) => ({
        key: o.valeur ? 'oui' : 'non', label: o.libelle, selected: riposte.choisie === o.valeur, refus: o.refus ?? undefined, onSelect: () => setRiposte(!!o.valeur),
      }))}
    />
  );
  const bouclier = vue.porteBouclier;
  const porteBouclier = bouclier && (
    <OptionChooser
      layout="seg"
      groupLabel={<CodexRef category="talents" id="porte-bouclier" label="Porte-bouclier">{bouclier.libelle}</CodexRef>}
      options={bouclier.options.flatMap((o) => (o.valeur === null ? [] : [{
        key: o.valeur, label: o.libelle, selected: bouclier.choisie === o.valeur, refus: o.refus ?? undefined, onSelect: () => setShieldReaction(bouclier.choisie === o.valeur ? null : o.valeur),
      }]))}
    />
  );
  const riposteOuverte = riposte?.choisie != null;

  // NATURE de l'attaque figée, lue de la suite portée par la fenêtre (`libelleDeLAttaqueFigee`, #1858).
  const [attackLine] = opposedLines([{
    label: libelleDeLAttaqueFigee(pd),
    base: pd.atk.target,
    r: { roll: pd.atk.roll, target: pd.atk.target, sl: pd.atk.sl, success: pd.atk.success },
  }]);
  // Rangée [0] = TÉMOIN : l'attaque FIGÉE (jet déjà eu lieu, aucun bouton), MASQUÉE tant que ce siège
  // n'a pas répondu (#990, calendrier unique `frozenOpposedRow` — mono = N=1 participant : moi).
  const attackerRow = frozenOpposedRow({
    revele: jetFigeRevele(useGame.getState(), JET_FIGE.defense(pd)),
    row: {
      combatant: attacker,
      d: res ? res.attackerDetail : attackLine.d,
    },
  });
  // Rangée [1] = INTERACTIVE : MA défense, avant le dé la ligne de la fenêtre (`fenetreDeDefense.jet`), après le dé
  // la ligne jetée (`defenderDetail`).
  const defenderRow = buildRollRow({
    actor: defender,
    row: res
      ? { combatant: defender, d: res.defenderDetail }
      : { combatant: defender, pending: vue.jet ? { label: vue.test, ...vue.jet } : undefined },
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
    reverse: reverseAvail ? { onReverse: reverseVerb, preview: reversePreview } : undefined,
  });

  const actions: RollAction[] = [
    { key: 'confirmer', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' },
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
          {/* Réaction : chaque option affiche la cible de son jet (`fenetreDeDefense.reaction`). */}
          {vue.reaction && (
            <OptionChooser
              layout="seg"
              groupLabel={vue.reaction.libelle}
              options={vue.reaction.options.flatMap((o) => (o.valeur === null ? [] : [{
                key: o.valeur, label: o.libelle, value: o.cible, selected: vue.reaction!.choisie === o.valeur, title: titreDeLaReaction(o.valeur, o.libelle), onSelect: () => setMode(o.valeur!),
              }]))}
            />
          )}
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
              <CodexRef category="regles" id="main-secondaire" label="Attaque de la main secondaire" className="ab-codex-info"><Icon id="journal/information" size="sm" /></CodexRef>
            </div>
          )}
          {porteBouclier}
          {riposteChoix}
        </div>
        <DeterminationButton combatant={defender} onSpend={(name) => spendResolve(defender.id, 'retirerUnEtat', name)} />
      </>
    ),
    rows: [attackerRow, defenderRow],
    winnerIndex: res?.defenderDetail ? (res.hit ? 0 : 1) : undefined,
    netSL: res?.defenderDetail ? res.netSL : undefined,
    outcome: vue.issue
      ? [recapLineOfEvent(
          ev(vue.issue.genre, vue.issue.ligne, attacker.id, defender.id),
          battle.combatants,
        )]
      : undefined,
    /* #1000 : les deux camps ont forcé — l'arbitrage APPLIQUÉ (garanties éteintes) est AFFICHÉ. */
    postRollExtra: res && (
      <>
        {((pd.shieldReaction && porteBouclier) || (riposteOuverte && riposteChoix)) && (
          <div className="rm-options">
            {pd.shieldReaction && porteBouclier}
            {riposteOuverte && riposteChoix}
          </div>
        )}
        {opposedForcingCancelled(pd) && <p className="rm-note">{OPPOSED_FORCING_CANCELLED_NOTE}</p>}
      </>
    ),
    actions,
  };
}

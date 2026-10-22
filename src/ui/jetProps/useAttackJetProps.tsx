import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import type { HitLocation } from '../../engine/types';
import { fenetreDAttaque } from '../../noyau/fenetreDAttaque';
import { inBattleId } from '../../noyau/monde/combatants';
import { t } from '../../i18n';
import { CritLocationPicker } from '../ForcedRollPicker';
import { DeterminationButton } from '../DeterminationButton';
import { CodexRef } from '../compendium/CodexRef';
import { RollShell, type RollAction } from '../RollShell';
import { buildRollRow, witnessRow, type BuiltRollRow } from '../rollRowBuild';
import { VsHeader } from '../VsHeader';
import { recapLineOfEvent } from '../../gameIso/combatNarration';
import { ev } from '../../noyau/combatLog';
import { Icon } from '../Icon';
import type { IconIdInput } from '../icons';
import { Row } from '../Layout';

/** Sortie « confirmer » d'une modale de COUP (attaque, manœuvre de créature) : elle applique le coup, ou
 *  passe la main quand une Défense surfacée va s'interposer (#1004). Source unique de son libellé. */
export function confirmerLeCoup(awaitingDefense: boolean, confirm: () => void): RollAction {
  return { key: 'confirm', label: t(awaitingDefense ? 'defense.passerLaMain' : 'defense.appliquer'), onClick: confirm, when: 'post' };
}

/**
 * PARAMÉTRAGE de la coquille partagée `RollShell` pour le JET d'attaque — hook à part de `RollModal`,
 * pour être réutilisé à l'IDENTIQUE par la séquence de combat (`CascadeModal` rend l'étape-jet via ce
 * hook, sans démonter la coquille → une seule fenêtre). Renvoie les props de `RollShell`, ou
 * `null` si aucune attaque en attente. Les DONNÉES de la fenêtre viennent du lecteur du noyau
 * (`fenetreDAttaque`) ; ce hook n'y ajoute que les verbes du store et la mise en forme.
 * La rangée [0] = MON attaque (interactive, cycle d'influence) ; la rangée [1] éventuelle = défense
 * adverse (aperçu pré-jet / résultat témoin) — figée (`interactive:false`).
 */
export function useAttackJetProps(): ComponentProps<typeof RollShell> | null {
  const pa = useGame((s) => s.pendingAttack);
  const battle = useGame((s) => s.battle);
  const setLocation = useGame((s) => s.attackSetLocation);
  const setWeapon = useGame((s) => s.attackSetWeapon);
  const setDualMode = useGame((s) => s.attackSetDualMode);
  const roll = useGame((s) => s.attackRoll);
  const reroll = useGame((s) => s.attackReroll);
  const bonusSL = useGame((s) => s.attackBonusSL);
  const darkPact = useGame((s) => s.attackDarkPact);
  const forceSuccess = useGame((s) => s.attackForceSuccess);
  const reverseVerb = useGame((s) => s.attackReverse);
  const confirm = useGame((s) => s.attackConfirm);
  const cancel = useGame((s) => s.attackCancel);
  const setHarpoonRopeCut = useGame((s) => s.attackSetHarpoonRopeCut);
  const setWithhold = useGame((s) => s.attackSetWithhold);
  const setGrapple = useGame((s) => s.attackSetGrapple);
  const setCritLocation = useGame((s) => s.attackSetCritLocation);
  const spendResolve = useGame((s) => s.spendResolveCondition);
  const vue = pa && battle ? fenetreDAttaque(useGame.getState()) : null;
  if (!vue || !battle) return null;
  const attacker = inBattleId(battle, vue.attaquantId);
  const target = inBattleId(battle, vue.cibleId);
  if (!attacker || !target) return null;
  const { influences } = vue;

  // Rangée [0] = MON attaque (interactive, cycle d'influence).
  const attackerRow: BuiltRollRow = buildRollRow({
    actor: attacker,
    row: { combatant: attacker, ...vue.jet },
    rerolled: influences.relancee,
    onReroll: reroll,
    onBonusSL: bonusSL,
    // L'OFFRE du Sombre Pacte se dit par l'absence du handler, jamais par un booléen que la coquille
    // pourrait rallumer.
    ...(influences.sombrePacte ? { onDarkPact: darkPact } : {}),
    onForce: forceSuccess,
    onRoll: roll,
  }, {
    rollFrisson: true,
    fortune: attacker.fortune ?? 0,
    resilience: attacker.resilience ?? 0,
    preRollForce: () => { roll(); forceSuccess(); },
    noForcedDie: influences.sansDeForce,
    reverse: influences.inversion ? { onReverse: reverseVerb, preview: influences.inversion.apercu } : undefined,
  });
  // Rangée [1] éventuelle = défense adverse : aperçu pré-jet (compétence + mods, sans valeur) ou résultat témoin.
  const defense = vue.defense;
  const defenderRow: BuiltRollRow | null = !defense
    ? null
    : 'd' in defense
      ? witnessRow({ row: { combatant: target, d: defense.d } })
      : buildRollRow({ row: { combatant: target, pending: { ...defense.pending, mask: 'value' as const } } }, { interactive: false });
  const rows = [attackerRow, ...(defenderRow ? [defenderRow] : [])];
  const bascule = (b: { libelle: string; active: boolean }, icone: IconIdInput, onToggle: (v: boolean) => void) => (
    <button className="btn small" aria-pressed={b.active} onClick={() => onToggle(!b.active)}>
      <Icon id={icone} size="sm" /> {b.libelle}
    </button>
  );

  return {
    flowKey: 'attack',
    title: vue.intitule,
    subtitle: vue.sousTitre,
    extra: <VsHeader actor={attacker} target={target} label={vue.enTete} />,
    rolled: vue.jete,
    onCancel: cancel,
    /* Options d'attaque + aperçu de la défense adverse + bouton Détermination (retirer un État), pré-jet. */
    setup: (
      <>
        <div className="rm-options">
          {/* LDB 10 l.767-773 */}
          {vue.deuxArmes && (
            <div className="rm-loc-inline" data-bascule>
              <label>
                <input type="checkbox" checked={vue.deuxArmes.active} onChange={(e) => setDualMode(e.target.checked)} />
                <span className="mini-title"><Icon id="action/attack" size="sm" /> {vue.deuxArmes.libelle}</span>
              </label>
              <CodexRef category="regles" id="combat-deux-armes" label="Combat à deux armes" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
            </div>
          )}
          {vue.choixDArme && (
            <div className="rm-loc-inline">
              <span className="mini-title">{vue.choixDArme.libelle}</span>
              <select className="rm-loc-select" value={vue.choixDArme.choisie} onChange={(e) => setWeapon(e.target.value || null)}>
                {vue.choixDArme.options.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
              </select>
              <CodexRef category="regles" id="main-secondaire" label="Attaque de la main secondaire" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
            </div>
          )}
          {vue.localisation && (
            <div className="rm-loc-inline">
              <span className="mini-title">{vue.localisation.libelle}</span>
              <select className="rm-loc-select" value={vue.localisation.choisie} onChange={(e) => setLocation((e.target.value as HitLocation) || null)}>
                {vue.localisation.options.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
              </select>
              <CodexRef category="regles" id="viser-une-localisation" label="Viser une Localisation" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
            </div>
          )}
          {/* POSTURES DE TIR — LECTURE SEULE (spec HUD §1a G5, verbatim user « plutôt qu'une option
              dans la modale ») : la fenêtre ANNONCE la posture armée et sa valeur, le CONTRÔLE vit dans
              la console (cases `posture-tir` / `posture-tas`). Aucun bouton ici, aucun setter. */}
          {vue.tirDansLeTas && (
            <Row gap="md" align="center" data-posture="intoCrowd" data-armee={vue.tirDansLeTas.armee ? '' : undefined}>
              <span className="rm-note" data-ton="etat"><Icon id="action/aim" size="sm" /> {vue.tirDansLeTas.etat}</span>
              <CodexRef category="regles" id="tirer-dans-le-tas" label="Tirer dans le tas" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
              <span className="rm-note" data-ton="discret">{vue.tirDansLeTas.note}</span>
            </Row>
          )}
          {vue.tirImmobile && (
            <Row gap="md" align="center" data-posture="heldGround" data-armee={vue.tirImmobile.armee ? '' : undefined}>
              <span className="rm-note" data-ton="etat"><Icon id="travel/anchor" size="sm" /> {vue.tirImmobile.etat}</span>
              <CodexRef category="regles" id="tir-en-mouvement" label="Tirer en se déplaçant" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
              <span className="rm-note" data-ton="discret">{vue.tirImmobile.note}</span>
            </Row>
          )}
          {vue.sansLaCorde && (
            <Row gap="md" align="center">
              {bascule(vue.sansLaCorde, 'action/aim', setHarpoonRopeCut)}
              <span className="rm-note" data-ton="discret">{vue.sansLaCorde.note}</span>
            </Row>
          )}
          {vue.retenirSesCoups && (
            <Row gap="md" align="center">
              {bascule(vue.retenirSesCoups, 'melee/pulled-punch', setWithhold)}
              <CodexRef category="regles" id="retenir-ses-coups" label="Retenir ses coups (maîtriser sans tuer)" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
              {vue.retenirSesCoups.note && <span className="rm-note" data-ton="discret">{vue.retenirSesCoups.note}</span>}
            </Row>
          )}
          {vue.empoigner && (
            <Row gap="md" align="center">
              {bascule(vue.empoigner, 'melee/grapple', setGrapple)}
              <CodexRef category="regles" id="empoignade" label="Empoignade" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
              {vue.empoigner.note && <span className="rm-note" data-ton="discret">{vue.empoigner.note}</span>}
            </Row>
          )}
        </div>
        {vue.bloque && (
          <div className="rm-note" data-ton="bloque"><Icon id="ui/warning" size="sm" /> {vue.bloque}</div>
        )}
        <DeterminationButton combatant={attacker} onSpend={(name) => spendResolve(attacker.id, name)} />
      </>
    ),
    rows,
    winnerIndex: vue.opposition?.gagnante,
    netSL: vue.opposition?.drNet,
    // Issue = LA ligne de touche du moteur (`issueAuJet`), pas une ligne condensée dupliquée ; aucune
    // tant qu'une Défense surfacée va s'interposer (#1004) : seule l'ATTENTE s'affiche (`postRollExtra`).
    outcome: vue.issue ? [recapLineOfEvent(ev(vue.issue.genre, vue.issue.ligne, attacker.id, target.id), battle.combatants)] : undefined,
    postRollExtra: vue.attente ? <p className="rm-note" data-ton="attente">{vue.attente}</p> : undefined,
    forcedExtra: vue.critiqueALocaliser ? <CritLocationPicker current={vue.critiqueALocaliser.choisie} onSet={setCritLocation} shape={target.bodyShape} /> : undefined,
    actions: [
      { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' } as RollAction,
      confirmerLeCoup(vue.defenseAttendue, confirm),
    ],
  };
}

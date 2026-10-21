import { useGame } from '../state/store';
import { combatValue } from '../engine/combat';
import { creatureAttacks } from '../engine/creatureAttacks';
import { MANEUVER_ICON, maneuverDefensePending } from '../noyau/combatManeuvers';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { Icon } from './Icon';
import { OptionChooser, type RollSegOption } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { confirmerLeCoup } from './jetProps/useAttackJetProps';
import { libelleDeManoeuvre } from '../noyau/jetsEnVue';

/**
 * Modale de MANŒUVRE de créature (Souffle/Vomi/Langue/Regard/Étreinte — LDB 85 - Traits de
 * créature.md) qu'un héros active (mutation/polymorphie). La modale influence le SEUL jet de
 * l'ATTAQUANT (CC ou CT) ; « Appliquer » roule les défenseurs et résout l'opposition au feed — sauf
 * quand un défenseur SURFACÉ joue sa défense en cascade : « Passer à la Défense » (`maneuverDefensePending`).
 * Regard pétrifiant (l.238) : Avantage variable → un sélecteur
 * (pré-jet) fixe le DR ajouté. (Le Hurlement n'ouvre PAS de modale — pas de jet d'attaquant.)
 */
export function ManeuverModal() {
  const pm = useGame((s) => s.pendingManeuver);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.maneuverRoll);
  const reroll = useGame((s) => s.maneuverReroll);
  const bonusSL = useGame((s) => s.maneuverBonusSL);
  const darkPact = useGame((s) => s.maneuverDarkPact);
  const force = useGame((s) => s.maneuverForceSuccess);
  const setAvantage = useGame((s) => s.maneuverSetAvantage);
  const confirm = useGame((s) => s.maneuverConfirm);
  const cancel = useGame((s) => s.maneuverCancel);
  const awaitingDefense = useGame(maneuverDefensePending);
  if (!pm || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pm.attackerId);
  if (!attacker) return null;
  const a = creatureAttacks(attacker.traits ?? []).find((x) => x.def.id === pm.maneuverId);
  if (!a) return null;
  const r = pm.result;
  const rolled = !!r;
  // Jet d'attaquant : CC (mêlée) ou CT (distance/zone) ; Vomi → Facile (+40) à courte distance (l.376).
  const stat = a.stat ?? 'capacite-de-tir';
  const base = combatValue(attacker, stat === 'capacite-de-combat' ? 'melee' : 'ranged');
  const label = libelleDeManoeuvre(attacker, pm.maneuverId);
  const difficulty = pm.kind === 'vomi' ? 'facile' : 'intermediaire'; // Vomi : +40 à courte distance (l.376)
  // Regard (Avantage variable, l.238) : sélecteur PRÉ-JET 1..Avantage → +N DR sur la marge.
  const variable = a.advantageMode === 'variable';
  const avOptions: RollSegOption[] = variable
    ? Array.from({ length: Math.max(1, attacker.advantage) }, (_, i) => i + 1).map((n) => ({
        key: String(n), label: `+${n} DR`, selected: pm.avantageSpent === n, onSelect: () => setAvantage(n),
      }))
    : [];

  const actorRow: BuiltRollRow = buildRollRow({
    actor: attacker,
    row: {
      combatant: attacker,
      d: r ? testBreakdown(label, base, { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, difficulty) : undefined,
      pending: testPending(label, base, undefined, difficulty),
    },
    onRoll: roll,
    rerolled: !!pm.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
    // LDB 17 l.68 : réussite forcée = dé PAR DÉFAUT (DR max), et le joueur peut CHOISIR ce dé — le
    // sélecteur est dérivé par la coquille (`RollShell` → `rowForcedDie`), sans code ici. Le dé ne
    // nourrit que le DR de l'opposition (`resolveManeuver`) : aucun Coup Critique n'en dépend.
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'always' },
    confirmerLeCoup(awaitingDefense, confirm),
  ];

  return (
    <RollShell
      flowKey="maneuver"
      title={<><Icon id={MANEUVER_ICON[pm.kind]} /> {a.def.label}</>}
      subtitle={
        <>
          <strong>{attacker.label}</strong> déclenche {a.def.label}
          {variable ? <> ({pm.avantageSpent} Avantage)</> : a.avantage > 0 ? <> (coûte {a.avantage} Avantage)</> : null}
        </>
      }
      /* Regard : choix de l'Avantage AVANT le jet (fixe le DR). Masqué une fois lancé. */
      setup={variable ? <OptionChooser layout="seg" groupLabel="Avantage" options={avOptions} /> : undefined}
      rows={[actorRow]}
      rolled={rolled}
      actions={actions}
      onCancel={cancel}
    />
  );
}

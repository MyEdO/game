import { useGame } from '../../state/store';
import { flowStakeRef } from '../../data';
import { HEAL_STAKE } from '../../state/medicFlow';
import type { ComponentProps } from 'react';
import { RollShell, type RollAction } from '../RollShell';
import { buildRollRow, type BuiltRollRow } from '../rollRowBuild';
import { OptionChooser } from '../OptionChooser';
import { testValueSplit, testBreakdown, testPending } from '../breakdown';
import { recapLineOfEvent } from '../../gameIso/combatNarration';
import { ev } from '../../state/combatLog';
import { describeHeal } from '../../state/flowOutcomes';
import { combatHealModes } from '../../engine/healing';
import { Icon } from '../Icon';
import { HEAL_ACT } from '../healSubtitle';
import { VsHeader } from '../VsHeader';

/**
 * Flux de jet d'un SOIN (Guérison, LDB 09-Compétences) : « Lancer » → Chance (relance / +1 DR) →
 * Résilience → « Appliquer ». Rend les DONNÉES de la coquille (`RollShellProps`), posées par DEUX hôtes :
 *  - en COMBAT : modale autonome (`HealModal`, via la console — un acte = une Action) ;
 *  - hors combat : l'infirmerie (`MedicModal`, `embedded`), qui pose le jet dans SA boîte
 *    (`useRollShell`) et reste ouverte après « Appliquer ».
 * Le soigneur peut être un PNJ payant : sa Chance/Résilience valent 0 (boutons inertes), et
 * « Annuler » avant le jet rembourse l'acte (healCancel).
 */
export function useHealJetProps({ embedded = false }: { embedded?: boolean } = {}): ComponentProps<typeof RollShell> | null {
  const ph = useGame((s) => s.pendingHeal);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.healRoll);
  const reroll = useGame((s) => s.healReroll);
  const bonusSL = useGame((s) => s.healBonusSL);
  const darkPact = useGame((s) => s.healDarkPact);
  const force = useGame((s) => s.healForceSuccess);
  const confirm = useGame((s) => s.healConfirm);
  const cancel = useGame((s) => s.healCancel);
  const setMode = useGame((s) => s.healSetMode);
  if (!ph) return null;
  const pool = battle?.combatants ?? party; // même flux en combat (file) et hors combat (groupe)
  const healer = pool.find((c) => c.id === ph.healerId); // absent (PNJ médecin) → Chance/Résilience à 0
  const fortune = healer?.fortune ?? 0;
  const target = pool.find((c) => c.id === ph.targetId);
  const rolled = ph.roll != null;
  const acte = HEAL_ACT[ph.mode]; // vocabulaire PARTAGÉ avec le dossier d’opération (MedicModal)

  const wounds = ph.mode === 'wounds';
  const trauma = ph.mode === 'trauma';
  const ammo = ph.mode === 'ammo';
  // Surface UNIQUE du soin en combat : on a ciblé l'allié sur la carte (mode par défaut) ; si plusieurs
  // soins s'appliquent à lui (Blessures ET Hémorragie), on choisit ICI, avant le jet. L'infirmerie
  // (embedded) garde son propre choix d'acte → pas de seg.
  const combatModes = !embedded && !rolled && target
    ? combatHealModes(target)
    : [];
  const bleed = target?.conditions.find((x) => x.id === 'hemorragique')?.value ?? 0;
  const lodged = target?.conditions.find((x) => x.id === 'munition-logee')?.value ?? 0;

  // Soutien des assistants de soin (LDB 12) et composantes de la valeur de Test (États, séquelles,
  // passifs, effets — #1178) : lignes de mod NOMMÉES, base rebasée sur le Niveau de Compétence nu
  // (LDB 09 l.17). Soigneur PNJ tarifé (aucune fiche dans le pool) : la garde de reconstruction de la
  // primitive laisse l'affichage inchangé.
  const { base, mods: supMods } = testValueSplit(healer, ph.skillValue, { support: ph.support, skill: 'guerison' });
  const actorRow: BuiltRollRow = buildRollRow({
    actor: healer,
    row: {
      combatant: healer,
      d: rolled ? testBreakdown('Guérison', base, { roll: ph.roll!, target: ph.target, sl: ph.sl, success: ph.success }, ph.difficulty, supMods) : undefined,
      pending: testPending('Guérison', base, ph.target, ph.difficulty, supMods),
    },
    rerolled: !!ph.rerolled,
    onRoll: roll,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    fortune,
    resilience: healer?.resilience ?? 0,
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return {
    flowKey: 'heal',
    stake: flowStakeRef(HEAL_STAKE[ph.mode]),
    title: wounds ? <><Icon id="journal/heal" size="sm" /> Soigner les Blessures</> : trauma ? <><Icon id="medical/tear" size="sm" /> Soigner une déchirure</> : ammo ? <><Icon id="item/ammo" size="sm" /> Retirer une munition</> : <><Icon id="condition/bleeding" size="sm" /> Arrêter l’Hémorragie</>,
    /* A→B canonique (décision utilisateur 2026-08-04) : portraits + flèche annotée de l'acte —
       plus AUCUNE phrase « A soigne B » en sous-titre. Le patient est en `full` : ses pastilles
       d'ÉTATS sont ce que le jet fait bouger (suivre l'Hémorragie passe par passe). EMBARQUÉ
       (infirmerie) : aucun bandeau — la bande `.medic-patients` porte déjà le patient en full et
       l'acte est le bouton qu'on vient de cliquer. Soigneur PNJ tarifé (`healerId` sentinelle de
       `medicFlow.medicAct`, aucune fiche) : pas de bandeau dégénéré, l'acte se dit en note (son
       nom est au titre de l'infirmerie). La Difficulté reste la donnée de la LIGNE (#1072). */
    extra: embedded ? undefined : healer
      ? <VsHeader actor={healer} target={target} label={acte.label} verb={acte.icon} targetVariant="full" />
      : <p className="rm-note">{acte.label} — {ph.targetName}</p>,
    setup: combatModes.length > 1 ? (
      <OptionChooser
        layout="seg"
        groupLabel="Soin"
        options={combatModes.map((m) => ({
          key: m,
          label: m === 'wounds'
            ? <><Icon id="journal/heal" size="sm" /> Blessures</>
            : m === 'ammo'
              ? <><Icon id="item/ammo" size="sm" /> Munition ×{lodged}</>
              : <><Icon id="condition/bleeding" size="sm" /> Hémorragie ×{bleed}</>,
          selected: ph.mode === m,
          onSelect: () => setMode(m),
        }))}
      />
    ) : undefined,
    rows: [actorRow],
    rolled,
    outcome: rolled ? [recapLineOfEvent(ev('heal', describeHeal(ph, target), ph.healerId, ph.targetId), pool)] : undefined,
    actions,
    onCancel: rolled ? undefined : cancel,
  };
}

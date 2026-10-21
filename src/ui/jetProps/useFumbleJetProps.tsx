import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { RollShell } from '../RollShell';
import { TableRollLine } from '../RollLine';
import { Icon } from '../Icon';
import { drawRow } from '../rollRowBuild';
import { libelleDeTest } from '../../noyau/jetsEnVue';

/**
 * PARAMÉTRAGE de la coquille partagée `RollShell` pour le JET de Maladresse (Tableau des Oups !,
 * LDB 14) — rendu À L'IDENTIQUE par la séquence de combat (`CascadeModal` rend l'étape `jet:'fumble'`
 * via ce hook). La Maladresse est une CONSÉQUENCE du Test raté sur un double : comme le Critique, elle
 * vit DANS la MÊME fenêtre que l'attaque/défense, plus dans une modale d'arbitre séparée. AUCUNE influence
 * (la Chance agit AVANT qu'un Test ne devienne Maladresse ; une fois actée, l'Oups ! est subi). Le jet est
 * un tirage de TABLE (pas de cible / DR) : `Lancer` → `result`, `Appliquer` → applyOups. `null` si aucune
 * Maladresse en attente.
 */
export function useFumbleJetProps(): ComponentProps<typeof RollShell> | null {
  const pc = useGame((s) => s.pendingCascade);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.fumbleRoll);
  const confirm = useGame((s) => s.fumbleConfirm);
  const step = pc?.participants[pc.cursor]; // SOURCE UNIQUE : l'étape courante PORTE la maladresse (`step.fumble`)
  if (!battle || !pc || step?.jet !== 'fumble' || !step.fumble) return null;
  const combatant = battle.combatants.find((c) => c.id === step.actorId);
  if (!combatant) return null;
  const r = step.fumble.result;
  const rolled = !!r;
  return {
    title: <><Icon id="nav/dice" size="sm" /> Maladresse</>,
    // Z1 : l'ACTEUR et le FAIT qui ouvre la fenêtre. Le NOM DE LA TABLE se lit sur la ligne de tirage
    // (`TableRollLine`, ci-dessous) et sur le bouton de lancement — jamais une troisième fois ici.
    subtitle: `${combatant.label} — Test de combat raté sur un double`,
    rolled,
    // Rangée UNIQUE, par la porte : un TIRAGE VIF de table (`drawRow`) — pas de ligne de jet, la
    // note du tirage est tout le rendu, et `rolled` s'y dérive de sa présence.
    rows: [
      drawRow({
        row: { note: r ? <TableRollLine table={libelleDeTest('oups')} roll={r.roll} result={r.label} /> : undefined },
        rollLabel: <><Icon id="nav/dice" size="sm" /> Lancer sur le Tableau des Oups !</>,
        onRoll: roll,
        rollFrisson: true,
      }),
    ],
    actions: [{ key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' }],
  };
}

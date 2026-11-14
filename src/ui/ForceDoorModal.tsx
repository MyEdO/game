import { useGame } from '../state/store';
import { useOwns } from './ownership';
import { RollShell, type RollAction } from './RollShell';
import type { BuiltRollRow } from './rollRowBuild';
import { buildParticipantRows } from './buildParticipantRows';
import { testBreakdown, testPending } from './breakdown';
import { Icon } from './Icon';
import { resultLine, freeCons } from '../noyau/rollSeam';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { armeDEnfoncement, armesDEnfoncement, bilanDuRound, ligneDEnfoncement } from '../noyau/enfoncerUnePorte';
import { attackTestLabel } from '../engine/combat';
import { OptionChooser } from './OptionChooser';
import { cibleMesuree } from '../engine/tests';
import { useGesteDeJet } from './useGesteDeJet';

/**
 * Modale « Enfoncer une porte à PLUSIEURS » (EDO 11 l.89-95) — flux MULTI PARALLÈLE : chaque héros
 * frappe avec son propre cycle d'influence. Ligne et bilan du Round : `noyau/enfoncerUnePorte`.
 * COOP : chacun ne pilote QUE ses héros.
 */
export function ForceDoorModal() {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const owns = useOwns(); // possession locale à l'affichage (#1262) — hook : AVANT tout retour anticipé
  const p = useGame((s) => s.pendingForceDoor);
  const roll = useGesteDeJet('jetLancer', 'enfoncerLaPorte');
  const reroll = useGesteDeJet('jetRelancer', 'enfoncerLaPorte');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'enfoncerLaPorte');
  const darkPact = useGesteDeJet('jetPactiser', 'enfoncerLaPorte');
  const force = useGesteDeJet('jetForcerLaReussite', 'enfoncerLaPorte');
  const confirm = useGesteDeJet('jetValider', 'enfoncerLaPorte');
  const cancel = useGesteDeJet('jetAnnuler', 'enfoncerLaPorte');
  const regler = useGame((s) => s.jetRegler);
  if (!p) return null;
  const pool = battle?.combatants ?? party;
  const { degats: roundDmg, reste, cede, complet: allRolled } = bilanDuRound(p);

  // Rangées via le builder mutualisé (#328) — présentation « Bagarre » ici, éligibilité dans le builder.
  const rows: BuiltRollRow[] = buildParticipantRows(p.participants, pool, {
    onRoll: roll, onReroll: reroll, onBonusSL: bonusSL, onDarkPact: darkPact, onForce: force,
    interactiveOf: (part) => owns(part.id),
    rollLabel: <><Icon id="action/attaquer" size="sm" /> Frapper</>,
    row: (part, actor, res) => {
      const arme = armeDEnfoncement(actor, part);
      const ligne = ligneDEnfoncement(actor, arme);
      const label = arme ? attackTestLabel(actor, arme, 'melee') : libelleDeTest('bagarre');
      return res
        ? { combatant: actor, d: testBreakdown(label, ligne.base, { roll: res.roll, target: res.target, sl: res.sl }, ligne.difficulty, ligne.mods) }
        : { combatant: actor, pending: testPending(label, ligne.base, cibleMesuree(ligne), ligne.difficulty, ligne.mods) };
    },
    note: (_part, _actor, res) => <div className={`cs-outcome ${res.damage > 0 ? 'ok-text' : 'muted'}`}>{resultLine(freeCons([res.damage > 0 ? `−${res.damage} Blessure${res.damage > 1 ? 's' : ''}` : 'Rebondit (0 dégât)']))}</div>,
  });

  // EDO 11 l.93 : avant SON jet, chaque héros piloté ici choisit ses mains nues ou une de ses armes.
  const choix = p.participants.flatMap((part) => {
    const actor = pool.find((c) => c.id === part.id);
    const armes = actor ? armesDEnfoncement(actor) : [];
    if (!actor || part.result || !armes.length || !owns(part.id)) return [];
    return [(
      <OptionChooser
        key={part.id}
        layout="seg"
        groupLabel={actor.label}
        options={[
          { key: 'mains-nues', label: 'Mains nues', selected: !part.armeUid, onSelect: () => regler('enfoncerLaPorte', 'arme', null, part.id) },
          ...armes.map((w) => ({ key: w.uid!, label: w.label, selected: part.armeUid === w.uid, onSelect: () => regler('enfoncerLaPorte', 'arme', w.uid!, part.id) })),
        ]}
      />
    )];
  });

  const actions: RollAction[] = [
    { key: 'abandonner', label: 'Renoncer', onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: cede ? 'Enfoncer !' : 'Appliquer le Round', onClick: confirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="enfoncerLaPorte"
      title={<><Icon id="outil-de-carte/porte" size="sm" /> Enfoncer la porte</>}
      subtitle={<><strong>{p.label}</strong> — Endurance {p.doorBE} · Blessures {p.doorB}/{p.doorBmax}</>}
      instruction="Chacun frappe la porte, à mains nues ou avec une arme"
      setup={choix.length ? <>{choix}</> : undefined}
      rows={rows}
      rolled={allRolled}
      summary={allRolled ? <>Ce Round : <b>{roundDmg}</b> dégât{roundDmg > 1 ? 's' : ''}{cede ? ' → la porte cède !' : ` (reste ${reste})`}</> : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}

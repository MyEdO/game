import { useState, useEffect } from 'react';
import { useGame } from '../state/store';
import { ownsLocal } from './ownership';
import { harvestProfileFor } from '../engine/harvest';
import { ReadyRow } from './ReadyRow';
import { GearAssignList } from './GearAssignList';
import { RewardRecap, type RecapSection } from './RewardRecap';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { GatedAction } from './GatedAction';
import { Row } from './Layout';

/** Beat de lisibilité avant l'écran plein écran : on laisse voir le COUP FATAL et la chute du dernier
 *  ennemi (le champ de bataille reste rendu sous l'overlay) avant de recouvrir la scène — sinon la victoire
 *  « avale » la mort dès le 0 PB (retour playtest 2026-06-27 : « le combat s'est fini si vite que je n'ai pas
 *  vu l'adversaire tomber »). ~Une seconde, calé sur le beat `postAttack` du Réalisateur (tempo.ts). */
const VICTORY_REVEAL_MS = 950;

/**
 * Écran de VICTOIRE plein écran (demande utilisateur) : récapitulatif de fin de combat — XP gagnée, or
 * récupéré, ennemis vaincus, et butin d'ÉQUIPEMENT assignable à un héros (`assignVictoryGear` applique
 * le `giveTrapping` de la rencontre sur le portrait choisi, qualités préservées).
 * « Continuer » revient à l'exploration. Ne s'affiche que sur `battle.over === 'victory'`.
 * COOP : écran SYNCHRONISÉ — chacun n'attribue le butin qu'à SES héros ; « Continuer » = ✓ de son
 * siège (portraits + ✓), l'hôte ferme à l'unanimité (spec §4bis).
 */
export function VictoryScreen() {
  const battle = useGame((s) => s.battle);
  const pv = useGame((s) => s.pendingVictory);
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  const assignGear = useGame((s) => s.assignVictoryGear);
  const harvest = useGame((s) => s.harvestCreature);
  const appraiseGear = useGame((s) => s.appraiseGear);
  const dismiss = useGame((s) => s.dismissVictory);
  const victoryReady = useGame((s) => s.victoryReady);
  const state = useGame();
  // Tenue du coup fatal : on diffère l'apparition de l'écran d'un beat après `over:'victory'` (la scène, avec
  // l'ennemi à terre, reste visible dessous). Les hooks restent AVANT tout early-return (règles des Hooks).
  const overVictory = battle?.over === 'victory';
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!overVictory) { setRevealed(false); return; }
    const id = setTimeout(() => setRevealed(true), VICTORY_REVEAL_MS);
    return () => clearTimeout(id);
  }, [overVictory]);
  const online = net.mode !== 'local';
  const ready = pv?.readyBySeat ?? {};
  // COUCHE BLOQUANTE tant que l'écran est là : [Continuer] VALIDE la victoire (attribution du butin,
  // `victoryReady` répliqué au relais en coop) — un congédiement est GRATUIT par contrat
  // (`dismissStack`), il n'engage rien, donc il ne peut pas porter ce geste. Échap est donc inerte :
  // `Modal` sans `onClose` pose une couche bloquante. Même doctrine qu'une sortie d'interlude qui
  // commet (keybindings.ts:313-315).
  if (!battle || battle.over !== 'victory' || !revealed) return null;
  const assignable = party.filter((h) => ownsLocal(state, h.id)); // solo : tous (#1262)

  const xp = pv?.xp ?? 0;
  const gear = pv?.gear ?? [];
  const defeated = pv?.defeated ?? [];

  // Équipement EN AVANT (#377) : la rubrique « qui l'emporte ? » se joue AVANT le récapitulatif des
  // vaincus — c'est elle qui donne quelque chose à TOUCHER, jamais reléguée en bas d'écran.
  const sections: RecapSection[] = [];
  if (gear.length > 0) {
    sections.push({
      id: 'equipement',
      titre: <><Icon id="resource/gold-purse" size="sm" /> Équipement — qui l'emporte&nbsp;?</>,
      enAvant: true,
      children: (
        <GearAssignList
          gear={gear}
          assignable={assignable}
          onAssign={assignGear}
          onAppraise={net.mode === 'guest' ? undefined : (i, mode) => appraiseGear('victory', i, mode)}
        />
      ),
    });
  }
  if (defeated.length > 0) {
    sections.push({
      id: 'vaincus',
      titre: 'Ennemis vaincus',
      children: (
        <Row gap="sm">
          {defeated.map((d) => {
            const canHarvest = !!harvestProfileFor(d.creatureId) && net.mode !== 'guest';
            const done = (pv?.harvested ?? []).includes(d.creatureId ?? '');
            return (
              <Row key={d.label} className="chip">
                {d.label}{d.count > 1 ? ` ×${d.count}` : ''}
                {canHarvest && (
                  <GatedAction
                    id={`victory-harvest-${d.creatureId}`}
                    label={done ? '✓ récolté' : <><Icon id="medical/scalpel" size="sm" /> Récolter</>}
                    ariaLabel={`Récolter ${d.label}`}
                    enabled={!done}
                    reason="Ces pièces ont déjà été récoltées."
                    descOfferte="Récolter les pièces de monstre (Test de Savoir (Bêtes))"
                    onClick={() => harvest(d.creatureId!)}
                    primary={false}
                    btnClassName="btn-ghost"
                  />
                )}
              </Row>
            );
          })}
        </Row>
      ),
    });
  }

  return (
    <Modal
      title="Victoire"
      voile="opaque"
      kind="victoire"
      footer={online ? (
        <>
          <ReadyRow ready={ready} />
          <button className="btn btn-primary" disabled={!!ready[net.mySeat]} onClick={() => victoryReady(net.mySeat)}>
            {ready[net.mySeat] ? <><Icon id="ui/wait" size="sm" /> En attente des autres…</> : 'Continuer'}
          </button>
        </>
      ) : (
        <button className="btn btn-primary" onClick={dismiss}>Continuer</button>
      )}
    >
      {/* #9 : messages de journal de la victoire (ex. annonce de l'arène) affichés ICI. */}
      <RewardRecap
        messages={pv?.messages}
        xp={xp}
        gold={pv?.gold}
        emptyNote="Ni or ni gloire sonnante sur ces adversaires — le groupe repart les mains vides, mais entier."
        sections={sections}
      />
    </Modal>
  );
}

import { useGame } from '../state/store';
import { ownsLocal } from './ownership';
import { Modal } from './Modal';
import { GearAssignList } from './GearAssignList';
import { RewardRecap } from './RewardRecap';

/**
 * Fenêtre de BUTIN hors combat (fouille d'un décor, branche de Test, dialogue, trigger) — même
 * brique d'attribution que l'écran de victoire : texte d'ambiance au-dessus, argent trouvé (déjà
 * crédité à la bourse commune), équipement à attribuer par portrait, révélation (Évaluer /
 * Détecter) AVANT d'attribuer. « Continuer » : le non-attribué va au 1er héros (même contrat que
 * la victoire). En coop, chacun n'attribue qu'à SES héros ; la révélation reste à l'hôte.
 */
export function LootModal() {
  const pl = useGame((s) => s.pendingLoot);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  const assign = useGame((s) => s.assignLootGear);
  const appraise = useGame((s) => s.appraiseGear);
  const dismiss = useGame((s) => s.dismissLoot);
  const appraising = useGame((s) => !!s.pendingAppraise);
  const state = useGame();
  if (!pl || battle) return null; // un combat a éclaté : la fenêtre réapparaîtra après (Ramasser/victoire ont leurs flux)
  // Attribuables = les héros de CE siège (solo : tous — `ownsLocal` le rend déjà, #1262).
  const assignable = party.filter((h) => ownsLocal(state, h.id));
  return (
    <Modal
      title={pl.title}
      taille="lecture"
      onClose={appraising ? undefined : dismiss}
      footer={<button className="btn btn-primary" onClick={dismiss}>Continuer</button>}
    >
      <RewardRecap
        messages={pl.messages}
        gold={pl.gold}
        sections={pl.gear.length > 0 ? [{
          id: 'equipement',
          titre: <>Équipement — qui l'emporte&nbsp;?</>,
          children: (
            <GearAssignList
              gear={pl.gear}
              assignable={assignable}
              onAssign={assign}
              onAppraise={net.mode === 'guest' ? undefined : (i, mode) => appraise('loot', i, mode)}
            />
          ),
        }] : undefined}
      />
    </Modal>
  );
}

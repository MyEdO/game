import { useGame } from '../state/store';
import { nomDuSiege } from '../state/netFlow';
import { siegesRequis } from '../state/netOwnership';
import { TeamPortrait } from './TeamPortrait';
import { Icon } from './Icon';

/**
 * RANGÉE DE READY-CHECK (coop) — primitive PARTAGÉE de toute attente d'unanimité : pause de Round
 * (bandeau de phase de la console), écran de Victoire, nuit de repos. Elle montre EXACTEMENT les
 * sièges que le dispatcher attend (`siegesRequis`, source unique du quorum) : un siège nommé sans
 * héros vivant n'est pas requis, il n'a donc pas de chip — l'afficher « en attente » faisait croire
 * à un blocage qui n'existe pas.
 *
 * Chaque chip NOMME son siège à l'écran (le nom n'est plus dans un `title` invisible), porte le
 * portrait d'un de ses héros quand il en tient un, et dit son état : validé (✓) ou attendu (…).
 */
export function ReadyRow({ ready }: { ready: Record<number, boolean> }) {
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  return (
    <div className="ready-row">
      {siegesRequis({ party, net }).map((seat) => {
        const h = party.find((x) => !x.dead && !x.outOfRencontre && (net.ownership[x.id] ?? 0) === seat);
        const pret = !!ready[seat];
        const nom = nomDuSiege(net, seat);
        return (
          <span key={seat} className={`ready-chip${pret ? ' ok' : ''}`} data-seat={seat} data-pret={pret ? '' : undefined}>
            {h ? <TeamPortrait combatant={h} size={28} /> : <span className="ready-noportrait"><Icon id="nav/seat-owner" size="sm" /></span>}
            {nom} {pret ? '✓' : '…'}
          </span>
        );
      })}
    </div>
  );
}

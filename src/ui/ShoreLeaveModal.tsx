import { useGame } from '../state/store';
import { Modal } from './Modal';
import { EmbeddedShell } from './RollShell';
import { ChoiceButtons } from './OptionChooser';
import { Icon } from './Icon';

/**
 * Permission de RELÂCHE À TERRE (MDG 15 l.245, événement de port) : posée à l'accostage AVANT le
 * tirage de l'événement de port. « Si vous avez refusé la permission de faire relâche à terre à votre
 * équipage, cet événement [Embrigadement] n'a pas lieu » — gate aussi la Fête de Manann (l.260, le
 * bonus d'Humeur suppose la relâche autorisée). CHOIX du joueur — `resolveShoreLeave` tranche.
 *
 * `embedded` (#333, arbitrage user 2026-07-11) : rendu SANS `Modal`, incrusté AU CENTRE de l'écran-hub
 * de voyage comme étape d'accostage (patron `CascadeBody`/`RestBody embedded`) — la décision vit dans le
 * journal de voyage, plus dans une modale flottante. Hors hub (port ouvert, onglet Escale) : inchangé.
 */
export function ShoreLeaveBody({ embedded = false }: { embedded?: boolean } = {}) {
  const p = useGame((s) => s.pendingShoreLeave);
  const resolve = useGame((s) => s.resolveShoreLeave);
  const isGuest = useGame((s) => s.net.mode) === 'guest';
  if (!p) return null;
  const title = <><Icon id="travel/anchor" size="sm" /> Accostage à {p.to.label}</>;
  const body = (
    <>
      <p className="modal-log">
        Autorisez-vous l'équipage à faire relâche à terre pendant l'escale ? Un refus empêche
        l'Embrigadement, mais prive aussi l'équipage des faveurs que la vie du port pourrait lui
        offrir.
      </p>
    </>
  );
  const footer = (
      <ChoiceButtons
        idPrefix="shore"
        options={[
          { key: 'accorder', label: <><Icon id="travel/anchor" size="sm" /> Accorder la relâche</>, primary: true, refus: isGuest ? 'L\'hôte décide de la relâche.' : undefined, onSelect: () => resolve(true), title: isGuest ? undefined : 'Autoriser l\'équipage à faire relâche à terre' },
          { key: 'refuser', label: <><Icon id="travel/anchor" size="sm" /> Refuser la relâche</>, refus: isGuest ? 'L\'hôte décide de la relâche.' : undefined, onSelect: () => resolve(false), title: isGuest ? undefined : 'Garder l\'équipage à bord — l\'Embrigadement n\'aura pas lieu' },
        ]}
      />
  );
  if (embedded) return <EmbeddedShell title={title} footer={footer}>{body}</EmbeddedShell>;
  return <Modal title={title} footer={footer}>{body}</Modal>;
}

export function ShoreLeaveModal() {
  return <ShoreLeaveBody />;
}

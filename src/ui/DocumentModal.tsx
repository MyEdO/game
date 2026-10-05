import { useGame } from '../state/store';
import { Modal } from './Modal';
import { ParchmentCard } from './ParchmentCard';
import { Prose } from './Prose';
import { SourceBadge, sourceAffichee } from './SourceBadge';

/**
 * Lecteur de document/handout remis aux joueurs (brique « inventaire/handouts ») : la MODALE porte le
 * titre, la CARTE-PARCHEMIN porte la matière (aucun second titre à l'intérieur), et le texte est rendu
 * par la primitive unique de prose, sous lui le badge de source du document (`SourceBadge`, comme au
 * Carnet). L'écran ne déclare que sa largeur.
 */
export function DocumentModal() {
  const doc = useGame((s) => s.document);
  const close = useGame((s) => s.closeDocument);
  if (!doc) return null;
  return (
    <Modal
      title={doc.title}
      taille="lecture"
      onClose={close}
      backdropClose
      footer={<button className="btn" onClick={close}>Fermer</button>}
    >
      <ParchmentCard>
        <Prose md={doc.text} />
        {doc.source && <SourceBadge source={sourceAffichee(doc.source)} />}
      </ParchmentCard>
    </Modal>
  );
}

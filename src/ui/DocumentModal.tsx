import { useState } from 'react';
import { useGame } from '../state/store';
import { Modal } from './Modal';
import { ParchmentCard } from './ParchmentCard';
import { Prose } from './Prose';
import { SourceBadge, sourceAffichee } from './SourceBadge';

/**
 * Lecteur de document/handout remis aux joueurs (brique « inventaire/handouts ») : la MODALE porte le
 * titre, la CARTE-PARCHEMIN porte la matière (aucun second titre à l'intérieur), et le texte est rendu
 * par la primitive unique de prose, sous lui le badge de source du document (`SourceBadge`, comme au
 * Carnet). L'écran ne déclare que sa largeur. Seul un document de paquet (`documentId`) est nommé
 * par les identités en vigueur ; le rapport de naufrage reste tel quel.
 */
export function DocumentModal() {
  const doc = useGame((s) => s.document);
  const closeDocument = useGame((s) => s.closeDocument);
  const invite = useGame((s) => s.net.mode === 'guest');
  const [masque, setMasque] = useState<number | null>(null);
  if (!doc) return null;
  // COOP : l'hôte ferme (`closeDocument`) ; l'invité ne fait que MASQUER cette remise (`remise`).
  if (invite && masque === doc.remise) return null;
  const close = invite ? () => setMasque(doc.remise) : closeDocument;
  return (
    <Modal
      title={doc.title}
      taille="lecture"
      onClose={close}
      backdropClose
      footer={<button className="btn" onClick={close}>Fermer</button>}
    >
      <ParchmentCard>
        <Prose md={doc.text} paquet={doc.documentId !== undefined} />
        {doc.source && <SourceBadge source={sourceAffichee(doc.source)} />}
      </ParchmentCard>
    </Modal>
  );
}

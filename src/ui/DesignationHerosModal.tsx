import { useGame } from '../state/store';
import { garanti } from '../lib/garanti';
import { etatDeclare } from '../data/schemas/defs-scenes/formes-d-etat';
import { Modal } from './Modal';
import { PortraitPicker } from './console/PortraitPicker';
import { Prose } from './Prose';

/**
 * DÉSIGNATION d'un héros pour un état de campagne (Effet `designerHeros`, EDO 02 l.91) : décision de
 * GROUPE, rendue au seul siège qui la tient (`modalArbiter` › `designationHeros`), sans geste de sortie —
 * elle ne s'annule pas. L'invite est la prose de l'Effet ; seuls les héros VIVANTS se proposent. Plus aucun
 * vivant : la désignation se clôt sans choix (`designerHerosChoisir()`), la suite du Flow se joue.
 */
export function DesignationHerosModal() {
  const p = useGame((s) => s.pendingDesignationHeros);
  const party = useGame((s) => s.party);
  const etats = useGame((s) => s.campaignNarratif?.etats);
  const choisir = useGame((s) => s.designerHerosChoisir);
  if (!p) return null;
  const etat = garanti(etatDeclare(etats, p.etat), p.etat, 'état de campagne désigné');
  const vivants = party.filter((h) => !h.dead);
  return (
    <Modal
      title={etat.label}
      footer={vivants.length ? undefined : <button type="button" className="btn btn-primary" onClick={() => choisir()}>Continuer</button>}
    >
      {p.invite && <div className="modal-log"><Prose md={p.invite} paquet /></div>}
      {vivants.length
        ? <div className="rm-options"><PortraitPicker choices={vivants.map((c) => ({ c, nom: c.label, caption: c.label }))} onPick={choisir} /></div>
        : <p className="empty">Aucun héros vivant à désigner.</p>}
    </Modal>
  );
}

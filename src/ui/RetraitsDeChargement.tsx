import { useGame } from '../state/store';
import { nommerLesRetraits } from '../noyau/persistance/elagage';
import { Modal } from './Modal';
import { ChipDeRefus } from './ChipDeRefus';
import { t } from '../i18n';

/** Ce qu'une sauvegarde CHARGÉE a perdu à l'élagage (règles, États hors du registre courant, #1463 LD.1) : la
 *  partie est là, le joueur lit les ids retirés une fois puis ferme. */
export function RetraitsDeChargement() {
  const retraits = useGame((s) => s.retraitsDeChargement);
  const fermer = useGame((s) => s.fermerRetraitsDeChargement);
  if (!retraits) return null;
  return (
    <Modal
      title={t('saveload.elague.titre')}
      onClose={fermer}
      footer={<button type="button" className="btn btn-primary" onClick={fermer}>{t('saveload.btn.close')}</button>}
    >
      <ChipDeRefus refus={{ message: t('saveload.elague', { liste: nommerLesRetraits(retraits) }) }} />
    </Modal>
  );
}

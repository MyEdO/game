import { useGame } from '../state/store';
import { Modal } from './Modal';
import { EmbeddedShell } from './RollShell';
import { ChoiceButtons } from './OptionChooser';
import { Coins } from './Coins';
import { refusDeGesteSurLeGroupe } from '../noyau/bourseFlow';
import { refusDePayerManann } from '../noyau/seaVoyageFlow';
import { Icon } from './Icon';

/**
 * MDG 15 l.246
 *
 * `embedded` (même patron que `ShoreLeaveBody`) : rendu SANS `Modal`, composé par l'onglet Escale du
 * hub de port (`PortView.EscaleTab`) — une SEULE prose de la décision, jamais une 2e copie divergente.
 */
export function ManannBody({ embedded = false }: { embedded?: boolean } = {}) {
  const p = useGame((s) => s.pendingManannPriest);
  const resolve = useGame((s) => s.resolveManannPriest);
  const refusPayer = useGame(refusDePayerManann);
  const refusRefuser = useGame(refusDeGesteSurLeGroupe);
  if (!p) return null;
  const title = <><Icon id="faith/church" size="sm" /> Un Prêtre de Manann s'avance…</>;
  const body = (
    <>
      <p className="modal-log">
        Il s'exclame que vous avez courroucé Manann par votre impiété et que votre bateau doit être
        purifié. Payez <Coins money={p.cost} /> pour une bénédiction, ou refusez et laissez l'Humeur
        de Manann chuter de 4d10.
      </p>
    </>
  );
  const footer = (
      <ChoiceButtons
        idPrefix="manann"
        options={[
          { key: 'payer', label: <><Icon id="resource/gold-purse" size="sm" /> Payer (<Coins money={p.cost} />)</>, primary: true, refus: refusPayer ?? undefined, onSelect: () => resolve(true), title: refusPayer ? undefined : 'Payer la bénédiction' },
          { key: 'refuser', label: <><Icon id="faith/trident" size="sm" /> Refuser (−4d10 Humeur de Manann)</>, refus: refusRefuser ?? undefined, onSelect: () => resolve(false), title: refusRefuser ? undefined : 'Refuser la bénédiction — Manann reste courroucé' },
        ]}
      />
  );
  if (embedded) return <EmbeddedShell title={title} footer={footer}>{body}</EmbeddedShell>;
  return <Modal title={title} footer={footer}>{body}</Modal>;
}

export function ManannPriestModal() {
  return <ManannBody />;
}

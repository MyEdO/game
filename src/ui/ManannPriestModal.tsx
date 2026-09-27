import { useGame } from '../state/store';
import { Modal } from './Modal';
import { EmbeddedShell } from './RollShell';
import { ChoiceButtons } from './OptionChooser';
import { Coins } from './Coins';
import { canAfford } from '../engine/money';
import { partyMoneyTotal } from '../state/bourseFlow';
import { Icon } from './Icon';

/**
 * Prêtre de Manann (MDG 15 l.246, événement de port) : « Vous pouvez soit payer 1d10 CO plus la
 * Taille du navire en pistoles pour une bénédiction, soit réduire l'Humeur de Manann de 4d10. »
 * CHOIX du joueur — `resolveManannPriest` tranche.
 *
 * `embedded` (même patron que `ShoreLeaveBody`) : rendu SANS `Modal`, composé par l'onglet Escale du
 * hub de port (`PortView.EscaleTab`) — une SEULE prose de la décision, jamais une 2e copie divergente.
 */
export function ManannBody({ embedded = false }: { embedded?: boolean } = {}) {
  const p = useGame((s) => s.pendingManannPriest);
  const money = useGame((s) => partyMoneyTotal(() => s));
  const resolve = useGame((s) => s.resolveManannPriest);
  const isGuest = useGame((s) => s.net.mode) === 'guest';
  if (!p) return null;
  const affordable = canAfford(money, p.cost);
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
          { key: 'payer', label: <><Icon id="resource/gold-purse" size="sm" /> Payer (<Coins money={p.cost} />)</>, primary: true, refus: isGuest ? 'L\'hôte décide.' : !affordable ? 'La bourse ne suit pas.' : undefined, onSelect: () => resolve(true), title: isGuest || !affordable ? undefined : 'Payer la bénédiction' },
          { key: 'refuser', label: <><Icon id="faith/trident" size="sm" /> Refuser (−4d10 Humeur de Manann)</>, refus: isGuest ? 'L\'hôte décide.' : undefined, onSelect: () => resolve(false), title: isGuest ? undefined : 'Refuser la bénédiction — Manann reste courroucé' },
        ]}
      />
  );
  if (embedded) return <EmbeddedShell title={title} footer={footer}>{body}</EmbeddedShell>;
  return <Modal title={title} footer={footer}>{body}</Modal>;
}

export function ManannPriestModal() {
  return <ManannBody />;
}

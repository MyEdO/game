import { useGame } from '../state/store';
import { Modal } from './Modal';
import { PortraitPicker } from './PortraitPicker';
import { ChoiceButtons } from './OptionChooser';
import { Icon } from './Icon';

/**
 * Combat monté (Livre de base p.14 l.219) : « Si vous tentez de toucher un Personnage qui est sur une
 * monture, vous choisissez de toucher soit le cavalier soit sa monture. » Cavalier et monture occupent
 * la MÊME case : cette modale DÉSAMBIGUÏSE le clic (elle reste une modale, pas un ciblage carte) :
 *  - frapper le CAVALIER : −10 au Test d'Arme si l'on est en mêlée et plus petit que la monture (l.219) ;
 *  - frapper la MONTURE : l'abattre DÉSARÇONNE le cavalier (il continue à pied — sweepDismountDeaths).
 */
export function MountTargetModal() {
  const pmt = useGame((s) => s.pendingMountTarget);
  const battle = useGame((s) => s.battle);
  const select = useGame((s) => s.mountTargetSelect);
  const cancel = useGame((s) => s.mountTargetCancel);
  if (!pmt || !battle) return null;
  const rider = battle.combatants.find((c) => c.id === pmt.riderId);
  const mount = battle.combatants.find((c) => c.id === pmt.mountId);
  if (!rider || !mount) return null;
  return (
    /* Décision DE COMBAT, champ lisible : voir le champ de bataille sous la fenêtre sert le choix. */
    <Modal
      title="Combat monté — cibler ?"
      champ
      onClose={cancel}
      footer={<ChoiceButtons options={[{ key: 'cancel', label: 'Annuler', ghost: true, onSelect: cancel }]} />}
    >
      <p className="modal-log">
        {rider.label} chevauche {mount.label} (même case — qui frapper ?) : viser le cavalier impose −10 si vous êtes
        plus petit que la monture ; abattre la monture désarçonne le cavalier.
      </p>
      {/* Choix = picker de PORTRAITS mutualisé (`PortraitPicker`) dans le corps ; le pied porte le
          seul geste de sortie. */}
      <div className="rm-options">
        <PortraitPicker
          choices={[
            { c: mount, caption: <><Icon id="travel/mount" size="sm" /> Monture</>, nom: `${mount.label} — l'abattre désarçonne le cavalier` },
            { c: rider, caption: <><Icon id="action/attack" size="sm" /> Cavalier</>, nom: `${rider.label} — −10 si vous êtes plus petit que la monture` },
          ]}
          onPick={(id) => select(id)}
        />
      </div>
    </Modal>
  );
}

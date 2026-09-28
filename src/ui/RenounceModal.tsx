import { useGame } from '../state/store';
import { Modal } from './Modal';
import { ChoiceButtons } from './OptionChooser';
import { Icon } from './Icon';

/**
 * « Je te renie ! » (LDB 17 l.67) : le héros a échoué au Test de Résistance du seuil de Corruption —
 * la mutation menace. Il peut sacrifier 1 Point de Résilience pour la REFUSER : « vous pouvez choisir
 * de ne pas développer la mutation obtenue. Et comme vous ne mutez pas, vous ne perdez aucun Point
 * de Corruption. » Sinon, la mutation s'applique (−BFM Points, tirage sur le Tableau).
 */
export function RenounceModal() {
  const pr = useGame((s) => s.pendingRenounce);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const resolve = useGame((s) => s.renounceResolve);
  if (!pr) return null;
  const hero = (battle?.combatants ?? party).find((c) => c.id === pr.heroId);
  if (!hero) return null;
  const resilience = hero.resilience ?? 0;
  return (
    <Modal title={<><Icon id="nav/mutation" size="sm" /> La Corruption gagne du terrain</>}
      footer={
        <ChoiceButtons
          idPrefix="renounce"
          options={[
            { key: 'subir', label: <><Icon id="nav/dice" size="sm" /> Subir la mutation</>, onSelect: () => resolve(false), title: 'Laisser la mutation se développer (tirage sur le Tableau des Corruptions)' },
            { key: 'renier', label: <><Icon id="resource/resolve" size="sm" /> Je te renie ! (−1 Résilience)</>, primary: true, onSelect: () => resolve(true),
              ...(resilience <= 0
                ? { refus: 'Plus aucun Point de Résilience à sacrifier.' }
                : { title: 'Refuser la mutation — 1 Point de Résilience' }) },
          ]}
        />
      }
    >
      <p className="modal-log">
        <b>{hero.label}</b> échoue à contenir sa Corruption (Résistance <Icon id="nav/dice" size="sm" /> {pr.testRoll}/{pr.testTarget}) — une{' '}
        <b>mutation</b> menace de se développer.
      </p>
      <p className="modal-log">
        « Je te renie ! » : sacrifier <b>1 Point de Résilience</b> ({resilience} restant{resilience > 1 ? 's' : ''}) pour
        refuser la mutation. Les Points de Corruption restent — la menace reviendra.
      </p>
    </Modal>
  );
}

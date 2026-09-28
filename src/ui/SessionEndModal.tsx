import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { useGame } from '../state/store';
import { Grid } from './Layout';

type HeroKey = 'ambitionShort' | 'ambitionLong' | 'motivation';

/**
 * CORPS de la FIN DE SÉANCE (LDB 05 Ambitions + LDB 17 Détermination) — le groupe coche les Ambitions
 * accomplies (personnelles et de groupe) et les héros ayant agi selon leur Motivation. « Terminer
 * la séance » octroie les PX d'Ambition (+50 court / +500 long) et regagne la Détermination via
 * `store.endSession`, puis restaure la Chance pour la prochaine séance. Responsive (`Grid`).
 *
 * PUR : ni voile ni piège Tab — il se monte tel quel DANS un écran plein-champ qui porte déjà les
 * siens (récap de fin de chapitre, #717) comme dans sa modale ci-dessous. `apercu` le rend INERTE
 * (aperçu estompé de l'étape suivante) : hors du flux de lecture (`aria-hidden`) et hors d'atteinte
 * du clavier comme du pointeur (contrôles désactivés), jamais une simple opacité.
 *
 * DEUX issues DISTINCTES, fournies par l'hôte du formulaire : `onDone` reçoit la séance APPLIQUÉE
 * (après `endSession`), `onCancel` le RENONCEMENT. Les confondre rendait « Annuler » destructif dans
 * le récap de chapitre (il cloît le chapitre, archive vidée, sans PX).
 *
 * Rend le CORPS et les GESTES à part : le cadre hôte pose `gestes` dans son pied (`Modal` ou
 * `ScreenShell` `footer`).
 */
export function useSessionEnd({ onDone, onCancel, apercu }: { onDone: () => void; onCancel: () => void; apercu?: boolean }): { corps: ReactNode; gestes: ReactNode } {
  const party = useGame((s) => s.party.filter((h) => h.kind === 'hero'));
  const endSession = useGame((s) => s.endSession);
  const [heroes, setHeroes] = useState<Record<string, Partial<Record<HeroKey, boolean>>>>({});
  const [group, setGroup] = useState<{ ambitionShort?: boolean; ambitionLong?: boolean }>({});
  const toggle = (id: string, key: HeroKey) =>
    setHeroes((h) => ({ ...h, [id]: { ...h[id], [key]: !h[id]?.[key] } }));
  const confirm = () => { endSession({ heroes, group }); onDone(); };

  const corps = (
    <div data-apercu={apercu ? '' : undefined} aria-hidden={apercu || undefined}>
      <p className="muted">
        Cochez les Ambitions accomplies (+50 PX court terme, +500 long terme) et les héros ayant
        agi selon leur Motivation (+1 Détermination). La Chance du groupe sera restaurée pour la
        prochaine séance.
      </p>
      <section className="hr-group">
        <h4 className="mini-title">Ambitions de groupe</h4>
        <label className="se-check">
          <input type="checkbox" disabled={apercu} checked={!!group.ambitionShort} onChange={() => setGroup((g) => ({ ...g, ambitionShort: !g.ambitionShort }))} />
          Court terme accomplie (+50 PX à chaque héros)
        </label>
        <label className="se-check">
          <input type="checkbox" disabled={apercu} checked={!!group.ambitionLong} onChange={() => setGroup((g) => ({ ...g, ambitionLong: !g.ambitionLong }))} />
          Long terme accomplie (+500 PX à chaque héros)
        </label>
      </section>
      <Grid min="md" stackBelow={700}>
        {party.map((h) => (
          <section key={h.id} className="se-hero hr-group">
            <h4 className="mini-title">{h.label}</h4>
            <label className="se-check" title={h.details?.ambitionShort ?? 'Aucune Ambition à court terme notée'}>
              <input type="checkbox" disabled={apercu} checked={!!heroes[h.id]?.ambitionShort} onChange={() => toggle(h.id, 'ambitionShort')} />
              Ambition court terme (+50)
            </label>
            <label className="se-check" title={h.details?.ambitionLong ?? 'Aucune Ambition à long terme notée'}>
              <input type="checkbox" disabled={apercu} checked={!!heroes[h.id]?.ambitionLong} onChange={() => toggle(h.id, 'ambitionLong')} />
              Ambition long terme (+500)
            </label>
            <label className="se-check" title={h.motivation ?? 'Aucune Motivation notée'}>
              <input type="checkbox" disabled={apercu} checked={!!heroes[h.id]?.motivation} onChange={() => toggle(h.id, 'motivation')} />
              A agi selon sa Motivation (+1 Détermination)
            </label>
          </section>
        ))}
      </Grid>
    </div>
  );
  const gestes = (
    <>
      <button className="btn" disabled={apercu} onClick={onCancel}>Annuler</button>
      <button className="btn btn-primary" disabled={apercu} onClick={confirm}>Terminer la séance</button>
    </>
  );
  return { corps, gestes };
}

/** La fin de séance en MODALE (menu système, Effet `sessionEnd`) — le voile et le piège Tab de
 *  `Modal` autour du corps ci-dessus, SOURCE UNIQUE du formulaire. */
export function SessionEndModal({ onClose }: { onClose: () => void }) {
  const { corps, gestes } = useSessionEnd({ onDone: onClose, onCancel: onClose });
  return (
    <Modal title="Fin de séance" onClose={onClose} backdropClose footer={gestes}>
      {corps}
    </Modal>
  );
}

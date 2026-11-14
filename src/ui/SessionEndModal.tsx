import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { useGame } from '../state/store';
import { Grid } from './Layout';
import { GatedAction, raisonSi } from './GatedAction';
import { herosDeLaSeance, type AxeDuGroupe, type AxeDuHerosDeLaSeance } from '../noyau/partyFlow';
import { reglageDuChoixDeFenetre, refusDuChoixNomme } from '../noyau/choixDeFenetre';
import { refusDeLaValidationNommee } from '../noyau/validationDeFenetre';
import { refusDeLaSortieNommee } from '../noyau/sortieDeFenetre';
import type { IdDeHeros } from '../noyau/designations';

/**
 * LDB 05 Ambitions ; LDB 17 Détermination.
 *
 * PUR : ni voile ni piège Tab — il se monte tel quel DANS un écran plein-champ qui porte déjà les
 * siens (récap de fin de chapitre, #717) comme dans sa modale ci-dessous. `apercu` le rend INERTE
 * (aperçu estompé de l'étape suivante) : hors du flux de lecture (`aria-hidden`) et hors d'atteinte
 * du clavier comme du pointeur (contrôles désactivés), jamais une simple opacité.
 *
 * Chaque case est un choix de la fin de séance (`fenetreChoisir('finDeSeance', axe, valeur[, héros])`), lu dans le
 * noyau avec son refus (`refusDuChoixNomme`). Les deux issues sont celles de la fenêtre `fenetre` qui porte le formulaire :
 * « Terminer la séance », sa validation (`fenetreValider`) ; « Annuler », sa sortie (`fenetreFermer`), qui ne termine
 * rien — dans le récap de chapitre, elle ajourne.
 *
 * Rend le CORPS et les GESTES à part : le cadre hôte pose `gestes` dans son pied (`Modal` ou
 * `ScreenShell` `footer`).
 */
export function useSessionEnd({ fenetre, apercu }: { fenetre: 'finDeSeance' | 'finDeChapitre'; apercu?: boolean }): { corps: ReactNode; gestes: ReactNode } {
  const party = herosDeLaSeance({ party: useGame((s) => s.party) });
  const choisir = useGame((s) => s.fenetreChoisir);
  const valider = useGame((s) => s.fenetreValider);
  const fermer = useGame((s) => s.fenetreFermer);
  // Les cases cochées et le siège ouvrent ou ferment chaque case (`refusDuChoixNomme`).
  useGame((s) => s.finDeSeance);
  useGame((s) => s.net);
  const s = useGame.getState();
  const caseDe = (axe: AxeDuGroupe | AxeDuHerosDeLaSeance, pid?: IdDeHeros) => {
    const coche = reglageDuChoixDeFenetre(s, 'finDeSeance', axe, pid).courant === true;
    return {
      checked: coche,
      disabled: apercu || refusDuChoixNomme(s, 'finDeSeance', axe, !coche, pid) != null,
      onChange: () => choisir('finDeSeance', axe, !coche, pid),
    };
  };
  const refusDeTerminer = refusDeLaValidationNommee(s, fenetre);
  const refusDAnnuler = refusDeLaSortieNommee(s, fenetre);

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
          <input type="checkbox" {...caseDe('ambitionCourte')} />
          Court terme accomplie (+50 PX à chaque héros)
        </label>
        <label className="se-check">
          <input type="checkbox" {...caseDe('ambitionLongue')} />
          Long terme accomplie (+500 PX à chaque héros)
        </label>
      </section>
      <Grid min="md" stackBelow={700}>
        {party.map((h) => (
          <section key={h.id} className="se-hero hr-group">
            <h4 className="mini-title">{h.label}</h4>
            <label className="se-check" title={h.details?.ambitionShort ?? 'Aucune Ambition à court terme notée'}>
              <input type="checkbox" {...caseDe('ambitionPersonnelleCourte', h.id)} />
              Ambition court terme (+50)
            </label>
            <label className="se-check" title={h.details?.ambitionLong ?? 'Aucune Ambition à long terme notée'}>
              <input type="checkbox" {...caseDe('ambitionPersonnelleLongue', h.id)} />
              Ambition long terme (+500)
            </label>
            <label className="se-check" title={h.motivation ?? 'Aucune Motivation notée'}>
              <input type="checkbox" {...caseDe('motivation', h.id)} />
              A agi selon sa Motivation (+1 Détermination)
            </label>
          </section>
        ))}
      </Grid>
    </div>
  );
  const gestes = (
    <>
      <GatedAction id="se-annuler" label="Annuler" primary={false} enabled={!apercu && refusDAnnuler == null} {...raisonSi(apercu ? null : refusDAnnuler)} onClick={() => fermer(fenetre)} />
      <GatedAction id="se-terminer" label="Terminer la séance" enabled={!apercu && refusDeTerminer == null} {...raisonSi(apercu ? null : refusDeTerminer)} onClick={() => valider(fenetre)} />
    </>
  );
  return { corps, gestes };
}

/** La fin de séance en MODALE (menu système, Effet `sessionEnd`) — le voile et le piège Tab de
 *  `Modal` autour du corps ci-dessus, SOURCE UNIQUE du formulaire. Échap la ferme quand le siège le peut. */
export function SessionEndModal() {
  const { corps, gestes } = useSessionEnd({ fenetre: 'finDeSeance' });
  const fermer = useGame((s) => s.fenetreFermer);
  const peutFermer = useGame((s) => refusDeLaSortieNommee(s, 'finDeSeance') == null);
  return (
    <Modal title="Fin de séance" {...(peutFermer ? { onClose: () => fermer('finDeSeance'), backdropClose: true } : {})} footer={gestes}>
      {corps}
    </Modal>
  );
}

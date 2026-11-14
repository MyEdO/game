import { useMemo } from 'react';
import { useGame } from '../state/store';
import { Modal } from './Modal';
import { CharFrame } from './CharFrame';
import { OptionChooser } from './OptionChooser';
import { Prose } from './Prose';
import { seaActivitiesCatalog } from '../noyau/seaActivities';
import { reglageDuChoixDeFenetre, refusDuChoixNomme } from '../noyau/choixDeFenetre';
import { refusDeLaValidationNommee } from '../noyau/validationDeFenetre';
import type { IdDActiviteEnMer } from '../noyau/designations';
import { findRegleById } from '../data';
import { encLibreNominale } from '../noyau/portFlow';
import { partyMoneyTotal } from '../noyau/bourseFlow';
import { Coins } from './Coins';
import { NumberField } from './NumberField';
import { Icon } from './Icon';
import { Grid } from './Layout';
import { GatedAction, raisonSi } from './GatedAction';

/** MDG 15 l.266-306 — chaque choix est un choix de la fenêtre (`fenetreChoisir('activitesEnMer', axe, valeur, héros)`),
 *  lu dans le noyau avec ses refus (`refusDuChoixNomme`) ; l'hôte valide la semaine (`fenetreValider('activitesEnMer')`). */
export function SeaActivitiesModal() {
  const pending = useGame((s) => s.pendingSeaActivities);
  const party = useGame((s) => s.party);
  const money = useMemo(() => partyMoneyTotal(useGame.getState), [party]);
  const choisir = useGame((s) => s.fenetreChoisir);
  const valider = useGame((s) => s.fenetreValider);
  const vessel = useGame((s) => s.vessel);
  // Le siège et la possession des héros ouvrent ou ferment chaque rangée (`refusDuChoixNomme`).
  useGame((s) => s.net);
  const catalog = useMemo(() => seaActivitiesCatalog(), []);
  // Le texte d'ouverture est une fiche de Règle ADRESSÉE (`regles.json`), pas une constante de code.
  const intro = findRegleById('activites-en-mer');
  if (!pending) return null;
  const s = useGame.getState();
  const heroes = party.filter((h) => !h.dead && !h.outOfRencontre);
  const refusDeValider = refusDeLaValidationNommee(s, 'activitesEnMer');
  const freeEnc = encLibreNominale(vessel);

  return (
    <Modal title={<><Icon id="voyage/ancre" size="sm" /> Activités en mer — semaine écoulée</>} taille="large"
      footer={
        <>
          <GatedAction id="sea-act-confirm" label="Valider la semaine" enabled={refusDeValider == null} {...raisonSi(refusDeValider)} onClick={() => valider('activitesEnMer')} />
        </>
      }
    >
      {intro?.desc && (
        <div className="sea-act-intro">
          <Prose md={intro.desc} porteur={{ type: 'regles', id: intro.id, chemin: 'desc' }} />
        </div>
      )}
      <Grid min="md" stackBelow={700}>
        {heroes.map((h) => {
          const activite = reglageDuChoixDeFenetre(s, 'activitesEnMer', 'activite', h.id);
          const chosen = typeof activite.courant === 'string' ? activite.courant : '';
          const chosenDef = chosen ? catalog.find((d) => d.id === chosen) : undefined;
          const mise = reglageDuChoixDeFenetre(s, 'activitesEnMer', 'investir', h.id);
          const planque = reglageDuChoixDeFenetre(s, 'activitesEnMer', 'cacher', h.id);
          return (
            <section key={h.id} className="panel sea-act-hero">
              <h4><CharFrame c={h} variant="identity" size="xs" /></h4>
              <OptionChooser
                layout="grid"
                options={(activite.valeurs ?? []).map((v) => {
                  const valeur = v.valeur as IdDActiviteEnMer | null;
                  // Fermée pour tous, pour CE héros seul (LDB 09 l.30 ; #2588), ou à un autre siège : `refusDuChoixNomme`.
                  const refus = refusDuChoixNomme(s, 'activitesEnMer', 'activite', valeur, h.id);
                  return {
                    key: valeur ?? 'repos',
                    label: v.libelle,
                    selected: activite.courant === valeur,
                    ...(refus ? { refus } : valeur ? { title: v.libelle } : {}),
                    onSelect: () => choisir('activitesEnMer', 'activite', valeur, h.id),
                  };
                })}
              />
              {chosen && (
                <div className="sea-act-detail">
                  <Prose md={chosenDef?.desc ?? ''} porteur={chosenDef && { type: 'activities', id: chosenDef.id, chemin: 'desc' }} />
                  {mise.bornes && (
                    <label className="sea-act-invest">
                      Mise (CO, max {mise.bornes.max})
                      <NumberField
                        variant="nu"
                        label={`Mise (CO, max ${mise.bornes.max})`}
                        min={0}
                        max={mise.bornes.max}
                        value={Number(mise.courant)}
                        disabled={refusDuChoixNomme(s, 'activitesEnMer', 'investir', mise.courant, h.id) != null}
                        onChange={(investGold) => choisir('activitesEnMer', 'investir', investGold, h.id)}
                      />
                    </label>
                  )}
                  {planque.bornes && (
                    <label className="sea-act-invest">
                      Planque gratuite (CO, max {planque.bornes.max})
                      <NumberField
                        variant="nu"
                        label={`Planque gratuite (CO, max ${planque.bornes.max})`}
                        min={0}
                        max={planque.bornes.max}
                        value={Number(planque.courant)}
                        disabled={refusDuChoixNomme(s, 'activitesEnMer', 'cacher', planque.courant, h.id) != null}
                        onChange={(stashGold) => choisir('activitesEnMer', 'cacher', stashGold, h.id)}
                      />
                    </label>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </Grid>
      <p className="sea-act-purse">Bourse du groupe : <b><Coins money={money} /></b> · Cale libre : <b>{freeEnc} Enc</b></p>
    </Modal>
  );
}

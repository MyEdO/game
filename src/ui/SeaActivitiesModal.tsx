import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { Modal } from './Modal';
import { CharFrame } from './CharFrame';
import { OptionChooser } from './OptionChooser';
import { Prose } from './Prose';
import {
  seaActivitiesCatalog, seaActivityBlocked, seaActivityRefus, plafondDeMiseDOpportunite, plafondDePlanque,
  type SeaActivityPick,
} from '../noyau/seaActivities';
import { findRegleById } from '../data';
import { encLibreNominale } from '../noyau/portFlow';
import { partyMoneyTotal, refusDeGesteSurLeGroupe } from '../noyau/bourseFlow';
import { Coins } from './Coins';
import { NumberField } from './NumberField';
import { Icon } from './Icon';
import { Grid } from './Layout';
import { GatedAction, raisonSi } from './GatedAction';

/** MDG 15 l.266-306 */
export function SeaActivitiesModal() {
  const pending = useGame((s) => s.pendingSeaActivities);
  const party = useGame((s) => s.party);
  const money = useMemo(() => partyMoneyTotal(useGame.getState), [party]);
  const confirm = useGame((s) => s.seaActivitiesConfirm);
  const vessel = useGame((s) => s.vessel);
  const net = useGame((s) => s.net);
  const catalog = useMemo(() => seaActivitiesCatalog(), []);
  // Le texte d'ouverture est une fiche de Règle ADRESSÉE (`regles.json`), pas une constante de code.
  const intro = findRegleById('activites-en-mer');
  const [picks, setPicks] = useState<Record<string, SeaActivityPick | null>>({});
  if (!pending) return null;
  const heroes = party.filter((h) => !h.dead && !h.outOfRencontre);
  const investCap = plafondDeMiseDOpportunite({ vessel, party });
  const refusGroupe = refusDeGesteSurLeGroupe({ net });
  const freeEnc = encLibreNominale(vessel);
  const set = (id: string, pick: SeaActivityPick | null) => setPicks((p) => ({ ...p, [id]: pick }));

  return (
    <Modal title={<><Icon id="travel/anchor" size="sm" /> Activités en mer — semaine écoulée</>} taille="large"
      footer={
        <>
          <GatedAction id="sea-act-confirm" label="Valider la semaine" enabled={refusGroupe == null} {...raisonSi(refusGroupe)} onClick={() => confirm(picks)} />
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
          const pick = picks[h.id];
          const chosen = pick?.activityId ?? '';
          const chosenDef = chosen ? catalog.find((d) => d.id === chosen) : undefined;
          const stashCap = plafondDePlanque(h);
          return (
            <section key={h.id} className="panel sea-act-hero">
              <h4><CharFrame c={h} variant="identity" size="xs" /></h4>
              <OptionChooser
                layout="grid"
                options={[
                  { key: 'repos', label: 'Repos', selected: !chosen, onSelect: () => set(h.id, null) },
                  ...catalog.map((def) => {
                    // Fermée pour tous (`seaActivityBlocked`), ou pour CE héros seul (`seaActivityRefus`, LDB 09 l.30 ; #2588).
                    const refus = seaActivityBlocked(useGame.getState, def) ?? seaActivityRefus(h, def);
                    return {
                      key: def.id,
                      label: def.label,
                      selected: chosen === def.id,
                      ...(refus ? { refus } : { title: def.label }),
                      onSelect: () => set(h.id, { activityId: def.id }),
                    };
                  }),
                ]}
              />
              {chosen && (
                <div className="sea-act-detail">
                  <Prose md={chosenDef?.desc ?? ''} porteur={chosenDef && { type: 'activities', id: chosenDef.id, chemin: 'desc' }} />
                  {catalog.find((d) => d.id === chosen)?.resolver === 'opportunityTrade' && (
                    <label className="sea-act-invest">
                      Mise (CO, max {investCap})
                      <NumberField
                        variant="nu"
                        label={`Mise (CO, max ${investCap})`}
                        min={0}
                        max={investCap}
                        value={pick?.investGold ?? 0}
                        onChange={(investGold) => set(h.id, { activityId: chosen, investGold })}
                      />
                    </label>
                  )}
                  {catalog.find((d) => d.id === chosen)?.resolver === 'seaChart' && (
                    <label className="sea-act-invest">
                      Planque gratuite (CO, max {stashCap})
                      <NumberField
                        variant="nu"
                        label={`Planque gratuite (CO, max ${stashCap})`}
                        min={0}
                        max={stashCap}
                        value={pick?.stashGold ?? 0}
                        onChange={(stashGold) => set(h.id, { activityId: chosen, stashGold })}
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

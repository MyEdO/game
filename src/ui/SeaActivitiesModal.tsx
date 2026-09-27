import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { Modal } from './Modal';
import { CharFrame } from './CharFrame';
import { OptionChooser } from './OptionChooser';
import { Prose } from './Prose';
import {
  seaActivitiesCatalog, seaActivityBlocked,
  type SeaActivityPick,
} from '../state/seaActivities';
import { findVehicleById, findRegleById } from '../data';
import { cargoTotalEnc } from '../engine/seaVoyage';
import { toBrass, PA_PER_CO } from '../engine/money';
import { partyMoneyTotal, bourseOf } from '../state/bourseFlow';
import { Coins } from './Coins';
import { NumberField } from './NumberField';
import { Icon } from './Icon';
import { Grid } from './Layout';

/**
 * ACTIVITÉS EN MER (MDG 15 l.266-306) — modale hebdomadaire (semaine de 8 jours, l.268) : chaque
 * héros vivant choisit AU PLUS une Activité du catalogue 'mer' (source UNIQUE `activities.json`, rail
 * réutilisé de l'interlude). Le Commerce d'opportunité (l.276) expose une mise en CO plafonnée par
 * l'Encombrement libre du navire et la bourse ; la Cartographie (l.292) expose une Planque gratuite
 * plafonnée par la bourse. « Entretien du navire » n'est PAS ici (déjà câblé au Test d'équipage
 * nocturne). Responsive : une carte par héros (`Grid` → 1 colonne ≤700px).
 */
export function SeaActivitiesModal() {
  const pending = useGame((s) => s.pendingSeaActivities);
  const party = useGame((s) => s.party);
  const money = useGame((s) => partyMoneyTotal(() => s));
  const confirm = useGame((s) => s.seaActivitiesConfirm);
  const vessel = useGame((s) => s.vessel);
  const freeEnc = vessel
    ? Math.max(0, (findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0) - cargoTotalEnc(vessel.cargo ?? []))
    : 0;
  const catalog = useMemo(() => seaActivitiesCatalog(), []);
  // Le texte d'ouverture est une fiche de Règle ADRESSÉE (`regles.json`), pas une constante de code.
  const intro = findRegleById('activites-en-mer');
  const [picks, setPicks] = useState<Record<string, SeaActivityPick | null>>({});
  if (!pending) return null;
  const heroes = party.filter((h) => !h.dead && !h.outOfRencontre);
  const investCap = Math.min(freeEnc, Math.floor(toBrass(money) / PA_PER_CO));
  const set = (id: string, pick: SeaActivityPick | null) => setPicks((p) => ({ ...p, [id]: pick }));

  return (
    <Modal title={<><Icon id="travel/anchor" size="sm" /> Activités en mer — semaine écoulée</>} taille="large"
      footer={
        <>
          <button type="button" className="btn btn-primary" onClick={() => confirm(picks)}>Valider la semaine</button>
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
          // Planque de la Cartographie : DÉBIT solo du cartographe (soloPayer, seaActivities.ts) —
          // le plafond est SA bourse, pas le total du groupe (le Commerce d'opportunité, lui, est
          // un investissement de GROUPE plafonné par `investCap`).
          const stashCap = Math.floor(toBrass(bourseOf(h)) / PA_PER_CO);
          return (
            <section key={h.id} className="panel sea-act-hero">
              <h4><CharFrame c={h} variant="identity" size="xs" /> {h.label}</h4>
              <OptionChooser
                layout="grid"
                options={[
                  { key: 'repos', label: 'Repos', selected: !chosen, onSelect: () => set(h.id, null) },
                  ...catalog.map((def) => {
                    const blocked = seaActivityBlocked(useGame.getState, def);
                    return {
                      key: def.id,
                      label: def.label,
                      selected: chosen === def.id,
                      ...(blocked ? { refus: blocked } : { title: def.label }),
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

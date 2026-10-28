import { useState } from 'react';
import type { CargoCarrier } from '../engine/cargo';
import { carrierFreeEnc } from '../engine/cargo';
import { planDeTransfert } from '../noyau/carriers';
import { refusDeGesteSurLeGroupe } from '../noyau/bourseFlow';
import { useGame } from '../state/store';
import { GatedAction, raisonSi } from './GatedAction';
import { spanFull } from './Layout';
import { NumberField } from './NumberField';

/**
 * SURFACE DE TRANSFERT de cargaison entre porteurs CO-LOCALISÉS (#327, décision 9) — composée dans les
 * écrans EXISTANTS (marché terrestre bât↔véhicule, dossier navire navire↔porteur terrestre au port). Route
 * sur l'action store `moveCargo`. Aucune 2ᵉ modale : un simple formulaire source→cible→lot→quantité, dont
 * choix, plafond et refus sont ceux du plan du noyau (`planDeTransfert`). Ne s'affiche que s'il y a au
 * moins deux porteurs et du vrac à déplacer.
 */
export function CargoTransferPanel({ carriers, onMove, labelOf, ...placement }: {
  carriers: CargoCarrier[];
  onMove: (fromId: string, toId: string, cargoId: string, enc: number) => void;
  labelOf: (cargoId: string) => string;
} & Partial<typeof spanFull>) {
  const [rawFrom, setFrom] = useState('');
  const [rawTo, setTo] = useState('');
  const [rawCargo, setCargo] = useState('');
  const [encSaisi, setEncSaisi] = useState<number | null>(null);
  // Transférer touche la cale du groupe : refus d'invité lu au noyau, comme `moveCargo` le lit en tête.
  const refusHote = useGame(refusDeGesteSurLeGroupe);
  const disabled = refusHote != null;

  const plan = planDeTransfert(carriers, { fromId: rawFrom, toId: rawTo, cargoId: rawCargo, enc: encSaisi });
  const { sources, from, dests, to, lot, maxEnc, enc: amount } = plan;
  if (!from || carriers.length < 2) return null;

  return (
    <details className="fold cargo-transfer-fold" {...placement}>
      <summary><span className="fold-title">Transférer une cargaison</span></summary>
      <div className="fold-body">
        {!to ? (
          <p className="port-hint">{plan.refus}</p>
        ) : (
          <div className="bar cargo-transfer">
            <label>De
              <select value={from.id} disabled={disabled} onChange={(e) => setFrom(e.target.value)}>
                {sources.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label>Lot
              <select value={lot?.cargoId ?? ''} disabled={disabled} onChange={(e) => setCargo(e.target.value)}>
                {from.cargo.map((l, i) => <option key={i} value={l.cargoId}>{labelOf(l.cargoId)} ({l.enc} Enc)</option>)}
              </select>
            </label>
            <label>Vers
              <select value={to?.id ?? ''} disabled={disabled} onChange={(e) => setTo(e.target.value)}>
                {dests.map((c) => <option key={c.id} value={c.id}>{c.label} — libre {carrierFreeEnc(c)} Enc</option>)}
              </select>
            </label>
            <label>Enc
              <NumberField
                variant="nu" label="Enc à transférer" vide value={encSaisi} onChange={setEncSaisi}
                min={0} max={maxEnc} placeholder={String(maxEnc)} disabled={disabled}
              />
            </label>
            <GatedAction
              id="cargo-transfer" label="Transférer" primary={false} btnClassName="small"
              enabled={refusHote == null && plan.refus === null} {...raisonSi(refusHote ?? plan.refus)}
              onClick={() => { if (plan.refus === null) { onMove(plan.from.id, plan.to.id, plan.lot.cargoId, amount); setEncSaisi(null); } }}
            />
          </div>
        )}
      </div>
    </details>
  );
}

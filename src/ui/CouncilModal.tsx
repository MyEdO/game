import { useGame } from '../state/store';
import { Modal } from './Modal';
import { OptionChooser } from './OptionChooser';
import { MultiRollList } from './MultiRollList';
import { Coins } from './Coins';
import { Icon } from './Icon';
import { moraleBand, findMoraleFactor, payChoices, payChoiceCostBrass } from '../engine/crewMorale';
import { fromBrass, toBrass } from '../engine/money';
import { partyMoneyTotal } from '../state/bourseFlow';
import { moraleTone } from './shipStatus';

/**
 * CONSEIL DE BORD hebdomadaire (#229, MDG 14) — remplace les lignes de journal muettes de la paie quand un
 * humain est à la barre. Phase CHOIX : la solde due (paie régulière) face à la bourse, puis les 4 facteurs de
 * paie RÉELS (crew-morale.json, par id) avec leur montant et leur effet de Moral — l'option non payable est
 * désactivée, « Pas de paie » reste toujours offerte. Phase BILAN : le recalcul de Moral se JOUE là où le
 * jet a lieu (procès-verbal `MultiRollList` des facteurs, delta et nouvelle bande). Coquille `Modal` +
 * primitives partagées (`OptionChooser`, `MultiRollList`, `Coins`) — aucune coquille maison.
 */
export function CouncilModal() {
  const p = useGame((s) => s.pendingCouncil);
  const purseBrass = useGame((s) => toBrass(partyMoneyTotal(() => s)));
  const councilPay = useGame((s) => s.councilPay);
  const councilClose = useGame((s) => s.councilClose);
  if (!p) return null;

  const title = <><Icon id="scenario/naval" size="sm" /> Conseil de bord</>;

  // ── Phase BILAN : le recalcul de Moral joué (PV des facteurs + delta + nouvelle bande) ──
  if (p.phase === 'bilan') {
    const after = p.after ?? 0;
    const band = moraleBand(after);
    const delta = p.delta ?? 0;
    const chosen = p.decision ? findMoraleFactor(p.decision) : undefined;
    return (
      <Modal title={title} className="council-modal" onClose={councilClose} etape={p.phase}
        footer={<button className="btn btn-primary" onClick={() => councilClose()}>Clore le conseil</button>}
      >
        {chosen && <p className="port-hint">Paie de la semaine : <b>{chosen.label}</b>.</p>}
        <MultiRollList entries={p.results ?? []} />
        <p className={`council-result ${moraleTone(after)}`}>
          Moral : <b>{p.before}</b> → <b>{after}</b> ({delta >= 0 ? '+' : ''}{delta}) — {band.label}
        </p>
      </Modal>
    );
  }

  // ── Phase CHOIX : la paie de la semaine (décision requise → non annulable ; « Pas de paie » gratuit) ──
  const money = fromBrass(purseBrass);
  const options = payChoices().map(({ factorId }) => {
    const f = findMoraleFactor(factorId);
    const costBrass = payChoiceCostBrass(p.wageBrass, factorId);
    const affordable = costBrass <= purseBrass; // un choix GRATUIT (`wageMul: 0`) l'est toujours : 0 ≤ bourse
    return {
      key: factorId,
      label: f?.label ?? factorId,
      primary: !!f?.recommendedPay && affordable,
      ...(affordable ? {} : { refus: 'Bourse insuffisante.' }),
      content: (
        <>
          <span className="council-opt-label">{f?.label ?? factorId}</span>
          <span className="council-opt-cost">{costBrass > 0 ? <Coins money={fromBrass(costBrass)} /> : 'gratuit'}</span>
          <span className="council-opt-effect">{f?.effect} Moral</span>
        </>
      ),
      onSelect: () => councilPay(factorId),
    };
  });

  return (
    <Modal title={title} className="council-modal" onClose={undefined} etape={p.phase}>
      <p className="port-hint">
        Solde due (paie régulière) : <b><Coins money={fromBrass(p.wageBrass)} /></b> · Bourse <Coins money={money} />
      </p>
      <OptionChooser layout="grid" groupLabel="Paie de la semaine" options={options} />
    </Modal>
  );
}

// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { LandMarketView } from './LandMarketView';
import { useGame } from '../state/store';
import { emptyScene } from '../noyau/monde/scene';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from '../noyau/battleRng';
import type { WorldMap } from '../noyau/worldMap';
import { creditBourse } from '../noyau/bourseFlow';
import { minCargoEnc } from '../engine/landCargo';
import { t } from '../i18n';
import { devisDAchatDeCargaison, raisonDuRefusDAchatDeCargaison } from '../noyau/landMarketFlow';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const get = useGame.getState.bind(useGame);

const landMap: WorldMap = {
  id: 'm', label: 'Reikland',
  places: [{ id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'ville-a', market: { taille: 4, richesse: 4, produits: ['vivres', 'vin', 'metal', 'commerce'] } }],
  routes: [],
};

/** « Évaluer » du premier lot de Vin, monté au client : état du geste et raison rendue. */
function evaluer() {
  const wine = get().landMarket!.offers.find((o) => o.wine && !o.wineTier)!;
  const hote = document.createElement('div');
  const root = createRoot(hote);
  act(() => root.render(<LandMarketView />));
  const bouton = [...hote.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === `Évaluer ${wine.label}`);
  const etat = { rendu: !!bouton, ferme: bouton?.getAttribute('aria-disabled') ?? null, raison: hote.querySelector(`#market-eval-${wine.cargoId}-reason`)?.textContent ?? null };
  act(() => root.unmount());
  return etat;
}

describe('LandMarketView — « Évaluer » le vin suit qui peut tenter le Test (LDB 09 l.30)', () => {
  beforeEach(() => {
    useGame.setState({
      party: makePregens().slice(0, 3), possessions: [],
      scene: { ...emptyScene('ville-a', 2, 2), label: 'Ville', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      battle: null, worldMap: landMap, travelPlan: null, landMarket: null, journal: [],
    } as never);
    seedBattleRng(3);
    get().openLandMarket();
  });

  it('un héros formé à l’Évaluation : le geste est offert', () => {
    expect(get().party.some((h) => h.skills.some((sk) => sk.id === 'evaluation' && (sk.advances ?? 0) > 0))).toBe(true);
    expect(evaluer()).toEqual({ rendu: true, ferme: null, raison: null });
  });

  it('personne qui l’ait : le geste est fermé, sa raison NOMMÉE', () => {
    useGame.setState({ party: get().party.map((h) => ({ ...h, skills: h.skills.filter((sk) => sk.id !== 'evaluation') })) });
    expect(evaluer()).toEqual({ rendu: true, ferme: 'true', raison: 'Personne dans le groupe ne peut tenter le Test d’Évaluation.' });
  });
});

/** « Acheter » d'une offre après saisie de `enc` Enc au champ, monté au client : état du geste et raison. */
function acheter(cargoId: string, label: string, enc: number) {
  const hote = document.createElement('div');
  const root = createRoot(hote);
  act(() => root.render(<LandMarketView />));
  const champ = [...hote.querySelectorAll('input')].find((i) => i.getAttribute('aria-label') === `Enc à acheter — ${label}`)!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(champ, String(enc)); champ.dispatchEvent(new Event('input', { bubbles: true })); });
  const bouton = champ.closest('.market-offer-buy')!.querySelector('button')!;
  const etat = { ferme: bouton.getAttribute('aria-disabled'), raison: hote.querySelector(`#market-buy-${cargoId}-reason`)?.textContent ?? null };
  act(() => root.unmount());
  return etat;
}

describe('LandMarketView — « Acheter » lit le refus du noyau (#3059, MSRC 13 l.131)', () => {
  beforeEach(() => {
    useGame.setState({
      party: makePregens().slice(0, 3),
      possessions: [{ uid: 'convoi', ownerId: makePregens()[0].id, nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] }],
      scene: { ...emptyScene('ville-a', 2, 2), label: 'Ville', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      battle: null, worldMap: landMap, travelPlan: null, landMarket: null, journal: [], net: { ...get().net, mode: 'local' },
    } as never);
    creditBourse(get, useGame.setState.bind(useGame), get().party[0].id, { gold: 5000, silver: 0, brass: 0 });
    seedBattleRng(3);
    get().openLandMarket();
  });

  it('lot sous le minimum, porteur libre et bourse pleine : le geste est fermé sur le lot minimal (MSRC 13 l.131)', () => {
    const offre = get().landMarket!.offers.find((o) => o.enc >= minCargoEnc)!;
    expect(acheter(offre.cargoId, offre.label, minCargoEnc - 1)).toEqual({ ferme: 'true', raison: t('lm.lotMinimal', { min: minCargoEnc }) });
  });

  it('le refus affiché est celui du devis du noyau', () => {
    const offre = get().landMarket!.offers.find((o) => o.enc >= minCargoEnc)!;
    const refus = devisDAchatDeCargaison(get(), offre.cargoId, minCargoEnc - 1).refus;
    expect(refus).toEqual({ motif: 'lot-minimal', min: minCargoEnc });
    expect(raisonDuRefusDAchatDeCargaison(refus!)).toBe(t('lm.lotMinimal', { min: minCargoEnc }));
  });

  it('siège invité : le geste est fermé par le refus de dépense du groupe, composé par le devis', () => {
    useGame.setState({ net: { ...get().net, mode: 'guest' } });
    const offre = get().landMarket!.offers.find((o) => o.enc >= minCargoEnc)!;
    expect(devisDAchatDeCargaison(get(), offre.cargoId, minCargoEnc).refus).toEqual({ motif: 'invite' });
    expect(acheter(offre.cargoId, offre.label, minCargoEnc)).toEqual({ ferme: 'true', raison: t('groupe.hoteSeul') });
  });
});

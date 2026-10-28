// @vitest-environment jsdom
/**
 * L'écran du port lit les verdicts du NOYAU (#3059) : la pose d'une Amélioration se ferme sur le refus de
 * `devisDAmelioration`, l'achat de cargaison sur celui de `devisDAchatEnPort` (cale au plafond dur, bourse sous
 * le prix plancher au meilleur Marchandage). MDG 12 l.195-364 ; MDG 12 l.70-75 ; MDG 15 l.319-349 ; MDG 15 l.335 ;
 * LDB 59 l.43.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PortView } from './PortView';
import { useGame } from '../state/store';
import { emptyScene } from '../noyau/monde/scene';
import { makePregens } from '../data/pregens';
import { findVehicleById, NAVAL_TRAITS } from '../data';
import { installCost } from '../engine/shipBuild';
import { overloadMaxEnc } from '../engine/seaVoyage';
import { t } from '../i18n';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import type { WorldMap } from '../noyau/worldMap';
import type { CampaignVessel } from '../noyau/etat';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const get = useGame.getState.bind(useGame);

const carte: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [{ id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a', port: { taille: 4, richesse: 4, production: ['commerce', 'poisson-sale'] } as WorldMap['places'][number]['port'] }],
  routes: [],
};
const COGUE = findVehicleById('cogue')!;

/** Port FIXÉ : une offre de 5 Enc de bois à 10 CO, groupe d'un seul héros sans le sou ni Négociateur (il mène
 *  donc le Marchandage), le navire `vessel`. */
function ouvrir(vessel: CampaignVessel): void {
  const port = structuredClone(carte.places[0].port!);
  useGame.setState({
    party: makePregens().slice(0, 1).map((h) => ({ ...h, talents: [], items: (h.items ?? []).filter((i) => i.trappingId !== 'bourse') })),
    possessions: [], vessel, worldMap: carte, journal: [], battle: null, travelPlan: null,
    port: { placeId: 'A', label: 'Salzenmund', port, offers: [{ cargoId: 'bois', label: 'Bois', enc: 5, basePrice: 10, surplus: false }] },
    scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    net: { ...get().net, mode: 'local' },
  } as never);
}

/** État et raison d'un geste de l'écran du port, par l'id de son `GatedAction`. */
function geste(initialTab: 'coque' | 'cargaison', id: string) {
  const hote = document.createElement('div');
  const root = createRoot(hote);
  act(() => root.render(<PortView initialTab={initialTab} />));
  const raison = hote.querySelector(`#${id}-reason`)?.textContent ?? null;
  const bouton = [...hote.querySelectorAll('button')].find((b) => b.getAttribute('aria-describedby') === `${id}-reason` || b.id === id);
  const etat = { ferme: bouton?.getAttribute('aria-disabled') ?? null, raison };
  act(() => root.unmount());
  return etat;
}

describe('#3059 — PortView lit les verdicts du noyau', () => {
  beforeEach(() => ouvrir({ vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } as CampaignVessel));

  it('Amélioration hors de portée de la bourse : fermée, raison = le refus de pose du noyau', () => {
    const trait = NAVAL_TRAITS.find((tr) => tr.kind === 'amelioration' && tr.install && (installCost(tr.install, COGUE.ship!.lengthM, 1).gold ?? 0) > 0)!;
    const gold = installCost(trait.install!, COGUE.ship!.lengthM, 1).gold!;
    expect(geste('coque', `port-upgrade-${trait.id}`)).toEqual({ ferme: 'true', raison: t('sv.upgradeTooExpensive', { label: trait.label, gold }) });
  });

  it('bourse vide : l’achat de 5 Enc à 10 CO est fermé sur le plancher de 40 CO (−20 points), le geste n’ouvre aucun Marchandage', () => {
    expect(hasBargainBonus(get().party[0]), 'fixture : le meneur n’est pas Négociateur').toBe(false);
    const texte = t('cargo.bourseSousPlancher', { plancher: 40 });
    expect(geste('cargaison', 'port-buy-bois')).toEqual({ ferme: 'true', raison: texte });
    const fenetres = () => Object.entries(get()).filter(([k, v]) => k.startsWith('pending') && v).map(([k]) => k);
    const avant = fenetres();
    get().portBuyCargo('bois', 5);
    expect(fenetres(), 'aucun Test de Marchandage ouvert').toEqual(avant);
    expect(get().vessel!.cargo ?? []).toEqual([]);
    expect(get().journal.some((l) => l.includes(texte))).toBe(true);
  });

  it('cale à 3 Enc du plafond dur : la borne du champ d’Enc et la ligne de cale viennent du noyau', () => {
    const plafond = overloadMaxEnc(COGUE.ship!.capacity);
    useGame.setState({ vessel: { ...get().vessel!, cargo: [{ cargoId: 'bois', enc: plafond - 3, basePriceGold: 1 }] } });
    const offre = get().port!.offers[0];
    const hote = document.createElement('div');
    const root = createRoot(hote);
    act(() => root.render(<PortView initialTab="cargaison" />));
    const champ = [...hote.querySelectorAll('input')].find((i) => i.getAttribute('aria-label') === `Enc à embarquer — ${offre.label}`)!;
    const texte = hote.textContent ?? '';
    act(() => root.unmount());
    expect(champ.getAttribute('max')).toBe('3');
    expect(texte).toContain('(jusqu’à 150 %)');
  });

  it('cale au plafond dur : l’achat est fermé, raison = le refus d’embarquer du noyau', () => {
    const plein: CampaignVessel['cargo'] = [{ cargoId: 'bois', enc: overloadMaxEnc(COGUE.ship!.capacity), basePriceGold: 1 }];
    useGame.setState({ vessel: { ...get().vessel!, cargo: plein } });
    const offre = get().port!.offers[0];
    expect(offre, 'escale sans offre').toBeTruthy();
    expect(geste('cargaison', `port-buy-${offre.cargoId}`)).toEqual({ ferme: 'true', raison: t('port.holdFull') });
  });
});

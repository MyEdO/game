// @vitest-environment jsdom
/**
 * L'écran du port lit les verdicts du NOYAU (#3059) : la pose d'une Amélioration se ferme sur le refus de
 * `devisDAmelioration`, l'achat de cargaison sur celui de `devisDAchatEnPort` (cale au plafond dur, bourse sous
 * le prix plancher au meilleur Marchandage). MDG 12 l.195-364 ; MDG 12 l.70-75 ; MDG 15 l.319-349 ; MDG 15 l.335 ;
 * LDB 59 l.43.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { acheterAuMarche } from '../noyau/cargaison.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PortView } from './PortView';
import { useGame } from '../state/store';
import { emptyScene } from '../noyau/monde/scene';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { findVehicleById, NAVAL_TRAITS } from '../data';
import { installCost } from '../engine/shipBuild';
import { overloadMaxEnc } from '../engine/seaVoyage';
import { t } from '../i18n';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import type { WorldMap } from '../noyau/worldMap';
import type { CampaignVessel } from '../noyau/etat';
import { creditBourse, partyMoneyTotal } from '../noyau/bourseFlow';
import { toBrass } from '../engine/money';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const get = useGame.getState.bind(useGame);

const carte: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [{ id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: { id: 'port-a' }, port: { taille: 4, richesse: 4, production: ['commerce-mer', 'poisson-sale'] } as WorldMap['places'][number]['port'] }],
  routes: [],
};
const COGUE = findVehicleById('cogue')!;

/** Port FIXÉ : une offre de 5 Enc de bois à 10 CO, groupe d'un seul héros sans le sou ni Négociateur (il mène
 *  donc le Marchandage), le navire `vessel`. */
function ouvrir(vessel: CampaignVessel): void {
  const port = structuredClone(carte.places[0].port!);
  useGame.setState({
    party: tousLesHerosDeScenario(idsDeTest).slice(0, 1).map((h) => ({ ...h, talents: [], items: (h.items ?? []).filter((i) => i.trappingId !== 'bourse') })),
    possessions: [], vessel, worldMap: carte, journal: [], battle: null, travelPlan: null,
    port: { placeId: 'A', label: 'Salzenmund', port, offers: [{ cargoId: 'bois-mer', label: 'Bois', enc: 5, basePrice: 10, surplus: false }] },
    scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    net: { ...get().net, mode: 'local' },
  } as never);
}

/** État et raison d'un geste de l'écran du port, par l'id de son `GatedAction`. */
function geste(initialTab: 'coque' | 'cargaison' | 'escale', id: string) {
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

  it('chaque Amélioration affiche la durée de sa pose, celle du devis du noyau (MDG 12 l.230 ; MDG 12 l.293)', () => {
    const hote = document.createElement('div');
    const root = createRoot(hote);
    act(() => root.render(<PortView initialTab="coque" />));
    const pose = (id: string) => [...hote.querySelectorAll('button')].find((b) => b.getAttribute('aria-describedby') === `port-upgrade-${id}-reason` || b.id === `port-upgrade-${id}`)
      ?.closest('.port-upgrade')?.querySelector('.port-hint')?.textContent;
    const lues = { blindage: pose('blindage-fer'), lissage: pose('lissage'), ancre: pose('ancre') };
    act(() => root.unmount());
    expect(lues).toEqual({ blindage: 'Pose : 16 jour(s)', lissage: 'Pose : 8 jour(s)', ancre: 'Pose : 1d10 jour(s)' });
  });

  it('bourse vide : l’achat de 5 Enc à 10 CO est fermé sur le plancher de 40 CO (−20 points), le geste n’ouvre aucun Marchandage', () => {
    expect(hasBargainBonus(get().party[0]), 'fixture : le meneur n’est pas Négociateur').toBe(false);
    const texte = t('cargo.bourseSousPlancher', { plancher: '40 CO' });
    expect(geste('cargaison', 'port-buy-bois-mer')).toEqual({ ferme: 'true', raison: texte });
    const fenetres = () => Object.entries(get()).filter(([k, v]) => k.startsWith('pending') && v).map(([k]) => k);
    const avant = fenetres();
    acheterAuMarche(get, 'port', 'vessel', 'bois-mer', 5);
    expect(fenetres(), 'aucun Test de Marchandage ouvert').toEqual(avant);
    expect(get().vessel!.cargo ?? []).toEqual([]);
    expect(get().journal.some((l) => l.includes(texte))).toBe(true);
  });

  it('cale à 3 Enc du plafond dur : la borne du champ d’Enc et la ligne de cale viennent du noyau', () => {
    const plafond = overloadMaxEnc(COGUE.ship!.capacity);
    useGame.setState({ vessel: { ...get().vessel!, cargo: [{ uid: 'lot-1', cargoId: 'bois-mer', enc: plafond - 3, basePriceGold: 1 }] } });
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
    const plein: CampaignVessel['cargo'] = [{ uid: 'lot-2', cargoId: 'bois-mer', enc: overloadMaxEnc(COGUE.ship!.capacity), basePriceGold: 1 }];
    useGame.setState({ vessel: { ...get().vessel!, cargo: plein } });
    const offre = get().port!.offers[0];
    expect(offre, 'escale sans offre').toBeTruthy();
    expect(geste('cargaison', `port-buy-${offre.cargoId}`)).toEqual({ ferme: 'true', raison: t('port.holdFull') });
  });
});

/** Saisit `n` dans le champ de nom accessible `nom`, sous `hote`. */
function saisir(hote: HTMLElement, nom: string, n: number): void {
  const champ = [...hote.querySelectorAll('input')].find((i) => i.getAttribute('aria-label') === nom)!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(champ, String(n));
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('#1652 lot 11b — l’onglet Escale avitaille la cale au devis du noyau (MDG 14 l.248-252 ; MDG 15 l.262)', () => {
  const navire = (patch: Partial<CampaignVessel>): CampaignVessel => ({ vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, provisions: 0, waterLitres: 0, ...patch });

  it('à quai : 3 rations-jour et 1 tonneau embarqués, la cale les reçoit et la bourse paie 3 × 2/– + 8/6', () => {
    ouvrir(navire({ escale: 'A' }));
    creditBourse(get, useGame.setState, get().party[0].id, { gold: 1, silver: 0, brass: 0 });
    const hote = document.createElement('div');
    const root = createRoot(hote);
    act(() => root.render(<PortView initialTab="escale" />));
    saisir(hote, 'Rations-jour à embarquer', 3);
    saisir(hote, 'Tonneaux d’eau douce à embarquer', 1);
    const bouton = hote.querySelector('button[aria-label="Avitailler la cale"]') as HTMLButtonElement;
    act(() => bouton.click());
    act(() => root.unmount());
    expect({ provisions: get().vessel!.provisions, eau: get().vessel!.waterLitres, bourse: toBrass(partyMoneyTotal(get)) })
      .toEqual({ provisions: 3, eau: 145, bourse: 240 - (3 * 24 + 102) });
  });

  it('hors quai : l’avitaillement est fermé, raison = le refus du noyau', () => {
    ouvrir(navire({}));
    expect(geste('escale', 'port-avitailler')).toEqual({ ferme: 'true', raison: t('port.pasAQuai') });
  });

  it('Bonne pêche à l’escale : la ration-jour s’affiche au prix de l’escale, 3 sc', () => {
    ouvrir(navire({ escale: 'A', rationsDEscale: 3 }));
    const hote = document.createElement('div');
    const root = createRoot(hote);
    act(() => root.render(<PortView initialTab="escale" />));
    const prix = hote.querySelector('.port-upgrade .port-hint .coins')?.textContent;
    act(() => root.unmount());
    expect(prix).toBe('3 sc');
  });
});

// @vitest-environment jsdom
/**
 * CADENCE de la descente FLUVIALE choisie au départ (#2545) : le sélecteur de cadence de la carte du
 * monde est le MÊME qu'en mer (couche `voyageCadence`), posé partout où un bateau porte l'équipage.
 * Le fleuve n'offre que Commandée et Jour par jour — la traversée rapide est MDG 15 l.21-37.
 * L'`aria-pressed` du sélecteur dit la cadence TRANSMISE, même après une traversée rapide choisie en mer.
 * Mesuré depuis le CLIC jusqu'aux ordres du `TravelPlan` construit par `startTravel`.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorldMapView } from './WorldMapView';
import { useGame } from '../state/store';
import { seedBattleRng } from '../state/battleRng';
import { creditBourse } from '../state/bourseFlow';
import { buildScene } from '../state/mapSpec';
import { createHero, skillCharacteristicById } from '../engine/character';
import { t } from '../i18n';
import { travelModeLabels } from '../engine/travel';
import type { Combatant, SkillInstance } from '../engine/types';
import type { WorldMap } from '../state/worldMap';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

function batelier(): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'batelier', label: 'Gunnar', motivation: 'x', seed: 11, id: 'c-gunnar' });
  for (const id of ['ramer', 'voile']) {
    const ex = h.skills.find((s) => s.id === id && !s.spec);
    if (ex) ex.advances = Math.max(ex.advances, 50);
    else h.skills.push({ id, characteristic: skillCharacteristicById(id), advances: 50 } as SkillInstance);
  }
  return h;
}

const carte: WorldMap = {
  id: 'm', label: 'Le Reik',
  places: [
    { id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'quai-a' },
    { id: 'B', label: 'Altdorf', pos: { x: 90, y: 0 }, scene: 'quai-b' },
    { id: 'C', label: 'Marienburg', pos: { x: 0, y: 90 }, scene: 'quai-c' },
  ],
  routes: [
    { id: 'r-reik', a: 'A', b: 'B', km: 45, modes: ['barge', 'pied'], river: true, inns: true, perilDie: 0 },
    { id: 'r-mer', a: 'A', b: 'C', km: 200, modes: ['mer'], sea: true, seaHeading: 'est' },
  ],
};
const quai = (id: string, label: string) => buildScene({ id, label, desc: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] });

let host: HTMLDivElement;
let root: Root;

/** Le groupe à quai à Grünburg, bourse garnie, aucun voyage en cours. */
function aQuai(): void {
  seedBattleRng(7);
  get().setParty([batelier()]);
  get().loadProject([quai('quai-a', 'Grünburg'), quai('quai-b', 'Altdorf'), quai('quai-c', 'Marienburg')], 'quai-a', carte);
  set({ travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [], vessel: null });
  creditBourse(get, set, get().party[0].id, { gold: 500, silver: 0, brass: 0 });
}

beforeEach(() => {
  aQuai();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<WorldMapView hereSceneId="quai-a" initialRouteId="r-reik" />));
  // Le geste du joueur : choisir l'embarcation dans le sélecteur de MODE du panneau de départ.
  const barge = [...host.querySelectorAll<HTMLButtonElement>('.worldmap-panel button')]
    .find((b) => b.textContent?.trim() === travelModeLabels().barge);
  expect(barge, 'le mode « barge » est offert').toBeTruthy();
  act(() => { barge!.click(); });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  set({ travelPlan: null, pendingCascade: null, pendingRest: null });
});

const boutons = () => [...host.querySelectorAll<HTMLButtonElement>('.wm-modes button')];
const bouton = (texte: string) => boutons().find((b) => b.textContent?.trim() === texte);
const cliquer = (b: Element | null | undefined) => {
  expect(b, 'le bouton est rendu').toBeTruthy();
  act(() => { b!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};
/** Le départ, quel que soit son libellé (« Appareiller quand même » quand l'avitaillement manque). */
const partir = () => cliquer([...host.querySelectorAll<HTMLButtonElement>('button[aria-label]')]
  .find((b) => [String(t('wm.partir')), String(t('wm.appareillerQuandMeme'))].includes(b.getAttribute('aria-label') ?? '')));
const commandee = String(t('wm.descenteCommandee'));
const jourParJour = String(t('wm.jourParJour'));
const cogue = () => set({ vessel: { vehicleId: 'cogue', label: 'Le Cormoran', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } } as never);
/** Le geste du joueur : cliquer la destination sur la carte (marqueur `role="button"` de `MapCanvas`). */
const choisirDestination = (lieu: string) => cliquer(host.querySelector<SVGElement>(`[role="button"][aria-label="${lieu}"]`));

describe('#2545 — départ fluvial : la cadence se choisit au clic et part avec la descente', () => {
  it('le sélecteur s’affiche au fleuve avec Commandée et Jour par jour — jamais la traversée rapide', () => {
    expect(bouton(commandee)).toBeTruthy();
    expect(bouton(jourParJour)).toBeTruthy();
    expect(boutons().some((b) => /rapide/i.test(b.textContent ?? '')), 'traversée rapide = mer seulement').toBe(false);
    expect(bouton(commandee)!.title).toBe(String(t('wm.cadenceCommandeFleuve')));
    expect(bouton(jourParJour)!.title).toBe(String(t('wm.cadenceJourParJourFleuve')));
  });

  it('clic « Jour par jour » puis « Partir » → les ordres de la descente portent la cadence choisie', () => {
    cliquer(bouton(jourParJour));
    expect(bouton(jourParJour)!.getAttribute('aria-pressed')).toBe('true');
    partir();
    expect(get().travelPlan?.river, 'la descente est JOUÉE').toBeTruthy();
    expect(get().travelPlan?.orders?.cadence).toBe('jour-par-jour');
  });

  it('clic « Descente commandée » puis « Partir » → descente commandée', () => {
    cliquer(bouton(jourParJour));
    cliquer(bouton(commandee));
    partir();
    expect(get().travelPlan?.orders?.cadence).toBe('commande');
  });
});

describe('#2545 — sans geste : l’écran et l’API rendent la même cadence (`DEFAULT_VOYAGE_ORDERS`)', () => {
  it('fleuve : « Partir » sans toucher au sélecteur et `startTravel` sans cadence → les mêmes ordres', () => {
    partir();
    expect(get().travelPlan?.river, 'la descente est JOUÉE').toBeTruthy();
    const parLEcran = get().travelPlan?.orders?.cadence;
    act(() => { aQuai(); });
    get().startTravel('r-reik', 'barge');
    expect(get().travelPlan?.river, 'la descente est JOUÉE').toBeTruthy();
    expect(get().travelPlan?.orders?.cadence).toBe(parLEcran);
  });

  it('mer : appareiller sans toucher au sélecteur et `startTravel` sans cadence → les mêmes ordres', () => {
    act(() => { cogue(); });
    choisirDestination('Marienburg');
    expect(bouton(String(t('wm.traverseeCommandee'))), 'le sélecteur de cadence est offert en mer').toBeTruthy();
    partir();
    expect(get().travelPlan?.sea, 'la traversée est JOUÉE').toBeTruthy();
    const parLEcran = get().travelPlan?.orders?.cadence;
    expect(parLEcran, 'l’écran transmet une cadence').toBeTruthy();
    act(() => { aQuai(); cogue(); });
    get().startTravel('r-mer', 'mer');
    expect(get().travelPlan?.sea, 'la traversée est JOUÉE').toBeTruthy();
    expect(get().travelPlan?.orders?.cadence).toBe(parLEcran);
  });
});

describe('#2545 — mer puis fleuve : le bouton pressé est la cadence transmise', () => {
  it('« Traversée rapide » choisie en mer, puis la descente : un bouton est pressé, et c’est la cadence qui part', () => {
    act(() => { cogue(); });
    choisirDestination('Marienburg');
    cliquer(bouton(String(t('wm.traverseeRapideAction'))));
    expect(bouton(String(t('wm.traverseeRapideAction')))!.getAttribute('aria-pressed')).toBe('true');
    choisirDestination('Altdorf');
    const presse = boutons().filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(presse.map((b) => b.textContent?.trim()), 'une cadence fluviale est pressée').toEqual([commandee]);
    partir();
    expect(get().travelPlan?.river, 'la descente est JOUÉE').toBeTruthy();
    expect(get().travelPlan?.orders?.cadence).toBe('commande');
  });
});

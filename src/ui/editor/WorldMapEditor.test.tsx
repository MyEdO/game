// @vitest-environment jsdom
/**
 * Contrat de NON-RÉGRESSION #419 (WorldMapEditor onglets + panneaux découpés + picker de ref unique) :
 * chaque champ éditable AVANT la restructuration l'est encore APRÈS — un onglet par tab de `Tabs`,
 * un champ par picker/checkbox/input. Wrapper contrôlé (comme `NarratifEditor.test.tsx`).
 *
 * Couverture (confrontée aux types `MapPlace`/`MapRoute`/`WorldMapParams`, `src/state/worldMap.ts`) :
 * lieu (nom, icône, fond, scène, entrée, services), lieu/commerce (marché : taille/richesse/produits ;
 * port : catalogue/taille/richesse/cosmopolite/phare), lieu/plan (POI : ajout, libellé, icône,
 * position, cible scène OU service), route/trajet (distance, sens, modes, prix, vitesse, seuil de
 * péripétie, auberges, maritime + cap), route/péripéties (embuscade : scène/rencontre/entrée/ancrage
 * en mer, péripéties d'auteur : libellé/probabilité/effet), paramètres de carte (nom, heures/jour,
 * marche forcée, seuil de péripétie).
 *
 * Non couvert, PAS une régression du refactor (préexistant, à signaler hors de ce périmètre) :
 * `MapRoute.river`/`riverPerils`/`riverExposure` (lacune d'éditeur préexistante — aucun contrôle
 * dans `WorldMapRoutePanel`) ; `PlaceService.label`/`.rest` (le panneau Lieu ne pose qu'une case à
 * cocher par service du catalogue, sans surcharge de libellé ni offre de couchage propre).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorldMapEditor } from './WorldMapEditor';
import { choisirDansMenu, menuDe } from './AddMenu.testkit';
import { emptyWorldMap, type WorldMap, type MapPlace, type MapRoute } from '../../state/worldMap';
import { emptyScene, type Scene } from '../../state/scene';
import { lieuxServices, navalPorts } from '../../data';
import { TRAVEL_DEFAULTS } from '../../engine/travel';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;
let lastMap: WorldMap | null;

function scenes(): Scene[] {
  const s1 = { ...emptyScene(), id: 's1', label: 'Scène Un', encounters: [{ id: 'enc1' }] };
  const s2 = { ...emptyScene(), id: 's2', label: 'Scène Deux' };
  return [s1, s2];
}

function baseMap(): WorldMap {
  const m = emptyWorldMap();
  const place: MapPlace = { id: 'p1', label: 'Altdorf', pos: { x: 10, y: 10 }, scene: 's1' };
  const place2: MapPlace = { id: 'p2', label: 'Marienburg', pos: { x: 40, y: 20 }, scene: 's2' };
  const route: MapRoute = { id: 'r1', a: 'p1', b: 'p2', km: 20, modes: ['pied'] };
  return { ...m, places: [place, place2], routes: [route] };
}

function Harness() {
  const [m, setM] = useState<WorldMap | null>(baseMap());
  const [axes, setAxes] = useState<string[] | undefined>(undefined);
  lastMap = m;
  return <WorldMapEditor map={m} setMap={setM} scenes={scenes()} onClose={() => {}} activeAxes={axes} setActiveAxes={setAxes} />;
}

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<Harness />); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function click(el: Element) {
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}
function tab(text: string): HTMLButtonElement {
  const b = [...container.querySelectorAll('[role="tab"]')].find((e) => (e.textContent ?? '').includes(text));
  if (!b) throw new Error(`onglet « ${text} » introuvable`);
  return b as HTMLButtonElement;
}
function selectPlace(id: string) {
  const g = [...container.querySelectorAll('svg > g[transform]')].find((e) =>
    e.querySelector('text')?.textContent === (id === 'p1' ? 'Altdorf' : 'Marienburg'));
  if (!g) throw new Error(`lieu « ${id} » introuvable`);
  // La sélection d'un lieu se fait au pointerdown (glisser), pas au click (WorldMapEditor.tsx).
  act(() => { g.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
}
function routeG() {
  const g = container.querySelector('svg g[style*="cursor: pointer"]');
  if (!g) throw new Error('route introuvable');
  return g as SVGGElement;
}
function fieldWrap(labelText: string): HTMLElement {
  const wrap = [...container.querySelectorAll('.ed-field, label')].find((e) => (e.textContent ?? '').includes(labelText));
  if (!wrap) throw new Error(`champ « ${labelText} » introuvable`);
  return wrap as HTMLElement;
}
function input(labelText: string): HTMLInputElement | HTMLSelectElement {
  const el = fieldWrap(labelText).querySelector('input, select');
  if (!el) throw new Error(`input « ${labelText} » introuvable`);
  return el as HTMLInputElement | HTMLSelectElement;
}
function checkbox(labelText: string): HTMLInputElement {
  const wrap = [...container.querySelectorAll('.ed-check')].find((e) => (e.textContent ?? '').includes(labelText));
  if (!wrap) throw new Error(`checkbox « ${labelText} » introuvable`);
  return wrap.querySelector('input[type="checkbox"]') as HTMLInputElement;
}
function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
/** Picker de ref (`RefSelect`/`IconField`/`BackdropField`, composition `MediaSelect`) — les options
 *  sont rendues EAGER dans le DOM (repliées par CSS), on clique directement l'option scopée au champ.
 *  Scopé aux wrappers PORTANT un `.ms-list` (un `<select>` d'à côté peut contenir la même sous-chaîne
 *  dans une `<option>`, ex. « Scène du projet » dans le sélecteur de cible du POI). */
function pickRef(labelText: string, optionText: string) {
  const wrap = [...container.querySelectorAll('.ed-field, label')]
    .filter((e) => e.querySelector('.ms-list'))
    .find((e) => (e.textContent ?? '').trimStart().startsWith(labelText));
  if (!wrap) throw new Error(`picker « ${labelText} » introuvable`);
  const opt = [...wrap.querySelectorAll('.ms-opt')].find((e) => (e.textContent ?? '').includes(optionText));
  if (!opt) throw new Error(`option « ${optionText} » introuvable pour « ${labelText} »`);
  click(opt);
}

describe('WorldMapEditor — panneau Lieu (#419)', () => {
  it('sélectionne un lieu et édite le nom, l’icône, le fond, la scène liée, l’entrée', () => {
    mount();
    selectPlace('p1');
    setValue(input('Nom'), 'Nouvel Altdorf');
    expect(lastMap!.places[0].label).toBe('Nouvel Altdorf');

    // « Porte » (map-tool/door) — une valeur qui CHANGE l'état (le lieu part sans `icon`, l.31) :
    // un `IconField` débranché laisserait `icon` à `undefined` et cette assertion échouerait.
    pickRef('Icône', 'Porte');
    expect(lastMap!.places[0].icon).toBe('map-tool/door');

    pickRef("Fond d'ambiance", 'Taverne commune');
    expect(lastMap!.places[0].backdrop).toBe('taverne-commune');

    pickRef('Scène liée', 'Scène Deux');
    expect(lastMap!.places[0].scene).toBe('s2');

    setValue(input("Point d'entrée"), 'porte-nord');
    expect(lastMap!.places[0].entry).toBe('porte-nord');
  });

  it('coche un service du lieu (catalogue lieux-services.json)', () => {
    mount();
    selectPlace('p1');
    const sv = lieuxServices[0];
    click(checkbox(sv.label));
    expect(lastMap!.places[0].services).toEqual([{ kind: sv.id }]);
  });
});

describe('WorldMapEditor — panneau Lieu / Commerce (#419)', () => {
  it('active le marché et édite taille/richesse/produits', () => {
    mount();
    selectPlace('p1');
    click(tab('Commerce'));
    click(checkbox('Lieu de commerce'));
    expect(lastMap!.places[0].market).toBeTruthy();
    setValue(input('Taille de la communauté'), '3');
    expect(lastMap!.places[0].market!.taille).toBe(3);

    const richesseSel = input('Indice de richesse — Mise à prix') as HTMLSelectElement;
    const otherRichesse = [...richesseSel.options].map((o) => o.value).find((v) => v !== richesseSel.value)!;
    setValue(richesseSel, otherRichesse);
    expect(lastMap!.places[0].market!.richesse).toBe(Number(otherRichesse));

    // Libellé ET qualificatif viennent du catalogue (`land-cargo.json` : `label` + `hint`) — plus
    // aucun texte par id ni suffixe codé dans le panneau.
    click(checkbox('Commerce (plaque tournante)'));
    expect(lastMap!.places[0].market!.produits).toContain('commerce');
  });

  it('active le port, le résout du catalogue via le picker de ref UNIQUE, édite Taille/cosmopolite/phare', () => {
    mount();
    selectPlace('p1');
    click(tab('Commerce'));
    click(checkbox('Port maritime'));
    expect(lastMap!.places[0].port).toBeTruthy();

    const port0 = navalPorts[0];
    pickRef('Port du catalogue', `${port0.label} (${port0.region})`);
    expect(lastMap!.places[0].port!.ref).toBe(port0.id);
    expect(lastMap!.places[0].port!.taille).toBe(port0.taille);

    click(checkbox('Grand port cosmopolite'));
    expect(lastMap!.places[0].port!.cosmopolite).toBe(true);

    click(checkbox('Phare à'));
    expect(lastMap!.places[0].port!.lighthouse).toBe(true);
  });
});

describe('WorldMapEditor — panneau Lieu / Plan du hub (#419)', () => {
  it('ajoute un POI, édite son libellé/icône/position, et lie sa cible via le picker de ref UNIQUE (scène puis service)', () => {
    mount();
    selectPlace('p1');
    click(tab('Plan du hub'));
    click([...container.querySelectorAll('button')].find((b) => b.textContent?.includes("Point d'intérêt"))!);
    expect(lastMap!.places[0].poi).toHaveLength(1);

    setValue(input('Libellé'), 'Comptoir du port');
    expect(lastMap!.places[0].poi![0].label).toBe('Comptoir du port');

    pickRef('Icône', 'Porte');
    expect(lastMap!.places[0].poi![0].icon).toBe('map-tool/door');

    // Placement par clic sur le plan (`MapCanvas` background click, #345) : le POI créé part au
    // centre {50,50} (WorldMapPlacePanel.tsx) — un `getBoundingClientRect` réel étant absent en
    // jsdom, on le pose explicitement pour rendre le clic géométriquement vérifiable.
    const plan = container.querySelector('svg[aria-label="Aperçu de placement des POI"]') as SVGSVGElement;
    Object.defineProperty(plan, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 200, height: 128, left: 0, top: 0, right: 200, bottom: 128, x: 0, y: 0, toJSON() {} }),
    });
    act(() => { plan.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 150, clientY: 60 })); });
    expect(lastMap!.places[0].poi![0].pos).toEqual({ x: 75, y: 47 });

    setValue(input('Cible (scène OU service, exclusif)'), 'scene');
    pickRef('Scène', 'Scène Deux');
    expect(lastMap!.places[0].poi![0].sceneId).toBe('s2');

    setValue(input('Cible (scène OU service, exclusif)'), 'service');
    const sv = lieuxServices[0];
    pickRef('Service', sv.label);
    expect(lastMap!.places[0].poi![0].serviceKind).toBe(sv.id);
  });
});

describe('WorldMapEditor — panneau Route / Trajet (#419)', () => {
  it('édite distance, sens, modes de voyage, prix/vitesse par mode, seuil de péripétie et auberges', () => {
    mount();
    click(routeG());
    setValue(input('Distance (km)'), '42');
    expect(lastMap!.routes[0].km).toBe(42);

    setValue(input('Sens'), 'p1');
    expect(lastMap!.routes[0].from).toBe('p1');

    click(checkbox('Diligence'));
    expect(lastMap!.routes[0].modes).toContain('diligence');

    setValue(input('Diligence — prix'), '12');
    expect(lastMap!.routes[0].prices?.diligence).toBe(12);

    setValue(input('Diligence — Déplacement'), '9');
    expect(lastMap!.routes[0].speed?.diligence).toBe(9);

    setValue(input('Péripétie : seuil du d10'), '5');
    expect(lastMap!.routes[0].perilDie).toBe(5);

    click(checkbox('Relais d'));
    expect(lastMap!.routes[0].inns).toBe(true);
  });

  it('active la route maritime et le cap', () => {
    mount();
    click(routeG());
    click(checkbox('Route maritime'));
    expect(lastMap!.routes[0].sea).toBe(true);
    setValue(input('Cap dominant'), 'nord');
    expect(lastMap!.routes[0].seaHeading).toBe('nord');
  });
});

describe('WorldMapEditor — panneau Route / Péripéties (#419)', () => {
  it('lie une embuscade via le picker de ref UNIQUE (scène puis rencontre), son entrée et son ancrage en mer', () => {
    mount();
    click(routeG());
    click(checkbox('Route maritime'));
    expect(lastMap!.routes[0].sea).toBe(true);

    click(tab('Péripéties'));
    pickRef("Scène d'embuscade", 'Scène Un');
    expect(lastMap!.routes[0].ambush?.scene).toBe('s1');

    pickRef('Rencontre déclenchée', 'enc1');
    expect(lastMap!.routes[0].ambush?.encounter).toBe('enc1');

    setValue(input("Point d'entrée"), 'porte-embuscade');
    expect(lastMap!.routes[0].ambush?.entry).toBe('porte-embuscade');

    setValue(input('Ancrage en mer'), '30');
    expect(lastMap!.routes[0].ambush?.at).toBeCloseTo(0.3);
  });

  it('ajoute et édite une péripétie d’auteur (libellé, probabilité, effet)', async () => {
    mount();
    click(routeG());
    click(tab('Péripéties'));
    click([...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Péripétie d’auteur') || b.textContent?.includes("Péripétie d'auteur"))!);
    expect(lastMap!.routes[0].perils).toHaveLength(1);

    setValue(input('Libellé'), 'Bandits de grand chemin');
    expect(lastMap!.routes[0].perils![0].label).toBe('Bandits de grand chemin');

    setValue(input('Probabilité par jour'), '25');
    expect(lastMap!.routes[0].perils![0].chancePct).toBe(25);

    await choisirDansMenu(menuDe(container, '+ Effet'), 'Journal');
    expect(lastMap!.routes[0].perils![0].effects).toHaveLength(1);
  });
});

describe('WorldMapEditor — paramètres de carte (aucune sélection, #419)', () => {
  it('édite le nom de la carte et les paramètres de voyage (heures/jour, marche forcée, seuil de péripétie)', () => {
    mount();
    setValue(input('Nom'), 'Ma Campagne');
    expect(lastMap!.label).toBe('Ma Campagne');

    setValue(input('Heures de voyage/jour sans Test'), '8');
    expect(lastMap!.params?.hoursPerDay).toBe(8);

    setValue(input('Plafond de marche forcée'), '11');
    expect(lastMap!.params?.forcedMaxHours).toBe(11);

    setValue(input('Péripétie : seuil du d10 quotidien'), '6');
    expect(lastMap!.params?.perilDie).toBe(6);
  });

  it('paramètres de voyage : la saisie est calée, le champ VIDE retombe sur le défaut RAW (#1318 E1)', () => {
    mount();
    setValue(input('Heures de voyage/jour sans Test'), '48');
    expect(lastMap!.params?.hoursPerDay).toBe(24);
    setValue(input('Heures de voyage/jour sans Test'), '');
    expect(lastMap!.params?.hoursPerDay).toBe(TRAVEL_DEFAULTS.hoursPerDay);

    setValue(input('Plafond de marche forcée'), '99');
    expect(lastMap!.params?.forcedMaxHours).toBe(24);
    setValue(input('Plafond de marche forcée'), '');
    expect(lastMap!.params?.forcedMaxHours).toBe(TRAVEL_DEFAULTS.forcedMaxHours);

    setValue(input('Péripétie : seuil du d10 quotidien'), '42');
    expect(lastMap!.params?.perilDie).toBe(10);
  });
});

describe('WorldMapEditor — titre de carte ne décide JAMAIS par comparaison de texte (#142)', () => {
  it('carte déjà chargée (nom encore au défaut) : titre LONG dès le montage — c’est un document existant', () => {
    mount();
    expect(container.querySelector('h2')!.textContent!.trim()).toBe('Carte du monde — Carte du monde');
  });

  it('carte fraîchement créée : titre COURT tant que non nommée, puis LONG dès la première saisie — même si le texte tapé est « Carte du monde »', () => {
    function FreshHarness() {
      const [m, setM] = useState<WorldMap | null>(null);
      lastMap = m;
      return <WorldMapEditor map={m} setMap={setM} scenes={scenes()} onClose={() => {}} />;
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<FreshHarness />); });
    expect(container.querySelector('h2')!.textContent!.trim()).toBe('Carte du monde');
    setValue(input('Nom'), 'x'); // valeur intermédiaire (React ne redéclenche pas un onChange à valeur DOM inchangée)
    setValue(input('Nom'), 'Carte du monde');
    expect(container.querySelector('h2')!.textContent!.trim()).toBe('Carte du monde — Carte du monde');
  });
});

// @vitest-environment jsdom
/**
 * RENDU du gating narratif de la carte du monde (#684 L2) — contrats POSITIFS.
 *
 * Deux axes, deux rendus opposés (design jugé, 2026-08-31) :
 *  - LIEU non révélé (`MapPlace.when`) = ABSENT (anti-spoiler) — ni du DOM, ni du CADRAGE : le
 *    `viewBox`/`transform` de cadrage ne doit pas trahir un lieu que la carte ne montre pas ;
 *  - ROUTE fermée (`MapRoute.when`) = VISIBLE mais REFUSÉE — le joueur voit qu'il ne peut plus y
 *    aller, et la raison (`MapRoute.refus`) est ATTEIGNABLE (`GatedAction` : `aria-disabled`,
 *    jamais `disabled`, raison liée par `aria-describedby`).
 *
 * Non-régression : une carte SANS gating (paquet RÉEL committé) rend exactement comme avant.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorldMapView } from './WorldMapView';
import { useGame } from '../state/store';
import { parseProject, type WorldMap } from '../state/worldMap';
import { VB_W, VB_H } from './worldMapViewport';
import { buildApi } from '../state/devtools';
import { emptyScene, type Scene } from '../state/scene';
import loupEtSaumureProjet from '../scenes/loup-et-saumure/loup-et-saumure-projet.json';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Le lieu caché est posé LOIN des autres : s'il entrait dans le cadrage, le viewport en porterait la trace. */
const carte: WorldMap = {
  id: 'ch1',
  label: 'Chapitre 1',
  places: [
    { id: 'auberge', label: 'La Diligence', pos: { x: 10, y: 30 }, scene: 's-auberge' },
    { id: 'altdorf', label: 'Altdorf', pos: { x: 20, y: 30 }, scene: 's-altdorf' },
    {
      id: 'bogenhafen',
      label: 'Bögenhafen',
      pos: { x: 96, y: 62 },
      scene: 's-bogenhafen',
      when: { kind: 'flag', expr: 'edo-ch1-bogenhafen-revelee' },
    },
  ],
  routes: [
    { id: 'auberge-altdorf', a: 'auberge', b: 'altdorf', km: 30, modes: ['pied'] },
    { id: 'auberge-bogenhafen', a: 'auberge', b: 'bogenhafen', km: 90, modes: ['pied'] },
    {
      id: 'auberge-ferme',
      a: 'auberge',
      b: 'altdorf',
      from: 'auberge',
      km: 42,
      modes: ['pied'],
      when: { kind: 'not', of: { kind: 'flag', expr: 'edo-ch1-clos' } },
      refus: 'Les gardes ont barré le pont de Bögen.',
    },
  ],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  useGame.setState({ worldMap: null, flags: {} });
});

const scenePlate = (id: string): Scene => {
  const s = emptyScene(6, 6);
  s.id = id;
  s.label = id;
  return s;
};

async function monter(props: { hereSceneId?: string; initialRouteId?: string } = {}) {
  await act(async () => {
    root.render(<WorldMapView {...props} />);
  });
}

/** Transform de cadrage du groupe zoomable de `MapCanvas` — la trace mesurable du fit initial. */
function cadrage(): string {
  const g = container.querySelector('svg g[transform^="translate("]');
  return g?.getAttribute('transform') ?? '';
}

describe('axe NŒUD — le lieu non révélé est ABSENT du rendu ET du cadrage', () => {
  it('flag absent : ni médaillon, ni cartouche, ni route vers Bögenhafen', async () => {
    useGame.setState({ worldMap: carte, flags: {} });
    await monter({ hereSceneId: 's-auberge' });
    expect(container.textContent).toContain('La Diligence');
    expect(container.textContent).toContain('Altdorf');
    expect(container.textContent).not.toContain('Bögenhafen');
    // Le tronçon qui y mène disparaît avec lui (sinon un trait vers le vide le trahit) : deux routes
    // dessinées depuis l'auberge (vers Altdorf, ouverte et fermée), jamais celle de Bögenhafen.
    expect(container.querySelectorAll('path[pointer-events="stroke"]')).toHaveLength(2);
    // ATTRIBUTAIRE : aucun NOM ACCESSIBLE ne trahit le lieu caché. Un médaillon cliquable porte
    // `aria-label={label}` (`MapCanvas.tsx`) — un lecteur d'écran, un test e2e ou une manette le
    // liraient même si le texte visible, lui, restait muet.
    const noms = Array.from(container.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label') ?? '');
    expect(noms.filter((n) => n.includes('Bögenhafen'))).toEqual([]);
  });

  it('flag posé : le lieu apparaît — le rendu n’a pas changé de nature, seule la donnée a bougé', async () => {
    useGame.setState({ worldMap: carte, flags: { 'edo-ch1-bogenhafen-revelee': true } });
    await monter({ hereSceneId: 's-auberge' });
    expect(container.textContent).toContain('Bögenhafen');
    expect(container.querySelectorAll('path[pointer-events="stroke"]')).toHaveLength(3);
  });

  it('CADRAGE : le lieu caché ne tire pas le viewport — révélé, il le tire (mesure du fit)', async () => {
    useGame.setState({ worldMap: carte, flags: {} });
    await monter({ hereSceneId: 's-auberge' });
    const sansLuiI = cadrage();
    expect(sansLuiI, 'le groupe de cadrage existe').not.toBe('');

    await act(async () => root.unmount());
    root = createRoot(container);
    useGame.setState({ worldMap: carte, flags: { 'edo-ch1-bogenhafen-revelee': true } });
    await monter({ hereSceneId: 's-auberge' });
    const avecLui = cadrage();

    // Un lieu à (96, 62) est hors du cadrage serré des deux lieux de gauche : s'il y entrait, le
    // fit (zoom/pan) changerait. Il ne doit changer QU'UNE FOIS le lieu révélé.
    expect(avecLui).not.toBe(sansLuiI);
  });
});

describe('axe ARÊTE — le trajet fermé reste VISIBLE, son départ est REFUSÉ avec sa raison', () => {
  it('chapitre clos : la route est rendue et sélectionnable, le départ porte `refus` (aria-disabled)', async () => {
    useGame.setState({ worldMap: carte, flags: { 'edo-ch1-clos': true } });
    await monter({ hereSceneId: 's-auberge', initialRouteId: 'auberge-ferme' });

    const bouton = container.querySelector('#wm-route-fermee-auberge-ferme-reason')
      ? container.querySelector('button[aria-describedby="wm-route-fermee-auberge-ferme-reason"]')
      : null;
    expect(bouton, 'le bouton de départ existe et se lie à sa raison').toBeTruthy();
    // Atteignable au clavier/manette/tap : `aria-disabled`, JAMAIS l'attribut HTML `disabled`.
    expect(bouton!.getAttribute('aria-disabled')).toBe('true');
    expect((bouton as HTMLButtonElement).disabled).toBe(false);

    const raison = container.querySelector('#wm-route-fermee-auberge-ferme-reason');
    expect(raison!.textContent).toBe('Les gardes ont barré le pont de Bögen.');
    // Le trajet reste lisible : on voit OÙ l'on ne peut plus aller.
    expect(container.textContent).toContain('Altdorf');
  });

  it('chapitre ouvert : la même route est un départ NORMAL (aucune affordance refusée)', async () => {
    useGame.setState({ worldMap: carte, flags: {} });
    await monter({ hereSceneId: 's-auberge', initialRouteId: 'auberge-ferme' });
    expect(container.querySelector('#wm-route-fermee-auberge-ferme-reason')).toBeNull();
    expect(container.textContent).toContain('Partir');
    expect(container.textContent).toContain('Marche forcée');
  });
});

describe('recette — `__wfrp.routes()` décrit EXACTEMENT les tracés cliquables du DOM, dans le MÊME ordre', () => {
  it('un lieu caché ne décale plus l’index : `routes()[i]` est bien la route du iᵉ tracé', async () => {
    useGame.setState({ worldMap: carte, flags: { 'edo-ch1-clos': true }, scene: scenePlate('s-auberge') });
    await monter({ hereSceneId: 's-auberge' });

    const annonce = buildApi().routes() as { id: string; etat: string }[];
    expect(annonce.map((r) => r.id)).toEqual(['auberge-altdorf', 'auberge-ferme']);
    expect(annonce.map((r) => r.etat)).toEqual(['ouverte', 'fermee-consultable']);

    const traces = Array.from(container.querySelectorAll<SVGPathElement>('path[pointer-events="stroke"]'));
    expect(traces).toHaveLength(annonce.length);

    // `clickRoute(id)` clique le iᵉ tracé : le prouver, c'est cliquer ce tracé-là et lire QUELLE route
    // s'ouvre. L'index 1 doit être celui que l'annonce nomme — la route FERMÉE, qui dit sa raison.
    await act(async () => {
      traces[1].parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector(`#wm-route-fermee-${annonce[1].id}-reason`)).toBeTruthy();
  });
});

/** Carte du CH.1 réel en réduction : un SEUL voisin, non révélé, posé LOIN du lieu courant. */
const carteMuette: WorldMap = {
  id: 'ch1',
  label: 'Chapitre 1',
  places: [
    { id: 'auberge', label: 'La Diligence', pos: { x: 10, y: 30 }, scene: 's-auberge' },
    {
      id: 'altdorf',
      label: 'Altdorf',
      pos: { x: 90, y: 60 },
      scene: 's-altdorf',
      when: { kind: 'flag', expr: 'edo-ch1-altdorf-revelee' },
    },
  ],
  routes: [{ id: 'route-la-diligence-altdorf', a: 'auberge', b: 'altdorf', km: 180, modes: ['pied'] }],
};

/** Vue courante (zoom/pan) lue sur le groupe de cadrage. */
function vue(): { panX: number; panY: number; z: number } {
  const m = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/.exec(cadrage());
  if (!m) throw new Error(`cadrage illisible : ${JSON.stringify(cadrage())}`);
  return { panX: Number(m[1]), panY: Number(m[2]), z: Number(m[3]) };
}

/** Position ÉCRAN (unités du viewBox rendu) d'un médaillon : le cadre visible est [0,VB_W]×[0,VB_H]. */
function marqueurEcran(label: string): { x: number; y: number } {
  const g = container.querySelector(`g[aria-label="${label}"]`);
  if (!g) throw new Error(`médaillon « ${label} » absent du DOM`);
  const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute('transform') ?? '');
  if (!m) throw new Error(`médaillon « ${label} » sans transform`);
  const v = vue();
  return { x: v.panX + Number(m[1]) * v.z, y: v.panY + Number(m[2]) * v.z };
}

describe('AIDE de la colonne — elle se dit sur les routes DESSINÉES, jamais sur les routes brutes', () => {
  it('destination non révélée : aucun tracé cliquable, et le message DIT l’absence', async () => {
    useGame.setState({ worldMap: carteMuette, flags: {} });
    await monter({ hereSceneId: 's-auberge' });
    expect(container.querySelectorAll('path[pointer-events="stroke"]')).toHaveLength(0);
    expect(container.textContent).toContain('Aucune route ne part de ce lieu.');
    expect(container.textContent).not.toContain('Cliquez une destination CERCLÉE');
  });

  it('destination révélée : le médaillon existe, et le message redevient l’invitation au clic', async () => {
    useGame.setState({ worldMap: carteMuette, flags: { 'edo-ch1-altdorf-revelee': true } });
    await monter({ hereSceneId: 's-auberge' });
    expect(container.querySelectorAll('path[pointer-events="stroke"]')).toHaveLength(1);
    expect(container.textContent).toContain('Cliquez une destination CERCLÉE');
    expect(container.textContent).not.toContain('Aucune route ne part de ce lieu.');
  });
});

describe('RÉVÉLATION en cours de partie — la vue se re-cadre pour que le lieu neuf naisse DANS le cadre', () => {
  it('le médaillon révélé est à l’ÉCRAN sans toucher « Recentrer » (recette #684)', async () => {
    useGame.setState({ worldMap: carteMuette, flags: {} });
    await monter({ hereSceneId: 's-auberge' });
    const avant = vue();

    await act(async () => {
      useGame.setState({ flags: { 'edo-ch1-altdorf-revelee': true } });
    });

    // Le lieu neuf est cliquable LÀ OÙ LE JOUEUR REGARDE, pas hors du parchemin (mesure de recette :
    // sans recadrage, le médaillon naissait au-delà du bord droit, présent au DOM et inatteignable).
    const p = marqueurEcran('Altdorf');
    expect([p.x >= 0 && p.x <= VB_W, p.y >= 0 && p.y <= VB_H], `médaillon à ${JSON.stringify(p)} hors du cadre 0..${VB_W} × 0..${VB_H}`)
      .toEqual([true, true]);
    // Et la caméra a bien BOUGÉ pour cela (le cadrage d'un lieu isolé ne cadre pas deux lieux écartés).
    expect(vue()).not.toEqual(avant);
  });

  it('sans révélation, la caméra ne bouge pas d’elle-même (aucun recadrage à chaque rendu)', async () => {
    useGame.setState({ worldMap: carteMuette, flags: {} });
    await monter({ hereSceneId: 's-auberge' });
    const avant = vue();
    await act(async () => {
      useGame.setState({ flags: { 'un-flag-sans-effet-sur-la-carte': true } });
    });
    expect(vue()).toEqual(avant);
  });
});

describe('non-régression — un paquet RÉEL sans `when` rend à l’identique avec et sans gating', () => {
  it('loup-et-saumure : le rendu est le même que le flag narratif soit posé ou non', async () => {
    const map = parseProject(loupEtSaumureProjet as unknown).worldMap!;
    const premier = map.places[0];

    useGame.setState({ worldMap: map, flags: {} });
    await monter({ hereSceneId: premier.scene });
    const nu = container.innerHTML;

    await act(async () => useGame.setState({ flags: { 'un-flag-quelconque': true } }));

    expect(container.innerHTML).toBe(nu);
    for (const el of container.querySelectorAll('[aria-labelledby], [aria-describedby]')) {
      for (const attr of ['aria-labelledby', 'aria-describedby']) {
        for (const id of (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean)) {
          expect(document.getElementById(id), `lien ${attr} vers ${id}`).not.toBeNull();
        }
      }
    }
    for (const p of map.places) expect(container.textContent).toContain(p.label);
  });
});

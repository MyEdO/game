/**
 * Écrivains de la carte du monde (`./worldMapEdit`) : ce qu'un hôte qui embarque le noyau édite sans
 * `src/ui` — défauts, bornes, dédoublonnage, cascades.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { resetData, setObjectDataset } from '../data/overrides';
import { semencesDeScene } from '../data';
import { routesFrom, type MapPlace, type MapRoute, type WorldMap } from './worldMap';
import {
  BORNES_DE_CARTE, ajouterLieu, basculerMode, lierLieux, majCarte, majLieu, majRoute, supprimerLieu, supprimerRoute,
} from './worldMapEdit';

const lieu = (id: string, x: number, y = 50): MapPlace => ({ id, label: id, pos: { x, y }, scene: 's' });
const route = (id: string, a: string, b: string, plus: Partial<MapRoute> = {}): MapRoute => ({ id, a, b, km: 5, modes: ['pied'], ...plus }) as MapRoute;
const carte = (places: MapPlace[] = [], routes: MapRoute[] = []): WorldMap => ({ id: 'm', label: 'Carte', places, routes });

afterEach(() => resetData());

describe('ajouterLieu', () => {
  it('pose le libellé de la semence et la première scène du projet', () => {
    setObjectDataset('semencesDeScene', { ...semencesDeScene, lieu: 'Bourg sans nom' });
    const m = ajouterLieu(carte(), 'l1', { x: 50, y: 50 }, [{ id: 'scene-a' }, { id: 'scene-b' }]);
    expect(m.places).toEqual([{ id: 'l1', label: 'Bourg sans nom', pos: { x: 50, y: 50 }, scene: 'scene-a' }]);
  });

  it('sans scène au projet, la scène liée est vide', () => {
    expect(ajouterLieu(carte(), 'l1', { x: 50, y: 50 }, []).places[0].scene).toBe('');
  });

  it('plafonne la position aux bornes de la carte et l’arrondit', () => {
    const m = ajouterLieu(carte(), 'l1', { x: -20, y: 140.4 }, []);
    expect(m.places[0].pos).toEqual({ x: BORNES_DE_CARTE.x.min, y: BORNES_DE_CARTE.y.max });
    expect(ajouterLieu(carte(), 'l1', { x: 33.6, y: 41.2 }, []).places[0].pos).toEqual({ x: 34, y: 41 });
  });

  it('décale vers la droite un ajout qui chevauche un lieu', () => {
    const m = ajouterLieu(carte([lieu('a', 50), lieu('b', 58)]), 'l1', { x: 50, y: 50 }, []);
    expect(m.places[m.places.length - 1].pos).toEqual({ x: 66, y: 50 });
  });

  it('un ajout sans place libre à droite s’arrête à la borne, il ne boucle pas', () => {
    let m = carte();
    for (let i = 0; i < 9; i++) m = ajouterLieu(m, `l${i}`, { x: 50, y: 50 }, []);
    expect(m.places.map((p) => p.pos.x)).toEqual([50, 58, 66, 74, 82, 90, 98, 98, 98]);
  });

  it('refuse un id déjà porté', () => {
    const m = carte([lieu('a', 10)]);
    expect(ajouterLieu(m, 'a', { x: 50, y: 50 }, [])).toBe(m);
  });
});

describe('lierLieux', () => {
  const deux = carte([lieu('a', 10), lieu('b', 80)]);

  it('relie deux lieux par une route de 10 km à pied, à double sens', () => {
    expect(lierLieux(deux, 'r1', 'a', 'b').routes).toEqual([{ id: 'r1', a: 'a', b: 'b', km: 10, modes: ['pied'] }]);
  });

  it('refuse une paire déjà reliée à double sens, dans un sens comme dans l’autre', () => {
    const m = lierLieux(deux, 'r1', 'a', 'b');
    expect(lierLieux(m, 'r2', 'a', 'b')).toBe(m);
    expect(lierLieux(m, 'r2', 'b', 'a')).toBe(m);
  });

  it('une paire reliée dans un seul sens reçoit la route de l’autre sens', () => {
    const m = carte(deux.places, [route('aller', 'a', 'b', { from: 'a' })]);
    const r = lierLieux(m, 'retour', 'a', 'b').routes.find((x) => x.id === 'retour');
    expect(r?.from).toBe('b');
    const apres = lierLieux(m, 'retour', 'a', 'b');
    expect(routesFrom(apres, 'a').map((x) => x.id)).toEqual(['aller']);
    expect(routesFrom(apres, 'b').map((x) => x.id)).toEqual(['retour']);
  });

  it('refuse une paire reliée dans ses deux sens par deux routes à sens unique', () => {
    const m = carte(deux.places, [route('aller', 'a', 'b', { from: 'a' }), route('retour', 'b', 'a', { from: 'b' })]);
    expect(lierLieux(m, 'r3', 'a', 'b')).toBe(m);
  });

  it('refuse une boucle, un lieu inconnu et un id de route déjà porté', () => {
    expect(lierLieux(deux, 'r1', 'a', 'a')).toBe(deux);
    expect(lierLieux(deux, 'r1', 'a', 'z')).toBe(deux);
    const m = carte([...deux.places, lieu('c', 40)], [route('r1', 'a', 'b')]);
    expect(lierLieux(m, 'r1', 'a', 'c')).toBe(m);
  });
});

describe('suppressions', () => {
  it('supprimer un lieu retire ses routes, et seulement elles', () => {
    const m = carte([lieu('a', 10), lieu('b', 50), lieu('c', 90)], [route('ab', 'a', 'b'), route('bc', 'b', 'c'), route('ca', 'c', 'a')]);
    const apres = supprimerLieu(m, 'a');
    expect(apres.places.map((p) => p.id)).toEqual(['b', 'c']);
    expect(apres.routes.map((r) => r.id)).toEqual(['bc']);
  });

  it('supprimer une route coupe la suite des billets qui la couvrent', () => {
    const m = carte([lieu('a', 10), lieu('b', 50), lieu('c', 90), lieu('d', 70, 20)], [
      route('ab', 'a', 'b', { from: 'a', modes: ['diligence'], billets: { diligence: { prix: {}, suite: ['bc', 'cd'] } } }),
      route('bc', 'b', 'c', { modes: ['diligence'] }),
      route('cd', 'c', 'd', { modes: ['diligence'], billets: { diligence: { prix: {}, depuis: 'c', suite: ['bc'] } } }),
    ]);
    const apres = supprimerRoute(m, 'cd');
    expect(apres.routes.map((r) => r.id)).toEqual(['ab', 'bc']);
    expect(apres.routes[0].billets?.diligence?.suite).toEqual(['bc']);
    const sansBc = supprimerRoute(m, 'bc');
    expect(sansBc.routes.find((r) => r.id === 'ab')!.billets!.diligence).toEqual({ prix: {} });
    expect(sansBc.routes.find((r) => r.id === 'cd')!.billets!.diligence).toEqual({ prix: {}, depuis: 'c' });
  });

  it('supprimer un lieu coupe aussi la suite des billets qui couvraient ses routes', () => {
    const m = carte([lieu('a', 10), lieu('b', 50), lieu('c', 90)], [
      route('ab', 'a', 'b', { from: 'a', modes: ['diligence'], billets: { diligence: { prix: {}, suite: ['bc'] } } }),
      route('bc', 'b', 'c', { modes: ['diligence'] }),
    ]);
    expect(supprimerLieu(m, 'c').routes).toEqual([route('ab', 'a', 'b', { from: 'a', modes: ['diligence'], billets: { diligence: { prix: {} } } })]);
  });
});

describe('patchs et modes', () => {
  it('majCarte, majLieu et majRoute patchent leur cible seule', () => {
    const m = carte([lieu('a', 10), lieu('b', 80)], [route('r', 'a', 'b')]);
    expect(majCarte(m, { label: 'Reikland' }).label).toBe('Reikland');
    expect(majLieu(m, 'a', { label: 'Altdorf' }).places.map((p) => p.label)).toEqual(['Altdorf', 'b']);
    expect(majRoute(m, 'r', { km: 42 }).routes[0].km).toBe(42);
  });

  it('un lieu déplacé reste dans les bornes de la carte', () => {
    const m = majLieu(carte([lieu('a', 10)]), 'a', { pos: { x: 120, y: 1 } });
    expect(m.places[0].pos).toEqual({ x: BORNES_DE_CARTE.x.max, y: BORNES_DE_CARTE.y.min });
  });

  it('basculerMode coche puis décoche ; le dernier mode décoché retombe à pied', () => {
    let m = carte([lieu('a', 10), lieu('b', 80)], [route('r', 'a', 'b', { modes: ['diligence'] })]);
    m = basculerMode(m, 'r', 'monture');
    expect(m.routes[0].modes).toEqual(['diligence', 'monture']);
    m = basculerMode(basculerMode(m, 'r', 'diligence'), 'r', 'monture');
    expect(m.routes[0].modes).toEqual(['pied']);
  });

  it('retirer un mode qui porte un billet est refusé : la carte reste inchangée', () => {
    const billets = { diligence: { prix: {} } } as unknown as MapRoute['billets'];
    const m = carte([lieu('a', 10), lieu('b', 80)], [route('r', 'a', 'b', { modes: ['diligence', 'pied'], billets })]);
    expect(basculerMode(m, 'r', 'diligence')).toBe(m);
    expect(majRoute(m, 'r', { modes: ['pied'] })).toBe(m);
    expect(basculerMode(m, 'r', 'pied').routes[0].modes).toEqual(['diligence']);
  });

  it('des modes vidés par un patch retombent à pied', () => {
    const m = carte([lieu('a', 10), lieu('b', 80)], [route('r', 'a', 'b', { sea: true, modes: ['mer'] })]);
    expect(majRoute(m, 'r', { sea: undefined, modes: [] }).routes[0].modes).toEqual(['pied']);
  });
});

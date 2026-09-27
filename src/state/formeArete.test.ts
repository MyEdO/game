import { describe, it, expect } from 'vitest';
import { formesDeLArete, formeRendue, formesAdmises, formesHorsCompatibilite, fenetrePosable, aretesHorsCompatibilite, facadesHorsCompatibilite, apparenceDeLArete, type FormeArete } from './formeArete';
import { emptyScene, type Scene, type WallSeg } from './scene';
import { validateScene } from './validateScene';
import { structureAppearances } from '../data';
import { allBuiltinCampaigns } from '../scenes/campaign';
import { testScenarios } from '../scenes/test-scenarios';

/**
 * FORME d'une arête × COMPATIBILITÉ de son apparence (#1883) — un positif et un négatif par forme,
 * sur les apparences RÉELLES du catalogue (`structureAppearance.json`).
 */
const app = (id: string) => structureAppearances.find((a) => a.id === id)!;
type Seg = Pick<WallSeg, 'door' | 'window' | 'structure'>;

const CAS: { forme: FormeArete; seg: Seg; habille: string; refuse?: string }[] = [
  { forme: 'mur-nu', seg: { structure: 'mur-en-bois' }, habille: 'garde-corps' },
  { forme: 'mur-fenetre', seg: { structure: 'mur-en-bois', window: true }, habille: 'mur-en-pierres-seches', refuse: 'terrassement' },
  { forme: 'porte-fermee', seg: { door: true }, habille: 'plain', refuse: 'mantelet-de-bois' },
  { forme: 'porte-ouverte', seg: { door: true }, habille: 'herse', refuse: 'mur-en-pierre' },
  { forme: 'fermeture-fixe', seg: { structure: 'porte-de-ville' }, habille: 'porte-de-ville', refuse: 'palissade-de-pieux' },
];

describe('formeArete — la forme vient de la nature de la Structure ET de `door`', () => {
  it('chaque cas prend bien la forme annoncée', () => {
    for (const c of CAS) expect(formesDeLArete(c.seg), c.forme).toContain(c.forme);
  });

  it('une Structure de nature `porte` sans `door` est une FERMETURE FIXE ; avec `door`, une porte ouvrable', () => {
    expect(formesDeLArete({ structure: 'herse' })).toEqual(['fermeture-fixe']);
    expect(formesDeLArete({ structure: 'herse', door: true })).toEqual(['porte-fermee', 'porte-ouverte']);
    expect(formeRendue({ structure: 'herse', door: true }, true)).toBe('porte-ouverte');
    expect(formeRendue({ structure: 'herse', door: true }, false)).toBe('porte-fermee');
    expect(formeRendue({ structure: 'herse' }, true)).toBe('fermeture-fixe');
  });

  for (const c of CAS)
    it(`${c.forme} : « ${c.habille} » l’habille${c.refuse ? `, « ${c.refuse} » la refuse` : ''}`, () => {
      expect(formesAdmises(app(c.habille))).toContain(c.forme);
      if (c.refuse) expect(formesAdmises(app(c.refuse))).not.toContain(c.forme);
    });

  it('la fenêtre ne se pose ni sur une claire-voie, ni sur une fermeture, ni sans bloc `window`', () => {
    expect(fenetrePosable({ structure: 'mur-en-bois' }, app('mur-en-bois'))).toBe(true);
    expect(fenetrePosable({ structure: 'garde-corps' }, app('garde-corps'))).toBe(false);
    expect(fenetrePosable({ structure: 'terrassement' }, app('terrassement'))).toBe(false);
    expect(fenetrePosable({ structure: 'porte-de-ville' }, app('mur-en-bois'))).toBe(false);
    expect(fenetrePosable({ door: true }, app('plain'))).toBe(false);
  });

  it('l’apparence RÉSOLUE d’une arête : déclarée, sinon celle du préset de sa façade, sinon le mur nu', () => {
    expect(apparenceDeLArete({ structure: 'herse' }, 'forge')).toBe('herse');
    expect(apparenceDeLArete({}, 'auberge-relais-imperiale')).toBe('mur-a-ossature-en-bois');
    expect(apparenceDeLArete({}, 'mur-en-pierre')).toBeUndefined();
    expect(apparenceDeLArete({})).toBe('plain');
  });
});

describe('validateScene — une arête hors compatibilité est une erreur nommée', () => {
  const erreurs = (walls: WallSeg[], architecture?: Scene['architecture']) => {
    const s: Scene = { ...emptyScene(4, 4), walls, ...(architecture ? { architecture } : {}) };
    return validateScene([s]).filter((w) => w.level === 'error' && w.message.startsWith('Arête ')).map((w) => w.message);
  };
  const erreursFacade = (architecture: Scene['architecture']) =>
    validateScene([{ ...emptyScene(4, 4), walls: [{ x: 1, y: 1, side: 'N' }], architecture }]).filter((w) => w.level === 'error' && w.message.startsWith('Façade ')).map((w) => w.message);
  const facade = (appearance: string): Scene['architecture'] => [
    { id: 'b', storeys: [], masses: [], facades: [{ id: 'f', z: 0, edges: [{ x: 1, y: 1, side: 'N' }], appearance }] },
  ];

  it('un garde-corps fenêtré, un mantelet en porte : refusés, forme et apparence nommées', () => {
    expect(erreurs([{ x: 1, y: 1, side: 'N', structure: 'garde-corps', window: true }])).toEqual([
      'Arête (1,1) N : l’apparence « Garde-corps » n’habille pas la forme « mur fenêtré » — elle admet « mur nu ». Change l’apparence, ou la nature de l’arête.',
    ]);
    expect(erreurs([{ x: 1, y: 1, side: 'N', door: true, appearance: 'mantelet-de-bois' }])[0])
      .toContain('n’habille pas la forme « porte fermée », « porte ouverte »');
  });

  it('une arête SANS apparence déclarée est jugée sur sa FAÇADE ; une façade qui ne nomme pas un préset est refusée, et son arête aussi', () => {
    expect(erreurs([{ x: 1, y: 1, side: 'N', door: true }], facade('auberge-relais-imperiale'))).toEqual([]);
    expect(erreurs([{ x: 1, y: 1, side: 'N', door: true }], facade('mur-en-pierre'))).toEqual([
      'Arête (1,1) N : l’apparence « mur-en-pierre » est absente du catalogue des apparences de mur et des présets de façade.',
    ]);
    expect(erreursFacade(facade('mur-en-pierre'))).toEqual(['Façade « f » (b) : « mur-en-pierre » n’est pas un préset de façade.']);
  });

  it('un bandeau de fenêtres dont l’apparence n’habille pas le mur fenêtré est refusé', () => {
    const bandeau = (appearance?: string): Scene['architecture'] => [{
      id: 'b', storeys: [], masses: [], facades: [{
        id: 'f', z: 0, edges: [{ x: 1, y: 1, side: 'N' }], appearance: 'auberge-relais-imperiale',
        features: [{ id: 'w', kind: 'window-band', edge: { x: 1, y: 1, side: 'N' }, ...(appearance ? { appearance } : {}) }],
      }],
    }];
    expect(erreursFacade(bandeau())).toEqual([]);
    expect(erreursFacade(bandeau('mur-en-pierres-seches'))).toEqual([]);
    expect(erreursFacade(bandeau('terrassement'))).toEqual([
      'Façade « f » (b), bandeau de fenêtres « w » : l’apparence « Terrassement » n’habille pas la forme « mur fenêtré ».',
    ]);
  });

  it('une fermeture fixe (siège), une porte ouvrable, un mur fenêtré, une porte au mur nu : acceptés', () => {
    expect(erreurs([
      { x: 1, y: 1, side: 'N', structure: 'porte-de-ville' },
      { x: 2, y: 1, side: 'N', door: true, structure: 'solide-porte-en-bois' },
      { x: 1, y: 2, side: 'N', structure: 'mur-en-bois', window: true },
      { x: 2, y: 2, side: 'N', door: true },
    ])).toEqual([]);
  });

  it('les scènes LIVRÉES (scénarios et campagnes) n’ont aucune arête hors compatibilité, façades comprises', () => {
    const scenes: Scene[] = [...testScenarios.map((s) => s.scene), ...allBuiltinCampaigns.flatMap((c) => c.scenes ?? [])];
    const aretes = scenes.reduce((n, s) => n + (s.walls?.length ?? 0), 0);
    expect(aretes, 'aucune arête livrée — ce contrat ne mesurerait rien').toBeGreaterThan(0);
    expect(scenes.flatMap((s) => [...aretesHorsCompatibilite(s), ...facadesHorsCompatibilite(s)].map((m) => `${s.id} ${m}`))).toEqual([]);
  });

  it('formesHorsCompatibilite rend exactement les formes refusées', () => {
    expect(formesHorsCompatibilite({ door: true }, app('garde-corps'))).toEqual(['porte-fermee', 'porte-ouverte']);
    expect(formesHorsCompatibilite({ door: true }, app('plain'))).toEqual([]);
  });
});

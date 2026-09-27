import { describe, it, expect } from 'vitest';
import { formesDeLArete, formeRendue, formesAdmises, formesHorsCompatibilite, fenetrePosable, aretesHorsCompatibilite, type FormeArete } from './formeArete';
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

const CAS: { forme: FormeArete; seg: Seg; habille: string; refuse: string }[] = [
  { forme: 'mur-nu', seg: { structure: 'mur-en-bois' }, habille: 'garde-corps', refuse: 'porte-de-ville' },
  { forme: 'mur-fenetre', seg: { structure: 'mur-en-bois', window: true }, habille: 'mur-en-bois', refuse: 'garde-corps' },
  { forme: 'porte-fermee', seg: { door: true }, habille: 'plain', refuse: 'garde-corps' },
  { forme: 'porte-ouverte', seg: { door: true }, habille: 'herse', refuse: 'mur-en-pierre' },
  { forme: 'fermeture-fixe', seg: { structure: 'porte-de-ville' }, habille: 'porte-de-ville', refuse: 'garde-corps' },
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
    it(`${c.forme} : « ${c.habille} » l’habille, « ${c.refuse} » la refuse`, () => {
      expect(formesAdmises(app(c.habille))).toContain(c.forme);
      expect(formesAdmises(app(c.refuse))).not.toContain(c.forme);
    });

  it('la fenêtre ne se pose ni sur une claire-voie, ni sur une fermeture', () => {
    expect(fenetrePosable({ structure: 'mur-en-bois' }, app('mur-en-bois'))).toBe(true);
    expect(fenetrePosable({ structure: 'garde-corps' }, app('garde-corps'))).toBe(false);
    expect(fenetrePosable({ structure: 'porte-de-ville' }, app('mur-en-bois'))).toBe(false);
    expect(fenetrePosable({ door: true }, app('plain'))).toBe(false);
  });
});

describe('validateScene — une arête hors compatibilité est une erreur nommée', () => {
  const erreurs = (walls: WallSeg[]) => {
    const s: Scene = { ...emptyScene(4, 4), walls };
    return validateScene([s]).filter((w) => w.level === 'error' && w.message.startsWith('Arête ')).map((w) => w.message);
  };

  it('un garde-corps fenêtré, une porte de ville sur un mur nu : refusés, forme et apparence nommées', () => {
    expect(erreurs([{ x: 1, y: 1, side: 'N', structure: 'garde-corps', window: true }])).toEqual([
      'Arête (1,1) N : l’apparence « Garde-corps » n’habille pas la forme « mur fenêtré » — elle admet « mur nu ». Change l’apparence, ou la nature de l’arête.',
    ]);
    expect(erreurs([{ x: 1, y: 1, side: 'N', structure: 'mur-en-bois', appearance: 'porte-de-ville' }])[0])
      .toContain('n’habille pas la forme « mur nu »');
  });

  it('une fermeture fixe (siège), une porte ouvrable, un mur fenêtré : acceptés', () => {
    expect(erreurs([
      { x: 1, y: 1, side: 'N', structure: 'porte-de-ville' },
      { x: 2, y: 1, side: 'N', door: true, structure: 'solide-porte-en-bois' },
      { x: 1, y: 2, side: 'N', structure: 'mur-en-bois', window: true },
    ])).toEqual([]);
  });

  it('les scènes LIVRÉES (scénarios et campagnes) n’ont aucune arête hors compatibilité', () => {
    const scenes: Scene[] = [...testScenarios.map((s) => s.scene), ...allBuiltinCampaigns.flatMap((c) => c.scenes ?? [])];
    const aretes = scenes.reduce((n, s) => n + (s.walls?.length ?? 0), 0);
    expect(aretes, 'aucune arête livrée — ce contrat ne mesurerait rien').toBeGreaterThan(0);
    expect(scenes.flatMap((s) => aretesHorsCompatibilite(s.walls ?? []).map((m) => `${s.id} ${m}`))).toEqual([]);
  });

  it('formesHorsCompatibilite rend exactement les formes refusées', () => {
    expect(formesHorsCompatibilite({ door: true }, app('garde-corps'))).toEqual(['porte-fermee', 'porte-ouverte']);
    expect(formesHorsCompatibilite({ door: true }, app('plain'))).toEqual([]);
  });
});

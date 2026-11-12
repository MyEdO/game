/**
 * #2968 L14 — la scène d'un lieu de la carte (`scene`), de son point d'intérêt (`sceneId`), de l'embuscade d'une route
 * (`ambush.scene`) et d'un effet `transition` (Flow de scène comme péripétie de route) se désigne par `ref(portee)` :
 * `{ id }` jugé au parse contre la collection `scenes` du MÊME projet, que la racine du projet ouvre (`ouvrirPortees`).
 * Fixtures : référence connue, inconnue, écrite en id nu, d'une portée ÉTRANGÈRE (une scène d'un autre projet), et
 * portée locale. Aucun porteur n'est une liste.
 */
import { describe, expect, it } from 'vitest';
import { projetSchema } from './projet';
import { mesureDuParse } from '../grammaire/ref';
import { versDisque } from '../grammaire/prose';
import { IDS_PAR_ESPACE } from '../_ids.generated';
import areneProjet from '../../../scenes/arene/arene-projet.json';
import bargeDuSelProjet from '../../../scenes/barge-du-sel/barge-du-sel-projet.json';
import diligenceProjet from '../../../scenes/diligence/diligence-projet.json';
import loupEtSaumureProjet from '../../../scenes/loup-et-saumure/loup-et-saumure-projet.json';

type Projet = typeof loupEtSaumureProjet;

const RANG_SCENE_DU_DECLENCHEUR = loupEtSaumureProjet.scenes.findIndex((s) => s.id === 'ls-quai-salzenmund');
const RANG_DECLENCHEUR = loupEtSaumureProjet.scenes[RANG_SCENE_DU_DECLENCHEUR].triggers.findIndex((t) => t.id === 'ls-retour-epilogue');

const messages = (projet: unknown): string[] => {
  const r = projetSchema.safeParse(projet);
  expect(r.success, 'le projet a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`);
};

/** Le projet Loup et saumure, retouché par `retouche` sur une copie. */
const projet = (retouche: (copie: Projet) => void): Projet => {
  const copie = structuredClone(loupEtSaumureProjet);
  retouche(copie);
  return copie;
};

const PORTEURS = [
  {
    porteur: 'worldMap.places[].scene', chemin: 'worldMap.places.0.scene',
    avec: (v: unknown) => projet((c) => Object.assign(c.worldMap.places[0], { scene: v })),
  },
  {
    porteur: 'worldMap.places[].poi[].sceneId', chemin: 'worldMap.places.0.poi.0.sceneId',
    avec: (v: unknown) => projet((c) => {
      const lieu: { poi: unknown[] } = c.worldMap.places[0];
      const { serviceKind: _service, ...poi } = c.worldMap.places[0].poi[0];
      lieu.poi[0] = { ...poi, sceneId: v };
    }),
  },
  {
    porteur: 'worldMap.routes[].ambush.scene', chemin: 'worldMap.routes.0.ambush.scene',
    avec: (v: unknown) => projet((c) => Object.assign(c.worldMap.routes[0].ambush, { scene: v })),
  },
  {
    porteur: 'scenes[].triggers[].flow › transition.scene', chemin: `scenes.${RANG_SCENE_DU_DECLENCHEUR}.triggers.${RANG_DECLENCHEUR}.flow.etapes.0.effet.scene`,
    avec: (v: unknown) => projet((c) => Object.assign(c.scenes[RANG_SCENE_DU_DECLENCHEUR].triggers[RANG_DECLENCHEUR].flow.etapes[0].effet, { scene: v })),
  },
  {
    porteur: 'worldMap.routes[].perils[].effects › transition.scene', chemin: 'worldMap.routes.0.perils.0.effects.0.scene',
    avec: (v: unknown) => projet((c) => Object.assign(c.worldMap.routes[0], { perils: [{ label: 'Dérive', chancePct: 10, effects: [{ type: 'transition', scene: v }] }] })),
  },
];

describe('#2968 L14 — scènes visées désignées par `ref(portee)`', () => {
  it('les projets réels parsent, et leurs scènes visées sont des slots `local:scenes` au parse de mesure', () => {
    const compte = (lu: unknown) => {
      const doc = versDisque(lu);
      expect(projetSchema.safeParse(doc).success).toBe(true);
      return mesureDuParse(projetSchema, doc).reperes.filter((r) => r.type === 'local:scenes').length;
    };
    expect(compte(areneProjet)).toBe(4 + 4 + 13 + 13);
    expect(compte(bargeDuSelProjet)).toBe(2 + 1);
    expect(compte(diligenceProjet)).toBe(4);
    expect(compte(loupEtSaumureProjet)).toBe(2 + 2 + 1);
  });

  it.each(PORTEURS)('$porteur : une référence connue parse', ({ avec }) => {
    expect(projetSchema.safeParse(avec({ id: 'ls-quai-erengrad' })).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée à son path, sa collection et son id nommés', ({ avec, chemin }) => {
    expect(messages(avec({ id: 'scene-inexistante' }))).toContain(
      `${chemin}.id « scene-inexistante » est absent du catalogue des scènes du projet (collection « scenes » du document).`,
    );
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ avec }) => {
    expect(projetSchema.safeParse(avec('ls-quai-erengrad')).success).toBe(false);
  });

  it.each(PORTEURS)('$porteur : la scène d’un AUTRE projet est refusée', ({ avec }) => {
    expect(messages(avec({ id: 'arene-hub' })).join(' ')).toContain('« arene-hub » est absent du catalogue des scènes du projet');
  });

  it('la portée est LOCALE : une scène retirée du projet n’est plus désignable', () => {
    const sansErengrad = projet((c) => {
      c.scenes = c.scenes.filter((s) => s.id !== 'ls-quai-erengrad');
    });
    expect(messages(sansErengrad)).toContain(
      'worldMap.places.1.scene.id « ls-quai-erengrad » est absent du catalogue des scènes du projet (collection « scenes » du document).',
    );
  });

  it('un id local n’entre dans aucun espace de l’INDEX DES IDS', () => {
    expect(Object.keys(IDS_PAR_ESPACE).filter((c) => /projet|scenes/.test(c))).toEqual([]);
  });
});

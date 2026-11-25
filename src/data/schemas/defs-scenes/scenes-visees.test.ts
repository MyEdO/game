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
import paquetDeTest from '../../../scenes/fixtures/paquet-de-test.json';

type Projet = typeof paquetDeTest;

/** Rangs, dans le projet de test, de la scène qui porte le déclencheur de transition et de ce déclencheur. */
const RANG_SCENE_DU_DECLENCHEUR = 0;
const RANG_DECLENCHEUR = 0;

const messages = (projet: unknown): string[] => {
  const r = projetSchema.safeParse(projet);
  expect(r.success, 'le projet a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`);
};

/** Le paquet de test, son premier lieu doté d'un point d'intérêt, sa route d'une embuscade et sa première scène d'un
 *  déclencheur de transition, chacun visant `scene-de-test-b` ; retouché par `retouche` sur une copie. */
const projet = (retouche: (copie: Projet) => void): Projet => {
  const copie: Projet = structuredClone(paquetDeTest);
  const vers = () => ({ id: 'scene-de-test-b' });
  Object.assign(copie.worldMap.places[0], { poi: [{ id: 'poi-de-test', label: 'Point de test', pos: { x: 20, y: 40 }, sceneId: vers() }] });
  Object.assign(copie.worldMap.routes[0], { ambush: { scene: vers(), encounter: 'rencontre-de-test' } });
  copie.scenes[RANG_SCENE_DU_DECLENCHEUR].triggers = [{ id: 'transition-de-test', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'transition', scene: vers() } }] } }] as never[];
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
    avec: (v: unknown) => projet((c) => Object.assign((c.worldMap.places[0] as unknown as { poi: object[] }).poi[0], { sceneId: v })),
  },
  {
    porteur: 'worldMap.routes[].ambush.scene', chemin: 'worldMap.routes.0.ambush.scene',
    avec: (v: unknown) => projet((c) => Object.assign((c.worldMap.routes[0] as unknown as { ambush: object }).ambush, { scene: v })),
  },
  {
    porteur: 'scenes[].triggers[].flow › transition.scene', chemin: `scenes.${RANG_SCENE_DU_DECLENCHEUR}.triggers.${RANG_DECLENCHEUR}.flow.etapes.0.effet.scene`,
    avec: (v: unknown) => projet((c) => Object.assign((c.scenes[RANG_SCENE_DU_DECLENCHEUR].triggers[RANG_DECLENCHEUR] as { flow: { etapes: { effet: object }[] } }).flow.etapes[0].effet, { scene: v })),
  },
  {
    porteur: 'worldMap.routes[].perils[].effects › transition.scene', chemin: 'worldMap.routes.0.perils.0.effects.0.scene',
    avec: (v: unknown) => projet((c) => Object.assign(c.worldMap.routes[0], { perils: [{ label: 'Dérive', chancePct: 10, effects: [{ type: 'transition', scene: v }] }] })),
  },
];

describe('#2968 L14 — scènes visées désignées par `ref(portee)`', () => {
  it('les projets livrés parsent', () => {
    for (const lu of [areneProjet, bargeDuSelProjet, diligenceProjet, loupEtSaumureProjet]) expect(projetSchema.safeParse(versDisque(lu)).success).toBe(true);
  });

  it('chaque scène visée est un slot `local:scenes` au parse de mesure, à son path', () => {
    const complet = projet((c) => Object.assign(c.worldMap.routes[0], { perils: [{ label: 'Dérive', chancePct: 10, effects: [{ type: 'transition', scene: { id: 'scene-de-test-a' } }] }] }));
    expect(projetSchema.safeParse(complet).success).toBe(true);
    const reperes = mesureDuParse(projetSchema, complet).reperes.filter((r) => r.type === 'local:scenes').map((r) => r.path.join('.')).sort();
    const duPaquet = [
      ...complet.worldMap.places.flatMap((_, i) => (i ? [`worldMap.places.${i}.scene.id`] : [])),
      ...complet.worldMap.routes.flatMap((r, i) => (i && 'ambush' in r ? [`worldMap.routes.${i}.ambush.scene.id`] : [])),
    ];
    expect(reperes, 'chaque porteur posé, et chaque scène que le paquet désigne déjà').toEqual([...PORTEURS.map((p) => `${p.chemin}.id`), ...duPaquet].sort());
  });

  it.each(PORTEURS)('$porteur : une référence connue parse', ({ avec }) => {
    expect(projetSchema.safeParse(avec({ id: 'scene-de-test-b' })).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée à son path, sa collection et son id nommés', ({ avec, chemin }) => {
    expect(messages(avec({ id: 'scene-inexistante' }))).toContain(
      `${chemin}.id « scene-inexistante » est absent du catalogue des scènes du projet (collection « scenes » du document).`,
    );
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ avec }) => {
    expect(projetSchema.safeParse(avec('scene-de-test-b')).success).toBe(false);
  });

  it.each(PORTEURS)('$porteur : la scène d’un AUTRE projet est refusée', ({ avec }) => {
    expect(messages(avec({ id: 'scene-d-un-autre-projet' })).join(' ')).toContain('« scene-d-un-autre-projet » est absent du catalogue des scènes du projet');
  });

  it('la portée est LOCALE : une scène retirée du projet n’est plus désignable', () => {
    const sansSceneB = projet((c) => {
      c.scenes = c.scenes.filter((s) => s.id !== 'scene-de-test-b');
    });
    expect(messages(sansSceneB)).toContain(
      'worldMap.places.1.scene.id « scene-de-test-b » est absent du catalogue des scènes du projet (collection « scenes » du document).',
    );
  });

  it('un id local n’entre dans aucun espace de l’INDEX DES IDS', () => {
    expect(Object.keys(IDS_PAR_ESPACE).filter((c) => /projet|scenes/.test(c))).toEqual([]);
  });
});

/**
 * Le GESTE de l'éditeur au noyau (#3059) : appliquer un outil à une case, valider un rectangle, créer
 * une architecture, décaler une sélection, poser une volée — sans écran ni rendu, avec les bornes
 * et refus de l'éditeur. `editEntity` refuse l'identité (`id`, `kind`) par un refus nommé.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, heightAt, tileAt, type Scene } from './monde/scene';
import {
  IdentiteNonPatchable, TypeNonNomme, addArchitectureBody, addFacadeSection, addStoreyAbove, appliquerOutil, editEntity,
  nudgeSel, validerRectangle, type GesteDOutil,
} from './sceneEdit';
import { placeStairFlight } from './stairFlight';
import { semencesDeScene } from '../data';
import { buildScene, type MapSpec } from './mapSpec';

const GESTE: GesteDOutil = { z: 0, brush: 1, encId: '', encRef: 'mutant' };
const vide = (): Scene => emptyScene('scene-geste', 6, 4);

describe('appliquerOutil — un outil appliqué à une case', () => {
  it('hors de la carte, aucun outil n’écrit', () => {
    for (const p of [{ x: -1, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 4 }])
      expect(appliquerOutil(vide(), { mode: 'terrain', terrain: 'pierre' }, p, GESTE)).toBeNull();
  });

  it('le pinceau de terrain peint la case visée, à la couche du geste', () => {
    const out = appliquerOutil(vide(), { mode: 'terrain', terrain: 'pierre' }, { x: 2, y: 1 }, GESTE);
    expect(out && tileAt(out.scene, 2, 1)).toBe('pierre');
    expect(out?.sel).toBeUndefined();
  });

  it('l’outil décor pose toujours, même sur une case occupée, et désigne ce qu’il pose ; l’outil personnage désigne ce qui est déjà là', () => {
    const outil = { mode: 'entite', kind: 'prop', ref: 'tonneau' } as const;
    const pose = appliquerOutil(vide(), outil, { x: 1, y: 1 }, GESTE)!;
    expect(pose.scene.entities).toHaveLength(1);
    expect(pose.sel).toEqual({ type: 'entity', id: pose.scene.entities[0].id });
    const encore = appliquerOutil(pose.scene, outil, { x: 1, y: 1 }, GESTE)!;
    expect(encore.scene.entities).toHaveLength(2);
    expect(encore.sel).toEqual({ type: 'entity', id: encore.scene.entities[1].id });
    const pnj = appliquerOutil(encore.scene, { mode: 'entite', kind: 'personnage', ref: 'mutant' }, { x: 1, y: 1 }, GESTE)!;
    expect(pnj.scene).toBe(encore.scene);
  });

  it('l’outil de rencontre pose un ennemi et rend la rencontre qu’il a complétée', () => {
    const out = appliquerOutil(vide(), { mode: 'rencontre' }, { x: 3, y: 2 }, GESTE)!;
    expect(out.encId).toBe(out.scene.encounters[0].id);
    expect(out.sel).toEqual({ type: 'entity', id: out.scene.encounters[0].members![0].entityId });
  });

  it('l’outil de rencontre sur un décor pose un ennemi à côté de lui, sans enrôler le décor', () => {
    const tonneau = appliquerOutil(vide(), { mode: 'entite', kind: 'prop', ref: 'tonneau' }, { x: 3, y: 2 }, GESTE)!.scene;
    const out = appliquerOutil(tonneau, { mode: 'rencontre' }, { x: 3, y: 2 }, GESTE)!;
    const membre = out.scene.entities.find((e) => e.id === out.scene.encounters[0].members![0].entityId)!;
    expect(membre.kind).toBe('personnage');
    expect(out.scene.entities).toHaveLength(2);
  });

  it('l’outil murs exige l’arête visée, et bascule le mur de cette arête', () => {
    const outil = { mode: 'arete', paint: 'wall' } as const;
    expect(appliquerOutil(vide(), outil, { x: 1, y: 1 }, GESTE)).toBeNull();
    const out = appliquerOutil(vide(), outil, { x: 1, y: 1 }, { ...GESTE, side: 'N' })!;
    expect(out.scene.walls).toEqual([expect.objectContaining({ x: 1, y: 1, side: 'N' })]);
  });

  it('sélection, zone au rectangle et tracé de volée n’écrivent rien à la case', () => {
    for (const tool of [{ mode: 'selection' }, { mode: 'zone', zone: 'room' }, { mode: 'escalier', toZ: 1 }] as const)
      expect(appliquerOutil(vide(), tool, { x: 1, y: 1 }, GESTE)).toBeNull();
  });
});

describe('validerRectangle — le rectangle tracé', () => {
  const rect = { x: 1, y: 1, w: 2, h: 2 };

  it('un déclencheur et une zone de repos sont créés et désignés', () => {
    const trig = validerRectangle(vide(), { mode: 'zone', zone: 'trigger' }, rect, 0)!;
    expect(trig.sel).toEqual({ type: 'trigger', id: trig.scene.triggers[0].id });
    const repos = validerRectangle(vide(), { mode: 'zone', zone: 'rest' }, rect, 0)!;
    expect(repos.sel).toEqual({ type: 'restZone', idx: 0 });
  });

  it('une pièce naît intérieure, une zone d’effet naît piégée', () => {
    const piece = validerRectangle(vide(), { mode: 'zone', zone: 'room' }, rect, 0)!;
    expect(piece.scene.effectZones![0]).toMatchObject({ label: 'Pièce', presentation: 'interior', area: { kind: 'rect', ...rect } });
    expect(piece.sel).toEqual({ type: 'effectZone', id: piece.scene.effectZones![0].id });
    const piege = validerRectangle(vide(), { mode: 'zone', zone: 'effect' }, rect, 0)!;
    expect(piege.scene.effectZones![0].onCross).toEqual([{ op: 'wounds', amount: 5, ignoreTB: false, ignoreAP: true }]);
  });

  it('le terrain au rectangle remplit le rectangle ; un outil sans rectangle ne rend rien', () => {
    const out = validerRectangle(vide(), { mode: 'terrain', terrain: 'pierre' }, rect, 0)!;
    expect([tileAt(out.scene, 1, 1), tileAt(out.scene, 2, 2), tileAt(out.scene, 3, 3)]).toEqual(['pierre', 'pierre', 'herbe']);
    expect(validerRectangle(vide(), { mode: 'gomme' }, rect, 0)).toBeNull();
  });
});

describe('architecture — la convention du noyau', () => {
  it('le corps créé rend l’id de son premier étage', () => {
    const out = addArchitectureBody(vide(), undefined, { x: 0, y: 0, w: 1, h: 1 });
    expect(out.storeyId).toBe(out.scene.architecture![0].storeys[0].id);
  });

  it('l’étage ajouté se pose au-dessus du plus haut, avec sa couche de scène', () => {
    const corps = addArchitectureBody(vide(), undefined, { x: 0, y: 0, w: 1, h: 1 });
    const out = addStoreyAbove(corps.scene, corps.id)!;
    expect(out.z).toBe(1);
    expect(out.scene.layers.map((l) => l.z)).toContain(1);
    expect(out.scene.architecture![0].storeys.find((s) => s.id === out.id)?.z).toBe(1);
    expect(addStoreyAbove(corps.scene, 'absent')).toBeNull();
  });

  it('un pan de façade sans structure nommée reçoit celle de la semence', () => {
    const corps = addArchitectureBody(vide(), undefined, { x: 0, y: 0, w: 1, h: 1 });
    const out = addFacadeSection(corps.scene, corps.id, { x: 0, y: 0, side: 'N' })!;
    expect(out.scene.architecture![0].facades[0].appearance).toBe(semencesDeScene.facade.id);
  });
});

describe('nudgeSel — décaler la sélection', () => {
  it('décale depuis l’ancrage et plafonne à la carte, comme moveSel', () => {
    const s = { ...vide(), entryPoints: { porte: { x: 4, y: 2 } } };
    expect(nudgeSel(s, { type: 'entry', id: 'porte' }, 1, 0).entryPoints!.porte).toEqual({ x: 5, y: 2 });
    expect(nudgeSel(s, { type: 'entry', id: 'porte' }, 5, 5).entryPoints!.porte).toEqual({ x: 5, y: 3 });
    expect(nudgeSel(s, { type: 'entry', id: 'absente' }, 1, 0)).toBe(s);
  });
});

describe('placeStairFlight — poser une volée tracée', () => {
  /** Foyer coté 1 m (F), trois cases de sol (E), galerie cotée 4 m (G) à la couche 1. */
  const base = (): Scene => buildScene({
    id: 's', label: 'S', size: [4, 3], terrain: 'mur',
    levels: { z0: ['....', 'FEEE', '....'].join('\n'), z1: ['...G', '....', '....'].join('\n') },
    elevate: { F: 1, G: 4 }, legend: { F: 'pave', G: 'pierre', E: 'pierre' },
  } as MapSpec);

  it('un plan refusé ne pose rien ; un plan valide pose des cotes', () => {
    expect(placeStairFlight(base(), [{ x: 3, y: 1 }], 0, 1)).toBeNull();
    const posee = placeStairFlight(base(), [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }], 0, 1)!;
    expect([1, 2, 3].map((x) => heightAt(posee, x, 1, 0))).toEqual([2, 3, 4]);
  });
});

describe('editEntity — l’identité d’une entité ne se patche pas', () => {
  const avecDecor = (): Scene => ({ ...vide(), entities: [{ id: 'tonneau-0', kind: 'prop', decor: { id: 'tonneau' }, pos: { x: 1, y: 1 } }] });

  it('un patch qui nomme `id` ou `kind` est refusé nommément, la scène reste intacte', () => {
    const s = avecDecor();
    for (const patch of [{ id: 'autre' }, { kind: 'personnage' as const }, { label: 'x', id: 'y', kind: 'prop' as const }]) {
      expect(() => editEntity(s, 'tonneau-0', patch)).toThrow(IdentiteNonPatchable);
    }
    expect(() => editEntity(s, 'tonneau-0', { id: 'autre', kind: 'prop' })).toThrow('« id, kind » : clé d\'IDENTITÉ');
    expect(s.entities[0]).toEqual({ id: 'tonneau-0', kind: 'prop', decor: { id: 'tonneau' }, pos: { x: 1, y: 1 } });
  });

  it('un patch sans identité passe, et le refus du type reste distinct', () => {
    expect(editEntity(avecDecor(), 'tonneau-0', { label: 'Fût' }).entities[0].label).toBe('Fût');
    expect(() => editEntity(avecDecor(), 'tonneau-0', { decor: undefined })).toThrow(TypeNonNomme);
  });
});

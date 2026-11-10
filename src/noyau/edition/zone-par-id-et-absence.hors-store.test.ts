/**
 * Deux contrats de l'écriture d'éditeur (#3606) : un champ vidé par l'inspecteur est RETIRÉ du document, un champ rempli
 * est écrit, un champ non visé reste ; une zone d'effet sélectionnée est désignée par son id, si bien qu'une zone ajoutée
 * ou retirée avant elle ne change pas la zone visée, et qu'un changement d'identifiant la garde sélectionnée. Scènes
 * FABRIQUÉES.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, type Scene } from '../monde/scene';
import { emptyNarratif } from '../monde/campaignNarratif';
import { editer, ouvrirLEdition, sceneEditee, type SessionDEdition } from './session';
import { patchZone } from '../sceneEdit';
import { selRect, type Sel } from '../sceneEditLecture';

const ouverteSur = (scene: Scene): SessionDEdition => ouvrirLEdition({ scenes: [scene], narratif: emptyNarratif() } as unknown as Parameters<typeof ouvrirLEdition>[0], false);
const point = (x: number, y: number) => ({ case: { x, y }, f: { x: x + 0.5, y: y + 0.5 } });
const zone = (id: string, x: number) => ({ id, label: id, area: { kind: 'rect' as const, x, y: 0, w: 2, h: 2 } });

describe('écriture d’éditeur — une seule règle d’absence', () => {
  it('vider un champ le retire, le remplir l’écrit, un champ non visé reste', () => {
    const s = ouverteSur({ ...emptyScene('absence', 4, 4), desc: 'Une cave', weather: 'pluie' });
    const videe = sceneEditee(editer(s, { geste: 'scene', patch: { scalaires: { desc: null } } }));
    expect(Object.keys(videe), 'le champ vidé reste au document').not.toContain('desc');
    expect(videe.weather).toBe('pluie');
    const remplie = sceneEditee(editer(s, { geste: 'scene', patch: { scalaires: { desc: 'Un grenier' } } }));
    expect([remplie.desc, remplie.weather]).toEqual(['Un grenier', 'pluie']);
  });
});

describe('sélection d’une zone d’effet — par son id', () => {
  const scene: Scene = { ...emptyScene('zones', 10, 4), effectZones: [zone('a', 0), zone('b', 4)] };

  it('une zone ajoutée ou retirée avant la zone sélectionnée laisse la même zone visée', () => {
    const s = editer(ouverteSur(scene), { geste: 'appui', point: point(4, 0) });
    const sel: Sel = s.sel;
    expect(sel).toEqual({ type: 'effectZone', id: 'b' });
    const ajoutee: Scene = { ...scene, effectZones: [zone('x', 8), ...scene.effectZones!] };
    expect(selRect(ajoutee, sel)).toEqual({ x: 4, y: 0, w: 2, h: 2 });
    expect(patchZone(ajoutee, sel, { nom: 'Cour' }).effectZones!.map((z) => z.label)).toEqual(['x', 'a', 'Cour']);
    const retiree: Scene = { ...scene, effectZones: [scene.effectZones![1]] };
    expect(patchZone(retiree, sel, { nom: 'Cour' }).effectZones!.map((z) => z.label)).toEqual(['Cour']);
  });

  it('changer l’identifiant de la zone la garde sélectionnée', () => {
    const s = editer(ouverteSur(scene), { geste: 'appui', point: point(4, 0) });
    const renommee = editer(s, { geste: 'identifier', id: ' cour ' });
    expect(renommee.sel).toEqual({ type: 'effectZone', id: 'cour' });
    const nommee = sceneEditee(editer(renommee, { geste: 'nommer', nom: 'La cour' }));
    expect(nommee.effectZones!.map((z) => [z.id, z.label])).toEqual([['a', 'a'], ['cour', 'La cour']]);
  });
});

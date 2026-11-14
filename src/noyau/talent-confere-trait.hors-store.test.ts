/**
 * Le Talent Haine confère le Trait Haine (LDB 10 l.548 ; LDB 21 l.39) sur le chemin réel : achat
 * (`acheterLeTalent`, `partyFlow.ts`) puis entrée de scène (`lancerLaScene`, psychologie de rencontre).
 * Flagellant Niveau 2 : Haine (Hérétiques), LDB 08 l.1718.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import type { Scene, SceneEntity } from './monde/scene';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  banc.setState({ battle: null, pendingCascade: null, scene: null, party: [] });
  banc.getState().ensemencerLeTirage(2);
});

const cultiste: SceneEntity = { id: 'cultiste', kind: 'personnage', pos: { x: 1, y: 1 }, statblock: { label: 'Cultiste', char: { B: 10 }, groups: ['cultiste'] } } as unknown as SceneEntity;
const scene = (id: string): Scene => ({
  id, nom: id, dimensions: { w: 4, h: 4 },
  layers: [{ z: 0, tiles: Array(16).fill('herbe') }], entities: [cultiste], dialogues: [], triggers: [], encounters: [], flags: {},
}) as unknown as Scene;

function flagellant2() {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'flagellant', label: 'Flagellant', seed: 1 });
  return { ...h, careerLevel: 2, xp: 1000 };
}

describe('Talent Haine (Hérétiques) : le Test de Haine est dû face à un cultiste', () => {
  it('témoin : sans le Talent, aucun Test de Psychologie', () => {
    banc.setState({ party: [flagellant2()] });
    banc.getState().lancerLaScene(scene('s0'));
    expect(banc.getState().pendingCascade).toBeNull();
  });
  it('le Talent acheté ouvre le Test de Haine à la rencontre', () => {
    const h = flagellant2();
    banc.setState({ party: [h] });
    banc.getState().acheterLeTalent(h.id, { id: 'haine', spec: 'heretiques' });
    expect(banc.getState().party[0].talents, 'précondition : le Talent est acquis').toContainEqual(expect.objectContaining({ talentId: 'haine', spec: 'heretiques' }));
    banc.getState().lancerLaScene(scene('s1'));
    expect(banc.getState().pendingCascade?.participants[0].psychologieDeRencontre).toMatchObject({ kind: 'haine', sourceId: 'cultiste' });
  });
});

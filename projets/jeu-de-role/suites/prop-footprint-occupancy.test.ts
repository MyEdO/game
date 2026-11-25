import { describe, it, expect } from 'vitest';
import { campagnes } from '../campagnes';
import { paquetDuJeu } from '../../../src/noyau/index';
import { occupantsDansUnDecor } from '../../../src/noyau/monde/occupantsDansUnDecor.testkit';

/** L'empreinte de TYPE sur les scènes des campagnes du jeu (`src/noyau/monde/occupantsDansUnDecor.testkit.ts`). */
describe('empreinte de TYPE — aucun corps ne naît dans un décor (campagnes livrées)', () => {
  const livrees = campagnes.flatMap((c) => paquetDuJeu(c).scenes.map((scene) => ({ source: c.id, scene })));

  it('le balayage porte sur les scènes des campagnes livrées', () => {
    expect(livrees.some((s) => s.source === 'la-diligence')).toBe(true);
  });

  it('aucune entité NON-prop ne se tient sur une case couverte par l’empreinte d’un prop', () => {
    expect(livrees.flatMap(({ source, scene }) => occupantsDansUnDecor(source, scene))).toEqual([]);
  });
});

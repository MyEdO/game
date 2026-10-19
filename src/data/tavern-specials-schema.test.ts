/**
 * Les SPÉCIAUX d'un jeu de taverne (NADJ 16 l.82) et la référence d'un PNJ joueur à son jeu se jugent
 * AU PARSE : `schema` de `schemas/defs/tavernGames.ts`, `sceneEntitySchema` de `schemas/defs-scenes/scene.ts`.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './schemas/defs/tavernGames';
import { sceneEntitySchema } from './schemas/defs-scenes/scene';
import tavernGames from './tavernGames.json';

const SOURCE = { book: 'nuits-agitees-et-dures-journees', page: 93, note: 'NADJ 16 l.82' };

/** Le catalogue, l'entrée `id` portant `specials` — les chemins d'issue rendus, sans le rang de l'entrée. */
function refus(id: string, specials: unknown[]): string[] {
  const rang = tavernGames.findIndex((g) => g.id === id);
  const jeux = tavernGames.map((g) => (g.id === id ? { ...structuredClone(g), specials } : g));
  const r = schema.safeParse(jeux);
  return r.success ? [] : r.error.issues.filter((i) => i.path[0] === rang).map((i) => i.path.slice(1).join('.'));
}

describe('tavernGames › specials — NADJ 16 l.82', () => {
  it('le catalogue tel qu’il est se parse, Spécial de l’Arène compris', () => {
    expect(schema.safeParse(tavernGames).success).toBe(true);
    expect(refus('arene', [{ effet: 'cran', hasTalent: 'tireur-d-elite', steps: 1, source: SOURCE }])).toEqual([]);
    expect(refus('arene', [{ effet: 'difficulte', hasTalent: 'tireur-d-elite', difficulty: 'facile', source: SOURCE }])).toEqual([]);
  });

  it('un Spécial sans Talent est refusé', () => {
    expect(refus('arene', [{ effet: 'cran', steps: 1, source: SOURCE }])).toEqual(['specials.0.hasTalent']);
  });

  it('un Talent hors catalogue est refusé', () => {
    expect(refus('arene', [{ effet: 'cran', hasTalent: 'talent-fantome', steps: 1, source: SOURCE }])).toEqual(['specials.0.hasTalent']);
  });

  it('chaque effet exige SON paramètre, et refuse celui de l’autre', () => {
    expect(refus('arene', [{ effet: 'cran', hasTalent: 'tireur-d-elite', source: SOURCE }])).toEqual(['specials.0.steps']);
    expect(refus('arene', [{ effet: 'cran', hasTalent: 'tireur-d-elite', steps: 1, difficulty: 'facile', source: SOURCE }])).toEqual(['specials.0.difficulty']);
    expect(refus('arene', [{ effet: 'difficulte', hasTalent: 'tireur-d-elite', steps: 1, source: SOURCE }])).toEqual(['specials.0.steps', 'specials.0.difficulty']);
  });

  it('un cran de 0 ne décale rien : refusé', () => {
    expect(refus('arene', [{ effet: 'cran', hasTalent: 'tireur-d-elite', steps: 0, source: SOURCE }])).toEqual(['specials.0.steps']);
  });

  it('un jeu qui ne se résout pas par un Test (sans `mode`) refuse tout Spécial', () => {
    expect(refus('al-zahr', [{ effet: 'cran', hasTalent: 'tireur-d-elite', steps: 1, source: SOURCE }])).toEqual(['specials']);
  });
});

describe('SceneEntity › tavernGame.gameId — résolu au catalogue des jeux de taverne', () => {
  const pnj = (gameId: string) => ({ id: 'j', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, tavernGame: { gameId } });

  it('un jeu du catalogue est admis', () => {
    expect(sceneEntitySchema.safeParse(pnj('dominos')).success).toBe(true);
  });

  it('un id mort est refusé au parse, à son chemin', () => {
    const r = sceneEntitySchema.safeParse(pnj('fantome'));
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path.join('.'))).toEqual(['tavernGame.gameId']);
  });
});

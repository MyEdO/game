/**
 * `descente.ts` — `enfantsDe` rend chaque enfant que le parse exécute, un `z.lazy` y descend par
 * l'instance que le parse exécute, et `descendre` visite chaque nœud une fois, au plus court.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defDe, descendre, enfantsDe } from './descente';

const segments = (s: unknown) => enfantsDe(s).map((e) => e.segment);

describe('`defDe`/`enfantsDe` — la forme d’un nœud zod, segments compris', () => {
  it('objet, liste, et ce qui n’est pas un nœud', () => {
    const objet = z.object({ a: z.string(), b: z.number() });
    expect(defDe(objet)?.type).toBe('object');
    expect(segments(objet)).toEqual(['.a', '.b']);
    expect(segments(z.array(z.string()))).toEqual(['[]']);
    expect(defDe('pas un nœud')).toBeUndefined();
    expect(enfantsDe('pas un nœud')).toEqual([]);
  });

  it('les enfants hors `shape` que le parse exécute : `catchall`, clé de record, intersection, reste de tuple', () => {
    const cle = z.enum(['a', 'b']);
    const valeur = z.number();
    expect(enfantsDe(z.record(cle, valeur)).map((e) => [e.segment, e.noeud])).toEqual([
      ['{clé}', cle],
      ['{}', valeur],
    ]);
    const autres = z.boolean();
    expect(segments(z.object({ a: z.string() }).catchall(autres))).toEqual(['.a', '.*']);
    expect(enfantsDe(z.object({}).catchall(autres))[0]?.noeud).toBe(autres);
    const gauche = z.object({ a: z.string() });
    const droite = z.object({ b: z.string() });
    expect(enfantsDe(z.intersection(gauche, droite)).map((e) => [e.segment, e.noeud])).toEqual([
      ['&0', gauche],
      ['&1', droite],
    ]);
    const reste = z.string();
    expect(enfantsDe(z.tuple([z.number()], reste)).map((e) => [e.segment, e.noeud])).toEqual([
      ['[0]', expect.anything()],
      ['[...]', reste],
    ]);
  });

  it('un `z.lazy` descend par l’instance que le PARSE exécute (`_zod.innerType`), la même à chaque appel', () => {
    const lazy = z.lazy(() => z.object({ n: z.number() }));
    const [cible] = enfantsDe(lazy);
    expect(cible.segment).toBe('');
    expect(enfantsDe(lazy)[0].noeud).toBe(cible.noeud);
    lazy.parse({ n: 1 });
    expect(cible.noeud).toBe((lazy as unknown as { _zod: { innerType: unknown } })._zod.innerType);
  });

  it('un `z.lazy` dont le getter lève ne rend aucun enfant', () => {
    const casse = z.lazy((): z.ZodString => {
      throw new Error('getter');
    });
    expect(enfantsDe(casse)).toEqual([]);
  });
});

describe('`descendre` — largeur d’abord, chaque nœud une fois', () => {
  it('un schéma récursif (`z.lazy`) s’arrête sur lui-même', () => {
    type Arbre = { enfants: Arbre[] };
    const arbre: z.ZodType<Arbre> = z.lazy(() => z.object({ enfants: z.array(arbre) }));
    const vus: string[] = [];
    descendre([arbre], ({ def, path }) => void vus.push(`${def.type}@${path}`));
    expect(vus).toEqual(['lazy@', 'object@', 'array@.enfants']);
  });

  it('une instance partagée est visitée une fois, sous son chemin le plus COURT', () => {
    const partage = z.string();
    const racine = z.object({ a: z.object({ b: partage }), c: partage });
    const paths: string[] = [];
    descendre([racine], ({ noeud, path }) => void (noeud === partage && paths.push(path)));
    expect(paths).toEqual(['.c']);
  });

  it('`elaguer` coupe le sous-arbre, `arreter` finit la descente, `racine` nomme la racine d’origine', () => {
    const feuille = z.number();
    const r0 = z.object({ x: z.object({ y: feuille }) });
    const r1 = z.object({ z: z.string() });
    const elague: string[] = [];
    descendre([r0, r1], ({ path, racine, profondeur }) => {
      elague.push(`${racine}${path}`);
      if (profondeur >= 1) return 'elaguer';
    });
    expect(elague).toEqual(['0', '1', '0.x', '1.z']);
    const arrete: string[] = [];
    descendre([r0, r1], ({ path, racine }) => {
      arrete.push(`${racine}${path}`);
      if (path === '.x') return 'arreter';
    });
    expect(arrete).toEqual(['0', '1', '0.x']);
  });
});

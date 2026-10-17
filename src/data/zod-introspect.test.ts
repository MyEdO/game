import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { choixDeclares, introspecterDefs } from '../../scripts/docs/lib/zod-introspect.mjs';
import type { SchemaDef } from './schemas/types';
import { declarerEnfants } from './schemas/grammaire/descente';

/** Schéma récursif par les SEULS nœuds que traversent les relevés par valeur (`array`, `union`,
 *  `lazy`), sans `object` sur la boucle. */
const boucle: z.ZodType = z.lazy(() => z.union([z.literal('feuille'), z.array(boucle)]));

describe('zod-introspect — coupe de CYCLE des relevés par valeur (#1473)', () => {
  const temoin = (schema: z.ZodType): SchemaDef[] => [{ file: 'temoin.json', root: 'src/data', famille: 'config', schema } as SchemaDef];

  it('`introspecterDefs` termine sur une boucle sans objet, et la nomme', () => {
    const [def] = introspecterDefs(temoin(z.object({ arbre: boucle })));
    expect(def.cles.arbre).toContain('(cycle)');
  });

  it('`choixDeclares` termine sur la même boucle et rend ses littéraux', () => {
    const choix = choixDeclares(temoin(z.object({ arbre: boucle })));
    expect([...(choix.get('temoin.json')?.get('arbre') ?? [])]).toEqual(['feuille']);
  });

  it('un nœud PARTAGÉ par deux clés se relit sous chacune (identité sur le chemin, pas par appel)', () => {
    const partage = z.enum(['a', 'b']);
    const [def] = introspecterDefs(temoin(z.object({ x: z.array(partage), y: z.array(partage) })));
    expect(def.cles).toEqual({ x: 'array<enum(2)>', y: 'array<enum(2)>' });
    const choix = choixDeclares(temoin(z.object({ x: z.array(partage), y: z.array(partage) })));
    expect([...(choix.get('temoin.json')?.get('y') ?? [])]).toEqual(['a', 'b']);
  });

  it('les payloads virtuels d’op ne changent pas les choix physiques du document porteur', () => {
    const physique = z.object({ kind: z.literal('document'), direct: z.enum(['a', 'b']) });
    const virtuel = z.unknown();
    const schema = z.object({ physique, op: virtuel });
    const avant = choixDeclares(temoin(schema));
    declarerEnfants(virtuel, [{ noeud: z.object({ kind: z.literal('op'), target: z.literal('fantome') }), segment: '|op' }], () => [], 'payloads-op');
    const apres = choixDeclares(temoin(schema));
    expect(apres).toEqual(avant);
    expect([...(apres.get('temoin.json')?.get('direct') ?? [])]).toEqual(['a', 'b']);
    expect([...(apres.get('temoin.json')?.get('kind') ?? [])]).toEqual(['document']);
    expect(apres.get('temoin.json')?.has('target')).toBe(false);
  });
});

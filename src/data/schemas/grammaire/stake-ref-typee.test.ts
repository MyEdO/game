/** #2968 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import night from '../../night-stakes.json';
import voyage from '../../voyage-stakes.json';
import flow from '../../flow-stakes.json';
import combat from '../../combat-stakes.json';
import activities from '../../activities.json';
import etats from '../../etats.json';
import weather from '../../weather.json';
import { schema as nightSchema } from '../defs/night-stakes';
import { schema as voyageSchema } from '../defs/voyage-stakes';
import { schema as combatSchema } from '../defs/combat-stakes';
import { catalogStakeSchema } from './mecanique';
import { declarationDeRefTypee, refTypee } from './ref';
import { entryCategorySchema, typeDEnjeuSchema } from './valeurs';
import { metaDesChamps, nommerNoeud } from './meta';
import { enfantsDe } from './descente';

const cle = catalogStakeSchema.shape.key;

const connues = [
  { id: night[0].id, type: 'night' },
  { id: voyage[0].id, type: 'voyage' },
  { id: weather.conditions[0].id, type: 'weather' },
  { id: flow[0].id, type: 'flow' },
  { id: activities[0].id, type: 'activity' },
  { id: combat[0].id, type: 'combat' },
  { id: etats[0].id, type: 'etat' },
];

describe('référence typée d’un enjeu de catalogue', () => {
  it('résout les sept catalogues et déclare leur vocabulaire unique', () => {
    for (const key of connues) expect(catalogStakeSchema.parse({ key })).toEqual({ key });
    expect(declarationDeRefTypee(cle)?.types).toEqual(['night', 'voyage', 'weather', 'flow', 'activity', 'combat', 'etat']);
  });

  it('refuse un identifiant inconnu dans chaque catalogue', () => {
    for (const key of connues) expect(cle.safeParse({ ...key, id: 'enjeu-inconnu-2968' }).success).toBe(false);
  });

  it('résout dans le catalogue nommé par le type, même avec des homonymes', () => {
    expect(cle.safeParse({ id: 'recovery', type: 'night' }).success).toBe(true);
    expect(cle.safeParse({ id: 'recovery', type: 'voyage' }).success).toBe(false);
    expect(cle.safeParse({ id: 'exposure', type: 'night' }).success).toBe(true);
    expect(cle.safeParse({ id: 'exposure', type: 'voyage' }).success).toBe(true);
    expect(cle.safeParse({ id: 'recovery', type: 'creature' }).success).toBe(false);
  });

  it('valide chaque référence d’une liste et refuse les anciennes clés', () => {
    const liste = z.array(catalogStakeSchema);
    expect(liste.parse(connues.map((key) => ({ key })))).toHaveLength(7);
    expect(liste.safeParse([{ key: connues[0] }, { key: { id: 'recovery', type: 'voyage' } }]).success).toBe(false);
    expect(cle.safeParse({ dataset: 'night', kind: 'recovery' }).success).toBe(false);
    expect(cle.safeParse({ id: 'recovery', type: 'night', kind: 'recovery' }).success).toBe(false);
    expect(cle.safeParse('recovery').success).toBe(false);
  });

  it('conserve les champs supplémentaires, leurs types et leurs métadonnées', () => {
    const schema = refTypee(typeDEnjeuSchema, {
      count: nommerNoeud(z.number(), { nom: 'quantité' }),
      entryCategory: entryCategorySchema,
    });
    const sortie = schema.parse({ id: 'recovery', type: 'night', count: 2, entryCategory: 'skills' });
    expectTypeOf(sortie.count).toEqualTypeOf<number>();
    expectTypeOf(sortie.entryCategory).toEqualTypeOf<string | undefined>();
    expect(sortie).toEqual({ id: 'recovery', type: 'night', count: 2, entryCategory: 'skills' });
    expect(schema.safeParse({ id: 'recovery', type: 'night', count: '2' }).success).toBe(false);
    const branches = enfantsDe(schema);
    expect(branches).toHaveLength(7);
    for (const { noeud } of branches) {
      expect(metaDesChamps(noeud)?.count?.label).toBe('quantité');
      expect(metaDesChamps(noeud)?.entryCategory?.label).toBe('catégorie d’entrée');
    }
    expect(cle.parse({ id: 'recovery', type: 'night', entryId: 'abc', entryCategory: 'skills' })).toEqual({ id: 'recovery', type: 'night', entryId: 'abc', entryCategory: 'skills' });
    const branchesDuCatalogue = enfantsDe(cle);
    expect(branchesDuCatalogue).toHaveLength(7);
    for (const { noeud } of branchesDuCatalogue) {
      expect(metaDesChamps(noeud)?.entryId?.texte).toEqual({ regime: 'technique' });
      expect(metaDesChamps(noeud)?.entryCategory?.texte).toEqual({ regime: 'technique' });
    }
  });

  it('réserve id et type dans les champs supplémentaires', () => {
    expect(() => {
      // @ts-expect-error #2968
      refTypee(typeDEnjeuSchema, { id: nommerNoeud(z.string(), { nom: 'identifiant substitué' }) });
    }).toThrow('refTypee : champ réservé dans extra : id');
    expect(() => {
      // @ts-expect-error #2968
      refTypee(typeDEnjeuSchema, { type: nommerNoeud(z.string(), { nom: 'type substitué' }) });
    }).toThrow('refTypee : champ réservé dans extra : type');
  });

  it('les entrées de nuit, voyage et combat refusent une deuxième identité kind', () => {
    for (const [schema, donnees] of [[nightSchema, night], [voyageSchema, voyage], [combatSchema, combat]] as const) {
      expect(schema.safeParse(donnees).success).toBe(true);
      expect(schema.safeParse(donnees.map((entree, i) => i === 0 ? { ...entree, kind: entree.id } : entree)).success).toBe(false);
    }
  });
});

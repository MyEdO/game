import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { choixDeclares, choixDesPayloadsDOp, introspecterDefs } from '../../scripts/docs/lib/zod-introspect.mjs';
import { scannerDonnees } from '../../scripts/docs/lib/structures-scan.mjs';
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

describe('choix des payloads d’op : un enum se ferme À SA POSITION (op, champ), sauf s’il recopie un espace d’ids (#2818)', () => {
  // `mode` : vocabulaire PROPRE (`all` n'est l'id d'aucun document) dont `melee` est homonyme d'un id
  // d'`axes.json` ; `char` : enum dont TOUS les littéraux sont des ids de `caracs.json`.
  const OPS = {
    sonde: z.strictObject({ op: z.literal('sonde'), mode: z.enum(['melee', 'ranged', 'all']), char: z.enum(['force', 'endurance']) }),
  };
  const ESPACES = { 'axes.json': ['melee', 'tir'], 'caracs.json': ['force', 'endurance', 'agilite'] };
  const dossier = mkdtempSync(join(tmpdir(), 'choix-payloads-op-'));
  afterAll(() => rmSync(dossier, { recursive: true, force: true }));
  mkdirSync(join(dossier, 'src/data'), { recursive: true });
  mkdirSync(join(dossier, 'src/scenes'), { recursive: true });
  cpSync(fileURLToPath(new URL('./schemas/grammaire', import.meta.url)), join(dossier, 'src/data/schemas/grammaire'), { recursive: true });
  writeFileSync(join(dossier, 'src/data/axes.json'), JSON.stringify(ESPACES['axes.json'].map((id) => ({ id, maison: 'sonde' }))));
  writeFileSync(join(dossier, 'src/data/caracs.json'), JSON.stringify(ESPACES['caracs.json'].map((id) => ({ id, maison: 'sonde' }))));
  writeFileSync(
    join(dossier, 'src/data/porteurs.json'),
    JSON.stringify(
      ['un', 'deux', 'trois'].map((id) => ({ id, maison: 'sonde', passive: [{ op: 'sonde', mode: 'melee', char: 'force', amount: 1 }] })),
    ),
  );
  const fixture = scannerDonnees(dossier, [], new Map(), choixDesPayloadsDOp(OPS, ESPACES));
  const cles = (id: string) => {
    const porteur = (fixture.brutParNom.get('porteurs.json') as Array<{ id: string; passive: object[] }>).find((e) => e.id === id)!;
    return [...(fixture.referencesParPorteur.get(porteur.passive[0])?.keys() ?? [])];
  };

  it('un VOCABULAIRE PROPRE déclaré au payload n’ouvre pas de référence, même homonyme d’un id', () => {
    for (const id of ['un', 'deux', 'trois'])
      expect(cles(id), '`mode: "melee"` de l’op `sonde` est un littéral de son enum, pas une FK vers `axes.json`.').not.toContain('mode');
  });

  it('un enum qui RECOPIE un espace d’ids reste une référence', () => {
    for (const id of ['un', 'deux', 'trois'])
      expect(cles(id), '`char: "force"` recopie `caracs.json` : la valeur reste une référence comptée.').toEqual(['char']);
  });
});

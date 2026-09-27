/**
 * Contrats de la COLLECTION À CLÉ (#1897, #1463) — la marque que pose `marquerCollection`, les
 * collections perdues (`collectionsPerdues`), la rencontre de la co-descente et de la descente unique
 * (`descendre`), la complétude du schéma de projet, l'unicité prouvée à la porte, et la CLÉ DE
 * COLLECTION relevée par la co-descente (`collectionsDesDocuments`).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { SCHEMA_DEFS } from '../_registry.generated';
import { SCHEMA_DEFS_SCENES } from '../_registry-scenes.generated';
import { DATASET_FICHIER_DERIVE } from '../exposition-derivee';
import { DATASET_KEYS, datasetArray } from '../../overrides';
import { scanDuCorpus } from '../../../../scripts/docs/lib/structures-scan.mjs';
import { projetSchema } from '../defs-scenes/projet';
import { sceneSchema } from '../defs-scenes/scene';
import { validateDocument, cheminLisible } from '../validate';
import { parseProject, ProjetRefuse } from '../../../state/worldMap';
import areneProjet from '../../../scenes/arene/arene-projet.json';
import { collectionDe, collectionsDesDocuments, collectionsPerdues, collectionsRetrouvees, listeCle, marquerCollection, marqueDeRecord, type MarqueDeCollection } from './collection-cle';
import { descendre, enfantsDe, ouverts } from './descente';
import { idDe } from './ref';

const nomDeMarque = (m: MarqueDeCollection | undefined): string | undefined => (m?.forme === 'liste' ? m.nom : m?.sous);
const nomDe = (n: unknown): string | undefined => nomDeMarque(collectionDe(n));

describe('anti-perte — le seul détecteur du zéro SILENCIEUX', () => {
  it('une liste à clé `.superRefine`-ée HORS fabrique perd sa marque : le clone garde le contrôle, `collectionsPerdues` le nomme', () => {
    const liste = listeCle(z.strictObject({ id: z.string() }), 'id');
    const clone = liste.superRefine(() => undefined);
    expect(nomDe(liste)).toBe('id');
    expect(collectionDe(clone)).toBeUndefined();
    expect(collectionsRetrouvees(z.strictObject({ l: clone }))).toEqual(new Set());
    expect(collectionsPerdues(z.strictObject({ l: clone.min(1) })).map(nomDeMarque)).toEqual(['id']);
    expect(collectionsRetrouvees(z.strictObject({ l: liste.optional() }))).toEqual(new Set([liste]));
    expect(collectionsPerdues(z.strictObject({ l: liste.optional() }))).toEqual([]);
  });

  it('les defs des DEUX racines ne perdent AUCUNE collection à clé', () => {
    const defs = [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES];
    expect(defs.reduce((n, { schema }) => n + collectionsRetrouvees(schema).size, 0), 'aucune collection à clé : la garde ne mesurerait rien').toBeGreaterThan(0);
    const perdues = defs.flatMap(({ file, schema }) => collectionsPerdues(schema).map((m) => `${file} : ${nomDeMarque(m)}`));
    expect(perdues, 'collection(s) à clé clonée(s) hors fabrique (`.min`/`.refine` APRÈS `marquerCollection`) : leur clé ne nomme plus rien').toEqual([]);
  });
});

/**
 * Listes d'objets du schéma de projet dont l'élément déclare `id` SANS en être l'identité : l'`id` y
 * DÉSIGNE une entrée d'un autre document (référence de catalogue), la liste n'a pas de clé propre.
 * Clé = chemin de la marche, branches d'union effacées.
 */
const LISTES_DE_REFERENCES: Readonly<Record<string, string>> = {
  '.scenes[].triggers[].when.of[]': 'conditions composées : `id` d’un objet/talent désigné',
  '.scenes[].entities[].statblock.traits[]': 'références de Traits (`traits.json`)',
  '.scenes[].entities[].statblock.skills[]': 'références de Compétences (`skills.json`)',
  '.scenes[].entities[].statblock.talents[]': 'références de Talents (`talents.json`)',
  '.scenes[].entities[].upgrades[]': 'références d’Améliorations navales (`naval-traits.json`)',
  '.scenes[].entities[].combat.skills[]': 'références de Compétences (`skills.json`)',
  '.narratif.cloture.when.of[]': 'conditions composées : `id` d’un objet/talent désigné',
  '.worldMap.routes[].perils[].effects[]': 'effets de scène : `id` d’une cible désignée',
  '.narratif.presetsPnj[].profil.traits[]': 'références de Traits (`traits.json`)',
  '.narratif.presetsPnj[].profil.optionals[]': 'références de Traits optionnels (`traits.json`)',
  '.narratif.presetsPnj[].profil.optionals[].grant[]': 'octrois : `id` de Compétence/Talent désigné',
  '.narratif.presetsPnj[].profil.skills[]': 'références de Compétences (`skills.json`)',
  '.narratif.presetsPnj[].profil.talents[]': 'références de Talents (`talents.json`)',
  '.narratif.presetsPnj[].profil.trappings[]': 'références de Possessions (`trappings.json`)',
  '.narratif.presetsPnj[].profil.trappings[].qualities[]': 'références d’Atouts/Défauts (`qualities.json`)',
  '.narratif.presetsPnj[].profil.trappings[].choice[]': 'références de Possessions (`trappings.json`)',
};

/** Clés d'objet d'un élément de liste, à travers enveloppes ET branches d'union (`ouverts`). */
function clesDeLElement(noeud: unknown): string[] {
  return [...new Set(ouverts([noeud]).flatMap((n) => enfantsDe(n).flatMap((e) => (e.cle === undefined ? [] : [e.cle]))))];
}

/** Listes d'objets du schéma dont l'élément déclare `id`, avec leur chemin et leur marque de clé. */
function listesAId(schema: unknown): { chemin: string; cle?: string }[] {
  const out: { chemin: string; cle?: string }[] = [];
  descendre([schema], ({ noeud, def, path }) => {
    if (def.type === 'array' && clesDeLElement(enfantsDe(noeud).find((e) => e.segment === '[]')?.noeud).includes('id')) out.push({ chemin: `${path.replace(/\|\d+/g, '')}[]`, cle: nomDe(noeud) });
  });
  return out;
}

describe('complétude — toute liste d’objets à `id` du schéma de projet DÉCLARE sa clé, ou se dit liste de RÉFÉRENCES', () => {
  const listes = listesAId(projetSchema);

  it('la marche VOIT les listes à `id` (une marche aveugle rendrait la garde vacueuse)', () => {
    expect(listes.map((l) => l.chemin)).toEqual(expect.arrayContaining(['.scenes[]', '.scenes[].entities[]', '.narratif.affaires[]']));
  });

  it('aucune liste à `id` n’est muette : clé déclarée par `listeCle`, ou exemption NOMMÉE', () => {
    const muettes = listes.filter((l) => l.cle === undefined && !(l.chemin in LISTES_DE_REFERENCES)).map((l) => l.chemin);
    expect(muettes, 'liste(s) d’objets à `id` sans clé : l’envelopper dans `listeCle(…, \'id\')` à son def, ou l’exempter comme liste de RÉFÉRENCES').toEqual([]);
  });

  it('une exemption ne couvre qu’une liste RÉELLE et SANS clé : la liste des références ne peut que décroître', () => {
    const parChemin = new Map(listes.map((l) => [l.chemin, l.cle]));
    const mortes = Object.keys(LISTES_DE_REFERENCES).filter((c) => !parChemin.has(c) || parChemin.get(c) !== undefined);
    expect(mortes).toEqual([]);
  });
});

describe('unicité PROUVÉE à la porte — un id répété dans une liste à clé est refusé, l’id nommé', () => {
  type Carte = { id: string; label: string; places: unknown[]; routes: unknown[] };
  type Doc = { scenes: Record<string, unknown[]>[]; worldMap?: Carte };
  const doublon = (muter: (d: Doc) => void): Doc => {
    const d = structuredClone(areneProjet) as unknown as Doc;
    muter(d);
    return d;
  };
  const repete = <T,>(liste: T[]): void => {
    liste.push(structuredClone(liste[0]));
  };
  const lieu = { id: 'lieu-1', label: 'Lieu', pos: { x: 1, y: 1 }, scene: 'arene-zone1' };
  const route = { id: 'route-1', a: 'lieu-1', b: 'lieu-1', km: 1, modes: ['pied'] };
  const noeud = { id: 'n1', desc: 'x', choices: [] };
  const CAS: [string, (d: Doc) => void, string][] = [
    ['une entité', (d) => repete(d.scenes[0].entities), 'entities'],
    ['un déclencheur', (d) => { d.scenes[0].triggers = [{ id: 't1', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: { kind: 'seq', steps: [] } }]; repete(d.scenes[0].triggers); }, 'triggers'],
    ['un nœud de dialogue', (d) => { d.scenes[0].dialogues = [{ id: 'd1', start: 'n1', nodes: [noeud, noeud] }]; }, 'nodes'],
    ['un lieu', (d) => { d.worldMap = { id: 'carte', label: 'Carte', places: [lieu, lieu], routes: [] }; }, 'places'],
    ['une route', (d) => { d.worldMap = { id: 'carte', label: 'Carte', places: [lieu], routes: [route, route] }; }, 'routes'],
  ];

  it.each(CAS)('%s en double : `projetSchema` et `parseProject` la refusent', (_nom, muter, liste) => {
    const doc = doublon(muter);
    const fautes = validateDocument(projetSchema, doc);
    expect(fautes?.map((f) => `${cheminLisible(f.lieu)}: ${f.message}`)).toEqual([expect.stringMatching(new RegExp(`${liste} « [^»]+ »: « [^»]+ » dupliqué`))]);
    let refus: unknown;
    try {
      parseProject(doc);
    } catch (e) {
      refus = e;
    }
    expect(refus).toBeInstanceOf(ProjetRefuse);
    expect((refus as ProjetRefuse).fautes.map((f) => f.code)).toEqual(['custom']);
  });

  it('`sceneSchema` seul refuse une entité répétée (la scène VIVANTE de l’éditeur passe par lui)', () => {
    const scene = doublon((d) => repete(d.scenes[0].entities)).scenes[0];
    expect(validateDocument(sceneSchema, scene)?.map((f) => f.message)).toEqual([expect.stringMatching(/dupliqué : « id » identifie l’élément/)]);
  });
});

describe('`espace` — jamais sur une liste de RÉFÉRENCES', () => {
  const skill = z.strictObject({ id: idDe('skill') });

  it('refusé à la construction quand la clé d’élément est une feuille `idDe`, liste comme record', () => {
    expect(() => listeCle(skill, 'id', { espace: {} })).toThrow(/`espace` refusé — la clé « id » est une feuille `idDe`/);
    expect(() => marquerCollection(z.record(idDe('skill'), z.number()), marqueDeRecord({ espace: {} }))).toThrow(/la clé de record est une feuille `idDe`/);
    expect(() => marquerCollection(z.strictObject({ entries: z.record(idDe('skill'), z.number()) }), marqueDeRecord({ sous: 'entries', espace: {} }))).toThrow(
      /la clé de record est une feuille `idDe`/,
    );
  });

  it('une clé d’UNICITÉ sur une référence reste admise sans `espace` (`members`, `stations`)', () => {
    expect(collectionDe(listeCle(skill, 'id'))?.espace).toBeUndefined();
  });
});

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const { defs: DEFS, scan } = scanDuCorpus(ROOT);
const COLLECTIONS = collectionsDesDocuments(DEFS, scan.brutParNom);
const ESPACES = COLLECTIONS.filter((c) => c.marque.espace);
const trie = (ids: readonly string[]) => [...ids].sort();

describe('co-descente ⇄ descente — une collection relevée dans la donnée est une collection que la descente du schéma retrouve', () => {
  it('toute collection relevée par la co-descente est retrouvée par `collectionsRetrouvees` sur le def de son document', () => {
    expect(COLLECTIONS.length, 'aucune collection relevée : la preuve serait vacante').toBeGreaterThan(0);
    const retrouvees = new Map<string, Set<MarqueDeCollection | undefined>>();
    for (const { file, schema } of DEFS) {
      const marques = retrouvees.get(file) ?? retrouvees.set(file, new Set()).get(file)!;
      for (const n of collectionsRetrouvees(schema)) marques.add(collectionDe(n));
    }
    const invisibles = COLLECTIONS.filter((c) => !retrouvees.get(c.dataset)?.has(c.marque)).map((c) => c.cle);
    expect(invisibles, 'collection(s) relevée(s) dans la donnée que la descente ne voit pas').toEqual([]);
  });
});

describe('clé de collection — la co-descente re-dérive les racines, les catégories nichées et les spécialisations', () => {
  it('les ESPACES de racine sont exactement les documents `entite`/`record` de `src/data`', () => {
    const racines = ESPACES.filter((c) => !c.cle.includes('#'));
    expect(trie(racines.map((c) => c.cle))).toEqual(trie(SCHEMA_DEFS.filter((d) => d.famille !== 'config').map((d) => d.file)));
  });

  it('chaque catégorie nichée est UNE collection mesurée, keyée par sa clé de collection, à l’identité de son tableau vivant', async () => {
    /** Clé de collection du tableau `cible` dans la racine du fichier, trouvée par IDENTITÉ d'objet. */
    const chercher = (v: unknown, cible: unknown, cle: string): string | undefined => {
      if (v === cible) return cle;
      if (!v || typeof v !== 'object') return undefined;
      if (Array.isArray(v)) {
        for (const e of v) {
          const r = chercher(e, cible, `${cle}[${(e as { id?: string }).id}]`);
          if (r) return r;
        }
        return undefined;
      }
      for (const [k, w] of Object.entries(v)) {
        const r = chercher(w, cible, cle ? `${cle}.${k}` : k);
        if (r) return r;
      }
      return undefined;
    };
    /** La racine VIVANTE d'un fichier : le module JSON que `overrides.ts` importe, pas une relecture du disque. */
    const racines = new Map<string, unknown>();
    for (const fichier of new Set(Object.values(DATASET_FICHIER_DERIVE)))
      racines.set(fichier, ((await import(`../../${fichier.replace(/\.json$/, '')}.json`)) as { default: unknown }).default);
    const nichees = DATASET_KEYS.flatMap((k) => {
      const fichier = DATASET_FICHIER_DERIVE[k];
      const tableau = datasetArray(k);
      const racine = fichier === undefined ? undefined : racines.get(fichier);
      return racine === undefined || racine === tableau ? [] : [{ k, attendue: `${fichier}#${chercher(racine, tableau, '')}`, tableau }];
    });
    expect(nichees).toHaveLength(54);
    const fichiersNiches = new Set(nichees.map(({ attendue }) => attendue.split('#')[0]));
    const mesurees = collectionsDesDocuments(DEFS, new Map([...racines].filter(([f]) => fichiersNiches.has(f))));
    const parTableau = nichees.map(({ k, tableau }) => [k, mesurees.filter((c) => c.valeur === tableau).map((c) => c.cle)]);
    expect(parTableau).toEqual(nichees.map(({ k, attendue }) => [k, [attendue]]));
    expect(parTableau).toContainEqual(['criticalsTete', ['criticals.json#[criticals-ldb-tete].entries']]);
  });

  it('les `specs` d’une Compétence ou d’un Talent sont l’espace `fichier#[id].specs`, aux ids de la donnée', () => {
    const specs = ESPACES.filter((c) => c.cle.endsWith('.specs'));
    const attendues = ['skills.json', 'talents.json'].flatMap((f) =>
      (scan.brutParNom.get(f) as { id: string; specs?: { id: string }[] }[])
        .filter((e) => e.specs)
        .map((e) => [`${f}#[${e.id}].specs`, trie(e.specs!.map((s) => s.id))]),
    );
    expect(attendues.filter(([, ids]) => ids.length > 0).length, 'aucune spécialisation inline : la preuve serait vacante').toBeGreaterThan(0);
    expect(specs.map((c) => [c.cle, trie(c.ids)])).toEqual(attendues);
  });

  it('un espace de noms sous une liste NON marquée n’a pas de clé stable : la co-descente lève en nommant la liste', () => {
    const schema = z.strictObject({ lots: z.array(z.strictObject({ items: listeCle(z.strictObject({ id: z.string() }), 'id', { espace: {} }) })) });
    const def = { file: 'fixture.json', root: 'data', schema, famille: 'config' } as unknown as (typeof DEFS)[number];
    expect(() => collectionsDesDocuments([def], new Map([['fixture.json', { lots: [{ items: [{ id: 'a' }] }] }]]))).toThrow(
      /^fixture\.json — clé d'espace : l'espace de noms « lots\.0\.items » est sous la liste NON marquée « lots »/,
    );
  });

  it('une collection d’unicité seule sous une liste non marquée s’écrit `[]`, sans lever', () => {
    const schema = z.strictObject({ lots: z.array(z.strictObject({ items: listeCle(z.strictObject({ id: z.string() }), 'id') })) });
    const def = { file: 'fixture.json', root: 'data', schema, famille: 'config' } as unknown as (typeof DEFS)[number];
    const [c] = collectionsDesDocuments([def], new Map([['fixture.json', { lots: [{ items: [{ id: 'a' }] }] }]]));
    expect([c.cle, c.ids]).toEqual(['fixture.json#lots[].items', ['a']]);
  });
});

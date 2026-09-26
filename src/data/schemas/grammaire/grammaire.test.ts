/**
 * Contrats de la GRAMMAIRE de document (#1466 L1a) — ce que les fabriques `document()` et `ref()`
 * garantissent PAR CONSTRUCTION, verrouillé au TYPE et au RUNTIME.
 *
 * Les cas POSITIFS sont bâtis sur des entrées RÉELLES de `src/data/*.json` (jamais un id inventé) :
 * ils prouvent du même coup que le registre généré `_ids.generated.ts` et la donnée s'accordent.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../../../scripts/guards/lib/lister.mjs';
import { z } from 'zod';
import skillsJson from '../../skills.json';
import talentsJson from '../../talents.json';
import tablesJson from '../../tables.json';
import { document, CLES_ENVELOPPE, CLES_EXIGIBLES, META_CHARGE, optionsEnum, type Exposition, type CleExigible } from './document';
import { libelleDeValeur, valeursDe } from './meta';
import { descRefSchema, enumNomme, sourceRefSchema } from './valeurs';
import { proseAdressable, versDisque } from './prose';
import { PROSE_INLINE_TOLEREE } from './prose-inline';
import type { DescRef as DescRefParseur } from '../../source/decoupe';
import { ref, refs, specRef, pick, typedRef, idDe, cibleDe, estSpecialisable, TYPES, type Id } from './ref';
import { byId, type SkillData, type TypeResolu } from '../../index';
import { avancement } from './avancement';
import { slotsDe } from './slots';
import { SANS_LIVRE } from './sans-livre';
import { SCHEMA_DEFS } from '../_registry.generated';
import { IDS_PAR_DATASET } from '../_ids.generated';
import { poserSourceDIdsVivants } from './idsVivants';

type EntreeASpecs = { id: string; specs?: { id: string }[]; specsSource?: string };
const UNE_COMPETENCE = skillsJson[0] as { id: string };
const UNE_COMPETENCE_GROUPEE = (skillsJson as EntreeASpecs[]).find((s) => s.specs?.length)!;
const UN_TALENT_A_SPECS = (talentsJson as EntreeASpecs[]).find((t) => t.specs?.length)!;
const UNE_TABLE = tablesJson[0] as { id: string };
const declareDesSpecs = (e: EntreeASpecs) => !!(e.specs?.length || e.specsSource);

const SOURCE_REELLE = { book: 'livre-de-base', page: 118 };
/** Livre VF RÉEL dont `books.json` ne porte AUCUN `dir` : rien n'est extrait, donc rien n'est
 *  adressable — une prose y reste inline légitimement (verrou V3, `grammaire/prose.ts`).
 *  Fixture SYNTHÉTIQUE : `page: 1` est un remplissage de forme, PAS une citation — aucun folio de ce
 *  livre n'est allégué ici. Le livre, lui, est bien VF (CLAUDE.md § Sources VF : la VO ne se cite pas). */
const SOURCE_SANS_EXTRACTION = { book: 'boite-d-initiation', page: 1 };
const EXPOSITION: Exposition = { codex: { keys: ['talents'] }, edit: { dataset: 'talents.json' } };

describe('document() — enveloppe posée par la fabrique', () => {
  const fiche = document(
    'talent',
    'entite',
    { max: z.number(), tests: z.string().optional() },
    { max: { label: 'Maximum' }, tests: { label: 'Tests', hint: 'Compétences concernées' } },
    EXPOSITION,
  );
  const DOC_COMPLET = { id: 'ambidextre', type: 'talent', label: 'Ambidextre', source: SOURCE_REELLE, max: 2 };

  it('rend un handle FERMÉ (type, famille, méta, exposition) dont le schéma parse un document complet', () => {
    expect(fiche.type).toBe('talent');
    expect(fiche.famille).toBe('entite');
    expect(fiche.meta.max.label).toBe('Maximum');
    expect(fiche.exposition).toEqual(EXPOSITION);
    expect(fiche.variantes).toEqual([]);
    expect(fiche.entree.safeParse(DOC_COMPLET).success).toBe(true);
  });

  it('refuse un champ inconnu (strictObject) et un document sans `source`', () => {
    expect(fiche.entree.safeParse({ id: 'a', type: 'talent', label: 'A', source: SOURCE_REELLE, inconnu: 1 }).success).toBe(false);
    expect(fiche.entree.safeParse({ id: 'a', type: 'talent', label: 'A', max: 2 }).success).toBe(false);
  });

  it('rend `source` optionnelle pour un type de la liste SANS LIVRE, et pour lui seul', () => {
    const [typeSansLivre] = Object.keys(SANS_LIVRE);
    const rendu = document(typeSansLivre, 'config', { valeur: z.number() }, { valeur: { label: 'Valeur' } }, EXPOSITION);
    expect(rendu.schema.safeParse({ id: 'x', type: typeSansLivre, label: 'X', valeur: 1 }).success).toBe(true);
    const typeHorsListe = 'type-jouet-hors-liste';
    expect(SANS_LIVRE[typeHorsListe]).toBeUndefined();
    const exige = document(typeHorsListe, 'config', { valeur: z.number() }, { valeur: { label: 'Valeur' } }, EXPOSITION);
    expect(exige.schema.safeParse({ id: 'x', type: typeHorsListe, label: 'X', valeur: 1 }).success).toBe(false);
    expect(exige.schema.safeParse({ id: 'x', type: typeHorsListe, label: 'X', valeur: 1, source: SOURCE_REELLE }).success).toBe(true);
  });

  it('exige une PROVENANCE : `source` OU `maison`, jamais NI L’UN NI L’AUTRE (#1467 L1b)', () => {
    const nu = { id: 'a', type: 'talent', label: 'A', max: 2 };
    // Sans provenance : refusé, et l'erreur NOMME le document et le champ attendu.
    const ko = fiche.entree.safeParse(nu);
    expect(ko.success).toBe(false);
    expect(JSON.stringify(ko.error)).toMatch(/document\('talent'\).*maison/);
    // `maison` SEULE suffit : un arbitrage hors canon est une provenance, pas un trou.
    expect(fiche.entree.safeParse({ ...nu, maison: 'le canon ne chiffre pas ce point' }).success).toBe(true);
    // `source` seule suffit ; les DEUX ensemble restent légitimes (mesuré : 28 entrées, 9 fichiers).
    expect(fiche.entree.safeParse({ ...nu, source: SOURCE_REELLE }).success).toBe(true);
    expect(fiche.entree.safeParse({ ...nu, source: SOURCE_REELLE, maison: 'précision maison' }).success).toBe(true);
    // `maison` VIDE ne prouve rien : `.min(1)` STRUCTUREL, jamais une garde dans le refine.
    expect(fiche.entree.safeParse({ ...nu, maison: '' }).success).toBe(false);
  });

  it('REFUSE `maison` BOOLÉEN — un DRAPEAU ne dit aucune raison, l’enveloppe en exige une', () => {
    const nu = { id: 'a', type: 'talent', label: 'A', max: 2 };
    // Le TYPE porte le contrat : `maison` est la raison en clair, jamais un vrai/faux.
    expect(fiche.entree.safeParse({ ...nu, maison: true }).success).toBe(false);
    expect(fiche.entree.safeParse({ ...nu, source: SOURCE_REELLE, maison: true }).success).toBe(false);
    // ... et le drapeau ne satisfait donc PAS le refine de provenance : l'entrée reste sans source.
    const ko = fiche.entree.safeParse({ ...nu, maison: true });
    expect(JSON.stringify(ko.error)).toMatch(/maison/);
  });

  it('`affinerEntree` reçoit un nœud PRÉ-sceau dont le `.shape` porte `maison` (composable)', () => {
    let vues: string[] = [];
    const doc = document(
      'talent',
      'entite',
      { max: z.number() },
      { max: { label: 'Maximum' } },
      EXPOSITION,
      {
        affinerEntree: (e) => {
          vues = Object.keys(e.shape);
          return e;
        },
      },
    );
    // Le refine de provenance est posé AVANT `affinerEntree` : il ne doit pas avoir scellé le nœud,
    // sans quoi tout def qui compose un raffinement perdrait `.shape` (et `variants-integrity` avec).
    expect(vues).toContain('maison');
    expect(vues).toContain('source');
    expect(doc.cles).toContain('maison');
  });

  it('REFUSE une clé d’enveloppe redéclarée dans `champs`, en la nommant', () => {
    expect(() =>
      // @ts-expect-error — `label` est une clé d'ENVELOPPE : le mapped type l'annule en `never`.
      document('jouet', 'entite', { label: z.string() }, { label: { label: 'Libellé' } }, EXPOSITION),
    ).toThrow(/« label » est une clé d'ENVELOPPE/);
    expect(CLES_ENVELOPPE).toContain('label');
  });

  it('REFUSE un champ sans méta d’édition, et une méta sans champ', () => {
    expect(() =>
      // @ts-expect-error — la méta de `max` manque : `MetaDesChamps` l'exige.
      document('jouet', 'entite', { max: z.number() }, {}, EXPOSITION),
    ).toThrow(/le champ « max » n'a pas de méta/);
    expect(() =>
      // @ts-expect-error — méta orpheline : aucune clé `autre` dans `champs`.
      document('jouet', 'entite', { max: z.number() }, { max: { label: 'Max' }, autre: { label: 'Autre' } }, EXPOSITION),
    ).toThrow(/méta d'édition « autre » sans champ/);
  });

  it('EXIGE une exposition Codex/éditeur déclarée (clés, ou exemption motivée)', () => {
    expect(() =>
      // @ts-expect-error — `codex` vide : ni `keys` ni `exempt`.
      document('jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, { codex: {}, edit: { object: 'single' } }),
    ).toThrow(/`codex` exige/);
    expect(() =>
      // @ts-expect-error — `edit` vide : ni `dataset`, ni `object`, ni `niche`, ni `none`.
      document('jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, { codex: { keys: ['x'] }, edit: {} }),
    ).toThrow(/`edit` exige/);
    expect(() =>
      document('jouet', 'config', { max: z.number() }, { max: { label: 'Max' } }, { codex: { keys: ['x'] }, edit: { niche: { categories: [] } } }),
    ).toThrow(/`edit.niche.categories` exige/);
    const nichee = document(
      'jouet',
      'config',
      { max: z.number() },
      { max: { label: 'Max' } },
      { codex: { keys: ['x', 'y'] }, edit: { niche: { categories: ['x'] } } },
    );
    expect(nichee.exposition.edit).toEqual({ niche: { categories: ['x'] } });
    const exempte = document(
      'jouet',
      'config',
      { max: z.number() },
      { max: { label: 'Max' } },
      { codex: { exempt: { kind: 'vocabulaire-app-interne', raison: 'vocabulaire du moteur, jamais lu par le joueur' } }, edit: { none: 'dérivé' } },
    );
    expect(exempte.exposition.edit).toEqual({ none: 'dérivé' });
  });

  it('REFUSE une exemption à raison SQUELETTIQUE — un mot n’est pas un motif (≥ 10 caractères)', () => {
    expect(() =>
      document(
        'jouet',
        'config',
        { max: z.number() },
        { max: { label: 'Max' } },
        { codex: { exempt: { kind: 'vocabulaire-app-interne', raison: 'interne' } }, edit: { none: 'dérivé' } },
      ),
    ).toThrow(/`exempt` motivé \(raison ≥ 10 caractères\)/);
    // Le blanc ne compte pas : la raison se mesure ébrechée.
    expect(() =>
      document(
        'jouet',
        'config',
        { max: z.number() },
        { max: { label: 'Max' } },
        { codex: { exempt: { kind: 'vocabulaire-app-interne', raison: '   interne   ' } }, edit: { none: 'dérivé' } },
      ),
    ).toThrow(/`exempt` motivé \(raison ≥ 10 caractères\)/);
  });

  it('CROISE `edit.niche.categories` avec `codex.keys` : une catégorie hors Codex est REFUSÉE, en la nommant', () => {
    expect(() =>
      document(
        'jouet',
        'config',
        { max: z.number() },
        { max: { label: 'Max' } },
        { codex: { keys: ['x'] }, edit: { niche: { categories: ['x', 'z'] } } },
      ),
    ).toThrow(/`edit.niche.categories` nomme des clés absentes de `codex.keys` : z/);
  });

  it('REFUSE `edit.niche` sur un document Codex EXEMPT — aucune clé à router', () => {
    expect(() =>
      document(
        'jouet',
        'config',
        { max: z.number() },
        { max: { label: 'Max' } },
        {
          codex: { exempt: { kind: 'vocabulaire-app-interne', raison: 'vocabulaire du moteur, jamais lu par le joueur' } },
          edit: { niche: { categories: ['x'] } },
        },
      ),
    ).toThrow(/`edit.niche` route des catégories alors que `codex` est EXEMPT/);
  });

  it('n’expose AUCUN nœud extensible en aval : `.extend` et `.shape` absents AU RUNTIME', () => {
    const nu = fiche.entree as unknown as Record<string, unknown>;
    expect(nu.extend).toBeUndefined();
    expect(nu.shape).toBeUndefined();
    // « AUCUN nœud » vaut pour TOUT ce que le handle rend, l'entrée PARTIELLE comprise.
    const patch = fiche.entreePartielle as unknown as Record<string, unknown>;
    expect(patch.extend).toBeUndefined();
    expect(patch.shape).toBeUndefined();
    expect(() =>
      // @ts-expect-error — le schéma sort en `z.ZodType` : pas d'`.extend` sur le handle.
      fiche.entree.extend({ ajout: z.string() }),
    ).toThrow();
    const parse: z.infer<typeof fiche.entree> = fiche.entree.parse(DOC_COMPLET);
    expect((parse as { max: number }).max).toBe(2);
    expect(fiche.entree.safeParse({ ...DOC_COMPLET, max: 'deux' }).success).toBe(false);
  });
});

describe('document() — variantes réglées composées par la fabrique', () => {
  const jouet = document(
    'talent',
    'entite',
    { max: z.number(), tests: z.string().optional() },
    { max: { label: 'Maximum' }, tests: { label: 'Tests' } },
    EXPOSITION,
    { variantes: ['desc', 'source', 'max'] },
  );
  const BASE = { id: 'ambidextre', type: 'talent', label: 'Ambidextre', source: SOURCE_REELLE, max: 2 };

  it('accepte un patch PARTIEL des champs déclarés, sous sa garde `when`', () => {
    expect(jouet.variantes).toEqual(['desc', 'source', 'max']);
    expect(jouet.entree.safeParse({ ...BASE, variants: [{ when: { rule: 'aa-group-advantage' }, max: 4 }] }).success).toBe(true);
  });

  it('REFUSE un champ hors liste, et une variante sans `when`', () => {
    expect(jouet.entree.safeParse({ ...BASE, variants: [{ when: { rule: 'r' }, tests: 'Ténacité' }] }).success).toBe(false);
    expect(jouet.entree.safeParse({ ...BASE, variants: [{ max: 4 }] }).success).toBe(false);
  });

  it('REFUSE tout `variants` à un document qui n’en déclare aucun, et un champ republiable inconnu', () => {
    const sansVariante = document('talent', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION);
    expect(sansVariante.entree.safeParse({ ...BASE, variants: [{ when: { rule: 'r' }, max: 4 }] }).success).toBe(false);
    expect(() =>
      document('talent', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, { variantes: ['inexistant'] }),
    ).toThrow(/« inexistant » est déclaré republiable/);
  });
});

describe('document() — emballage du DATASET par famille (#1467 L1b)', () => {
  const REPLIQUES = {
    // Réplique de forme d'un def `entite` (talents.json) — jamais le vrai def : c'est la FABRIQUE qu'on mesure.
    entite: document('talent', 'entite', { max: z.number() }, { max: { label: 'Maximum' } }, EXPOSITION),
    // Réplique d'un def `config` (objet unique dans son fichier).
    config: document('config-jouet', 'config', { valeur: z.number() }, { valeur: { label: 'Valeur' } }, EXPOSITION),
    // Réplique d'un def `record` (decorPalette : record de chaînes hex).
    record: document('palette-jouet', 'record', {}, {}, EXPOSITION, { valeurRecord: z.string().regex(/^#[0-9a-f]{6}$/) }),
    // Réplique d'un def à RANGÉES : `entries` ET `die?` sont POSÉS par la fabrique depuis
    // `options.rangee` — comme `entries` l'est en famille `record`. La charge est orthogonale à
    // l'emballage : la même option sert ici une famille `entite` (le fichier porte une LISTE de
    // documents-tables) et, plus bas, une famille `config` (le fichier EST le document).
    rangees: document('table-jouet', 'entite', {}, {}, EXPOSITION, {
      rangee: z.strictObject({ min: z.number(), max: z.number(), label: z.string() }),
      deDeTirage: true,
    }),
    rangeesConfig: document('config-table-jouet', 'config', {}, {}, EXPOSITION, {
      rangee: z.strictObject({ min: z.number(), max: z.number(), label: z.string() }),
    }),
  };
  const ENV = (type: string) => ({ id: 'x', type, label: 'X', source: SOURCE_REELLE });

  it('famille `entite` : le dataset est un TABLEAU d’entrées', () => {
    const { schema } = REPLIQUES.entite;
    expect(schema.safeParse([{ ...ENV('talent'), max: 2 }]).success).toBe(true);
    expect(schema.safeParse({ ...ENV('talent'), max: 2 }).success).toBe(false);
    expect(schema.safeParse([{ ...ENV('talent'), max: 2, inconnu: 1 }]).success).toBe(false);
    expect(schema.safeParse([{ ...ENV('talent'), max: 'deux' }]).success).toBe(false);
  });

  it('famille `config` : le dataset est l’ENTRÉE seule', () => {
    const { schema } = REPLIQUES.config;
    expect(schema.safeParse({ ...ENV('config-jouet'), valeur: 3 }).success).toBe(true);
    expect(schema.safeParse([{ ...ENV('config-jouet'), valeur: 3 }]).success).toBe(false);
    expect(schema.safeParse({ ...ENV('config-jouet'), valeur: 3, inconnu: 1 }).success).toBe(false);
    expect(schema.safeParse({ ...ENV('config-jouet'), valeur: 'trois' }).success).toBe(false);
  });

  it('famille `record` : ENVELOPPE + `entries`, chaque valeur validée', () => {
    const { schema } = REPLIQUES.record;
    const base = { ...ENV('palette-jouet'), entries: { bois: '#8b5a2b', pierre: '#7a7a7a' } };
    expect(schema.safeParse(base).success).toBe(true);
    expect(schema.safeParse({ ...base, inconnu: 1 }).success).toBe(false);
    expect(schema.safeParse({ ...base, entries: { bois: 'marron' } }).success).toBe(false);
    expect(schema.safeParse({ ...base, entries: { '': '#8b5a2b' } }).success).toBe(false);
  });

  it('document à `rangee` : `entries` POSÉE par la fabrique, et `die` REQUIS dès `deDeTirage`', () => {
    const { schema } = REPLIQUES.rangees;
    const t = { ...ENV('table-jouet'), die: '1d100', entries: [{ min: 1, max: 10, label: 'Rien' }] };
    expect(schema.safeParse([t]).success).toBe(true);
    // `deDeTirage` déclaré : le dé est REQUIS, et une chaîne vide ne le satisfait pas.
    expect(schema.safeParse([{ ...t, die: undefined }]).success).toBe(false);
    expect(schema.safeParse([{ ...t, die: '' }]).success).toBe(false);
    // Le fichier porte une LISTE de documents : le document nu n'est pas le dataset.
    expect(schema.safeParse(t).success).toBe(false);
    // `entries` est une LISTE ordonnée (là où la famille `record` en fait une map).
    expect(schema.safeParse([{ ...t, entries: {} }]).success).toBe(false);
    // Chaque rangée est validée par `rangee`, et le sceau refuse la clé en trop.
    expect(schema.safeParse([{ ...t, entries: [{ min: 1, max: 10 }] }]).success).toBe(false);
    expect(schema.safeParse([{ ...t, entries: [{ min: 1, max: 10, label: 'Rien', inconnu: 1 }] }]).success).toBe(false);
  });

  it('`rangee` en famille `config` : le document EST son fichier, et porte sa charge', () => {
    const { schema } = REPLIQUES.rangeesConfig;
    const t = { ...ENV('config-table-jouet'), entries: [{ min: 1, max: 10, label: 'Rien' }] };
    expect(schema.safeParse(t).success).toBe(true);
    // SANS `deDeTirage`, `die` n'existe pas sur le document : le sceau le refuse comme clé en trop.
    expect(schema.safeParse({ ...t, die: '1d10' }).success).toBe(false);
    expect(schema.safeParse([t]).success).toBe(false);
    expect(schema.safeParse({ ...t, entries: [{ min: 1, max: 10 }] }).success).toBe(false);
  });

  it('`deDeTirage` SANS `rangee` est REFUSÉ à la déclaration, en nommant le document', () => {
    expect(() => document('de-sans-rangees', 'config', {}, {}, EXPOSITION, { deDeTirage: true })).toThrow(
      /document\('de-sans-rangees'\) : `deDeTirage` exige `rangee`/,
    );
  });

  it('`rangee` en famille `record` est REFUSÉ : les deux charges sont EXCLUSIVES (jamais un silence)', () => {
    // Sans ce refus, la branche `record` gagnait et `rangee` était IGNORÉE — un document déclaré à
    // rangées parsait en map, sans un mot. Le `deDeTirage` du même appel est couvert par le refus
    // ci-dessus : il exige une `rangee`, que `record` n'admet pas.
    expect(() =>
      document('record-a-rangees', 'record', {}, {}, EXPOSITION, { valeurRecord: z.string(), rangee: z.number() }),
    ).toThrow(/document\('record-a-rangees'\) : `rangee` et la famille « record » sont EXCLUSIVES/);
    expect(() =>
      document('record-a-de', 'record', {}, {}, EXPOSITION, { valeurRecord: z.string(), deDeTirage: true }),
    ).toThrow(/document\('record-a-de'\) : `deDeTirage` exige `rangee`/);
  });

  it('un def à `rangee` qui redéclare `entries` ou `die` dans ses `champs` est REFUSÉ (la fabrique les pose)', () => {
    expect(() =>
      document('table-doublon', 'entite', { entries: z.array(z.number()) }, { entries: { label: 'Rangées' } }, EXPOSITION, {
        rangee: z.number(),
      }),
    ).toThrow(/document\('table-doublon'\) : la fabrique pose « entries » \(charge du document\)/);
    expect(() =>
      document('table-de-doublon', 'config', { die: z.string() }, { die: { label: 'Dé' } }, EXPOSITION, {
        rangee: z.number(),
      }),
    ).toThrow(/document\('table-de-doublon'\) : la fabrique pose « die » \(charge du document\)/);
    // SANS `rangee`, `die` n'est pas une clé de charge : un def qui n'a pas de rangées peut le déclarer.
    expect(() => document('sans-rangees', 'config', { die: z.string() }, { die: { label: 'Dé' } }, EXPOSITION)).not.toThrow();
  });

  it('la MÉTA FR de la charge est celle de la FABRIQUE (`META_CHARGE`), publiée par le handle', () => {
    expect(REPLIQUES.rangees.meta.entries).toEqual(META_CHARGE.entries);
    expect(REPLIQUES.rangees.meta.die).toEqual(META_CHARGE.die);
    expect(REPLIQUES.record.meta.entries).toEqual(META_CHARGE.entries);
    // Un document SANS charge ne publie aucune méta de charge ; sans `deDeTirage`, aucune méta de dé.
    expect(REPLIQUES.config.meta.entries).toBeUndefined();
    expect(REPLIQUES.record.meta.die).toBeUndefined();
    expect(REPLIQUES.rangeesConfig.meta.die).toBeUndefined();
  });

  it('le SCEAU tient sur TOUT nœud rendu (dataset de chaque famille, entrée, entrée partielle)', () => {
    const scelle = (n: unknown) => {
      const nu = n as Record<string, unknown>;
      expect(nu.extend).toBeUndefined();
      expect(nu.shape).toBeUndefined();
      expect(typeof (nu as { partial?: unknown }).partial).toBe('undefined');
      expect(() => (nu as { partial: () => unknown }).partial()).toThrow();
    };
    scelle((REPLIQUES.entite.schema as unknown as { element: unknown }).element);
    scelle((REPLIQUES.rangees.schema as unknown as { element: unknown }).element);
    scelle(REPLIQUES.config.schema);
    scelle(REPLIQUES.record.schema);
    scelle(REPLIQUES.entite.entree);
    scelle(REPLIQUES.record.entree);
    // Le nœud PARTIEL est scellé lui aussi : un `.partial()` nu rouvrirait `.extend` par le voisin.
    scelle(REPLIQUES.entite.entreePartielle);
    scelle(REPLIQUES.record.entreePartielle);
  });

  it('`entreePartielle` accepte le PATCH que le nœud scellé rend impossible, et `cles` liste les clés top-level', () => {
    const { entreePartielle, cles } = REPLIQUES.entite;
    expect(entreePartielle.safeParse({ max: 2 }).success).toBe(true);
    expect(entreePartielle.safeParse({}).success).toBe(true);
    expect(entreePartielle.safeParse({ inconnu: 1 }).success).toBe(false);
    // Consommateur mesuré `defs-scenes/narratif.ts:49` : `.partial().optional()` — le sceau le sert.
    expect(entreePartielle.optional().safeParse(undefined).success).toBe(true);
    expect(entreePartielle.optional().safeParse({ max: 2 }).success).toBe(true);
    expect(cles).toEqual(['id', 'type', 'label', 'labelF', 'desc', 'descRef', 'source', 'alsoIn', 'maison', 'icon', 'max']);
    // Sur un document à `rangee` comme en famille `record`, la charge EST un champ de l'entrée.
    expect(REPLIQUES.rangees.cles).toContain('die');
    expect(REPLIQUES.rangees.cles).toContain('entries');
    // En famille `record`, `entries` EST un champ de l'entrée : `cles` ne ment pas sur la forme.
    expect(REPLIQUES.record.cles).toContain('entries');
  });

  it('`affinerEntree` MORD sur l’entrée, sans rouvrir le sceau', () => {
    const borne = document(
      'talent',
      'entite',
      { max: z.number() },
      { max: { label: 'Maximum' } },
      EXPOSITION,
      { affinerEntree: (e) => e.superRefine((v, ctx) => { if ((v as { max: number }).max > 3) ctx.addIssue({ code: 'custom', message: 'max plafonné à 3' }); }) },
    );
    expect(borne.schema.safeParse([{ ...ENV('talent'), max: 2 }]).success).toBe(true);
    const ko = borne.schema.safeParse([{ ...ENV('talent'), max: 9 }]);
    expect(ko.success).toBe(false);
    expect(JSON.stringify(ko.error)).toContain('max plafonné à 3');
    expect((borne.entree as unknown as Record<string, unknown>).extend).toBeUndefined();
    expect((borne.schema as unknown as { element: Record<string, unknown> }).element.extend).toBeUndefined();
  });

  it('`affinerDataset` MORD sur le dataset (unicité d’ids), sans rouvrir le sceau', () => {
    const unique = document(
      'talent',
      'entite',
      { max: z.number() },
      { max: { label: 'Maximum' } },
      EXPOSITION,
      {
        affinerDataset: (d) =>
          d.superRefine((v, ctx) => {
            const ids = (v as { id: string }[]).map((e) => e.id);
            if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'id dupliqué' });
          }),
      },
    );
    expect(unique.schema.safeParse([{ ...ENV('talent'), max: 1 }, { ...ENV('talent'), id: 'y', max: 2 }]).success).toBe(true);
    const ko = unique.schema.safeParse([{ ...ENV('talent'), max: 1 }, { ...ENV('talent'), max: 2 }]);
    expect(ko.success).toBe(false);
    expect(JSON.stringify(ko.error)).toContain('id dupliqué');
    expect((unique.entree as unknown as Record<string, unknown>).extend).toBeUndefined();
  });

  it('`affinerEntree` MORD AUSSI en famille `record` : l’entrée y est le DOCUMENT (enveloppe + `entries`)', () => {
    const palette = document(
      'palette-jouet',
      'record',
      {},
      {},
      EXPOSITION,
      {
        valeurRecord: z.string(),
        affinerEntree: (e) =>
          e.superRefine((v, ctx) => {
            if (!Object.keys((v as { entries: Record<string, string> }).entries).length) {
              ctx.addIssue({ code: 'custom', message: 'AFFINER-A-MORDU' });
            }
          }),
      },
    );
    expect(palette.schema.safeParse({ ...ENV('palette-jouet'), entries: { bois: '#000000' } }).success).toBe(true);
    const ko = palette.schema.safeParse({ ...ENV('palette-jouet'), entries: {} });
    expect(ko.success).toBe(false);
    expect(JSON.stringify(ko.error)).toContain('AFFINER-A-MORDU');
  });

  it('`cleRecord` FERME l’univers des clés quand le def le déclare (patron `teintesJeu`)', () => {
    const teintes = document('palette-jouet', 'record', {}, {}, EXPOSITION, {
      cleRecord: z.enum(['bois', 'pierre']),
      valeurRecord: z.string(),
    });
    const toutes = { bois: '#000000', pierre: '#ffffff' };
    expect(teintes.schema.safeParse({ ...ENV('palette-jouet'), entries: toutes }).success).toBe(true);
    expect(teintes.schema.safeParse({ ...ENV('palette-jouet'), entries: { ...toutes, lave: '#000000' } }).success).toBe(false);
    // zod 4.4.3, mesuré : une clé ÉNUMÉRÉE rend le record EXHAUSTIF — une clé déclarée qui manque est
    // refusée. C'est la forme du def réel `defs/teintesJeu.ts:134` (`z.record(z.enum(TEINTE_KEYS), …)`).
    expect(teintes.schema.safeParse({ ...ENV('palette-jouet'), entries: { bois: '#000000' } }).success).toBe(false);
    expect(() =>
      document('talent', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, { cleRecord: z.string() }),
    ).toThrow(/`cleRecord` n'a de sens que pour la famille « record »/);
  });

  it('REFUSE un champ `entries` déclaré par un def `record` : la fabrique le pose, en le nommant', () => {
    expect(() =>
      document('palette-jouet', 'record', { entries: z.string() }, { entries: { label: 'Entrées' } }, EXPOSITION, {
        valeurRecord: z.string(),
      }),
    ).toThrow(/la fabrique pose « entries »/);
  });

  it('`valeurRecord` : EXIGÉ par la famille `record`, REFUSÉ partout ailleurs, en nommant le document', () => {
    expect(() => document('palette-jouet', 'record', {}, {}, EXPOSITION)).toThrow(/« record » exige `valeurRecord`/);
    expect(() =>
      document('talent', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, { valeurRecord: z.string() }),
    ).toThrow(/`valeurRecord` n'a de sens que pour la famille « record » \(ici « entite »\)/);
  });
});

describe('defs/ — forme de FICHIER et EXPOSITION déclarée (#1472 sous-lot A)', () => {
  it('tout fichier de `defs/` se termine par une newline', () => {
    const dossier = new URL('../defs/', import.meta.url);
    const fautifs = listerDossier(fileURLToPath(dossier))
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => !readFileSync(new URL(f, dossier), 'utf8').endsWith('\n'));
    expect(fautifs).toEqual([]);
  });

  it('chaque def du registre porte une `exposition` conforme (codex, edit, croisement niche×codex)', () => {
    const fautifs: string[] = [];
    for (const def of SCHEMA_DEFS) {
      const exposition = (def as { file: string; exposition?: Exposition }).exposition;
      if (!exposition) {
        fautifs.push(`${def.file} : aucune \`exposition\``);
        continue;
      }
      const c = exposition.codex as { keys?: readonly string[]; exempt?: { raison?: string } };
      const e = exposition.edit as { dataset?: string; object?: string; niche?: { categories?: readonly string[] }; none?: string };
      const keys = Array.isArray(c.keys) && c.keys.length ? c.keys : undefined;
      if (!keys && !c.exempt?.raison) fautifs.push(`${def.file} : \`codex\` sans \`keys\` ni \`exempt\` motivé`);
      if (!e.dataset && !e.object && !e.none && !e.niche) fautifs.push(`${def.file} : \`edit\` sans route déclarée`);
      if (e.niche) {
        const cats = e.niche.categories;
        if (!(Array.isArray(cats) && cats.length && cats.every((k) => typeof k === 'string' && k.length))) {
          fautifs.push(`${def.file} : \`edit.niche.categories\` vide ou mal formée`);
        } else if (!keys) {
          fautifs.push(`${def.file} : \`edit.niche\` sur un Codex EXEMPT`);
        } else {
          const hors = cats.filter((k) => !keys.includes(k));
          if (hors.length) fautifs.push(`${def.file} : \`edit.niche.categories\` hors \`codex.keys\` : ${hors.join(', ')}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });
});

describe('contrats d’enveloppe REQUIS dans les defs `entite` — la métrique qui justifie `exiges`', () => {
  // MESUREUR : « requis » = `shape[k].safeParse(undefined)` ROUGE au schéma d'entrée du def (jamais une
  // regex de source, qui sous-compte les déclarations indentées autrement). Les defs DÉJÀ adoptés par
  // `document()` rendent un nœud SCELLÉ sans `.shape` : ils ne sont pas mesurables ici — et n'ont plus
  // rien à perdre, leur enveloppe est celle de la fabrique. Ce compte est ce que le flip-entite doit
  // reporter en `options.exiges`, def par def : il DÉCROÎT à mesure que les defs sont adoptés.
  //
  // Au 2026-08-28, `scelles` = 77 defs `entite`, TOUS adoptés — et la population MESURÉE est VIDE.
  // `oups.json` est le dernier entré (V-UNION) : ses deux formes (bande d100 `min`/`max`/`kind` vs
  // Incident de Tir `kind: 'misfire'`) tiennent en UNE entrée dont un refine ⟺ porte la disjonction,
  // si bien qu'il n'a plus besoin d'une classe « union » hors des vagues d'adoption.
  const noeudInterne = (n: unknown): unknown => {
    const d = (n as { _zod?: { def?: Record<string, unknown> }; def?: Record<string, unknown> })?._zod?.def;
    if (!d) return undefined;
    return d.type === 'array' ? d.element : d.innerType;
  };
  const shapeDe = (schema: unknown): Record<string, z.ZodTypeAny> | undefined => {
    let n: unknown = schema;
    for (let i = 0; i < 12 && n; i++) {
      const shape = (n as { shape?: Record<string, z.ZodTypeAny> }).shape;
      if (shape) return shape;
      n = noeudInterne(n);
    }
    return undefined;
  };

  const mesure = { desc: 0, source: 0, icon: 0, scelles: 0, mesures: 0 };
  for (const def of SCHEMA_DEFS.filter((d) => d.famille === 'entite')) {
    const shape = shapeDe(def.schema);
    if (!shape) {
      mesure.scelles++;
      continue;
    }
    mesure.mesures++;
    for (const k of ['desc', 'source', 'icon'] as const) {
      if (shape[k] && shape[k].safeParse(undefined).success === false) mesure[k]++;
    }
  }

  /**
   * TÉMOIN DU DÉTECTEUR — la population mesurée étant VIDE, les trois compteurs valent 0 ; un
   * `shapeDe` cassé rendrait EXACTEMENT le même 0. Ce zéro n'a de sens que si l'instrument mord
   * encore : on lui donne ici un schéma NON adopté (la forme que portaient les defs avant la
   * fabrique) et on exige qu'il y VOIE les trois clés requises.
   */
  const NON_ADOPTE = z.array(z.strictObject({ desc: z.string(), source: z.string(), icon: z.string() }));

  it('le DÉTECTEUR mord encore — sur un schéma NON adopté, il VOIT les trois clés requises', () => {
    const shape = shapeDe(NON_ADOPTE);
    expect(shape, '`shapeDe` ne descend plus jusqu’à la forme d’un def non adopté').toBeDefined();
    const requises = (['desc', 'source', 'icon'] as const).filter((k) => shape![k] && !shape![k].safeParse(undefined).success);
    expect(requises).toEqual(['desc', 'source', 'icon']);
  });

  it('compte les clés d’enveloppe REQUISES que l’adoption relâcherait sans `exiges`', () => {
    // #1467 L1b V-FLIP-ENTITE, vagues 11a puis 11b (2026-08-28) : 42 defs `entite` ont adopté
    // `document()` — ils rendent un nœud SCELLÉ, donc ils quittent la population MESURÉE pour la
    // population SCELLÉE (75 → 33, 2 → 44). Ce que la mesure perd, `options.exiges` le PORTE
    // désormais au def, et le verrou d'exigence ci-dessous le prouve entrée par entrée.
    //   11a : desc −5 (astrology, classes, crew-roles, peripeties, sea-shanties),
    //         source −3 (astrology, classes, sea-shanties), icon −1 (calendarPhases).
    //   11b : desc −6 (careers, characteristics, interludeEvents, mutations, qualities, regles),
    //         source −7 (careers, characteristics, locations, qualities, regles, stars, voyage-stakes).
    //   12  : desc −9 (etats, maladies, naval-traits, skills, steam-breakdown, symptoms, talents,
    //                  traits, traumas),
    //         source −9 (combat-stakes, etats, flow-stakes, maneuvers, naval-ports, skills,
    //                    structures, talents, traits) — 21 defs quittent la mesure (33 → 12, 44 → 65).
    //   12b : desc −4 (psychology, species, spells, tavernGames),
    //         source −8 (activities, creatures, night-stakes, psychology, species, spells,
    //                    tavernGames, trappings),
    //         icon −2 (actions, activities) — les 12 DERNIERS defs `entite` quittent la mesure
    //         (12 → 0, 65 → 77). La population MESURÉE est ÉTEINTE : plus AUCUN def `entite` ne
    //         porte son enveloppe à la main.
    //   14  : `oups` (V-UNION) était DÉJÀ compté en `scelles` — son union n'avait pas plus de
    //         `.shape` que le nœud scellé qu'il rend désormais — donc le total ne bouge PAS (77).
    //         Ce qu'il gagne, c'est d'y être pour la BONNE raison, et son `source` exigée au verrou.
    // L'ADOPTION est la cause du recalage, pas une dérive du détecteur — le témoin ci-dessus le
    // prouve en faisant mordre l'instrument sur un schéma non adopté.
    //
    // DEUX ÉCARTS entre ce que la mesure PERD et ce que `exiges` REPREND, tous deux de la MÊME
    // classe — une entrée MÉTA ou sans prose citable dont la `desc: ""` est purgée, si bien
    // qu'exiger `desc` la refuserait :
    //   • vague 12  : `talents` (187ᵉ entrée `talent-aleatoire`, vocabulaire de tirage LDB 05 l.484,
    //     exemptée d'obtenabilité par `META_CATALOG_ENTRIES`), purgée par la migration 12a ;
    //   • vague 12b : `species` (5ᵉ entrée `humains-tileens`), purgée par la migration 12b.
    // Les deux renvois viennent NOMMÉMENT de `2026-08-27-l1b-3h-desc-null.mjs:25-28`, verbatim :
    // « Les deux autres — `species.json[4]` et `talents.json[0]` — sont déclarés `desc: z.string()`
    // REQUIS […] Ils meurent avec le lot qui posera `min(1)` sur ces deux defs, pas ici. » Les deux
    // sont désormais morts (12a puis 12b) : le renvoi de 3h est INTÉGRALEMENT soldé. Les écarts sont
    // ici, pas dans un silence.
    //   #677 : `reseau-routier` est un def `entite` NEUF, adopté dès sa création et `source` exigée
    //         — il naît donc dans la population SCELLÉE (77 → 78), sans jamais passer par la mesure.
    //   #1654 : `miscast` déclare la famille `entite` (son fichier porte une LISTE de 5 documents,
    //         chacun à sa charge `entries` par `options.rangee`) — un def SCELLÉ de plus dans la
    //         population de ce mesureur, qui GAGNE là une couverture (78 → 79) : la famille qu'il
    //         portait sortait ce def de tout filtre `entite` de ce fichier.
    //   #1657 B2a : `criticals` fait de même (79 → 80) — les deux racines-objet `criticals`/
    //         `aa-criticals` fusionnent en UNE liste de 8 documents-tables, famille `entite` à charge
    //         `entries` ; le def d'`aa-criticals` meurt, celui de `criticals` entre dans la population.
    //   #1657 B3-2b-a : `ship-stations` naît SCELLÉ (80 → 81) — catalogue FERMÉ des présences à bord
    //         que les livres nomment, `exiges: ['desc']` dès sa première écriture.
    //   #1686 lot 2 : `propMaterials`/`roofMaterials`/`reliefMaterials` fusionnent en UN def
    //         `materials` (81 → 79) — trois defs SCELLÉS en deviennent un, la population perd 2.
    //   #1690 : `terrains` naît SCELLÉ (79 → 80) — le registre TS des 25 sols devient un dataset.
    //   #1715 : `buildings` naît SCELLÉ (80 → 81) — le registre TS des 7 types de bâtiment devient un dataset.
    expect(mesure).toEqual({ desc: 0, source: 0, icon: 0, scelles: 81, mesures: 0 });
  });

});

/**
 * CONTREPARTIE du mesureur (#1467 L1b V-FLIP-ENTITE-a) — un def ADOPTÉ sort de la population mesurée
 * (nœud scellé) : son `exiges` n'y est plus visible, et le vider ne ferait ROUGIR AUCUN compte tant
 * que la donnée réelle porte la clé. C'est mesuré, pas supposé. Le verrou qui reste est celui-ci :
 * l'entrée SANS la clé exigée doit être REFUSÉE, def par def.
 *
 * POPULATION DÉRIVÉE, jamais nommée à la main : tous les defs `entite` ADOPTÉS du registre (schéma
 * SCELLÉ, donc sans `.shape`) × les clés exigibles que porte leur 1ʳᵉ entrée RÉELLE. Un def adopté à
 * une vague ultérieure entre SEUL dans la population ; s'il exige, la table gelée ci-dessous devient
 * ROUGE et le nomme — la divergence est bruyante, jamais silencieuse.
 *
 * AMPUTATION DE `source` : le refine de PROVENANCE (`document.ts`, « entrée sans `source` ») refuse
 * DÉJÀ une entrée amputée de sa source — un test naïf y serait INERTE (rouge quel que soit `exiges`).
 * L'amputation POSE donc `maison` : la provenance est satisfaite, et seule `exiges` peut encore
 * refuser. Le témoin `AVEC` (entrée complète acceptée) accompagne chaque paire.
 */
describe('exigences d’enveloppe des defs ADOPTÉS — le verrou que le mesureur ne voit plus', () => {
  const RACINE = new URL('../../', import.meta.url);
  const CLES = ['labelF', 'desc', 'source', 'alsoIn', 'maison', 'icon'] as const;
  type Cle = (typeof CLES)[number];

  /**
   * Un def `entite` est ADOPTÉ quand l'élément de sa liste est un `ZodPipe` — la forme EXACTE que
   * `document()` rend (`affine.pipe(...)`). Le critère « pas de `.shape` » ne suffirait pas : il est
   * négatif, donc satisfait par tout nœud opaque (une union, un `ZodLazy`) qu'aucune fabrique n'a
   * scellé — il ferait entrer dans la population des defs dont l'enveloppe est écrite à la main, et
   * le verrou d'exigence y serait mesuré sur un contrat que `document()` ne porte pas.
   */
  const adopte = (schema: unknown): boolean =>
    ((schema as { _zod?: { def?: { type?: string; element?: { _zod?: { def?: { type?: string } } } } } })?._zod?.def?.element?._zod?.def
      ?.type ?? '') === 'pipe';

  /** Dataset RÉEL complet (jamais une entrée isolée : `affinerDataset` peut exiger la liste entière —
   *  `names.json` refuse tout tableau qui n'a pas ses 7 races). */
  const dataset = (fichier: string): Record<string, unknown>[] | undefined => {
    const brut = JSON.parse(readFileSync(new URL(fichier, RACINE), 'utf8')) as unknown;
    return Array.isArray(brut) && brut.length ? (brut as Record<string, unknown>[]) : undefined;
  };

  const premiereEntree = (fichier: string): Record<string, unknown> | undefined => dataset(fichier)?.[0];

  /**
   * `source` RÉELLE empruntée à `classes.json` — jamais un folio inventé : elle ne sert qu'à
   * satisfaire le refine de provenance quand la sonde ampute `maison`.
   */
  const SOURCE_TEMOIN = premiereEntree('classes.json')!.source;

  /**
   * Entrée privée de `cle`. Les deux clés de PROVENANCE se compensent l'une l'autre : sans cela le
   * refine `source ∨ maison` refuserait l'entrée amputée QUOI QUE déclare `exiges`, et la sonde
   * serait INERTE (rouge dans les deux configurations, donc muette). Compensée, seule `exiges` peut
   * encore refuser.
   */
  const ampute = (entree: Record<string, unknown>, cle: Cle): Record<string, unknown> => {
    const { [cle]: _retire, ...reste } = entree;
    if (cle === 'source') return { ...reste, maison: 'sonde d’exigence — provenance satisfaite pour isoler `exiges`' };
    if (cle === 'maison') return { ...reste, source: SOURCE_TEMOIN };
    if (cle === 'desc') {
      const { descRef: _adresse, ...sansProse } = reste;
      return sansProse;
    }
    return reste;
  };

  /**
   * La clé est-elle PORTÉE par l'entrée ? `desc` désigne la PROSE, pas l'un de ses deux porteurs
   * (`document.ts:185` : « `desc` EXIGÉE = PROSE exigée, quel qu'en soit le PORTEUR ») : une entrée
   * qui ADRESSE son texte (`descRef`, #1389) porte bien la prose, et son amputation retire les deux
   * porteurs. Sans cela, une famille migrée vers l'adresse sortirait de la population MESURÉE sans
   * qu'aucun compte ne bouge — le verrou se tairait au lieu de mordre.
   */
  const portee = (entree: Record<string, unknown>, cle: Cle): boolean =>
    cle === 'desc'
      ? entree.desc !== undefined || entree.descRef !== undefined
      : entree[cle] !== undefined;

  /** Paires (fichier, clé) mesurées REFUSÉES à l'amputation, sur la population dérivée du registre. */
  const mesurees = (): { paires: string[]; temoins: string[] } => {
    const paires: string[] = [];
    const temoins: string[] = [];
    for (const def of SCHEMA_DEFS.filter((d) => d.famille === 'entite' && adopte(d.schema))) {
      const liste = dataset(def.file);
      const entree = liste?.[0];
      if (!liste || !entree) continue;
      /** La liste RÉELLE dont la 1ʳᵉ entrée est remplacée — tout le reste intact. */
      const avec = (remplacante: Record<string, unknown>) => [remplacante, ...liste.slice(1)];
      if (!def.schema.safeParse(avec(entree)).success) temoins.push(`${def.file} : la 1ʳᵉ entrée RÉELLE est refusée par son propre schéma`);
      for (const cle of CLES) {
        if (!portee(entree, cle)) continue;
        if (!def.schema.safeParse(avec(ampute(entree, cle))).success) paires.push(`${def.file} · ${cle}`);
      }
    }
    return { paires, temoins };
  };

  /** Ce que les vagues 11a et 11b ont DÉCLARÉ en `options.exiges`, mesuré au schéma. Gelé, NOMINATIF. */
  const EXIGENCES_GELEES = [
    // vague 11a
    'astrology.json · desc',
    'astrology.json · source',
    'calendarPhases.json · icon',
    'classes.json · desc',
    'classes.json · source',
    'crew-roles.json · desc',
    'peripeties.json · desc',
    'sea-shanties.json · desc',
    'sea-shanties.json · source',
    // vague 11b — `axes` est le premier document à EXIGER `maison` (mécanique maison, aucun folio).
    'axes.json · maison',
    'careers.json · desc',
    'careers.json · source',
    'characteristics.json · desc',
    'characteristics.json · source',
    'interludeEvents.json · desc',
    'locations.json · source',
    'mutations.json · desc',
    'qualities.json · desc',
    'qualities.json · source',
    'regles.json · desc',
    'regles.json · source',
    'stars.json · source',
    'voyage-stakes.json · source',
    // vague 12 — 17 exigences NEUVES, chacune MORDANTE (la paire n'entre dans la population que si
    // l'entrée amputée est refusée par le schéma). `talents` n'exige que `source` : l'écart est
    // motivé au mesureur ci-dessus (entrée MÉTA `talent-aleatoire`, sans prose).
    'combat-stakes.json · source',
    'etats.json · desc',
    'etats.json · source',
    'flow-stakes.json · source',
    'maladies.json · desc',
    'maneuvers.json · source',
    'naval-ports.json · source',
    'naval-traits.json · desc',
    'skills.json · desc',
    'skills.json · source',
    'steam-breakdown.json · desc',
    // #1688 : `taille` est une valeur MAISON (le RAW `AA 10 l.98` la laisse à déterminer) — toute entrée
    // en porte une, donc toute entrée doit dire sa raison (`affinerEntree`, `defs/structures.ts`).
    'structures.json · maison',
    'structures.json · source',
    'symptoms.json · desc',
    'talents.json · source',
    'traits.json · desc',
    'traits.json · source',
    'traumas.json · desc',
    // vague 12b — les 12 DERNIERS defs `entite` adoptent, 13 exigences NEUVES, chacune MORDANTE.
    // `species` n'exige que `source` : sa 5ᵉ entrée (`humains-tileens`) portait `desc: ""`, purgée
    // par `2026-08-28-l1b-12b-entite-type.mjs` (renvoi nominatif de 3h:25-27) — exiger `desc`
    // refuserait cette entrée. MÊME écart que `talents` à la vague 12, motivé au mesureur ci-dessus.
    // Les catalogues de RENDU (`raceAppearance`, `materials`, `structureAppearance`) n'exigent
    // RIEN : ils sont sans livre, et leurs entrées ne portent ni desc ni icon.
    'actions.json · icon',
    'activities.json · icon',
    'activities.json · source',
    'creatures.json · source',
    'night-stakes.json · source',
    'psychology.json · desc',
    'psychology.json · source',
    'species.json · source',
    'spells.json · desc',
    'spells.json · source',
    'tavernGames.json · desc',
    'tavernGames.json · source',
    'trappings.json · source',
    // vague 14 (V-UNION) — `oups` adopte : DERNIER def hors forme, sa disjonction bande/misfire passe
    // d'une union à un refine ⟺. Les 8 entrées portent le folio 160, donc `source` est exigible.
    'oups.json · source',
    // #677 — `reseau-routier` naît adopté : ses 15 entrées portent toutes leur folio EDOC, `source`
    // est donc exigible dès la création. `desc` ne l'est pas (les 6 compagnies de la liste l.27-34
    // n'ont que leur nom au Source — aucune prose à recopier, aucune à inventer).
    'reseau-routier.json · source',
    // #1657 B3-2b-a — `ship-stations` naît adopté : chacune des 5 présences porte le VERBATIM de la
    // clause qui la nomme (MDG 13 l.714/730/751, MDG 12 l.303, MSRC 07 l.94), `desc` est donc exigible
    // dès la création. `source` ne l'est pas au def : c'est déjà l'enveloppe qui refuse une entrée sans
    // `source` NI `maison`.
    'ship-stations.json · desc',
    // #1690 — `terrains` naît adopté : le document est SANS LIVRE (aucun folio n'imprime de catalogue
    // de sols), mais ses 25 entrées portent chacune quatre champs de RÈGLE (`walkable`, `priority`,
    // `opaque`, `built`) que l'exemption de document ne couvre pas — `maison` est donc exigée à
    // l'entrée, même patron que les 41 règles de `props.json` (#1680).
    'terrains.json · maison',
    // #1715 — les 7 types de bâtiment naissent en donnée : aucun folio n'imprime de catalogue de
    // bâtiments, chaque entrée dit ce qu'elle arbitre (empreinte, couverture, ornement).
    'buildings.json · maison',
  ];

  it('la 1ʳᵉ entrée réelle de chaque def adopté est ACCEPTÉE — témoin positif de chaque paire', () => {
    const { temoins } = mesurees();
    expect(temoins, `Témoin(s) positif(s) en échec :\n${temoins.join('\n')}`).toEqual([]);
  });

  it('l’entrée AMPUTÉE d’une clé exigée est REFUSÉE — et le stock des paires est EXACTEMENT celui gelé', () => {
    const { paires } = mesurees();
    const manquantes = EXIGENCES_GELEES.filter((p) => !paires.includes(p));
    const neuves = paires.filter((p) => !EXIGENCES_GELEES.includes(p));
    expect(manquantes, `Exigence(s) DÉCLARÉE(s) mais non verrouillée(s) — l’amputation passe :\n${manquantes.join('\n')}`).toEqual([]);
    expect(neuves, `Exigence(s) NEUVE(s) non gelée(s) — une vague a adopté un def qui exige, déclare-la :\n${neuves.join('\n')}`).toEqual([]);
  });
});

describe('document() — verrous d’ENVELOPPE paramétrés (#1467 L1b V-P0c)', () => {
  const ENV = (type: string) => ({ id: 'x', type, label: 'X', source: SOURCE_REELLE });

  it('`idDocument` FERME le catalogue d’ids quand le def le déclare (patron `characteristics`)', () => {
    const ferme = document('carac-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, {
      idDocument: z.enum(['ca', 'cc']),
    });
    const ok = { ...ENV('carac-jouet'), id: 'cc', max: 2 };
    expect(ferme.entree.safeParse(ok).success).toBe(true);
    const ko = ferme.entree.safeParse({ ...ok, id: 'id-etranger' });
    expect(ko.success).toBe(false);
    expect(ko.error!.issues.map((i) => i.path.join('.'))).toContain('id');
    // Sans `idDocument`, le comportement de l'enveloppe est INCHANGÉ : tout id non vide passe.
    const libre = document('carac-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION);
    expect(libre.entree.safeParse({ ...ok, id: 'id-etranger' }).success).toBe(true);
    expect(libre.entree.safeParse({ ...ok, id: '' }).success).toBe(false);
  });

  it('`exiges` rend REQUISE une clé d’enveloppe, en NOMMANT celle qui manque', () => {
    const strict = document('fiche-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, {
      exiges: ['desc', 'source'],
    });
    // La prose INLINE se cite d'un livre SANS extraction : sur un livre extrait, le verrou V3 de
    // `grammaire/prose.ts` exigerait l'adresse (`descRef`) et masquerait ce que ce test mesure.
    const complet = { ...ENV('fiche-jouet'), source: SOURCE_SANS_EXTRACTION, desc: 'Une prose.', max: 2 };
    expect(strict.entree.safeParse(complet).success).toBe(true);
    const sansDesc = strict.entree.safeParse({ ...ENV('fiche-jouet'), max: 2 });
    expect(sansDesc.success).toBe(false);
    expect(sansDesc.error!.issues.map((i) => i.path.join('.'))).toContain('desc');
    // Sans `exiges`, la même entrée passe : c'est bien l'option qui verrouille.
    const relache = document('fiche-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION);
    expect(relache.entree.safeParse({ ...ENV('fiche-jouet'), max: 2 }).success).toBe(true);
  });

  it('`exiges: [source]` : `maison` seule ne suffit plus, et l’entrée est refusée AU TYPE de `source`', () => {
    const strict = document('fiche-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, {
      exiges: ['source'],
    });
    const avecMaison = { id: 'x', type: 'fiche-jouet', label: 'X', maison: 'arbitrage maison', max: 2 };
    const ko = strict.entree.safeParse(avecMaison);
    expect(ko.success).toBe(false);
    // `source` exigée est REQUISE au schéma : le refus vient du type manquant, pas du refine de
    // provenance — lequel ne s'exécute que sur un objet dont `source` est déjà validée (inatteignable).
    expect(ko.error!.issues.map((i) => `${i.code}@${i.path.join('.')}`)).toContain('invalid_type@source');
    // Le MÊME document sans `exiges` accepte `maison` seule (contrat du refine, plus faible).
    const refine = document('fiche-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION);
    expect(refine.entree.safeParse(avecMaison).success).toBe(true);
  });

  it('`source` exigée rend le refine de provenance INATTEIGNABLE : son message n’apparaît sur AUCUNE entrée', () => {
    const CORPUS: Record<string, unknown>[] = [
      {},
      { id: 'x' },
      { id: 'x', label: 'X' },
      { id: 'x', label: 'X', max: 2 },
      { id: 'x', label: 'X', max: 2, maison: 'r' },
      { id: 'x', label: 'X', max: 2, source: undefined },
      { id: 'x', label: 'X', max: 2, source: undefined, maison: 'r' },
      { id: 'x', label: 'X', max: 2, source: null },
      { id: 'x', label: 'X', max: 2, source: {} },
      { id: 'x', label: 'X', max: 2, source: SOURCE_REELLE, maison: 'r' },
    ];
    const messages = (doc: ReturnType<typeof document>) =>
      CORPUS.flatMap((v) => {
        const r = doc.entree.safeParse({ ...v, type: 'fiche-jouet' });
        return r.success ? [] : r.error.issues.map((i) => i.message);
      });
    const REFINE = /entrée sans `source`/;
    const exigeant = document('fiche-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, {
      exiges: ['source'],
    });
    expect(messages(exigeant).some((m) => REFINE.test(m))).toBe(false);
    // Le TÉMOIN : le même document sans `exiges` fait bien parler le refine sur ce corpus.
    const refine = document('fiche-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION);
    expect(messages(refine).some((m) => REFINE.test(m))).toBe(true);
  });

  it('EXIGER, c’est requis ET NON VIDE : `icon` exigée refuse `’’`, `alsoIn` exigée refuse `[]`', () => {
    const strict = document('fiche-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, {
      exiges: ['icon', 'alsoIn'],
    });
    const base = { ...ENV('fiche-jouet'), max: 2, icon: 'epee', alsoIn: [{ book: 'aux-armes', page: 12 }] };
    expect(strict.entree.safeParse(base).success).toBe(true);
    expect(strict.entree.safeParse({ ...base, icon: '' }).success).toBe(false);
    expect(strict.entree.safeParse({ ...base, alsoIn: [] }).success).toBe(false);
    // Non exigées, ces mêmes clés gardent leur forme d'origine (l'option n'est pas un durcissement global).
    const libre = document('fiche-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION);
    expect(libre.entree.safeParse({ ...base, icon: '', alsoIn: [] }).success).toBe(true);
  });

  it('`idDocument` qui admettrait la CHAÎNE VIDE est REFUSÉ à la déclaration', () => {
    expect(() =>
      document('carac-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, {
        idDocument: z.string(),
      }),
    ).toThrow(/`idDocument` admet la CHAÎNE VIDE/);
    // Une union/énumération fermée, elle, passe la garde.
    expect(() =>
      document('carac-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, {
        idDocument: z.enum(['ca', 'cc']),
      }),
    ).not.toThrow();
  });

  it('`exiges` REFUSE une clé inconnue, une clé non exigible et un DOUBLON, en les nommant', () => {
    expect(() =>
      document('fiche-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, {
        exiges: ['inconnue' as never],
      }),
    ).toThrow(/`exiges` nomme « inconnue »/);
    expect(() =>
      document('fiche-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, {
        exiges: ['id' as never],
      }),
    ).toThrow(/« id » n'est pas exigible/);
    expect(() =>
      document('fiche-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, {
        exiges: ['desc', 'desc'],
      }),
    ).toThrow(/`exiges` répète « desc »/);
  });

  it('les clés EXIGIBLES sont DÉRIVÉES de l’enveloppe : aucune liste parallèle à maintenir', () => {
    expect([...CLES_EXIGIBLES].sort()).toEqual(
      CLES_ENVELOPPE.filter((k) => !['id', 'type', 'label', 'variants', 'descRef'].includes(k)).sort(),
    );
  });
});

describe('ref() — id validé AU PARSE contre le registre généré', () => {
  it('accepte un id RÉEL de son dataset et le brande', () => {
    const noeud = ref('skill');
    expect(noeud.safeParse({ id: UNE_COMPETENCE.id }).success).toBe(true);
    const idParse = idDe('skill').parse(UNE_COMPETENCE.id);
    const attendu: Id<'skill'> = idParse;
    expect(attendu).toBe(UNE_COMPETENCE.id);
  });

  it('REFUSE un id inventé en nommant le type, l’id et le dataset', () => {
    const res = ref('skill').safeParse({ id: 'competence-qui-n-existe-pas' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/ref\('skill'\).*competence-qui-n-existe-pas.*skills\.json/);
  });

  it('compose FERMÉ avec les champs du porteur (`extra`) et refuse le reste', () => {
    const possede = ref('skill', { advances: z.number() });
    expect(possede.safeParse({ id: UNE_COMPETENCE.id, advances: 3 }).success).toBe(true);
    expect(possede.safeParse({ id: UNE_COMPETENCE.id, advances: 3, value: 40 }).success).toBe(false);
  });

  it('`refs()` valide chaque id de la liste, `typedRef()` résout selon le `type` porté', () => {
    expect(refs('skill').safeParse([UNE_COMPETENCE.id]).success).toBe(true);
    expect(refs('skill').safeParse([UNE_COMPETENCE.id, 'inconnu']).success).toBe(false);
    expect(typedRef().safeParse({ type: 'skill', id: UNE_COMPETENCE.id }).success).toBe(true);
    expect(typedRef().safeParse({ type: 'talent', id: UNE_COMPETENCE.id }).success).toBe(false);
  });

  it('`pick()` accepte « n parmi » et le tirage sur table, jamais les deux', () => {
    const p = pick('skill');
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE.id }] }).success).toBe(true);
    expect(p.safeParse({ pick: 1, table: { id: UNE_TABLE.id } }).success).toBe(true);
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE.id }], table: { id: UNE_TABLE.id } }).success).toBe(false);
    expect(p.safeParse({ pick: 1 }).success).toBe(false);
    expect(p.safeParse({ pick: 1, of: [] }).success).toBe(false);
  });

  it('une entrée de `of` est une réf NUE, une réf à SPÉCIALISATION, ou un `pick` IMBRIQUÉ', () => {
    const p = pick('skill');
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE.id }, { id: UNE_COMPETENCE_GROUPEE.id }] }).success).toBe(true);
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE_GROUPEE.id, spec: 'forgeron' }] }).success).toBe(true);
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE_GROUPEE.id, choix: true }] }).success).toBe(true);
    expect(p.safeParse({ pick: 2, of: [{ id: UNE_COMPETENCE.id }, { id: UNE_COMPETENCE_GROUPEE.id, choix: ['a', 'b'] }] }).success).toBe(true);
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE.id }, { pick: 1, table: { id: UNE_TABLE.id } }] }).success).toBe(true);
    expect(
      p.safeParse({
        pick: 1,
        of: [{ pick: 1, of: [{ id: UNE_COMPETENCE_GROUPEE.id, spec: 'orfevre' }, { pick: 1, of: [{ id: UNE_COMPETENCE.id }] }] }],
      }).success,
    ).toBe(true);
  });

  it('`of` REFUSE une graphie inconnue et fait TRAVERSER la validation de spécialisation', () => {
    const p = pick('skill');
    expect(p.safeParse({ pick: 1, of: [{ ref: { id: UNE_COMPETENCE.id } }] }).success).toBe(false);
    expect(p.safeParse({ pick: 1, of: [{ wildcard: { id: UNE_COMPETENCE.id } }] }).success).toBe(false);
    expect(p.safeParse({ pick: 1, of: [{ id: 'competence-qui-n-existe-pas' }] }).success).toBe(false);
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE_GROUPEE.id, spec: 'a', choix: true }] }).success).toBe(false);

    const pt = pick('talent');
    const specReelle = UN_TALENT_A_SPECS.specs![0].id;
    expect(pt.safeParse({ pick: 1, of: [{ id: UN_TALENT_A_SPECS.id, spec: specReelle }] }).success).toBe(true);
    const res = pt.safeParse({ pick: 1, of: [{ id: UN_TALENT_A_SPECS.id, spec: 'spec-hors-pool' }] });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/spec-hors-pool.*talents\.json/);
    expect(pt.safeParse({ pick: 1, of: [{ pick: 1, of: [{ id: UN_TALENT_A_SPECS.id, spec: 'spec-hors-pool' }] }] }).success).toBe(false);
  });

  /**
   * DEUX RÉGIMES, UN SEUL NŒUD (`_ids.generated.ts`) : le fichier généré figé au commit, et les ids
   * VIVANTS que `ref.ts` lit d'abord (`idsVivants(dataset) ?? IDS_PAR_DATASET[dataset]`, `ref.ts:77`),
   * posés par la couche donnée. Un schéma se construit une fois au chargement du module, la donnée se
   * valide après ; la liste admise doit donc se lire à la VALIDATION. Sans quoi une entité créée au
   * Compendium rendrait rouge toute donnée qui la référence.
   * Le test POSE une source vivante synthétique et repose la précédente : il ne mute aucun registre
   * partagé, et vaut que la couche donnée ait déjà posé la sienne dans ce worker ou non.
   */
  it('un schéma construit AVANT une mise à jour du registre voit la NOUVELLE liste', () => {
    const avant = (IDS_PAR_DATASET as unknown as Record<string, readonly string[]>)['etats.json'];
    const noeud = idDe('etat'); // construit AVANT la mise à jour
    expect(noeud.safeParse('etat-cree-au-compendium').success).toBe(false);
    const precedente = poserSourceDIdsVivants({
      entrees: (f) =>
        f === 'etats.json' ? [...avant.map((id) => ({ id })), { id: 'etat-cree-au-compendium' }] : precedente?.entrees(f),
      discriminantDe: (f) => precedente?.discriminantDe(f),
    });
    try {
      expect(noeud.safeParse('etat-cree-au-compendium').success).toBe(true);
      expect(idDe('etat').safeParse('etat-cree-au-compendium').success).toBe(true);
    } finally {
      poserSourceDIdsVivants(precedente);
    }
    expect(noeud.safeParse('etat-cree-au-compendium').success).toBe(false);
  });

  it('la MARCHE d’un `pick` récursif se coupe sur le nœud lui-même et rend ses slots', () => {
    const slots = slotsDe('src/data', 'jouet.json', pick('skill'));
    expect(slots.map((s) => s.path)).toEqual(['|0.of[]|0.id', '|0.of[]|1.id', '|1.table.id']);
    expect(new Set(slots.map((s) => s.type))).toEqual(new Set(['skill', 'table']));
  });

  it('la MARCHE retrouve la référence à son path exact (source de l’intégrité référentielle générique)', () => {
    const jouet = z.array(z.strictObject({ comp: ref('skill'), sorts: refs('spell').optional() }));
    expect(slotsDe('src/data', 'jouet.json', jouet)).toEqual([
      { root: 'src/data', dataset: 'jouet.json', path: '[].comp.id', type: 'skill', espece: 'id', cardinalite: 'liste' },
      { root: 'src/data', dataset: 'jouet.json', path: '[].sorts[]', type: 'spell', espece: 'id', cardinalite: 'liste' },
    ]);
    expect(cibleDe('skill')).toBe('skills.json');
  });
});

describe('specRef() — spécialisation ouverte vs pool fermé', () => {
  it('Compétence : spécialisation OUVERTE (`LDB 09 l.40`) — une spec créée passe', () => {
    expect(TYPES.skill.specsOpen).toBe(true);
    const r = specRef('skill');
    expect(r.safeParse({ id: UNE_COMPETENCE_GROUPEE.id, spec: 'une-specialisation-creee' }).success).toBe(true);
  });

  it('Talent : pool FERMÉ — une spec déclarée passe, une spec hors pool est nommée', () => {
    expect(TYPES.talent.specsOpen).toBe(false);
    const r = specRef('talent');
    expect(r.safeParse({ id: UN_TALENT_A_SPECS.id, spec: UN_TALENT_A_SPECS.specs![0].id }).success).toBe(true);
    const res = r.safeParse({ id: UN_TALENT_A_SPECS.id, spec: 'spec-hors-pool' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/spec-hors-pool.*talents\.json/);
  });

  it('« spec » XOR « choix » : jamais les deux, jamais aucun', () => {
    const r = specRef('skill');
    expect(r.safeParse({ id: UNE_COMPETENCE_GROUPEE.id, choix: true }).success).toBe(true);
    expect(r.safeParse({ id: UNE_COMPETENCE_GROUPEE.id, spec: 'a', choix: true }).success).toBe(false);
    expect(r.safeParse({ id: UNE_COMPETENCE_GROUPEE.id }).success).toBe(false);
  });

  it('REFUSE « spec » sur une Compétence qui n’est pas Groupée (`LDB 09 l.36-40`)', () => {
    const athletisme = (skillsJson as EntreeASpecs[]).find((s) => s.id === 'athletisme')!;
    expect(declareDesSpecs(athletisme)).toBe(false);
    expect(estSpecialisable('skill', 'athletisme')).toBe(false);
    const res = specRef('skill').safeParse({ id: 'athletisme', spec: 'bidon' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/ne déclare aucune spécialisation/);

    const savoir = (skillsJson as EntreeASpecs[]).find((s) => s.id === 'savoir')!;
    expect(declareDesSpecs(savoir)).toBe(true);
    expect(specRef('skill').safeParse({ id: 'savoir', spec: 'loi' }).success).toBe(true);
  });

  it('REFUSE « choix » quand l’univers de specs de l’entité est VIDE', () => {
    const aleatoire = (talentsJson as EntreeASpecs[]).find((t) => t.id === 'talent-aleatoire')!;
    expect(declareDesSpecs(aleatoire)).toBe(false);
    expect(specRef('talent').safeParse({ id: 'talent-aleatoire', choix: true }).success).toBe(false);
    expect(specRef('talent').safeParse({ id: 'talent-aleatoire', choix: [] }).success).toBe(false);
    expect(specRef('talent').safeParse({ id: 'talent-aleatoire', choix: ['x'] }).success).toBe(false);
  });

  it('un Talent à pool DÉRIVÉ (`specsSource`) est spécialisable et résout ses specs réelles', () => {
    const magie = (talentsJson as EntreeASpecs[]).find((t) => t.id === 'magie-des-arcanes')!;
    expect(magie.specsSource).toBeTruthy();
    expect(magie.specs).toBeUndefined();
    expect(estSpecialisable('talent', 'magie-des-arcanes')).toBe(true);
    expect(specRef('talent').safeParse({ id: 'magie-des-arcanes', spec: 'gueule' }).success).toBe(true);
    expect(specRef('talent').safeParse({ id: 'magie-des-arcanes', spec: 'domaine-inexistant' }).success).toBe(false);
  });
});

describe('byId — la PORTE de résolution d’une entité par son id STABLE', () => {
  it('rend l’entrée RÉELLE du dataset, et `undefined` sur un id absent', () => {
    expect(byId('skill', UNE_COMPETENCE.id)?.id).toBe(UNE_COMPETENCE.id);
    expect(byId('skill', `${UNE_COMPETENCE.id}-fantome`)).toBeUndefined();
  });

  it('le type d’entité paramètre le TYPE RENDU, et un type hors registre ne compile pas', () => {
    expectTypeOf(byId('skill', UNE_COMPETENCE.id)).toEqualTypeOf<SkillData | undefined>();
    // Le registre de la porte est CLOS au type près : un type de `TYPES` y entre avec le lot qui
    // migre son concept, et rien d'autre n'est appelable (« talent » ne compile pas aujourd'hui).
    expectTypeOf<TypeResolu>().toEqualTypeOf<'skill'>();
  });

  it("la porte zod FRAPPE la marque de type — `Id<'skill'>` en sortie, jamais un `string` nu", () => {
    expectTypeOf(idDe('skill').parse(UNE_COMPETENCE.id)).toEqualTypeOf<Id<'skill'>>();
    expectTypeOf(idDe('talent').parse(UN_TALENT_A_SPECS.id)).not.toEqualTypeOf<Id<'skill'>>();
    expectTypeOf<string>().not.toEqualTypeOf<Id<'skill'>>();
    const idCompetence = idDe('skill').parse(UNE_COMPETENCE.id);
    // @ts-expect-error — la marque de type ferme l'affectation croisée entre deux types d'entité.
    const idTalent: Id<'talent'> = idCompetence;
    expect(idTalent).toBe(UNE_COMPETENCE.id);
  });
});

/**
 * `avancement(type)` (`avancement.ts`) — la PORTE des champs `skills`/`talents` d'un Niveau de
 * Carrière et d'une espèce, composée de `refOuSpec(type)` | `pick(type, [tirage])` | `tirage`. Ce
 * qu'elle ferme se mesure sur les DEUX régimes de spécialisation (`spec` arrêtée, `choix` libre ou
 * borné), sur l'imbrication (`pick`/`of`), sur les trois graphies MORTES de l'avancement d'avant
 * L2 #1548 (`{ref}`, `{wildcard}`, `{choice}` — la donnée ne peut plus régresser vers elles), et sur
 * la séparation des TYPES (un id de Talent n'entre pas dans un emplacement de Compétence).
 */
describe('avancement() — l’emplacement d’avancement, vocabulaire CLOS', () => {
  const t = avancement('talent');
  const s = avancement('skill');
  const CAS: [string, unknown, ReturnType<typeof avancement>, boolean][] = [
    ['spéc arrêtée en ID', { id: 'savoir-vivre', spec: 'erudits' }, t, true],
    ['spéc arrêtée en LIBELLÉ', { id: 'savoir-vivre', spec: 'Érudit' }, t, false],
    ['spéc inconnue du pool', { id: 'savoir-vivre', spec: 'plombiers' }, t, false],
    ['choix BORNÉ en ids', { id: 'savoir-vivre', choix: ['criminels', 'guildes'] }, t, true],
    ['choix BORNÉ en libellés', { id: 'savoir-vivre', choix: ['Criminel', 'Guilde'] }, t, false],
    ['choix LIBRE', { id: 'savoir-vivre', choix: true }, t, true],
    ['id fantôme', { id: 'savoir-vivre-fantome' }, t, false],
    ['`spec` ET `choix` ensemble', { id: 'savoir-vivre', spec: 'erudits', choix: true }, t, false],
    ['« n parmi », branche de tirage comprise', { pick: 1, of: [{ id: 'savoir-vivre', spec: 'erudits' }, { random: 1 }] }, t, true],
    ['tirage « n aléatoires »', { random: 2 }, t, true],
    ['tirage de ZÉRO', { random: 0 }, t, false],
    ['graphie MORTE `{ref}`', { ref: { id: 'savoir-vivre' } }, t, false],
    ['graphie MORTE `{wildcard}`', { wildcard: { id: 'savoir-vivre' } }, t, false],
    ['graphie MORTE `{choice}`', { choice: [{ ref: { id: 'savoir-vivre' } }] }, t, false],
    ['Compétence : spéc de catalogue', { id: 'signes-secrets', spec: 'guilde' }, s, true],
    // La spécialisation de COMPÉTENCE est OUVERTE (`LDB 09 l.40`) : une spéc hors catalogue passe au
    // schéma, y compris l'id `guilde-au-choix` fusionné dans `guilde` au commit 4. C'est la DONNÉE
    // qui est gardée contre sa survivance (`src/data/refs-migrated.test.ts`, 14 paires nommées), pas
    // la porte — un pool FERMÉ de Compétence contredirait le RAW.
    ['Compétence : spéc HORS catalogue (spécialisation ouverte)', { id: 'signes-secrets', spec: 'guilde-au-choix' }, s, true],
    ['un id de TALENT dans un emplacement de Compétence', { id: 'savoir-vivre' }, s, false],
  ];

  it.each(CAS)('%s → %s', (_nom, valeur, porte, attendu) => {
    expect(porte.safeParse(valeur).success).toBe(attendu);
  });
});

describe('prose adressée — forme et verrous (#1389 Lot A, épique #1388)', () => {
  const ENV = (type: string) => ({ id: 'x', type, label: 'X' });
  /** Un type de document ABSENT du stock de prose inline : V3 y mord. */
  const HORS_STOCK = 'fiche-jouet';
  /** Un type PRÉSENT au stock : sa prose inline reste admise le temps de sa migration. */
  const [AU_STOCK] = Object.keys(PROSE_INLINE_TOLEREE);
  const jouet = (type: string, exiges?: readonly CleExigible[]) =>
    document(type, 'entite', { max: z.number().optional() }, { max: { label: 'Max' } }, EXPOSITION, exiges ? { exiges } : undefined);

  const FRAGMENT = { kind: 'blocs', sec: 'les-tests', secOcc: 1, b0: 0, b1: 2, sum: '0123456789abcdef' } as const;
  const ADRESSE = { book: 'livre-de-base', ch: '13', parts: [FRAGMENT] };
  /** Adresse dans un livre RÉEL sans extraction : irrésoluble. */
  const ADRESSE_IRRESOLUBLE = { ...ADRESSE, book: SOURCE_SANS_EXTRACTION.book };

  it('la FORME de l’adresse est la MÊME que celle du parseur de découpe (aucune 2ᵉ définition)', () => {
    expectTypeOf<z.infer<typeof descRefSchema>>().toEqualTypeOf<DescRefParseur>();
  });

  it('une adresse VALIDE est acceptée, et son livre doit être un livre EXTRAIT (V2)', () => {
    const doc = jouet(HORS_STOCK);
    expect(doc.entree.safeParse({ ...ENV(HORS_STOCK), source: SOURCE_REELLE, descRef: ADRESSE }).success).toBe(true);
    const ko = doc.entree.safeParse({ ...ENV(HORS_STOCK), source: SOURCE_SANS_EXTRACTION, descRef: ADRESSE_IRRESOLUBLE });
    expect(ko.success).toBe(false);
    expect(ko.error!.issues.map((i) => i.path.join('.'))).toContain('descRef.book');
    expect(ko.error!.issues.map((i) => i.message).join(' ')).toMatch(/sans extraction/);
  });

  it('V1 — `desc` ET `descRef` ensemble : un texte, un porteur', () => {
    const ko = jouet(AU_STOCK).entree.safeParse({
      ...ENV(AU_STOCK),
      source: SOURCE_REELLE,
      desc: 'Une prose.',
      descRef: ADRESSE,
    });
    expect(ko.success).toBe(false);
    expect(ko.error!.issues.map((i) => i.path.join('.'))).toContain('descRef');
    expect(ko.error!.issues.map((i) => i.message).join(' ')).toMatch(/un texte, un porteur/);
  });

  it('V2b — la `source` et l’adresse doivent citer le MÊME livre', () => {
    const ko = jouet(HORS_STOCK).entree.safeParse({
      ...ENV(HORS_STOCK),
      source: { book: 'aux-armes', page: 42 },
      descRef: ADRESSE,
    });
    expect(ko.success).toBe(false);
    expect(ko.error!.issues.map((i) => i.message).join(' ')).toMatch(/un autre livre que l'adresse/);
  });

  it('V3 — une prose recopiée d’un livre EXTRAIT est refusée hors stock, admise au stock, `maison` ou pas', () => {
    const inline = (type: string, extra: Record<string, unknown> = {}) =>
      jouet(type).entree.safeParse({ ...ENV(type), source: SOURCE_REELLE, desc: 'Une prose du livre.', ...extra });
    const ko = inline(HORS_STOCK);
    expect(ko.success).toBe(false);
    expect(ko.error!.issues.map((i) => i.path.join('.'))).toContain('desc');
    expect(ko.error!.issues.map((i) => i.message).join(' ')).toMatch(/l'entrée l'ADRESSE/);
    expect(inline(AU_STOCK).success).toBe(true);
    // `maison` ne DISPENSE pas : le champ dit ce que le canon ne tranche pas, il ne dit pas d’où
    // vient le texte — 32 nœuds portent les deux (mesure du 2026-09-05).
    expect(inline(HORS_STOCK, { maison: 'une raison' }).success).toBe(false);
    // Un livre SANS extraction n’est pas adressable : sa prose reste inline, hors stock comprise.
    expect(
      jouet(HORS_STOCK).entree.safeParse({ ...ENV(HORS_STOCK), source: SOURCE_SANS_EXTRACTION, desc: 'Une prose.' }).success,
    ).toBe(true);
  });

  it('V4 — `exiges: [desc]` exige la PROSE, satisfaite par l’un OU l’autre porteur', () => {
    const strict = jouet(HORS_STOCK, ['desc']);
    const nue = strict.entree.safeParse({ ...ENV(HORS_STOCK), source: SOURCE_REELLE });
    expect(nue.success).toBe(false);
    expect(nue.error!.issues.map((i) => i.path.join('.'))).toContain('desc');
    expect(nue.error!.issues.map((i) => i.message).join(' ')).toMatch(/prose obligatoire/);
    expect(strict.entree.safeParse({ ...ENV(HORS_STOCK), source: SOURCE_REELLE, descRef: ADRESSE }).success).toBe(true);
    expect(strict.entree.safeParse({ ...ENV(HORS_STOCK), source: SOURCE_SANS_EXTRACTION, desc: 'Une prose.' }).success).toBe(true);
  });

  it('les verrous STRUCTURELS de l’adresse : ≤ 3 fragments, empreinte de 16 hex, bornes ordonnées', () => {
    const quatre = { ...ADRESSE, parts: [FRAGMENT, FRAGMENT, FRAGMENT, FRAGMENT] };
    expect(descRefSchema.safeParse(quatre).success).toBe(false);
    expect(descRefSchema.safeParse({ ...ADRESSE, parts: [] }).success).toBe(false);
    expect(descRefSchema.safeParse({ ...ADRESSE, parts: [{ ...FRAGMENT, sum: '0123456789ab' }] }).success).toBe(false);
    // Le `ch` est la GRAPHIE du numéro de chapitre : des chiffres, DEUX au minimum, sans plafond de
    // largeur — un livre découpé à la section passe la centaine (#1739). La largeur JUSTE pour le
    // livre se juge contre le disque (`src/data/prose-resolution.test.ts`, volet F).
    expect(descRefSchema.safeParse({ ...ADRESSE, ch: '7' }).success).toBe(false);
    expect(descRefSchema.safeParse({ ...ADRESSE, ch: '105' }).success).toBe(true);
    expect(descRefSchema.safeParse({ ...ADRESSE, ch: 'ch7' }).success).toBe(false);
    // `00` nomme l'index d'extraction, qui n'est pas un chapitre : aucune adresse ne l'atteint.
    expect(descRefSchema.safeParse({ ...ADRESSE, ch: '00' }).success).toBe(false);
    const inversees = descRefSchema.safeParse({ ...ADRESSE, parts: [{ ...FRAGMENT, b0: 5, b1: 2 }] });
    expect(inversees.success).toBe(false);
    expect(inversees.error!.issues.map((i) => i.path.join('.'))).toContain('parts.0.b1');
    // Le fragment de CELLULE adresse par clé de LIGNE × en-tête de COLONNE, en chaînes.
    const cellule = { ...ADRESSE, parts: [{ kind: 'cellule', sec: 'table', secOcc: 1, row: '01-10', col: 'Effet', sum: '0123456789abcdef' }] };
    expect(descRefSchema.safeParse(cellule).success).toBe(true);
    expect(descRefSchema.safeParse({ ...cellule, parts: [{ ...cellule.parts[0], row: '' }] }).success).toBe(false);
  });

  it('`proseAdressable` porte la MÊME forme et les MÊMES verrous sur un schéma de RANGÉE', () => {
    const rangee = proseAdressable(z.strictObject({ roll: z.number(), source: sourceRefSchema.optional() }), {
      type: HORS_STOCK,
      site: `${HORS_STOCK}>rangee`,
      exigeProse: true,
    });
    expect(rangee.safeParse({ roll: 1, descRef: ADRESSE }).success).toBe(true);
    expect(rangee.safeParse({ roll: 1 }).success).toBe(false);
    const ko = rangee.safeParse({ roll: 1, source: SOURCE_REELLE, desc: 'Une prose du livre.' });
    expect(ko.success).toBe(false);
    expect(ko.error!.issues.map((i) => i.message).join(' ')).toContain(`${HORS_STOCK}>rangee`);
  });

  it('`versDisque` retire le `desc` MATÉRIALISÉ d’un nœud adressé, à toute profondeur, et lui seul', () => {
    const racine = {
      id: 'a',
      desc: 'prose inline conservée',
      entries: [
        { id: 'b', descRef: ADRESSE, desc: 'prose matérialisée' },
        { id: 'c', desc: 'prose inline conservée' },
        { niche: { descRef: ADRESSE, desc: 'prose matérialisée' } },
      ],
    };
    const disque = versDisque(racine) as typeof racine;
    expect(disque.desc).toBe('prose inline conservée');
    expect(disque.entries[0]).toEqual({ id: 'b', descRef: ADRESSE });
    expect(disque.entries[1]).toEqual({ id: 'c', desc: 'prose inline conservée' });
    expect((disque.entries[2] as unknown as { niche: unknown }).niche).toEqual({ descRef: ADRESSE });
    // PURE : l’entrée n’est jamais mutée.
    expect(racine.entries[0].desc).toBe('prose matérialisée');
    // Sans aucune adresse, la forme disque est celle de l’entrée, à l’octet.
    const sansAdresse = { id: 'a', entries: [{ id: 'b', desc: 'prose' }] };
    expect(JSON.stringify(versDisque(sansAdresse))).toBe(JSON.stringify(sansAdresse));
  });
});

/**
 * ENUM NOMMÉ (#1694) — le libellé FR d'une VALEUR vit SUR LE NŒUD, à sa déclaration (`enumNomme`,
 * `grammaire/valeurs.ts`), et se lit par `valeursDe`/`libelleDeValeur` (`grammaire/meta.ts`). Couverture
 * et ORDRE sont vrais PAR CONSTRUCTION : les options SONT les clés de la table de libellés — il n'y a
 * plus rien à vérifier au montage d'un document. Ce qui se vérifie ici : la lecture À TRAVERS les
 * enveloppes, et le REFUS explicite des deux opérations qui perdraient les libellés en silence.
 */
describe('enumNomme — le libellé d’une valeur vit sur le NŒUD', () => {
  const voie = enumNomme({ a: 'Aile', b: 'Boue' });

  it('les options SONT les clés de la table, dans son ordre — et le nœud rend ses libellés', () => {
    expect(optionsEnum(voie)).toEqual(['a', 'b']);
    expect(valeursDe(voie)).toEqual({ a: 'Aile', b: 'Boue' });
    expect(libelleDeValeur(voie, 'b')).toBe('Boue');
  });

  it('se lit À TRAVERS `optional`, `array`, `default`, et sous un champ de document scellé', () => {
    expect(valeursDe(voie.optional())).toEqual({ a: 'Aile', b: 'Boue' });
    expect(valeursDe(z.array(voie))).toEqual({ a: 'Aile', b: 'Boue' });
    expect(valeursDe(voie.default('a'))).toEqual({ a: 'Aile', b: 'Boue' });
    const fiche = document('talent', 'entite', { voie }, { voie: { label: 'Voie' } } as never, EXPOSITION);
    expect(valeursDe((fiche.entree as unknown as { _zod: { def: { in: { _zod: { def: { shape: Record<string, unknown> } } } } } })._zod.def.in._zod.def.shape.voie)).toEqual({ a: 'Aile', b: 'Boue' });
  });

  it('un nœud NON nommé n’a pas de libellés, et sa valeur se rend BRUTE', () => {
    expect(valeursDe(z.enum(['a', 'b']))).toBeUndefined();
    expect(valeursDe(z.string())).toBeUndefined();
    expect(libelleDeValeur(z.enum(['a', 'b']), 'a')).toBe('a');
  });

  it('REFUSE `.extract`/`.exclude` — un sous-enum perdrait ses libellés en silence', () => {
    expect(() => (voie as unknown as { extract: (o: string[]) => unknown }).extract(['a'])).toThrow(/\.extract\(\).*enum NOMMÉ/s);
    expect(() => (voie as unknown as { exclude: (o: string[]) => unknown }).exclude(['b'])).toThrow(/\.exclude\(\).*enum NOMMÉ/s);
  });

  it('voit l’enum À TRAVERS `optional` et `array` (le champ reste un univers fermé)', () => {
    expect(optionsEnum(z.enum(['a', 'b']).optional())).toEqual(['a', 'b']);
    expect(optionsEnum(z.array(z.enum(['a', 'b'])))).toEqual(['a', 'b']);
    expect(optionsEnum(z.string())).toBeUndefined();
  });
});

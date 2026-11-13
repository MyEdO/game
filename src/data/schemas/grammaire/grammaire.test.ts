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
import { join, resolve } from 'node:path';
import { listerDossier } from '../../../../scripts/guards/lib/lister.mjs';
import { z } from 'zod';
import merchantsJson from '../../merchants.json';
import skillsJson from '../../skills.json';
import talentsJson from '../../talents.json';
import traitsJson from '../../traits.json';
import { adressesDesEntreesEmbarquees, document, documentDeLEntreePartielle, exclusiviteAdapteDe, CLES_ENVELOPPE, CLES_EXIGIBLES, META_CHARGE, optionsEnum, type DeclarationExposition, type Exposition, type CleExigible, type DocumentHandle } from './document';
import { libelleDeValeur, metaDesChamps, valeursDe, nommerNoeud } from './meta';
import { descRefSchema, enumNomme, sourceRefSchema } from './valeurs';
import { proseAdressable, versDisque } from './prose';
import { PROSE_INLINE_TOLEREE } from './prose-inline';
import type { DescRef as DescRefParseur } from '../../source/decoupe';
import { ref, refs, specRef, refOuSpec, pick, tirageSurTable, idDe, estSpecialisable, entreeOuverte, refusDeSpec, type Id } from './ref';
import { flowTestSchema } from './mecanique';
import { byId, type SkillData, type TypeResolu } from '../../index';
import { avancement } from './avancement';
import { SANS_LIVRE_DEFINITIF } from './sans-livre';
import { SCHEMA_DEFS } from '../_registry.generated';
import { entreePartielle as creaturePartielle } from '../defs/creatures';
import { IDS_PAR_ESPACE } from '../_ids.generated';
import { poserRegimeVivant } from './idsVivants';
import { defDe, enfantsDe } from './descente';
import { noeudObjet, validateDataset } from '../validate';
import { estObjet } from '../../../lib/objet.mjs';

type EntreeASpecs = { id: string; specs?: { id: string }[]; specsSource?: string };
const UNE_COMPETENCE = skillsJson[0] as { id: string };
const UNE_COMPETENCE_GROUPEE = (skillsJson as EntreeASpecs[]).find((s) => s.specs?.length)!;
const UN_TALENT_A_SPECS = (talentsJson as EntreeASpecs[]).find((t) => t.specs?.length)!;
const declareDesSpecs = (e: EntreeASpecs) => !!(e.specs?.length || e.specsSource);

const SOURCE_REELLE = { book: 'livre-de-base', page: 118 };
/** Livre VF RÉEL dont `books.json` ne porte AUCUN `dir` : rien n'est extrait, donc rien n'est
 *  adressable — une prose y reste inline légitimement (verrou V3, `grammaire/prose.ts`).
 *  Fixture SYNTHÉTIQUE : `page: 1` est un remplissage de forme, PAS une citation — aucun folio de ce
 *  livre n'est allégué ici. Le livre, lui, est bien VF (AGENTS.md § Sources VF : la VO ne se cite pas). */
const SOURCE_SANS_EXTRACTION = { book: 'boite-d-initiation', page: 1 };
const EXPOSITION: DeclarationExposition = { codex: { keys: ['talents'] }, edit: { dataset: 'talents.json' } };

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
    const [typeSansLivre] = Object.keys(SANS_LIVRE_DEFINITIF);
    const rendu = document(typeSansLivre, 'config', { valeur: z.number() }, { valeur: { label: 'Valeur' } }, EXPOSITION);
    expect(rendu.schema.safeParse({ id: 'x', type: typeSansLivre, label: 'X', valeur: 1 }).success).toBe(true);
    const typeHorsListe = 'type-jouet-hors-liste';
    expect(SANS_LIVRE_DEFINITIF[typeHorsListe]).toBeUndefined();
    const exige = document(typeHorsListe, 'config', { valeur: z.number() }, { valeur: { label: 'Valeur' } }, EXPOSITION);
    expect(exige.schema.safeParse({ id: 'x', type: typeHorsListe, label: 'X', valeur: 1 }).success).toBe(false);
    expect(exige.schema.safeParse({ id: 'x', type: typeHorsListe, label: 'X', valeur: 1, source: SOURCE_REELLE }).success).toBe(true);
  });

  it('exige une PROVENANCE : `source` OU `maison`, jamais NI L’UN NI L’AUTRE (#1467 L1b)', () => {
    const nu = { id: 'a', type: 'talent', label: 'A', max: 2 };
    // Sans provenance : refusé, au chemin du champ attendu, la faute dite en français.
    const ko = fiche.entree.safeParse(nu);
    expect(ko.success).toBe(false);
    expect(ko.error!.issues.map((i) => ({ path: i.path, message: i.message }))).toEqual([
      { path: ['source'], message: 'provenance manquante : cite le livre et la page, ou dis la raison maison de l’entrée.' },
    ]);
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
      document('jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, { codex: {}, edit: { object: 'unique' } }),
    ).toThrow(/`codex` exige/);
    expect(() =>
      // @ts-expect-error — `edit` vide : ni `dataset`, ni `object`, ni `niche`, ni `none`.
      document('jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, { codex: { keys: ['x'] }, edit: {} }),
    ).toThrow(/`edit` exige/);
    expect(() =>
      document('jouet', 'config', { max: z.number() }, { max: { label: 'Max' } }, { edit: { niche: { categories: {} } } }),
    ).toThrow(/`edit.niche.categories` exige/);
    const nichee = document(
      'jouet',
      'config',
      { max: z.number() },
      { max: { label: 'Max' } },
      { edit: { niche: { categories: { y: 'y.entries', x: 'x' } } } },
    );
    expect(nichee.exposition).toEqual({ codex: { keys: ['y', 'x'] }, edit: { niche: { categories: { y: 'y.entries', x: 'x' } } } });
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

  it('`adressesDesEntreesEmbarquees` : les adresses où un schéma embarque une entrée partielle, et elles seules (#2206)', () => {
    const avec = z.strictObject({ a: z.array(z.strictObject({ fiche: (creaturePartielle as z.ZodType).optional() })), b: z.strictObject({ autre: creaturePartielle as z.ZodType }) });
    const sans = z.strictObject({ a: z.array(z.strictObject({ fiche: z.unknown().optional() })) });
    expect(adressesDesEntreesEmbarquees([avec])).toEqual(['a[].fiche', 'b.autre']);
    expect(adressesDesEntreesEmbarquees([sans])).toEqual([]);
  });

  it('`exclusiviteAdapteDe` : `adapteDe` refusé quand une entrée embarquée ADRESSE sa prose, la clé fautive nommée (#2206)', () => {
    const objet = z.strictObject({ fiche: (creaturePartielle as z.ZodType).optional(), adapteDe: sourceRefSchema.optional() });
    const schema = objet.superRefine(exclusiviteAdapteDe(objet));
    const disque = JSON.parse(readFileSync(resolve(__dirname, '../../../scenes/diligence/diligence-projet.json'), 'utf8')) as { narratif: { presetsPnj: { profil?: { descRef?: unknown } }[] } };
    const descRef = disque.narratif.presetsPnj.map((p) => p.profil?.descRef).find((r) => r !== undefined);
    const ko = schema.safeParse({ fiche: { descRef }, adapteDe: SOURCE_REELLE });
    expect(ko.error?.issues.map((i) => ({ path: i.path, message: i.message }))).toEqual([
      { path: ['adapteDe'], message: 'texte adapté, alors que la description de « fiche » est la copie adressée du livre.' },
    ]);
    expect(schema.safeParse({ fiche: { desc: 'Un texte adapté.' }, adapteDe: SOURCE_REELLE }).success).toBe(true);
  });

  it('marque l’entrée PARTIELLE de son document — et elle seule', () => {
    expect(documentDeLEntreePartielle(fiche.entreePartielle)).toBe(fiche.schema);
    expect(documentDeLEntreePartielle(fiche.entree)).toBeUndefined();
    expect(documentDeLEntreePartielle(fiche.schema)).toBeUndefined();
    expect(documentDeLEntreePartielle(z.object({}))).toBeUndefined();
    expect(documentDeLEntreePartielle(undefined)).toBeUndefined();
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
    expect(jouet.entree.safeParse({ ...BASE, variants: [{ when: { rule: 'combat-aa-avantage-groupe' }, max: 4 }] }).success).toBe(true);
  });

  it('REFUSE un champ hors liste, et une variante sans `when`', () => {
    expect(jouet.entree.safeParse({ ...BASE, variants: [{ when: { rule: 'combat-aa-avantage-groupe' }, tests: 'Ténacité' }] }).success).toBe(false);
    expect(jouet.entree.safeParse({ ...BASE, variants: [{ max: 4 }] }).success).toBe(false);
  });

  it('REFUSE tout `variants` à un document qui n’en déclare aucun, et un champ republiable inconnu', () => {
    const sansVariante = document('talent', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION);
    expect(sansVariante.entree.safeParse({ ...BASE, variants: [{ when: { rule: 'combat-aa-avantage-groupe' }, max: 4 }] }).success).toBe(false);
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
      rangee: z.strictObject({ id: z.string(), min: z.number(), max: z.number(), label: z.string() }),
      deDeTirage: true,
    }),
    rangeesConfig: document('config-table-jouet', 'config', {}, {}, EXPOSITION, {
      rangee: z.strictObject({ id: z.string(), min: z.number(), max: z.number(), label: z.string() }),
    }),
    // Réplique d'une table à rangées SANS `id` (`tables.json`) : la rangée se désigne par sa fourchette.
    rangeesSansId: document('table-sans-id-jouet', 'entite', {}, {}, EXPOSITION, {
      rangee: z.strictObject({ min: z.number(), max: z.number(), label: z.string() }),
      deDeTirage: true,
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
    const t = { ...ENV('table-jouet'), die: '1d100', entries: [{ id: 'rien', min: 1, max: 10, label: 'Rien' }] };
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
    expect(schema.safeParse([{ ...t, entries: [{ id: 'rien', min: 1, max: 10, label: 'Rien', inconnu: 1 }] }]).success).toBe(false);
    // Les rangées sont une collection à clé `id` : un id en double est refusé, l'id NOMMÉ.
    const double = schema.safeParse([{ ...t, entries: [...t.entries, { ...t.entries[0], min: 11, max: 20 }] }]);
    expect(double.success).toBe(false);
    expect(double.error?.issues.map((i) => i.message)).toContain('« rien » dupliqué : « id » identifie l’élément dans sa liste, il y est unique.');
    // Le dé se lit en `DiceSpec` (`deDeTirageSchema`) : 2d10 passe, une expression illisible est refusée.
    expect(schema.safeParse([{ ...t, die: '2d10' }]).success).toBe(true);
    expect(schema.safeParse([{ ...t, die: 'un dé' }]).success).toBe(false);
  });

  it('document à `rangee` SANS `id` : `entries` est une liste ordonnée, chaque rangée validée', () => {
    const { schema } = REPLIQUES.rangeesSansId;
    const rangee = { min: 1, max: 10, label: 'Rien' };
    expect(schema.safeParse([{ ...ENV('table-sans-id-jouet'), die: 'd10', entries: [rangee, { ...rangee, min: 11, max: 20 }] }]).success).toBe(true);
    expect(schema.safeParse([{ ...ENV('table-sans-id-jouet'), die: 'd10', entries: [{ ...rangee, id: 'rien' }] }]).success).toBe(false);
  });

  it('`rangee` en famille `config` : le document EST son fichier, et porte sa charge', () => {
    const { schema } = REPLIQUES.rangeesConfig;
    const t = { ...ENV('config-table-jouet'), entries: [{ id: 'rien', min: 1, max: 10, label: 'Rien' }] };
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
      document('record-a-rangees', 'record', {}, {}, EXPOSITION, { valeurRecord: z.string(), rangee: z.strictObject({ id: z.string() }) }),
    ).toThrow(/document\('record-a-rangees'\) : `rangee` et la famille « record » sont EXCLUSIVES/);
    expect(() =>
      document('record-a-de', 'record', {}, {}, EXPOSITION, { valeurRecord: z.string(), deDeTirage: true }),
    ).toThrow(/document\('record-a-de'\) : `deDeTirage` exige `rangee`/);
  });

  it('un def à `rangee` qui redéclare `entries` ou `die` dans ses `champs` est REFUSÉ (la fabrique les pose)', () => {
    expect(() =>
      document('table-doublon', 'entite', { entries: z.array(z.number()) }, { entries: { label: 'Rangées' } }, EXPOSITION, {
        rangee: z.strictObject({ id: z.string() }),
      }),
    ).toThrow(/document\('table-doublon'\) : la fabrique pose « entries » \(charge du document\)/);
    expect(() =>
      document('table-de-doublon', 'config', { die: z.string() }, { die: { label: 'Dé' } }, EXPOSITION, {
        rangee: z.strictObject({ id: z.string() }),
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
    // zod 4.4.3, mesuré : une clé ÉNUMÉRÉE rend le record TOTAL — une clé déclarée qui manque est
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

  it('chaque def du registre porte une `exposition` conforme (codex, edit)', () => {
    const fautifs: string[] = [];
    for (const def of SCHEMA_DEFS) {
      const exposition = (def as { file: string; exposition?: Exposition }).exposition;
      if (!exposition) {
        fautifs.push(`${def.file} : aucune \`exposition\``);
        continue;
      }
      const c = exposition.codex as { keys?: readonly string[]; exempt?: { raison?: string } };
      const e = exposition.edit as { dataset?: string; object?: string; niche?: { categories?: Readonly<Record<string, unknown>> }; none?: string };
      const keys = Array.isArray(c.keys) && c.keys.length ? c.keys : undefined;
      if (!keys && !c.exempt?.raison) fautifs.push(`${def.file} : \`codex\` sans \`keys\` ni \`exempt\` motivé`);
      if (!e.dataset && !e.object && !e.none && !e.niche) fautifs.push(`${def.file} : \`edit\` sans route déclarée`);
      if (e.niche) {
        const carte = e.niche.categories;
        const cats = estObjet(carte) ? Object.keys(carte) : [];
        if (!(cats.length && cats.every((k) => k.length && typeof carte![k] === 'string' && (carte![k] as string).length))) {
          fautifs.push(`${def.file} : \`edit.niche.categories\` vide ou mal formée`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });
});

describe('tout def `entite` tient son enveloppe de `document()`', () => {
  // Un def adopté par `document()` rend un nœud SCELLÉ, sans `.shape` : son enveloppe est celle de la fabrique, et
  // ses exigences se lisent au verrou ci-dessous. Un def qui expose encore une `.shape` écrit son enveloppe à la main.
  const noeudInterne = (n: unknown): unknown => {
    const type = defDe(n)?.type;
    if (type === undefined || type === 'pipe' || type === 'lazy') return undefined;
    return enfantsDe(n).find((e) => e.segment === (type === 'array' ? '[]' : ''))?.noeud;
  };
  const shapeDe = (schema: unknown): Record<string, z.ZodType> | undefined => {
    let n: unknown = schema;
    for (let i = 0; i < 12 && n; i++) {
      const shape = (n as { shape?: Record<string, z.ZodType> }).shape;
      if (shape) return shape;
      n = noeudInterne(n);
    }
    return undefined;
  };

  it('le DÉTECTEUR mord encore — sur un schéma NON adopté, il VOIT les trois clés requises', () => {
    const shape = shapeDe(z.array(z.strictObject({ desc: z.string(), source: z.string(), icon: z.string() })));
    expect(shape, '`shapeDe` ne descend plus jusqu’à la forme d’un def non adopté').toBeDefined();
    const requises = (['desc', 'source', 'icon'] as const).filter((k) => shape![k] && !shape![k].safeParse(undefined).success);
    expect(requises).toEqual(['desc', 'source', 'icon']);
  });

  it('aucun def `entite` n’écrit son enveloppe à la main', () => {
    const aLaMain = SCHEMA_DEFS.filter((d) => d.famille === 'entite' && shapeDe(d.schema)).map((d) => d.file);
    expect(aLaMain).toEqual([]);
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
  const RACINE = resolve(__dirname, '../..');
  const CLES = ['labelF', 'desc', 'source', 'alsoIn', 'maison', 'icon'] as const;
  type Cle = (typeof CLES)[number];

  /**
   * Un def `entite` est ADOPTÉ quand l'élément de sa liste est un `ZodPipe` — la forme EXACTE que
   * `document()` rend (`affine.pipe(...)`). Le critère « pas de `.shape` » ne suffirait pas : il est
   * négatif, donc satisfait par tout nœud opaque (une union, un `ZodLazy`) qu'aucune fabrique n'a
   * scellé — il ferait entrer dans la population des defs dont l'enveloppe est écrite à la main, et
   * le verrou d'exigence y serait mesuré sur un contrat que `document()` ne porte pas.
   */
  const adopte = (schema: unknown): boolean => defDe(enfantsDe(schema).find((e) => e.segment === '[]')?.noeud)?.type === 'pipe';

  /** Dataset RÉEL complet (jamais une entrée isolée : `affinerDataset` peut exiger la liste entière —
   *  `names.json` refuse tout tableau qui n'a pas ses 7 races). */
  const dataset = (fichier: string): Record<string, unknown>[] | undefined => {
    const brut = JSON.parse(readFileSync(join(RACINE, fichier), 'utf8')) as unknown;
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
    'sea-shanties.json · desc',
    'sea-shanties.json · source',
    // vague 11b — `axes` est le premier document à EXIGER `maison` (mécanique maison, aucun folio).
    'axes.json · maison',
    'careers.json · desc',
    'careers.json · source',
    'characteristics.json · desc',
    'characteristics.json · source',
    'locations.json · source',
    'mutations.json · desc',
    'qualities.json · desc',
    'qualities.json · source',
    'regles.json · desc',
    'regles.json · source',
    // vague 12 — 17 exigences NEUVES, chacune MORDANTE (la paire n'entre dans la population que si
    // l'entrée amputée est refusée par le schéma). `talents` n'exige que `source` : l'écart est
    // motivé au mesureur ci-dessus (entrée MÉTA `talent-aleatoire`, sans prose).
    'etats.json · desc',
    'etats.json · source',
    'maladies.json · desc',
    'maneuvers.json · source',
    'naval-ports.json · source',
    'naval-traits.json · desc',
    'skills.json · desc',
    'skills.json · source',
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
    'presets-de-personnage.json · source',
    'psychology.json · desc',
    'psychology.json · source',
    'species.json · source',
    'spells.json · desc',
    'spells.json · source',
    'tavernGames.json · desc',
    'tavernGames.json · source',
    'trappings.json · source',
    // #677 — `reseau-routier` naît adopté : ses 15 entrées portent toutes leur folio EDOC, `source`
    // est donc exigible dès la création. `desc` ne l'est pas (les 6 compagnies de la liste l.27-34
    // n'ont que leur nom au Source — aucune prose à recopier, aucune à inventer).
    'reseau-routier.json · source',
    // #3884 — les prétirés officiels sont des fiches imprimées : chacune adresse son folio et sa prose
    // (« Apparence et personnalité », « Historique »).
    'pregens.json · desc',
    'pregens.json · source',
    // #1657 — `ship-stations` naît adopté : chacune des 5 présences porte le VERBATIM de la
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
    // #1681 — les quatre datasets d'enjeux fusionnent en `stakes` : chaque entrée cite son passage.
    'stakes.json · source',
    // #1684 — les deux catalogues de cargaisons fusionnent en `cargoes` : chaque entrée cite sa table
    // (MDG 15, MSRC 13).
    'cargoes.json · source',
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
    const messages = (doc: DocumentHandle<string>) =>
      CORPUS.flatMap((v) => {
        const r = doc.entree.safeParse({ ...v, type: 'fiche-jouet' });
        return r.success ? [] : r.error.issues.map((i) => i.message);
      });
    const REFINE = /provenance manquante/;
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
    const sansIcone = { ...ENV('fiche-jouet'), max: 2, alsoIn: [{ book: 'aux-armes', page: 12 }] };
    const base = { ...sansIcone, icon: 'melee/au-contact' };
    expect(strict.entree.safeParse(base).success).toBe(true);
    expect(strict.entree.safeParse({ ...base, icon: '' }).success).toBe(false);
    expect(strict.entree.safeParse({ ...base, alsoIn: [] }).success).toBe(false);
    // Non exigées, ces mêmes clés restent optionnelles et `alsoIn` admet `[]` (l'option n'est pas un durcissement global).
    const libre = document('fiche-jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION);
    expect(libre.entree.safeParse({ ...sansIcone, alsoIn: [] }).success).toBe(true);
    expect(strict.entree.safeParse(sansIcone).success).toBe(false);
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

  it('REFUSE un id inventé en nommant l’id, le catalogue et le dataset', () => {
    const res = ref('skill').safeParse({ id: 'competence-qui-n-existe-pas' });
    expect(res.success).toBe(false);
    expect(res.error?.issues.map((i) => i.message)).toEqual([
      '« competence-qui-n-existe-pas » est absent du catalogue des compétences (skills.json).',
    ]);
  });

  it('compose FERMÉ avec les champs du porteur (`extra`) et refuse le reste', () => {
    const possede = ref('skill', { advances: nommerNoeud(z.number(), { nom: 'avancées' }) });
    expect(possede.safeParse({ id: UNE_COMPETENCE.id, advances: 3 }).success).toBe(true);
    expect(possede.safeParse({ id: UNE_COMPETENCE.id, advances: 3, value: 40 }).success).toBe(false);
  });

  it('`refs()` valide chaque id de la liste', () => {
    expect(refs('skill').safeParse([UNE_COMPETENCE.id]).success).toBe(true);
    expect(refs('skill').safeParse([UNE_COMPETENCE.id, 'inconnu']).success).toBe(false);
  });

  it('les choix et tirages composent leurs propres références', () => {
    const p = pick('skill');
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE.id }] }).success).toBe(true);
    expect(tirageSurTable(z.enum(['rencontre'])).safeParse({ pick: 1, table: 'rencontre' }).success).toBe(true);
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE.id }], table: 'rencontre' }).success).toBe(false);
    expect(p.safeParse({ pick: 1 }).success).toBe(false);
    expect(p.safeParse({ pick: 1, of: [] }).success).toBe(false);
  });

  it('une entrée de `of` est une réf NUE, une réf à SPÉCIALISATION, ou un `pick` IMBRIQUÉ', () => {
    const p = pick('skill');
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE.id }, { id: UNE_COMPETENCE_GROUPEE.id }] }).success).toBe(true);
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE_GROUPEE.id, spec: UNE_COMPETENCE_GROUPEE.specs![0].id }] }).success).toBe(true);
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE_GROUPEE.id, choix: true }] }).success).toBe(true);
    expect(p.safeParse({ pick: 2, of: [{ id: UNE_COMPETENCE.id }, { id: UNE_COMPETENCE_GROUPEE.id, choix: UNE_COMPETENCE_GROUPEE.specs!.slice(0, 2).map((e) => e.id) }] }).success).toBe(true);
    expect(
      p.safeParse({
        pick: 1,
        of: [{ pick: 1, of: [{ id: UNE_COMPETENCE_GROUPEE.id, spec: UNE_COMPETENCE_GROUPEE.specs![0].id }, { pick: 1, of: [{ id: UNE_COMPETENCE.id }] }] }],
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
   * VIVANTS que `ref.ts` lit d'abord (`idsVivants(clé d'espace)`, sinon `IDS_PAR_ESPACE[clé d'espace]`),
   * posés par la couche donnée. Un schéma se construit une fois au chargement du module, la donnée se
   * valide après ; la liste admise doit donc se lire à la VALIDATION. Sans quoi une entité créée au
   * Compendium rendrait rouge toute donnée qui la référence.
   * Le test POSE un régime vivant synthétique et repose le précédent : il ne mute aucun registre
   * partagé, et vaut que la couche donnée ait déjà posé le sien dans ce worker ou non.
   */
  it('un schéma construit AVANT une mise à jour du registre voit la NOUVELLE liste', () => {
    const avant = IDS_PAR_ESPACE['etats.json'];
    const noeud = idDe('etat'); // construit AVANT la mise à jour
    expect(noeud.safeParse('etat-cree-au-compendium').success).toBe(false);
    const precedent = poserRegimeVivant((cle) => (cle === 'etats.json' ? new Set([...avant, 'etat-cree-au-compendium']) : precedent?.(cle)));
    try {
      expect(noeud.safeParse('etat-cree-au-compendium').success).toBe(true);
      expect(idDe('etat').safeParse('etat-cree-au-compendium').success).toBe(true);
    } finally {
      poserRegimeVivant(precedent);
    }
    expect(noeud.safeParse('etat-cree-au-compendium').success).toBe(false);
  });

  it('`merchants.json` adopte `refs(\'trapping\')` : le dataset RÉEL parse, et un id de trapping inventé casse au parse', () => {
    const def = SCHEMA_DEFS.find((d) => d.file === 'merchants.json')!;
    const merchants = def.schema.parse(JSON.parse(JSON.stringify(merchantsJson)));
    expect(Array.isArray(merchants)).toBe(true);
    const faux = JSON.parse(JSON.stringify(merchantsJson)) as { curated?: string[] }[];
    const porteur = faux.find((m) => m.curated?.length)!;
    porteur.curated![0] = 'objet-qui-n-existe-pas';
    const res = def.schema.safeParse(faux);
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/objet-qui-n-existe-pas.*trappings\.json/);
  });
});

describe('specRef() — l’ENTRÉE visée dit si sa spécialisation est ouverte', () => {
  type EntreeOuvrable = EntreeASpecs & { specsOpen?: boolean };
  const aSpecsInline = (e: EntreeOuvrable) => !!e.specs?.length && !e.specsSource;
  const cas = [
    ['skill', skillsJson as EntreeOuvrable[]],
    ['talent', talentsJson as EntreeOuvrable[]],
  ] as const;

  for (const [type, entrees] of cas) {
    const ouverte = entrees.find((e) => aSpecsInline(e) && e.specsOpen === true)!;
    const fermee = entrees.find((e) => aSpecsInline(e) && !e.specsOpen)!;

    it(`${type} : une entrée OUVERTE (\`specsOpen\`) admet un texte libre`, () => {
      expect(entreeOuverte(type, ouverte.id)).toBe(true);
      expect(refusDeSpec(type, ouverte.id, 'une-specialisation-creee')).toBeNull();
      expect(specRef(type).safeParse({ id: ouverte.id, spec: 'une-specialisation-creee' }).success).toBe(true);
    });

    it(`${type} : une entrée FERMÉE admet ses specs déclarées, refuse et NOMME un texte libre`, () => {
      expect(entreeOuverte(type, fermee.id)).toBe(false);
      const r = specRef(type);
      expect(r.safeParse({ id: fermee.id, spec: fermee.specs![0].id }).success).toBe(true);
      expect(refusDeSpec(type, fermee.id, 'spec-hors-pool')).toBe('horsCatalogue');
      const res = r.safeParse({ id: fermee.id, spec: 'spec-hors-pool' });
      expect(res.success).toBe(false);
      expect(JSON.stringify(res.error?.issues)).toMatch(new RegExp(`spec-hors-pool.*${type}s\\.json`));
    });
  }

  it('trait : `entreeOuverte` suit le `specsOpen` de CHAQUE entrée de traits.json', () => {
    const entrees = traitsJson as EntreeOuvrable[];
    const ouvertes = entrees.filter((e) => e.specsOpen === true).map((e) => e.id);
    expect(ouvertes.length).toBeGreaterThan(0);
    expect(entrees.filter((e) => entreeOuverte('trait', e.id)).map((e) => e.id)).toEqual(ouvertes);
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

/**
 * Les deux règles GÉNÉRALES de `refusDeSpec` (#1463), sur une FIXTURE : un régime vivant synthétique pose
 * trois Traits fictifs et repose le précédent. Un Trait déclare son Indice et sa Portée par marqueur
 * (`LDB 85 l.94`, `l.209`) ; un Aspect libre (`specsOpen`) n'a pas de catalogue (`LDB 85 l.81-83`).
 */
describe('refusDeSpec — libellé de catalogue et forme de marqueur (fixture)', () => {
  const OUVERTE = 'fixture-ouverte-a-catalogue';
  const LIBRE = 'fixture-ouverte-sans-catalogue';
  const FERMEE = 'fixture-fermee';
  const avec = (cle: string, ...ids: string[]) => new Set([...(IDS_PAR_ESPACE[cle] ?? []), ...ids]);
  const ESPACES: Record<string, ReadonlySet<string>> = {
    'traits.json': avec('traits.json', OUVERTE, LIBRE, FERMEE),
    'traits.json?specsOpen': avec('traits.json?specsOpen', OUVERTE, LIBRE),
    'traits.json?indice': avec('traits.json?indice', OUVERTE, FERMEE),
    'traits.json?range': avec('traits.json?range', OUVERTE),
    [`traits.json#[${OUVERTE}].specs`]: new Set(['feu', 'froid']),
    [`traits.json#[${OUVERTE}].specs!libellés`]: new Set(['Feu', 'Froid']),
    [`traits.json#[${FERMEE}].specs`]: new Set(['x']),
  };
  const avecLaFixture = (verifier: () => void): void => {
    const precedent = poserRegimeVivant((cle) => ESPACES[cle] ?? precedent?.(cle));
    try {
      verifier();
    } finally {
      poserRegimeVivant(precedent);
    }
  };

  it('une entrée OUVERTE sans catalogue est spécialisable : tout texte libre y est admis', () =>
    avecLaFixture(() => {
      expect(estSpecialisable('trait', LIBRE)).toBe(true);
      expect(refusDeSpec('trait', LIBRE, 'Gueule béante')).toBeNull();
    }));

  it('(a) sur une entrée OUVERTE, une spec qui reproduit le LIBELLÉ d’un id du catalogue est refusée ; l’id et le texte libre passent', () =>
    avecLaFixture(() => {
      expect(refusDeSpec('trait', OUVERTE, 'Feu')).toBe('libelle');
      expect(refusDeSpec('trait', OUVERTE, 'feu')).toBeNull();
      expect(refusDeSpec('trait', OUVERTE, 'Vapeur')).toBeNull();
    }));

  it('(a) le libellé se reconnaît aux marques, à la casse et aux blancs de bord près (`norm`) — seul l’id exact passe', () =>
    avecLaFixture(() => {
      expect(refusDeSpec('trait', OUVERTE, 'FEU')).toBe('libelle');
      expect(refusDeSpec('trait', OUVERTE, 'fROID')).toBe('libelle');
      expect(refusDeSpec('trait', OUVERTE, ' feu ')).toBe('libelle');
    }));

  it('(a) sur une source à VOCABULAIRE (Venin, `difficulties`, LDB 85 l.423), le nom de Difficulté (LDB 12 l.143-151) est refusé quelle que soit sa casse', () => {
    expect(refusDeSpec('trait', 'venin', 'Très Difficile')).toBe('libelle');
    expect(refusDeSpec('trait', 'venin', 'très difficile')).toBe('libelle');
    expect(refusDeSpec('trait', 'venin', 'DIFFICILE')).toBe('libelle');
    expect(refusDeSpec('trait', 'venin', 'difficile')).toBeNull();
    expect(refusDeSpec('trait', 'venin', 'tresDifficile')).toBeNull();
  });

  it('(b) une spec à la FORME d’un marqueur que l’entrée déclare (Indice, Portée) est refusée, ouverte ou fermée', () =>
    avecLaFixture(() => {
      expect(refusDeSpec('trait', OUVERTE, '8')).toBe('marqueur');
      expect(refusDeSpec('trait', OUVERTE, '+3')).toBe('marqueur');
      expect(refusDeSpec('trait', OUVERTE, '12 m')).toBe('marqueur');
      expect(refusDeSpec('trait', FERMEE, '4')).toBe('marqueur');
      expect(refusDeSpec('trait', FERMEE, '12 m'), 'Portée non déclarée : hors catalogue, pas marqueur').toBe('horsCatalogue');
      expect(refusDeSpec('trait', LIBRE, '8'), 'aucun marqueur déclaré : texte libre').toBeNull();
    }));
});

describe('régime d’une réf à spécialisation — un porteur qui DÉSIGNE refuse « choix » (#1897)', () => {
  const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.error?.issues ?? []).map((i) => i.message).join(' | ');

  it('un Test de Compétence désigne : `{ savoir, choix: true }` est refusé par `flowTestSchema`, en le nommant', () => {
    const res = flowTestSchema.safeParse({ skill: { id: 'savoir', choix: true } });
    expect(res.success).toBe(false);
    expect(messages(res)).toMatch(/savoir.*« choix ».*n'y est pas admis/);
    expect(flowTestSchema.safeParse({ skill: { id: 'savoir', spec: 'loi' } }).success).toBe(true);
    expect(flowTestSchema.safeParse({ skill: { id: 'savoir' } }).success).toBe(true);
  });

  it('un porteur d’EMPLACEMENT l’ouvre (`specOuChoixFacultatifs`) : l’avancement admet `choix`', () => {
    expect(avancement('talent').safeParse({ id: 'beni', choix: true }).success).toBe(true);
    expect(refOuSpec('talent', undefined, 'specOuChoixFacultatifs').safeParse({ id: 'beni', choix: true }).success).toBe(true);
    expect(refOuSpec('talent').safeParse({ id: 'beni', choix: true }).success).toBe(false);
  });

  it('un porteur qui DÉSIGNE ne DÉCLARE pas `choix` : son nœud n’a pour champs que `id` et `spec`', () => {
    const designe = refOuSpec('skill');
    const cles = (n: unknown) => enfantsDe(n).flatMap((e) => (e.cle === undefined ? [] : [e.cle]));
    expect(cles(designe)).toEqual(['id', 'spec']);
    expect(Object.keys(metaDesChamps(designe) ?? {})).toEqual(['id', 'spec']);
    expect(cles(refOuSpec('skill', undefined, 'specOuChoixFacultatifs'))).toEqual(['id', 'spec', 'choix']);
    const res = designe.safeParse({ id: 'savoir', choix: true });
    expect(res.success).toBe(false);
    expect(messages(res)).toMatch(/savoir.*« choix ».*n'y est pas admis/);
  });

  it('le refus de la sentinelle sur un Talent ne porte AUCUNE référence de livre', () => {
    const res = refOuSpec('talent').safeParse({ id: 'beni', spec: 'Au choix' });
    expect(res.success).toBe(false);
    expect(messages(res)).toMatch(/Au choix.*EMPLACEMENT non désigné de « beni »/);
    expect(messages(res)).not.toMatch(/09 l\.40|LDB/);
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

  it('une réf inventée est refusée AU CHARGEMENT par sa feuille, qui nomme le catalogue — `nue` ne change que le type de sortie (#1473)', () => {
    const talents = structuredClone(talentsJson) as { source: { book: string } }[];
    talents[0].source.book = 'livre-invente';
    expect(validateDataset('talents.json', talents)).toContain('« livre-invente » est absent du catalogue des livres (books.json).');
    expectTypeOf(idDe('book', undefined, { nue: true }).parse(talentsJson[0].source.book)).toEqualTypeOf<string>();
  });

  it('une réf inventée sous une UNION DE FORMES (`pick` dans un emplacement d’avancement) garde le message de sa feuille (#1473)', () => {
    const r = avancement('talent').safeParse({ pick: 1, of: [{ id: 'talent-invente' }, { id: 'resistance' }] });
    expect(r.success ? [] : r.error.issues.map((i) => i.message)).toEqual(['« talent-invente » est absent du catalogue des talents (talents.json).']);
  });

  it("`ref(type)` sans `extra` sort `{ id: Id<type> }`, ni index ouvert ni `id` perdu", () => {
    const competence = ref('skill');
    expectTypeOf<z.output<typeof competence>>().toEqualTypeOf<{ id: Id<'skill'> }>();
    expectTypeOf(competence.parse({ id: UNE_COMPETENCE.id })).toEqualTypeOf<{ id: Id<'skill'> }>();
  });

  it("`ref(type, undefined, sousListe)` garde la même sortie `{ id: Id<type> }`", () => {
    const parSousListe = ref('material', undefined, 'objet');
    expectTypeOf<z.output<typeof parSousListe>>().toEqualTypeOf<{ id: Id<'material'> }>();
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
    ['spéc arrêtée en ID', { id: 'sens-aiguise', spec: 'ouie' }, t, true],
    ['spéc arrêtée en LIBELLÉ', { id: 'sens-aiguise', spec: 'Ouïe' }, t, false],
    ['spéc inconnue du pool', { id: 'sens-aiguise', spec: 'plombiers' }, t, false],
    ['choix BORNÉ en ids', { id: 'sens-aiguise', choix: ['ouie', 'vue'] }, t, true],
    ['choix BORNÉ en libellés', { id: 'sens-aiguise', choix: ['Ouïe', 'Vue'] }, t, false],
    ['choix LIBRE', { id: 'sens-aiguise', choix: true }, t, true],
    ['id fantôme', { id: 'sens-aiguise-fantome' }, t, false],
    ['`spec` ET `choix` ensemble', { id: 'sens-aiguise', spec: 'ouie', choix: true }, t, false],
    ['« n parmi », branche de tirage comprise', { pick: 1, of: [{ id: 'sens-aiguise', spec: 'ouie' }, { random: 1 }] }, t, true],
    ['tirage « n aléatoires »', { random: 2 }, t, true],
    ['tirage de ZÉRO', { random: 0 }, t, false],
    ['graphie MORTE `{ref}`', { ref: { id: 'sens-aiguise' } }, t, false],
    ['graphie MORTE `{wildcard}`', { wildcard: { id: 'sens-aiguise' } }, t, false],
    ['graphie MORTE `{choice}`', { choice: [{ ref: { id: 'sens-aiguise' } }] }, t, false],
    ['Talent OUVERT : spéc hors catalogue', { id: 'savoir-vivre', spec: 'plombiers' }, t, true],
    ['Compétence : spéc de catalogue', { id: 'signes-secrets', spec: 'guilde' }, s, true],
    // `signes-secrets` est une entrée OUVERTE (`entreeOuverte`) : une spéc hors catalogue passe au
    // schéma, y compris l'id `guilde-au-choix` fusionné dans `guilde` au commit 4. C'est la DONNÉE
    // qui est gardée contre sa survivance (`src/data/refs-migrated.test.ts`), pas la porte.
    ['Compétence OUVERTE : spéc HORS catalogue', { id: 'signes-secrets', spec: 'guilde-au-choix' }, s, true],
    ['Compétence FERMÉE : spéc HORS catalogue', { id: 'art', spec: 'plombiers' }, s, false],
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

  it('un INTERVALLE porte sa section de fin, entière et distincte du départ (forme canonique unique)', () => {
    const avec = (fin: Record<string, unknown>) => descRefSchema.safeParse({ ...ADRESSE, parts: [{ ...FRAGMENT, ...fin }] });
    const chemins = (r: ReturnType<typeof avec>) => r.error?.issues.map((i) => i.path.join('.')) ?? [];
    expect(avec({ finSec: 'la-suite', finSecOcc: 1, b1: 0 }).success, 'un intervalle dont la fin précède b0 en rang').toBe(true);
    const egale = avec({ finSec: FRAGMENT.sec, finSecOcc: FRAGMENT.secOcc });
    expect(egale.success).toBe(false);
    expect(chemins(egale)).toEqual(['parts.0.finSec']);
    expect(chemins(avec({ finSec: 'la-suite' }))).toEqual(['parts.0.finSecOcc']);
    expect(chemins(avec({ finSecOcc: 2 }))).toEqual(['parts.0.finSec']);
    expect(chemins(avec({ b0: 2, b1: 0 })), 'bornes inversées sans section de fin').toEqual(['parts.0.b1']);
  });

  it('une adresse VALIDE est acceptée, et son livre doit être un livre EXTRAIT (V2)', () => {
    const doc = jouet(HORS_STOCK);
    expect(doc.entree.safeParse({ ...ENV(HORS_STOCK), source: SOURCE_REELLE, descRef: ADRESSE }).success).toBe(true);
    const ko = doc.entree.safeParse({ ...ENV(HORS_STOCK), source: SOURCE_SANS_EXTRACTION, descRef: ADRESSE_IRRESOLUBLE });
    expect(ko.success).toBe(false);
    expect(ko.error!.issues.map((i) => i.path.join('.'))).toContain('descRef.book');
    expect(ko.error!.issues.map((i) => i.message).join(' ')).toMatch(/passage introuvable : le livre « .+ » n’est pas extrait\./);
  });

  it('V1 — `desc` ET `descRef` ensemble : texte en double', () => {
    const ko = jouet(AU_STOCK).entree.safeParse({
      ...ENV(AU_STOCK),
      source: SOURCE_REELLE,
      desc: 'Une prose.',
      descRef: ADRESSE,
    });
    expect(ko.success).toBe(false);
    expect(ko.error!.issues.map((i) => i.path.join('.'))).toContain('descRef');
    expect(ko.error!.issues.map((i) => i.message)).toContain('texte en double : saisi ici et adressé au livre — garde l’un ou l’autre.');
  });

  it('l’entrée PARTIELLE porte les verrous de prose, sans obligation (#2206)', () => {
    const partielle = jouet(HORS_STOCK).entreePartielle;
    const doubleKo = partielle.safeParse({ desc: 'Une prose.', descRef: ADRESSE });
    expect(doubleKo.success, 'V1 : desc et descRef ensemble').toBe(false);
    expect(doubleKo.error!.issues.map((i) => i.path.join('.'))).toContain('descRef');
    const livreKo = partielle.safeParse({ descRef: ADRESSE_IRRESOLUBLE });
    expect(livreKo.success, 'V2 : livre non extrait').toBe(false);
    expect(livreKo.error!.issues.map((i) => i.path.join('.'))).toContain('descRef.book');
    expect(partielle.safeParse({ label: 'X' }).success, 'sans prose : rien n’est exigé').toBe(true);
  });

  it('les profils de preset du disque passent les verrous de la partielle de créature (#2206)', () => {
    const disque = JSON.parse(readFileSync(resolve(__dirname, '../../../scenes/diligence/diligence-projet.json'), 'utf8')) as { narratif: { presetsPnj: { id: string; profil?: unknown }[] } };
    const profils = disque.narratif.presetsPnj.filter((p) => p.profil !== undefined);
    expect(profils.length).toBeGreaterThan(0);
    expect(profils.filter((p) => !creaturePartielle.safeParse(p.profil).success).map((p) => p.id)).toEqual([]);
    const adresse = profils.map((p) => (p.profil as { descRef?: unknown }).descRef).find((r) => r !== undefined);
    expect(creaturePartielle.safeParse({ desc: 'Une prose.', descRef: adresse }).success, 'V1 sur la partielle de créature').toBe(false);
  });

  it('V2b — la `source` et l’adresse doivent citer le MÊME livre', () => {
    const ko = jouet(HORS_STOCK).entree.safeParse({
      ...ENV(HORS_STOCK),
      source: { book: 'aux-armes', page: 42 },
      descRef: ADRESSE,
    });
    expect(ko.success).toBe(false);
    expect(ko.error!.issues.map((i) => i.message).join(' ')).toMatch(/la source cite « aux-armes », le passage adressé « .+ » : une autre localisation va aux emplacements secondaires\./);
  });

  it('V3 — une prose recopiée d’un livre EXTRAIT est refusée hors stock, admise au stock, `maison` ou pas', () => {
    const inline = (type: string, extra: Record<string, unknown> = {}) =>
      jouet(type).entree.safeParse({ ...ENV(type), source: SOURCE_REELLE, desc: 'Une prose du livre.', ...extra });
    const ko = inline(HORS_STOCK);
    expect(ko.success).toBe(false);
    expect(ko.error!.issues.map((i) => i.path.join('.'))).toContain('desc');
    expect(ko.error!.issues.map((i) => i.message)).toContain('texte recopié d’un livre extrait : adresse le passage au lieu de le recopier.');
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
    expect(nue.error!.issues.map((i) => i.message)).toContain('texte obligatoire.');
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
      exigeProse: true,
    });
    expect(rangee.safeParse({ roll: 1, descRef: ADRESSE }).success).toBe(true);
    expect(rangee.safeParse({ roll: 1 }).success).toBe(false);
    const ko = rangee.safeParse({ roll: 1, source: SOURCE_REELLE, desc: 'Une prose du livre.' });
    expect(ko.success).toBe(false);
    expect(ko.error!.issues.map((i) => ({ path: i.path, message: i.message }))).toEqual([
      { path: ['desc'], message: 'texte recopié d’un livre extrait : adresse le passage au lieu de le recopier.' },
    ]);
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
    expect(valeursDe(enfantsDe(noeudObjet(fiche.entree)).find((e) => e.cle === 'voie')?.noeud)).toEqual({ a: 'Aile', b: 'Boue' });
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

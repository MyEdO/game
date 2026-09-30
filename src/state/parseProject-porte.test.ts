/**
 * La porte `parseProject` n'altère JAMAIS ce qu'on lui passe, et son refus est une DONNÉE
 * (`ProjetRefuse` : la cause et les fautes, chemin + message) — le `message` restant le rapport
 * technique que lisent les scripts. Mesuré sur les paquets COMMITTÉS (appelés sur leurs modules JSON
 * importés, `src/scenes/campaign.ts`) et sur un document ancien qui traverse toute la chaîne de
 * migration.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { listerProjetsLivres } from '../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs';
import { parseProject, ProjetRefuse, CURRENT_PROJECT_SCHEMA } from './worldMap';
import { emptyScene } from './scene';

const SCENES_DIR = join(__dirname, '../scenes');
const PAQUETS = listerProjetsLivres().map((rel) => join(SCENES_DIR, rel));

/** Gel PROFOND : toute écriture de la porte sur son entrée lève (module ESM = mode strict). */
function gele<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) gele(v);
  }
  return o;
}

/** Un document au schema 2 : ni `type`, ni provenance, un décor à fouille (`interact`) et une carte
 *  à port par RÉFÉRENCE — les migrations 2→12 et la résolution de port passent toutes dessus. */
function documentAncien(): Record<string, unknown> {
  const { type: _muette, ...scene } = emptyScene(4, 4) as unknown as Record<string, unknown>;
  return {
    schema: 2,
    id: 'projet-ancien',
    label: 'Projet ancien',
    versionContenu: 1,
    scenes: [{ ...scene, id: 's1', label: 'Salle', entities: [{ id: 'p0', kind: 'prop', pos: { x: 1, y: 1 }, interact: { flow: { kind: 'seq', steps: [] } } }] }],
    worldMap: {
      id: 'm', label: 'Côte', routes: [],
      places: [{ id: 'l1', label: 'Port', pos: { x: 50, y: 50 }, scene: 's1', port: { ref: 'salzenmund' } }],
    },
  };
}

/** Le refus de la porte pour ce document (échoue le test s'il passe ou lève autre chose). */
function refusDe(doc: unknown): ProjetRefuse {
  try {
    parseProject(doc);
  } catch (e) {
    if (e instanceof ProjetRefuse) return e;
    throw e;
  }
  throw new Error('la porte a laissé passer le document');
}

describe('parseProject — la porte n’altère JAMAIS son entrée', () => {
  it('au moins un paquet committé porte une carte à ports (sans quoi la pureté ne mesurerait rien)', () => {
    const ports = PAQUETS.flatMap((f) => (JSON.parse(readFileSync(f, 'utf8')).worldMap?.places ?? []).filter((p: { port?: unknown }) => p.port));
    expect(ports.length).toBeGreaterThan(0);
  });

  it.each(listerProjetsLivres().map((rel) => [rel] as const))('%s GELÉ en profondeur passe la porte, intact', (rel) => {
    const avant = JSON.stringify(lireProjetLivre(rel));
    const doc = gele(lireProjetLivre(rel));
    expect(() => parseProject(doc)).not.toThrow();
    expect(JSON.stringify(doc)).toBe(avant);
  });

  it('un document ANCIEN (schema 2, port par référence) GELÉ traverse toute la migration, intact', () => {
    const avant = JSON.stringify(documentAncien());
    const doc = gele(documentAncien());
    const lu = parseProject(doc);
    expect(JSON.stringify(doc)).toBe(avant);
    expect(lu.worldMap!.places[0].port!.taille, 'le port est RÉSOLU sur la copie').toBeGreaterThan(0);
  });
});

describe('parseProject — le refus est une DONNÉE (`ProjetRefuse`)', () => {
  it('document absent : cause `mal-forme`, faute à la racine', () => {
    const refus = refusDe(null);
    expect(refus.cause).toBe('mal-forme');
    expect(refus.fautes.map((f) => f.chemin)).toEqual([[]]);
    expect(refus.message).toBe('Projet invalide : document absent ou mal formé.');
  });

  /** La cause se LIT à la raison que `migrateDoc` nomme (sonde du juge de diff E2, 2ᵉ passe) :
   *  seul un numéro futur ou sans chemin de migration est une affaire de VERSION. */
  it.each([
    ['JSON quelconque (aucun schema)', { foo: 1 }, 'mal-forme', 'Projet invalide : « schema » absent ou non numérique (schema=undefined).'],
    ['schema texte', { schema: '12', scenes: [] }, 'mal-forme', 'Projet invalide : « schema » absent ou non numérique (schema="12").'],
    ['schema futur', { schema: 999, scenes: [] }, 'version', `Projet invalide : version future (schema=999) : cette version du jeu lit jusqu'au schema ${CURRENT_PROJECT_SCHEMA}.`],
    ['schema sans migration', { schema: 1, scenes: [] }, 'version', `Projet invalide : version non supportée (schema=1) : aucune migration depuis ce schema vers le schema ${CURRENT_PROJECT_SCHEMA}.`],
  ] as const)('%s : cause `%s`, faute au chemin `schema`', (_nom, doc, cause, rapport) => {
    const refus = refusDe(doc);
    expect(refus.cause).toBe(cause);
    expect(refus.fautes.map((f) => f.chemin)).toEqual([['schema']]);
    expect(refus.message).toBe(rapport);
  });

  it('schéma enfreint : cause `schema`, les fautes de zod telles quelles, et le rapport des scripts', () => {
    const doc = { ...documentAncien(), label: '' };
    const refus = refusDe(doc);
    expect(refus.cause).toBe('schema');
    const faute = refus.fautes.find((f) => f.chemin.join('.') === 'label');
    expect(faute, 'une faute au chemin `label`').toBeTruthy();
    expect(refus.message).toContain(`  - label: ${faute!.message}`);
  });

  it('réfs de port inconnues : fautes de SCHÉMA, TOUTES nommées à leur chemin', () => {
    const doc = documentAncien();
    const carte = doc.worldMap as { places: Record<string, unknown>[] };
    carte.places = [
      { ...carte.places[0], port: { ref: 'port-mort-1' } },
      { ...carte.places[0], id: 'l2', port: { ref: 'port-mort-2' } },
    ];
    const refus = refusDe(doc);
    expect(refus.cause).toBe('schema');
    expect(refus.fautes.map((f) => f.chemin)).toEqual([
      ['worldMap', 'places', 0, 'port', 'ref'],
      ['worldMap', 'places', 1, 'port', 'ref'],
    ]);
  });

  it('`scenes` non-tableau AU SCHÉMA COURANT : `mal-forme`, jamais « version non supportée »', () => {
    const refus = refusDe({ schema: CURRENT_PROJECT_SCHEMA, scenes: {} });
    expect(refus.cause).toBe('mal-forme');
    expect(refus.fautes.map((f) => f.chemin)).toEqual([['scenes']]);
    expect(refus.message).not.toMatch(/version|migration/);
  });

  /** Documents que la MIGRATION ne peut pas traverser (sonde du juge de diff E2) : la porte ne laisse
   *  sortir QUE des `ProjetRefuse`, l'exception d'origine gardée en faute. */
  const INTRAVERSABLES: Record<string, unknown> = {
    'scènes nulles (schema 2)': { schema: 2, id: 'x', label: 'X', versionContenu: 1, scenes: [null] },
    'scènes nulles (schema courant)': { type: 'projet', schema: CURRENT_PROJECT_SCHEMA, id: 'x', label: 'X', versionContenu: 1, scenes: [null] },
    'scène en chaîne (schema 2)': { schema: 2, id: 'x', label: 'X', scenes: ['a'] },
    'entités nulles (schema 2)': { schema: 2, id: 'x', label: 'X', scenes: [{ id: 's', entities: null }] },
    'lieux nuls (schema 2)': { schema: 2, id: 'x', label: 'X', scenes: [], worldMap: { places: null } },
    'entité nulle (schema 5)': { schema: 5, id: 'x', label: 'X', scenes: [{ id: 's', entities: [null] }] },
    'tableau nu': [],
    'chaîne nue': 'x',
  };
  it.each(Object.entries(INTRAVERSABLES))('%s : refus `ProjetRefuse`, jamais une exception brute', (_nom, doc) => {
    expect(refusDe(doc)).toBeInstanceOf(ProjetRefuse);
  });

  it('la FORME DISQUE d’un projet livré (prose adressée sans son texte) : `prose-non-materialisee`, chaque nœud à son chemin ; servie, elle passe', () => {
    const rel = 'diligence/diligence-projet.json';
    const disque = JSON.parse(readFileSync(join(SCENES_DIR, rel), 'utf8')) as { narratif: { presetsPnj: { profil?: { descRef?: unknown } }[] } };
    const adresses = disque.narratif.presetsPnj.flatMap((p, i) => (p.profil?.descRef ? [['narratif', 'presetsPnj', i, 'profil']] : []));
    expect(adresses.length, 'aucun preset adressé sur le disque — le refus ne mesurerait rien').toBeGreaterThan(0);
    const refus = refusDe(disque);
    expect(refus.cause).toBe('prose-non-materialisee');
    expect(refus.fautes.map((f) => f.chemin)).toEqual(adresses);
    const [, , premier] = adresses[0];
    expect(refus.message).toContain(`narratif.presetsPnj[${premier}].profil`);
    expect(() => parseProject(lireProjetLivre(rel)), 'la forme SERVIE (`materialiser`) passe la porte').not.toThrow();
  });

  it('une exception de migration devient `mal-forme`, son message d’origine gardé en faute', () => {
    const refus = refusDe({ schema: 2, id: 'x', label: 'X', versionContenu: 1, scenes: [null] });
    expect(refus.cause).toBe('mal-forme');
    expect(refus.fautes[0].message).toMatch(/Cannot read properties of null/);
  });
});

/**
 * La porte `parseProject` n'altère JAMAIS ce qu'on lui passe, et son refus est une DONNÉE
 * (`ProjetRefuse` : la cause et les fautes, chemin + message) — le `message` restant le rapport
 * technique que lisent les scripts. Mesuré sur le paquet de test du commun et sur un document à carte ; chaque projet
 * l'éprouve sur ses paquets dans sa suite. `projetSchema` est le SEUL contrôle de forme (#2404) : un document d'un
 * autre format est REFUSÉ, jamais migré.
 */
import { describe, it, expect } from 'vitest';
import { parseProject } from './worldMap';
import { emptyScene } from './monde/scene';
import { emptyNarratif } from './monde/campaignNarratif';
// @ts-expect-error - résolveur ESM JS (pas de types) — même convention que `vitest.config.ts`
import { materialiser } from '../../scripts/source/resoudre.mjs';
import { ACTIVITIES } from '../data';
import paquetDeTest from '../scenes/fixtures/paquet-de-test.json';
import { gele, refusDe } from './porteDuProjet.testkit';

/** Un document au format courant, à carte dont le port est par RÉFÉRENCE : la porte le résout. */
function documentAPort(): Record<string, unknown> {
  return {
    type: 'projet',
    id: 'projet-a-port',
    label: 'Projet à port',
    versionContenu: 1,
    maison: 'fixture de test',
    narratif: emptyNarratif(),
    scenes: [{ ...emptyScene('s1', 4, 4), label: 'Salle' }],
    worldMap: {
      id: 'm', label: 'Côte', routes: [],
      places: [{ id: 'l1', label: 'Port', pos: { x: 50, y: 50 }, scene: { id: 's1' }, port: { ref: 'salzenmund' } }],
    },
  };
}

describe('parseProject — la porte n’altère JAMAIS son entrée', () => {
  it('le paquet de test GELÉ en profondeur passe la porte, intact', () => {
    const avant = JSON.stringify(paquetDeTest);
    const doc = gele(structuredClone(paquetDeTest));
    expect(() => parseProject(doc)).not.toThrow();
    expect(JSON.stringify(doc)).toBe(avant);
  });

  it('un document à port par référence GELÉ passe la porte, intact', () => {
    const avant = JSON.stringify(documentAPort());
    const doc = gele(documentAPort());
    const lu = parseProject(doc);
    expect(JSON.stringify(doc)).toBe(avant);
    expect(lu.worldMap!.places[0].port!.taille, 'le port est RÉSOLU sur la copie').toBeGreaterThan(0);
  });
});

describe('parseProject — le refus est une DONNÉE (`ProjetRefuse`)', () => {
  it('document absent : cause `schema`, faute à la racine, rapport « d’un autre format, ou mal formé »', () => {
    const refus = refusDe(null);
    expect(refus.cause).toBe('schema');
    expect(refus.fautes.map((f) => f.chemin)).toEqual([[]]);
    expect(refus.message).toMatch(/^Projet d’un autre format, ou mal formé — JSON invalide contre son schéma :\n {2}- \(racine\): /);
  });

  it('schéma enfreint : cause `schema`, les fautes de zod telles quelles, et le rapport des scripts', () => {
    const doc = { ...documentAPort(), label: '' };
    const refus = refusDe(doc);
    expect(refus.cause).toBe('schema');
    const faute = refus.fautes.find((f) => f.chemin.join('.') === 'label');
    expect(faute, 'une faute au chemin `label`').toBeTruthy();
    expect(refus.message).toContain(`  - Nom: ${faute!.message}`);
  });

  it('réfs de port inconnues : fautes de SCHÉMA, TOUTES nommées à leur chemin', () => {
    const doc = documentAPort();
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

  it('`scenes` non-tableau : cause `schema`, faute au chemin `scenes`', () => {
    const refus = refusDe({ ...documentAPort(), scenes: {} });
    expect(refus.cause).toBe('schema');
    expect(refus.fautes.map((f) => f.chemin)).toEqual([['scenes']]);
  });

  /** Documents MAL FORMÉS : la porte ne laisse sortir QUE des `ProjetRefuse`, jamais une exception brute. */
  const MAL_FORMES: Record<string, unknown> = {
    'scènes nulles': { type: 'projet', id: 'x', label: 'X', versionContenu: 1, scenes: [null] },
    'scène en chaîne': { type: 'projet', id: 'x', label: 'X', scenes: ['a'] },
    'entités nulles': { type: 'projet', id: 'x', label: 'X', scenes: [{ id: 's', entities: null }] },
    'lieux nuls': { type: 'projet', id: 'x', label: 'X', scenes: [], worldMap: { places: null } },
    'entité nulle': { type: 'projet', id: 'x', label: 'X', scenes: [{ id: 's', entities: [null] }] },
    'tableau nu': [],
    'chaîne nue': 'x',
  };
  it.each(Object.entries(MAL_FORMES))('%s : refus `ProjetRefuse` de cause `schema`, jamais une exception brute', (_nom, doc) => {
    expect(refusDe(doc).cause).toBe('schema');
  });

  it('la FORME DISQUE d’un projet (prose adressée sans son texte) : `prose-non-materialisee`, au chemin du nœud ; servie, elle passe', () => {
    const [pnj, ...autres] = paquetDeTest.narratif.presetsPnj;
    const disque = { ...paquetDeTest, narratif: { ...paquetDeTest.narratif, presetsPnj: [{ ...pnj, profil: { ...pnj.profil, descRef: ACTIVITIES.find((a) => a.descRef)!.descRef } }, ...autres] } };
    const refus = refusDe(disque);
    expect(refus.cause).toBe('prose-non-materialisee');
    expect(refus.fautes.map((f) => f.chemin)).toEqual([['narratif', 'presetsPnj', 0, 'profil']]);
    expect(refus.message).toContain(`Bloc narratif › PNJ « ${pnj.id} » › profil`);
    expect(() => parseProject(materialiser(disque).racine), 'la forme SERVIE (`materialiser`) passe la porte').not.toThrow();
  });
});

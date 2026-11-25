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
import { ACTIVITIES, buildings } from '../data';
import paquetDeTest from '../scenes/fixtures/paquet-de-test.json';
import { gele, refusDe } from './porteDuProjet.testkit';
import { auChemin } from '../lib/objet.mjs';

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

type Chemin = (string | number)[];
type Noeud = Record<string | number, unknown>;
const noeudA = (racine: unknown, chemin: Chemin): Noeud => auChemin(racine, chemin) as Noeud;

/** Le paquet de test, porteur des sites que les mutations visent : un lanceur de sorts et un déclencheur de transition
 *  dans sa première scène. */
function paquetPorteur(): Noeud {
  const doc = structuredClone(paquetDeTest) as unknown as { scenes: { entities: unknown[]; triggers: unknown[] }[] };
  doc.scenes[0].entities.push({ id: 'lanceur-de-test', kind: 'personnage', pos: { x: 0, y: 2 }, creature: { id: 'humain' }, combat: { spells: ['flechette'] } });
  doc.scenes[0].triggers.push({ id: 'transition-de-test', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: { kind: 'effet', effet: { type: 'transition', scene: { id: 'scene-de-test-b' } } } });
  return doc as unknown as Noeud;
}

/** Une mutation « ancien format », rendant le chemin muté. */
type Mutation = (doc: Noeud) => Chemin;
const LANCEUR: Chemin = ['scenes', 0, 'entities', 3, 'combat'];
const TRANSITION: Chemin = ['scenes', 0, 'triggers', 1, 'flow'];

/** Les INVERSES des formes que le dépôt a quittées (sonde du juge de design, #2404) : chacun est REFUSÉ par le
 *  schéma, sans chaîne de migration. */
const ANCIENS_FORMATS: [string, Mutation][] = [
  ['scène `nom` pour `label` (#1467)', (d) => {
    const s = noeudA(d, ['scenes', 0]);
    s.nom = s.label;
    delete s.label;
    return ['scenes', 0];
  }],
  ['scène sans `reliefDefaults` (#1691)', (d) => {
    delete noeudA(d, ['scenes', 0]).reliefDefaults;
    return ['scenes', 0];
  }],
  ['sort fusionné « alarme » (#1897)', (d) => {
    (noeudA(d, LANCEUR).spells as unknown[]).push('alarme');
    return LANCEUR;
  }],
  ['op `grantTalent` à `talentId` (#1473)', (d) => {
    noeudA(d, TRANSITION).effet = { type: 'ops', ops: [{ op: 'grantTalent', talentId: 'ambidextre' }] };
    return TRANSITION;
  }],
  ['clé racine inconnue', (d) => {
    d.foo = 1;
    return [];
  }],
];

describe('parseProject — un document d’un AUTRE FORMAT est refusé, jamais migré (#2404)', () => {
  it('le paquet porteur passe la porte avant toute mutation', () => {
    expect(() => parseProject(paquetPorteur())).not.toThrow();
  });

  it.each(ANCIENS_FORMATS)('%s : REFUSÉ, cause `schema`, faute sous le site muté', (_nom, muter) => {
    const doc = paquetPorteur();
    const site = muter(doc);
    const refus = refusDe(doc);
    expect(refus.cause).toBe('schema');
    expect(refus.message).toMatch(/^Projet d’un autre format, ou mal formé — /);
    const sous = (f: { chemin: readonly (string | number)[] }) => site.every((k, i) => f.chemin[i] === k);
    expect(refus.fautes.some(sous), `aucune faute sous ${site.join('.')} : ${refus.message}`).toBe(true);
  });
});

describe('parseProject — identité et corps d’architecture à la porte (#809, #1715)', () => {
  /**
   * CONTRE-PREUVE de la PORTE d'identité (`parseProject`, `src/noyau/worldMap.ts`), sur une enveloppe
   * CONSTRUITE — aucun paquet livré n'en est le sujet. L'enveloppe est COMPLÈTE par ailleurs (`label`,
   * `versionContenu`, provenance, narratif) : seule l'identité manque, et le refus porte une faute au
   * chemin `id` — lue dans ses FAUTES, jamais dans le texte du rapport.
   */
  const ENVELOPPE = (identite: Record<string, unknown>) => ({
    type: 'projet',
    label: 'Fixture',
    versionContenu: 1,
    maison: 'fixture de test',
    narratif: emptyNarratif(),
    scenes: [{ ...emptyScene('fixture-scene', 4, 4), label: 'Fixture' }],
    ...identite,
  });

  it('la même enveloppe AVEC son identité passe la porte — la contre-preuve ci-dessous ne mesure que l’identité', () => {
    expect(() => parseProject(ENVELOPPE({ id: 'fixture-enveloppe' }))).not.toThrow();
  });

  it('CONTRE-PREUVE : un paquet SANS identité est REFUSÉ À LA PORTE, qui NOMME `id`', () => {
    const refus = refusDe(ENVELOPPE({}));
    expect(refus.cause).toBe('schema');
    expect(refus.fautes.some((f) => f.chemin.join('.') === 'id'), 'une faute au chemin `id`').toBe(true);
    expect(refus.message, 'le rapport des scripts nomme toujours le champ').toMatch(/^\s*- Identifiant: /m);
  });

  /**
   * `ArchitectureBody.style` est une RÉFÉRENCE vers `buildings.json` (`ref('building')`, #1715) : la
   * porte résout l'id, et un corps SANS type de bâtiment reste valide (bourg, hameau, corps
   * composite). Le sujet est un paquet FABRIQUÉ ICI : un paquet livré est la CARTE de son auteur, que
   * ce test laisse intacte — la contre-preuve porte sur une fixture, jamais sur un paquet livré.
   */
  const PAQUET_ARCHITECTURE = (styles: (string | undefined)[]) => {
    return {
      ...ENVELOPPE({ id: 'fixture-architecture' }),
      scenes: [{
        ...emptyScene('scene-test', 6, 6),
        id: 'fixture-scene',
        label: 'Fixture',
        architecture: styles.map((style, i) => ({
          id: `corps-${i}`,
          ...(style === undefined ? {} : { style: { id: style } }),
          storeys: [{ id: 'z0', z: 0, parts: [{ id: 'p', foot: { x: 0, y: 0, w: 2, h: 2 } }], roomZoneIds: [] }],
          facades: [],
          masses: [],
        })),
      }],
    };
  };
  /** Un type de bâtiment RÉEL, dérivé du catalogue — aucun id récité ici. */
  const TYPE_REEL = buildings[0].id;

  it('un corps TYPÉ et un corps SANS type passent la porte ensemble', () => {
    const doc = parseProject(PAQUET_ARCHITECTURE([TYPE_REEL, undefined]));
    const corps = doc.scenes.flatMap((sc) => sc.architecture ?? []);
    expect(corps.map((b) => b.style)).toEqual([{ id: TYPE_REEL }, undefined]);
  });

  it('CONTRE-PREUVE : un `style` hors de `buildings.json` est REFUSÉ À LA PORTE, qui NOMME le champ et la valeur', () => {
    expect(buildings.map((b) => b.id), '« bourg » est devenu un type de bâtiment : la contre-preuve n’a plus de sujet.').not.toContain('bourg');
    expect(() => parseProject(PAQUET_ARCHITECTURE(['bourg']))).toThrow(/style/);
    expect(() => parseProject(PAQUET_ARCHITECTURE(['bourg']))).toThrow(/bourg/);
  });
});

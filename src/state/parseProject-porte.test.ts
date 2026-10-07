/**
 * La porte `parseProject` n'altère JAMAIS ce qu'on lui passe, et son refus est une DONNÉE
 * (`ProjetRefuse` : la cause et les fautes, chemin + message) — le `message` restant le rapport
 * technique que lisent les scripts. Mesuré sur les paquets COMMITTÉS (appelés sur leurs modules JSON
 * importés, `src/scenes/campaign.ts`) et sur un document à carte. `projetSchema` est le SEUL contrôle de
 * forme (#2404) : un document d'un autre format est REFUSÉ, jamais migré.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { listerProjetsLivres } from '../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs';
import { parseProject, ProjetRefuse } from './worldMap';
import { emptyScene } from './scene';
import { emptyNarratif } from './campaignNarratif';

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

/** Un document au format courant, à carte dont le port est par RÉFÉRENCE : la porte le résout. */
function documentAPort(): Record<string, unknown> {
  return {
    type: 'projet',
    id: 'projet-a-port',
    label: 'Projet à port',
    versionContenu: 1,
    maison: 'fixture de test',
    narratif: emptyNarratif(),
    scenes: [{ ...emptyScene(4, 4), id: 's1', label: 'Salle' }],
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
    expect(refus.message).toContain(`  - Libellé: ${faute!.message}`);
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

  it('la FORME DISQUE d’un projet livré (prose adressée sans son texte) : `prose-non-materialisee`, chaque nœud à son chemin ; servie, elle passe', () => {
    const rel = 'diligence/diligence-projet.json';
    const disque = JSON.parse(readFileSync(join(SCENES_DIR, rel), 'utf8')) as { narratif: { presetsPnj: { id: string; profil?: { descRef?: unknown } }[] } };
    const adresses = disque.narratif.presetsPnj.flatMap<[string, string, number, string]>((p, i) => (p.profil?.descRef ? [['narratif', 'presetsPnj', i, 'profil']] : []));
    expect(adresses.length, 'aucun preset adressé sur le disque — le refus ne mesurerait rien').toBeGreaterThan(0);
    const refus = refusDe(disque);
    expect(refus.cause).toBe('prose-non-materialisee');
    expect(refus.fautes.map((f) => f.chemin)).toEqual(adresses);
    const [, , premier] = adresses[0];
    expect(refus.message).toContain(`Bloc narratif › PNJ « ${disque.narratif.presetsPnj[premier].id} » › profil`);
    expect(() => parseProject(lireProjetLivre(rel)), 'la forme SERVIE (`materialiser`) passe la porte').not.toThrow();
  });
});

type Chemin = (string | number)[];
type Noeud = Record<string | number, unknown>;
/** Chemin du premier objet de `v` qui satisfait `pred`. */
function chercher(v: unknown, pred: (o: Noeud) => boolean, chemin: Chemin = []): Chemin | null {
  if (!v || typeof v !== 'object') return null;
  if (!Array.isArray(v) && pred(v as Noeud)) return chemin;
  for (const [k, x] of Object.entries(v)) {
    const trouve = chercher(x, pred, [...chemin, Array.isArray(v) ? Number(k) : k]);
    if (trouve) return trouve;
  }
  return null;
}
const noeudA = (racine: unknown, chemin: Chemin): Noeud => chemin.reduce<Noeud>((o, k) => o[k] as Noeud, racine as Noeud);

/** Une mutation « ancien format » d'un projet LIVRÉ, rendant le chemin muté ; `null` = aucun site. */
type Mutation = (doc: Noeud) => Chemin | null;
const ARENE = 'arene/arene-projet.json';

/** Les INVERSES des formes que le dépôt a quittées, posés sur un projet commité (sonde du juge de
 *  design, #2404) : chacun est REFUSÉ par le schéma, sans chaîne de migration. */
const ANCIENS_FORMATS: [string, string, Mutation][] = [
  ['scène `nom` pour `label` (#1467)', ARENE, (d) => {
    const s = noeudA(d, ['scenes', 0]);
    s.nom = s.label;
    delete s.label;
    return ['scenes', 0];
  }],
  ['scène sans `reliefDefaults` (#1691)', ARENE, (d) => {
    delete noeudA(d, ['scenes', 0]).reliefDefaults;
    return ['scenes', 0];
  }],
  ['sort fusionné « alarme » (#1897)', ARENE, (d) => {
    const c = chercher(d, (o) => Array.isArray(o.spells));
    if (c) (noeudA(d, c).spells as unknown[]).push('alarme');
    return c;
  }],
  ['op `grantTalent` à `talentId` (#1473)', ARENE, (d) => {
    const c = chercher(d, (o) => o.type === 'transition');
    if (!c) return null;
    noeudA(d, c.slice(0, -1))[c[c.length - 1]] = { type: 'ops', ops: [{ op: 'grantTalent', talentId: 'ambidextre' }] };
    return c;
  }],
  ['clé racine inconnue', ARENE, (d) => {
    d.foo = 1;
    return [];
  }],
];

describe('parseProject — un document d’un AUTRE FORMAT est refusé, jamais migré (#2404)', () => {
  it.each(ANCIENS_FORMATS)('%s : REFUSÉ, cause `schema`, faute sous le site muté', (_nom, rel, muter) => {
    const doc = structuredClone(lireProjetLivre(rel)) as Noeud;
    expect(() => parseProject(doc), `${rel} doit passer la porte AVANT la mutation`).not.toThrow();
    const site = muter(doc);
    expect(site, `aucun site de mutation dans ${rel} — le refus ne mesurerait rien`).not.toBeNull();
    const refus = refusDe(doc);
    expect(refus.cause).toBe('schema');
    expect(refus.message).toMatch(/^Projet d’un autre format, ou mal formé — /);
    const sous = (f: { chemin: readonly (string | number)[] }) => site!.every((k, i) => f.chemin[i] === k);
    expect(refus.fautes.some(sous), `aucune faute sous ${site!.join('.')} : ${refus.message}`).toBe(true);
  });
});

/**
 * La porte `parseProject` sur les paquets COMMITTÉS du jeu (`src/noyau/parseProject-porte.test.ts` en tient le
 * contrat sur le commun) : gelés, ils passent intacts ; leur forme disque est refusée ; les formes que le dépôt a
 * quittées, posées sur un paquet, sont REFUSÉES, jamais migrées (#2404).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { dossierDesProjetsLivres, listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import { parseProject } from '../../../src/noyau/worldMap';
import { gele, refusDe } from '../../../src/noyau/porteDuProjet.testkit';
import { auChemin } from '../../../src/lib/objet.mjs';

const SCENES_DIR = dossierDesProjetsLivres();
const PAQUETS = listerProjetsLivres().map((rel) => join(SCENES_DIR, rel));

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

});

describe('parseProject — le refus est une DONNÉE (`ProjetRefuse`)', () => {
  it('la FORME DISQUE d’un projet livré (prose adressée sans son texte) : `prose-non-materialisee`, chaque nœud à son chemin ; servie, elle passe', () => {
    const rel = 'jeu-de-role/campagnes/diligence/diligence-projet.json';
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
const noeudA = (racine: unknown, chemin: Chemin): Noeud => auChemin(racine, chemin) as Noeud;

/** Une mutation « ancien format » d'un projet LIVRÉ, rendant le chemin muté ; `null` = aucun site. */
type Mutation = (doc: Noeud) => Chemin | null;
const ARENE = 'jeu-de-role/campagnes/arene/arene-projet.json';

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

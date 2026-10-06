/**
 * PREUVE des tables figées de `scripts/migrations/2026-10-05-1887-regles-adresses-prouvees.mjs` (#1887
 * lot 6a-2c) et de `scripts/migrations/2026-10-06-1887-regles-navigation-progression.mjs` (lot 6a-2b T3),
 * rejouée sur la pré-image : chaque adresse RÉSOUT, CONTIENT la desc (`aligner`), et UN seul lieu du livre
 * (un bloc, ou une suite de blocs contigus) la contient, dont l'adresse est la plus petite unité. La
 * pré-image est `regles.json` au PARENT du commit qui ajoute la migration du 2026-10-05 ; tant qu'elle
 * n'est pas committée, c'est `HEAD`.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADRESSES, FICHIER, migrer } from '../../scripts/migrations/2026-10-05-1887-regles-adresses-prouvees.mjs';
import { lieuxDe, prouver } from '../../scripts/source/lieux.mjs';
import { ADRESSES as ADRESSES_T3, migrer as migrerT3 } from '../../scripts/migrations/2026-10-06-1887-regles-navigation-progression.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const MIGRATION = 'scripts/migrations/2026-10-05-1887-regles-adresses-prouvees.mjs';
const git = (...args: string[]) => execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 1 << 26 });

interface Entree { id: string; desc?: string; descRef?: unknown; source: { book: string } }

function preImage(): string {
  const ajout = git('log', '--diff-filter=A', '--format=%H', '--', MIGRATION).trim().split('\n').filter(Boolean).pop();
  return git('show', `${ajout ? `${ajout}^` : 'HEAD'}:${FICHIER}`);
}

const avant = preImage();
const inline = new Map((JSON.parse(avant) as Entree[]).filter((e) => typeof e.desc === 'string').map((e) => [e.id, e]));
const arbre = new Map((JSON.parse(readFileSync(join(RACINE, FICHIER), 'utf8')) as Entree[]).map((e) => [e.id, e]));
const entree = (id: string) => inline.get(id) as Entree & { desc: string };

describe('migration #1887 lot 6a-2c — la table figée est prouvée', () => {
  it.each(Object.keys(ADRESSES))('%s : résout, contient sa desc, UN lieu au livre, adresse écrite = adresse prouvée', (id) => {
    expect(inline.has(id), `${id} n'est pas inline dans la pré-image`).toBe(true);
    const preuve = prouver(entree(id), ADRESSES[id]);
    expect(preuve.erreur).toBeUndefined();
    expect(preuve.preuve?.lieux).toBe(1);
    expect(preuve.preuve?.ecartDeLongueurNormalisee).toBeGreaterThan(0);
    expect(arbre.get(id)?.descRef).toEqual(preuve.ref);
  });

  it('une adresse qui ne contient pas la desc est REFUSÉE, nommément, sans écriture', () => {
    const fausse = { ...ADRESSES, 'main-secondaire': { ...ADRESSES['main-secondaire'], b0: 0, b1: 0 } };
    const r = migrer(avant, fausse);
    expect(r.echecs).toEqual([expect.stringMatching(/main-secondaire .*n'est pas contenue/)]);
    expect(r.texte).toBe(avant);
  });

  it('une adresse qui contient la desc sans être la plus petite unité est REFUSÉE', () => {
    const large = { ...ADRESSES, 'main-secondaire': { ...ADRESSES['main-secondaire'], b0: 0, b1: 1 } };
    const r = migrer(avant, large);
    expect(r.echecs).toEqual([expect.stringMatching(/main-secondaire .*plus petite unité/)]);
    expect(r.texte).toBe(avant);
  });

  it('une desc d’UN bloc a ce bloc pour seul lieu', () => {
    const e = entree('main-secondaire');
    const { sec, secOcc, b0 } = ADRESSES['main-secondaire'];
    expect(lieuxDe(e.source.book, e.desc)).toEqual([{ ch: '14', depart: { sec, secOcc, idx: b0 }, fin: { sec, secOcc, idx: b0 }, blocs: 1 }]);
  });
});

describe('migration #1887 lot 6a-2b T3 — `navigation-progression` est prouvée par la relation étendue', () => {
  const e = () => entree('navigation-progression');

  it('hors de la table du 2026-10-05, dans celle du 2026-10-06', () => {
    expect(Object.keys(ADRESSES)).not.toContain('navigation-progression');
    expect(Object.keys(ADRESSES_T3)).toEqual(['navigation-progression']);
  });

  it('sa desc couvre DEUX blocs : son seul lieu est la SUITE des blocs 4-5 de MDG 13 `irregularites-numeriques#1`', () => {
    const lieu = { sec: 'irregularites-numeriques', secOcc: 1 };
    expect(lieuxDe(e().source.book, e().desc)).toEqual([{ ch: '13', depart: { ...lieu, idx: 4 }, fin: { ...lieu, idx: 5 }, blocs: 2 }]);
  });

  it('résout, contient sa desc avec l’ajoute CONSIGNÉ (la bannière), UN lieu, adresse écrite = adresse prouvée', () => {
    const preuve = prouver(e(), ADRESSES_T3['navigation-progression']);
    expect(preuve.erreur).toBeUndefined();
    expect(preuve.preuve?.lieux).toBe(1);
    expect(preuve.preuve?.ajoute).toEqual(ADRESSES_T3['navigation-progression'].ajoute);
    expect(preuve.preuve?.ajoute).toEqual([expect.objectContaining({ kind: 'ligne', habillage: true, cote: 'entiere', pos: expect.objectContaining({ rang: 5, ligne: 0 }) })]);
    expect(arbre.get('navigation-progression')?.descRef).toEqual(preuve.ref);
  });

  it('un ajoute qui n’est pas l’ajoute consigné est REFUSÉ, sans écriture', () => {
    const cible = ADRESSES_T3['navigation-progression'];
    const r = migrer(avant, { 'navigation-progression': { ...cible, ajoute: [] } });
    expect(r.echecs).toEqual([expect.stringMatching(/navigation-progression .*n'est pas l'ajoute consigné/)]);
    expect(r.texte).toBe(avant);
  });

  it('le rejeu sur l’arbre est no-op', () => {
    const texte = readFileSync(join(RACINE, FICHIER), 'utf8');
    expect(migrerT3(texte)).toEqual({ texte, gestes: [], restantes: [], echecs: [] });
  });
});

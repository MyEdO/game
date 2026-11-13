/**
 * LES AVIS DE LICENCE D'UNE FABRICATION (#4063, `avis.mjs`) : chaque œuvre tierce qu'un export embarque reçoit le texte
 * que sa licence demande de joindre, tiré de sa source ; un avis qui manque fait échouer la fabrication, l'œuvre et le
 * chemin cherché nommés, sans rien écrire.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { AVIS, avisDeGodot, avisDeNode, avisDesAssets, avisDesPaquets, deposerLesAvis, type AvisDuMoteur } from './avis.mjs';
import { empaqueter } from './construire.mjs';

const PROJET = fileURLToPath(new URL('./projet', import.meta.url));

let racines: string[] = [];
afterEach(() => {
  for (const r of racines) rmSync(r, { recursive: true, force: true });
  racines = [];
});

/** Un dossier temporaire où `fichiers` (chemin relatif → contenu) sont écrits. */
function dossier(fichiers: Record<string, string>): string {
  const racine = mkdtempSync(join(tmpdir(), 'avis-4063-'));
  racines.push(racine);
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(racine, chemin)), { recursive: true });
    writeFileSync(join(racine, chemin), contenu);
  }
  return racine;
}

const paquet = (nom: string) => JSON.stringify({ name: nom, version: '1.0.0' });

describe('avisDesPaquets', () => {
  it('nomme chaque paquet dont un module est embarqué, au dernier node_modules de son id, scope compris, et met ses textes bout à bout', () => {
    const r = dossier({
      'node_modules/a/package.json': paquet('a'),
      'node_modules/a/LICENSE': 'MIT a',
      'node_modules/a/THIRD-PARTY-LICENSE': 'MIT tiers de a',
      'node_modules/a/license-checker.js': 'code',
      'node_modules/@s/b/package.json': paquet('@s/b'),
      'node_modules/@s/b/licence.md': 'MIT b',
      'node_modules/a/node_modules/c/package.json': paquet('c'),
      'node_modules/a/node_modules/c/COPYING': 'BSD c',
    });
    const modules = [join(r, 'src/propre.ts'), join(r, 'node_modules/a/index.js'), join(r, 'node_modules/a/lib/x.js'), join(r, 'node_modules/@s/b/dist/y.js'), join(r, 'node_modules/a/node_modules/c/z.js')];
    expect(avisDesPaquets(modules).map((a) => [a.oeuvre, a.fichier, a.texte])).toEqual([
      ['@s/b@1.0.0', 'npm-@s+b.txt', 'MIT b'],
      ['a@1.0.0', 'npm-a.txt', 'MIT a\n\nMIT tiers de a'],
      ['c@1.0.0', 'npm-c.txt', 'BSD c'],
    ]);
  });

  it('rend le runtime que le bundler injecte (`\\0rolldown/runtime.js`) au paquet rolldown résolu par Node, avec ses textes', () => {
    const rolldown = dirname(createRequire(import.meta.url).resolve('rolldown/package.json'));
    const { version } = JSON.parse(readFileSync(join(rolldown, 'package.json'), 'utf8')) as { version: string };
    const [avis] = avisDesPaquets(['\0rolldown/runtime.js']);
    expect([avis.oeuvre, avis.fichier, avis.texte?.startsWith(readFileSync(join(rolldown, 'LICENSE'), 'utf8'))]).toEqual([`rolldown@${version}`, 'npm-rolldown.txt', true]);
  });

  it('fait échouer le dépôt d’un paquet embarqué sans texte, en nommant le paquet et le chemin cherché, sans rien écrire', () => {
    const r = dossier({ 'node_modules/a/package.json': paquet('a'), 'node_modules/a/LICENSE': 'MIT a', 'node_modules/nu/package.json': paquet('nu') });
    const sortie = join(r, 'sortie');
    const erreurs = deposerLesAvis(sortie, avisDesPaquets([join(r, 'node_modules/a/i.js'), join(r, 'node_modules/nu/i.js')]));
    expect(erreurs).toEqual([`avis de licence absent : nu@1.0.0, cherché à ${join(r, 'node_modules/nu/LICENSE')}`]);
    expect(existsSync(join(sortie, AVIS))).toBe(false);
  });

  it('chaque paquet npm fondu dans le bundle du pont a son texte', async () => {
    const avis = avisDesPaquets((await empaqueter(null)).modules);
    expect(avis.filter((a) => a.texte === null).map((a) => `${a.oeuvre} : ${a.source}`), `paquets du bundle : ${avis.map((a) => a.oeuvre).join(', ')}`).toEqual([]);
  }, 120_000);
});

describe('avisDesAssets', () => {
  it('joint le texte que la provenance nomme, sauf pour CC0-1.0, et fait échouer une licence sans texte', () => {
    const r = dossier({
      'polices/provenance.json': JSON.stringify({ 'P.ttf': { licence: 'OFL-1.1 (LICENSE-P.txt)' } }),
      'polices/LICENSE-P.txt': 'Copyright P\nOFL',
      'sons/provenance.json': JSON.stringify({ 'a.ogg': { licence: 'CC0-1.0 (https://kenney.nl/support)' } }),
      'images/provenance.json': JSON.stringify({ 'i.png': { licence: 'CC-BY-4.0' } }),
    });
    const avis = avisDesAssets(r);
    expect(avis.map((a) => [a.oeuvre, a.fichier, a.texte])).toEqual([
      ['images/i.png (CC-BY-4.0)', 'images-i.png', null],
      ['polices/P.ttf (OFL-1.1 (LICENSE-P.txt))', 'polices-LICENSE-P.txt', 'Copyright P\nOFL'],
    ]);
    expect(deposerLesAvis(join(r, 'sortie'), avis)).toEqual([`avis de licence absent : images/i.png (CC-BY-4.0), cherché à ${join(r, 'images', 'LICENSE*.txt')}`]);
  });

  it('chaque asset du projet dont la licence demande un avis a son texte', () => {
    expect(avisDesAssets(PROJET).filter((a) => a.texte === null).map((a) => `${a.oeuvre} : ${a.source}`)).toEqual([]);
  });
});

/** Ce que le moteur rend de lui-même, réduit à un composant tiers. */
const moteur = (): AvisDuMoteur => ({
  texte: 'Copyright Godot\nMIT',
  composants: [{ name: 'FreeType', parts: [{ files: ['thirdparty/freetype/*'], copyright: ['1996, FreeType'], license: 'FTL and Zlib' }] }],
  licences: { FTL: 'texte FTL', Zlib: 'texte Zlib' },
});

describe('avisDeGodot', () => {
  it('compose la licence du moteur, chaque composant tiers et le texte de chaque licence nommée', () => {
    expect(avisDeGodot(moteur()).texte).toBe([
      'Copyright Godot\nMIT',
      'Composants tiers :',
      '- FreeType\n  Fichiers : thirdparty/freetype/*\n  © 1996, FreeType\n  Licence : FTL and Zlib',
      '----- FTL -----\n\ntexte FTL',
      '----- Zlib -----\n\ntexte Zlib',
    ].join('\n\n'));
  });

  it.each<[string, AvisDuMoteur | null]>([
    ['rien écrit', null],
    ['sans texte', { ...moteur(), texte: '' }],
    ['sans composant', { ...moteur(), composants: [] }],
    ['une licence nommée sans texte', { ...moteur(), licences: { FTL: 'texte FTL' } }],
  ])('muet (%s), son avis manque', (_, rendu) => {
    expect(deposerLesAvis(dossier({}), [avisDeGodot(rendu)])).toEqual([expect.stringMatching(/^avis de licence absent : Godot Engine, cherché à Engine\.get_license_text\(\)/)]);
  });
});

describe('avisDeNode', () => {
  it('lit le LICENSE de la distribution relatif au dossier de l’exécutable, et nomme le chemin cherché s’il manque', () => {
    const r = dossier({ 'LICENSE': 'Node.js MIT', 'bin/node': '' });
    expect(avisDeNode(join(r, 'bin', 'node'), '../LICENSE', 'v1')).toEqual({ oeuvre: 'Node.js v1', fichier: 'node.txt', source: join(r, 'LICENSE'), texte: 'Node.js MIT' });
    expect(avisDeNode(join(r, 'bin', 'node'), 'LICENSE', 'v1')).toMatchObject({ source: join(r, 'bin', 'LICENSE'), texte: null });
  });
});

describe('deposerLesAvis', () => {
  it('écrit chaque avis sous licences/ de la sortie', () => {
    const r = dossier({ 'node_modules/a/package.json': paquet('a'), 'node_modules/a/LICENSE': 'MIT a', 'LICENSE': 'Node.js MIT' });
    const sortie = join(r, 'sortie');
    expect(deposerLesAvis(sortie, [avisDeGodot(moteur()), ...avisDesPaquets([join(r, 'node_modules/a/i.js')]), avisDeNode(join(r, 'node'), 'LICENSE', 'v1')])).toEqual([]);
    expect(['godot.txt', 'npm-a.txt', 'node.txt'].map((f) => readFileSync(join(sortie, AVIS, f), 'utf8'))).toEqual([avisDeGodot(moteur()).texte, 'MIT a', 'Node.js MIT']);
  });
});

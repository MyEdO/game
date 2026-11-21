/**
 * LES PLANCHES ET LEURS ÉTALONS (#3935, `planches.mjs`) : `deposerLesPlanches` écrit chaque planche sous
 * `<sortie>/planches/<nom>.json`, et chaque jeu distinct de réponses communes sous
 * `<sortie>/planches/communes/`. Chaque planche désigne les réponses de son état par leur empreinte. `refusDuNavigateur` ne laisse passer que
 * le `Chrome/<version>` d'`EPINGLE` sous Linux x86-64, et nomme sinon ce qu'il a lu, ce qu'il attend et la commande
 * d'installation. `etalonsSansPlanche` rend les étalons qu'aucune planche ne porte. `coteACote` pose la maquette
 * déclarée, ramenée à la taille de la capture, au-dessus de la capture et de leur fondu, ou dit pourquoi il ne le peut.
 * La vue de base du projet est la vue de référence ramenée à 720 de haut : l'interface s'y dessine comme sur sa maquette
 * à toute fenêtre, plus large en ratio que la maquette ou non. `ecart` compte les pixels qui diffèrent entre deux PNG et
 * la boîte qui les contient ; d'une taille à l'autre, tous.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { decodePng } from '../../scripts/qc/lib/pngDecode.mjs';
import VUES_RECETTE from '../../scripts/recette/vues-recette.json';
import { coteACote, deposerLesPlanches, ecart, encoderPng, EPINGLE, etalonsSansPlanche, MAQUETTES, refusDuNavigateur, VUE_DE_BASE } from './planches.mjs';

const racine = mkdtempSync(join(tmpdir(), 'planches-3935-'));
afterAll(() => rmSync(racine, { recursive: true, force: true }));

const planche = (nom: string, scenario: string, communes: unknown) => ({ nom, titre: nom, parametres: { scenario }, reponses: { demarrer: { ok: true } }, communes });
const LINUX = { plateforme: 'linux', architecture: 'x64' };

describe('deposerLesPlanches', () => {
  it('partage les réponses identiques et garde les réponses distinctes des planches du même scénario', () => {
    const sortie = join(racine, 'export');
    const dossier = join(sortie, 'planches');
    mkdirSync(dossier, { recursive: true });
    writeFileSync(join(dossier, 'ancienne.json'), '{}');
    deposerLesPlanches(sortie, [planche('a', 'dome', { m: 1 }), planche('b', 'dome', { m: 1 }), planche('c', 'dome', { m: 2 })]);
    expect(listerDossier(dossier)).toEqual(['a.json', 'b.json', 'c.json', 'communes']);
    const lire = (chemin: string) => JSON.parse(readFileSync(join(dossier, chemin), 'utf8'));
    const a = lire('a.json');
    const b = lire('b.json');
    const c = lire('c.json');
    expect(a).toEqual({ nom: 'a', titre: 'a', parametres: { scenario: 'dome' }, reponses: { demarrer: { ok: true } }, communes: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(a.communes).toBe(b.communes);
    expect(a.communes).not.toBe(c.communes);
    expect(lire(`communes/${a.communes}.json`)).toEqual({ m: 1 });
    expect(lire(`communes/${c.communes}.json`)).toEqual({ m: 2 });
    expect(listerDossier(join(dossier, 'communes'))).toHaveLength(2);
  });
});

describe('refusDuNavigateur', () => {
  it('laisse passer le Chrome épinglé sous Linux x86-64', () => {
    expect(refusDuNavigateur(`Chrome/${EPINGLE.chrome}`, LINUX)).toBeNull();
  });

  it('refuse un autre binaire à la version épinglée', () => {
    expect(refusDuNavigateur(`HeadlessChrome/${EPINGLE.chrome}`, LINUX)).toContain(`HeadlessChrome/${EPINGLE.chrome} sous linux-x64`);
  });

  it('refuse un autre build, en nommant ce qu’il a lu, ce qu’il attend et la commande d’installation', () => {
    const refus = refusDuNavigateur('HeadlessChrome/152.0.7000.1', LINUX);
    expect(refus).toContain('HeadlessChrome/152.0.7000.1 sous linux-x64');
    expect(refus).toContain(`Chrome ${EPINGLE.chrome} sous linux-x64`);
    expect(refus).toContain(`PLAYWRIGHT_BROWSERS_PATH=<dossier> npx -y playwright@${EPINGLE.playwright} install chromium`);
  });

  it('refuse le build épinglé sur une autre plateforme', () => {
    expect(refusDuNavigateur(`Chrome/${EPINGLE.chrome}`, { plateforme: 'win32', architecture: 'x64' })).toContain(`Chrome/${EPINGLE.chrome} sous win32-x64`);
    expect(refusDuNavigateur(`Chrome/${EPINGLE.chrome}`, { plateforme: 'linux', architecture: 'arm64' })).toContain('sous linux-arm64');
  });
});

describe('etalonsSansPlanche', () => {
  it('rend les étalons qu’aucune planche ne porte, jamais valides.json', () => {
    expect(etalonsSansPlanche(['a.png', 'renommee.png', 'valides.json'], ['a', 'b'])).toEqual(['renommee.png']);
  });
});


describe('coteACote', () => {
  const uni = (w: number, h: number, [r, v, b]: number[]) => encoderPng({ w, h, data: Buffer.from(Array.from({ length: w * h }, () => [r, v, b, 255]).flat()) });
  const capture = uni(3, 2, [0, 100, 200]);
  const maquette = uni(6, 4, [200, 100, 0]);
  const chemin = join(racine, 'maquette.png');
  writeFileSync(chemin, maquette);
  const declaree = (autre: Partial<{ chemin: string; sha256: string; facteur: number }> = {}) => ({
    p: { chemin, sha256: createHash('sha256').update(maquette).digest('hex'), facteur: 2, date: '2026-11-13', ...autre },
  });

  it('rend la maquette ramenée à la capture, la capture, puis leur fondu, de la largeur de la capture et trois fois sa hauteur', () => {
    const cote = coteACote('p', capture, declaree());
    if (!cote || !('image' in cote)) throw new Error(`image attendue : ${JSON.stringify(cote)}`);
    const { w, h, data } = decodePng(cote.image);
    expect([w, h]).toEqual([3, 6]);
    const pixel = (y: number) => [...data.subarray(y * w * 4, y * w * 4 + 3)];
    expect([pixel(0), pixel(2), pixel(4)]).toEqual([[200, 100, 0], [0, 100, 200], [100, 100, 100]]);
  });

  it('rend un avis, pas une image, pour une maquette absente, d’une autre empreinte, d’un autre format ou d’une autre taille', () => {
    expect(coteACote('p', capture, declaree({ chemin: join(racine, 'absente.png') }))).toEqual({ avis: expect.stringContaining('absente de ce poste') });
    expect(coteACote('p', capture, declaree({ sha256: '0'.repeat(64) }))).toEqual({ avis: expect.stringContaining(`${'0'.repeat(64)} validée`) });
    expect(coteACote('p', capture, declaree({ chemin: join(racine, 'maquette.jpg') }))).toEqual({ avis: expect.stringContaining('format non lu') });
    expect(coteACote('p', capture, declaree({ facteur: 1.5 }))).toEqual({ avis: expect.stringContaining('fois 1.5 attendue') });
  });

  it('ne rend rien pour une planche sans maquette', () => {
    expect(coteACote('autre', capture, declaree())).toBeNull();
  });

  it('chaque maquette déclarée est au dépôt, à l’empreinte validée', () => {
    const declarees: Record<string, { chemin: string; sha256: string }> = JSON.parse(readFileSync(MAQUETTES, 'utf8'));
    const lues = Object.fromEntries(Object.entries(declarees).map(([nom, { chemin }]) => [nom, createHash('sha256').update(readFileSync(resolve(dirname(MAQUETTES), chemin))).digest('hex')]));
    expect(lues).toEqual(Object.fromEntries(Object.entries(declarees).map(([nom, { sha256 }]) => [nom, sha256])));
  });
});

describe('la vue de base du projet', () => {
  it('est la vue de référence ramenée à 720 de haut, sa hauteur bornant encore l’échelle à la vue de référence', () => {
    const hauteur = 720;
    const reference = VUES_RECETTE.find((v) => v.nom === 'bureau')!;
    expect(VUE_DE_BASE).toEqual({ largeur: Math.floor((reference.largeur * hauteur) / reference.hauteur), hauteur });
  });
});

describe('ecart', () => {
  const png = (w: number, h: number, autres: number[] = []) => encoderPng({ w, h, data: Buffer.from(Array.from({ length: w * h }, (_, k) => (autres.includes(k) ? [200, 10, 10, 255] : [10, 20, 30, 255])).flat()) });
  it('compte les pixels qui diffèrent et leur boîte, aucun entre deux images égales', () => {
    expect(ecart(png(4, 3), png(4, 3))).toEqual({ pixels: 0, boite: '' });
    expect(ecart(png(4, 3, [5, 11]), png(4, 3))).toEqual({ pixels: 2, boite: 'de (1, 1) à (3, 2)' });
  });
  it('compte tous les pixels d’une taille à l’autre', () => {
    expect(ecart(png(4, 3), png(2, 2))).toEqual({ pixels: 12, boite: 'étalon 2×2, rendu 4×3' });
  });
});

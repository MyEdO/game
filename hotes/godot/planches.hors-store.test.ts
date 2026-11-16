/**
 * LES PLANCHES ET LEURS ÉTALONS (#3935, `planches.mjs`) : `deposerLesPlanches` écrit chaque planche sous
 * `<sortie>/planches/<nom>.json`, sans ses réponses communes, et celles de chaque scénario sous
 * `<sortie>/planches/communes/`, celles d'un dépôt précédent retirées ; deux jeux de réponses communes pour un scénario
 * sont refusés. `refusDuNavigateur` ne laisse passer que
 * le `Chrome/<version>` d'`EPINGLE` sous Linux x86-64, et nomme sinon ce qu'il a lu, ce qu'il attend et la commande
 * d'installation. `etalonsSansPlanche` rend les étalons qu'aucune planche ne porte. `coteACote` pose la maquette
 * déclarée, ramenée à la taille de la capture, au-dessus de la capture et de leur fondu, ou dit pourquoi il ne le peut.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { decodePng } from '../../scripts/qc/lib/pngDecode.mjs';
import { coteACote, deposerLesPlanches, encoderPng, EPINGLE, etalonsSansPlanche, refusDuNavigateur } from './planches.mjs';

const racine = mkdtempSync(join(tmpdir(), 'planches-3935-'));
afterAll(() => rmSync(racine, { recursive: true, force: true }));

const planche = (nom: string, scenario: string, communes: unknown) => ({ nom, titre: nom, parametres: { scenario }, reponses: { demarrer: { ok: true } }, communes });
const LINUX = { plateforme: 'linux', architecture: 'x64' };

describe('deposerLesPlanches', () => {
  it('écrit les planches sans leurs réponses communes, celles de chaque scénario une fois, et retire celles d’avant', () => {
    const sortie = join(racine, 'export');
    mkdirSync(join(sortie, 'planches'), { recursive: true });
    writeFileSync(join(sortie, 'planches', 'ancienne.json'), '{}');
    deposerLesPlanches(sortie, [planche('a', 'dome', { m: 1 }), planche('b', 'dome', { m: 1 }), planche('c', 'magie', { m: 2 })]);
    expect(listerDossier(join(sortie, 'planches'))).toEqual(['a.json', 'b.json', 'c.json', 'communes']);
    expect(listerDossier(join(sortie, 'planches', 'communes'))).toEqual(['dome.json', 'magie.json']);
    expect(JSON.parse(readFileSync(join(sortie, 'planches', 'a.json'), 'utf8'))).toEqual({ nom: 'a', titre: 'a', parametres: { scenario: 'dome' }, reponses: { demarrer: { ok: true } } });
    expect(JSON.parse(readFileSync(join(sortie, 'planches', 'communes', 'magie.json'), 'utf8'))).toEqual({ m: 2 });
  });

  it('refuse deux jeux de réponses communes pour un scénario', () => {
    const sortie = join(racine, 'deux-communes');
    expect(() => deposerLesPlanches(sortie, [planche('a', 'dome', { m: 1 }), planche('b', 'dome', { m: 2 })])).toThrow('b : les réponses communes de dome ne sont pas celles de ses autres planches');
    expect(existsSync(join(sortie, 'planches', 'communes', 'dome.json'))).toBe(false);
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
});

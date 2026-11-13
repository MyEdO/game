/**
 * LES PLANCHES ET LEURS ÉTALONS (#3935, `planches.mjs`) : `deposerLesPlanches` écrit chaque planche sous
 * `<sortie>/planches/<nom>.json`, sans ses réponses communes, et celles de chaque scénario sous
 * `<sortie>/planches/communes/`, celles d'un dépôt précédent retirées ; deux jeux de réponses communes pour un scénario
 * sont refusés. `refusDuNavigateur` ne laisse passer que
 * le `Chrome/<version>` d'`EPINGLE` sous Linux x86-64, et nomme sinon ce qu'il a lu, ce qu'il attend et la commande
 * d'installation. `etalonsSansPlanche` rend les étalons qu'aucune planche ne porte.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { deposerLesPlanches, EPINGLE, etalonsSansPlanche, refusDuNavigateur } from './planches.mjs';

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


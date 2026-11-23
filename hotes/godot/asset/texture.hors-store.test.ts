/**
 * LE REJEU DES TEXTURES ÉPINGLÉES (#4527, `texture.ts`) : l'origine que nomme une source, les arguments que consigne un
 * traitement, l'ordre du rejeu, et la provenance commitée, que le rejeu lit tout entière ; chaque matière de décor du
 * monde opaque y a sa triade, une translucide aucune (#4809, #4471).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { matieresDe } from '../../../src/data/index.ts';
import { matieresDeDecor, nomDeMatiere } from '../../../src/noyau/index.ts';
import { DOSSIER_DES_TEXTURES, type ProvenanceFabriquee } from './epingles';
import {
  argumentsDeTraitement,
  epinglerLesTextures,
  FABRIQUEE,
  origineDe,
  rejouerLesTextures,
  verdictDuRejeu,
} from './texture';

const LICENCE = 'CC0-1.0';
const AMBIENTCG = 'https://ambientcg.com/view?id=Fabric068 (Fabric068_1K-JPG.zip : Fabric068_1K-JPG_Color.jpg)';

describe('rejouer une texture épinglée', () => {
  it('lit l’origine d’une source : archive d’ambientCG, fichier de Poly Haven, texture du catalogue, aucune image', () => {
    expect(origineDe(FABRIQUEE)).toEqual({ fabriquee: true });
    expect(origineDe(AMBIENTCG)).toEqual({ url: 'https://ambientcg.com/get?file=Fabric068_1K-JPG.zip', archive: 'Fabric068_1K-JPG.zip', fichier: 'Fabric068_1K-JPG_Color.jpg' });
    expect(origineDe('https://polyhaven.com/a/clay_plaster (clay_plaster_diff_1k.jpg, Amal Kumar)'))
      .toEqual({ url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/clay_plaster/clay_plaster_diff_1k.jpg', fichier: 'clay_plaster_diff_1k.jpg' });
    expect(origineDe(`${AMBIENTCG} ; dérivée de prop--laine.neutre.jpg`)).toEqual({ deriveeDe: 'prop--laine.neutre.jpg' });
    expect(() => origineDe('https://ailleurs.example/x.jpg')).toThrow(/ambientCG/);
  });

  it('lit les arguments d’un traitement, parenthèses comprises, et refuse un autre outil', () => {
    expect(argumentsDeTraitement('ImageMagick : -resize 128x128! ( -size 8x8 xc:#8a8272 ) -composite')).toEqual(['-resize', '128x128!', '(', '-size', '8x8', 'xc:#8a8272', ')', '-composite']);
    expect(() => argumentsDeTraitement('ffmpeg : mono')).toThrow(/ImageMagick/);
  });

  it('chaque entrée de la provenance commitée nomme une origine et un traitement rejouables, et une dérivée, une texture épinglée', () => {
    const provenance = JSON.parse(readFileSync(join(DOSSIER_DES_TEXTURES, 'provenance.json'), 'utf8')) as Record<string, ProvenanceFabriquee>;
    for (const [nom, entree] of Object.entries(provenance)) {
      const origine = origineDe(entree.source);
      expect(argumentsDeTraitement(entree.traitement).length, nom).toBeGreaterThan(0);
      if ('deriveeDe' in origine) expect(Object.keys(provenance), nom).toContain(origine.deriveeDe);
    }
  });

  it('chaque matière opaque de décor du monde (`prop--<id>`, `materials.json`) a sa triade épinglée : teinte, neutre et relief ; une matière à `opacity` n’en porte aucune', () => {
    const epinglees = Object.keys(JSON.parse(readFileSync(join(DOSSIER_DES_TEXTURES, 'provenance.json'), 'utf8')) as Record<string, ProvenanceFabriquee>);
    const translucides = new Set(matieresDe('prop').filter((m) => m.opacity !== undefined).map(({ id }) => nomDeMatiere({ domain: 'prop', id })));
    const triade = (matiere: string) => ['', '.neutre', '.normale'].map((suffixe) => epinglees.includes(`${matiere}${suffixe}.jpg`));
    expect(matieresDeDecor().filter((matiere) => triade(matiere).some((epinglee) => epinglee === translucides.has(matiere)))).toEqual([]);
  });

  it('refuse un nom que la provenance n’épingle pas, avant toute écriture', async () => {
    await expect(rejouerLesTextures(['absente.jpg'], {}, tmpdir())).rejects.toThrow(/absent de la provenance/);
  });

  it('rejoue une texture fabriquée sans image lue : `convert` ne reçoit que son traitement et le fichier écrit', async () => {
    const provenance = { 'bruit.jpg': { sha256: 'a'.repeat(64), source: FABRIQUEE, licence: LICENCE, traitement: 'ImageMagick : -size 32x32 -seed 4746 plasma:fractal -strip' } };
    const sortie = mkdtempSync(join(tmpdir(), 'wfrp-texture-'));
    const lances: (readonly string[])[] = [];
    try {
      const sommes = await rejouerLesTextures(['bruit.jpg'], provenance, sortie, {
        telecharger: () => { throw new Error('téléchargement inattendu'); },
        convertir: (args) => { lances.push(args); writeFileSync(args[args.length - 1], 'bruit'); },
      });
      expect(lances).toEqual([['-size', '32x32', '-seed', '4746', 'plasma:fractal', '-strip', join(sortie, 'bruit.jpg')]]);
      expect(sommes.get('bruit.jpg')).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      rmSync(sortie, { recursive: true, force: true });
    }
  });

  it('reproduit une texture aux mêmes octets, ou aux mêmes pixels que l’épinglée déposée ; sinon elle diffère', () => {
    const jamais = (): boolean => { throw new Error('pixels comparés'); };
    expect(verdictDuRejeu('a'.repeat(64), 'a'.repeat(64), 'rejouee.jpg', 'deposee.jpg', jamais)).toBe('octets');
    expect(verdictDuRejeu('c'.repeat(64), 'a'.repeat(64), 'rejouee.jpg', 'deposee.jpg', (a, b) => a === 'rejouee.jpg' && b === 'deposee.jpg')).toBe('pixels');
    expect(verdictDuRejeu('c'.repeat(64), 'a'.repeat(64), 'rejouee.jpg', 'deposee.jpg', () => false)).toBe('differente');
  });

  describe('épingler des textures', () => {
    const entree = { sha256: 'a'.repeat(64), source: AMBIENTCG, licence: LICENCE, traitement: 'ImageMagick : -strip' };
    const PROVENANCE = `${JSON.stringify({ 'z.jpg': entree, 'a.jpg': entree, 'a.neutre.jpg': entree }, null, 2)}\n`;
    /** Un dossier épinglé qui ne porte que sa provenance. */
    const dossierEpingle = (): string => {
      const dossier = mkdtempSync(join(tmpdir(), 'wfrp-texture-'));
      writeFileSync(join(dossier, 'provenance.json'), PROVENANCE);
      return dossier;
    };

    it('dépose et épingle les seules textures nommées : celle dont elles dérivent se rejoue sans s’épingler', async () => {
      const dossier = dossierEpingle();
      const sommes = await epinglerLesTextures(['a.jpg'], dossier, (_noms, _provenance, sortie) => {
        writeFileSync(join(sortie, 'a.neutre.jpg'), 'neutre rejouée');
        writeFileSync(join(sortie, 'a.jpg'), 'couleur rejouée');
        return Promise.resolve(new Map([['a.neutre.jpg', 'c'.repeat(64)], ['a.jpg', 'b'.repeat(64)]]));
      });
      expect([...sommes]).toEqual([['a.jpg', 'b'.repeat(64)]]);
      expect(existsSync(join(dossier, 'a.neutre.jpg'))).toBe(false);
      expect(readFileSync(join(dossier, 'a.jpg'), 'utf8')).toBe('couleur rejouée');
      expect(readFileSync(join(dossier, 'provenance.json'), 'utf8'))
        .toBe(`${JSON.stringify({ 'z.jpg': entree, 'a.jpg': { ...entree, sha256: 'b'.repeat(64) }, 'a.neutre.jpg': entree }, null, 2)}\n`);
    });

    it('n’écrit rien au dossier quand le rejeu d’un nom échoue', async () => {
      const dossier = dossierEpingle();
      const rejeu = epinglerLesTextures(['a.jpg', 'z.jpg'], dossier, (_noms, _provenance, sortie) => {
        writeFileSync(join(sortie, 'a.jpg'), 'couleur rejouée');
        return Promise.reject(new Error('z.jpg : convert en échec'));
      });
      await expect(rejeu).rejects.toThrow(/z\.jpg/);
      expect(existsSync(join(dossier, 'a.jpg'))).toBe(false);
      expect(readFileSync(join(dossier, 'provenance.json'), 'utf8')).toBe(PROVENANCE);
    });
  });
});

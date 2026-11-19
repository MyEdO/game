/**
 * LE REJEU DES TEXTURES ÉPINGLÉES (#4527, `texture.ts`) : l'origine que nomme une source, les arguments que consigne un
 * traitement, l'ordre du rejeu, et la provenance commitée, que le rejeu lit tout entière.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256 } from './empreinte';
import {
  DOSSIER_DES_TEXTURES,
  argumentsDeTraitement,
  epinglerLesSommes,
  origineDe,
  rejouerLesTextures,
  verdictDuRejeu,
  type ProvenanceDeTexture,
} from './texture';

const LICENCE = 'CC0-1.0';
const AMBIENTCG = 'https://ambientcg.com/view?id=Fabric068 (Fabric068_1K-JPG.zip : Fabric068_1K-JPG_Color.jpg)';

describe('rejouer une texture épinglée', () => {
  it('lit l’origine d’une source : archive d’ambientCG, fichier de Poly Haven, texture du catalogue', () => {
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
    const provenance = JSON.parse(readFileSync(join(DOSSIER_DES_TEXTURES, 'provenance.json'), 'utf8')) as Record<string, ProvenanceDeTexture>;
    for (const [nom, entree] of Object.entries(provenance)) {
      const origine = origineDe(entree.source);
      expect(argumentsDeTraitement(entree.traitement).length, nom).toBeGreaterThan(0);
      if ('deriveeDe' in origine) expect(Object.keys(provenance), nom).toContain(origine.deriveeDe);
    }
  });

  it('refuse un nom que la provenance n’épingle pas, avant toute écriture', async () => {
    await expect(rejouerLesTextures(['absente.jpg'], {}, tmpdir())).rejects.toThrow(/absent de la provenance/);
  });

  it('reproduit une texture aux mêmes octets, ou aux mêmes pixels que l’épinglée déposée ; sinon elle diffère', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'wfrp-texture-'));
    const deposee = join(dossier, 'deposee.jpg');
    writeFileSync(deposee, 'octets épinglés');
    const epinglee = sha256(readFileSync(deposee));
    const jamais = (): boolean => { throw new Error('pixels comparés'); };
    expect(verdictDuRejeu(epinglee, epinglee, 'rejouee.jpg', deposee, jamais)).toBe('octets');
    expect(verdictDuRejeu('c'.repeat(64), epinglee, 'rejouee.jpg', deposee, (a, b) => a === 'rejouee.jpg' && b === deposee)).toBe('pixels');
    expect(verdictDuRejeu('c'.repeat(64), epinglee, 'rejouee.jpg', deposee, () => false)).toBe('differente');
    expect(verdictDuRejeu('c'.repeat(64), 'd'.repeat(64), 'rejouee.jpg', deposee, jamais)).toBe('differente');
    expect(verdictDuRejeu('c'.repeat(64), epinglee, 'rejouee.jpg', join(dossier, 'absente.jpg'), jamais)).toBe('differente');
  });

  it('inscrit les sommes rejouées, l’ordre et les autres champs gardés', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'wfrp-texture-'));
    const entree = { sha256: 'a'.repeat(64), source: AMBIENTCG, licence: LICENCE, traitement: 'ImageMagick : -strip' };
    writeFileSync(join(dossier, 'provenance.json'), `${JSON.stringify({ 'z.jpg': entree, 'a.jpg': entree }, null, 2)}\n`);
    epinglerLesSommes(new Map([['a.jpg', 'b'.repeat(64)]]), dossier);
    expect(readFileSync(join(dossier, 'provenance.json'), 'utf8')).toBe(`${JSON.stringify({ 'z.jpg': entree, 'a.jpg': { ...entree, sha256: 'b'.repeat(64) } }, null, 2)}\n`);
  });
});

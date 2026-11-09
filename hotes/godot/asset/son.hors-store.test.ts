/**
 * L'ÉPINGLAGE D'UN SON (#3805, `son.ts`) : la conversion que `ffmpeg` reçoit, le traitement que la provenance consigne,
 * et les refus, tous avant la moindre écriture.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { argumentsDeConversion, epinglerUnSon, refusDuSon, traitementDe } from './son';

const CC0 = { source: 'https://opengameart.org/content/x (x.zip : x.wav), auteur', licence: 'CC0-1.0' };

describe('épingler un son', () => {
  it('convertit en Ogg Vorbis mono 44,1 kHz qualité 4, l’extrait et les filtres demandés avant la mise au format', () => {
    expect(argumentsDeConversion('a.wav', 'b.ogg', CC0)).toEqual(['-y', '-loglevel', 'error', '-i', 'a.wav', '-ac', '1', '-ar', '44100', '-c:a', 'libvorbis', '-q:a', '4', 'b.ogg']);
    expect(argumentsDeConversion('a.wav', 'b.ogg', { ...CC0, debut: 0.5, duree: 2, filtre: 'asetrate=33075,aresample=44100' }))
      .toEqual(['-y', '-loglevel', 'error', '-ss', '0.5', '-i', 'a.wav', '-t', '2', '-af', 'asetrate=33075,aresample=44100', '-ac', '1', '-ar', '44100', '-c:a', 'libvorbis', '-q:a', '4', 'b.ogg']);
  });

  it('consigne son traitement : l’extrait, les filtres, puis la mise au format', () => {
    expect(traitementDe(CC0)).toBe('ffmpeg : mono, 44,1 kHz, Vorbis q4');
    expect(traitementDe({ ...CC0, debut: 1, duree: 3, filtre: 'volume=0.5' })).toBe('ffmpeg : extrait dès 1 s sur 3 s, volume=0.5, mono, 44,1 kHz, Vorbis q4');
  });

  it('refuse un nom hors forme, un son déjà épinglé, une licence autre que CC0, une source vide', () => {
    expect(refusDuSon('souffle-4.ogg', CC0, {})).toBeNull();
    expect(refusDuSon('Souffle.wav', CC0, {})).toMatch(/fini par \.ogg/);
    expect(refusDuSon('souffle-1.ogg', CC0, { 'souffle-1.ogg': {} })).toMatch(/déjà épinglé/);
    expect(refusDuSon('souffle-4.ogg', { ...CC0, licence: 'CC-BY-4.0' }, {})).toMatch(/CC0-1\.0/);
    expect(refusDuSon('souffle-4.ogg', { ...CC0, source: ' ' }, {})).toMatch(/source/);
  });

  it('un refus n’écrit rien : la provenance reste telle quelle', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'wfrp-son-'));
    const provenance = '{\n  "souffle-1.ogg": {}\n}\n';
    writeFileSync(join(dossier, 'provenance.json'), provenance);
    writeFileSync(join(dossier, 'source.wav'), '');
    expect(() => epinglerUnSon(join(dossier, 'source.wav'), 'souffle-1.ogg', CC0, dossier)).toThrow(/déjà épinglé/);
    expect(readFileSync(join(dossier, 'provenance.json'), 'utf8')).toBe(provenance);
  });
});

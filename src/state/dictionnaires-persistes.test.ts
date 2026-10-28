/** Les dictionnaires du navigateur se relisent VALEUR par valeur contre leur registre (#2404) : une valeur
 *  non conforme est ignorée, son défaut s'applique. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadKeyOverrides } from './keybindingsPrefs';
import { KEYBINDINGS, effectiveCodes, effectiveMods, surchargeDe } from './clavier/keybindings';
import { loadAudioPrefs } from '../audio/engine';
import { poserLeLocalStorage } from '../lib/stockage.testkit';

const poser = (cle: string, valeur: unknown) => localStorage.setItem(cle, JSON.stringify(valeur));

beforeEach(() => {
  poserLeLocalStorage();
});
afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('touches (`wfrp4.keys`)', () => {
  it('seules les combinaisons (chaînes non vides) sont gardées', () => {
    poser('wfrp4.keys', { a: 'ctrl+KeyA', b: 3, c: '', d: null });
    expect(loadKeyOverrides()).toEqual({ a: 'ctrl+KeyA' });
  });

  it('un magasin qui n’est pas un dictionnaire rend aucune surcharge', () => {
    poser('wfrp4.keys', ['KeyA']);
    expect(loadKeyOverrides()).toEqual({});
  });

  it('à la lecture, seule une combinaison canonique compte sous l’id du registre : sinon la touche déclarée s’applique', () => {
    const b = KEYBINDINGS.find((k) => k.id === 'editeur-dupliquer')!;
    expect(effectiveCodes(b, { 'editeur-dupliquer': 'alt+KeyX' })).toEqual(['KeyX']);
    expect(effectiveMods(b, { 'editeur-dupliquer': 'alt+KeyX' })).toEqual(['alt']);
    for (const combo of ['shift+ctrl+KeyX', 'meta+KeyX', 'ctrl+', 'ctrl+ctrl+KeyX']) {
      expect([effectiveCodes(b, { 'editeur-dupliquer': combo }), effectiveMods(b, { 'editeur-dupliquer': combo })], combo).toEqual([b.codes, b.mods]);
      expect(surchargeDe(b, { 'editeur-dupliquer': combo }), combo).toBeUndefined();
    }
    expect(KEYBINDINGS.some((k) => surchargeDe(k, { 'id-hors-registre': 'KeyX' }) !== undefined)).toBe(false);
  });
});

describe('audio (`wfrp4.audio`)', () => {
  it('des réglages conformes sont chargés', () => {
    poser('wfrp4.audio', { volume: 0.3, musicVolume: 0, muted: true });
    expect(loadAudioPrefs()).toEqual({ volume: 0.3, musicVolume: 0, muted: true });
  });

  it('un volume hors de 0..1 ou une sourdine non booléenne est ignoré : le défaut s’applique', () => {
    poser('wfrp4.audio', { volume: 2, musicVolume: '0.5', muted: 1 });
    expect(loadAudioPrefs()).toEqual({ volume: 0.8, musicVolume: 0.6, muted: false });
  });
});

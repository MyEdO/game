/**
 * Moteur audio minimal (Jalon 8 — arbitrage « assets libres CC0 », packs Kenney.nl +
 * pistes OpenGameArt dans `public/audio/`). SFX par `HTMLAudioElement` jetable (variante au
 * hasard, registre `defs/`) ; MUSIQUE sur un canal dédié (boucle + fondu enchaîné, contexte
 * résolu par `music.ts`). Volumes (effets/musique) + sourdine PERSISTANTS.
 * Les erreurs de lecture (politique d'autoplay avant la première interaction) sont silencieuses ;
 * la musique se relance au premier geste utilisateur.
 */
import { SOUND_DEFS } from './_registry.generated';
import type { SoundDef } from './types';
import { musicDefsFor, type MusicSelection } from './music';
import { stockageWeb } from '../lib/stockageWeb';

const LS_KEY = 'wfrp4.audio.v1';
const byId = new Map<string, SoundDef>(SOUND_DEFS.map((d) => [d.id, d]));

interface AudioPrefs {
  volume: number; // effets 0..1
  musicVolume: number; // musique 0..1
  muted: boolean; // coupe TOUT (effets + musique)
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function loadPrefs(): AudioPrefs {
  try {
    const raw = stockageWeb('localStorage')?.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AudioPrefs>;
      return {
        volume: typeof p.volume === 'number' ? clamp01(p.volume) : 0.8,
        musicVolume: typeof p.musicVolume === 'number' ? clamp01(p.musicVolume) : 0.6,
        muted: !!p.muted,
      };
    }
  } catch {
    // stockage indisponible → défauts
  }
  return { volume: 0.8, musicVolume: 0.6, muted: false };
}

let prefs = loadPrefs();

function savePrefs(): void {
  try {
    stockageWeb('localStorage')?.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    // stockage indisponible : préférences de session seulement
  }
}

export const getVolume = (): number => prefs.volume;
export const getMusicVolume = (): number => prefs.musicVolume;
export const isMuted = (): boolean => prefs.muted;
export function setVolume(v: number): void {
  prefs = { ...prefs, volume: clamp01(v) };
  savePrefs();
}
export function setMusicVolume(v: number): void {
  prefs = { ...prefs, musicVolume: clamp01(v) };
  savePrefs();
  if (music.el && music.def) music.el.volume = musicTargetVolume(music.def); // retour immédiat
}
export function setMuted(m: boolean): void {
  prefs = { ...prefs, muted: m };
  savePrefs();
  if (m) stopMusic();
  else replayMusic();
}

/** Joue un son du registre (variante au hasard). No-op : sourdine, id inconnu, hors navigateur. */
export function playSfx(id: string): void {
  if (prefs.muted || prefs.volume <= 0 || typeof Audio === 'undefined') return;
  const def = byId.get(id);
  if (!def || !def.files.length) return;
  const file = def.files[Math.floor(Math.random() * def.files.length)];
  const a = new Audio(`${import.meta.env.BASE_URL}audio/${file}`);
  a.volume = Math.min(1, prefs.volume * (def.volume ?? 1));
  void a.play().catch(() => {}); // autoplay refusé avant la 1ʳᵉ interaction : silencieux
}

// ── Canal MUSIQUE (une seule piste à la fois, boucle, fondu enchaîné court) ──

const FADE_MS = 800;
/** `sel` est la sélection en cours — un `playMusic` sur la même sélection (même clé) est un
 *  no-op (la piste continue). */
const music: { el: HTMLAudioElement | null; def: SoundDef | null; sel: MusicSelection } = {
  el: null,
  def: null,
  sel: null,
};

const selectionKey = (sel: MusicSelection): string | null =>
  sel === null ? null : 'def' in sel ? `def:${sel.def}` : `ctx:${sel.ctx}`;

// DEV uniquement : expose le canal musique aux recettes navigateur (comme `__game` dans main.tsx).
// `?.` : import.meta.env n'existe pas sous tsx (scripts de galerie SSR).
if (import.meta.env?.DEV) (globalThis as unknown as { __music?: typeof music }).__music = music;

const musicTargetVolume = (def: SoundDef) => Math.min(1, prefs.musicVolume * (def.volume ?? 1));

/** Fondu linéaire vers `target` puis `done` (l'élément peut être abandonné en route : on vérifie). */
function fadeTo(el: HTMLAudioElement, target: number, done?: () => void): void {
  const from = el.volume;
  const t0 = performance.now();
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / FADE_MS);
    el.volume = from + (target - from) * k;
    if (k < 1 && !el.paused) requestAnimationFrame(tick);
    else done?.();
  };
  requestAnimationFrame(tick);
}

function stopMusic(): void {
  const el = music.el;
  if (!el) return;
  music.el = null;
  music.def = null;
  fadeTo(el, 0, () => el.pause());
}

/** (Re)joue la sélection courante — après une sourdine levée ou un déblocage d'autoplay. */
function replayMusic(): void {
  const sel = music.sel;
  if (sel === null) return;
  music.sel = null; // force playMusic à reconsidérer
  playMusic(sel);
}

/** Au premier geste utilisateur, retente la musique (politique d'autoplay des navigateurs). */
function armAutoplayUnlock(): void {
  if (typeof document === 'undefined') return;
  document.addEventListener('pointerdown', () => replayMusic(), { once: true });
}

/** Joue la sélection (`music.ts` : piste imposée par la scène, contexte, ou silence) avec
 *  fondu enchaîné. No-op si la sélection ne change pas (la piste en cours continue). */
export function playMusic(sel: MusicSelection): void {
  if (selectionKey(sel) === selectionKey(music.sel)) return;
  music.sel = sel;
  if (typeof Audio === 'undefined') return;
  if (music.el) {
    const old = music.el;
    music.el = null;
    music.def = null;
    fadeTo(old, 0, () => old.pause());
  }
  if (!sel || prefs.muted) return;
  const defs = 'def' in sel ? SOUND_DEFS.filter((d) => d.music && d.id === sel.def) : musicDefsFor(sel.ctx);
  if (!defs.length) return; // id inconnu ou contexte sans piste → silence (validation côté éditeur)
  const def = defs[Math.floor(Math.random() * defs.length)];
  const el = new Audio(`${import.meta.env.BASE_URL}audio/${def.files[0]}`);
  el.loop = true;
  el.volume = 0;
  music.el = el;
  music.def = def;
  el.play().then(
    () => fadeTo(el, musicTargetVolume(def)),
    () => armAutoplayUnlock(), // bloqué avant la 1ʳᵉ interaction → retente au premier geste
  );
}

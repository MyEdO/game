/**
 * Moteur audio minimal (Jalon 8 — arbitrage « assets libres CC0 », packs Kenney.nl +
 * pistes OpenGameArt dans `public/audio/`). SFX par `HTMLAudioElement` jetable (variante au
 * hasard, registre `defs/`) ; MUSIQUE sur un canal dédié (boucle + fondu enchaîné, contexte
 * résolu par `data/sons/musique.ts`). Le volume d'un son est celui de son canal fois son volume propre, et la coupure
 * de tout le son se lit au même mixage (`brancherLeMixage`, préférences `noyau/volumes.ts`).
 * Les erreurs de lecture (politique d'autoplay avant la première interaction) sont silencieuses ;
 * la musique se relance au premier geste utilisateur.
 */
import { SOUND_DEFS } from '../data/sons/_registry.generated';
import { canalDuSon, findSonById } from '../data/sons/registre';
import type { CanalDeSon, SoundDef } from '../data/sons/types';
import { musicDefsFor, type MusicSelection } from '../data/sons/musique';
import { entierDEntropie } from '../hote/entropie';

/** Le volume d'un canal (0..1), lu à chaque lecture d'un son ; 1 tant qu'aucun mixage n'est branché. */
let volumeDuCanal: (canal: CanalDeSon) => number = () => 1;
/** Tout le son est-il coupé, lu à chaque lecture d'un son ; non tant qu'aucun mixage n'est branché. */
let sonCoupe: () => boolean = () => false;

/** Branche la lecture du mixage, que l'hôte tient (`state/audioWiring.ts`) : le volume d'un canal et la coupure de tout
 *  le son. */
export function brancherLeMixage(volume: (canal: CanalDeSon) => number, coupe: () => boolean): void {
  volumeDuCanal = volume;
  sonCoupe = coupe;
}

/** Le volume auquel la def `def` joue : celui de son canal fois son volume propre. */
const volumeDe = (def: SoundDef): number => Math.min(1, volumeDuCanal(canalDuSon(def)) * (def.volume ?? 1));

/** Arrête la musique en cours si le son est coupé, rejoue la sélection courante sinon. */
export function appliquerLaCoupure(): void {
  if (sonCoupe()) stopMusic();
  else replayMusic();
}

/** Joue un son du registre (variante au hasard). No-op : son coupé, id inconnu, hors navigateur. */
export function playSfx(id: string): void {
  if (sonCoupe() || typeof Audio === 'undefined') return;
  const def = findSonById(id);
  if (!def || !def.files.length) return;
  const volume = volumeDe(def);
  if (volume <= 0) return;
  const file = def.files[entierDEntropie(def.files.length)];
  const a = new Audio(`${import.meta.env.BASE_URL}audio/${file}`);
  a.volume = volume;
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

/** Réapplique à la musique en cours le volume de son canal. */
export function reappliquerLeVolumeDeLaMusique(): void {
  if (music.el && music.def) music.el.volume = volumeDe(music.def);
}

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

/** (Re)joue la sélection courante — après le son rétabli ou un déblocage d'autoplay. */
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
  if (!sel || sonCoupe()) return;
  const defs = 'def' in sel ? SOUND_DEFS.filter((d) => d.music && d.id === sel.def) : musicDefsFor(sel.ctx);
  if (!defs.length) return; // id inconnu ou contexte sans piste → silence (validation côté éditeur)
  const def = defs[entierDEntropie(defs.length)];
  const el = new Audio(`${import.meta.env.BASE_URL}audio/${def.files[0]}`);
  el.loop = true;
  el.volume = 0;
  music.el = el;
  music.def = def;
  el.play().then(
    () => fadeTo(el, volumeDe(def)),
    () => armAutoplayUnlock(), // bloqué avant la 1ʳᵉ interaction → retente au premier geste
  );
}

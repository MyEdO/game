/**
 * Câblage audio ← BUS d'événements (SFX) + STORE (musique de fond) :
 *  - DICE_ROLL → dés ; SFX → le son nommé par l'Effet de scène `playSfx` ;
 *  - ANIM_ATTACK (mémorise le contexte) + ANIM_IMPACT → impact/tranche/sort, parade, critique ;
 *  - ANIM_MOVE → pas espacés le long du chemin ; MOVE_BLOCKED → heurt sourd (#792) ;
 *  - BATTLE_OVER (victoire) → gong ;
 *  - écran/mode/scène (store) → sélection musicale (`musicSelectionOf`) → canal musique (`audio/engine.ts`).
 * Ajouter un son = 1 def dans `audio/defs/` + (si nouvel événement) une ligne ici.
 */
import { bus, EVT } from '../noyau/bus';
import { isIndoor, type Scene } from '../noyau/monde/scene';
import { useGame } from './store';
import { scheduleFlowTimer } from '../web/minuteries';
import { playSfx, playMusic } from '../audio/engine';
import type { MusicSelection } from '../audio/music';

/** Tranche minimale d'état nécessaire (évite de dépendre du store — testable à sec). */
export interface MusicStateSlice {
  screen: string;
  mode: string;
  battle: unknown;
  scene: Pick<Scene, 'ambiance' | 'music'> | null | undefined;
}

/** La musique depuis l'état du jeu. Priorité : ce que la SCÈNE paramètre (éditeur : piste précise ou
 *  silence) > contexte automatique (exploration / intérieur / combat). */
export function musicSelectionOf(s: MusicStateSlice): MusicSelection {
  // Musique UNIQUEMENT en jeu (vue campagne) : c'est le seul écran qui expose les contrôles
  // audio (☰ → volume/sourdine). Menu, groupe, créateur, galeries… = SILENCE — on n'impose
  // pas une musique qu'on ne peut pas couper (demande utilisateur 2026-06-11).
  if (s.screen !== 'campaign') return null;
  const inBattle = s.mode === 'battle' && !!s.battle;
  // La scène a la main (éditeur) : piste imposée, ou silence explicite (null).
  const wanted = inBattle ? s.scene?.music?.combat : s.scene?.music?.ambient;
  if (wanted === null) return null;
  if (typeof wanted === 'string') return { def: wanted };
  if (inBattle) return { ctx: 'combat' };
  return { ctx: s.scene && isIndoor(s.scene) ? 'interieur' : 'exploration' };
}

let lastAttackKind: 'melee' | 'ranged' | 'spell' = 'melee';
/** Le heurt de la série en cours a-t-il déjà sonné ? (réarmé par le premier pas qui passe) */
let heurtSonne = false;

export function initAudioWiring(): void {
  // Musique de fond pilotée par l'état (`musicSelectionOf`) : silence hors écran `campaign`.
  playMusic(musicSelectionOf(useGame.getState()));
  useGame.subscribe((s) => playMusic(musicSelectionOf(s)));
  brancherLesSons();
}

/** Les sons ponctuels branchés sur le bus ; rend le geste qui les débranche tous. */
export function brancherLesSons(): () => void {
  const offs = [
    bus.on(EVT.DICE_ROLL, () => playSfx('des')),
    bus.on(EVT.SFX, (p: { id: string }) => playSfx(p.id)),
    bus.on(EVT.ANIM_ATTACK, (p: { kind?: 'melee' | 'ranged' | 'spell' }) => {
      lastAttackKind = p?.kind ?? 'melee';
    }),
    bus.on(EVT.ANIM_IMPACT, (p: { result?: { hit?: boolean; critiques?: number; parried?: boolean } }) => {
      const r = p?.result;
      if (!r) return;
      if (r.critiques) return playSfx('critique');
      if (r.hit) return playSfx(lastAttackKind === 'spell' ? 'sort' : lastAttackKind === 'ranged' ? 'tranche' : 'impact');
      playSfx('parade'); // déjoué : parade/esquive — le métal claque
    }),
    bus.on(EVT.ANIM_MOVE, (p: { path?: unknown[] }) => {
      heurtSonne = false;
      const steps = Math.min(4, Math.max(1, Math.floor((p?.path?.length ?? 1) / 2)));
      for (let i = 0; i < steps; i++) scheduleFlowTimer(() => playSfx('pas'), i * 220);
    }),
    // Heurt : le PREMIER blocage d'une série seulement. Une touche tenue contre un mur re-tente le pas à
    // la cadence de marche ; le mur ne sonne qu'une fois, et une avancée réussie (ANIM_MOVE) réarme.
    bus.on(EVT.MOVE_BLOCKED, () => {
      if (heurtSonne) return;
      heurtSonne = true;
      playSfx('heurt');
    }),
    bus.on(EVT.BATTLE_OVER, (p: { victory?: boolean }) => {
      if (p?.victory) playSfx('gong-victoire');
    }),
  ];
  return () => { for (const off of offs) off(); };
}

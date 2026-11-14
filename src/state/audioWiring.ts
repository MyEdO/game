/**
 * Câblage audio ← BUS d'événements (SFX) + STORE (musique de fond) :
 *  - DICE_ROLL → dés ; SFX → le son nommé par l'Effet de scène `playSfx` ;
 *  - ANIM_ATTACK (mémorise le contexte) + ANIM_IMPACT → impact/tranche/sort, parade, critique ;
 *  - ANIM_MOVE → pas espacés le long du chemin ; MOVE_BLOCKED → heurt sourd (#792) ;
 *  - BATTLE_OVER (victoire) → gong ;
 *  - écran/mode/scène (store) → sélection musicale (`musicSelectionOf`) → canal musique (`audio/engine.ts`) ;
 *  - le volume de chaque canal et la coupure de tout le son, lus dans la table des préférences (`noyau/volumes.ts`).
 * Ajouter un son = 1 def dans `data/sons/defs/` + (si nouvel événement) une ligne ici.
 */
import { bus, EVT } from '../noyau/bus';
import { selectionDeLaMusique, type EtatDeLaMusique } from '../noyau/musiqueDeLaPartie';
import { useGame } from './store';
import { scheduleFlowTimer } from '../web/minuteries';
import { brancherLeMixage, playSfx, playMusic } from '../audio/engine';
import { sonCoupe, volumeDuCanal } from '../noyau/volumes';
import type { MusicSelection } from '../data/sons/musique';

/** Tranche minimale d'état nécessaire (évite de dépendre du store — testable à sec). */
export interface MusicStateSlice extends EtatDeLaMusique {
  screen: string;
}

/** La musique depuis l'état du jeu : celle de la partie (`selectionDeLaMusique`), en jeu seulement (vue campagne), le
 *  seul écran qui expose les contrôles audio (☰ → couper le son, volumes) ; tout autre écran est silencieux (demande
 *  utilisateur 2026-06-11). */
export function musicSelectionOf(s: MusicStateSlice): MusicSelection {
  return s.screen === 'campaign' ? selectionDeLaMusique(s) : null;
}

let lastAttackKind: 'melee' | 'distance' | 'spell' = 'melee';
/** Le heurt de la série en cours a-t-il déjà sonné ? (réarmé par le premier pas qui passe) */
let heurtSonne = false;

export function initAudioWiring(): void {
  brancherLesSons();
  // Musique de fond pilotée par l'état (`musicSelectionOf`) : silence hors écran `campaign`.
  playMusic(musicSelectionOf(useGame.getState()));
  useGame.subscribe((s) => playMusic(musicSelectionOf(s)));
}

/** Les sons ponctuels branchés sur le bus, joués au volume de leur canal, muets son coupé (`noyau/volumes.ts`) ; rend
 *  le geste qui les débranche tous. */
export function brancherLesSons(): () => void {
  brancherLeMixage(volumeDuCanal, sonCoupe);
  const offs = [
    bus.on(EVT.DICE_ROLL, () => playSfx('des')),
    bus.on(EVT.SFX, (p) => playSfx(p.id)),
    bus.on(EVT.ANIM_ATTACK, (p) => {
      lastAttackKind = p.kind === 'creature' ? 'melee' : p.kind;
    }),
    bus.on(EVT.ANIM_IMPACT, (p) => {
      const r = p.result;
      if ('critiques' in r && r.critiques) return playSfx('critique');
      if ('hit' in r && r.hit) return playSfx(lastAttackKind === 'spell' ? 'sort' : lastAttackKind === 'distance' ? 'tranche' : 'impact');
      playSfx('parade'); // déjoué : parade/esquive — le métal claque
    }),
    bus.on(EVT.ANIM_MOVE, (p) => {
      heurtSonne = false;
      const steps = Math.min(4, Math.max(1, Math.floor(p.path.length / 2)));
      for (let i = 0; i < steps; i++) scheduleFlowTimer(() => playSfx('pas'), i * 220);
    }),
    // Heurt : le PREMIER blocage d'une série seulement. Une touche tenue contre un mur re-tente le pas à
    // la cadence de marche ; le mur ne sonne qu'une fois, et une avancée réussie (ANIM_MOVE) réarme.
    bus.on(EVT.MOVE_BLOCKED, () => {
      if (heurtSonne) return;
      heurtSonne = true;
      playSfx('heurt');
    }),
    bus.on(EVT.BATTLE_OVER, (p) => {
      if (p.victory) playSfx('gong-victoire');
    }),
  ];
  return () => { for (const off of offs) off(); };
}

/**
 * ENTRÉE EN SCÈNE — l'état « le monde a fini de cuire » rendu ATTENDABLE (#1478).
 *
 * Le voile d'entrée en scène vit dans le rendu volumique (`gameIso/stage/GameStage3D.tsx`), mais la
 * recette navigateur (`__wfrp.ready`) et le store doivent pouvoir l'attendre sans jamais importer
 * `src/gameIso` (mur `murs/purete-imports`, `oxlint.config.mjs`). Ce module est le point de
 * rendez-vous : le stage SIGNALE, l'appelant ATTEND. Aucun polling — les attentes sont réveillées
 * par `signalerEntreeEnScene`, plus un minuteur de garde.
 *
 * Le refus est une DONNÉE (`EntreeEnSceneNonAtteinte` : cause, id attendu, id monté, borne), jamais
 * de la prose : ce module est de la couche `state`, la narration de son refus appartient à son
 * appelant (`devtools.ts:ready`, seule surface FR — garde `i18n-narration-guard.test.ts`).
 */
import { scheduleFlowTimer, clearTrackedTimer } from './combatTimers';

type EtatEntree = { sceneId: string | null; voile: boolean };

/** Ce qui a manqué : rien de monté, mauvaise scène, ou voile encore levé. */
export type CauseNonAtteinte = 'aucun-monde' | 'scene-differente' | 'voile-leve';

/** Refus d'attente, MESURÉ : la cause nommée et les deux ids confrontés, à charge de l'appelant de
 *  les dire à sa surface. Le `message` reste TECHNIQUE (diagnostic de pile), jamais du texte joueur. */
export class EntreeEnSceneNonAtteinte extends Error {
  readonly cause: CauseNonAtteinte;
  readonly attendu: string | null;
  readonly montee: string | null;
  readonly timeoutMs: number;

  constructor(cause: CauseNonAtteinte, attendu: string | null, montee: string | null, timeoutMs: number) {
    super(`entreeEnScene: ${cause} (expected=${attendu ?? '-'} mounted=${montee ?? '-'} timeout=${timeoutMs}ms)`);
    this.name = 'EntreeEnSceneNonAtteinte';
    this.cause = cause;
    this.attendu = attendu;
    this.montee = montee;
    this.timeoutMs = timeoutMs;
  }
}

const etat: EtatEntree = { sceneId: null, voile: false };
const attentes = new Set<() => void>();

/** Le rendu du monde déclare ce qu'il montre : la scène montée (`null` = plus aucun monde) et si son
 *  voile d'entrée est encore LEVÉ. Réveille les attentes en cours. */
export function signalerEntreeEnScene(sceneId: string | null, voile: boolean): void {
  etat.sceneId = sceneId;
  etat.voile = voile;
  for (const reveiller of [...attentes]) reveiller();
}

/** Lecture de l'état courant (diagnostic, bancs). */
export function entreeEnScene(): Readonly<EtatEntree> {
  return { sceneId: etat.sceneId, voile: etat.voile };
}

function causeDuRefus(attendu: string | null): CauseNonAtteinte {
  if (etat.sceneId === null) return 'aucun-monde';
  if (attendu !== etat.sceneId) return 'scene-differente';
  return 'voile-leve';
}

/**
 * Résout dès que la scène ATTENDUE est montée et son voile tombé. Le tour de boucle initial
 * (`scheduleFlowTimer(…, 0)`) est structurant : `scenario()`/`goto()` appelés dans le même
 * `evaluate` que le `await` n'ont, à cet instant, pas laissé React commettre le montage qui suit —
 * sans ce tour de boucle, l'attente jugerait l'état du monde PRÉCÉDENT et rendrait « prêt » aussitôt.
 *
 * `sceneIdAttendu` est une FONCTION : l'id attendu se lit au moment du jugement (le store peut
 * n'avoir posé la scène qu'après l'appel).
 */
export function attendreEntreeEnScene(
  sceneIdAttendu: () => string | null,
  timeoutMs: number,
): Promise<{ sceneId: string; ms: number }> {
  const t0 = Date.now();
  return new Promise<void>((r) => { scheduleFlowTimer(() => r(), 0); }).then(() => new Promise((resolve, reject) => {
    const pret = (): boolean => etat.sceneId !== null && etat.sceneId === sceneIdAttendu() && !etat.voile;
    const fin = (): void => {
      attentes.delete(reveiller);
      clearTrackedTimer(minuteur);
    };
    const reveiller = (): void => {
      if (!pret()) return;
      fin();
      resolve({ sceneId: etat.sceneId as string, ms: Date.now() - t0 });
    };
    const minuteur = scheduleFlowTimer(() => {
      fin();
      const attendu = sceneIdAttendu();
      reject(new EntreeEnSceneNonAtteinte(causeDuRefus(attendu), attendu, etat.sceneId, timeoutMs));
    }, timeoutMs);
    attentes.add(reveiller);
    reveiller();
  }));
}

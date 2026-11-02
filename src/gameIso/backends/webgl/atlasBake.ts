/**
 * FILE CADENCÉE des rasterisations du monde volumique (#1176) : textures statiques de billboard
 * (`stage/texturesStatiques`) et gabarits de face (`faceBake`, `periodTexture`) se rangent derrière la
 * même horloge et le même barème de priorités. Des tranches d'inactivité à COÛT borné
 * (`BUDGET_TRANCHE_MS_DEFAUT`), jamais un burst.
 */

/**
 * Tâches lancées par tranche d'inactivité AVANT que le budget de temps ne décide de la suite
 * (`BUDGET_TRANCHE_MS_DEFAUT`) : le PLANCHER de service d'une tranche. Sonde navigateur (#1176,
 * 2026-08-14) : ~9,3 ms par rasterisation en 109×136 et ~10,1 ms en 217×271 — un réchauffage complet en
 * burst mesurait ≈ 2,4 s de mur.
 */
export const FRAMES_PAR_TRANCHE = 1;

/**
 * BUDGET de temps d'une TRANCHE (ms) : la tranche continue de servir tant qu'elle est restée sous ce
 * budget, et sert toujours au moins `FRAMES_PAR_TRANCHE` tâche. Le plafond d'UNE tâche par tranche
 * bornait le COMPTE, pas le COÛT : 85 gabarits de monde (médiane 1,47 ms de calcul chacun, 368 ms en
 * tout) prenaient 86 tranches, soit 1 112 ms de mur — le temps passé à ATTENDRE la tranche suivante,
 * pas à cuire. Une tâche LONGUE (une rasterisation de billboard) épuise le budget à elle seule et
 * garde donc sa tranche entière.
 *
 * Le budget compte le temps SYNCHRONE consommé dans la tranche : c'est exactement ce qui fait la
 * durée d'une tâche longue pour le thread. Ce qu'une tâche poursuit APRÈS son point d'attente (le
 * décodage d'une image) n'est pas de la tranche et n'y est pas compté.
 */
export const BUDGET_TRANCHE_MS_DEFAUT = 6;
let budgetTrancheMs = BUDGET_TRANCHE_MS_DEFAUT;

/** Change le budget de tranche (réglage de mesure/garde) — rend l'ancien. À `0`, la tranche sert
 *  exactement `FRAMES_PAR_TRANCHE` tâche : la cadence stricte dont un banc d'ORDRE a besoin pour lire
 *  la file coup par coup. */
export function setBudgetTrancheMs(n: number): number {
  const avant = budgetTrancheMs;
  budgetTrancheMs = n;
  return avant;
}

/** Priorités d'usage : la vue courante passe devant le réchauffage du reste. */
export const PRIORITE_VUE_COURANTE = 100;
/**
 * Les GABARITS DU MONDE (colombage `faceBake`, périodes `periodTexture`) : SOUS la vue courante,
 * AU-DESSUS du réchauffage. Un gabarit qui manque laisse sa surface sur son aplat de base et se
 * relève EN PLACE sous le voile ; un billboard qui manque, lui, est le quad absent que ce voile
 * existe pour cacher. À file chargée, la vue courante passe donc devant le sol.
 */
export const PRIORITE_FOND = 90;
export const PRIORITE_RECHAUFFAGE = 0;

/** Priorité MUTABLE d'une tâche : son appelant peut la relever tant qu'elle attend en file. */
export interface BakePriority {
  value: number;
}

interface Job {
  prio: BakePriority;
  seq: number;
  run: () => void;
}

const QUEUE: Job[] = [];
let seq = 0;
let sliceArmed = false;
let slices = 0;

function requestSlice(): void {
  if (sliceArmed) return;
  sliceArmed = true;
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => pump());
  else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => pump());
  else setTimeout(pump, 0);
}

function pump(): void {
  sliceArmed = false;
  slices += 1;
  const début = performance.now();
  let servies = 0;
  while (QUEUE.length && (servies < FRAMES_PAR_TRANCHE || performance.now() - début < budgetTrancheMs)) {
    let best = 0;
    for (let k = 1; k < QUEUE.length; k++) {
      const a = QUEUE[k];
      const b = QUEUE[best];
      if (a.prio.value > b.prio.value || (a.prio.value === b.prio.value && a.seq < b.seq)) best = k;
    }
    QUEUE.splice(best, 1)[0].run();
    servies += 1;
  }
  if (QUEUE.length) requestSlice();
}

/** Passe une tâche par la file : elle ne s'exécute qu'à son tour de tranche.
 *
 *  Le JET SYNCHRONE de la tâche (une couture navigateur devenue indisponible entre la mise en file et
 *  la tranche — un contexte perdu, un banc démonté) rejette sa promesse comme n'importe quel échec.
 *  Laissé nu, il s'échappait de la tranche et remontait en erreur non gérée depuis un
 *  `requestIdleCallback`. */
export function queueBakeTask<T>(priority: number | BakePriority, task: () => Promise<T>): Promise<T> {
  const prio = typeof priority === 'number' ? { value: priority } : priority;
  return new Promise<T>((resolve, reject) => {
    QUEUE.push({ prio, seq: seq++, run: () => { try { void task().then(resolve, reject); } catch (e) { reject(e); } } });
    requestSlice();
  });
}

/** Tranches servies depuis le chargement — instrument de garde de la CADENCE. */
export function bakeSliceCount(): number {
  return slices;
}

/** Longueur de la file — instrument de garde (« aucune rasterisation hors file »). */
export function bakeQueueLength(): number {
  return QUEUE.length;
}

/** Abandonne les tâches en attente et désarme la tranche (changement de scène, teardown de garde) :
 *  leurs promesses restent en suspens. */
export function resetBakeQueue(): void {
  QUEUE.length = 0;
  sliceArmed = false;
}

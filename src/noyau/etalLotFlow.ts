/**
 * LE FLUX DU LOT DE DÉS D'UN ÉTAL (#1426) — la couture entre les générateurs d'étal (halle terrestre,
 * étal portuaire) et la fenêtre de lot. Les générateurs ne connaissent pas la fenêtre : ils s'inscrivent
 * ICI sous un id (patron `registerCascadeApplier`), et le flux décide s'il les exécute d'un trait ou
 * s'il offre d'abord leurs dés à la pose.
 *
 * DEUX CHEMINS, UN SEUL GÉNÉRATEUR — et c'est la SURFACE qui tranche, le même prédicat que tout jet
 * (`rollSeam.surfaceOf` sur le porteur MONDE, #1426) :
 *  - aucun siège humain ne tient le monde (cadence déférée à un automate) : le générateur tourne UNE
 *    fois, sur le rng vivant — l'écran s'ouvre dans la foulée ;
 *  - un siège tient le monde : il tourne une fois sur un rng ENREGISTREUR (même flux d'aléa, même
 *    ordre), la fenêtre montre ses dés, et la validation le REJOUE avec les dés du lot — sans
 *    consommer d'aléa. L'option « Dés fixés » n'entre pas dans l'ouverture de la fenêtre : elle ne
 *    gate que la POSE d'un dé, au site unique de la pose (`ui/forcedDieRow`, `canFixDie`).
 *
 * L'invariant que ce flux ne paie jamais : la fenêtre ne change rien par sa seule existence. Valider
 * sans rien poser rejoue les dés enregistrés et rend l'étal identique.
 */
import type { Get, Set } from './flowTypes';
import type { EtalLotRow } from './pendings';
import type { RNG } from '../engine/dice';
import { battleRng } from './battleRng';
import { surfaceOf } from './rollSeam';
import { WORLD_STEP_OWNER } from './pendings';
import { lotEnregistreur, lotRejoueur, type EtalDraw } from './monde/etalLot';
import type { ActionsDuNoyau } from './actionsDuNoyau';

/** Un générateur d'étal : il TIRE (via le rng qu'on lui donne), il POSE son état, il ne rend rien.
 *  `phase` lui sert à NOMMER ce que chaque dé décide — sans nom, un dé n'est pas posable. */
export type EtalGenerateur = (get: Get, set: Set, rng: RNG, phase: (label: string) => void) => void;

const generateurs: Record<string, { gen: EtalGenerateur; apres?: (get: Get, set: Set) => void }> = {};

/** Inscrit le générateur d'un étal sous son id (`'land'`, `'port'`). `apres` = ce qui suit l'étal une
 *  fois posé (le Test de Ragot de la halle) — il ne doit PAS s'ouvrir avant la validation du lot. */
export function registerEtalGenerateur(cible: string, gen: EtalGenerateur, apres?: (get: Get, set: Set) => void): void {
  generateurs[cible] = { gen, apres };
}

/**
 * Ouvre un étal : soit d'un trait, soit par la fenêtre de lot. `label` titre la fenêtre.
 *
 * `surfaceOf` porte DÉJÀ la cadence (auto → aucun siège à la manœuvre) : une fenêtre n'a pas de sens
 * quand le joueur a demandé qu'on joue à sa place.
 */
export function ouvrirEtal(get: Get, set: Set, cible: 'land' | 'port', label: string): void {
  const entree = generateurs[cible];
  if (!entree) return;
  if (!surfaceOf(get, WORLD_STEP_OWNER)) {
    entree.gen(get, set, battleRng(), () => {});
    entree.apres?.(get, set);
    return;
  }
  // Un siège tient le monde : on tire pour de vrai (le flux d'aléa est celui d'avant), on montre les dés, et
  // l'état d'étal produit par ce passage sera REMPLACÉ par le rejeu de la validation.
  const lot = lotEnregistreur(battleRng());
  entree.gen(get, set, lot.rng, lot.phase);
  if (!lot.draws.length) { entree.apres?.(get, set); return; } // aucun dé à poser : rien à demander
  set({ pendingEtalLot: { label, cible, participants: lot.draws.map(enRangee) } });
}

/** Un dé du lot devient une RANGÉE : posable, sans acteur, déjà tombée (aucun jet à lancer). */
const enRangee = (d: EtalDraw): EtalLotRow => ({
  id: d.id, label: d.label, min: d.min, max: d.max, value: d.value, interactive: true, result: null,
});

/**
 * DÉNOUEMENT du lot (les deux gestes de bloc y mènent) : rejoue le générateur avec les dés du lot,
 * ferme la fenêtre, puis laisse venir ce qui suit l'étal. Le rejeu ne consomme AUCUN aléa vivant —
 * sauf débordement DIT (`lotRejoueur`) quand un dé posé ouvre une branche que le lot n'avait pas vue.
 */
export function appliquerLotEtal(get: Get, set: Set): void {
  const p = get().pendingEtalLot;
  if (!p) return;
  const entree = generateurs[p.cible];
  set({ pendingEtalLot: null });
  if (!entree) return;
  const rejeu = lotRejoueur(p.participants.map((r) => ({ id: r.id, label: r.label, min: r.min, max: r.max, value: r.value })), battleRng());
  entree.gen(get, set, rejeu.rng, () => {});
  entree.apres?.(get, set);
}

export function creerActionsDuLotDEtal(get: Get, set: Set) {
  return {
    // LOT DE DÉS d'un étal (#1426) — les deux gestes de BLOC. « Valider » rejoue le générateur avec les
    // dés du lot (posés ou naturels) : c'est le MÊME code que l'ouverture sans fenêtre, nourri par un rng
    // rejoueur qui ne consomme aucun aléa vivant. « Renoncer » applique le lot TEL QU'IL EST TOMBÉ — un
    // étal existe de toute façon, la fenêtre n'est qu'une offre de pose.
    etalLotConfirm: () => { appliquerLotEtal(get, set); },
    etalLotCancel: () => { appliquerLotEtal(get, set); },
  } satisfies Partial<ActionsDuNoyau>;
}

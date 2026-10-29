/**
 * PÉRILS D'AUTEUR D'UNE ROUTE (#1426) — SOURCE UNIQUE, partagée par le voyage TERRESTRE
 * (`travelFlow`) et MARITIME (`seaVoyageFlow`). Un péril d'auteur (`MapRoute.perils`) est une chance
 * par jour (`chancePct`) posée à l'ÉDITEUR ; s'il se déclenche, ses `Effect[]` s'appliquent, et un
 * effet `startCombat`/`transition` INTERROMPT le trajet.
 *
 * Ce que ce module remplace : deux boucles `for (peril of route.perils) { if (d100 > chancePct)
 * continue; … }` qui roulaient leur dé en silence — un dé de MONDE que le siège qui possède
 * l'environnement ne voyait jamais. Chaque péril est UNE étape (`worldStep`, évaluation
 * `'seuil'` : `dé ≤ chancePct`, ni bande ni DR — un pourcentage d'auteur n'est pas un Test), donc
 * posable sous « Dés fixés » et TRACÉE au journal qu'elle se déclenche ou non.
 *
 * L'INTERRUPTION passe par le verbe du séquenceur (`stopSequence`) : les périls suivants n'ont plus
 * lieu d'être, et leurs dés ne se tirent donc pas — c'est ce qui rend le flux RNG identique au `break`
 * de la boucle d'origine.
 *
 * DEUX PROTOCOLES DE REPRISE, un seul applier : le champ d'arrêt est le MÊME (`travelPlan.interrupted`)
 * ; seule diffère la manière dont le trajet reprendra ses effets — la mer les applique tout de suite
 * (`resumeTravel` rejoue la traversée), la terre les DIFFÈRE dans `travelPlan.land.interrupt` (le
 * `TravelThen` que `continueTravelDayAfterCascade` rejouera).
 *
 * Le protocole n'est PAS deviné depuis l'état (le `mode` d'un plan terrestre vaut « pied » ou
 * « monture », jamais « terre ») : le flux qui BÂTIT ses étapes le DÉCLARE par son id, et cet id
 * voyage dans `meta` — donc sérialisable, donc identique hôte/invité en coop.
 */
import type { Get, Set } from './flowTypes';
import type { MapRoute } from './worldMap';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import type { BuiltCascadeStep } from './stepBrand';
import { worldStep, freeCons } from './rollSeam';
import { dataLabel } from '../data';
import { applyEffects, applyEffectsLoot, jouerFlowEntier } from './combatEffects';
import { t } from '../i18n';
import { tablesPosees, type FragmentDeTables, type InterruptionDePeril, type PartDeTable } from './tablesPosees';

export const AUTHOR_PERIL_KIND = 'authorPeril';

/** Un péril d'auteur INTERROMPT-il le trajet ? (effet de combat ou de transition de scène). */
export function perilInterrupts(effects: Effect[] | undefined): boolean {
  return (effects ?? []).some((e) => e.type === 'startCombat' || e.type === 'transition');
}

/**
 * Comment le flux propriétaire encaisse une interruption d'auteur — DÉCLARÉ par lui, jamais deviné
 * ici : la mer applique les effets sur-le-champ, la terre les diffère à sa reprise de jour.
 */
export interface PerilInterruptHandler {
  /** Renvoie les lignes de journal propres au flux (ex. « le voyage est interrompu à destination X »). */
  (get: Get, set: Set, effects: Effect[], label: string): string[];
}


/**
 * Les étapes de chance des périls d'auteur d'une route — UNE par péril, dans l'ORDRE d'authoring
 * (l'ordre EST le flux RNG : le premier déclaré tire le premier).
 */
export function buildAuthorPerilSteps(route: MapRoute, destLabel: string, interruptId: InterruptionDePeril): BuiltCascadeStep[] {
  return (route.perils ?? []).map((peril, i) => worldStep({
    id: `author-peril-${i}`,
    kind: AUTHOR_PERIL_KIND,
    label: dataLabel(peril.label),
    icon: 'ui/warning',
    cible: Math.max(0, Math.min(100, peril.chancePct)),
    rollLabel: peril.label,
    verdict: { reussite: t('seuil.survient'), echec: t('seuil.evite') },
    meta: { perilIndex: i, destLabel, interruptId },
  }));
}

/** Applique les effets d'un péril SUR-LE-CHAMP (protocole maritime : `resumeTravel` rejoue la traversée). */
export function applyPerilEffectsNow(get: Get, set: Set, effects: Effect[]): string[] {
  jouerFlowEntier(applyEffects(get, set, effects));
  return [];
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = [AUTHOR_PERIL_KIND] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    [AUTHOR_PERIL_KIND]: (get, set, step) => {
      if (!step.result) return {};
      const route = (get().worldMap)?.routes.find((r) => r.id === get().travelPlan?.routeId);
      const peril = route?.perils?.[Number(step.meta?.perilIndex ?? -1)];
      if (!peril) return {};
      // ÉVITÉ : le dé garde sa ligne (rangée surfacée, ou trace de journal quand aucune fenêtre ne s'ouvre)
      // et la conséquence DIT l'issue. Un péril qui ne survient pas se LIT — le verrou est au test
      // (`de-monde-surface.hors-store.test.ts`, delta de journal nominatif), pas dans ce commentaire.
      if (!step.result.success) return { consequences: freeCons([{ text: t('tf.perilAvoided', { label: peril.label }), tone: 'info' }]) };
      const lignes: string[] = [t('tf.perilAuthor', { label: peril.label })];
      if (perilInterrupts(peril.effects)) {
        set({ travelPlan: { ...get().travelPlan!, interrupted: true } });
        const suite = tablesPosees().interruptionsDePeril[String(step.meta?.interruptId ?? '')]?.(get, set, peril.effects, String(step.meta?.destLabel ?? '')) ?? [];
        lignes.push(...suite);
        // Les périls RESTANTS n'ont plus lieu d'être : le trajet s'arrête ici. La troncature — et non
        // l'ouverture du combat — est ce qui garantit que leurs dés ne se tirent pas (parité du `break`).
        return { consequences: freeCons(lignes), stopSequence: true };
      }
      jouerFlowEntier(applyEffectsLoot(get, set, peril.effects, peril.label)); // trouvaille d'auteur → fenêtre d'attribution
      return { consequences: freeCons(lignes) };
    },
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
} satisfies FragmentDeTables;

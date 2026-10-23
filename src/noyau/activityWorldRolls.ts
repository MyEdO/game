/**
 * DÉS DE MONDE d'une Activité (`ActivityDef.worldRolls`) — le pendant « après le Test » des périls
 * d'auteur d'une route (`authorPerils.ts`, MÊME patron) : un pourcentage que l'ENVIRONNEMENT roule,
 * pas le héros. Mendier : « les Personnages surpris à mendier par leurs pairs ou associés perdront
 * probablement leur Statut, à moins qu'ils n'aient déjà une Carrière de Mendiant, ou une autre
 * Carrière sans ressources » (LDB 09 l.99) — la probabilité n'est pas chiffrée par le livre, elle vit
 * donc en règle optionnelle (`{rule}`), l'issue en `GameOp`, et l'exemption en `Condition` GÉNÉRALE
 * sur le Statut d'entrée de la carrière (jamais un id de carrière : `activityConditionCtx`).
 *
 * Le dé passe par la PORTE (`worldStep`, évaluation `'seuil'` : `dé ≤ cible`, ni Difficulté ni DR) —
 * il est donc fixable sous « Dés fixés » et tracé au journal qu'il tombe ou non (doctrine utilisateur
 * 2026-09-04 : « tous les jets passent par le même point d'entrée »).
 */
import type { BuiltCascadeStep } from './stepBrand';
import type { Combatant } from '../engine/types';
import { activityById, activityConditionCtx, type ActivityDef } from '../engine/activities';
import { evalCondition } from '../engine/flowCore';
import { applyOps, formulaExpectation } from '../engine/ops';
import { battleRng } from './battleRng';
import { worldStep, freeCons } from './rollSeam';
import { dataLabel } from '../data';
import { t } from '../i18n';
import type { FragmentDeTables, PartDeTable } from './tablesPosees';
import { idNeuf } from './plateforme';

export const ACTIVITY_WORLD_ROLL_KIND = 'activityWorldRoll';

/**
 * Les étapes de monde d'une Activité pour UN acteur, dans l'ORDRE d'authoring (l'ordre EST le flux
 * RNG). Un tirage dont l'`unless` est satisfaite n'est PAS bâti : l'exempté ne roule rien.
 */
export function buildActivityWorldRollSteps(def: ActivityDef, actor: Combatant): BuiltCascadeStep[] {
  const ctx = activityConditionCtx(actor);
  return (def.worldRolls ?? [])
    .filter((wr) => !(wr.unless && evalCondition(wr.unless, ctx)))
    .map((wr) => worldStep({
      id: `activity-world-${def.id}-${wr.id}`,
      kind: ACTIVITY_WORLD_ROLL_KIND,
      label: dataLabel(wr.label),
      icon: 'ui/warning',
      // La CIBLE d'un dé de monde est un POURCENTAGE d'auteur : elle se LIT, elle ne se tire pas.
      // `formulaExpectation` est la lecture SANS RNG d'une `Formula` — exacte pour un littéral ou un
      // `{rule}`, les deux seules formes qu'un pourcentage prend (aucun rng vivant ne descend ici).
      cible: Math.max(0, Math.min(100, Math.round(formulaExpectation(wr.cible, actor)))),
      rollLabel: wr.label,
      verdict: { reussite: t('seuil.survient'), echec: t('seuil.evite') },
      meta: { activityId: def.id, rollId: wr.id, heroId: actor.id },
    }));
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = [ACTIVITY_WORLD_ROLL_KIND] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    [ACTIVITY_WORLD_ROLL_KIND]: (get, set, step) => {
      if (!step.result) return {};
      const def = activityById(String(step.meta?.activityId ?? ''));
      const wr = def?.worldRolls?.find((w) => w.id === String(step.meta?.rollId ?? ''));
      const h = get().party.find((x) => x.id === String(step.meta?.heroId ?? ''));
      if (!def || !wr || !h) return {};
      // ÉVITÉ : le dé garde sa ligne et la conséquence DIT l'issue (patron `authorPerils`).
      if (!step.result.success) return { consequences: freeCons([{ text: t('out.rienNAdvient', { label: wr.label }), tone: 'info' }]) };
      const lignes = applyOps(h, wr.ops, {
        idNeuf,
        rng: battleRng(), label: wr.label, now: get().gameTime, source: { kind: 'activity', id: def.id },
      });
      set({ party: [...get().party] });
      return { consequences: freeCons([{ text: wr.label, tone: 'bad' }, ...lignes.map((text) => ({ text, tone: 'bad' as const }))]) };
    },
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
} satisfies FragmentDeTables;

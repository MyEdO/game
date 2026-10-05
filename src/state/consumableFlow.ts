/**
 * RUNNER de CONSOMMABLE (#50) — exécute le **Flow** d'un objet consommé (drogues LDB 71, herbes/potions
 * LDB 72, nécessaires LDB 67) sur son BUVEUR, cadence-aware (« zéro jet silencieux ») :
 *
 *  - EN COMBAT (`battleUseItem`) : délègue à `runCombatFlow` (héros manuel → un nœud `test` devient une
 *    étape de cascade INFLUENÇABLE ; cadence auto → jet inline) — la même voie que les sorts/triggers.
 *  - HORS COMBAT (`usePartyItem`) : walker de scène — un nœud `test` ouvre la modale de Test
 *    (`openSkillTest`) RESTREINTE AU BUVEUR (`actorId` : c'est LUI qui boit, pas le meilleur du groupe),
 *    branches + continuation reprises par `resolveTest`.
 *
 * La DURÉE d'horloge (LDB 71/72 « Durée : … ») est résolue AU BOIRE (`consumableUntilTime`) puis BAKÉE
 * sur chaque feuille du Flow (`bakeConsumableFlow`) : une branche suspendue (sérialisée dans un pending)
 * garde son échéance quel que soit l'exécuteur qui la reprend (`applyLeafOps`/`leafOpsCtx`). Les ops
 * IMPURES `delayed` (Bonnet de fou/Délice de Ranald/Belladone) sont PROGRAMMÉES (`scheduleDelayedOps`).
 */
import type { Combatant, ItemInstance, EffectSource } from '../engine/types';
import { isConsumable, consumableUntilTime, bakeConsumableFlow } from '../engine/consumables';
import { type Flow, evalCondition, resolveTestDifficulty, type ConditionCtx } from './flow';
import { condCtx } from './bourseFlow';
import { buildActorView, flowTestGated } from './combat/flowEval';
import { runCombatFlow, withDerivedStake } from './combat/triggeredTest';
import { markActed } from './combatFlow';
import { openSkillTest, runFlow, applyLeafOps, drainPendingLog, differerLaSuite, jouerFlowEntier, OPS_DIFFEREES } from './combatEffects';
import { gainCorruption } from './corruptionFlow';
import { touchActors } from './combatOrParty';
import { battleRng } from './battleRng';
import { ev } from './combatLog';
import type { Get, Set as SetFn } from './flowTypes';
import { bus, EVT } from './bus';
import { t } from '../i18n';
import { libelleDObjet } from './campaignData';

/** ConditionCtx de SCÈNE augmenté du BUVEUR comme acteur (`target` ET `caster`) — les Conditions
 *  d'acteur (`has group Elfe` de la Fleur de lune, `compare woundsCurrent` de la Potion de guérison)
 *  s'évaluent sur LUI, les Conditions de scène (flags/horloge/bourse) restent celles du monde. */
function drinkerCtx(get: Get, hero: Combatant): ConditionCtx {
  const view = buildActorView(hero);
  return { ...condCtx(get), target: view, caster: view };
}

/** Walker de SCÈNE du Flow baké d'un consommable — calque `runFlow` mais : feuilles appliquées au
 *  BUVEUR via `applyLeafOps` (durée bakée + `delayed` programmées), `if` évalués avec sa vue d'acteur,
 *  `test` gaté (`exceptGroups` du Bonnet de fou…) puis ouvert RESTREINT à lui (`actorId`). Un nœud
 *  `choice` (aucun consommable n'en porte) prend sa branche `no` — défaut conservateur, pas de décision
 *  silencieuse. Les branches d'un `test` suspendu sont reprises par `resolveTest`→`runFlow` : leurs
 *  feuilles BAKÉES (`on:'hero'` + untilTime) y retombent sur le handler `ops` (applyLeafOps). */
function runSceneConsumableFlow(get: Get, set: SetFn, hero: Combatant, flow: Flow, label: string, source?: EffectSource): void {
  const stack: Flow[] = [flow];
  while (stack.length) {
    const node = stack.shift()!;
    switch (node.kind) {
      case 'do': {
        if (node.effect.type === 'ops') {
          const lines = applyLeafOps(get, set, hero, node.effect, {
            rng: battleRng(),
            // PROVENANCE du produit bu : un poison qui enduit la lame (`augmentWeapon`) garde SON
            // identité sur les effets fondus dans l'arme (`stampSource`, engine/ops) — sans elle, le
            // Test qu'il exige nommerait l'ÉPÉE au lieu du poison (#1262 V2 L6d).
            ...(source ? { source } : {}),
            onCorruption: (n, align) => gainCorruption(get, set, hero, n, align),
          });
          // Feuille partie à la PORTE (#1508) : le reste de la pile est SA suite, exactement comme
          // pour un nœud `test` ci-dessous — sans quoi la fin du produit s'appliquerait par-dessus un
          // dé en vol. Reprise par le walker de SCÈNE : les feuilles bakées y retombent sur `ops`.
          if (lines === OPS_DIFFEREES) { differerLaSuite(set, { kind: 'seq', steps: stack.splice(0) }, 'scene', label); return; }
          set(touchActors(get()));
          for (const l of lines) get().log(l);
        }
        break;
      }
      case 'seq': stack.unshift(...node.steps); break;
      case 'if': {
        const branch = evalCondition(node.cond, drinkerCtx(get, hero)) ? node.then : node.else;
        if (branch) stack.unshift(branch);
        break;
      }
      case 'test': {
        const cc = drinkerCtx(get, hero);
        // Gates op-level (Bonnet de fou : `exceptGroups:['Peau-Verte']` — les peaux-vertes ne testent
        // pas, LDB 71 l.20) : no-op → on continue la séquence.
        if (flowTestGated(node.test, hero, cc)) break;
        const after: Flow = { kind: 'seq', steps: stack.splice(0) };
        // Le BUVEUR encaisse seul ce que le produit lui fait (LDB 12 l.197) — défaut de la VOIE,
        // tri-état : la donnée le rouvre là où le Test n'est pas une résistance (`noSupport:false`,
        // Nécessaire antipoison : Test de Guérison).
        // Enjeu DÉRIVÉ du PRODUIT bu quand la donnée n'en déclare pas (#1262 V2 L6d) : « ce qui se joue »
        // EST le consommable, et sa fiche Codex porte déjà sa règle verbatim.
        const ft = { ...withDerivedStake(node.test, source), difficulty: resolveTestDifficulty(node.test, cc), noSupport: node.test.noSupport ?? true };
        // Modale RESTREINTE au buveur ; impossible (mort) → continuation directe.
        if (!openSkillTest(get, set, ft, node.success, node.fail, after, { actorId: hero.id })) jouerFlowEntier(runFlow(get, set, after, label));
        return;
      }
      case 'choice': {
        if (node.no) stack.unshift(node.no);
        break;
      }
    }
  }
}

/** Exécute le Flow d'un consommable sur son buveur (durée résolue + bake, puis la voie du contexte). */
export function runConsumable(get: Get, set: SetFn, hero: Combatant, item: ItemInstance): void {
  if (!item.consumable) return;
  const now = get().gameTime;
  const untilTime = consumableUntilTime(item, now, hero, battleRng());
  const baked = bakeConsumableFlow(item.consumable, hero.id, untilTime, libelleDObjet(item));
  const inBattle = !!get().battle && get().battle!.combatants.some((c) => c.id === hero.id);
  // ENTITÉ PORTEUSE du Flow : la POSSESSION bue, par son id de catalogue (#1262 V2 L6d).
  const source: EffectSource | undefined = item.trappingId ? { kind: 'trapping', id: item.trappingId } : undefined;
  if (inBattle) {
    runCombatFlow({
      mode: 'combat', get, set, target: hero, caster: hero, label: libelleDObjet(item),
      opsCtx: { now, ...(untilTime != null ? { defaultUntilTime: untilTime } : {}), label: libelleDObjet(item), ...(source ? { source } : {}) },
    }, baked);
  } else {
    runSceneConsumableFlow(get, set, hero, baked, libelleDObjet(item), source);
  }
}

/** HORS COMBAT : un héros utilise un consommable (potion, drogue, bandage) depuis sa fiche —
 *  consommé, journalisé, Flow exécuté (un Test « au boire » ouvre sa modale). Le combat passe par
 *  `battleUseItem` (coûte l'Action). */
export function usePartyItem(get: Get, set: SetFn, heroId: string, uid: string): void {
  if (get().battle) return; // en combat → battleUseItem
  const party = get().party;
  const hero = party.find((h) => h.id === heroId);
  const it = hero?.items?.find((i) => i.uid === uid);
  if (!hero || !it) return;
  if (!isConsumable(it)) return;
  hero.items = (hero.items ?? []).filter((i) => i.uid !== uid); // consommé AVANT l'effet (dose unique)
  set({ party: [...party] });
  get().log(`${hero.label} utilise : ${libelleDObjet(it)}.`);
  runConsumable(get, set, hero, it);
  bus.emit(EVT.SCENE_DIRTY);
}

/** EN COMBAT : consommation par le combattant ACTIF (une Action) — appelée par `battleUseItem`
 *  (combatSlice) après ses gardes (tour du héros, Action disponible). Le Flow passe par la voie de
 *  combat cadence-aware ; le journal différé est déversé dans le log de bataille. */
export function battleConsumeItem(get: Get, set: SetFn, active: Combatant, it: ItemInstance): void {
  active.items = (active.items ?? []).filter((i) => i.uid !== it.uid); // consommé
  active.aiming = false; // une autre action que le tir gâche la visée
  runConsumable(get, set, active, it);
  const battle = get().battle;
  if (!battle) return;
  const queued = drainPendingLog(get, set); // lignes du Flow (inline) → événements du log de bataille
  set({
    battle: {
      ...markActed(get, set, battle), action: null,
      log: [...battle.log, ev('item', t('cs.useConsumable', { name: active.label, item: libelleDObjet(it) }), active.id), ...queued],
    },
  });
}

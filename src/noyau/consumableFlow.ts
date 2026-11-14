/**
 * RUNNER de CONSOMMABLE (#50) — exécute le **Flow** d'un objet consommé (drogues LDB 71, herbes/potions
 * LDB 72, nécessaires LDB 67) sur son BUVEUR, cadence-aware (« zéro jet silencieux ») :
 *
 * Le geste est `utiliserLObjet` (combatSlice), en combat comme hors combat ; la voie suit le contexte :
 *  - EN COMBAT : délègue à `runCombatFlow` (héros manuel → un nœud `test` devient une
 *    étape de cascade INFLUENÇABLE ; cadence auto → jet inline) — la même voie que les sorts/triggers.
 *  - HORS COMBAT : hôte de scène d'`executerFlow` — un nœud `test` ouvre la modale de Test
 *    (`openSkillTest`) RESTREINTE AU BUVEUR (`actorId` : c'est LUI qui boit, pas le meilleur du groupe),
 *    branches + continuation reprises par `jetValider('test')`.
 *
 * La DURÉE d'horloge (LDB 71/72 « Durée : … ») est résolue AU BOIRE (`consumableUntilTime`) puis BAKÉE
 * sur chaque feuille du Flow (`bakeConsumableFlow`) : une branche suspendue (sérialisée dans un pending)
 * garde son échéance quel que soit l'exécuteur qui la reprend (`applyLeafOps`/`leafOpsCtx`). Les ops
 * IMPURES `delayed` (Bonnet de fou/Délice de Ranald/Belladone) sont PROGRAMMÉES (`scheduleDelayedOps`).
 */
import type { Combatant, ItemInstance, EffectSource } from '../engine/types';
import { consommableDe, consumableUntilTime, bakeConsumableFlow } from '../engine/consumables';
import type { Effect, Flow } from '../data/schemas/defs-scenes/effets';
import { executerFlow, type ArretDeFlow, type ConditionCtx } from '../engine/flowCore';
import { resoudreFlowTest } from '../engine/decisionDuTest';
import { condCtx } from './bourseFlow';
import { buildActorView } from '../engine/actorView';
import { runCombatFlow, withDerivedStake } from './combat/triggeredTest';
import { openSkillTest, runFlow, applyLeafOps, confierLaSuite, jouerFlowEntier, OPS_DIFFEREES } from './combatEffects';
import { gainCorruption } from './corruptionFlow';
import { touchActors } from './combatOrParty';
import { battleRng } from './battleRng';
import type { Get, Set as SetFn } from './flowTypes';
import { t } from '../i18n';
import { reussiteSansObjet, type GameOp } from '../engine/ops';

/** ConditionCtx de SCÈNE augmenté du BUVEUR comme acteur (`target` ET `caster`) — les Conditions
 *  d'acteur (`has group elfe` de la Fleur de lune, `compare woundsCurrent` de la Potion de guérison)
 *  s'évaluent sur LUI, les Conditions de scène (flags/horloge/bourse) restent celles du monde. */
function drinkerCtx(get: Get, hero: Combatant): ConditionCtx {
  const view = buildActorView(hero);
  return { ...condCtx(get), target: view, caster: view };
}

/** Hôte de SCÈNE (`executerFlow`) du Flow baké d'un consommable — comme `runFlow`, mais : feuilles appliquées au
 *  BUVEUR via `applyLeafOps` (durée bakée + `delayed` programmées), `si` évalués avec sa vue d'acteur,
 *  `test` gaté (`exceptGroups` du Bonnet de fou…) puis ouvert RESTREINT à lui (`actorId`). Un nœud
 *  `choix` (aucun consommable n'en porte) prend sa branche `non` — défaut conservateur, pas de décision
 *  silencieuse. Les branches d'un `test` suspendu sont reprises par `jetValider('test')`→`runFlow` : leurs
 *  feuilles BAKÉES (`on:'hero'` + untilTime) y retombent sur le handler `ops` (applyLeafOps). */
function runSceneConsumableFlow(get: Get, set: SetFn, hero: Combatant, flow: Flow, label: string, source?: EffectSource): void {
  const fini: ArretDeFlow<void> = { arret: undefined };
  executerFlow<Effect, void>(flow, {
    conditions: () => drinkerCtx(get, hero),
    feuille: (node, reste) => {
      if (node.effet.type !== 'ops') return undefined;
      const lines = applyLeafOps(get, set, hero, node.effet, { idNeuf: get().forgerUnId,
        rng: battleRng(),
        // PROVENANCE du produit bu : un poison qui enduit la lame (`augmentWeapon`) garde SON
        // identité sur les effets fondus dans l'arme (`stampSource`, engine/ops) — sans elle, le
        // Test qu'il exige nommerait l'ÉPÉE au lieu du poison (#1262 V2 L6d).
        ...(source ? { source } : {}),
        onCorruption: (n, align) => gainCorruption(get, set, hero, n, align),
      });
      // Feuille partie à la PORTE (#1508) : le reste de la pile est SA suite, exactement comme
      // pour un nœud `test` ci-dessous — sans quoi la fin du produit s'appliquerait par-dessus un
      // dé en vol. Reprise par `runFlow` : les feuilles bakées y retombent sur `ops`.
      if (lines === OPS_DIFFEREES) {
        const steps = reste().etapes;
        if (steps.length) confierLaSuite(set, [{ verbe: 'reprendreFlow', flow: { kind: 'sequence', etapes: steps }, label }]);
        return fini;
      }
      set(touchActors(get()));
      for (const l of lines) get().ecrireAuJournal(l);
      return undefined;
    },
    test: (node, reste) => {
      const cc = drinkerCtx(get, hero);
      // Test non joué (Bonnet de fou : `exceptGroups: ['peau-verte']`, LDB 71 l.20) : la séquence
      // continue dans CETTE exécution.
      if (!resoudreFlowTest(node.test, { cc, sujet: hero }).joue) return undefined;
      const after = reste();
      // Le BUVEUR encaisse seul ce que le produit lui fait (LDB 12 l.197) — défaut de la VOIE,
      // tri-état : la donnée le rouvre là où le Test n'est pas une résistance (`noSupport:false`,
      // Nécessaire antipoison : Test de Guérison).
      // Enjeu DÉRIVÉ du PRODUIT bu quand la donnée n'en déclare pas (#1262 V2 L6d) : « ce qui se joue »
      // EST le consommable, et sa fiche Codex porte déjà sa règle verbatim.
      const ft = { ...withDerivedStake(node.test, source), noSupport: node.test.noSupport ?? true };
      // Modale RESTREINTE au buveur ; impossible (mort) → continuation directe.
      if (!openSkillTest(get, set, ft, cc, node.reussite, node.echec, after, { actorId: hero.id })) jouerFlowEntier(runFlow(get, set, after, label));
      return fini;
    },
    choix: (node) => node.non,
    fin: () => undefined,
  });
}

/** Les ops que le Flow d'un consommable pose à son buveur quand tout réussit (Tests réussis, toutes les
 *  branches `si` et `choix`), ou `null` si une feuille n'est pas une op : son effet ne se lit pas en ops. */
function opsDeReussiteDuFlow(f: Flow): GameOp[] | null {
  const de = (fs: (Flow | undefined)[]): GameOp[] | null => {
    const parts = fs.filter((x): x is Flow => !!x).map(opsDeReussiteDuFlow);
    return parts.some((p) => p == null) ? null : parts.flatMap((p) => p!);
  };
  switch (f.kind) {
    case 'effet': return f.effet.type === 'ops' ? f.effet.ops : null;
    case 'sequence': return de(f.etapes);
    case 'si': return de([f.alors, f.sinon]);
    case 'test': return de([f.reussite]);
    case 'choix': return de([f.oui, f.non]);
  }
}

/** Refus de consommer `item` quand son effet réussi n'aurait rien à changer à `hero` (`reussiteSansObjet`,
 *  jugée avant le Test au boire) : l'objet n'est pas perdu pour rien. Verdict UNIQUE d'`utiliserLObjet`, avant toute
 *  consommation. */
export function refusDeConsommer(hero: Combatant, item: ItemInstance): string | null {
  const flow = consommableDe(item);
  const ops = flow ? opsDeReussiteDuFlow(flow) : null;
  const source: EffectSource | undefined = item.trappingId ? { kind: 'objet', id: item.trappingId } : undefined;
  const raison = ops ? reussiteSansObjet(hero, ops, { avantLeJet: true, ...(source ? { source } : {}) }) : null;
  return raison ? t('cs.consommableSansObjet', { raison, item: item.label }) : null;
}

/** Exécute le Flow d'un consommable sur son buveur (durée résolue + bake, puis la voie du contexte). */
export function runConsumable(get: Get, set: SetFn, hero: Combatant, item: ItemInstance): void {
  const flow = consommableDe(item);
  if (!flow) return;
  const now = get().gameTime;
  const untilTime = consumableUntilTime(item, now, hero, battleRng());
  const baked = bakeConsumableFlow(flow, hero.id, untilTime, item.label);
  const inBattle = !!get().battle && get().battle!.combatants.some((c) => c.id === hero.id);
  // ENTITÉ PORTEUSE du Flow : la POSSESSION bue (id de catalogue). Un objet CUSTOM (hors catalogue)
  // n'en a pas — il n'a pas de fiche où renvoyer, la dérivation d'enjeu se tait alors (#1262 V2 L6d).
  const source: EffectSource | undefined = item.trappingId ? { kind: 'objet', id: item.trappingId } : undefined;
  if (inBattle) {
    runCombatFlow({
      get, set, target: hero, caster: hero, label: item.label,
      opsCtx: { now, ...(untilTime != null ? { defaultUntilTime: untilTime } : {}), label: item.label, ...(source ? { source } : {}) },
    }, baked);
  } else {
    runSceneConsumableFlow(get, set, hero, baked, item.label, source);
  }
}


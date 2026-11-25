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
import { consommableDe, consumableUntilTime, bakeConsumableFlow, doseDejaPrise, prendreLaDose, type PeriodeDeDose } from '../engine/consumables';
import { ficheDObjetPorte } from '../engine/items';
import type { Effect, Flow } from '../data/schemas/defs-scenes/effets';
import { evalCondition, executerFlow, type ArretDeFlow, type ConditionCtx } from '../engine/flowCore';
import { resoudreFlowTest } from '../engine/decisionDuTest';
import { conditionCtxDe, type EtatDesConditions } from './bourseFlow';
import { objetDuNarratif } from './monde/resolveursDuNarratif';
import { buildActorView } from '../engine/actorView';
import { runCombatFlow, withDerivedStake } from './combat/triggeredTest';
import { openSkillTest, runFlow, applyLeafOps, confierLaSuite, ouvrirEtConfier, jouerFlowEntier, MAIN_RENDUE } from './combatEffects';
import { touchActors } from './combatOrParty';
import { battleRng } from './battleRng';
import type { Get, Set as SetFn } from './flowTypes';
import { t } from '../i18n';
import { reussiteSansObjet, type GameOp } from '../engine/ops';
import { nomDe } from '../engine/nom';
import { dayIndex } from '../engine/clock';
import type { Jeu } from './etat';

/** ConditionCtx de SCÈNE augmenté du BUVEUR comme acteur (`target` ET `caster`) — les Conditions
 *  d'acteur (`has group elfe` de la Fleur de lune, `compare woundsCurrent` de la Potion de guérison)
 *  s'évaluent sur LUI, les Conditions de scène (flags/horloge/bourse) restent celles du monde. */
function drinkerCtx(s: EtatDesConditions, hero: Combatant): ConditionCtx {
  const view = buildActorView(hero);
  return { ...conditionCtxDe(s), target: view, caster: view };
}

/** Hôte de SCÈNE (`executerFlow`) du Flow baké d'un consommable — comme `runFlow`, mais : feuilles appliquées au
 *  BUVEUR via `applyLeafOps` (durée bakée + `delayed` programmées), `si` évalués avec sa vue d'acteur,
 *  `test` gaté (`exceptGroups` du Bonnet de fou…) puis ouvert RESTREINT à lui (`actorId`). Un nœud
 *  `choix` (aucun consommable n'en porte) prend sa branche `non` — défaut conservateur, pas de décision
 *  silencieuse. Les branches d'un `test` ouvert sont reprises par `jetValider('test')`→`runFlow` : leurs
 *  feuilles BAKÉES (`on:'hero'` + untilTime) y retombent sur le handler `ops` (applyLeafOps). */
function runSceneConsumableFlow(get: Get, set: SetFn, hero: Combatant, flow: Flow, label: string, source?: EffectSource): void {
  const fini: ArretDeFlow<void> = { arret: undefined };
  executerFlow<Effect, void>(flow, {
    conditions: () => drinkerCtx(get(), hero),
    feuille: (node, reste) => {
      if (node.effet.type !== 'ops') return undefined;
      const lines = applyLeafOps(get, set, hero, node.effet, { idNeuf: get().forgerUnId,
        rng: battleRng(),
        // PROVENANCE du produit bu : un poison qui enduit la lame (`augmentWeapon`) garde SON
        // identité sur les effets fondus dans l'arme (`stampSource`, engine/ops) — sans elle, le
        // Test qu'il exige nommerait l'ÉPÉE au lieu du poison (#1262 V2 L6d).
        ...(source ? { source } : {}),
      });
      // Feuille partie à la PORTE (#1508) : le reste de la pile est SA suite, exactement comme
      // pour un nœud `test` ci-dessous — sans quoi la fin du produit s'appliquerait par-dessus un
      // dé en vol. Reprise par `runFlow` : les feuilles bakées y retombent sur `ops`.
      if (lines === MAIN_RENDUE) {
        const steps = reste().etapes;
        if (steps.length) confierLaSuite(set, [{ verbe: 'reprendreFlow', flow: { kind: 'sequence', etapes: steps }, label }]);
        return fini;
      }
      set(touchActors(get()));
      for (const l of lines) get().ecrireAuJournal(l);
      return undefined;
    },
    test: (node, reste) => {
      const cc = drinkerCtx(get(), hero);
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
      // Modale RESTREINTE au buveur. Elle tient la main : le reste de la pile est sa suite ; impossible (mort) ou
      // résolue aussitôt → continuation directe.
      if (!ouvrirEtConfier(get, set, () => openSkillTest(get, set, ft, cc, node.reussite, node.echec, { actorId: hero.id }), after, label)) {
        jouerFlowEntier(runFlow(get, set, after, label));
      }
      return fini;
    },
    choix: (node) => node.non,
    fin: () => undefined,
  });
}

/** Les ops que le Flow d'un consommable pose à son buveur, chaque `si` jugé sur lui (`cc`) et chaque `choix` par ses
 *  deux branches : à la réussite de ses Tests (`issues: 'reussite'`), ou à l'une quelconque de leurs issues
 *  (`'toutes'`) ; `null` si une feuille atteinte n'est pas une op : son effet ne se lit pas en ops. */
function opsAtteintes(f: Flow, cc: ConditionCtx, issues: 'reussite' | 'toutes'): GameOp[] | null {
  const de = (fs: (Flow | undefined)[]): GameOp[] | null => {
    const parts = fs.filter((x): x is Flow => !!x).map((x) => opsAtteintes(x, cc, issues));
    return parts.some((p) => p == null) ? null : parts.flatMap((p) => p!);
  };
  switch (f.kind) {
    case 'effet': return f.effet.type === 'ops' ? f.effet.ops : null;
    case 'sequence': return de(f.etapes);
    case 'si': return de([evalCondition(f.condition, cc) ? f.alors : f.sinon]);
    case 'test': return de(issues === 'reussite' ? [f.reussite] : [f.reussite, f.echec]);
    case 'choix': return de([f.oui, f.non]);
  }
}

/** État que lit le verdict de consommation : les conditions du monde, l'horloge et la fiche courante de l'objet. */
type EtatDeConsommation = EtatDesConditions & Pick<Jeu, 'campaignNarratif'>;

/** Période de la Dose de `item` et jour de jeu qui la date, lus de sa fiche courante ; `null` sans Dose. */
function doseDe(s: EtatDeConsommation, item: ItemInstance): { trappingId: string; periode: PeriodeDeDose; jour: number } | null {
  const periode = ficheDObjetPorte(item, objetDuNarratif(s.campaignNarratif))?.dose;
  return periode && item.trappingId ? { trappingId: item.trappingId, periode, jour: dayIndex(s.gameTime) } : null;
}

/** Refus de consommer `item` quand `hero` en a déjà pris sa dose dans la période en cours (LDB 72 l.22-30), quand son
 *  Flow ne lui poserait rien (ses conditions jugées sur lui), ou quand son effet réussi n'aurait rien à lui changer
 *  (`reussiteSansObjet`, jugée avant le Test au boire) : l'objet n'est pas perdu pour rien. Verdict UNIQUE
 *  d'`utiliserLObjet`, avant toute consommation. LDB 72 l.24 */
export function refusDeConsommer(s: EtatDeConsommation, hero: Combatant, item: ItemInstance, flow: Flow): string | null {
  const dose = doseDe(s, item);
  if (dose && doseDejaPrise(hero, dose.trappingId, dose.periode, dose.jour)) return t(`cs.doseDejaPrise.${dose.periode}`, { name: nomDe(hero), item: item.label });
  const cc = drinkerCtx(s, hero);
  if (opsAtteintes(flow, cc, 'toutes')?.length === 0) return t('cs.consommableSansEffet', { name: nomDe(hero), item: item.label });
  const ops = opsAtteintes(flow, cc, 'reussite');
  const source: EffectSource | undefined = item.trappingId ? { kind: 'objet', id: item.trappingId } : undefined;
  const raison = ops ? reussiteSansObjet(hero, ops, { avantLeJet: true, ...(source ? { source } : {}) }) : null;
  return raison ? t('cs.consommableSansObjet', { raison, item: item.label }) : null;
}

/** Consigne sur `hero` la dose de `item` qu'il prend, quand sa fiche en porte une. LDB 72 l.22-30 */
export function consignerLaDose(s: EtatDeConsommation, hero: Combatant, item: ItemInstance): void {
  const dose = doseDe(s, item);
  if (dose) prendreLaDose(hero, dose.trappingId, dose.periode, dose.jour);
}

/** Exécute le Flow d'un consommable sur son buveur (durée résolue + bake, puis la voie du contexte). */
export function runConsumable(
  get: Get, set: SetFn, hero: Combatant, item: ItemInstance,
  flow = consommableDe(item, objetDuNarratif(get().campaignNarratif)),
): void {
  if (!flow) return;
  const now = get().gameTime;
  const untilTime = consumableUntilTime(item, now, hero, battleRng());
  const baked = bakeConsumableFlow(flow, hero.id, untilTime, item.label);
  const inBattle = !!get().battle && get().battle!.combatants.some((c) => c.id === hero.id);
  // #1262 V2 L6d ; #2967
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


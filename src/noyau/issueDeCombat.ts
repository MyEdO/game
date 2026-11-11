/** Issue d'un combat : victoire, défaite, butin, vol de cargaison (#327). */
import { applyEffects, confierLaSuite, cloturer, jouerFlowEntier, attribuerLaLigne, harvestVictoryCreature } from './combatEffects';
import * as massBattleFlow from './massBattleFlow';
import { resumeSuspendedCascade } from './cascade';
import { applyLandCargoRaid } from './carriers';
import { t } from '../i18n';
import { flowFromEffects } from './monde/flow';
import type { Get, Set } from './flowTypes';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import type { CorpsDesChoix } from './choixDesFenetres';
import type { FragmentDeTables } from './tablesPosees';

export function creerActionsDIssueDeCombat(get: Get, set: Set) {
  return {
    denouerLeVol: (outcome) => {
      if (!get().cargoRaid) return;
      const { patch, pct, losses } = applyLandCargoRaid(get(), outcome);
      const total = losses.reduce((n, l) => n + l.removed, 0);
      set({ ...patch, cargoRaid: false });
      if (total > 0) {
        // Consequence structurée (#295) — issue en donnée + total, jamais un jet silencieux.
        get().ecrireAuJournal(t('store.cargoRaid', { issue: t(outcome === 'fuite' ? 'store.cargoRaidFled' : 'store.cargoRaidBroken'), enc: total, pct, porteurs: losses.length > 1 ? t('store.fragCargoPorters', { n: losses.length }) : '' }));
      } else if (outcome !== 'victoire' && pct > 0) {
        get().ecrireAuJournal(t('store.cargoRaidNothing'));
      }
    },
  } satisfies FabriqueDuNoyau;
}

/** Les choix des fenêtres de butin (`CorpsDesChoix`) : la ligne que prend le héros de la rangée (`attribuerLaLigne`), la
 *  créature que le groupe dépèce (`harvestVictoryCreature`). */
export function choixDuButin(get: Get, set: Set) {
  return {
    butin: { ligne: (uid, heroId) => attribuerLaLigne(get, set, 'pendingLoot', uid, heroId) },
    victoire: { ligne: (uid, heroId) => attribuerLaLigne(get, set, 'pendingVictory', uid, heroId), depecer: (creatureId) => harvestVictoryCreature(get, set, creatureId) },
  } satisfies Partial<CorpsDesChoix>;
}

/** Les sorties des fenêtres de fin de combat : la victoire, la défaite, le butin. */
export function sortiesDIssueDeCombat(get: Get, set: Set) {
  return {
    /** Ferme l'écran de victoire, au quorum (`sortie: 'quorum'`), et revient à l'exploration. */
    victoire: () => {
      get().denouerLeVol('victoire'); // combat gagné = le convoi est sauf (0 %), le flag s'éteint (#327)
      const pv = get().pendingVictory;
      const leftoverGear = (pv?.gear ?? []).map((g) => g.effect); // équipement non attribué → 1er héros par défaut
      const cont = pv?.onContinue;
      // Scène de COMBAT d'une bataille de masse (ADE II 08) : la victoire tactique nourrit la réduction
      // de Puissance ennemie (l.139 : ennemis neutralisés), puis on reprend la vue de bataille.
      const kills = (pv?.defeated ?? []).reduce((n, d) => n + d.count, 0);
      const inMassBattleCombat = !!get().massBattle?.combatScene;
      set({ pendingVictory: null, battle: null, mode: 'exploration' });
      // DEUX lots à la suite : si le premier ouvre un dé à la porte (#1508), le second est SA suite et
      // ne doit pas passer devant — il part alors dans la continuation de l'étape ouverte, et le teardown
      // de combat (couture UNIVERSELLE, noyau/cascade.ts) est la CLÔTURE qui les suit tous les deux.
      let issue = leftoverGear.length ? applyEffects(get, set, leftoverGear) : undefined;
      if (cont?.length) {
        // #9 : téléport/dialogue de onVictory APRÈS « Continuer ». Si le butin a différé, ce lot-ci est SA
        // suite — confié en APPEND derrière le reste du butin (`confierLaSuite`).
        if (issue) confierLaSuite(set, [{ verbe: 'reprendreFlow', flow: flowFromEffects(cont) }]);
        else issue = applyEffects(get, set, cont);
      }
      cloturer(get, set, issue, [{ verbe: 'teardownDeVictoire', kills, batailleDeMasse: inMassBattleCombat }]);
    },
    /** Ferme l'écran de l'ANÉANTISSEMENT hors combat (`checkPartyWiped`) : pas de bataille à reprendre, retour au menu. */
    aneantissement: () => {
      get().denouerLeVol('defaite'); // le convoi est pillé (vol-terrestre-defaite-pct, #327)
      set({ partyWiped: false, battle: null, screen: 'menu' });
    },
    /** Ferme l'écran du REPLI : dans une Scène de COMBAT de bataille de masse (ADE II 08), la défaite tactique ne met
     *  PAS fin à la partie : les héros sont repoussés (soignés, le combat de scène est une abstraction), l'issue
     *  `combatLost` alimente le camp allié (Duel l.223 : −20 ; Percée l.175 : Charge), et la bataille CONTINUE. */
    repli: () => {
      get().denouerLeVol('defaite'); // combat perdu = le convoi est pillé (vol-terrestre-defaite-pct, #327)
      const heal = (c: import('../engine/types').Combatant): import('../engine/types').Combatant => ({
        ...c, wounds: { ...c.wounds, current: c.wounds.max }, conditions: [], criticalWounds: 0, dead: false, outOfRencontre: false,
      });
      set({ party: get().party.map(heal), battle: null, mode: 'exploration' });
      massBattleFlow.massBattleResumeCombat(get, set, 0, 'defaite');
      resumeSuspendedCascade(get, set); // teardown de combat (couture universelle), comme la victoire
    },
    /** Ferme l'écran de DÉFAITE hors bataille de masse : reprise standard (retour à la scène / redémarrage). */
    defaite: () => {
      get().denouerLeVol('defaite'); // combat perdu = le convoi est pillé (vol-terrestre-defaite-pct, #327)
      if (get().scene) set({ mode: 'exploration', battle: null });
      resumeSuspendedCascade(get, set); // teardown de combat (couture universelle), comme la victoire
    },
    /** Ferme la fenêtre de loot — même contrat que la victoire : le non-attribué va au 1er héros. */
    butin: () => {
      const pl = get().pendingLoot;
      const leftover = (pl?.gear ?? []).map((g) => g.effect);
      set({ pendingLoot: null });
      if (leftover.length) jouerFlowEntier(applyEffects(get, set, leftover));
    },
  } satisfies Partial<SortiesDeFenetre>;
}

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  clotures: {
    teardownDeVictoire: (get, set, c) => {
      if (c.batailleDeMasse) massBattleFlow.massBattleResumeCombat(get, set, c.kills);
      // Teardown de combat (couture UNIVERSELLE, noyau/cascade.ts) : résume la cascade SUSPENDUE (ex. le
      // reste d'une journée de voyage interrompue par un abordage) — APRÈS l'écran de victoire, jamais devant.
      resumeSuspendedCascade(get, set);
    },
  },
} satisfies FragmentDeTables;

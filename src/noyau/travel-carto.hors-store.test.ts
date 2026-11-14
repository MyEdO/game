/**
 * Voyage — poste « Établir des cartes » (EDOC 8 l.161) : Test ÉTENDU inter-Étapes, désormais UNE RANGÉE
 * du pas BATCH des postes du jour (arbitrage user 2026-07-11). Gardes de non-régression :
 *  - le libellé de la rangée = la Compétence RÉELLEMENT utilisée, LABEL résolu AVEC sa spec
 *    (« Métier (Cartographe) »), jamais l'id brut (`metier`) ni `def.skills[0]` sans spec ;
 *  - la RANGÉE porte le contexte de test étendu (extendedDrDone/extendedDrTarget) → barre de DR
 *    ATTACHÉE à SA rangée, persistante après validation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { buildStageSteps } from './travelPostes';
import { applierDe } from './cascade';
import type { Combatant } from '../engine/types';
import type { BatchParticipant } from './pendings';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const cartoHero = (): Combatant =>
  (blessuresSurLeProfil({
    id: 'h', label: 'Hilda', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 40, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4,
    skills: [{ id: 'metier', spec: 'cartographe', characteristic: 'dexterite', advances: 20 }],
  }) as Combatant);

describe('Voyage — poste Cartographie (Établir des cartes, test étendu)', () => {
  beforeEach(() => {
    banc.setState({
      party: [cartoHero()],
      travelPlan: { routeId: 'r', km: 24, postes: { h: { activityId: 'etablir-cartes' } }, extendedProgress: 1 } as never,
    });
  });

  /** La rangée-participant du cartographe dans le pas BATCH des postes. */
  const cartoPart = (): BatchParticipant => {
    const steps = buildStageSteps(banc.getState, banc.setState, 'beau', 'ete');
    const batch = steps.find((s) => s.kind === 'etapePosteEnBande')!;
    return batch.participants!.find((p) => p.id === 'h')!;
  };

  it('label de rangée = compétence RÉSOLUE avec spec (« Métier (Cartographe) »), jamais l’id', () => {
    expect(cartoPart().label).toBe('Métier (Cartographe)');
  });

  it('la RANGÉE porte le contexte de test étendu (extendedDrDone/extendedDrTarget) pour la barre de DR', () => {
    const part = cartoPart();
    expect(typeof part.extendedDrTarget).toBe('number');
    expect(part.extendedDrTarget as number).toBeGreaterThan(0);
    expect(part.extendedDrDone).toBe(1); // = extendedProgress AVANT ce jet
  });

  // PERSISTANCE post-validation : l'application du batch ne DÉTRUIT pas la donnée de barre de la rangée
  // (elle reste sur le participant → rangées témoins/bilan la re-rendent), et pose la conséquence SUR la rangée.
  it('après application du batch, la rangée cartographie GARDE sa donnée de DR étendu + porte sa conséquence', () => {
    const steps = buildStageSteps(banc.getState, banc.setState, 'beau', 'ete');
    const batch = steps.find((s) => s.kind === 'etapePosteEnBande')!;
    const part = batch.participants!.find((p) => p.id === 'h')!;
    part.result = { roll: 30, target: part.target, sl: 2, success: true }; // jet réussi (DR 2)
    applierDe('etapePosteEnBande')!(banc.getState, banc.setState, batch, undefined, { steps: [batch], index: 0 });
    expect(part.extendedDrTarget as number).toBeGreaterThan(0); // donnée de barre TOUJOURS présente
    expect(Array.isArray(part.outcome)).toBe(true); // conséquence rendue sur SA rangée
  });

  // F1 (recette 2026-07-11) : un Test étendu SE TERMINE à la cible (LDB 12 l.170-186). Une fois la carte
  // ACHEVÉE, le poste NE re-roule plus (affichage « achevée », zéro accumulation) et la progression est
  // FIGÉE à la cible — plus de reset qui recommencerait le Test chaque jour et déborderait « 5/2 »/« 6/2 ».
  it('#F1 : carte ACHEVÉE → progression figée à la cible, poste sans jet à l’Étape suivante', () => {
    const steps = buildStageSteps(banc.getState, banc.setState, 'beau', 'ete');
    const batch = steps.find((s) => s.kind === 'etapePosteEnBande')!;
    const part = batch.participants!.find((p) => p.id === 'h')!;
    const drTarget = part.extendedDrTarget as number;
    // Jet de complétion à GROS DR (dépasse la cible restante) : la carte s'achève ce jour.
    part.result = { roll: 10, target: part.target, sl: drTarget + 3, success: true };
    applierDe('etapePosteEnBande')!(banc.getState, banc.setState, batch, undefined, { steps: [batch], index: 0 });
    const agg = steps.find((s) => s.kind === 'etapeBilan')!;
    applierDe('etapeBilan')!(banc.getState, banc.setState, agg, undefined, { steps, index: steps.indexOf(agg) });
    // FIGÉ à la cible (jamais `undefined` → jamais un redémarrage du Test étendu le lendemain).
    expect(banc.getState().travelPlan!.extendedProgress).toBe(drTarget);
    // Étape SUIVANTE : plus de rangée de jet cartographie — un pas d'affichage « déjà achevée ».
    const next = buildStageSteps(banc.getState, banc.setState, 'beau', 'ete');
    const nextBatch = next.find((s) => s.kind === 'etapePosteEnBande');
    expect(nextBatch?.participants?.some((p) => p.id === 'h') ?? false).toBe(false);
    const done = next.find((s) => s.kind === 'etapePosteFini');
    expect(done?.outcome?.[0]?.text).toContain(`${drTarget}/${drTarget} DR`);
  });
});

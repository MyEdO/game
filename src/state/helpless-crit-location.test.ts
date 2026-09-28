import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { draineCascade } from './cascadeTestKit';
import { doAttack } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

/**
 * #124 — Cible Inconsciente (LDB 16 l.113) : l'attaquant gagne « Je ne faillirai pas ! » SANS
 * dépenser de Résilience. LDB 17 l.68 : « Si vous infligez un Coup Critique, vous pouvez choisir
 * la Localisation atteinte, plutôt que de la laisser au hasard. » `helplessTest` (combat.ts) force
 * déjà succès+Critique ; il ne restait qu'à débloquer le picker de Localisation EXISTANT
 * (`attackSetCritLocation`, gated par `pendingAttack.forced`) pour l'attaquant qui PILOTE. L'IA
 * (`doAttack`) ne passe jamais par `pendingAttack` : aucun choix, tirage inchangé.
 */
describe('#124 — cible Inconsciente : choix de Localisation (RAW-2 gratuit, LDB 17 l.68)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingAttack: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // adjacent → frappe directe, pas de charge/approche
    E.wounds = { current: 30, max: 30 } as never;
    E.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, movementUsed: 0, movedPreAction: false, acted: false } });
    return { H, E };
  }

  it("attaquant PILOTÉ (joueur) contre une cible Inconsciente : le picker de Localisation existant devient utilisable, et la loc CHOISIE est celle réellement appliquée", () => {
    const { E } = setup();
    E.conditions = [{ id: 'inconscient', value: 1 }];
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    // Débloqué DÈS la déclaration (avant tout jet) : même mécanisme que la Résilience (`pa.forced`),
    // mais gratuit — cf. LDB 16 l.113 « sans avoir à dépenser un Point de Résilience ».
    expect(useGame.getState().pendingAttack?.forced).toBe(true);
    useGame.getState().attackRoll();
    const pa = useGame.getState().pendingAttack!;
    expect(pa.result?.critical).toBe(true); // helplessTest (combat.ts) : Critique déjà forcé (inchangé par #124)
    // AVANT #124, `attackSetCritLocation` était bloqué par le garde `!pa.forced` (combatSlice.ts) :
    // la Localisation restait un tirage au hasard malgré le Critique forcé.
    useGame.getState().attackSetCritLocation('jambeG');
    expect(useGame.getState().pendingAttack!.result!.critLocation).toBe('jambeG');
    const resRef = useGame.getState().pendingAttack!.result!; // même objet, muté en place par applyAttackResult
    useGame.getState().attackConfirm();
    expect(resRef.location).toBe('jambeG'); // la Localisation CHOISIE est celle réellement résolue, pas un re-tirage
  });

  it("l'IA (doAttack) contre une cible Inconsciente : aucun pendingAttack, aucun choix — le tirage RAW par défaut s'applique", () => {
    const { H, E } = setup();
    H.conditions = [{ id: 'inconscient', value: 1 }];
    // PA à 0 partout : évite d'entrer dans la Déviation Critique (LDB 63 l.30, feature DISTINCTE de #124)
    // qui suspendrait aussi — on isole ici le comportement du picker de Localisation.
    H.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    const before = H.wounds.current;
    doAttack(useGame.getState, useGame.setState, E, H);
    expect(useGame.getState().pendingAttack).toBeNull(); // l'IA ne passe jamais par le picker joueur
    // La seule fenêtre ouverte est celle de la Blessure critique (sévérité, #1426) — feature DISTINCTE
    // du picker de Localisation : on la joue, et le coup s'applique.
    draineCascade(useGame.getState);
    const hh = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(hh.wounds.current).toBeLessThan(before); // le coup s'applique quand même (succès+Critique forcés)
  });
});

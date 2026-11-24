import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { scenario } from '../scenes/test-scenarios/entrainement';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { setCadence } from '../engine/cadence';
import { runEnemyAI } from './combatFlow';
import { mountableNear } from './mount';
import { placeCombatant } from './monde/spawn';
import type { Combatant } from '../engine/types';

/**
 * #4804 C2 : le groupe choisit sa monture hors combat (`choisitSaMontureHorsCombat`) ; en cadence auto, le tour d'un
 * héros du groupe ne l'enfourche pas, quand un PNJ allié authoré monte toujours la monture libre (LDB 14).
 * Scène réelle d'`entrainement` : son Cheval allié libre (`enc-entrainement`).
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Le combat d'entraînement ouvert, le premier Gobelin authoré allié IA si `allie`, réduit au cavalier essayé, au
 *  Cheval et à un mannequin lointain ; le cavalier posé au contact du Cheval et au tour. */
function auContactDuCheval(rider: 'heros' | 'allie'): { cavalier: Combatant; cheval: Combatant } {
  const contenu = scenario.construire(idsDeTest);
  const enc = contenu.scene.encounters!.find((e) => e.id === 'enc-entrainement')!;
  const gobelin = enc.members!.find((m) => contenu.scene.entities.find((x) => x.id === m.entityId)?.creature?.id === 'gobelin')!;
  if (rider === 'allie') Object.assign(gobelin, { side: 'allie', ai: true });
  banc.setState({ screen: 'campaign', party: contenu.party });
  banc.getState().lancerLaScene(contenu.scene);
  banc.getState().lancerLeCombat('enc-entrainement');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = banc.getState().battle!;
  const cheval = b.combatants.find((c) => c.mountable)!;
  const cavalier = rider === 'heros'
    ? b.combatants.find((c) => c.id === contenu.party[0].id)!
    : b.combatants.find((c) => c.aiControlled && c.kind === 'heros' && !contenu.party.some((h) => h.id === c.id))!;
  const cible = b.combatants.filter((c) => c.kind === 'ennemi').sort((x, y) => (y.pos?.x ?? 0) - (x.pos?.x ?? 0))[0];
  for (const c of b.combatants) if (c !== cheval && c !== cavalier && c !== cible) c.dead = true;
  placeCombatant(cavalier, banc.getState().scene, { x: cheval.pos!.x + 1, y: cheval.pos!.y });
  banc.setState({ battle: { ...b, acted: false, movementUsed: 0, turn: b.order.indexOf(cavalier.id), action: null } });
  expect(mountableNear(banc.getState(), banc.getState().battle!, banc.getState().scene, cavalier)?.id, 'prémisse : le Cheval libre au contact').toBe(cheval.id);
  return { cavalier, cheval };
}

describe('#4804 C2 — en combat, seul un PNJ allié authoré enfourche une monture libre', () => {
  it('cadence auto : le tour d’un héros du groupe au contact du Cheval libre ne l’enfourche pas', () => {
    setCadence('auto');
    const { cavalier } = auContactDuCheval('heros');
    runEnemyAI(banc.getState, banc.setState, cavalier.id);
    banc.abandonner();
    expect(cavalier.mountId).toBeUndefined();
  });

  it('un PNJ allié authoré (`side: allie`, ni du groupe ni possession) enfourche le Cheval libre', () => {
    const { cavalier, cheval } = auContactDuCheval('allie');
    runEnemyAI(banc.getState, banc.setState, cavalier.id);
    banc.abandonner();
    expect(cavalier.mountId).toBe(cheval.id);
  });
});

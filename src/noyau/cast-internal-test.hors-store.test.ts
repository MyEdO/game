import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { openCastCascade } from './combatFlow'; // effet de bord : installe l'applier `testDeclenche` + le routeur de Test
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import { findSpellById } from '../data';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Lot 4b — un Sort dont le Flow d'effet porte un nœud `test` INTERNE (Chute : « la cible teste sa
 * Dextérité ou laisse tomber l'objet ») est résolu CADENCE-AWARE par `resolveFlowTest`, EN CONTEXTE
 * D'INCANTATION (cast cascade ouverte par `openCastCascade`, comme un vrai `castSpell`) :
 *  - la VICTIME est un HÉROS manuel → le test SUSPEND en APPENDANT une étape `testDeclenche` à la
 *    MÊME cascade `cast` active (une seule cascade enrichie, influençable — Chance/Pacte/Résilience) ;
 *  - la VICTIME est un ENNEMI → jet INLINE + branche honorée + ligne de parité dans le journal de
 *    combat (jamais de jet silencieux), branchée sur la DONNÉE (`spells.json` : op `test` → nœud
 *    Flow `test`).
 */
describe('Lot 4b — Sort à Test interne (Chute) cadence-aware en contexte d’incantation', () => {
  /** Groupe : un sorcier (lanceur) + un second héros (cible « manuelle » du Test). Combat sur la scène
   *  de test (rencontre `enc-mutants`) → un ennemi disponible comme cible « inline ». */
  function setup() {
    const wiz = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, seed: 707 });
    wiz.spells = ['chute', ...(wiz.spells ?? [])];
    const ally = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 13 });
    banc.setState({ party: [wiz, ally] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    const b = banc.getState().battle!;
    const W = b.combatants.find((c) => c.kind === 'heros' && c.label === 'W')!;
    const A = b.combatants.find((c) => c.kind === 'heros' && c.label === 'A')!;
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    W.pos = { x: 10, y: 10 }; A.pos = { x: 11, y: 10 }; E.pos = { x: 12, y: 10 };
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { W, A, E };
  }

  /** Reproduit `castSpell` de façon DÉTERMINISTE, dans SON ordre : pose le `pendingCast` au résultat
   *  figé, puis ouvre la cascade `cast` qui l'hôte (étape `jet:'incantation'` au curseur 0), prêt à `jetValider('incantation')`. */
  function frozenCast(W: Combatant, target: Combatant) {
    banc.setState({
      pendingCast: {
        casterId: W.id, targetId: target.id, spellId: 'chute', missile: false, focused: false,
        result: { cast: true, roll: 22, target: 60, sl: 2, isCritical: false, isFumble: false, log: 'ok' },
      },
    });
    openCastCascade(banc.getState, banc.setState, W);
  }

  it('la DONNÉE convertie est bien un nœud Flow `test` (plus d’op `test`)', () => {
    const flow = findSpellById('chute')!.effects!;
    expect(flow.kind).toBe('sequence');
    const step = flow.kind === 'sequence' ? flow.etapes[0] : flow; // seq → 1ʳᵉ étape
    expect(step.kind).toBe('test');
    if (step.kind !== 'test') throw new Error('attendu : nœud Flow `test`');
    expect(step.test.characteristic).toBe('dexterite');
    expect(step.reussite.kind).toBe('sequence'); // réussite = rien (l'objet tient)
    expect(step.echec.kind).toBe('effet');     // échec = la branche narrative (« l'objet tombe »)
  });

  it('VICTIME héros manuel → étape `testDeclenche` APPENDUE à la cascade `cast` (une seule cascade, influençable)', () => {
    seedBattleRng(5);
    const { W, A } = setup();
    frozenCast(W, A);
    const casc0 = banc.getState().pendingCascade!;
    expect(casc0.participants).toHaveLength(1);
    expect(casc0.participants[0].jet).toBe('incantation'); // l'étape d'incantation, curseur dessus

    banc.getState().jetValider('incantation'); // applique le Sort : le nœud `test` interne suspend

    const enriched = banc.getState().pendingCascade!;
    expect(enriched.purpose).toBe('combat');
    expect(enriched.participants).toHaveLength(2);            // étape `cast` + `testDeclenche` APPENDUE (MÊME cascade)
    expect(enriched.participants[0].jet).toBe('incantation');
    const step = enriched.participants[1];
    expect(step.kind).toBe('testDeclenche');
    expect(step.actorId).toBe(A.id);                         // c'est la VICTIME (héros) qui jette
    expect(step.result).toBeFalsy();                         // pas encore lancé → influençable (Chance/Pacte/Résilience)
    expect(step.meta?.onFail).toBeTruthy();                  // la branche échec voyage dans le meta (sérialisable, coop)
    expect(banc.getState().pendingCast).toBeNull();       // le JET d'incantation est clos (CastModal éteint)
  });

  it('VICTIME ennemi → jet INLINE + branche honorée + ligne de parité au journal (aucune cascade)', () => {
    seedBattleRng(5);
    const { W, E } = setup();
    E.characteristics.dexterite = 1; // Dextérité ~imbattable à RATER → la branche échec (narration « l'objet tombe ») s'applique
    frozenCast(W, E);

    banc.getState().jetValider('incantation');

    expect(banc.getState().pendingCascade).toBeNull();     // ennemi → jamais d'étape influençable
    const log = banc.getState().battle!.log.map((e) => e.text).join('\n');
    expect(log).toMatch(/Dextérité/);                         // ligne de parité du Test (traceLineOf) — aucun jet silencieux
    expect(log).toMatch(/l’objet tenu tombe/);                // la branche ÉCHEC (narration) a bien été jouée inline
  });
});

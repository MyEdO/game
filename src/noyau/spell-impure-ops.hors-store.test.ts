/**
 * Preuve de complétude des EFFETS « lourds » remontés de la spec engine vers le Flow ÉDITABLE
 * (`SpellData.effects`) sous forme d'ops génériques : `summon` / `zone` / `polymorph` / `lifeSteal`.
 * Deux niveaux :
 *  1. DONNÉE : chaque sort concerné porte bien l'op attendue dans son Flow (→ visible/éditable au
 *     Compendium ; aucun champ `SpellSpec.summon/polymorph/lifeSteal/persistentZone`).
 *  2. RÉSOLUTION au lancement : polymorph (métamorphose du lanceur) et lifeSteal (drain missile) sont
 *     appliqués depuis le Flow. L'invocation (`summon`) est couverte de bout en bout par
 *     `summon-flow.test.ts` ; on vérifie ici qu'elle vit dans le Flow.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, beforeEach, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyCast } from './combatFlow';
import { herosDeScenario, groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { findCreatureById, findSpellById } from '../data';
import { spellEffectOps } from '../engine/flowCore';
import type { GameOp } from '../engine/ops';
import { effectiveChar } from '../engine/characteristics';
import type { CastResult, MissileResult } from '../engine/magic';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const ok = (sl: number): CastResult => ({ cast: true, roll: 21, target: 70, sl, isCritical: false, isFumble: false, log: 'lancé' });

const opOf = <O extends GameOp['op']>(id: string, op: O) =>
  spellEffectOps(findSpellById(id)!.effects).find((o): o is Extract<GameOp, { op: O }> => o.op === op);

describe('effets « lourds » présents dans le Flow éditable (données app-owned)', () => {
  it('les 8 invocations portent une op `summon` dont `creature.id` résout une fiche du bestiaire', () => {
    const summons: [string, string][] = [
      ['reanimation', 'zombie'], ['relever-les-morts', 'squelette'], ['manifestation-de-demon-mineur', 'sanguinaire-de-khorne'],
      ['dechirer-l-aethyr', 'sanguinaire-de-khorne'], ['destrier-d-ombre', 'cheval'], ['menace-rampante', 'rat-geant'],
      ['hurlement-du-loup', 'loup'], ['roi-de-la-nature', 'loup'],
    ];
    for (const [id, creature] of summons) {
      const creatureId = opOf(id, 'summon')?.creature.id;
      expect(creatureId, id).toBe(creature);
      expect(findCreatureById(creatureId), `${id}: la référence résout une vraie créature`).toBeTruthy();
    }
  });

  it('les 5 sorts de zone portent une op `zone`, les 2 vols de vie une op `lifeSteal`, Forme bestiale une op `polymorph`', () => {
    for (const id of ['vol-du-destin', 'grands-feux-d-u-zhul', 'mur-de-feu', 'foret-d-epines', 'sang-de-la-terre']) {
      expect(opOf(id, 'zone'), id).toBeTruthy();
    }
    for (const id of ['caresse-de-laniph', 'vol-de-vie']) {
      expect(opOf(id, 'lifeSteal'), id).toBeTruthy();
    }
    // LDB 48 l.15-25 : la forme choisie ici est l’ours du Bestiaire.
    expect(opOf('forme-bestiale', 'polymorph')?.creature.id).toBe('ours');
  });
});

describe('résolution au lancement depuis le Flow', () => {
  it('Forme bestiale : la métamorphose (op polymorph) remplace les Caractéristiques du lanceur', () => {
    const w = herosDeScenario(idsDeTest, 'sorcier');
    banc.setState({ party: [w] as Combatant[] });
    const ours = findCreatureById('ours')!;
    expect(typeof ours.char.force).toBe('number');
    applyCast(banc.getState, banc.setState, w, [w], findSpellById('forme-bestiale')!, ok(2), false, false);
    const after = banc.getState().party.find((h) => h.id === w.id)!;
    // F/E/Ag/Dex atteignent la valeur de la créature (charMod différentiel auto-restitué à l'expiration).
    expect(effectiveChar(after, 'force')).toBe(ours.char.force);
    expect((after.activeEffects ?? []).some((e) => e.characteristic != null)).toBe(true);
  });

  it('Vol de vie : l’op lifeSteal (on:caster) draine une fraction des Blessures infligées', () => {
    const [w, cible] = groupeDeScenario(idsDeTest, 'sorcier', 'soldat');
    w.wounds.current = w.wounds.max - 5;
    cible.wounds.current = cible.wounds.max; // ≥ 3 PB encaissables
    banc.setState({ party: [w, cible] as Combatant[] });
    const before = w.wounds.current;
    const res: CastResult & Partial<MissileResult> = { ...ok(2), hit: true, location: 'corps', damage: 6, woundsLost: 3, defenderDefeated: false };
    applyCast(banc.getState, banc.setState, w, [cible], findSpellById('vol-de-vie')!, res, true, false);
    // Vol de vie = 1/2 arrondi au supérieur → ceil(3/2) = 2 PB drainés.
    expect(banc.getState().party.find((h) => h.id === w.id)!.wounds.current).toBe(before + 2);
  });
});

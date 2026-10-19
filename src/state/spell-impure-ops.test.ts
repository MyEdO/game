/**
 * Preuve de complétude des EFFETS « lourds » remontés de la spec engine vers le Flow ÉDITABLE
 * (`SpellData.effects`) sous forme d'ops génériques : `summon` / `zone` / `polymorph` / `lifeSteal`.
 * Deux niveaux :
 *  1. DONNÉE : chaque sort concerné porte bien l'op attendue dans son Flow (→ visible/éditable au
 *     Compendium ; plus aucun champ `SpellSpec.summon/polymorph/lifeSteal/persistentZone`).
 *  2. RÉSOLUTION au lancement : polymorph (métamorphose du lanceur) et lifeSteal (drain missile) sont
 *     appliqués depuis le Flow. L'invocation (`summon`) est couverte de bout en bout par
 *     `summon-flow.test.ts` ; on vérifie ici qu'elle vit dans le Flow.
 */
import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { applyCast } from './combatFlow';
import { pregen, pregenParty, PREGEN } from '../data/pregens';
import { findSpell, findCreatureById } from '../data';
import { spellEffectOps } from '../noyau/monde/flow';
import { effectiveChar } from '../engine/characteristics';
import type { CastResult, MissileResult } from '../engine/magic';
import type { Combatant } from '../engine/types';

const ok = (sl: number): CastResult => ({ cast: true, roll: 21, target: 70, sl, isCritical: false, isFumble: false, log: 'lancé' });

const opOf = (label: string, op: string) => spellEffectOps(findSpell(label)!.effects).find((o) => o.op === op);

describe('effets « lourds » présents dans le Flow éditable (données app-owned)', () => {
  it('les 8 invocations portent une op `summon` (ref bestiaire en id slug, résout par findCreatureById)', () => {
    // ref = id SLUG du bestiaire (résolu par `findCreatureById` au spawn) — PAS un libellé (qui dégénérait
    // en mannequin B:10, cf. data-wellformed.test). Le polymorph voisin utilise déjà le slug (`ours`).
    const summons: [string, string][] = [
      ['Réanimation', 'zombie'], ['Relever les morts', 'squelette'], ['Manifestation de Démon mineur', 'sanguinaire-de-khorne'],
      ["Déchirer l'Aethyr", 'sanguinaire-de-khorne'], ["Destrier d'Ombre", 'cheval'], ['Menace rampante', 'rat-geant'],
      ['Hurlement du loup', 'loup'], ['Roi de la Nature', 'loup'],
    ];
    for (const [label, ref] of summons) {
      const op = opOf(label, 'summon') as { ref?: string } | undefined;
      expect(op, label).toBeTruthy();
      expect(op!.ref, label).toBe(ref);
      expect(findCreatureById(op!.ref!), `${label}: la ref doit résoudre une vraie créature`).toBeTruthy();
    }
  });

  it('les 5 sorts de zone portent une op `zone`, les 2 vols de vie une op `lifeSteal`, Forme bestiale une op `polymorph`', () => {
    for (const label of ['Vol du Destin', "Grands feux d'U'Zhul", 'Mur de feu', "Forêt d'épines", 'Sang de la Terre']) {
      expect(opOf(label, 'zone'), label).toBeTruthy();
    }
    for (const label of ['Caresse de Laniph', 'Vol de vie']) {
      expect(opOf(label, 'lifeSteal'), label).toBeTruthy();
    }
    const poly = opOf('Forme bestiale', 'polymorph') as { ref?: string } | undefined;
    expect(poly?.ref).toBe('ours'); // ref créature en id (slug) depuis la migration
  });
});

describe('résolution au lancement depuis le Flow', () => {
  it('Forme bestiale : la métamorphose (op polymorph) remplace les Caractéristiques du lanceur', () => {
    const w = pregen(PREGEN.sorcier);
    useGame.setState({ party: [w] as Combatant[] });
    const ours = findCreatureById('ours')!;
    expect(typeof ours.char.force).toBe('number');
    applyCast(useGame.getState, useGame.setState, w, w, findSpell('Forme bestiale')!, ok(2), false, false);
    const after = useGame.getState().party.find((h) => h.id === w.id)!;
    // F/E/Ag/Dex atteignent la valeur de la créature (charMod différentiel auto-restitué à l'expiration).
    expect(effectiveChar(after, 'force')).toBe(ours.char.force);
    expect((after.activeEffects ?? []).some((e) => e.char != null)).toBe(true);
  });

  it('Vol de vie : l’op lifeSteal (on:caster) draine une fraction des Blessures infligées', () => {
    const [w, cible] = pregenParty(PREGEN.sorcier, PREGEN.soldat);
    w.wounds.current = w.wounds.max - 5;
    cible.wounds.current = cible.wounds.max; // ≥ 3 PB encaissables
    useGame.setState({ party: [w, cible] as Combatant[] });
    const before = w.wounds.current;
    const res: CastResult & Partial<MissileResult> = { ...ok(2), hit: true, location: 'corps', damage: 6, woundsLost: 3, defenderDefeated: false };
    applyCast(useGame.getState, useGame.setState, w, cible, findSpell('Vol de vie')!, res, true, false);
    // Vol de vie = 1/2 arrondi au supérieur → ceil(3/2) = 2 PB drainés.
    expect(useGame.getState().party.find((h) => h.id === w.id)!.wounds.current).toBe(before + 2);
  });
});

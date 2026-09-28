/**
 * Op `light` — DOUBLE NATURE (objet PASSIF gaté sur le port / sort temporisé), lue au MÊME point
 * (`combatantLights`, vision). Vérifie :
 *  (a) une lanterne PORTÉE (equipped) émet une LightSource ; RANGÉE/non portée → AUCUNE (gate RAW : on
 *      s'éclaire avec une lanterne en main, pas au fond du sac).
 *  (b) un `ActiveEffect.light` (posé par un sort) émet de la lumière par le même canal.
 *  (c) le sort `lumiere` porte une op `light` et l'appliquer pousse un `ActiveEffect.light`.
 *  (d) le rayon PORTÉ par la donnée est en MÈTRES (#1507) : ce sont les CASES rendues qui suivent
 *      l'échelle de la scène — la même bougie éclaire 5 cases à terre et 1 case en mer.
 */
import { describe, it, expect } from 'vitest';
import { combatantLights } from './vision';
import { spellEffectOps } from './flow';
import { itemFromTrappingById } from '../engine/items';
import { applyOps } from '../engine/ops';
import { findSpellById, findTrappingById } from '../data';
import { emptyScene, sceneMetresPerTile } from './scene';
import { builtinCampaigns, paquetDuJeu } from '../scenes/campaign';
import type { Combatant } from '../engine/types';

const pos = { x: 3, y: 3 };
/** Échelle TERRESTRE : celle d'une scène qui ne déclare rien — le défaut du monde (`LDB 15 l.12`). */
const MPT_TERRE = sceneMetresPerTile(emptyScene(1, 1));
/** Échelle MER, LUE sur une scène livrée : l'abordage de la cogue du Loup et Saumure (combat naval,
 *  MDG 13) — jamais un littéral d'épreuve. */
const MPT_MER = sceneMetresPerTile(
  paquetDuJeu(builtinCampaigns.find((c) => c.id === 'loup-et-saumure')!).scenes.find((s) => s.id === 'ls-abordage-cogue')!,
);
const target = (): Combatant => ({ id: 't', name: 'Cible', activeEffects: [] }) as unknown as Combatant;

describe('op light — OBJET passif gaté sur le port', () => {
  it('lanterne PORTÉE (equipped) → émet une LightSource (rayon du passive)', () => {
    const lant = itemFromTrappingById('lanterne')!;
    lant.equipped = true;
    const sources = combatantLights({ pos, items: [lant] }, MPT_TERRE);
    expect(sources).toHaveLength(1);
    expect(sources[0].radiusTiles).toBe(10); // 20 m de catalogue (LDB 74 l.58) à 2 m/case
    expect(sources[0].pos).toEqual(pos);
  });

  it('lanterne NON portée (rangée dans le sac) → AUCUNE lumière (gate)', () => {
    const lant = itemFromTrappingById('lanterne')!; // equipped:false par défaut, hors loadout
    expect(combatantLights({ pos, items: [lant] }, MPT_TERRE)).toEqual([]);
  });

  it('bougie PORTÉE éclaire moins (rayon 5) ; le MAX des émetteurs gagne', () => {
    const bougie = itemFromTrappingById('bougie')!; bougie.equipped = true;
    const lant = itemFromTrappingById('lanterne')!; lant.equipped = true;
    expect(combatantLights({ pos, items: [bougie] }, MPT_TERRE)[0].radiusTiles).toBe(5);
    expect(combatantLights({ pos, items: [bougie, lant] }, MPT_TERRE)[0].radiusTiles).toBe(10); // max
  });
});

describe('op light — SORT (ActiveEffect.light)', () => {
  it('un ActiveEffect.light émet de la lumière par le même canal', () => {
    const sources = combatantLights({ pos, activeEffects: [{ light: { radiusM: 16 } }] }, MPT_TERRE);
    expect(sources).toHaveLength(1);
    expect(sources[0].radiusTiles).toBe(8);
  });
});

/**
 * (d) UNITÉ DU RAYON (#1507) — la donnée porte les MÈTRES du canon, TELS QUE le folio les écrit
 * (Bougie « fournit un éclairage sur 10 mètres », `LDB 74 l.43` ; Lanterne 20 m, `LDB 74 l.58`), et
 * c'est la LECTURE qui les ramène aux cases de la scène. Avant ce lot la donnée portait des cases
 * pré-divisées par 2 : la même bougie éclairait 50 m sur une scène MER.
 */
describe('op light — le rayon est en MÈTRES dans la donnée, en cases à l’écran', () => {
  const rayonM = (id: string) => {
    const op = (findTrappingById(id)?.passive ?? []).find((o) => o.op === 'light') as { radiusM: number } | undefined;
    return op!.radiusM;
  };
  const portees = (id: string, mpt: number) => {
    const it = itemFromTrappingById(id)!;
    it.equipped = true;
    return combatantLights({ pos, items: [it] }, mpt)[0].radiusTiles;
  };

  it('la donnée écrit le folio TEL QUEL : bougie 10 m, lanterne 20 m', () => {
    expect([rayonM('bougie'), rayonM('lanterne')]).toEqual([10, 20]);
  });

  it('les CASES suivent l’échelle de la scène : 5 et 10 à terre, 1 et 2 en mer', () => {
    expect([MPT_TERRE, MPT_MER], 'les deux échelles mesurées sont bien distinctes').toEqual([2, 10]);
    expect([portees('bougie', MPT_TERRE), portees('lanterne', MPT_TERRE)]).toEqual([5, 10]);
    expect([portees('bougie', MPT_MER), portees('lanterne', MPT_MER)]).toEqual([1, 2]);
    // …et la PORTÉE MÉTRIQUE, elle, ne bouge pas d'une scène à l'autre : c'est tout l'invariant.
    for (const id of ['bougie', 'lanterne'])
      expect(portees(id, MPT_MER) * MPT_MER, id).toBe(portees(id, MPT_TERRE) * MPT_TERRE);
  });
});

describe('sort « lumiere » — parité d\'émission', () => {
  it('porte une op `light` (donnée du Flow éditable)', () => {
    const ops = spellEffectOps(findSpellById('lumiere')!.effects);
    const light = ops.find((o) => o.op === 'light') as { op: 'light'; radiusM: number } | undefined;
    expect(light, 'le sort Lumière doit porter une op light').toBeTruthy();
    expect(light!.radiusM).toBe(20); // cohérent avec une lanterne (LDB 74 l.58)
  });

  it('appliquer les ops du sort pousse un ActiveEffect.light (temporisé)', () => {
    const c = target();
    const ops = spellEffectOps(findSpellById('lumiere')!.effects);
    applyOps(c, ops, { label: 'Lumière' });
    const eff = (c.activeEffects ?? []).find((e) => e.light);
    expect(eff, 'un ActiveEffect.light doit être posé').toBeTruthy();
    expect(eff!.light!.radiusM).toBe(20);
    // ⇒ ce porteur éclaire ensuite via combatantLights (même point que la lanterne portée).
    expect(combatantLights({ pos, activeEffects: c.activeEffects }, MPT_TERRE)[0].radiusTiles).toBe(10);
  });
});

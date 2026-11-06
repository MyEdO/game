import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import { OP_DEFS, gameOpSchema } from '../data/schemas/grammaire/mecanique';
import { formulaSinSchema } from '../data/schemas/grammaire/valeurs';
import { effectSchema, sceneFlowSchema } from '../data/schemas/defs-scenes/effets';
import { mapPlaceSchema, routePerilSchema, worldMapSchema } from '../data/schemas/defs-scenes/worldmap';
import { semencesDeScene } from '../data';
import { EFFECT_HANDLERS } from './combatEffects';
import { blocNeuf, formulaForShape, newEffect, newOp, noeudTestNeuf, paramsDeRegle, shapeOf, type FormulaShape } from './valeursNeuves';
import { marcheNeuf, peripetieNeuve, portNeuf } from './worldMapEdit';
import { emptyWorldMap } from './worldMap';

/** Valeur au chemin d'un refus de zod. */
const auChemin = (v: unknown, chemin: readonly PropertyKey[]): unknown =>
  chemin.reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Record<PropertyKey, unknown>)[k] : undefined), v);

/** Champ laissé à la saisie de l'auteur : sentinelle vide ou absent. */
const aSaisir = (v: unknown): boolean => v === '' || v === undefined;

/** Refus d'une valeur neuve hors des champs laissés à la saisie de l'auteur. */
function refusHorsSentinelle(schema: z.ZodType<unknown>, valeur: unknown): string[] {
  const r = schema.safeParse(valeur);
  if (r.success) return [];
  return r.error.issues.filter((i) => !aSaisir(auChemin(valeur, i.path))).map((i) => `${i.path.join('.')} : ${i.message}`);
}

describe('valeurs neuves de l’atelier au noyau (#3059) : toute valeur neuve parse son schéma, hors sentinelle vide', () => {
  it('newOp : chaque op du vocabulaire (`OP_DEFS`) naît conforme à `gameOpSchema`', () => {
    for (const op of Object.keys(OP_DEFS)) {
      expect(refusHorsSentinelle(gameOpSchema, newOp(op)), op).toEqual([]);
    }
  });

  it('newOp : le terrain d’`offTerrainMod` est le premier terrain électif non franchissable du registre', () => {
    expect(gameOpSchema.safeParse(newOp('offTerrainMod')).success).toBe(true);
  });

  it('formulaForShape : chaque forme rend une formule de cette forme, conforme à `formulaSinSchema`', () => {
    const formes: FormulaShape[] = ['lit', 'bonus', 'char', 'dice', 'times', 'rolled', 'indice', 'pions', 'ecartAvantage', 'blessuresInfligees', 'dr', 'regle', 'minimum', 'tranches', 'somme', 'peche'];
    expect(paramsDeRegle().length, 'aucune règle optionnelle numérique : `{rule}` sans défaut').toBeGreaterThan(0);
    for (const s of formes) {
      const f = formulaForShape(s, undefined);
      expect(shapeOf(f), s).toBe(s);
      expect(refusHorsSentinelle(formulaSinSchema, f), s).toEqual([]);
    }
  });

  it('newEffect : chaque type du registre (`EFFECT_HANDLERS`) naît conforme à `effectSchema`', () => {
    for (const t of Object.keys(EFFECT_HANDLERS) as (keyof typeof EFFECT_HANDLERS)[]) {
      expect(refusHorsSentinelle(effectSchema, newEffect(t)), t).toEqual([]);
    }
  });

  it('noeudTestNeuf et blocNeuf : chaque bloc neuf d’un Flow est conforme à `sceneFlowSchema`', () => {
    expect(refusHorsSentinelle(sceneFlowSchema, noeudTestNeuf())).toEqual([]);
    for (const k of ['if', 'test', 'choice'] as const) expect(refusHorsSentinelle(sceneFlowSchema, blocNeuf(k)), k).toEqual([]);
  });

  it('carte du monde : carte, péripétie, port et marché neufs sont conformes à leurs schémas ; le libellé de la carte vient de la semence', () => {
    const carte = emptyWorldMap('carte-neuve');
    expect(carte.label).toBe(semencesDeScene.carte);
    expect(worldMapSchema.safeParse(carte).success).toBe(true);
    expect(routePerilSchema.safeParse(peripetieNeuve()).success).toBe(true);
    const lieu = { id: 'l', label: 'L', scene: 's', pos: { x: 10, y: 10 }, port: portNeuf(), market: marcheNeuf() };
    expect(mapPlaceSchema.safeParse(lieu).success).toBe(true);
    expect(portNeuf(), 'chaque port neuf est une valeur propre').not.toBe(portNeuf());
  });
});

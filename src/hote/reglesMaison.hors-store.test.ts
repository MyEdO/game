/**
 * LA PERSISTANCE DES RÈGLES MAISON sur le `Stockage` d'un hôte (#3041) : le jeu persisté se pose élagué (#1463 LD.1,
 * #2404), le stockage est réécrit élagué et le TÉMOIN des retraits écrit dans le même stockage, consommé une fois par
 * `prendreLeTemoinDesReglesMaison` ; une surcharge se pose et se persiste sous le verrou de combat de l'état passé
 * (`reglesMaisonMutables`), refusée en combat. Un stockage absent ou qui lève ne casse aucun geste.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { chargerLesReglesMaison, prendreLeTemoinDesReglesMaison, reglerUneRegleMaison, remettreUneRegleMaison } from './reglesMaison';
import { loadRuleOverrides, OPTIONAL_RULES, rule } from '../engine/policy';
import type { Jeu } from '../noyau/index';
import { stockageEnMemoire, stockageQuiLeve } from '../lib/stockage.testkit';

const CLE = 'wfrp4.house-rules';
const REGLE_INCONNUE = 'regle-hors-registre';
const FLAG = OPTIONAL_RULES.find((r) => r.kind === 'flag')!;
const MODE = OPTIONAL_RULES.find((r) => r.kind === 'mode' && r.options?.some((o) => o !== r.default))!;
const PARAM = OPTIONAL_RULES.find((r) => r.kind === 'param' && r.max !== undefined)!;
const AUTRE_MODE = MODE.options!.find((o) => o !== MODE.default)!;

const HORS_COMBAT: Pick<Jeu, 'battle'> = { battle: null };
const EN_COMBAT = { battle: { over: null } } as unknown as Pick<Jeu, 'battle'>;
const COMBAT_FINI = { battle: { over: 'victory' } } as unknown as Pick<Jeu, 'battle'>;

const persiste = (s: ReturnType<typeof stockageEnMemoire>): unknown => JSON.parse(s.contenu.get(CLE)!);

beforeEach(() => loadRuleOverrides({}));

describe('le chargement des règles maison d’un stockage', () => {
  it('pose le jeu persisté, sans témoin', () => {
    const s = stockageEnMemoire();
    s.setItem(CLE, JSON.stringify({ [MODE.id]: AUTRE_MODE }));
    chargerLesReglesMaison(s);
    expect(rule(MODE.id)).toBe(AUTRE_MODE);
    expect(prendreLeTemoinDesReglesMaison(s)).toBeNull();
  });

  it('un id hors du registre : SEUL lui est retiré, le reste s’applique, le stockage est réécrit, témoin qui le nomme, consommé une fois', () => {
    const s = stockageEnMemoire();
    s.setItem(CLE, JSON.stringify({ [FLAG.id]: !FLAG.default, [REGLE_INCONNUE]: true }));
    chargerLesReglesMaison(s);
    expect(rule(FLAG.id)).toBe(!FLAG.default);
    expect(persiste(s)).toEqual({ [FLAG.id]: !FLAG.default });
    expect(prendreLeTemoinDesReglesMaison(s)).toEqual({ regles: [REGLE_INCONNUE], etats: [], groupes: [] });
    expect(prendreLeTemoinDesReglesMaison(s), 'le témoin se consomme une fois').toBeNull();
  });

  it('le témoin survit au chargement suivant, qui n’élague plus rien, jusqu’à sa prise', () => {
    const s = stockageEnMemoire();
    s.setItem(CLE, JSON.stringify({ [REGLE_INCONNUE]: true }));
    chargerLesReglesMaison(s);
    chargerLesReglesMaison(s);
    expect(prendreLeTemoinDesReglesMaison(s)).toEqual({ regles: [REGLE_INCONNUE], etats: [], groupes: [] });
  });

  it('deux chargements qui élaguent des règles différentes avant la prise : le témoin les CUMULE', () => {
    const s = stockageEnMemoire();
    s.setItem(CLE, JSON.stringify({ [REGLE_INCONNUE]: true }));
    chargerLesReglesMaison(s);
    s.setItem(CLE, JSON.stringify({ [FLAG.id]: 'oui' }));
    chargerLesReglesMaison(s);
    expect(prendreLeTemoinDesReglesMaison(s)).toEqual({ regles: [REGLE_INCONNUE, FLAG.id], etats: [], groupes: [] });
  });

  it('un magasin conforme, `param` à sa borne `max` compris : tout s’applique, sans témoin (#2404)', () => {
    const s = stockageEnMemoire();
    s.setItem(CLE, JSON.stringify({ [FLAG.id]: !FLAG.default, [MODE.id]: AUTRE_MODE, [PARAM.id]: PARAM.max }));
    chargerLesReglesMaison(s);
    expect([rule(FLAG.id), rule(MODE.id), rule(PARAM.id)]).toEqual([!FLAG.default, AUTRE_MODE, PARAM.max]);
    expect(prendreLeTemoinDesReglesMaison(s)).toBeNull();
  });

  it('une valeur non conforme à la forme de sa règle : SEULE elle est retirée, ses voisines conformes s’appliquent (#2404)', () => {
    const cas = [
      { magasin: { [FLAG.id]: 'oui', [MODE.id]: AUTRE_MODE }, retiree: FLAG.id, attendu: [FLAG.default, AUTRE_MODE, PARAM.default] },
      { magasin: { [MODE.id]: 'inconnu', [FLAG.id]: !FLAG.default }, retiree: MODE.id, attendu: [!FLAG.default, MODE.default, PARAM.default] },
      { magasin: { [PARAM.id]: PARAM.max! + 1, [FLAG.id]: !FLAG.default }, retiree: PARAM.id, attendu: [!FLAG.default, MODE.default, PARAM.default] },
    ];
    for (const { magasin, retiree, attendu } of cas) {
      const s = stockageEnMemoire();
      s.setItem(CLE, JSON.stringify(magasin));
      chargerLesReglesMaison(s);
      expect([rule(FLAG.id), rule(MODE.id), rule(PARAM.id)], JSON.stringify(magasin)).toEqual(attendu);
      expect(Object.keys(persiste(s) as object), JSON.stringify(magasin)).not.toContain(retiree);
      expect(prendreLeTemoinDesReglesMaison(s)).toEqual({ regles: [retiree], etats: [], groupes: [] });
    }
  });

  it('un magasin qui n’est pas un dictionnaire est ignoré', () => {
    const s = stockageEnMemoire();
    s.setItem(CLE, JSON.stringify([FLAG.id]));
    chargerLesReglesMaison(s);
    expect(rule(FLAG.id)).toBe(FLAG.default);
    expect(prendreLeTemoinDesReglesMaison(s)).toBeNull();
  });

  it('un stockage absent ou qui lève : rien ne se pose, rien ne casse', () => {
    for (const s of [null, stockageQuiLeve]) {
      expect(() => chargerLesReglesMaison(s)).not.toThrow();
      expect(prendreLeTemoinDesReglesMaison(s)).toBeNull();
      expect(rule(FLAG.id)).toBe(FLAG.default);
    }
  });
});

describe('le réglage d’une règle maison sous le verrou de l’état passé', () => {
  it('hors combat : la surcharge se pose et se persiste ; sa remise au défaut aussi', () => {
    const s = stockageEnMemoire();
    reglerUneRegleMaison(s, HORS_COMBAT, FLAG.id, !FLAG.default);
    expect(rule(FLAG.id)).toBe(!FLAG.default);
    expect(persiste(s)).toEqual({ [FLAG.id]: !FLAG.default });
    remettreUneRegleMaison(s, HORS_COMBAT, FLAG.id);
    expect(rule(FLAG.id)).toBe(FLAG.default);
    expect(persiste(s)).toEqual({});
  });

  it('en combat : la surcharge et la remise au défaut sont REFUSÉES, rien ne s’écrit', () => {
    const s = stockageEnMemoire();
    reglerUneRegleMaison(s, HORS_COMBAT, FLAG.id, !FLAG.default);
    reglerUneRegleMaison(s, EN_COMBAT, MODE.id, AUTRE_MODE);
    remettreUneRegleMaison(s, EN_COMBAT, FLAG.id);
    expect([rule(FLAG.id), rule(MODE.id)]).toEqual([!FLAG.default, MODE.default]);
    expect(persiste(s)).toEqual({ [FLAG.id]: !FLAG.default });
  });

  it('combat fini : la porte se rouvre', () => {
    const s = stockageEnMemoire();
    reglerUneRegleMaison(s, COMBAT_FINI, FLAG.id, !FLAG.default);
    expect(rule(FLAG.id)).toBe(!FLAG.default);
  });

  it('un stockage qui lève : la surcharge reste effective pour la session', () => {
    reglerUneRegleMaison(stockageQuiLeve, HORS_COMBAT, FLAG.id, !FLAG.default);
    expect(rule(FLAG.id)).toBe(!FLAG.default);
  });
});

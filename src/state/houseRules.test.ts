import { describe, it, expect, beforeEach } from 'vitest';
import { rule, resetRule, OPTIONAL_RULES } from '../engine/policy';
import { loadHouseRules, setHouseRule, takeHouseRulesNotice } from './houseRules';
import { useGame } from './store';
import { buildApi } from './devtools';

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

const KEY = 'wfrp4.house-rules';

describe('houseRules — persistance des règles optionnelles (localStorage)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });

  it('setHouseRule : le registre reflète la surcharge ET elle est persistée', () => {
    setHouseRule('test-fast-sl', true);
    expect(rule('test-fast-sl')).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!)['test-fast-sl']).toBe(true);
  });

  it('loadHouseRules : recharge le localStorage vers le registre', () => {
    localStorage.setItem(KEY, JSON.stringify({ 'test-auto-bands': 'inverted' }));
    for (const r of OPTIONAL_RULES) resetRule(r.id); // registre vierge avant chargement
    loadHouseRules();
    expect(rule('test-auto-bands')).toBe('inverted');
  });

  it('un id hors du registre persisté : SEUL lui est retiré, le reste s’applique, le stockage est réécrit, témoin qui le nomme (#1463 LD.1)', () => {
    const r = OPTIONAL_RULES.find((x) => x.kind === 'flag')!;
    localStorage.setItem(KEY, JSON.stringify({ [r.id]: !r.default, 'regle-hors-registre': true }));
    loadHouseRules();
    expect(rule(r.id), 'la surcharge connue s’applique').toBe(!r.default);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ [r.id]: !r.default });
    expect(takeHouseRulesNotice()).toEqual({ regles: ['regle-hors-registre'], etats: [] });
    expect(takeHouseRulesNotice(), 'le témoin se consomme une fois').toBeNull();
  });

  it('une valeur non conforme à la forme de sa règle : SEULE elle est retirée, ses voisines conformes s’appliquent (#2404)', () => {
    const flag = OPTIONAL_RULES.find((r) => r.kind === 'flag')!;
    const mode = OPTIONAL_RULES.find((r) => r.kind === 'mode' && r.options?.length)!;
    const param = OPTIONAL_RULES.find((r) => r.kind === 'param' && r.max !== undefined)!;
    const autreMode = mode.options!.find((o) => o !== mode.default)!;
    const cas = [
      { magasin: { [flag.id]: 'oui', [mode.id]: autreMode }, retiree: flag.id, attendu: [flag.default, autreMode, param.default] },
      { magasin: { [mode.id]: 'inconnu', [flag.id]: !flag.default }, retiree: mode.id, attendu: [!flag.default, mode.default, param.default] },
      { magasin: { [param.id]: param.max! + 1, [flag.id]: !flag.default }, retiree: param.id, attendu: [!flag.default, mode.default, param.default] },
    ];
    for (const { magasin, retiree, attendu } of cas) {
      localStorage.setItem(KEY, JSON.stringify(magasin));
      loadHouseRules();
      expect([rule(flag.id), rule(mode.id), rule(param.id)], JSON.stringify(magasin)).toEqual(attendu);
      expect(Object.keys(JSON.parse(localStorage.getItem(KEY)!)), JSON.stringify(magasin)).not.toContain(retiree);
      expect(takeHouseRulesNotice()).toEqual({ regles: [retiree], etats: [] });
    }
    localStorage.setItem(KEY, JSON.stringify({ [flag.id]: !flag.default, [mode.id]: autreMode, [param.id]: param.max }));
    loadHouseRules();
    expect([rule(flag.id), rule(mode.id), rule(param.id)]).toEqual([!flag.default, autreMode, param.max]);
    expect(takeHouseRulesNotice()).toBeNull();
  });

  it('un magasin qui n’est pas un dictionnaire est ignoré', () => {
    localStorage.setItem(KEY, JSON.stringify(['test-fast-sl']));
    loadHouseRules();
    expect(rule('test-fast-sl')).toBe(OPTIONAL_RULES.find((r) => r.id === 'test-fast-sl')!.default);
  });
});

/**
 * LE HELPER DE RECETTE NE DOIT PAS MENTIR SUR SA PERSISTANCE (#1279) — `__wfrp.rules(id, value)` est une
 * surcharge RUNTIME (elle meurt au rechargement), mais `rules(id, null)` doit purger la surcharge
 * PERSISTÉE : sinon une règle cochée un jour au panneau revient COCHÉE à chaque ouverture, et toute
 * « restauration » de recette est une illusion (mesuré : « Jeux de taverne rapides » retrouvée active
 * 3 runs de suite après deux restaurations). La remise à zéro passe donc par la couture JOUEUR
 * (`resetHouseRule`), verrou de combat compris.
 */
describe('__wfrp.rules(id, null) — la remise à zéro purge le PERSISTÉ, pas seulement la mémoire', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    useGame.setState({ battle: null });
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });

  it('une règle cochée AU PANNEAU (persistée) est PURGÉE du localStorage', () => {
    setHouseRule('tavern-games-rapides', true);
    expect(JSON.parse(localStorage.getItem(KEY)!)['tavern-games-rapides'], 'le panneau persiste').toBe(true);

    buildApi().rules('tavern-games-rapides', null);

    expect(rule('tavern-games-rapides'), 'défaut RAW retrouvé en mémoire').toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY)!)['tavern-games-rapides'], 'et rien ne ressuscite au run suivant').toBeUndefined();
  });

  it('EN COMBAT, la remise à zéro est REFUSÉE et DIT sa raison (même verrou que le panneau)', () => {
    setHouseRule('tavern-games-rapides', true);
    useGame.setState({ battle: { over: null } as never });

    const dit = buildApi().rules('tavern-games-rapides', null);

    expect(typeof dit === 'string' && dit.length > 0, 'le helper rend la raison au lieu de mentir').toBe(true);
    expect(rule('tavern-games-rapides'), 'rien n’a bougé').toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!)['tavern-games-rapides']).toBe(true);
  });
});

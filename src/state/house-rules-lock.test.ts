import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { reglerUneRegleMaisonWeb as regler, remettreUneRegleMaisonWeb as remettre } from './reglesMaison';
import { reglesMaisonMutables } from '../noyau/reglesMaison';
import { rule, resetRule, OPTIONAL_RULES } from '../engine/policy';
import { setPreference, resetPreference } from './preferences';
import { cadence } from '../engine/cadence';
import { createHero } from '../engine/character';
import { seedBattleRng } from '../noyau/battleRng';
import { testScene } from '../scenes/test-fixture';
import { poserLeLocalStorage } from '../lib/stockage.testkit';

/**
 * VERROU des règles optionnelles pendant un combat (#564, #1049) — garde d'INGÉNIERIE : elle ne dit
 * rien des règles du jeu, elle empêche des états applicatifs incohérents.
 *
 * Le moteur lit `rule(id)` EN DIRECT : muter une entrée alors qu'une bataille est en cours rétroagit
 * sur un état déjà construit à l'ouverture. Cas mesuré (#564) : activer « Avantage de groupe » en plein
 * combat faisait naître la réserve de camp À ZÉRO au premier `poolsOf`, et `mirrorPools` écrasait
 * l'Avantage individuel de TOUS les combattants. La porte vit au point d'ÉCRITURE joueur
 * (`noyau/reglesMaison`, lu par `hote/reglesMaison`), pas dans l'UI, et vaut pour la CLASSE entière (aucun id nommé).
 * Ici, le geste du panneau web et la préférence de Cadence ; le verrou lui-même et le bug #564 se jouent au banc du noyau
 * (`src/noyau/house-rules-lock.hors-store.test.ts`).
 */

const verrou = () => reglesMaisonMutables(useGame.getState());

function startFixtureCombat() {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  useGame.getState().lancerLaScene(testScene());
  seedBattleRng(777);
  useGame.getState().lancerLeCombat('enc-mutants', undefined, { noSurprise: true });
  return useGame.getState().battle!;
}

describe('Règles optionnelles — verrouillées tant qu’un combat est en cours', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    poserLeLocalStorage();
    useGame.setState({ battle: null, pendingCascade: null, pendingRoundStart: null });
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    useGame.setState({ battle: null });
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });

  it('hors combat : l’écriture passe (aucune régression du panneau)', () => {
    expect(verrou().mutable).toBe(true);
    regler('combat-aa-avantage-groupe', true);
    expect(rule('combat-aa-avantage-groupe')).toBe(true);
    remettre('combat-aa-avantage-groupe');
    expect(rule('combat-aa-avantage-groupe')).toBe(false);
  });

  it('en combat : `reglerUneRegleMaison` REFUSE la mutation et porte sa raison en texte', () => {
    startFixtureCombat();
    const gate = verrou();
    expect(gate.mutable).toBe(false);
    expect(gate.reason).toMatch(/combat/i);
    regler('combat-aa-avantage-groupe', true);
    expect(rule('combat-aa-avantage-groupe')).toBe(false); // la règle n’a pas bougé
  });

  it('en combat : `remettreUneRegleMaison` refuse aussi (le retour au défaut RAW est une mutation)', () => {
    regler('combat-aa-avantage-groupe', true); // choisie AVANT le combat
    startFixtureCombat();
    remettre('combat-aa-avantage-groupe');
    expect(rule('combat-aa-avantage-groupe')).toBe(true); // le combat garde le modèle sous lequel il s’est ouvert
  });

  it('le CONFORT n’est pas une exemption du registre : il n’y est PAS — la Cadence reste réglable en plein combat (#839)', () => {
    startFixtureCombat();
    expect(OPTIONAL_RULES.map((r): string => r.id)).not.toContain('combat-cadence');
    setPreference('combat-cadence', 'auto');
    expect(cadence()).toBe('auto');
    resetPreference('combat-cadence');
    expect(cadence()).toBe('manuel');
  });
});


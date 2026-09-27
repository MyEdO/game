import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { setRule, resetRule } from '../engine/policy';
import { modalOwnerOf } from './modalArbiter';

/** Enfoncer une porte à PLUSIEURS (EDO Appendice 2, « Portes ») — flux multi PARALLÈLE, métier =
 *  DÉGÂTS sur objet (BE / B). Chaque héros frappe indépendamment (Bagarre → DR + BF − BE) avec son
 *  propre cycle d'influence ; la somme ronge les Blessures jusqu'à céder. Objets : PAS de minimum 1. */
describe('Enfoncer une porte à plusieurs (objet BE/B, jets indépendants)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingForceDoor: null, pendingCascade: null, suspendedCascades: [], flags: {} } as never); });
  afterEach(() => resetRule('test-fast-sl'));

  function heroes() {
    const mk = (name: string, seed: number) => {
      const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: name, seed });
      h.fortune = 2; h.resilience = 2; h.characteristics.force = 45; // Bonus de Force 4
      return h;
    };
    const a = mk('A', 1), b = mk('B', 2);
    useGame.setState({ party: [a, b] });
    return [a, b];
  }

  it('chacun frappe indépendamment ; les dégâts cumulés font céder la porte (flag posé)', () => {
    useGame.getState().seedRng(7);
    const [a, b] = heroes();
    useGame.getState().startForceDoor({ label: 'Porte de la cave', doorBE: 0, doorB: 8, heroIds: [a.id, b.id], flag: 'cave_ouverte' });
    let guard = 0;
    while (useGame.getState().pendingForceDoor && guard++ < 40) {
      const p = useGame.getState().pendingForceDoor!;
      p.participants.forEach((part) => useGame.getState().forceDoorRoll(part.id)); // chacun SON jet
      expect(useGame.getState().pendingForceDoor!.participants.every((x) => x.result)).toBe(true);
      useGame.getState().forceDoorConfirm(); // applique la somme du Round
    }
    expect(useGame.getState().pendingForceDoor).toBeNull(); // la porte a cédé
    expect(useGame.getState().flags.cave_ouverte).toBe(true); // ouverture en jeu (flag de scène)
    expect(guard).toBeGreaterThanOrEqual(1);
  });

  /**
   * #1262 V2 L4 — l'enfoncement était le DERNIER `groupOwner` monté à la main (une étape littérale
   * hors de la porte). Il passe par `hostStep` en forme de GROUPE : jet de groupe SANS porteur nommé.
   * La possession `'*'` est ce qui donne la fenêtre à TOUS les sièges (chacun n'influençant que SA
   * rangée) — sans elle, l'arbitre la rendrait à l'hôte seul.
   */
  it('l’étape est MINTÉE en forme de GROUPE : `groupOwner`, aucun porteur nommé, fenêtre à tous les sièges', () => {
    const [a, b] = heroes();
    useGame.getState().startForceDoor({ label: 'Porte', doorBE: 0, doorB: 8, heroIds: [a.id, b.id] });
    const casc = useGame.getState().pendingCascade!;
    expect(casc.participants).toHaveLength(1);
    const st = casc.participants[0];
    expect(Object.keys(st).sort(), 'la déclaration, et rien d’autre').toEqual(['groupOwner', 'id', 'jet', 'kind']);
    expect(st.jet).toBe('forceDoor');
    expect(st.groupOwner).toBe(true);
    expect(st.actorId, 'un jet de GROUPE n’a pas d’acteur unique').toBeUndefined();
    expect(modalOwnerOf(useGame.getState()), 'fenêtre ouverte à tous les sièges').toBe('*');
  });

  it('EDO : DR + BF < BE → 0 dégât (la porte ne bouge pas) — objets sans minimum 1', () => {
    const [a, b] = heroes();
    useGame.getState().startForceDoor({ label: 'Porte blindée', doorBE: 8, doorB: 5, heroIds: [a.id, b.id] });
    // Coups faibles (comme Gerhardt : DR −2 + BF 4 = 2 < BE 8 → 0).
    const p = useGame.getState().pendingForceDoor!;
    useGame.setState({ pendingForceDoor: { ...p, participants: p.participants.map((x) => ({ ...x, result: { roll: 63, target: 46, sl: -2, damage: 0 } })) } });
    useGame.getState().forceDoorConfirm();
    expect(useGame.getState().pendingForceDoor!.doorB).toBe(5); // 0 dégât → Blessures inchangées, nouveau Round
  });

  it('Résilience garantit un coup ; chaque héros dépense SES propres ressources', () => {
    const [a] = heroes();
    useGame.getState().startForceDoor({ label: 'Porte', doorBE: 0, doorB: 50, heroIds: [a.id] });
    useGame.getState().forceDoorForceSuccess(a.id); // « Je ne faillirai pas ! » → DR max → dégâts
    const r = useGame.getState().pendingForceDoor!.participants[0].result!;
    expect(r.damage).toBeGreaterThan(0);
    expect(useGame.getState().party[0].resilience).toBe(1); // 1 Point de Résilience dépensé (le SIEN)
  });

  // Non-régression : le dé PAR DÉFAUT de la Résilience doit être policy-aware (`bestForcedRoll`). En Fast DR
  // (LDB 12 l.102, DR = dizaines du JET), l'ancien `1` codé en dur donnait le DR MINIMAL (planché à 1) au lieu
  // du MAXIMAL. RAW LDB 17 l.68 « vous choisissez le résultat » = LE MEILLEUR → dizaines de la cible.
  it('Fast DR : le dé forcé vise le DR MAXIMAL (dizaines de la cible), PAS 1', () => {
    setRule('test-fast-sl', true); // règle optionnelle : sur une réussite, DR = dizaines du jet
    const [a] = heroes();
    a.characteristics['capacite-de-combat'] = 65; // Bagarre (Corps à corps) → cible ~65 (dizaines 6)
    useGame.setState({ party: [a] });
    useGame.getState().startForceDoor({ label: 'Porte', doorBE: 0, doorB: 80, heroIds: [a.id] });
    useGame.getState().forceDoorForceSuccess(a.id); // « Je ne faillirai pas ! »
    const r = useGame.getState().pendingForceDoor!.participants[0].result!;
    const maxDR = Math.floor(Math.min(r.target, 95) / 10); // dizaines de la cible = DR forcé MAXIMAL
    expect(maxDR).toBeGreaterThan(1);   // cible élevée → DR max clairement > 1
    expect(r.sl).toBe(maxDR);           // DR forcé = MAXIMAL (dizaines de la cible)...
    expect(r.sl).not.toBe(1);           // ...et PAS le DR minimal (bug du dé 01 codé en dur en Fast DR)
    expect(r.roll).not.toBe(1);         // le dé forcé n'est plus 01 : c'est le plus haut valide
  });
});

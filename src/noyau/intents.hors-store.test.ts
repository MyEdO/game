/**
 * Garde-fou de l'allowlist coop : chaque intent DOIT exister comme action du noyau (un
 * renommage d'action casse ici, pas en prod chez un invité) — et l'allowlist reste
 * combat-only (aucune action de persistance/économie n'y traîne). La table de l'adaptateur web, l'émission des écrans
 * et le nettoyage des arguments se jouent en `src/state/intents.test.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Jeu } from './etat';
import type { FLOW_VERBS } from './flowVerbs';
import {
  GUEST_INTENTS, PARTY_INTENTS, INTERLUDE_INTENTS,
  type ActionManuscrite, type ClasseCoop, type Ouverture, type TableDesClasses,
} from './intentionsDeSiege';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('#2724 — table TOTALE des classes coop : une action non classée ne compile pas', () => {
  type EtatAvecActionNeuve = Jeu & { actionNeuve: (id: string) => void; champNeuf: number };

  it('la table réelle, privée de l’action neuve, ne satisfait plus le type total', () => {
    const sansClasse = (t: TableDesClasses): TableDesClasses<EtatAvecActionNeuve> =>
      // @ts-expect-error — `actionNeuve` n'a pas de classe
      t;
    const classee = (t: TableDesClasses): TableDesClasses<EtatAvecActionNeuve> => ({ ...t, actionNeuve: 'interne' });
    const table = { battleEndTurn: 'invité' } as TableDesClasses;
    expect(sansClasse(table)).toBe(table);
    expect(classee(table).actionNeuve).toBe('interne');
  });

  it('seules les actions MANUSCRITES s’écrivent : ni champ d’état, ni délégué ou résolution de flux', () => {
    const neuve: ActionManuscrite<EtatAvecActionNeuve> = 'actionNeuve';
    // @ts-expect-error — un champ d'état n'est pas une action
    const champ: ActionManuscrite<EtatAvecActionNeuve> = 'champNeuf';
    // @ts-expect-error — un délégué de flux a sa classe DÉRIVÉE de `FLOW_VERBS`
    const delegue: ActionManuscrite = 'attackReroll';
    // @ts-expect-error — une `resolution` de flux aussi
    const resolution: ActionManuscrite = 'bargainConfirm';
    // @ts-expect-error — quatre classes, aucune autre
    const classe: ClasseCoop = 'miroir';
    expect([neuve, champ, delegue, resolution, classe]).toHaveLength(5);
  });

  it('une action `<prefix><Maj>…` d’un flux de jet est `invité` (#1017, #1050)', () => {
    type EtatAvecActionDeFlux = Jeu & { attackSetFoo: (x: number) => void; castSetBar: () => void };
    const avec = (t: TableDesClasses, c: 'hôte' | 'local'): TableDesClasses<EtatAvecActionDeFlux> => ({
      ...t,
      // @ts-expect-error — action d'un flux exposé hors surface invité
      attackSetFoo: c,
      // @ts-expect-error — idem, en `local`
      castSetBar: c,
    });
    const exposee = (t: TableDesClasses): TableDesClasses<EtatAvecActionDeFlux> => ({ ...t, attackSetFoo: 'invité', castSetBar: 'invité' });
    const table = { battleEndTurn: 'invité' } as TableDesClasses;
    expect(avec(table, 'hôte').attackSetFoo).toBe('hôte');
    expect(exposee(table).castSetBar).toBe('invité');
  });

  it('un ouvreur `parHote` reste `hôte`, une élection locale reste `local`', () => {
    const t = { battleEndTurn: 'invité' } as TableDesClasses;
    // @ts-expect-error — `appraiseItem` ouvre le flux `appraise` depuis un écran d'hôte
    const ouvreur: TableDesClasses = { ...t, appraiseItem: 'invité' };
    // @ts-expect-error — `dispelSelectCarrier` n'écrit qu'un champ hors snapshot
    const election: TableDesClasses = { ...t, dispelSelectCarrier: 'invité' };
    expect([ouvreur.appraiseItem, election.dispelSelectCarrier]).toEqual(['invité', 'invité']);
  });

  it('les actions d’un flux multi SANS `coop` n’ont pas de classe dérivée : elles s’écrivent', () => {
    type FluxNonCoop = typeof FLOW_VERBS & { faux: { kind: 'multi'; pidIsActor: true; verbs: readonly ['roll']; resolution: readonly ['fauxConfirm'] } };
    type FluxCoop = typeof FLOW_VERBS & { faux: { kind: 'multi'; pidIsActor: true; coop: true; verbs: readonly ['roll']; resolution: readonly ['fauxConfirm'] } };
    type EtatAvecFlux = Jeu & { fauxRoll: (pid: string) => void; fauxConfirm: () => void };
    const delegue: ActionManuscrite<EtatAvecFlux, FluxNonCoop> = 'fauxRoll';
    const resolution: ActionManuscrite<EtatAvecFlux, FluxNonCoop> = 'fauxConfirm';
    // @ts-expect-error — en `coop: true`, le délégué est dérivé
    const derive: ActionManuscrite<EtatAvecFlux, FluxCoop> = 'fauxRoll';
    expect([delegue, resolution, derive]).toHaveLength(3);
  });

  it('un délégué ou une `resolution` d’un flux multi SANS `coop` prend une classe LIBRE, mais en prend une', () => {
    type FluxNonCoop = typeof FLOW_VERBS & { faux: { kind: 'multi'; pidIsActor: true; verbs: readonly ['roll']; resolution: readonly ['fauxConfirm'] } };
    type EtatAvecFlux = Jeu & { fauxRoll: (pid: string) => void; fauxConfirm: () => void; fauxSetBar: () => void };
    const t = { battleEndTurn: 'invité' } as TableDesClasses;
    const hote: TableDesClasses<EtatAvecFlux, FluxNonCoop> = { ...t, fauxRoll: 'hôte', fauxConfirm: 'interne', fauxSetBar: 'invité' };
    // @ts-expect-error — hors délégué et `resolution`, une action `<prefix><Maj>…` reste `invité`
    const prefixe: TableDesClasses<EtatAvecFlux, FluxNonCoop> = { ...t, fauxRoll: 'hôte', fauxConfirm: 'interne', fauxSetBar: 'hôte' };
    // @ts-expect-error — `fauxConfirm` n'a pas de classe
    const sansClasse: TableDesClasses<EtatAvecFlux, FluxNonCoop> = { ...t, fauxRoll: 'hôte', fauxSetBar: 'invité' };
    expect([hote.fauxRoll, hote.fauxConfirm, prefixe.fauxSetBar, sansClasse.fauxRoll]).toEqual(['hôte', 'interne', 'hôte', 'hôte']);
  });

  it('une ouverture `interne` nomme son site `<module>.<fonction>`', () => {
    const site: Ouverture = { interne: 'combatFlow.maybeOpenDefense' };
    // @ts-expect-error — ouverture muette
    const muette: Ouverture = { interne: '' };
    // @ts-expect-error — aucun site nommé
    const vague: Ouverture = { interne: 'quelque part' };
    expect([site, muette, vague]).toHaveLength(3);
  });
});

describe('allowlist coop (state/intents)', () => {
  it('chaque intent correspond à une action existante du store', () => {
    const state = banc.getState() as unknown as Record<string, unknown>;
    const missing = [...GUEST_INTENTS].filter((name) => typeof state[name] !== 'function');
    expect(missing).toEqual([]);
  });

  it('la composition du groupe est allowlistée (chaque joueur remplit SES emplacements)', () => {
    for (const name of ['partyAddHero', 'partyRemoveHero', 'partyReplaceHero']) {
      expect(PARTY_INTENTS.has(name), name).toBe(true);
      expect(GUEST_INTENTS.has(name), name).toBe(true);
    }
  });

  it('aucune action de persistance/économie/exploration dans l’allowlist (périmètre combat + groupe)', () => {
    for (const forbidden of ['saveGame', 'loadGame', 'importGame', 'confirmSell', 'payCart',
      'startTravel', 'moveParty', 'transitionTo', 'startInterlude', 'interludeEnd', 'loadProject',
      'startScene', 'setParty', 'grantXp', 'seedRng', 'netAssignSlot', 'netAssign']) {
      expect(GUEST_INTENTS.has(forbidden), forbidden).toBe(false);
    }
  });
});

describe('Activités d’interlude allowlistées (audit M7) — l’ouverture/clôture reste à l’hôte', () => {
  it('les activités par héros et le flux de jet sont permis à l’invité', () => {
    for (const name of INTERLUDE_INTENTS) expect(GUEST_INTENTS.has(name), name).toBe(true);
    expect(INTERLUDE_INTENTS.has('interludeActivity')).toBe(true); // chemin UNIQUE des Activités à jet
    expect(INTERLUDE_INTENTS.has('activityConfirm')).toBe(true);
  });
});

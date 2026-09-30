/**
 * CONFRONTATION table⇄spec (#1015) : pour CHAQUE flux `kind:'mono'` de `FLOW_VERBS`, le couple
 * `jetOwner.{pending,field}` déclaré en DONNÉE désigne-t-il bien l'acteur que le flux DÉBITE ?
 *
 * Pourquoi elle est nécessaire : `netOwnership` et `rollFlowSpecs` portent la même information deux
 * fois (la dérivation directe est impossible — cycle d'initialisation `rollFlowSpecs`→`combatFlow`→
 * `netOwnership`), et la garde nominative voisine (`cast-intent-ownership.test.ts`) POSE sa fixture
 * d'après la table elle-même : inverser `field` y reste VERT. Ici les deux côtés sont INDÉPENDANTS —
 *  - GAUCHE : `FLOWS[flux].actorOf(get)`, qui traverse `spec.actor`, l'entrée exacte de `opReroll`/
 *    `opBonusSL`/`opForceSuccess`/`opDarkPact` (le site qui dépense la Chance/la Résilience/la Corruption) ;
 *  - DROITE : `s[jetOwner.pending][jetOwner.field]`, ce que lit `intentAllowedFor`.
 *
 * Discriminant par CONSTRUCTION : le pending est un Proxy qui rend une SENTINELLE DISTINCTE pour
 * CHAQUE champ lu (`§<nom du champ>`), et le groupe reçoit un combattant par sentinelle observée. Un
 * `field` échangé pour un autre id du même pending (`moverId`→`foeId`) donne donc deux sentinelles
 * différentes → ROUGE (mutation mesurée).
 *
 * ANGLE MORT ÉNONCÉ : la confrontation prouve l'ACCORD des deux sources, pas leur justesse RAW — si
 * `spec.actor` lui-même désignait le mauvais combattant, les deux côtés mentiraient de concert et ce
 * test serait vert. C'est l'échantillonnage de flux RÉEL (`jet-owner-real-flows.test.ts`, plus
 * `attack-intent-ownership.test.ts`) qui couvre ce plan-là.
 */
import { describe, it, expect } from 'vitest';
import { FLOW_VERBS, type JetOwnerRef } from './flowVerbs';
import { FLOW_HANDLERS } from './rollFlowSpecs';
import type { GameState } from './store';
import type { Get } from './flowTypes';

const MONO = (Object.entries(FLOW_VERBS) as [string, { kind: string; jetOwner?: JetOwnerRef }][])
  .filter(([, w]) => w.kind === 'mono');

/** Sentinelle d'un champ du pending — un id de combattant DISTINCT par nom de champ. */
const sentinel = (field: string) => `§${field}`;

/** Pending FANTÔME : tout champ lu rend sa sentinelle, et le nom du champ est ENREGISTRÉ (1ʳᵉ passe →
 *  on sait quels combattants créer ; 2ᵈᵉ passe → `spec.actor` les retrouve dans le groupe). */
const ghostPending = (seen: Set<string>) =>
  new Proxy({} as Record<string, unknown>, {
    get(_t, prop) {
      if (typeof prop !== 'string') return undefined;
      seen.add(prop);
      return sentinel(prop);
    },
  });

const stateWith = (pendingKey: string, pending: unknown, ids: string[]): GameState =>
  ({
    battle: null, // hors combat : `actorIn` résout dans le GROUPE
    party: ids.map((id) => ({ id, kind: 'hero' })),
    [pendingKey]: pending,
  }) as unknown as GameState;

describe('#1015 — le porteur déclaré (`FLOW_VERBS.jetOwner`) EST l’acteur que le flux débite', () => {
  it('tout flux mono déclare son porteur (le variant l’exige à la compilation — mesuré ici aussi)', () => {
    // 29 → 28 (#700, 2026-09-30) : `fall` passe MULTI (une rangée par tombant, EDO 01 l.231).
    expect(MONO.length).toBeGreaterThanOrEqual(28);
    expect(MONO.filter(([, w]) => !w.jetOwner).map(([k]) => k)).toEqual([]);
  });

  for (const [prefix, w] of MONO) {
    it(`${prefix} : \`${w.jetOwner!.pending}.${w.jetOwner!.field}\` = l’acteur de \`spec.actor\``, () => {
      const jet = w.jetOwner!;
      const flow = FLOW_HANDLERS[prefix as keyof typeof FLOW_HANDLERS];
      const seen = new Set<string>();
      const pending = ghostPending(seen);
      // 1ʳᵉ passe : aucun combattant — on RELÈVE les champs que `spec.actor` consulte.
      const probe = stateWith(jet.pending, pending, []);
      flow.actorOf((() => probe) as Get);
      expect(seen.size, `${prefix} : \`spec.actor\` ne lit AUCUN champ du pending`).toBeGreaterThan(0);
      // 2ᵈᵉ passe : un combattant PAR champ lu → l'acteur résolu NOMME le champ dont il provient.
      const ids = [...seen].map(sentinel);
      const s = stateWith(jet.pending, pending, ids);
      const actor = flow.actorOf((() => s) as Get);
      expect(actor, `${prefix} : \`spec.actor\` ne résout aucun acteur (clé de pending fautive ?)`).toBeDefined();
      const declared = (s as unknown as Record<string, Record<string, unknown>>)[jet.pending][jet.field];
      expect(declared, `${prefix} : \`${jet.field}\` n’est pas un champ du pending`).toBe(sentinel(jet.field));
      expect(actor!.id, `${prefix} : la table dit \`${jet.field}\`, le flux débite un AUTRE champ`).toBe(declared);
    });
  }
});

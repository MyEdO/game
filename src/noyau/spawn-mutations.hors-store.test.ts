/**
 * #1853 — une créature NÉE avec une mutation la porte comme celle qui l'a GAGNÉE en jeu : le spawn
 * attache chaque instance par `attachMutation` (`engine/corruption.ts`), une seule fois.
 * LDB 85 l.245 ; ZI 04 l.118 ; #1853.
 *
 * Garde de PROPRIÉTÉ (`spawnMutations.testkit.ts`) sur tout statbloc du commun qui porte un trait de mutation au
 * spawn : bestiaire (`creatures.json`), paquet de test, statblocs et presets des scénarios de test ; un projet la
 * joue sur ses paquets dans sa suite.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { statblockToCombatant } from './monde/spawn';
import { parseProject } from './worldMap';
import type { CustomStatblock } from '../engine/statblock';
import { mutations } from '../data';
import { SCENARIOS } from '../scenes/test-scenarios/_registry.generated';
import { effectiveChar } from '../engine/characteristics';
import { type TraitList } from '../engine/statEntry';
import { customStatblockSchema } from '../data/schemas/defs-scenes/communs';
import { fautesDuPorteur, ORIGINE, porteursDuBestiaire, porteursDuPaquet, SPAWN_TRAITS, type Porteur } from './spawnMutations.testkit';
import { file as PAQUET_DE_TEST } from '../data/schemas/defs-scenes/paquet-de-test';
import paquetDeTest from '../scenes/fixtures/paquet-de-test.json';

/** Op-kinds du `passive` d'une mutation, classés. Un op-kind NEUF non classé rougit la garde. */
const OPS_ACQUISITION = ['grantTrait', 'grantPsychTrait', 'grantTalent'] as const; // (c), (d)
const OPS_LECTURE_VIVE = ['charMod', 'moveMod', 'testMod', 'skillMod'] as const; // lus sur `c.mutations` : (b) borne l'application à une fois
/** Hors garde, #1853 L2 : PA (`ap`, et son drapeau `noDeviation`) et armes naturelles en lecture vive. */
const OPS_RESTE_L2 = ['ap', 'grantNaturalWeapon'] as const;
/** Op-kinds des `effects` d'une mutation : joués par leur Trigger, jamais au spawn ; le re-ciblage par
 *  `removeTrait` retire par provenance (`traitsAccordesPar`, `corruption.test.ts`). */
const OPS_DECLENCHES = ['removeTrait', 'grantTrait'] as const;

/** Op-kinds de tout nœud `{ op }` sous `node`. */
function opsDe(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(opsDe);
  if (!node || typeof node !== 'object') return [];
  const o = node as Record<string, unknown>;
  return [...(typeof o.op === 'string' ? [o.op] : []), ...Object.values(o).flatMap(opsDe)];
}

/** Les porteurs du commun : le bestiaire, les scénarios de test et le paquet de test ; un projet joue les siens dans sa suite. */
function tousLesPorteurs(): Porteur[] {
  const out: Porteur[] = [...porteursDuBestiaire(), ...porteursDuPaquet(PAQUET_DE_TEST, parseProject(paquetDeTest))];
  for (const s of SCENARIOS) {
    const built = s.construire(idsDeTest);
    out.push(...porteursDuPaquet(`scénario ${s.id}`, { narratif: built.narratif, scenes: [built.scene, ...(built.extraScenes ?? [])] }));
  }
  return out;
}

describe('mutations au spawn — garde de propriété sur les statblocs livrés (#1853)', () => {
  const porteurs = tousLesPorteurs();

  it('chaque porteur : arg résolu, nombre = indice, acquisitions uniques et provenancées, armes, Blessures', () => {
    expect(porteurs.length, 'aucun porteur : la propriété serait vraie à vide').toBeGreaterThan(0);
    expect(porteurs.flatMap(fautesDuPorteur)).toEqual([]);
  });

  it('les sources du corpus sont toutes VUES (bestiaire, scénario)', () => {
    expect(porteurs.some((p) => p.ou.startsWith('creatures.json'))).toBe(true);
    expect(porteurs.some((p) => p.ou.startsWith('scénario '))).toBe(true);
  });

  it('chaque op-kind de mutation est CLASSÉ : couvert, ou reste nommé (#1853 L2/L3)', () => {
    const classes = new Set<string>([...OPS_ACQUISITION, ...OPS_LECTURE_VIVE, ...OPS_RESTE_L2]);
    const kinds = new Set(mutations.flatMap((m) => (m.passive ?? []).map((o) => o.op)));
    expect([...kinds].filter((k) => !classes.has(k)), 'op-kinds hors classement').toEqual([]);
    const declenches = new Set<string>(OPS_DECLENCHES);
    const kindsDEffet = new Set(mutations.flatMap((m) => opsDe(m.effects)));
    expect([...kindsDEffet].filter((k) => !declenches.has(k)), 'op-kinds d’`effects` hors classement').toEqual([]);
  });

  it('Choses du Bois Mort : Totalement déséquilibré + 2 lancers, Mutation 3 (ZI 04 l.118)', () => {
    const c = porteurs.find((p) => p.ou === 'creatures.json › choses-du-bois-mort')!.spawn();
    const mentales = (c.mutations ?? []).filter((m) => m.kind === 'mentale');
    expect(mentales.length).toBe(3);
    expect(mentales[0].id).toBe('totalement-desequilibre');
    expect((c.mutations ?? []).filter((m) => m.kind === 'physique').length).toBe(3);
  });

  it('un Trait accordé par une mutation ne lève pas l’immunité psy d’un Fabriqué ni d’une Nuée (LDB 85 l.142, l.253)', () => {
    const golem = statblockToCombatant({ label: 'Golem', char: {}, traits: [{ id: 'fabrique' }, { id: 'mutation', arg: 'cretin' }] } as CustomStatblock, 'golem', ORIGINE);
    const nuee = statblockToCombatant({ label: 'Nuée', char: {}, traits: [{ id: 'nuee' }, { id: 'mutation', arg: 'chair-necrosee' }] } as CustomStatblock, 'nuee', ORIGINE);
    expect(golem.traits?.some((t) => t.id === 'stupide')).toBe(true);
    expect(golem.psychImmune).toBe(true);
    expect(nuee.causesPeur).toBe(3);
    expect(nuee.psychImmune).toBe(true);
  });

  it('Crétin : Int 30 − 40, jusqu’à un minimum de 10 (EDO 11 l.190 ; arbitrage #1853 du 2026-10-04)', () => {
    const cretins = porteurs.filter((p) => p.traits.some((t) => t.id === 'mutation' && t.arg === 'cretin'));
    expect(cretins.some((p) => p.ou.startsWith('scénario embuscade'))).toBe(true);
    for (const p of cretins) expect(effectiveChar(p.spawn(), 'intelligence'), p.ou).toBe(10);
  });

  it('déterminisme : même id, même résultat', () => {
    for (const p of porteurs) expect(p.spawn().mutations, p.ou).toEqual(p.spawn().mutations);
  });

  it('Nuée : le delta de Blessures d’une mutation est celui d’une créature type, ×5 (LDB 85 l.253)', () => {
    const profil = { label: 'Rats', char: { force: 30, endurance: 35, 'force-mentale': 30 } };
    const max = (traits: TraitList): number => statblockToCombatant({ ...profil, traits } as CustomStatblock, 'n', ORIGINE).wounds.max;
    const typeDelta = max([{ id: 'mutation', arg: 'corpulent' }]) - max([]);
    expect(typeDelta).toBeGreaterThan(0);
    expect(max([{ id: 'nuee' }, { id: 'mutation', arg: 'corpulent' }]) - max([{ id: 'nuee' }])).toBe(5 * typeDelta);
  });
});

describe('porte de SCHÉMA : l’arg d’un trait à source FERMÉE résout dans son registre (#1853)', () => {
  const statbloc = (traits: TraitList): unknown => ({ type: 'statblock', label: 'X', char: {}, traits });

  it('un arg inconnu ou un libellé est REFUSÉ au parse, l’id est admis', () => {
    expect(customStatblockSchema.safeParse(statbloc([{ id: 'mutation', arg: 'Cornes' }])).success).toBe(false);
    expect(customStatblockSchema.safeParse(statbloc([{ id: 'corruption-mentale', arg: 'Totalement déséquilibré' }])).success).toBe(false);
    expect(customStatblockSchema.safeParse(statbloc([{ id: 'corruption-mentale', arg: 'totalement-desequilibre' }])).success).toBe(true);
    expect(customStatblockSchema.safeParse(statbloc([{ id: 'mutation' }])).success).toBe(true);
  });

  it('un statbloc VALIDÉ ne fait jamais lever le spawn, quel que soit l’arg de mutation', () => {
    const args = [...mutations.flatMap((m) => [m.id, m.label]), 'Cornes', ''];
    for (const traitId of SPAWN_TRAITS) for (const arg of args) {
      const parse = customStatblockSchema.safeParse(statbloc([{ id: traitId, arg }]));
      if (parse.success) expect(() => statblockToCombatant(parse.data as CustomStatblock, 'x', ORIGINE), `${traitId}(${arg})`).not.toThrow();
    }
  });
});

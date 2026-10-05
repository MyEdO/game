/**
 * #1853 — une créature NÉE avec une mutation la porte comme celle qui l'a GAGNÉE en jeu : le spawn
 * attache chaque instance par `attachMutation` (`engine/corruption.ts`), une seule fois.
 * LDB 85 l.245 ; ZI 04 l.118 ; #1853.
 *
 * Garde de PROPRIÉTÉ sur TOUT statbloc livré qui porte un trait de mutation au spawn : bestiaire
 * (`creatures.json`), presets des projets livrés, statblocs et presets des scénarios de test.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { listerProjetsLivres } from '../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs';
import { useGame } from './store';
import { resolvePresetCreature } from './campaignData';
import { creatureToCombatant, statblockToCombatant } from './spawn';
import { parseProject } from './worldMap';
import type { NarratifBlock } from './campaignNarratif';
import type { Scene } from './scene';
import type { CustomStatblock } from '../engine/statblock';
import { creatures, findTalentById, findTraitById } from '../data';
import { mutationById } from '../data/mutations';
import mutationsJson from '../data/mutations.json';
import { SCENARIOS } from '../scenes/test-scenarios/_registry.generated';
import { mutationsAtSpawn, markMutationsAtSpawn } from '../engine/traits/dispatch';
import { attachMutation } from '../engine/corruption';
import { effectiveChar, effectiveMaxWounds } from '../engine/characteristics';
import { weaponFromTrait } from '../engine/creatureEquip';
import { makeRNG } from '../engine/dice';
import type { TraitList } from '../engine/statEntry';
import { customStatblockSchema } from '../data/schemas/defs-scenes/communs';
import type { Combatant } from '../engine/types';

/** Op-kinds du `passive` d'une mutation, classés. Un op-kind NEUF non classé rougit la garde. */
const OPS_ACQUISITION = ['grantTrait', 'grantPsychTrait', 'grantTalent'] as const; // (c), (d)
const OPS_LECTURE_VIVE = ['charMod', 'moveMod', 'testMod', 'skillMod'] as const; // lus sur `c.mutations` : (b) borne l'application à une fois
/** Hors garde, #1853 L2 : PA (`ap`, et son drapeau `noDeviation`) et armes naturelles en lecture vive. */
const OPS_RESTE_L2 = ['ap', 'grantNaturalWeapon'] as const;
/** Hors garde, #1853 L3 : plancher d'un `charMod` (EDO 11 l.190, « jusqu'à un minimum de 10 »). */
const RESTE_L3 = 'plancher de charMod';
/** Op-kinds des `effects` d'une mutation : joués par leur Trigger, jamais au spawn ; le re-ciblage par
 *  `removeTrait` retire par provenance (`removeGrantedTraitsFrom`, `corruption.test.ts`). */
const OPS_DECLENCHES = ['removeTrait', 'grantTrait'] as const;

/** Op-kinds de tout nœud `{ op }` sous `node`. */
function opsDe(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(opsDe);
  if (!node || typeof node !== 'object') return [];
  const o = node as Record<string, unknown>;
  return [...(typeof o.op === 'string' ? [o.op] : []), ...Object.values(o).flatMap(opsDe)];
}

type Porteur = { ou: string; traits: TraitList; nativeTalents: { talentId: string; times: number }[]; spawn: () => Combatant };

const SPAWN_TRAITS = new Set(['mutation', 'corruption-mentale', 'marque-de-tzeentch']);
const porteMutation = (traits: TraitList | undefined): boolean => (traits ?? []).some((t) => SPAWN_TRAITS.has(t.id));
const ORIGINE = { x: 0, y: 0 };

function talentsNatifs(refs: { id: string; times?: number }[] | undefined): { talentId: string; times: number }[] {
  return (refs ?? []).flatMap((r) => (findTalentById(r.id) ? [{ talentId: r.id, times: r.times ?? 1 }] : []));
}

function porteursDuNarratif(ou: string, narratif: NarratifBlock): Porteur[] {
  return narratif.presetsPnj.flatMap((preset) => {
    useGame.setState({ campaignNarratif: narratif });
    const r = resolvePresetCreature(preset.id);
    if (!r || !porteMutation(r.creature.traits)) return [];
    const creature = r.creature;
    return [{ ou: `${ou} › preset ${preset.id}`, traits: creature.traits, nativeTalents: talentsNatifs(creature.talents), spawn: () => creatureToCombatant(creature, preset.id, ORIGINE) }];
  });
}

function porteursDeScene(ou: string, scene: Scene): Porteur[] {
  return scene.entities.flatMap((ent) => {
    const sb = (ent as { statblock?: CustomStatblock }).statblock;
    if (!sb || !porteMutation(sb.traits)) return [];
    return [{ ou: `${ou} › ${scene.id} › ${ent.id}`, traits: sb.traits ?? [], nativeTalents: talentsNatifs(sb.talents), spawn: () => statblockToCombatant(sb, ent.id, ORIGINE, (ent as { appearance?: never }).appearance) }];
  });
}

function tousLesPorteurs(): Porteur[] {
  const out: Porteur[] = [];
  for (const c of creatures) if (porteMutation(c.traits)) out.push({ ou: `creatures.json › ${c.id}`, traits: c.traits, nativeTalents: talentsNatifs(c.talents), spawn: () => creatureToCombatant(c, `garde-${c.id}`, ORIGINE) });
  for (const rel of listerProjetsLivres()) {
    const projet = parseProject(lireProjetLivre(rel));
    out.push(...porteursDuNarratif(rel, projet.narratif));
    for (const sc of projet.scenes) out.push(...porteursDeScene(rel, sc));
  }
  for (const s of SCENARIOS) {
    const built = s.construire();
    if (built.narratif) out.push(...porteursDuNarratif(`scénario ${s.id}`, built.narratif));
    for (const sc of [built.scene, ...(built.extraScenes ?? [])]) out.push(...porteursDeScene(`scénario ${s.id}`, sc));
  }
  return out;
}

/** Bornes du NOMBRE d'instances au spawn, lues sur la DONNÉE : indice des traits de mutation (absent = 1)
 *  + Marque. */
function bornesDuNombre(traits: TraitList): [number, number] {
  const fixe = traits.filter((t) => findTraitById(t.id)?.capabilities?.mutationAtSpawn).reduce((n, t) => n + (t.value ?? 1), 0);
  const mark = markMutationsAtSpawn(traits);
  if (!mark) return [fixe, fixe];
  return [fixe + Math.ceil(1 / mark.countDivide), fixe + Math.ceil(mark.countDie / mark.countDivide)];
}

const deLaMutation = (id: string) => (src: { kind: string; id: string } | undefined) => src?.kind === 'mutation' && src.id === id;

function fautesDuPorteur(p: Porteur): string[] {
  const fautes: string[] = [];
  // (a) chaque arg résout ; seul l'arg ABSENT tire.
  for (const s of mutationsAtSpawn(p.traits)) if (s.mutationId && !mutationById(s.mutationId)) fautes.push(`${p.ou} : (a) arg « ${s.mutationId} » irrésolu`);
  let c: Combatant;
  try {
    c = p.spawn();
  } catch (e) {
    return [...fautes, `${p.ou} : le spawn lève (${String(e)})`];
  }
  const mutations = c.mutations ?? [];
  // (b) nombre d'instances = indice.
  const [min, max] = bornesDuNombre(p.traits);
  if (mutations.length < min || mutations.length > max) fautes.push(`${p.ou} : (b) ${mutations.length} mutation(s), attendu ${min === max ? min : `${min}..${max}`}`);
  // (c) chaque acquisition présente UNE fois par instance, avec sa provenance.
  const instances = new Map<string, number>();
  for (const m of mutations) instances.set(m.id, (instances.get(m.id) ?? 0) + 1);
  for (const [id, k] of instances) {
    const m = mutations.find((x) => x.id === id)!;
    const estDeM = deLaMutation(id);
    for (const op of m.passive ?? []) {
      if (op.op === 'grantTrait') {
        const n = (c.traits ?? []).filter((t) => t.id === op.traitId && estDeM(t.src)).length;
        if (n !== k) fautes.push(`${p.ou} : (c) trait « ${op.traitId} » de « ${id} » posé ${n} fois, attendu ${k}`);
      } else if (op.op === 'grantPsychTrait') {
        const n = (c.psychTraits ?? []).filter((t) => t.type === op.psychType && estDeM(t.src)).length;
        if (n !== k) fautes.push(`${p.ou} : (c) trait psy « ${op.psychType} » de « ${id} » posé ${n} fois, attendu ${k}`);
      }
    }
  }
  const acquis = new Map<string, number>();
  for (const m of mutations) for (const ref of m.talentsAcquis ?? []) acquis.set(ref.id, (acquis.get(ref.id) ?? 0) + 1);
  for (const m of mutations) for (const op of m.passive ?? []) {
    if (op.op !== 'grantTalent') continue;
    const natif = p.nativeTalents.filter((t) => t.talentId === op.talent.id).reduce((s, t) => s + t.times, 0);
    const porte = (c.talents ?? []).filter((t) => t.talentId === op.talent.id).reduce((s, t) => s + (t.times ?? 1), 0);
    const attendu = natif + (acquis.get(op.talent.id) ?? 0);
    if (!attendu) fautes.push(`${p.ou} : (c) talent « ${op.talent.id} » ni acquis ni natif`);
    else if (porte !== attendu) fautes.push(`${p.ou} : (c) talent « ${op.talent.id} » porté ${porte} fois, attendu ${attendu} (natif ${natif})`);
  }
  // (d) les armes des traits accordés sont dans `weapons`.
  for (const t of c.traits ?? []) {
    if (t.src?.kind !== 'mutation') continue;
    const w = weaponFromTrait(t);
    if (w && !c.weapons.some((x) => x.label === w.label)) fautes.push(`${p.ou} : (d) arme « ${w.label} » du trait « ${t.id} » absente de weapons`);
  }
  // (e) Blessures dérivées.
  if (c.wounds.max !== effectiveMaxWounds(c)) fautes.push(`${p.ou} : (e) wounds.max ${c.wounds.max} ≠ effectiveMaxWounds ${effectiveMaxWounds(c)}`);
  if (c.wounds.current !== c.wounds.max) fautes.push(`${p.ou} : (e) né à ${c.wounds.current}/${c.wounds.max}`);
  return fautes;
}

beforeEach(() => {
  useGame.setState({ campaignNarratif: null, party: [], scene: null, battle: null });
});

describe('mutations au spawn — garde de propriété sur les statblocs livrés (#1853)', () => {
  const porteurs = tousLesPorteurs();

  it('chaque porteur : arg résolu, nombre = indice, acquisitions uniques et provenancées, armes, Blessures', () => {
    expect(porteurs.length, 'aucun porteur : la propriété serait vraie à vide').toBeGreaterThan(0);
    expect(porteurs.flatMap(fautesDuPorteur)).toEqual([]);
  });

  it('les sources du corpus sont toutes VUES (bestiaire, preset de projet, scénario)', () => {
    expect(porteurs.some((p) => p.ou.startsWith('creatures.json'))).toBe(true);
    expect(porteurs.some((p) => p.ou.includes('-projet.json › preset'))).toBe(true);
    expect(porteurs.some((p) => p.ou.startsWith('scénario '))).toBe(true);
  });

  it('chaque op-kind de mutation est CLASSÉ : couvert, ou reste nommé (#1853 L2/L3)', () => {
    const classes = new Set<string>([...OPS_ACQUISITION, ...OPS_LECTURE_VIVE, ...OPS_RESTE_L2]);
    const kinds = new Set((mutationsJson as { passive?: { op: string }[] }[]).flatMap((m) => (m.passive ?? []).map((o) => o.op)));
    expect([...kinds].filter((k) => !classes.has(k)), `op-kinds hors classement (${RESTE_L3} : #1853 L3)`).toEqual([]);
    const declenches = new Set<string>(OPS_DECLENCHES);
    const kindsDEffet = new Set((mutationsJson as { effects?: unknown }[]).flatMap((m) => opsDe(m.effects)));
    expect([...kindsDEffet].filter((k) => !declenches.has(k)), 'op-kinds d’`effects` hors classement').toEqual([]);
  });

  it('(f) le spawn n’attache jamais deux fois : Knud Cratinx, Écailles épineuses (EDO 02 ; EDO 11 l.192-196)', () => {
    const knud = porteurs.find((p) => p.ou.includes('preset edo-knud-cratinx'))!;
    const c = knud.spawn();
    expect(effectiveChar(c, 'dexterite')).toBe(19);
    expect(effectiveChar(c, 'sociabilite')).toBe(20);
    attachMutation(c, mutationById('ecailles-epineuses-edoc')!, makeRNG(1));
    expect(effectiveChar(c, 'dexterite'), 'contre-épreuve : une seconde attache se verrait').toBe(9);
  });

  it('Mikael, Tête bestiale (Chien) : Morsure, arme Morsure, Sens aiguisé, Int 20 (EDO 02 ; EDO 11)', () => {
    const mikael = porteurs.find((p) => p.ou.includes('preset edo-mutant-mikael'))!;
    const c = mikael.spawn();
    expect(c.traits).toContainEqual({ id: 'morsure', value: 5, src: { kind: 'mutation', id: 'tete-bestiale-chien' } });
    expect(c.weapons.map((w) => w.label)).toContain(weaponFromTrait({ id: 'morsure', value: 5 })!.label);
    expect(c.talents).toContainEqual({ talentId: 'sens-aiguise', spec: 'odorat', times: 1 });
    expect(effectiveChar(c, 'intelligence')).toBe(20);
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
    const args = [...(mutationsJson as { id: string; label: string }[]).flatMap((m) => [m.id, m.label]), 'Cornes', ''];
    for (const traitId of SPAWN_TRAITS) for (const arg of args) {
      const parse = customStatblockSchema.safeParse(statbloc([{ id: traitId, arg }]));
      if (parse.success) expect(() => statblockToCombatant(parse.data as CustomStatblock, 'x', ORIGINE), `${traitId}(${arg})`).not.toThrow();
    }
  });
});

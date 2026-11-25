/**
 * Les porteurs d'une mutation au spawn et la garde de PROPRIÉTÉ de #1853 (`fautesDuPorteur`), jouées par le commun
 * (`spawn-mutations.hors-store.test.ts`) et par chaque projet sur ses paquets. LDB 85 l.245 ; ZI 04 l.118 ; #1853.
 */
import { presetDuNarratif, resolvePresetCreature } from './monde/resolveursDuNarratif';
import { creatureToCombatant, porteurDuProfil, statblockToCombatant } from './monde/spawn';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import type { Scene } from './monde/scene';
import type { CustomStatblock } from '../engine/statblock';
import { creatures, findTalentById, findTraitById } from '../data';
import { mutationById } from '../data/mutations';
import { mutationsAtSpawn, markMutationsAtSpawn } from '../engine/traits/dispatch';
import { effectiveMaxWounds } from '../engine/characteristics';
import { weaponFromTrait } from '../engine/creatureEquip';
import { traitsDuPorteur, type TraitList, type TraitsDesignes } from '../engine/statEntry';
import type { Combatant } from '../engine/types';
import { traitOctroye } from '../engine/psych/opsPsy';

export type Porteur = { ou: string; traits: TraitList; nativeTalents: { talentId: string; times: number }[]; spawn: () => Combatant };

export const SPAWN_TRAITS = new Set(['mutation', 'corruption-mentale', 'marque-de-tzeentch']);
const porteMutation = (traits: TraitsDesignes | undefined): boolean => (traits ?? []).some((t) => SPAWN_TRAITS.has(t.id));
export const ORIGINE = { x: 0, y: 0 };

function talentsNatifs(refs: { id: string; times?: number }[] | undefined): { talentId: string; times: number }[] {
  return (refs ?? []).flatMap((r) => (findTalentById(r.id) ? [{ talentId: r.id, times: r.times ?? 1 }] : []));
}

export function porteursDuNarratif(ou: string, narratif: NarratifBlock): Porteur[] {
  return narratif.presetsPnj.flatMap((preset) => {
    const r = resolvePresetCreature(preset.id, presetDuNarratif(narratif));
    if (!r || !porteMutation(r.creature.traits)) return [];
    const creature = r.creature;
    return [{ ou: `${ou} › preset ${preset.id}`, traits: traitsDuPorteur(creature.traits, porteurDuProfil(preset.id, creature.char)), nativeTalents: talentsNatifs(creature.talents), spawn: () => creatureToCombatant(creature, preset.id, ORIGINE) }];
  });
}

export function porteursDeScene(ou: string, scene: Scene): Porteur[] {
  return scene.entities.flatMap((ent) => {
    const sb = (ent as { statblock?: CustomStatblock }).statblock;
    if (!sb || !porteMutation(sb.traits)) return [];
    return [{ ou: `${ou} › ${scene.id} › ${ent.id}`, traits: traitsDuPorteur(sb.traits ?? [], porteurDuProfil(ent.id, sb.char)), nativeTalents: talentsNatifs(sb.talents), spawn: () => statblockToCombatant(sb, ent.id, ORIGINE, (ent as { appearance?: never }).appearance) }];
  });
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

export function fautesDuPorteur(p: Porteur): string[] {
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
        const attendu = k * (op.cible?.pick ?? 1);
        const n = (c.traits ?? []).filter((t) => t.id === op.trait.id && estDeM(t.src)).length;
        if (n !== attendu) fautes.push(`${p.ou} : (c) trait « ${op.trait.id} » de « ${id} » posé ${n} fois, attendu ${attendu}`);
      } else if (op.op === 'grantPsychTrait') {
        const { type } = traitOctroye(op);
        const n = (c.psychTraits ?? []).filter((t) => t.type === type && estDeM(t.src)).length;
        if (n !== k) fautes.push(`${p.ou} : (c) trait psy « ${type} » de « ${id} » posé ${n} fois, attendu ${k}`);
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
  // (g) un plancher de `charMod` est résolu à l'attache : aucune instance ne le porte (EDO 11 l.190).
  for (const m of mutations) for (const op of m.passive ?? []) {
    if (op.op === 'charMod' && op.min != null) fautes.push(`${p.ou} : (g) charMod « ${op.characteristic} » de « ${m.id} » porte encore son plancher`);
  }
  // (e) Blessures dérivées.
  if (c.wounds.max !== effectiveMaxWounds(c)) fautes.push(`${p.ou} : (e) wounds.max ${c.wounds.max} ≠ effectiveMaxWounds ${effectiveMaxWounds(c)}`);
  if (c.wounds.current !== c.wounds.max) fautes.push(`${p.ou} : (e) né à ${c.wounds.current}/${c.wounds.max}`);
  return fautes;
}


/** Les porteurs du bestiaire (`creatures.json`). */
export function porteursDuBestiaire(): Porteur[] {
  return creatures.filter((c) => porteMutation(c.traits)).map((c) => ({ ou: `creatures.json › ${c.id}`, traits: traitsDuPorteur(c.traits, porteurDuProfil(`garde-${c.id}`, c.char)), nativeTalents: talentsNatifs(c.talents), spawn: () => creatureToCombatant(c, `garde-${c.id}`, ORIGINE) }));
}

/** Les porteurs d'un paquet de scènes : les presets de son narratif et les statblocs de ses scènes. */
export const porteursDuPaquet = (ou: string, paquet: { narratif?: NarratifBlock; scenes: readonly Scene[] }): Porteur[] => [
  ...(paquet.narratif ? porteursDuNarratif(ou, paquet.narratif) : []),
  ...paquet.scenes.flatMap((sc) => porteursDeScene(ou, sc)),
];

/**
 * CONTRAT POSITIF (L2 #1548, commit 4bis) — l'emplacement NON DÉSIGNÉ d'un statbloc
 * (`SkillRef.choix`) est DÉSIGNÉ AU SPAWN : l'instance persistée est CONCRÈTE. Chemin RÉEL, pas un
 * ctx forgé : `creatures.json` → `creatureToCombatant` → `skillsFromBook` → `testValue`.
 *
 * AGENTS.md règle 7 (le RAW confie ce choix au MJ, et il n'y a pas de MJ) : tirage SEEDÉ sur l'uid
 * d'instance, parmi les ids que la donnée BORNE quand elle borne, sinon parmi le POOL de la
 * Compétence. `LDB 09 l.40` (« vous devrez choisir une Spécialisation vous-même »), `LDB 09 l.44`
 * (« chaque Spécialisation étant traitée comme une Compétence unique »).
 */
import { describe, it, expect } from 'vitest';
import { creatureToCombatant } from '../noyau/monde/spawn';
import { creatures, findCreatureById, byId, specPoolOf, skillInstanceLabel } from '../data';
import { testValue, actorHasSkill } from '../engine/skills';
import { knowsCastingSkill } from '../engine/magic';
import { traitCapability } from '../engine/traits/dispatch';

const spawn = (creatureId: string, uid = `${creatureId}-1`) => {
  const c = findCreatureById(creatureId);
  expect(c, `créature « ${creatureId} » absente de creatures.json`).toBeTruthy();
  return creatureToCombatant(c!, uid, { x: 0, y: 0 });
};
const poolDe = (skillId: string) => specPoolOf(byId('skill', skillId)!);

describe('désignation au spawn d’un `choix` de spécialisation (L2 #1548)', () => {
  it('heomreth-hibou-geant : Savoir 80 est porté par UNE spec du pool, désignée (ZI 05 l.393)', () => {
    const c = spawn('heomreth-hibou-geant');
    const savoir = c.skills.filter((s) => s.id === 'savoir');
    expect(savoir).toHaveLength(1);
    const designee = savoir[0].spec;
    expect(poolDe('savoir')).toContain(designee);
    expect(testValue(c, 'savoir', undefined, designee)).toBe(80);
    const autre = poolDe('savoir').find((id) => id !== designee)!;
    expect(testValue(c, 'savoir', undefined, autre)).not.toBe(80); // Compétence UNIQUE par spéc
    expect(skillInstanceLabel(savoir[0])).not.toMatch(/au choix/i);
  });

  it('choix BORNÉ : la désignation reste DANS les ids que la donnée borne', () => {
    const borne = ['armurier', 'forgeron'];
    const fiche = { ...findCreatureById('humain')!, id: 'artisan-borne', skills: [{ id: 'metier', choix: borne, value: 50 }] };
    for (const uid of ['b-1', 'b-2', 'b-3', 'b-4', 'b-5']) {
      const metier = creatureToCombatant(fiche, uid, { x: 0, y: 0 }).skills.filter((s) => s.id === 'metier');
      expect(metier).toHaveLength(1);
      expect(borne).toContain(metier[0].spec);
    }
    const vus = new Set(Array.from({ length: 40 }, (_, i) =>
      creatureToCombatant(fiche, `b-${i}`, { x: 0, y: 0 }).skills.find((s) => s.id === 'metier')!.spec));
    expect([...vus].sort()).toEqual(borne);
  });

  it('DÉTERMINISME : même uid → même désignation ; des uids différents désignent différemment', () => {
    const specOf = (uid: string) => spawn('heomreth-hibou-geant', uid).skills.find((s) => s.id === 'savoir')!.spec;
    expect(specOf('heomreth-a')).toBe(specOf('heomreth-a'));
    const vus = new Set(Array.from({ length: 40 }, (_, i) => specOf(`heomreth-${i}`)));
    expect(vus.size, `40 uids → ${[...vus].join(', ')}`).toBeGreaterThan(1);
  });

  it('Langue à choix : `magick` n’est VRAI que si magick a été RÉELLEMENT désigné (ZI 05 l.370)', () => {
    // L'emplacement ne « répond » plus : `actorHasSkill` suit la spec désignée, jamais le choix ouvert.
    for (const uid of ['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-60']) { // m-60 désigne magick
      const c = spawn('grand-aigle', uid);
      const langues = c.skills.filter((s) => s.id === 'langue').map((s) => s.spec);
      expect(langues.every((sp) => sp != null)).toBe(true);
      expect(actorHasSkill(c, 'langue', 'magick')).toBe(langues.includes('magick'));
    }
  });

  // Balaye tout le bestiaire — et prouve du même coup qu'aucun `choix` n'a un pool VIDE (un spawn qui
  // lève rougirait ici). Les seuls écarts admis entre les deux prédicats sont ceux que
  // `knowsCastingSkill` DÉCLARE : Trait `spellcaster`, et l'exigence d'≥ 1 Augmentation (`LDB 09 l.32`).
  it('CONCORDANCE `actorHasSkill` ⇄ `knowsCastingSkill` sur tout le bestiaire', () => {
    const ecarts: string[] = [];
    for (const cr of creatures) {
      const c = creatureToCombatant(cr, `${cr.id}-cc`, { x: 0, y: 0 });
      const inst = c.skills.find((s) => s.id === 'langue' && s.spec === 'magick');
      if (actorHasSkill(c, 'langue', 'magick') !== (inst != null)) ecarts.push(`${cr.id} : actorHasSkill fantôme`);
      const attendu = traitCapability(c.traits, 'spellcaster') || (inst != null && inst.advances >= 1);
      if (knowsCastingSkill(c, 'langue', 'magick') !== attendu) ecarts.push(`${cr.id} : knowsCastingSkill hors contrat`);
    }
    expect(ecarts, ecarts.join(' | ')).toEqual([]);
  });

  it('AUCUNE instance de spawn ne porte un emplacement non désigné (tout le bestiaire)', () => {
    const restes: string[] = [];
    for (const cr of creatures) {
      for (const s of creatureToCombatant(cr, `${cr.id}-nd`, { x: 0, y: 0 }).skills) {
        if (s.spec != null && /au choix/i.test(s.spec)) restes.push(`${cr.id} : ${s.id}/${s.spec}`);
      }
    }
    expect(restes, restes.join(' | ')).toEqual([]);
  });
});

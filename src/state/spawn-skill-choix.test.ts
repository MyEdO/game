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
  it('citadin : Musicien 35 est porté par UNE spec du pool, désignée', () => {
    const c = spawn('citadin');
    const musicien = c.skills.filter((s) => s.id === 'musicien');
    expect(musicien).toHaveLength(1);
    const designee = musicien[0].spec;
    expect(poolDe('musicien')).toContain(designee);
    expect(testValue(c, 'musicien', undefined, designee)).toBe(35);
    const autre = poolDe('musicien').find((id) => id !== designee)!;
    expect(testValue(c, 'musicien', undefined, autre)).not.toBe(35); // Compétence UNIQUE par spéc
    expect(skillInstanceLabel(musicien[0])).not.toMatch(/au choix/i);
  });

  it('ungor-adulte : la désignation reste DANS les ids bornés par la donnée', () => {
    const c = spawn('ungor-adulte');
    const metier = c.skills.filter((s) => s.id === 'metier');
    expect(metier).toHaveLength(1);
    expect(['armurier', 'forgeron']).toContain(metier[0].spec);
    // 50 IMPRIMÉ + 5 de Doigts de fée ; la spec NON désignée ne reçoit pas les avances de la ligne.
    expect(testValue(c, 'metier', undefined, metier[0].spec)).toBe(55);
    expect(testValue(c, 'metier', undefined, 'tailleur')).toBe(45);
  });

  it('sorcier-du-chaos : la Divinité désignée est un des 3 Dieux Sombres bornés', () => {
    const savoir = spawn('sorcier-du-chaos').skills.filter((s) => s.id === 'savoir');
    expect(savoir.map((s) => s.spec).filter((sp) => ['tzeentch', 'slaanesh', 'nurgle'].includes(sp!))).toHaveLength(1);
  });

  it('DÉTERMINISME : même uid → même désignation ; des uids différents désignent différemment', () => {
    const specOf = (uid: string) => spawn('citadin', uid).skills.find((s) => s.id === 'musicien')!.spec;
    expect(specOf('citadin-a')).toBe(specOf('citadin-a'));
    const vus = new Set(Array.from({ length: 40 }, (_, i) => specOf(`citadin-${i}`)));
    expect(vus.size, `40 uids → ${[...vus].join(', ')}`).toBeGreaterThan(1);
  });

  it('Langue à choix : `magick` n’est VRAI que si magick a été RÉELLEMENT désigné', () => {
    // L'emplacement ne « répond » plus : `actorHasSkill` suit la spec désignée, jamais le choix ouvert.
    for (const uid of ['m-1', 'm-2', 'm-3', 'm-4', 'm-5']) {
      const c = spawn('marchand-services-urbains-frequents-usuels', uid);
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

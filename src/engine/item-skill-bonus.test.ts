/** #51 ; #2967 ; LDB 67 */
import { describe, it, expect } from 'vitest';
import { itemFromTrappingById } from './items';
import { testValue } from './skills';
import type { Combatant, ItemInstance } from './types';

const CHARS = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const besicles = (equipped: boolean): ItemInstance =>
  ({ ...itemFromTrappingById('besicles')!, uid: 'b1', enc: 0, equipped });
const mk = (items: ItemInstance[] = []): Combatant => ({ characteristics: CHARS, skills: [], items } as unknown as Combatant);

describe('#51 — Bésicles : canal passive/skillMod gaté sur le port', () => {
  it('PORTÉE (equipped) : +20 à Perception via testValue', () => {
    expect(testValue(mk([besicles(true)]), 'perception') - testValue(mk(), 'perception')).toBe(20);
  });
  it('PORTÉE (equipped) : +20 au Test de lecture (Langue) via testValue', () => {
    expect(testValue(mk([besicles(true)]), 'langue') - testValue(mk(), 'langue')).toBe(20);
  });
  it('NON portée (equipped:false, ni tenue) : AUCUN bonus (gating RAW « tant que porté »)', () => {
    expect(testValue(mk([besicles(false)]), 'perception')).toBe(30);
    expect(testValue(mk([besicles(false)]), 'langue')).toBe(30);
  });
  it('sans bésicles : Perception = caractéristique nue', () => {
    expect(testValue(mk(), 'perception')).toBe(30);
  });
  it('bésicles PORTÉE n’affecte PAS une Compétence non concernée', () => {
    expect(testValue(mk([besicles(true)]), 'escalade')).toBe(testValue(mk(), 'escalade'));
  });
});

// ── #51 — Outils de crochetage : gate d'OUTIL déclaré en donnée (SkillData.tool) ──
// LDB 09 l.168 : « Les Niveaux de Difficulté supposent l'utilisation d'outils de crochetage. Des
// crochets improvisés, comme des épingles à cheveux ou des clous, peuvent être utilisés avec une
// pénalité de -10. » → sans objet à capability `lockpicks`, −10 au Test de Crochetage. Possession
// NON gatée sur le port (les avoir dans le sac suffit — LDB 67 l.66 : « nécessaire pour utiliser la
// Compétence Crochetage sans pénalité »).
const lockpicks = (destroyed = false): ItemInstance =>
  ({ ...itemFromTrappingById('outils-de-crochetage')!, uid: 'l1', enc: 0, ...(destroyed ? { destroyed: true } : {}) });

describe('#51 — Crochetage : −10 sans outils (SkillData.tool → capability lockpicks)', () => {
  it('sans outils : −10 (crochets improvisés supposés, LDB 09 l.168)', () => {
    expect(testValue(mk(), 'crochetage')).toBe(30 - 10);
  });
  it('outils POSSÉDÉS (même non équipés) : pas de pénalité (LDB 67 l.66)', () => {
    expect(testValue(mk([lockpicks()]), 'crochetage')).toBe(30);
  });
  it('outils DÉTRUITS : la pénalité revient', () => {
    expect(testValue(mk([lockpicks(true)]), 'crochetage')).toBe(20);
  });
  it('le gate ne touche pas les autres Compétences', () => {
    expect(testValue(mk(), 'perception')).toBe(30);
  });
});

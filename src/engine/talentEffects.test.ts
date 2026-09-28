import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import {
  talentCharBonusById,
  applyTalentAcquisition,
  extraWounds,
  heroMaxWounds,
  fortuneMax,
  resolveMax,
  careerSkillAdditions,
  careerTalentAdditions,
  baseWithTalents,
} from './talentEffects';
import { effectiveMovement } from './encumbrance';

const hero = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h',
    name: 'H',
    kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 13, max: 13 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
    fate: 2,
    resilience: 1,
    charAdvances: {},
    ...over,
  }) as unknown as Combatant;

describe('« +5 à votre Caractéristique de départ » (LDB 10 — ne compte pas comme Augmentation)', () => {
  it('mapping addCharacteristic → clé courte pour les 10 talents', () => {
    expect(talentCharBonusById('guerrier-ne')).toBe('capacite-de-combat');
    expect(talentCharBonusById('tireur-de-precision')).toBe('capacite-de-tir');
    expect(talentCharBonusById('tres-fort')).toBe('force');
    expect(talentCharBonusById('tres-resistant')).toBe('endurance');
    expect(talentCharBonusById('vivacite')).toBe('initiative');
    expect(talentCharBonusById('reflexes-foudroyants')).toBe('agilite');
    expect(talentCharBonusById('doigts-de-fee')).toBe('dexterite');
    expect(talentCharBonusById('perspicace')).toBe('intelligence');
    expect(talentCharBonusById('imperturbable')).toBe('force-mentale');
    expect(talentCharBonusById('affable')).toBe('sociabilite');
    expect(talentCharBonusById('baratiner')).toBe(null);
    // addCharacteristic non-Caractéristique (Blessure, Chance…) → pas de +5.
    expect(talentCharBonusById('dur-a-cuire')).toBe(null);
    expect(talentCharBonusById('chanceux')).toBe(null);
  });
  it('applyTalentAcquisition : +5 passif, valeur effective = 35, AUCUNE Augmentation comptée', () => {
    const h = hero({ talents: [{ talentId: 'tres-fort', times: 1 }] });
    applyTalentAcquisition(h, 'tres-fort'); // id stable du Talent — le talent est déjà dans la liste
    // La valeur brute reste 30 (non cuite) ; le passif charMod la porte — baseWithTalents = 35.
    expect(h.characteristics.force).toBe(30); // base INCHANGÉE (passif, plus cuit)
    expect(baseWithTalents(h, 'force')).toBe(35); // base + passif talent = 35
    expect(h.charAdvances?.force ?? 0).toBe(0);
  });
  it('Véloce : +1 Mouvement via passif moveMod (LDB 10)', () => {
    const h = hero({ talents: [{ talentId: 'veloce', times: 1 }] });
    applyTalentAcquisition(h, 'veloce'); // id stable du Talent
    // Le Mouvement brut reste 4 ; le passif moveMod le porte — effectiveMovement = 5.
    expect(h.movement).toBe(4); // base INCHANGÉE (passif, plus muté)
    expect(effectiveMovement(h)).toBe(5); // base + passif moveMod = 5
  });
});

describe('attributs dérivés des talents', () => {
  it('Dur à cuire : +BE Points de Blessure par acquisition (LDB 10)', () => {
    const h = hero({ talents: [{ talentId: 'dur-a-cuire', times: 1 }] });
    expect(extraWounds(h)).toBe(3); // BE 3
    expect(heroMaxWounds(h)).toBe(3 + 2 * 3 + 3 + 3); // BF+2BE+BFM + Dur à cuire
    h.talents[0].times = 2;
    expect(extraWounds(h)).toBe(6);
  });
  it('Chanceux : Chance max = Destin + niveaux (LDB 10)', () => {
    expect(fortuneMax(hero())).toBe(2);
    expect(fortuneMax(hero({ talents: [{ talentId: 'chanceux', times: 2 }] }))).toBe(4);
  });
  it('Obstiné : Détermination max = Résilience + niveaux (LDB 10)', () => {
    expect(resolveMax(hero())).toBe(1);
    expect(resolveMax(hero({ talents: [{ talentId: 'obstine', times: 1 }] }))).toBe(2);
  });
});

describe('« Ajoutez la Compétence X à n\'importe quelle Carrière que vous entamez » (LDB 10)', () => {
  it('Maître artisan (Forgeron) → Métier (Forgeron) ; Sorcier ! → Langue (Magick)', () => {
    const h = hero({
      talents: [
        { talentId: 'maitre-artisan', spec: 'forgeron', times: 1 },
        { talentId: 'sorcier', times: 1 },
        { talentId: 'oreille-absolue', times: 1 },
        { talentId: 'voyageur-aguerri', times: 1 },
        { talentId: 'baratiner', times: 1 }, // sans addSkill → rien
      ],
    });
    // Refs STRUCTURÉES (id, spec) — l'affichage (refLabel/specLabel) se fait au point d'usage, pas ici.
    const adds = careerSkillAdditions(h);
    expect(adds).toContainEqual({ id: 'metier', spec: 'forgeron' }); // spec « Au choix » reportée sur celle du talent
    expect(adds).toContainEqual({ id: 'langue', spec: 'magick' });
    expect(adds).toContainEqual({ id: 'divertissement', spec: 'chant' });
    expect(adds).toContainEqual({ id: 'savoir', spec: 'region' });
    expect(adds).toHaveLength(4);
  });
});

describe('« Le Talent X est ajouté à la liste des Talents de vos Carrières » (LDB 10, op grantCareerTalent)', () => {
  it('Flagellant → Frénésie ajoutée aux carrières ; un talent sans op → rien', () => {
    expect(careerTalentAdditions(hero({ talents: [{ talentId: 'flagellant', times: 1 }] }))).toEqual([{ id: 'frenesie' }]);
    expect(careerTalentAdditions(hero({ talents: [{ talentId: 'baratiner', times: 1 }] }))).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { testValue, partyBest, partyAssisted, skillCharKeyById, bestForSkills, bestForCombined, bestAssistedOption, skillBaseValue, possesses } from './skills';
import { Combatant, SkillInstance } from './types';

const mk = (chars: Partial<Record<string, number>>, skills: { id: string; advances: number; spec?: string }[] = []): Combatant =>
  ({
    kind: 'hero', wounds: { current: 10, max: 10 }, conditions: [],
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, ...chars },
    skills: skills.map((s) => ({ ...s, characteristic: 'dexterite' }) as SkillInstance),
  }) as unknown as Combatant;

describe('skills — testValue / partyBest / skillCharKeyById', () => {
  it('caractéristique fournie → valeur de la caractéristique', () => {
    expect(testValue(mk({ sociabilite: 55 }), undefined, 'sociabilite')).toBe(55);
  });
  it('compétence (inconnue de la base) → repli sur Dextérité + avances de la compétence portée', () => {
    const c = mk({ dexterite: 40 }, [{ id: 'bidouille', advances: 7 }]);
    expect(testValue(c, 'bidouille')).toBe(47);
  });
  it('compétence sans avances → caractéristique de repli seule', () => {
    expect(testValue(mk({ dexterite: 33 }), 'inexistante')).toBe(33);
  });
  it('partyBest renvoie le meilleur membre du groupe', () => {
    const a = mk({ sociabilite: 40 });
    const b = mk({ sociabilite: 60 });
    const c = mk({ sociabilite: 50 });
    expect(partyBest([a, b, c], undefined, 'sociabilite')).toEqual({ actor: b, value: 60 });
  });
  it('partyBest sur groupe vide → null', () => {
    expect(partyBest([], undefined, 'sociabilite')).toBeNull();
  });
  it('partyBest transmet la spécialisation à testValue (bonne instance de Métier)', () => {
    const h = mk({}, [
      { id: 'metier', advances: 10, spec: 'forgeron' },
      { id: 'metier', advances: 40, spec: 'serrurier' },
    ]);
    const forgeron = partyBest([h], 'metier', undefined, undefined, 'forgeron')!;
    const serrurier = partyBest([h], 'metier', undefined, undefined, 'serrurier')!;
    expect(serrurier.value - forgeron.value).toBe(30); // 40 − 10 d'avances, même caractéristique de base
  });
  it('partyAssisted — carac pure : tous soutiennent ; meneur + n×10 plafonné au Bonus de Carac', () => {
    const a = { ...mk({ sociabilite: 40 }), id: 'a' }, b = { ...mk({ sociabilite: 60 }), id: 'b' }, c = { ...mk({ sociabilite: 50 }), id: 'c' };
    const r = partyAssisted([a, b, c], undefined, 'sociabilite')!;
    expect(r.actor.id).toBe('b'); // le plus compétent lance
    // Le détail nomme QUI soutient (`ids`, provenance de la chip « +20 Soutien ») — pas seulement combien.
    expect(r.support).toEqual({ count: 2, bonus: 20, ids: ['a', 'c'] }); // 2 soutiens × 10 (plafond BSoc 6)
    expect(r.value).toBe(80); // 60 + 20
  });
  // (escamotage : compétence avancée Dex SANS gate d'outil — le −10 « sans outils de crochetage »
  //  de Crochetage (SkillData.tool, LDB 09 l.168) est testé à part dans item-skill-bonus.test.)
  it('testValue transmet `sense` à traumaSkillPenalty — Surdité restreinte aux Tests auditifs (LDB 18)', () => {
    const deaf = (): Combatant => ({
      ...mk({ initiative: 40 }),
      traumas: [{ label: 'Surdité', traumaId: 'surdite', location: 'tete', ops: [{ op: 'skillMod', skill: { id: 'perception' }, mod: -20, sense: 'ouie' }] }],
    } as Combatant);
    expect(testValue(deaf(), 'perception')).toBe(20); // sens inconnu : pénalité appliquée par défaut
    expect(testValue(deaf(), 'perception', undefined, undefined, 'ouie')).toBe(20); // Test auditif : pénalisé
    expect(testValue(deaf(), 'perception', undefined, undefined, 'vue')).toBe(40); // Test visuel : exempté
  });
  it('partyAssisted — compétence : seuls les membres QUI LA POSSÈDENT soutiennent', () => {
    const a = { ...mk({ dexterite: 50 }, [{ id: 'escamotage', advances: 20 }]), id: 'a' }; // 70, possède
    const b = { ...mk({ dexterite: 30 }), id: 'b' }; // ne possède pas → ne soutient pas
    const c = { ...mk({ dexterite: 40 }, [{ id: 'escamotage', advances: 5 }]), id: 'c' }; // 45, possède
    const r = partyAssisted([a, b, c], 'escamotage')!;
    expect(r.actor.id).toBe('a');
    expect(r.support.count).toBe(1); // seul c soutient
    expect(r.value).toBe(80); // 70 + 10
  });
  it('partyAssisted — plafonne au Bonus de Caractéristique du meneur', () => {
    const lead = { ...mk({ dexterite: 20 }, [{ id: 'escamotage', advances: 30 }]), id: 'L' }; // 50, BDex 2
    const helpers = [1, 2, 3, 4].map((n) => ({ ...mk({ dexterite: 10 }, [{ id: 'escamotage', advances: 1 }]), id: 'h' + n }));
    const r = partyAssisted([lead, ...helpers], 'escamotage')!;
    expect(r.support.count).toBe(2); // 4 aptes, plafond BDex 2
    // Le plafond RETIENT les premiers éligibles : la provenance affichée compte autant de noms que de crans.
    expect(r.support.ids).toEqual(['h1', 'h2']);
    expect(r.value).toBe(70); // 50 + 20
  });
  it('partyAssisted — un membre à 0 Augmentation ne soutient PAS (LDB 12 l.195)', () => {
    const lead = { ...mk({ dexterite: 50 }, [{ id: 'escamotage', advances: 20 }]), id: 'L' }; // 70
    const novice = { ...mk({ dexterite: 40 }, [{ id: 'escamotage', advances: 0 }]), id: 'n' }; // 0 Augmentation
    const r = partyAssisted([lead, novice], 'escamotage')!;
    expect(r.actor.id).toBe('L');
    expect(r.support).toEqual({ count: 0, bonus: 0, ids: [] });
    expect(r.value).toBe(70); // aucun +10
  });
  it('partyAssisted — spec ciblée : l’Augmentation compte DANS cette spécialisation (l.195)', () => {
    const lead = { ...mk({ dexterite: 40 }, [{ id: 'metier', advances: 30, spec: 'serrurier' }]), id: 'L' }; // 70
    const autre = { ...mk({ dexterite: 40 }, [{ id: 'metier', advances: 20, spec: 'forgeron' }, { id: 'metier', advances: 0, spec: 'serrurier' }]), id: 'a' };
    const r = partyAssisted([lead, autre], 'metier', undefined, undefined, 'serrurier')!;
    expect(r.support).toEqual({ count: 0, bonus: 0, ids: [] });
  });
  it('soutienBonus/partyAssisted — filtre `eligible` (adjacence, LDB 12 l.196) exclut un membre capable écarté', () => {
    const a = { ...mk({ dexterite: 50 }, [{ id: 'escamotage', advances: 20 }]), id: 'a' }; // 70, possède
    const b = { ...mk({ dexterite: 40 }, [{ id: 'escamotage', advances: 10 }]), id: 'b' }; // possède, mais écarté (non adjacent)
    const c = { ...mk({ dexterite: 40 }, [{ id: 'escamotage', advances: 5 }]), id: 'c' }; // possède, éligible
    const eligible = (x: Combatant) => x.id !== 'b';
    const r = partyAssisted([a, b, c], 'escamotage', undefined, undefined, undefined, eligible)!;
    expect(r.actor.id).toBe('a');
    expect(r.support.count).toBe(1); // seul c compte (b écarté par `eligible`)
    expect(r.value).toBe(80); // 70 + 10
  });
  it('soutienBonus — `eligible` absent (défaut) : comportement INCHANGÉ, tous les capables comptent', () => {
    const a = { ...mk({ dexterite: 50 }, [{ id: 'escamotage', advances: 20 }]), id: 'a' };
    const b = { ...mk({ dexterite: 40 }, [{ id: 'escamotage', advances: 10 }]), id: 'b' };
    const r = partyAssisted([a, b], 'escamotage')!;
    expect(r.support.count).toBe(1);
  });
  it('skillCharKeyById : compétence inconnue → undefined', () => {
    expect(skillCharKeyById('competence-totalement-imaginaire')).toBeUndefined();
  });
});

describe('bestForSkills — meilleur PJ pour des compétences AU CHOIX', () => {
  it('prend l’ACTEUR et l’option qui maximisent la valeur (spec-aware)', () => {
    const a = { ...mk({ dexterite: 30 }, [{ id: 'discretion', advances: 50 }]), id: 'a' }; // discr 80, perc 30
    const b = { ...mk({ initiative: 45 }, [{ id: 'perception', advances: 20 }]), id: 'b' }; // perc 65, discr 30
    const r = bestForSkills([a, b], [{ id: 'discretion' }, { id: 'perception' }], undefined)!;
    expect(r.actor.id).toBe('a'); // 80 (Discrétion) est la plus haute de toutes les combinaisons acteur×option
    expect(r.skillId).toBe('discretion');
    expect(r.value).toBe(80);
  });
  it('skills vide/absent → chemin de PURE Caractéristique (skillId indéfini)', () => {
    const a = { ...mk({ 'force-mentale': 40 }), id: 'a' }, b = { ...mk({ 'force-mentale': 55 }), id: 'b' };
    const r = bestForSkills([a, b], undefined, 'force-mentale')!;
    expect(r.actor.id).toBe('b');
    expect(r.value).toBe(55);
    expect(r.skillId).toBeUndefined();
    expect(r.spec).toBeUndefined();
  });
  it('groupe vide → null', () => {
    expect(bestForSkills([], [{ id: 'perception' }], undefined)).toBeNull();
  });
});

describe('bestAssistedOption — Scène à compétences AU CHOIX résolue en Soutien (ADE II 8)', () => {
  it('un seul PJ (pas de soutien) → valeur == bestForSkills (aucun +10)', () => {
    const a = { ...mk({ dexterite: 30 }, [{ id: 'discretion', advances: 50 }]), id: 'a' }; // discr 80
    const solo = bestAssistedOption([a], [{ id: 'discretion' }, { id: 'perception' }], undefined)!;
    const ref = bestForSkills([a], [{ id: 'discretion' }, { id: 'perception' }], undefined)!;
    expect(solo.value).toBe(ref.value);        // 80, aucun soutien
    expect(solo.skillId).toBe('discretion');
    expect(solo.support).toEqual({ count: 0, bonus: 0, ids: [] });
  });
  it('N PJ AVANCÉS dans la compétence → valeur = meneur + 10×assistants (plafonné BCarac)', () => {
    // Meneur Discrétion 60 (BDex 3) ; deux autres y ont des Augmentations → +20 (sous le plafond 3).
    const lead = { ...mk({ dexterite: 30 }, [{ id: 'discretion', advances: 30 }]), id: 'L' }; // 60, BDex 3
    const h1 = { ...mk({ dexterite: 30 }, [{ id: 'discretion', advances: 5 }]), id: 'h1' };
    const h2 = { ...mk({ dexterite: 30 }, [{ id: 'discretion', advances: 1 }]), id: 'h2' };
    const r = bestAssistedOption([lead, h1, h2], [{ id: 'discretion' }], undefined)!;
    expect(r.actor.id).toBe('L');
    expect(r.support).toEqual({ count: 2, bonus: 20, ids: ['h1', 'h2'] });
    expect(r.value).toBe(80); // 60 + 20
  });
  it('un PJ à 0 Augmentation dans l’option retenue ne soutient pas (LDB 12 l.195)', () => {
    const lead = { ...mk({ dexterite: 30 }, [{ id: 'discretion', advances: 30 }]), id: 'L' }; // 60
    const novice = { ...mk({ dexterite: 30 }, [{ id: 'discretion', advances: 0 }]), id: 'n' };
    const r = bestAssistedOption([lead, novice], [{ id: 'discretion' }], undefined)!;
    expect(r.support).toEqual({ count: 0, bonus: 0, ids: [] });
    expect(r.value).toBe(60);
  });
  it('équipage vide → null', () => {
    expect(bestAssistedOption([], [{ id: 'perception' }], undefined)).toBeNull();
  });
});

describe('bestForCombined — Test COMBINÉ : facteur limitant le plus élevé', () => {
  it('choisit l’acteur maximisant min(v1,v2) (le maillon faible)', () => {
    // a : 70/40 → min 40 ; b : 50/50 → min 50 (meilleur maillon faible) ; c : 90/20 → min 20.
    const a = { ...mk({ dexterite: 30 }, [{ id: 'discretion', advances: 40 }, { id: 'perception', advances: 10 }]), id: 'a' };
    const b = { ...mk({ dexterite: 30 }, [{ id: 'discretion', advances: 20 }, { id: 'perception', advances: 20 }]), id: 'b' };
    const c = { ...mk({ dexterite: 30 }, [{ id: 'discretion', advances: 60 }, { id: 'perception', advances: 0 }]), id: 'c' };
    const r = bestForCombined([a, b, c], { id: 'discretion' }, { id: 'perception' }, undefined)!;
    expect(r.actor.id).toBe('b');
    expect(r.value1).toBe(50);
    expect(r.value2).toBe(50);
  });
  it('groupe vide → null', () => {
    expect(bestForCombined([], { id: 'discretion' }, { id: 'perception' }, undefined)).toBeNull();
  });
});

/** Marin à Agilité 40 dont les Voiles se testent sur l'Agilité. */
const marin = (skills: { id: string; advances: number; spec?: string }[]): Combatant => {
  const c = mk({ agilite: 40 });
  return { ...c, skills: skills.map((s) => ({ ...s, characteristic: 'agilite' }) as SkillInstance) } as Combatant;
};

describe('Spécialisation de Voile du navire (LDB 09 l.30, l.571 ; MDG 13 l.18)', () => {
  const caravelle = marin([{ id: 'voile', spec: 'caravelle', advances: 20 }]);
  const chaland = marin([{ id: 'voile', spec: 'chaland', advances: 15 }]);
  const sansVoile = marin([]);
  const sansAugmentation = marin([{ id: 'voile', spec: 'caravelle', advances: 0 }]);

  it('la Spécialisation sœur se teste sur la Caractéristique nue ; la sienne, avec ses Augmentations', () => {
    expect(skillBaseValue(caravelle, 'voile', 'chaland')).toBe(40);
    expect(testValue(caravelle, 'voile', undefined, 'chaland')).toBe(40);
    expect(skillBaseValue(caravelle, 'voile', 'caravelle')).toBe(60);
  });

  it('une Augmentation de Voile, quelle que soit sa Spécialisation, ouvre le Test ; sans elle, il ne se tente pas', () => {
    expect(possesses(caravelle, 'voile', 'chaland')).toBe(true);
    expect(possesses(sansVoile, 'voile', 'chaland')).toBe(false);
    expect(possesses(sansAugmentation, 'voile', 'chaland')).toBe(false);
  });

  it('le barreur se choisit sur la Spécialisation du navire, sans Soutien de la sœur (LDB 12 l.195)', () => {
    const surChaland = partyAssisted([caravelle, chaland], 'voile', undefined, undefined, 'chaland')!;
    expect([surChaland.actor, surChaland.value, surChaland.support.count]).toEqual([chaland, 55, 0]);
    const surCaravelle = partyAssisted([caravelle, chaland], 'voile', undefined, undefined, 'caravelle')!;
    expect([surCaravelle.actor, surCaravelle.value]).toEqual([caravelle, 60]);
    expect(partyAssisted([sansVoile], 'voile', undefined, undefined, 'chaland')).toBeNull();
  });
});

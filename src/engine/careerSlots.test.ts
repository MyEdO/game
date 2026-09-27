import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import {
  splitTopLevelOu,
  parseEntry,
  parseOption,
  isUnresolvedChoice,
  skillSlots,
  talentSlots,
  availableChars,
  inCareerStatus,
  slotCovers,
  designateSlot,
  designationsFor,
  freeSlotFor,
  talentMaxById,
  talentMaxReached,
  heldArcaneDomains,
  arcaneDomainCap,
  arcaneDomainGate,
  wildcardSpecs,
  parseAdvancement,
  prisParLesAutres,
} from './careerSlots';
import { CareerLevelData, levelsForCareer, specLabel } from '../data';

/** Fixtures : libellés d'avancement → `AdvancementRef[]` (la donnée est structurée). */
const A = (xs: string[]) => xs.map(parseAdvancement);

const hero = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h',
    name: 'H',
    kind: 'hero',
    career: 'C1',
    careerLevel: 1,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
    ...over,
  }) as unknown as Combatant;

describe('parsing des entrées de carrière (LDB 09 l.38 / pièges de données)', () => {
  it('splitTopLevelOu : coupe hors parenthèses uniquement', () => {
    expect(splitTopLevelOu('Perspicace ou Affable')).toEqual(['Perspicace', 'Affable']);
    expect(splitTopLevelOu('Savoir-vivre (Criminel ou Guilde)')).toEqual(['Savoir-vivre (Criminel ou Guilde)']);
    expect(splitTopLevelOu('Lire/Écrire ou Savoir-vivre (Érudits ou Nobles)')).toEqual(['Lire/Écrire', 'Savoir-vivre (Érudits ou Nobles)']);
    expect(splitTopLevelOu('Criminel ou Savoir-vivre (Criminel ou Guilde)')).toEqual(['Criminel', 'Savoir-vivre (Criminel ou Guilde)']);
  });
  it('parseOption : explicite / joker / joker restreint', () => {
    expect(parseOption('Sens aiguisé (Vue)')).toEqual({ label: 'Sens aiguisé', spec: 'Vue', wildcard: false });
    expect(parseOption('Savoir (Au choix)')).toEqual({ label: 'Savoir', wildcard: true });
    expect(parseOption('Métier (un au choix)')).toEqual({ label: 'Métier', wildcard: true });
    expect(parseOption('Corps à corps (Fléau ou À deux mains)')).toEqual({
      label: 'Corps à corps',
      wildcard: true,
      specOptions: ['Fléau', 'À deux mains'],
    });
  });
  it('parseEntry : « A ou B » de premier niveau (Guide fluvial ou Bonnes jambes)', () => {
    const options = parseEntry('Guide fluvial ou Bonnes jambes');
    expect(options).toHaveLength(2);
    expect(options[0].label).toBe('Guide fluvial');
    expect(options[1].label).toBe('Bonnes jambes');
  });
  it('isUnresolvedChoice', () => {
    expect(isUnresolvedChoice('Savoir (Au choix)')).toBe(true);
    expect(isUnresolvedChoice('Sens aiguisé (Goût ou Toucher)')).toBe(true);
    expect(isUnresolvedChoice('Sens aiguisé (Goût)')).toBe(false);
    expect(isUnresolvedChoice('Baratiner')).toBe(false);
  });
});

// Carrière factice C1 : « Sens aiguisé (Au choix) » aux niveaux 1 ET 2 (comme Érudit avec
// Savoir) — le scénario complet de désignation se joue dessus.
const C1: CareerLevelData[] = [
  {
    id: 'C1-1', type: 'careerLevels', label: 'N1', career: 'C1', level: 1,
    skills: A(['Charme', 'Savoir (Au choix)']),
    talents: [{ id: 'sens-aiguise', choix: true }, { id: 'baratiner' }],
    trappings: [], characteristics: ['force', 'endurance', 'sociabilite'], status: 'Bronze 1',
  },
  {
    id: 'C1-2', type: 'careerLevels', label: 'N2', career: 'C1', level: 2,
    skills: A(['Ragot', 'Savoir (Au choix)']),
    talents: [{ id: 'sens-aiguise', choix: true }, { id: 'sociable' }],
    trappings: [], characteristics: ['agilite'], status: 'Bronze 2',
  },
];

describe('disponibilité par niveaux (LDB 07 l.43/76/103)', () => {
  it('skillSlots : cumul des niveaux ≤ courant ; talentSlots : niveau courant seul', () => {
    expect(skillSlots(C1, 1).map((s) => s.entry)).toEqual(['Charme', 'Savoir (Au choix)']);
    expect(skillSlots(C1, 2).map((s) => s.entry)).toEqual(['Charme', 'Savoir (Au choix)', 'Ragot', 'Savoir (Au choix)']);
    expect(talentSlots(C1, 2).map((s) => s.entry)).toEqual(['Sens aiguisé (Au choix)', 'Sociable']);
    expect(availableChars(C1, 2)).toEqual(['force', 'endurance', 'sociabilite', 'agilite']);
  });
});

describe('scénario complet : Sens aiguisé espèce + emplacements « (Au choix) » par carrière', () => {
  // Les Talents de `C1` sont des références STRUCTURÉES par id (`sens-aiguise`, specs `gout`/`ouie`…) :
  // la couverture d'un joker juge la spec contre le catalogue de l'entrée (`slotCovers`).
  it('1) désignation GRATUITE de la spec déjà possédée → in-carrière, montable (200 PX au ×2)', () => {
    const h = hero({ talents: [{ talentId: 'sens-aiguise', spec: 'gout', times: 1 }] });
    const slots1 = talentSlots(C1, 1);
    // Avant désignation : le slot libre couvre Goût.
    expect(inCareerStatus(slots1, {}, 'sens-aiguise', 'gout')).toBe('free');
    const slot = freeSlotFor(slots1, {}, 'sens-aiguise', 'gout')!;
    expect(designateSlot(h, 'C1', slot, 'sens-aiguise', 'gout', slots1).ok).toBe(true);
    expect(inCareerStatus(slots1, designationsFor(h, 'C1'), 'sens-aiguise', 'gout')).toBe('designated');
    // Une AUTRE spec n'est plus couverte par ce slot (désigné).
    expect(inCareerStatus(slots1, designationsFor(h, 'C1'), 'sens-aiguise', 'ouie')).toBe(null);
  });

  it('2) au niveau 2, le NOUVEAU slot peut désigner la spec prise au niveau 1 (LDB 08 l.140)', () => {
    const h = hero({ careerLevel: 2, talents: [{ talentId: 'sens-aiguise', spec: 'gout', times: 1 }, { talentId: 'sens-aiguise', spec: 'ouie', times: 1 }] });
    const slots1 = talentSlots(C1, 1);
    const slots2 = talentSlots(C1, 2);
    const all = [...slots1, ...slots2];
    // Niveau 1 : Ouïe avait été désignée (achat à 100 PX à l'époque).
    designateSlot(h, 'C1', slots1[0], 'sens-aiguise', 'ouie', all);
    const des = designationsFor(h, 'C1');
    // L'exclusion ne porte que sur les emplacements du MÊME niveau : Ouïe reste libre au niveau 2.
    expect(inCareerStatus(slots2, des, 'sens-aiguise', 'ouie', all)).toBe('free');
    expect(inCareerStatus(slots2, des, 'sens-aiguise', 'toucher', all)).toBe('free');
    expect(designateSlot(h, 'C1', slots2[0], 'sens-aiguise', 'ouie', all).ok).toBe(true);
  });

  it('3) changement de carrière : les désignations sont PAR carrière — tout sens redevient désignable', () => {
    const h = hero({ talents: [{ talentId: 'sens-aiguise', spec: 'gout', times: 1 }, { talentId: 'sens-aiguise', spec: 'ouie', times: 1 }] });
    const slots1 = talentSlots(C1, 1);
    designateSlot(h, 'C1', slots1[0], 'sens-aiguise', 'ouie', slots1);
    // Carrière C2 (autre carrière, même type de slot) : aucune désignation → tout est libre.
    const C2: CareerLevelData[] = [{ ...C1[0], id: 'C2-1', career: 'C2' }];
    const slots = talentSlots(C2, 1);
    const des = designationsFor(h, 'C2');
    expect(des).toEqual({});
    for (const spec of ['gout', 'ouie', 'toucher']) {
      expect(inCareerStatus(slots, des, 'sens-aiguise', spec)).toBe('free');
    }
  });

  it('4) un slot ne peut pas désigner le libellé d\'une entrée EXPLICITE de la même carrière', () => {
    const LV: CareerLevelData[] = [{
      ...C1[0],
      talents: [{ id: 'sens-aiguise', spec: 'vue' }, { id: 'sens-aiguise', choix: true }],
    }];
    const h = hero();
    const slots = talentSlots(LV, 1);
    expect(designateSlot(h, 'C1', slots[1], 'sens-aiguise', 'vue', slots).ok).toBe(false);
    expect(designateSlot(h, 'C1', slots[1], 'sens-aiguise', 'odorat', slots).ok).toBe(true);
  });

  it('5) joker RESTREINT « (Goût ou Toucher) » : limité à la liste', () => {
    const LV: CareerLevelData[] = [{ ...C1[0], talents: [{ id: 'sens-aiguise', choix: ['gout', 'toucher'] }] }];
    const slots = talentSlots(LV, 1);
    expect(inCareerStatus(slots, {}, 'sens-aiguise', 'gout')).toBe('free');
    expect(inCareerStatus(slots, {}, 'sens-aiguise', 'vue')).toBe(null);
  });
});

describe('Maxi des Talents (LDB 10 « Schéma des Talents »)', () => {
  it('Maxi 1 (Lire/Écrire) : atteint dès la 1re acquisition', () => {
    const h = hero({ talents: [{ talentId: 'lire-ecrire', times: 1 }] });
    expect(talentMaxById(h, 'lire-ecrire')).toBe(1);
    expect(talentMaxReached(h, 'lire-ecrire')).toBe(true);
    expect(talentMaxReached(h, 'baratiner')).toBe(false);
  });
  it('Maxi « Bonus de Caractéristique » : par spécialisation, recalculé sur la valeur courante', () => {
    // Sens aiguisé : Maxi = Bonus d'Initiative (I 30 → 3).
    const h = hero({ talents: [{ talentId: 'sens-aiguise', spec: 'gout', times: 3 }, { talentId: 'sens-aiguise', spec: 'ouie', times: 1 }] });
    expect(talentMaxById(h, 'sens-aiguise')).toBe(3);
    expect(talentMaxReached(h, 'sens-aiguise', 'gout')).toBe(true);
    expect(talentMaxReached(h, 'sens-aiguise', 'ouie')).toBe(false); // spec distincte
  });
});

describe('désignation d\'un emplacement de Groupe d\'arme par specId (données réelles, Phase 3 weapon-groups)', () => {
  it('Gladiateur N2 « Corps à corps (Fléau ou À deux mains) » : désigne par specId réel, affichage via specLabel', () => {
    const levels = levelsForCareer('gladiateur');
    const sSlots = skillSlots(levels, 2);
    const slot = sSlots.find((s) => s.level === 2 && s.options[0]?.optionId === 'corps-a-corps' && s.options[0]?.specOptions)!;
    expect(slot).toBeTruthy();
    expect(slot.options[0].specOptions).toEqual(['fleau', 'deux-mains']); // specs = ids de Groupe d'arme, pas des libellés FR
    const h = hero({ career: 'gladiateur', careerLevel: 2 });
    // Désignation par (optionId, specId) — jamais un libellé reparsé.
    expect(designateSlot(h, 'gladiateur', slot, 'corps-a-corps', 'deux-mains', sSlots).ok).toBe(true);
    expect(inCareerStatus(sSlots, designationsFor(h, 'gladiateur'), 'corps-a-corps', 'deux-mains')).toBe('designated');
    // L'affichage résout l'id de Groupe d'arme en libellé FR (jamais l'id brut à l'écran).
    expect(specLabel('skills', 'corps-a-corps', 'deux-mains')).toBe('Deux-mains');
  });
});

describe('un emplacement « (Au choix) » se désigne par une spécialisation (LDB 10 l.17)', () => {
  const tSlots = talentSlots(levelsForCareer('pretre'), 1);
  const beni = tSlots.find((s) => s.options.some((o) => o.optionId === 'beni' && o.wildcard))!;
  it('Béni (Au choix) du Prêtre : couvert par une spécialisation, jamais nu', () => {
    expect(beni, 'Prêtre N1 porte « Béni (Au choix) »').toBeDefined();
    expect(slotCovers(beni, 'beni', undefined)).toBe(false);
    expect(slotCovers(beni, 'beni', 'sigmar')).toBe(true);
  });
  it('une désignation « beni » nue déjà persistée n\'est pas lue : l\'emplacement redevient à désigner', () => {
    const h = hero({ career: 'pretre', careerSlotChoices: { pretre: { [beni.key]: 'beni' } } });
    expect(designationsFor(h, 'pretre')).toEqual({});
    expect(inCareerStatus(tSlots, designationsFor(h, 'pretre'), 'beni', undefined)).toBeNull();
    expect(freeSlotFor(tSlots, designationsFor(h, 'pretre'), 'beni', 'sigmar')).toBe(beni);
    expect(designateSlot(h, 'pretre', beni, 'beni', 'sigmar', tSlots).ok).toBe(true);
    expect(h.careerSlotChoices?.pretre).toEqual({ [beni.key]: 'beni|sigmar' });
  });
  it('Béni du Prêtre (catalogue FERMÉ) : la sentinelle et une spécialisation hors pool ne couvrent pas', () => {
    expect(slotCovers(beni, 'beni', 'Au choix')).toBe(false);
    expect(slotCovers(beni, 'beni', 'zzz-inexistant')).toBe(false);
  });
  it('un joker de Compétence (spécialisations OUVERTES) est couvert par un texte libre, jamais par la sentinelle', () => {
    const savoir = skillSlots(levelsForCareer('enqueteur'), 3).find((s) => s.options.some((o) => o.optionId === 'savoir' && o.wildcard))!;
    expect(savoir, 'Enquêteur N3 porte « Savoir (Au choix) »').toBeDefined();
    expect(slotCovers(savoir, 'savoir', 'une-specialisation-creee')).toBe(true);
    expect(slotCovers(savoir, 'savoir', 'Au choix')).toBe(false);
  });
  it('un joker de Compétence au catalogue FERMÉ (`specsOpen` absent de l’entrée) n’est couvert que par son pool', () => {
    const cac = skillSlots(levelsForCareer('milicien'), 1).find((s) => s.options.some((o) => o.optionId === 'corps-a-corps' && o.wildcard))!;
    expect(cac, 'Milicien N1 porte « Corps à corps (Au choix) »').toBeDefined();
    expect(slotCovers(cac, 'corps-a-corps', 'une-specialisation-creee')).toBe(false);
    expect(slotCovers(cac, 'corps-a-corps', 'escrime')).toBe(true);
  });
  it('un joker de Talent à entrée OUVERTE (`specsOpen` de l’entrée) est couvert par un texte libre, jamais par la sentinelle', () => {
    const savant = talentSlots(levelsForCareer('erudit'), 3).find((s) => s.options.some((o) => o.optionId === 'savant' && o.wildcard))!;
    expect(savant, 'Érudit N3 porte « Savant (Au choix) »').toBeDefined();
    expect(slotCovers(savant, 'savant', 'une-specialisation-creee')).toBe(true);
    expect(slotCovers(savant, 'savant', 'Au choix')).toBe(false);
  });
  it('freeSlotFor / designateSlot refusent Béni nu', () => {
    expect(freeSlotFor(tSlots, {}, 'beni', undefined)).toBeUndefined();
    const h = hero({ career: 'pretre' });
    expect(designateSlot(h, 'pretre', beni, 'beni', undefined, tSlots).ok).toBe(false);
    expect(designationsFor(h, 'pretre')).toEqual({});
  });
});

describe('wildcardSpecs — pool d’un joker (SOURCE UNIQUE créateur + avancement)', () => {
  const joker = (optionId: string, specOptions?: string[]) => ({ optionId, ...(specOptions ? { specOptions } : {}) });
  it('Béni → cultes du registre (ids ; dont les dieux gnomes NADJ)', () => {
    const s = wildcardSpecs(joker('beni'), 'talent');
    expect(s).toContain('sigmar');
    expect(s).toContain('evawn');
  });
  it('Magie des Arcanes → ids de domaine (specs id-based, data-driven)', () => {
    expect(wildcardSpecs(joker('magie-des-arcanes'), 'talent')).toEqual(expect.arrayContaining(['feu', 'ombres', 'metal']));
  });
  it('Magie du Chaos → ids nurgle / slaanesh / tzeentch', () => {
    expect(wildcardSpecs(joker('magie-du-chaos'), 'talent').sort()).toEqual(['nurgle', 'slaanesh', 'tzeentch']);
  });
  it('Invocation → cultes (ids)', () => {
    expect(wildcardSpecs(joker('invocation'), 'talent')).toContain('sigmar');
  });
  it('id absent du catalogue → []', () => {
    expect(wildcardSpecs(joker('inexistant-xyz'), 'skill')).toEqual([]);
  });
  it('liste restreinte « (A ou B) » : prime sur le pool de la def', () => {
    expect(wildcardSpecs(joker('beni', ['sigmar']), 'talent')).toEqual(['sigmar']);
  });
});

describe('Domaines magiques multiples (Talent Magie des Arcanes — VDM 02 l.190-192 / LDB 46 l.177)', () => {
  const domainTalent = (spec: string, times = 1) => ({ talentId: 'magie-des-arcanes', spec, times });
  // 8 sorts RÉELS du Domaine du Feu (spells.json), pour satisfaire « appris 8 Sorts du Domaine précédent ».
  const FEU_SPELLS = ['cauteriser', 'coeurs-ardents', 'couronne-de-flammes', 'grands-feux-d-u-zhul', 'l-egide-d-aqshy', 'l-epee-ardente-de-rhuin', 'mur-de-feu', 'purification'];

  it('heldArcaneDomains : sépare Domaine(s) sombre(s) (Nécromancie/Démonologie) des autres', () => {
    const h = hero({ talents: [domainTalent('feu'), domainTalent('necromancie')] });
    expect(heldArcaneDomains(h)).toEqual({ normal: ['feu'], dark: ['necromancie'] });
  });

  it('arcaneDomainCap : 1 hors elfe, Bonus de Force Mentale pour un lanceur elfe (SpeciesData.arcaneDomainsBonusOf)', () => {
    const human = hero();
    expect(arcaneDomainCap(human)).toBe(1);
    const elf = hero({ species: 'hauts-elfes', characteristics: { ...human.characteristics, 'force-mentale': 42 } });
    expect(arcaneDomainCap(elf)).toBe(4); // Bonus FM 42 → 4
  });

  it('1er Domaine non sombre : toujours autorisé (aucun plafond franchi)', () => {
    expect(arcaneDomainGate(hero(), 'feu').ok).toBe(true);
  });

  it('REFUSÉ : un lanceur non-elfe ne peut pas apprendre un 2e Domaine non sombre (plafond 1)', () => {
    const h = hero({ talents: [domainTalent('feu')] });
    const gate = arcaneDomainGate(h, 'metal');
    expect(gate.ok).toBe(false);
    expect(gate.reason).toMatch(/plafond/);
  });

  it('REFUSÉ : un lanceur elfe sous le plafond mais Domaine précédent pas assez maîtrisé', () => {
    const h = hero({
      species: 'hauts-elfes',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 42, sociabilite: 30 },
      talents: [domainTalent('feu')],
      skills: [{ id: 'focalisation', spec: 'feu', characteristic: 'force-mentale', advances: 5 }],
    });
    const gate = arcaneDomainGate(h, 'metal');
    expect(gate.ok).toBe(false);
    expect(gate.reason).toMatch(/Domaine précédent.*Feu.*5\/20.*0\/8/);
  });

  it('AUTORISÉ : le même lanceur elfe, Domaine précédent MAÎTRISÉ (20 Améliorations Focalisation + 8 Sorts)', () => {
    const h = hero({
      species: 'hauts-elfes',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 42, sociabilite: 30 },
      talents: [domainTalent('feu')],
      skills: [{ id: 'focalisation', spec: 'feu', characteristic: 'force-mentale', advances: 20 }],
      spells: FEU_SPELLS,
    });
    expect(arcaneDomainGate(h, 'metal').ok).toBe(true);
  });

  it('Domaine sombre : autorisé EN PLUS d\'un Domaine non sombre, même hors carrière elfe (l.192)', () => {
    const h = hero({ talents: [domainTalent('feu')] });
    expect(arcaneDomainGate(h, 'necromancie').ok).toBe(true);
  });

  it('REFUSÉ : un Domaine sombre ne peut pas être le PREMIER Domaine appris (LDB 46 l.177 : « en plus d\'un autre Domaine »)', () => {
    const gate = arcaneDomainGate(hero(), 'necromancie');
    expect(gate.ok).toBe(false);
    expect(gate.reason).toMatch(/en plus d.un autre Domaine/);
  });

  it('REFUSÉ : un 2e Domaine sombre (un seul autorisé)', () => {
    const h = hero({ talents: [domainTalent('necromancie')] });
    const gate = arcaneDomainGate(h, 'demonologie');
    expect(gate.ok).toBe(false);
    expect(gate.reason).toMatch(/sombre/);
  });

  it('Domaine déjà possédé : toujours autorisé (relève de talentMaxReached, pas de ce gate)', () => {
    const h = hero({ talents: [domainTalent('feu')] });
    expect(arcaneDomainGate(h, 'feu').ok).toBe(true);
  });
});

describe('prisParLesAutres — pool libre d\'un joker (LDB 05 l.535)', () => {
  const levels = levelsForCareer('gladiateur');
  const slots = skillSlots(levels, 1);
  const joker = slots.find((s) => s.needsChoice)!;
  const libres = (designations: Record<string, string>) => {
    const pris = prisParLesAutres(joker, slots, designations);
    return wildcardSpecs(joker.options[0], 'skill').filter((spec) => !pris.has(`${joker.options[0].optionId}|${spec}`));
  };
  it('le pool libre ne contient pas la référence d\'un autre emplacement, et CONTIENT sa propre désignation', () => {
    const pool = libres({ [joker.key]: 'corps-a-corps|escrime' });
    expect(pool).not.toContain('bagarre');
    expect(pool).toContain('escrime');
  });
});

describe('portée de l\'exclusion : les emplacements du MÊME niveau (LDB 05 l.535 ; LDB 08 l.140)', () => {
  it('au Niveau 2, un joker désigne une spécialisation tenue au Niveau 1 ; au même niveau, il ne peut pas', () => {
    const soldat = skillSlots(levelsForCareer('soldat'), 2);
    const joker2 = soldat.find((s) => s.level === 2 && s.needsChoice && s.options[0].optionId === 'corps-a-corps')!;
    expect(soldat.some((s) => s.level === 1 && !s.needsChoice && s.options[0].optionId === 'corps-a-corps' && s.options[0].spec === 'base')).toBe(true);
    expect(designateSlot(hero({ career: 'soldat', careerSlotChoices: {} }), 'soldat', joker2, 'corps-a-corps', 'base', soldat)).toEqual({ ok: true });

    const glad = skillSlots(levelsForCareer('gladiateur'), 1);
    const joker1 = glad.find((s) => s.needsChoice)!;
    expect(designateSlot(hero({ career: 'gladiateur', careerSlotChoices: {} }), 'gladiateur', joker1, 'corps-a-corps', 'bagarre', glad).ok).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { Combatant } from '../engine/types';
import { findTalentById, specPoolOf } from '../data';
import { buildAdvancementView } from './advancement';

/** Héros minimal de carrière « Agitateur » (careerLevels.json : Niveau 1 = « Pamphlétaire »,
 *  Caractéristiques de carrière = CT/Int/Soc ; Compétences incluent Charme, Ragot ;
 *  Talents incluent Sociable). */
const hero = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h',
    name: 'H',
    kind: 'hero',
    species: 'humains-reiklander',
    career: 'agitateur',
    careerLevel: 1,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [
      { id: 'charme', characteristic: 'sociabilite', advances: 0 }, // in-carrière
      { id: 'esquive', characteristic: 'agilite', advances: 0 }, // hors-carrière
    ],
    talents: [],
    movement: 4,
    xp: 1000,
    charAdvances: {},
    ...over,
  }) as unknown as Combatant;

describe('buildAdvancementView — coûts & in-carrière depuis careerLevels.json', () => {
  it('méta : PX, carrière, niveau, libellé du niveau', () => {
    const v = buildAdvancementView(hero());
    expect(v.xp).toBe(1000);
    expect(v.career).toBe('agitateur');
    expect(v.careerLevel).toBe(1);
    expect(v.levelLabel).toBe('Pamphlétaire');
  });

  it('Caractéristiques : CT in-carrière (coût 25), CC hors-carrière (coût ×2 = 50)', () => {
    const v = buildAdvancementView(hero());
    const ct = v.chars.find((c) => c.key === 'capacite-de-tir')!;
    const cc = v.chars.find((c) => c.key === 'capacite-de-combat')!;
    expect(ct.inCareer).toBe(true);
    expect(ct.nextCost).toBe(25);
    expect(ct.value).toBe(30);
    expect(cc.inCareer).toBe(false);
    expect(cc.nextCost).toBe(50);
  });

  it('Compétences connues : Charme in-carrière (10), Esquive hors-carrière (×2 = 20)', () => {
    const v = buildAdvancementView(hero());
    const charme = v.skills.find((s) => s.label === 'Charme')!;
    const esquive = v.skills.find((s) => s.label === 'Esquive')!;
    expect(charme.known).toBe(true);
    expect(charme.inCareer).toBe(true);
    expect(charme.nextCost).toBe(10);
    expect(esquive.inCareer).toBe(false);
    expect(esquive.nextCost).toBe(20);
  });

  it('Compétences in-carrière non connues : acquérables à advances 0 (coût 10)', () => {
    const v = buildAdvancementView(hero());
    const ragot = v.skills.find((s) => s.label === 'Ragot')!;
    expect(ragot).toBeTruthy();
    expect(ragot.known).toBe(false);
    expect(ragot.inCareer).toBe(true);
    expect(ragot.advances).toBe(0);
    expect(ragot.nextCost).toBe(10);
  });

  it('Talents in-carrière non possédés : un rang par EMPLACEMENT, acquérables (coût 100)', () => {
    const v = buildAdvancementView(hero());
    const sociable = v.talents.find((t) => t.label === 'Sociable')!;
    expect(sociable).toBeTruthy();
    expect(sociable.times).toBe(0);
    expect(sociable.nextCost).toBe(100);
    // Pamphlétaire (Niveau 1) : 4 emplacements de talents, tous explicites.
    expect(v.talents).toHaveLength(4);
  });

  it('emplacement « Béni (Au choix) » non désigné : options = pool de spécialisations du talent, par id (LDB 10 l.17)', () => {
    const v = buildAdvancementView(hero({ career: 'pretre' }));
    const row = v.talents.find((r) => r.entry === 'Béni (Au choix)')!;
    expect(row.options?.map((o) => o.refKey)).toContain('beni|sigmar');
    expect(row.options?.some((o) => o.refKey === 'beni')).toBe(false);
  });
  it('complétion : héros frais NON complété → coût de changement 200', () => {
    const v = buildAdvancementView(hero());
    expect(v.completed).toBe(false);
    expect(v.changeCost).toBe(200);
  });

  it('cible de progression : le Niveau suivant exige la complétion (LDB 07 l.137)', () => {
    const v = buildAdvancementView(hero());
    const next = v.targets.find((t) => t.level === 2);
    expect(next).toBeTruthy();
    expect(next!.career).toBe('agitateur');
    expect(next!.label).toBe('Agitateur'); // libellé du Niveau 2 (label de niveau, pas un id)
    expect(next!.ok).toBe(false); // niveau 1 non complété
  });

  it('niveau 2 : Compétences cumulatives (l.78), Talents du niveau courant seul (l.100)', () => {
    const v = buildAdvancementView(hero({ careerLevel: 2 }));
    // « Charme » (Niveau 1) reste in-carrière au Niveau 2.
    expect(v.skills.find((s) => s.label === 'Charme')!.inCareer).toBe(true);
    // « Sociable » (talent du Niveau 1) n'est PLUS proposé au Niveau 2.
    expect(v.talents.some((t) => t.label === 'Sociable')).toBe(false);
    expect(v.talents.length).toBeGreaterThan(0);
  });

  it('changeCostFor : +100 PX vers une carrière d\'une autre Classe (LDB 07 l.144)', () => {
    const v = buildAdvancementView(hero());
    // Agitateur = Citadins ; Artisan = Citadins (même Classe) ; Soldat = Guerriers.
    expect(v.changeCostFor('artisan')).toBe(v.changeCost);
    expect(v.changeCostFor('soldat')).toBe(v.changeCost + 100);
  });

  it('emplacement « (Au choix) » : Érudit propose un choix de spec de Savoir', () => {
    const v = buildAdvancementView(hero({ career: 'erudit' }));
    const open = v.skillSlotsOpen.find((s) => s.group === 'Savoir');
    expect(open).toBeTruthy();
    expect(open!.options.length).toBeGreaterThan(0);
  });
});

// Issue #10 : les entités POSSÉDÉES (talents/compétences) sont appariées contre les emplacements
// de carrière par id (+spec), plus par libellé round-trippé. Ces cas verrouillent le chemin de
// match-possédé (faiblement couvert auparavant). Les libellés D'AFFICHAGE restent inchangés.
describe('buildAdvancementView — match d\'entité possédée par id+spec (Issue #10)', () => {
  it('Talent EXPLICITE possédé : times lu par id (Artisan N3 → Bricoleur)', () => {
    const v = buildAdvancementView(hero({ career: 'artisan', careerLevel: 3, talents: [{ talentId: 'bricoleur', times: 1 }] }));
    const bricoleur = v.talents.find((t) => t.label === 'Bricoleur');
    expect(bricoleur).toBeTruthy();
    expect(bricoleur!.times).toBe(1);
  });

  it('Talent à spec wildcard possédé : owned lu par id+spec (Sens aiguisé (Goût) ≠ (Toucher))', () => {
    const v = buildAdvancementView(hero({ career: 'artisan', careerLevel: 3, talents: [{ talentId: 'sens-aiguise', spec: 'gout', times: 1 }] }));
    // `option.label` est désormais une clé de câblage OPAQUE (refKey) ; `display` porte le texte.
    const slot = v.talents.find((t) => t.options?.some((o) => o.display.startsWith('Sens aiguisé')));
    expect(slot).toBeTruthy();
    const gout = slot!.options!.find((o) => o.display === 'Sens aiguisé (Goût)')!;
    const toucher = slot!.options!.find((o) => o.display === 'Sens aiguisé (Toucher)')!;
    expect(gout.owned).toBe(true); // possédé avec la bonne spec
    expect(toucher.owned).toBe(false); // même talent, autre spec → non possédé
  });

  it('Compétence à spec wildcard possédée : ownedAdvances lu par id+spec (Savoir (Empire))', () => {
    const v = buildAdvancementView(hero({ career: 'erudit', careerLevel: 1, skills: [{ id: 'savoir', spec: 'empire', characteristic: 'intelligence', advances: 3 }] }));
    const open = v.skillSlotsOpen.find((s) => s.group === 'Savoir');
    expect(open).toBeTruthy();
    const empire = open!.options.find((o) => o.spec === 'empire');
    expect(empire).toBeTruthy();
    expect(empire!.ownedAdvances).toBe(3);
  });
});

describe('remise « 5 PX de moins par Augmentation » sur une Compétence ajoutée par un Talent (LDB 10)', () => {
  it('Maître artisan (joker `choix`) : Métier (Imprimerie), de carrière → 10 − 5 = 5 PX', () => {
    const v = buildAdvancementView(hero({
      skills: [{ id: 'metier', spec: 'imprimerie', characteristic: 'dexterite', advances: 0 }],
      talents: [{ talentId: 'maitre-artisan', times: 1 }],
    }));
    const metier = v.skills.find((s) => s.skillId === 'metier' && s.spec === 'imprimerie')!;
    expect(metier.inCareer).toBe(true);
    expect(metier.nextCost).toBe(5);
  });

  it('Voyageur aguerri (spec EXACTE `region`) : aucune remise sur Savoir (Politique)', () => {
    const v = buildAdvancementView(hero({
      skills: [{ id: 'savoir', spec: 'politique', characteristic: 'intelligence', advances: 0 }],
      talents: [{ talentId: 'voyageur-aguerri', times: 1 }],
    }));
    const savoir = v.skills.find((s) => s.skillId === 'savoir' && s.spec === 'politique')!;
    expect(savoir.inCareer).toBe(true);
    expect(savoir.nextCost).toBe(10);
  });
});

// #516 : câblage bout-en-bout du Trait « Marque de Khorne » (MDG 07 l.250-252) par le chemin
// AVANCEMENT réel — `careerTalentAdditions` (Trait) → `buildAdvancementView` (état projeté), pas
// seulement le canal unitaire (cf. `engine/traits/marque-de-khorne.test.ts`).
describe('buildAdvancementView — Marque de Khorne : 10 Talents achetables hors-carrière (#516)', () => {
  it('les 10 Talents apparaissent dans les options d\'avancement projetées, achetables au tarif normal', () => {
    const v = buildAdvancementView(hero({ traits: [{ id: 'marque-de-khorne' }] }));
    const ids = ['assaut-feroce', 'charge-berserk', 'combat-instinctif', 'coup-puissant', 'determine', 'endurci', 'guerrier-ne', 'resistance', 'resistance-a-la-magie', 'vigilance'];
    for (const id of ids) {
      const row = v.talents.find((t) => t.talentId === id);
      expect(row, `talent ${id} absent des options projetées`).toBeTruthy();
      expect(row!.times).toBe(0);
      expect(row!.nextCost).toBe(100); // coût en PX NORMAL d'Augmentation de Carrière (première acquisition)
    }
  });
});

// EDOC 13 l.524 : « Magie des Arcanes (n'importe laquelle) » — l'emplacement `choix` de la Marque de
// Tzeentch se déplie à l'avancement sur le pool du Talent, comme le joker d'emplacement de carrière.
describe('buildAdvancementView — Marque de Tzeentch : Magie des Arcanes au choix du Domaine', () => {
  it('chaque Domaine du pool de Magie des Arcanes est une option projetée, désignée par sa spec', () => {
    const v = buildAdvancementView(hero({ traits: [{ id: 'marque-de-tzeentch' }] }));
    const specs = v.talents.filter((t) => t.talentId === 'magie-des-arcanes').map((t) => t.spec);
    expect(specs.length).toBeGreaterThan(1);
    expect(specs).toEqual(specPoolOf(findTalentById('magie-des-arcanes')!));
  });
});

import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { createHero } from './character';
import { makeRNG } from './dice';
import { casterTalents, learnableSpells } from './grimoire';
import { blessingsOf, talentConcrete } from '../data';
import { featuresOf } from './combatFeatures/dispatch';
import { rationCount, dailyFoodUpkeep } from './provisions';
import { itemLabel } from './items';
import { bonus } from './characteristics';
import { dotationsDuHeros, emplacementsDeDotation } from './trappingChoices';
import { adresseDeCreation } from './adresseDeCreation';
import { avecDotations, CARRIERE_FIXTURE, DOTATIONS_FIXTURE } from '../data/dotations.fixture';

/**
 * Verrouillage de l'INTÉGRATION création ↔ {Magie (Jalon 2), règles 2.5, Voyage #T2} :
 * les quatre features ont été livrées par des sessions parallèles — ces tests garantissent
 * qu'un personnage SORTI DU CRÉATEUR alimente bien les registres livrés à côté (labels de
 * talents identiques data ↔ moteurs, trappings ↔ rations, Béni ↔ Bénédictions du culte).
 */
describe('création ↔ Magie (grimoire, LDB 10/41/46)', () => {
  it('un Prêtre créé (Béni) reçoit AUTOMATIQUEMENT les six Bénédictions de son culte (LDB 41)', () => {
    const h = createHero({ idNeuf: idsDeTest,
      speciesId: 'humains-reiklander', careerId: 'pretre', label: 'P', seed: 7,
      careerTalent: { id: 'beni', spec: 'sigmar' },
    });
    expect(casterTalents(h).some((t) => t.kind === 'beni' && t.spec === 'sigmar')).toBe(true);
    for (const b of blessingsOf('sigmar')) expect(h.spells).toContain(b); // « reçoit les SIX »
  });

  it('un Sorcier créé (Magie mineure) peut mémoriser des sorts via le grimoire (coûts par bandes)', () => {
    const h = createHero({ idNeuf: idsDeTest,
      speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'S', seed: 7,
      careerTalent: { id: 'magie-mineure' }, // le talent de carrière choisi (1 seul au Niveau 1)
    });
    expect(casterTalents(h).some((t) => t.kind === 'mineure')).toBe(true);
    const learnable = learnableSpells(h);
    expect(learnable.length).toBeGreaterThan(0);
    const minor = learnable.filter((x) => x.spell.ecole === 'Magie mineure');
    expect(minor.length).toBeGreaterThan(0);
    expect(minor[0].cost).toBe(0); // BFM sorts INCLUS au Talent (LDB 10 l.714), payants ensuite
  });
});

describe('création ↔ règles 2.5 (registre combatFeatures, LDB 10)', () => {
  it('un Ratier créé (Coup puissant, Frappe assommante) résout dans le registre des talents câblés', () => {
    const h = createHero({ idNeuf: idsDeTest,
      speciesId: 'humains-reiklander', careerId: 'ratier', label: 'R', seed: 7,
      careerTalent: { id: 'coup-puissant' },
    });
    expect(h.talents.some((t) => talentConcrete(t) === 'Coup puissant')).toBe(true);
    expect(featuresOf(h).some(({ def }) => def.meleeDamageBonus)).toBe(true); // câblé, pas juste affiché
  });
});

describe('création ↔ Voyage & Nourriture (#T2, LDB 18 l.337-343)', () => {
  it('les Rations des trappings de classe sont vues par le système de faim et consommées', () => {
    // Classe « Ruraux » (Villageois…) : rations dans les trappings de classe (LDB 05 l.568).
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'villageois', label: 'V', seed: 7 });
    const before = rationCount(h);
    expect(before).toBeGreaterThan(0); // le créateur produit des objets compatibles isRation
    const r = dailyFoodUpkeep(h, 50, bonus(h.characteristics.endurance), makeRNG(1));
    expect(r.ate).toBe(true);
    expect(r.rationConsumed).toBe(true);
    expect(rationCount(h)).toBe(before - 1);
  });
});

/**
 * INTÉGRATION création ↔ dotation SPÉCIALISÉE (#1463 L-ref-1). Le livre imprime la spécialisation
 * d'une possession entre parenthèses (`LDB 08` l.1130, Écuyer : « outils de la profession
 * (Maréchal-ferrant) ») ; la donnée l'écrit `{id, spec}`. Ce test suit le chemin RÉEL du créateur —
 * `createHero` → `resolveTrappingChoices` → `buildInventory` → `itemFromTrappingRef` — et non une
 * ref forgée : c'est entre la ref résolue et l'objet de sac que la spécialisation se perdait.
 */
describe('création ↔ dotation spécialisée (LDB 08 l.1130)', () => {
  const ecuyer = () => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'chevalier', label: 'E', seed: 7 });

  it('l’Écuyer sort du créateur avec la spéc PORTÉE PAR L’OBJET, et l’affiche', () => {
    const outils = (ecuyer().items ?? []).find((i) => i.trappingId === 'outils-professionnels');
    expect(outils, 'la dotation `outils-professionnels` de chevalier-1 n’est pas matérialisée').toBeTruthy();
    expect(outils!.spec, 'la spéc de la dotation tombe entre la ref résolue et l’objet de sac').toBe('Maréchal-ferrant');
    expect(itemLabel(outils!)).toBe('Outils professionnels (Maréchal-ferrant)');
  });

  it('une dotation SANS spéc ne gagne aucune parenthèse parasite', () => {
    const items = ecuyer().items ?? [];
    const bouclier = items.find((i) => i.trappingId === 'bouclier');
    expect(bouclier!.spec).toBeUndefined();
    expect(itemLabel(bouclier!)).toBe('Bouclier');
    expect(itemLabel(items.find((i) => i.trappingId === 'chemise-de-mailles')!)).toBe('Chemise de mailles');
  });

  it('la spéc SURVIT à la sérialisation d’une save (copie JSON profonde, `noyau/persistance/save.ts`)', () => {
    const relu = JSON.parse(JSON.stringify(ecuyer())) as ReturnType<typeof ecuyer>;
    const outils = (relu.items ?? []).find((i) => i.trappingId === 'outils-professionnels');
    expect(outils!.spec).toBe('Maréchal-ferrant');
    expect(itemLabel(outils!)).toBe('Outils professionnels (Maréchal-ferrant)');
  });
});

/** INTÉGRATION création ↔ dotation à branches (#1988) : `createHero` → `resolveTrappingChoices` →
 *  `buildInventory`, sur la vraie carrière Artiste (`careerLevels.json`, artiste-1). */
describe('création ↔ dotation à branches non tranchée', () => {
  const BRANCHES = ['pinceau', 'ciseau', 'plume-d-oie'];
  const artiste = (trappingChoices?: Parameters<typeof createHero>[0]['trappingChoices']) =>
    createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'artiste', label: 'A', seed: 7, trappingChoices });
  const adresse = () =>
    emplacementsDeDotation(dotationsDuHeros('artiste')).find((e) => e.sorte === 'branches' && e.ref.of.some((b) => 'id' in b && b.id === 'pinceau'))!.adresse;

  it('sans choix, aucun objet des branches n’entre au sac', () => {
    expect((artiste().items ?? []).map((i) => i.trappingId).filter((id) => BRANCHES.includes(id!))).toEqual([]);
  });

  it('la branche 1 choisie donne le ciseau, et elle seule', () => {
    expect((artiste({ [adresse()]: 1 }).items ?? []).map((i) => i.trappingId).filter((id) => BRANCHES.includes(id!))).toEqual(['ciseau']);
  });
});

/** INTÉGRATION création ↔ lot, joker de Groupe, joker à Atout : `createHero` → `resolveTrappingChoices` → `buildInventory`. */
describe('création ↔ lot et jokers d’arme', () => {
  const dot = adresseDeCreation.dotation;
  const creer = (trappingChoices: Parameters<typeof createHero>[0]['trappingChoices']) =>
    avecDotations(CARRIERE_FIXTURE, DOTATIONS_FIXTURE, () => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: CARRIERE_FIXTURE, label: 'A', seed: 7, trappingChoices }));

  it('le lot choisi donne chacun de ses membres, son compte compris', () => {
    const items = creer({ [dot([5])]: 1 }).items ?? [];
    expect(items.filter((i) => i.trappingId === 'arc')).toHaveLength(1);
    expect(items.filter((i) => i.trappingId === 'fleche').reduce((n, i) => n + (i.qty ?? 1), 0)).toBe(10);
  });

  it('l’arme choisie d’un joker de Groupe entre au sac ; celle d’un joker à Atout porte l’Atout choisi', () => {
    const items = creer({ [dot([6])]: 'grande-hache', [dot([7])]: 'rapiere', [dot([7, 0])]: 'solide' }).items ?? [];
    expect(items.some((i) => i.trappingId === 'grande-hache')).toBe(true);
    expect(items.find((i) => i.trappingId === 'rapiere')?.qualities.map((q) => q.id)).toContain('solide');
  });
});

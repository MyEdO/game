import { describe, it, expect } from 'vitest';
import { createHero } from './character';
import { makeRNG } from './dice';
import { casterTalents, learnableSpells } from './grimoire';
import { blessingsOf, talentConcrete } from '../data';
import { featuresOf } from './combatFeatures/dispatch';
import { rationCount, dailyFoodUpkeep } from './provisions';
import { itemLabel } from './items';
import { bonus } from './characteristics';

/**
 * Verrouillage de l'INTÉGRATION création ↔ {Magie (Jalon 2), règles 2.5, Voyage #T2} :
 * les quatre features ont été livrées par des sessions parallèles — ces tests garantissent
 * qu'un personnage SORTI DU CRÉATEUR alimente bien les registres livrés à côté (labels de
 * talents identiques data ↔ moteurs, trappings ↔ rations, Béni ↔ Bénédictions du culte).
 */
describe('création ↔ Magie (grimoire, LDB 10/41/46)', () => {
  it('un Prêtre créé (Béni) reçoit AUTOMATIQUEMENT les six Bénédictions de son culte (LDB 41)', () => {
    const h = createHero({
      speciesId: 'humains-reiklander', careerId: 'pretre', label: 'P', rng: makeRNG(7),
      careerTalent: { id: 'beni', spec: 'sigmar' },
    });
    expect(casterTalents(h).some((t) => t.kind === 'beni' && t.spec === 'sigmar')).toBe(true);
    for (const b of blessingsOf('sigmar')) expect(h.spells).toContain(b); // « reçoit les SIX »
  });

  it('un Sorcier créé (Magie mineure) peut mémoriser des sorts via le grimoire (coûts par bandes)', () => {
    const h = createHero({
      speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'S', rng: makeRNG(7),
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
    const h = createHero({
      speciesId: 'humains-reiklander', careerId: 'ratier', label: 'R', rng: makeRNG(7),
      careerTalent: { id: 'coup-puissant' },
    });
    expect(h.talents.some((t) => talentConcrete(t) === 'Coup puissant')).toBe(true);
    expect(featuresOf(h).some(({ def }) => def.meleeDamageBonus)).toBe(true); // câblé, pas juste affiché
  });
});

describe('création ↔ Voyage & Nourriture (#T2, LDB 18 l.337-343)', () => {
  it('les Rations des trappings de classe sont vues par le système de faim et consommées', () => {
    // Classe « Ruraux » (Villageois…) : « Rations (1 jour) » dans les trappings de classe.
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'villageois', label: 'V', rng: makeRNG(7) });
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
  const ecuyer = () => createHero({ speciesId: 'humains-reiklander', careerId: 'chevalier', label: 'E', rng: makeRNG(7) });

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

  it('la spéc SURVIT à la sérialisation d’une save (copie JSON profonde, `state/saves.ts`)', () => {
    const relu = JSON.parse(JSON.stringify(ecuyer())) as ReturnType<typeof ecuyer>;
    const outils = (relu.items ?? []).find((i) => i.trappingId === 'outils-professionnels');
    expect(outils!.spec).toBe('Maréchal-ferrant');
    expect(itemLabel(outils!)).toBe('Outils professionnels (Maréchal-ferrant)');
  });
});

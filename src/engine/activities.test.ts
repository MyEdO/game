/**
 * Activités « Entre deux aventures » (LDB 23) — moteur PUR :
 *  - Artisanat (l.65-92) : Test étendu de Métier, DR cible par gamme de prix (Bronze 5 /
 *    Argent 10 / Or 15+), « chaque Défaut diminue de moitié le nombre de DR requis, et chaque
 *    Atout ajoute +5 (ajouté après avoir appliqué les Défauts) », Difficulté par Disponibilité.
 *  - Apprentissage particulier (l.58-63) : tuteur 2d10 pa par 100 PX du Talent ; Test −20,
 *    +10 par tentative ratée.
 *  - Opérations bancaires (l.154-165) : invest — retirer rate 1d100 ≤ Indice → faillite ;
 *    planque — 1d100 ≤ 10 → perdue.
 *  - Revenus = « Gagner de l'argent grâce au Statut » (LDB 08 l.105-120) : Test Spectaculaire
 *    Accessible (+20) de la Compétence de carrière ; Bronze 2d10 sc × Standing, Argent 1d10 pa
 *    × Standing, Or 1 CO × Standing ; échec → moitié ; Échec Stupéfiant (−6) → rien.
 */
import { describe, it, expect } from 'vitest';
import type { RNG } from './dice';
import { toBrass } from './money';
import { AVAILABILITIES } from './types';
import { craftTarget, apprenticeshipTutorCost, entrainementTutorCost, entrainementTutorRange, entrainementOptions, bankWithdrawOutcome, statusIncome, ACTIVITIES, activitiesFor, activityById, resolveTravelActivity,
  resolveStageActivities, aggregateActivityOutcomes, STAGE_OUTCOME_AGG, type TravelActivityResult,
  defaultTravelRole, stageAssignmentFromRoles, matchOutcomes, activityAvailableAt } from './activities';
import { byId } from '../data';
import { testValue } from './skills';

function seq(values: number[]): RNG {
  let i = 0;
  return { int: () => values[i++] ?? 1 } as RNG;
}

describe('craftTarget — Artisanat (LDB 23 l.68-85)', () => {
  it('gammes de prix : Bronze 5 / Argent 10 / Or 15 DR', () => {
    expect(craftTarget('bronze', 'Commune', 0, 0).dr).toBe(5);
    expect(craftTarget('argent', 'Commune', 0, 0).dr).toBe(10);
    expect(craftTarget('or', 'Commune', 0, 0).dr).toBe(15);
  });
  it('chaque Défaut ÷2 (avant Atouts), chaque Atout +5 après', () => {
    expect(craftTarget('argent', 'Commune', 0, 1).dr).toBe(5); // 10 ÷ 2
    expect(craftTarget('argent', 'Commune', 0, 2).dr).toBe(3); // 10 ÷ 4 → arrondi sup (min 1)
    expect(craftTarget('argent', 'Commune', 2, 0).dr).toBe(20); // 10 + 2×5
    expect(craftTarget('argent', 'Commune', 1, 1).dr).toBe(10); // (10 ÷ 2) + 5 — Atouts APRÈS Défauts
  });
  it('difficulté par Disponibilité (Commune +20 … Exotique −30)', () => {
    expect(craftTarget('bronze', 'Commune', 0, 0).difficulty).toBe('accessible');
    expect(craftTarget('bronze', 'Limitée', 0, 0).difficulty).toBe('intermediaire');
    expect(craftTarget('bronze', 'Rare', 0, 0).difficulty).toBe('complexe');
    expect(craftTarget('bronze', 'Exotique', 0, 0).difficulty).toBe('tresDifficile');
  });
});

describe('apprenticeshipTutorCost — « 2D10 pistoles d’argent par 100PX » (LDB 23 l.72)', () => {
  it('un Talent à 100 PX : un seul 2d10 en pa', () => {
    const m = apprenticeshipTutorCost(100, seq([4, 6])); // 10 pa
    expect(toBrass(m)).toBe(10 * 12);
  });
  it('un Talent à 300 PX : trois tranches de 2d10', () => {
    const m = apprenticeshipTutorCost(300, seq([1, 2, 3, 4, 5, 6])); // 3+7+11 = 21 pa
    expect(toBrass(m)).toBe(21 * 12);
  });
});

describe('bankWithdrawOutcome — Opérations bancaires (LDB 23 l.157-159)', () => {
  it('invest : d100 ≤ Indice → faillite ; sinon capital + intérêts', () => {
    expect(bankWithdrawOutcome('invest', 6, 6)).toBe('lost');
    expect(bankWithdrawOutcome('invest', 6, 7)).toBe('ok');
  });
  it('planque : d100 ≤ 10 → découverte ; pas d’intérêts', () => {
    expect(bankWithdrawOutcome('stash', 0, 10)).toBe('lost');
    expect(bankWithdrawOutcome('stash', 0, 11)).toBe('ok');
  });
  it('planque liée à une Carte marine (MDG 15 l.292) : seuil de découverte 50 au lieu de 10', () => {
    expect(bankWithdrawOutcome('stash', 50, 50)).toBe('lost');
    expect(bankWithdrawOutcome('stash', 50, 51)).toBe('ok');
  });
});

describe('statusIncome — « Gagner de l’argent grâce au Statut » (LDB 08 l.105-120)', () => {
  it('Bronze N : N × 2d10 sous de cuivre', () => {
    const m = statusIncome('bronze', 2, seq([3, 4, 5, 6]), 'success'); // (3+4)+(5+6) = 18 sc
    expect(toBrass(m)).toBe(18);
  });
  it('Argent N : N × 1d10 pistoles ; Or N : N couronnes', () => {
    expect(toBrass(statusIncome('argent', 2, seq([1, 2]), 'success'))).toBe(3 * 12);
    expect(toBrass(statusIncome('or', 3, seq([]), 'success'))).toBe(3 * 240);
  });
  it('échec : la moitié ; Échec Stupéfiant : rien', () => {
    expect(toBrass(statusIncome('argent', 1, seq([10]), 'fail'))).toBe(Math.floor((10 * 12) / 2));
    expect(toBrass(statusIncome('or', 5, seq([]), 'astoundingFail'))).toBe(0);
  });
});

// ── Catalogues UI (sélecteurs alimentés par la donnée — audit POC→produit) ──────────────────
import { craftSpecOf, craftCatalog, learnableTalents, orderBlockOf, orderCatalog, tutorCostRange, metierOf } from './activities';
import { createHero } from './character';
import { makeRNG } from './dice';
import { findTrappingById, skillInstanceLabel, talentConcrete, trappings } from '../data';
import { priceToMoney } from './money';

describe('craftSpecOf — dérivation partagée flux/catalogue', () => {
  it('matériaux = ¼ du prix (ch.23 l.66), gamme par pièce dominante', () => {
    const dague = findTrappingById('dague')!;
    const spec = craftSpecOf(dague)!;
    expect(spec).not.toBeNull();
    expect(spec.materialsBrass).toBe(Math.max(1, Math.floor(spec.priceBrass / 4)));
    expect(['bronze', 'argent', 'or']).toContain(spec.tier);
  });
  it('les 4 classes RAW (LDB 59 l.15) donnent une spec ; la Disponibilité est reportée telle quelle', () => {
    for (const av of AVAILABILITIES) {
      expect(craftSpecOf({ price: { gold: 0, silver: 5, brass: 0 }, availability: av })?.avail).toBe(av);
    }
  });
  it('hors des 4 classes (marque « ND » ou absence) → NON FABRICABLE : `null`, aucune classe inventée', () => {
    expect(craftSpecOf({ price: { gold: 0, silver: 5, brass: 0 }, availability: 'ND' })).toBeNull();
    expect(craftSpecOf({ price: { gold: 0, silver: 5, brass: 0 }, availability: null })).toBeNull();
  });
});

describe('craftCatalog / orderCatalog', () => {
  it('le catalogue d’Artisanat ne liste que des objets à prix chiffré, avec cible de Test', () => {
    const cat = craftCatalog();
    expect(cat.length).toBeGreaterThan(100);
    for (const o of cat.slice(0, 20)) {
      expect(o.priceBrass).toBeGreaterThan(0);
      expect(o.dr).toBeGreaterThanOrEqual(1);
    }
    // « Épée » n’existe pas : le sélecteur évite le piège du libellé deviné (audit B1).
    expect(cat.some((o) => o.label === 'Épée bâtarde')).toBe(true);
  });
  it('Passer commande : marchandise chiffrée que les boutiques ne tiennent pas (ch.23 l.180)', () => {
    const cat = orderCatalog();
    expect(cat.length).toBeGreaterThan(0);
    for (const o of cat) expect(o.priceBrass).toBeGreaterThan(0);
    // Aucune Commune/Limitée/Rare : celles-là se tiennent en stock (LDB 59 l.17-19) → marchand.
    expect(cat.filter((o) => AVAILABILITIES.filter((a) => a !== 'Exotique').includes(findTrappingById(o.id)!.availability as never))).toEqual([]);
    // Tous les Exotiques chiffrés y sont (LDB 59 l.21).
    const exotiques = trappings.filter((t) => t.availability === 'Exotique' && toBrass(priceToMoney(t.price)) > 0).map((t) => t.id);
    const ids = new Set(cat.map((o) => o.id));
    for (const id of exotiques) expect(ids.has(id), `${id} (Exotique chiffré) doit être commandable`).toBe(true);
  });
  /** VDM 12 l.42 : les bâtons enchantés perdus ou brisés « peuvent être remplacés, mais nécessitent
   *  l'Activité Passer commande et coûtent 15 CO ». Aucune Disponibilité au livre : la porte d'entrée
   *  du catalogue est donc le PRIX, pas la classe de Disponibilité. */
  it('COMMANDE : le bâton enchanté est commandable à 15 CO, sans Disponibilité déclarée', () => {
    const bat = findTrappingById('baton-enchante')!;
    expect(bat.availability).toBeNull();
    const entry = orderCatalog().find((o) => o.id === 'baton-enchante');
    expect(entry, 'baton-enchante doit être commandable (VDM 12 l.42)').toBeDefined();
    expect(entry!.priceBrass).toBe(toBrass(priceToMoney({ gold: 15, silver: 0, brass: 0 })));
    expect(orderBlockOf(bat)).toBeNull();
  });
  /** HORS COMMERCE (LDB 59 l.15) : sans Disponibilité NI prix, ni FABRICATION ni COMMANDE — « Les
   *  licences de Guilde ne s'achètent pas ; elles sont accordées » (LDB 68 l.25). Contre-épreuve sur
   *  un objet ordinaire, qui doit rester au catalogue d'Artisanat. */
  it('FABRICATION / COMMANDE : les objets hors commerce sont absents des deux catalogues', () => {
    const hors = ['arme-improvisee', 'licence-de-guilde', 'mains-nues', 'malepierre-brute', 'malepierre-raffinee', 'sel-sacre', 'carte-marine'];
    const craft = new Set(craftCatalog().map((o) => o.id));
    const order = new Set(orderCatalog().map((o) => o.id));
    for (const id of hors) {
      expect(craft.has(id), `${id} ne doit pas être fabricable`).toBe(false);
      expect(order.has(id), `${id} ne doit pas être commandable`).toBe(false);
      expect(orderBlockOf(findTrappingById(id)!)).toBe('sans-prix');
    }
    expect(craft.has('dague')).toBe(true); // contre-épreuve
    expect(orderBlockOf(findTrappingById('dague')!)).toBe('stock-ordinaire');
  });
});

describe('learnableTalents — « un Talent en dehors de votre Carrière » (ch.23 l.59)', () => {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'T', rng: makeRNG(7) });
  it('exclut les talents de la Carrière courante (eux passent par l’Avancement)', () => {
    const labels = learnableTalents(hero).map((t) => t.label);
    // « Guerrier né » est un talent du Soldat Niveau 1 (Recrue) → exclu de l'Apprentissage.
    expect(labels).not.toContain('Guerrier né');
    expect(labels).not.toContain('Infatigable');
    expect(labels).toContain('Chanceux'); // hors carrière Soldat
  });
  it('exclut les Talents à spécialisation (aucun sélecteur de spec dans ce catalogue)', () => {
    // « Magie des Arcanes » (specsSource: arcaneDomains) ne doit jamais apparaître : l'Activité
    // achèterait sans spec (`engineBuyTalent(h, talentId)`), contournant `arcaneDomainGate`.
    const labels = learnableTalents(hero).map((t) => t.label);
    expect(labels).not.toContain('Magie des Arcanes');
  });
  it('coût PX de la prochaine acquisition + fourchette tuteur 2d10 pa/100 PX', () => {
    const lt = learnableTalents(hero);
    const fresh = lt.find((x) => !hero.talents.some((t) => talentConcrete(t) === x.label))!;
    expect(fresh.xpCost).toBe(100); // 1re acquisition
    // Chanceux est déjà pris 1× (tirage de création) → la 2e acquisition coûte 200 PX.
    expect(lt.find((x) => x.label === 'Chanceux')!.xpCost).toBe(200);
    expect(fresh.tutorMinBrass).toBe(tutorCostRange(fresh.xpCost).minBrass);
    expect(tutorCostRange(250)).toEqual({ minBrass: 3 * 2 * 12, maxBrass: 3 * 20 * 12 }); // 3 tranches
  });
  it('metierOf : Compétence Métier avec avances seulement', () => {
    expect(metierOf(hero)).toBeUndefined();
    hero.skills.push({ id: 'metier', spec: 'Forgeron', characteristic: 'dexterite', advances: 5 });
    expect(skillInstanceLabel(metierOf(hero)!)).toBe('Métier (Forgeron)');
  });
});

describe('catalogue d’Activités data-driven (activities.json)', () => {
  it('ids uniques et contextes non vides', () => {
    const ids = ACTIVITIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACTIVITIES) expect(a.contexts.length).toBeGreaterThan(0);
  });

  it('les 8 Activités de voyage EDOC sont présentes (contexte "voyage")', () => {
    const voyage = activitiesFor('voyage').map((a) => a.id).sort();
    expect(voyage).toEqual(
      [
        'approvisionnement', 'etablir-cartes', 'monter-camp', 'plein-air',
        'pratiquer-competence', 'recueillir-informations', 'recuperer', 'rester-aux-aguets',
      ].sort(),
    );
  });

  it('toute compétence référencée (`skills[].id`) résout dans le catalogue de Compétences', () => {
    for (const a of ACTIVITIES) {
      for (const s of a.skills ?? []) expect(byId('skill', s.id), `${a.id} → ${s.id}`).toBeTruthy();
    }
  });

  it('chaque Activité a un mode de Test cohérent (skills, freeSkill, ou sans Test)', () => {
    for (const a of activitiesFor('voyage')) {
      const hasTest = (a.skills?.length ?? 0) > 0 || a.freeSkill === true;
      // Une Activité sans Test (Récupérer) ne déclare pas failExtenue (pas de jet à rater).
      if (!hasTest) expect(a.failExtenue, a.id).toBeUndefined();
      else expect(a.failExtenue, a.id).toBe(true);
    }
  });

  it('Établir des cartes = Test ÉTENDU spec-aware (Cartographe / Dessin)', () => {
    const carto = activityById('etablir-cartes')!;
    expect(carto.extended?.drPerStage).toBe(2);
    expect(carto.skills).toEqual([
      { id: 'metier', spec: 'cartographe' },
      { id: 'art', spec: 'Dessin' },
    ]);
  });
});

describe('resolveTravelActivity — résolveur PUR par POSTE (un héros désigné, EDOC 8 l.131)', () => {
  const mk = () => createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(3) });

  it('Activité SANS Test (Récupérer) : succès direct + stageOutcome pour l’acteur désigné', () => {
    const hero = mk();
    const r = resolveTravelActivity(hero, activityById('recuperer')!, makeRNG(1));
    expect(r.success).toBe(true);
    expect(r.stageOutcome).toBe('countsAsRest');
    expect(r.actorId).toBe(hero.id); // le poste a TOUJOURS un titulaire désigné
    expect(r.ops).toEqual([]);
  });

  it('cohérence du Test : success ⇔ roll ≤ target ; échec ⇒ Exténué POUR CET acteur (l.133)', () => {
    const hero = mk();
    const r = resolveTravelActivity(hero, activityById('rester-aux-aguets')!, makeRNG(42));
    expect(r.actorId).toBe(hero.id);
    expect(r.success).toBe((r.roll ?? 999) <= (r.target ?? 0));
    expect(r.extenue).toBe(!r.success); // rester-aux-aguets a failExtenue
    if (r.success) expect(r.stageOutcome).toBe('noSurprise');
  });

  it('compétence « au choix » spec-aware : la MEILLEURE de L’ACTEUR l’emporte (Cartographe vs Dessin)', () => {
    const hero = mk();
    hero.skills.push({ id: 'metier', spec: 'cartographe', characteristic: 'dexterite', advances: 60 });
    hero.skills.push({ id: 'art', spec: 'Dessin', characteristic: 'dexterite', advances: 10 });
    const r = resolveTravelActivity(hero, activityById('etablir-cartes')!, makeRNG(5), { stages: 3 });
    // cible = meilleure des DEUX spec de l'acteur (Cartographe +60 > Dessin +10), Difficulté Intermédiaire (+0).
    // Les specs se demandent par ID (#1341) : par libellé, `testValue` ne trouvait RIEN et l'attendu
    // tombait sur la caractéristique nue — l'égalité tenait entre deux valeurs FAUSSES.
    const expected = Math.max(
      testValue(hero, 'metier', undefined, 'cartographe'),
      testValue(hero, 'art', undefined, 'Dessin'), // `art` n'a pas d'id `dessin` au catalogue (dit au rendu)
    );
    expect(r.target).toBe(expected);
    expect(r.drTarget).toBe(6); // Test étendu : drPerStage(2) × Étapes(3)
  });

  it('Approvisionnement : passe par le résolveur bespoke « forage » (réutilise forageYield)', () => {
    const r = resolveTravelActivity(mk(), activityById('approvisionnement')!, makeRNG(9));
    expect(r.resolver).toBe('forage');
  });

  it('le modificateur de compétence (météo) décale la cible du Test', () => {
    const hero = mk();
    const a = resolveTravelActivity(hero, activityById('plein-air')!, makeRNG(7), { skillMod: 0 });
    const b = resolveTravelActivity(hero, activityById('plein-air')!, makeRNG(7), { skillMod: -30 });
    expect((a.target ?? 0) - (b.target ?? 0)).toBe(30); // même jet, cible −30
  });
});

describe('postes d’Étape : assignation héros → Activité + agrégation (EDOC 8 l.131)', () => {
  const mk = (n: string) => createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: n, rng: makeRNG(3) });

  it('toute issue d’ACTIVITÉ de voyage a une classification d’agrégation', () => {
    for (const a of activitiesFor('voyage')) {
      if (a.stageOutcome) expect(STAGE_OUTCOME_AGG[a.stageOutcome], `${a.id} → ${a.stageOutcome}`).toBeDefined();
    }
  });

  it('un héros tient au plus un poste ; un héros sans poste ou un poste inconnu sont ignorés', () => {
    const a = mk('A'), b = mk('B'), c = mk('C');
    const res = resolveStageActivities([a, b, c], {
      [a.id]: { activityId: 'rester-aux-aguets' },
      [b.id]: { activityId: 'rester-aux-aguets' }, // 2 héros au MÊME poste : OK
      [c.id]: { activityId: 'activite-fantome' },   // poste inconnu : ignoré
      // (un 4e héros non listé n'aurait simplement pas de poste)
    }, makeRNG(11));
    expect(res.map((r) => r.actorId).sort()).toEqual([a.id, b.id].sort());
  });

  it('agrégation : porte (1 succès suffit) / cumul (Σ DR) / individuel (par héros)', () => {
    const mkRes = (o: Partial<TravelActivityResult>): TravelActivityResult =>
      ({ activityId: 'x', actorId: 'h', sl: 0, success: true, ops: [], extenue: false, ...o });
    const agg = aggregateActivityOutcomes([
      mkRes({ actorId: 'a', success: true, stageOutcome: 'suppressExposure' }),
      mkRes({ actorId: 'b', success: false, stageOutcome: 'suppressExposure' }), // échec : pas de porte
      mkRes({ actorId: 'c', success: true, stageOutcome: 'countsAsRest' }),
      mkRes({ actorId: 'd', success: true, stageOutcome: 'countsAsRest' }),
      mkRes({ actorId: 'e', success: true, sl: 3, stageOutcome: 'campCare' }),
      mkRes({ actorId: 'f', success: true, sl: 2, stageOutcome: 'campCare' }),
    ]);
    expect(agg.gates).toEqual(['suppressExposure']); // une seule porte, malgré l'échec de b
    expect(agg.stacks).toEqual({ campCare: 5 });       // 3 + 2 cumulés
    expect(agg.selfByHero).toEqual({ c: ['countsAsRest'], d: ['countsAsRest'] }); // individuel par héros
  });
});

describe('rôle de marche persistant (travelRole) — « les mêmes au même poste »', () => {
  const mk = (n: string) => createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: n, rng: makeRNG(3) });

  it('defaultTravelRole : poste où la meilleure compétence du héros est la plus haute', () => {
    const guetteur = mk('G');
    guetteur.skills.push({ id: 'perception', characteristic: 'initiative', advances: 80 });
    expect(defaultTravelRole(guetteur)).toBe('rester-aux-aguets');
    const survivant = mk('S');
    survivant.skills.push({ id: 'survie-en-exterieur', characteristic: 'intelligence', advances: 80 });
    // Survie alimente Plein air, Approvisionnement et Monter le camp : l'un de ces postes ressort.
    expect(['plein-air', 'approvisionnement', 'monter-camp']).toContain(defaultTravelRole(survivant));
  });

  it("l'assignation d'Étape est initialisée depuis les rôles (0 clic) ; travelRole épinglé prime", () => {
    const a = mk('A'), b = mk('B');
    a.skills.push({ id: 'perception', characteristic: 'initiative', advances: 80 });
    b.travelRole = 'recuperer'; // épinglé par le joueur → prime sur l'inférence
    const asg = stageAssignmentFromRoles([a, b]);
    expect(asg[a.id].activityId).toBe('rester-aux-aguets'); // inféré
    expect(asg[b.id].activityId).toBe('recuperer');         // épinglé
  });

  it('le rôle persistant se répète : même assignation à chaque Étape sans ré-saisie', () => {
    const a = mk('A'); a.travelRole = 'approvisionnement';
    const s1 = stageAssignmentFromRoles([a]);
    const s2 = stageAssignmentFromRoles([a]); // « étape suivante » : aucun nouveau choix
    expect(s2).toEqual(s1);
    expect(s1[a.id].activityId).toBe('approvisionnement');
  });
});

describe('Convalescence — Activité d’interlude (ADE II Annexe I « Les choses s’arrangent »)', () => {
  it("existe en contexte interlude, Test de Calme Très Difficile, onSuccess = removePsychTrait", () => {
    const conv = activityById('convalescence');
    expect(conv).toBeTruthy();
    expect(conv!.contexts).toContain('interlude');
    expect(conv!.skills).toEqual([{ id: 'calme' }]);
    expect(conv!.difficulty).toBe('tresDifficile'); // « Calme Très Difficile (–30) »
    expect(conv!.onSuccess).toEqual([{ op: 'removePsychTrait' }]); // « éliminer un Trait Psychologique de votre choix »
    expect(conv!.source.book).toBe('archives-de-l-empire-2');
  });
  it("apparaît dans le catalogue des Activités d'interlude", () => {
    expect(activitiesFor('interlude').some((a) => a.id === 'convalescence')).toBe(true);
  });
});

// ── Activités d'Altdorf (ACE 12 l.9-67) : bandes d'issue + gate géographique ─────────────

describe('matchOutcomes — bandes d’issue par DR (ACE Annexe I)', () => {
  const pen = activityById('penitence')!;
  const tst = activityById('tester-objets-magiques')!;
  const mec = activityById('mecenat')!;

  it('Pénitence : −1 Péché en succès, −2 dès +4 DR (« Succès Impressionnant ou mieux »)', () => {
    expect(matchOutcomes(pen, { success: true, sl: 2 }).flatMap((b) => b.ops ?? [])).toEqual([{ op: 'sinMod', amount: -1 }]);
    expect(matchOutcomes(pen, { success: true, sl: 4 }).flatMap((b) => b.ops ?? [])).toEqual([{ op: 'sinMod', amount: -2 }]);
  });

  it('Pénitence : échec → État Exténué ; Maladresse → Colère des dieux « à la place » (bande exclusive)', () => {
    expect(matchOutcomes(pen, { success: false, sl: -1 }).flatMap((b) => b.ops ?? [])).toEqual([{ op: 'condition', id: 'extenue' }]);
    const fumbled = matchOutcomes(pen, { success: false, sl: -1, fumble: true });
    expect(fumbled).toHaveLength(1);
    expect(fumbled[0].resolver).toBe('wrathOfTheGods');
    expect(fumbled[0].ops).toBeUndefined(); // « à la place » : l'Exténué d'échec ne tombe PAS
  });

  it('bandes ±0 : « +0 à +1 » réussit (fonction principale), « −0 à −1 » échoue (rien) — distinguées par `on`', () => {
    const ok0 = matchOutcomes(tst, { success: true, sl: 0 });
    expect(ok0).toHaveLength(1);
    expect(ok0[0].resolver).toBe('identifyByResearch');
    const ko0 = matchOutcomes(tst, { success: false, sl: 0 });
    expect(ko0).toHaveLength(1);
    expect(ko0[0].ops).toBeUndefined(); // « ne découvre aucune information utile »
  });

  it('Tester des objets : ≤ −4 DR → Test d’Exposition mineure à la Corruption (op GameOp)', () => {
    const bad = matchOutcomes(tst, { success: false, sl: -5 });
    expect(bad.flatMap((b) => b.ops ?? [])).toEqual([{ op: 'corruptionExposure', level: 'mineure', skill: { id: 'resistance' } }]);
  });

  it('Mécénat : 6 bandes — 120 % à +6, 100 % à +3..+5, 50 % à +0..+2, 0 en échec', () => {
    expect(matchOutcomes(mec, { success: true, sl: 6 })[0].payoutPct).toBe(120);
    expect(matchOutcomes(mec, { success: true, sl: 4 })[0].payoutPct).toBe(100);
    expect(matchOutcomes(mec, { success: true, sl: 1 })[0].payoutPct).toBe(50);
    expect(matchOutcomes(mec, { success: false, sl: -1 })[0].payoutPct).toBe(0);
    expect(matchOutcomes(mec, { success: false, sl: -4 })[0].payoutPct).toBe(0);
    expect(matchOutcomes(mec, { success: false, sl: -7 })[0].payoutPct).toBe(0);
    for (const res of [{ success: true, sl: 6 }, { success: false, sl: -7 }]) {
      expect(matchOutcomes(mec, res)).toHaveLength(1); // bandes exclusives (jamais deux paiements)
    }
  });

  it('Maladresse SANS bande fumble déclarée = échec ordinaire (Mécénat)', () => {
    expect(matchOutcomes(mec, { success: false, sl: -1, fumble: true })[0].payoutPct).toBe(0);
  });
});

describe('Augure (VDM 03 l.466-514) — tire réellement le Tableau des Symboles', () => {
  const aug = activityById('augure')!;

  it('Succès Minime (+0 à +1 DR) : un lancer sur `vdm-symboles-augure`', () => {
    const ops = matchOutcomes(aug, { success: true, sl: 0 }).flatMap((b) => b.ops ?? []);
    expect(ops).toEqual([{ op: 'rollTable', tableId: 'vdm-symboles-augure' }]);
  });

  it('Succès Impressionnant (+4 à +5 DR) : deux lancers', () => {
    const ops = matchOutcomes(aug, { success: true, sl: 4 }).flatMap((b) => b.ops ?? []);
    expect(ops).toEqual([
      { op: 'rollTable', tableId: 'vdm-symboles-augure' },
      { op: 'rollTable', tableId: 'vdm-symboles-augure' },
    ]);
  });

  it('Échec Stupéfiant (−6 DR ou moins) : trois lancers, symboles inversés', () => {
    const ops = matchOutcomes(aug, { success: false, sl: -6 }).flatMap((b) => b.ops ?? []);
    expect(ops).toHaveLength(3);
  });

  it('Échec Minime (−0 à −1 DR) : aucun lancer (« Aucune information n’est reçue »)', () => {
    const ops = matchOutcomes(aug, { success: false, sl: -1 }).flatMap((b) => b.ops ?? []);
    expect(ops).toEqual([]);
  });
});

describe('activityAvailableAt — gate géographique `where` (ACE = « à Altdorf »)', () => {
  it('les 5 Activités d’ACE sont gatées sur le lieu `altdorf` ; la Convalescence est partout', () => {
    for (const id of ['penitence', 'entrainement-arme-inhabituelle', 'tester-objets-magiques', 'mecenat', 'recherche-universitaire']) {
      const def = activityById(id)!;
      expect(def.contexts, id).toContain('interlude');
      expect(def.where, id).toEqual(['altdorf']);
      expect(def.source.book, id).toBe('altdorf-couronne-de-l-empire');
      expect(def.desc, id).toBeTruthy(); // description VERBATIM (règle 5)
      expect(activityAvailableAt(def, 'altdorf'), id).toBe(true);
      expect(activityAvailableAt(def, 'ubersreik'), id).toBe(false);
      expect(activityAvailableAt(def, null), id).toBe(false); // hors carte = pas à Altdorf
    }
    const conv = activityById('convalescence')!;
    expect(activityAvailableAt(conv, null)).toBe(true);
    expect(activityAvailableAt(conv, 'ubersreik')).toBe(true);
  });

  it('Mécénat : variante d’Opération bancaire — mise minimale 5 CO portée par la donnée', () => {
    expect(activityById('mecenat')!.minInvest).toEqual({ gold: 5 });
    expect(activityById('mecenat')!.resolver).toBe('mecenat');
  });
});

describe('entrainementTutorCost — « PX + 1D10 sous de cuivre » (LDB 23 l.132-136)', () => {
  it('Compétence de Base / Caractéristique : 1d10 sc simple', () => {
    expect(toBrass(entrainementTutorCost(false, seq([7])))).toBe(7);
  });
  it('Compétence Avancée : le tutorat est DOUBLÉ (l.135)', () => {
    expect(toBrass(entrainementTutorCost(true, seq([7])))).toBe(14);
  });
  it('fourchette affichée AVANT engagement : [1,10] sc / [2,20] sc si Avancée', () => {
    expect(entrainementTutorRange(false)).toEqual({ minBrass: 1, maxBrass: 10 });
    expect(entrainementTutorRange(true)).toEqual({ minBrass: 2, maxBrass: 20 });
  });
});

describe('entrainementOptions — Compétences/Caractéristiques HORS carrière seulement (LDB 23 l.130-136)', () => {
  it('exclut les Caractéristiques DE la carrière (Soldat : CC/End/FM), inclut les autres, PX déjà doublé hors carrière (LDB 07 l.91)', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    const opts = entrainementOptions(h);
    const chars = opts.filter((o) => o.kind === 'characteristic');
    expect(chars.every((o) => !o.advanced)).toBe(true);
    // Capacité de Combat/Endurance/Force Mentale SONT de la carrière du Soldat (careerLevels.json) : absentes ici.
    expect(chars.some((o) => o.id === 'capacite-de-combat')).toBe(false);
    expect(chars.some((o) => o.id === 'endurance')).toBe(false);
    expect(chars.some((o) => o.id === 'force-mentale')).toBe(false);
    // Sociabilité N'est PAS de la carrière du Soldat : entraînable, coût hors carrière (doublé).
    const soc = chars.find((o) => o.id === 'sociabilite');
    expect(soc).toBeTruthy();
    expect(soc!.xpCost).toBeGreaterThan(0);
  });
  it('marque `advanced` pour les Compétences Avancées, jamais pour une Compétence de Base', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    const opts = entrainementOptions(h);
    const skillOpts = opts.filter((o) => o.kind === 'skill');
    expect(skillOpts.length).toBeGreaterThan(0);
    const advanced = skillOpts.find((o) => o.advanced);
    expect(advanced).toBeTruthy();
    expect(advanced!.tutorMaxBrass).toBe(20);
    const base = skillOpts.find((o) => !o.advanced);
    expect(base!.tutorMaxBrass).toBe(10);
  });
});

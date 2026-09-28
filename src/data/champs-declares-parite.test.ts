import { describe, it, expect } from 'vitest';
import { skills, traits, talents, trappings, crewTestTypes, lieuxServices } from './index';
import { MORALE_FACTORS } from '../engine/crewMorale';
import { MISCAST_TABLES } from '../engine/miscast';
import { MOUNT_INCIDENTS } from '../engine/travelTables';
import { activityById } from '../engine/activities';
import { isUnarmedTrapping, isImprovisedTrapping } from '../engine/items';
import { CHAR_KEYS } from '../engine/types';
import { ruleDef } from '../engine/policy';
import { isTradeHubEntry, isEchangeable } from '../engine/cargo';
import { LAND_CARGO_ENTRIES, isLandTradeHub } from '../engine/landCargo';
import { CARGO_ENTRIES, isSeaTradeHub } from '../engine/seaVoyage';

/**
 * PARITÉ des CHAMPS DÉCLARÉS qui ont remplacé un branchement par id (#1318 E4/C4-δ2).
 *
 * Six comportements particuliers vivaient dans le moteur sous forme de test d'identité
 * (`t.id === 'arme'`, `t.id !== 'bestial'`, `builtinId === 'mains-nues'`…). Ils vivent désormais sur
 * l'ENTRÉE du registre — soit par une déclaration NEUVE (`nonTransferable`, `unarmed`, `improvised`,
 * `altChar`, `grantsArcaneDomain`), soit par une déclaration DÉJÀ PORTÉE quand elle dit exactement la
 * précondition du site (`specsSource`). Ce fichier verrouille la MESURE : les entrées qui portent la
 * marque aujourd'hui sont EXACTEMENT celles que le moteur nommait — ni une de plus (un comportement
 * accordé par mégarde à une autre entrée), ni une de moins (le comportement perdu en silence).
 *
 * C'est le pendant du plafond `src/ui/registry-id-branch-guard.test.ts` : là-bas on compte les
 * branchements restants, ici on prouve que leur remplacement DÉCLARÉ couvre la même population.
 */
describe('#1318 E4/C4-δ2 — parité « le moteur ne nomme plus d’id, l’entrée porte la marque »', () => {
  it('TRAITS — armement : `specsSource` des catalogues d’armes = exactement les deux Traits d’armement', () => {
    // `weaponFromTrait` route sur CE champ et le passe tel quel à `catalogItem` : la source déclarée EST
    // le catalogue de résolution, donc aucun second champ ne peut se désynchroniser d'elle.
    const armes = traits.filter((t) => t.specsSource === 'weaponsMelee' || t.specsSource === 'weaponsRanged');
    expect(armes.map((t) => `${t.id}:${t.specsSource}`).sort()).toEqual(['a-distance:weaponsRanged', 'arme:weaponsMelee']);
  });

  it('TRAITS — `nonTransferable` : exactement Bestial (engine/polymorph, LDB 48 l.23)', () => {
    expect(traits.filter((t) => t.nonTransferable).map((t) => t.id)).toEqual(['bestial']);
  });

  it('POSSESSIONS — `unarmed` : exactement les Mains nues, et le prédicat du moteur les lit', () => {
    expect(trappings.filter((t) => t.unarmed).map((t) => t.id)).toEqual(['mains-nues']);
    expect(isUnarmedTrapping('mains-nues')).toBe(true);
    expect(isUnarmedTrapping('epee')).toBe(false);
    expect(isUnarmedTrapping(undefined)).toBe(false);
  });

  it('POSSESSIONS — `improvised` : exactement l’Arme improvisée, et le prédicat du moteur la lit', () => {
    expect(trappings.filter((t) => t.improvised).map((t) => t.id)).toEqual(['arme-improvisee']);
    expect(isImprovisedTrapping('arme-improvisee')).toBe(true);
    expect(isImprovisedTrapping('mains-nues')).toBe(false);
    expect(isImprovisedTrapping(undefined)).toBe(false);
  });

  it('COMPÉTENCES — `specsSource: weaponGroupsMelee` : exactement Corps à corps (conjuredWeapons, combat.parryPenalty)', () => {
    // Une compétence dont les SPÉ sont les Groupes d'armes de mêlée — la garantie même dont les deux
    // sites ont besoin (`spec` = id de Groupe).
    expect(skills.filter((s) => s.specsSource === 'weaponGroupsMelee').map((s) => s.id)).toEqual(['corps-a-corps']);
  });

  it('TALENTS — `grantsArcaneDomain` : exactement Magie des Arcanes (engine/careerSlots)', () => {
    // Champ DÉDIÉ, pas `specsSource` : le plafond `LDB 46 l.177` porte sur le Talent qui fait PRATIQUER
    // un Domaine — nommer un Domaine dans son pool de spec ne suffirait pas à peser au plafond.
    expect(talents.filter((t) => t.grantsArcaneDomain).map((t) => t.id)).toEqual(['magie-des-arcanes']);
  });

  it('COMPÉTENCES — `altChar` : exactement Métier et Intimidation, chaque carac citée étant une CharKey réelle', () => {
    const porteuses = skills.filter((s) => s.altChar).map((s) => s.id).sort();
    expect(porteuses).toEqual(['intimidation', 'metier']);
    // Les caracs citées sont des ids de Caractéristique (`CharKey`), jamais des libellés.
    const connues = new Set<string>(CHAR_KEYS);
    const citees = skills.flatMap((s) => Object.values(s.altChar?.chars ?? {})).flat();
    expect(citees.filter((k) => !connues.has(k))).toEqual([]);
    expect(citees.length).toBeGreaterThan(0);
  });

  it('COMPÉTENCES — `altChar.chars` : aucune clé INATTEIGNABLE (une coquille rendrait l’option morte en silence)', () => {
    // La classe de bug d'origine : le code comparait la valeur de règle à `'force-mentale'` quand le
    // panneau écrit `'FM'` — deux options mortes, trois tests verts. Le schéma (`z.record`) accepte
    // n'importe quelle clé : la liaison clé ↔ valeur ATTEIGNABLE de la règle se vérifie donc ici, en
    // dérivant les valeurs du registre des règles (jamais une liste recopiée).
    const atteignables = (ruleId: string): string[] => {
      const regle = ruleDef(ruleId);
      if (!regle) return [];
      if (regle.kind === 'flag') return ['true', 'false'];
      if (regle.kind === 'mode') return (regle.options ?? []).map(String);
      return []; // `param` : aucun ensemble fermé de valeurs — une carac par valeur numérique n'aurait pas de sens
    };
    const fautives = skills.flatMap((s) =>
      Object.keys(s.altChar?.chars ?? {})
        .filter((k) => !atteignables(s.altChar!.gatedByRule).includes(k))
        .map((k) => `${s.id} → « ${k} » hors des valeurs de la règle ${s.altChar!.gatedByRule} [${atteignables(s.altChar!.gatedByRule).join(', ')}]`),
    );
    expect(fautives, 'clé de `altChar.chars` qu’aucune valeur de la règle ne produira jamais').toEqual([]);
    // La garde n'est pas vide-et-verte : elle mesure bien des clés réelles.
    expect(skills.flatMap((s) => Object.keys(s.altChar?.chars ?? {})).length).toBeGreaterThan(0);
  });
});

/**
 * MÊME contrat, couche ACTIVITÉS/UI (#1318 E4/C4-δ3) : les branchements par id de la modale du Conseil
 * de bord, du Test d'équipage, de la bataille de masse, du voyage en mer, du hub de ville, des tables
 * de Maladresse et des Incidents de monte sont remplacés par des CHAMPS DÉCLARÉS. Chaque test fixe la
 * POPULATION porteuse : exactement les entrées que le code nommait, ni une de plus, ni une de moins.
 */
describe('#1318 E4/C4-δ3 — parité des champs déclarés de la couche activités/UI', () => {
  it('MORAL — `recommendedPay` : exactement la paie régulière (CTA du Conseil de bord)', () => {
    expect(MORALE_FACTORS.filter((f) => f.recommendedPay).map((f) => f.id)).toEqual(['paie-reguliere']);
    // …et le choix GRATUIT que la modale offrait toujours reste dérivable de son barème (`wageMul: 0`).
    expect(MORALE_FACTORS.filter((f) => f.wageMul === 0).map((f) => f.id)).toEqual(['pas-de-paie']);
  });

  it('TESTS D’ÉQUIPAGE — `moraleOnNegativeDR` : exactement Rude épreuve (MDG 14 l.110)', () => {
    expect(crewTestTypes.filter((t) => t.moraleOnNegativeDR).map((t) => t.id)).toEqual(['rude-epreuve']);
  });

  it('TESTS D’ÉQUIPAGE — `steering` : exactement la Manœuvre (Test qui DIRIGE, MDG 14 l.76)', () => {
    expect(crewTestTypes.filter((t) => t.steering).map((t) => t.id)).toEqual(['manoeuvre']);
  });

  it('ACTIVITÉS DE BATAILLE — `testModFrom` : exactement Planification, sur le réservoir que les autres créditent', () => {
    const plan = activityById('planification')!;
    expect(plan.testModFrom).toBe('planningBonus');
    // Le réservoir LU est bien celui que Repérage/Infiltration ALIMENTENT (ADE II 8 l.75/100) :
    // la paire producteur ⇄ consommateur se mesure, elle n'est pas recopiée à la main.
    const crediteurs = ['reperage', 'infiltration']
      .map((id) => activityById(id)!)
      .filter((d) => (d.outcomes ?? []).some((b) => (b.battle ?? []).some((o) => o.target === plan.testModFrom)));
    expect(crediteurs.map((d) => d.id)).toEqual(['reperage', 'infiltration']);
  });

  it('ACTIVITÉS DE BATAILLE — `difficultyFrom` : exactement le Discours inspirant (écart de Puissance, l.71)', () => {
    const porteuses = ['inspire', 'planification', 'infiltration', 'reperage', 'sabotage', 'rassembler-des-forces']
      .map((id) => activityById(id)!)
      .filter((d) => d.difficultyFrom);
    expect(porteuses.map((d) => d.id)).toEqual(['inspire']);
    expect(porteuses[0].difficultyFrom).toEqual({ gap: 'armyMight', roundTo: 10 });
  });

  it('SERVICES DE LIEU — `opensScreen` : exactement le chantier naval (porte de l’écran de port, #369)', () => {
    expect(lieuxServices.filter((s) => s.opensScreen).map((s) => `${s.id}:${s.opensScreen}`)).toEqual(['chantier:port']);
    // Un service qui porte vers un écran porte son libellé d'entrée (sinon le bouton retombe sur un repli).
    expect(lieuxServices.filter((s) => s.opensScreen && !s.enterLabel)).toEqual([]);
  });

  it('MALADRESSES — `codexCategory` : exactement les trois tableaux du Livre de base', () => {
    expect(MISCAST_TABLES.filter((t) => t.codexCategory).map((t) => `${t.id}:${t.codexCategory}`)).toEqual([
      'miscast-mineure:miscastMinor', 'miscast-majeure:miscastMajor', 'miscast-colere:miscastWrath',
    ]);
    // Les deux tables RÉVISÉES par les Vents de Magie n'en ont pas (un renvoi y serait mort).
    expect(MISCAST_TABLES.filter((t) => !t.codexCategory).map((t) => t.id)).toEqual(['miscast-mineure-vdm', 'miscast-majeure-vdm']);
  });

  it('INCIDENTS DE MONTE — chaque suite mécanique porte exactement les entrées que le moteur nommait (EDOC 07)', () => {
    const porteuses = (pred: (m: NonNullable<(typeof MOUNT_INCIDENTS)[number]['mount']>) => unknown): string[] =>
      MOUNT_INCIDENTS.filter((e) => e.mount && pred(e.mount)).map((e) => e.id);
    expect(porteuses((m) => m.riderTest)).toEqual(['sangle-cassee', 'perte-d-un-fer']);   // l.166/l.171
    expect(porteuses((m) => m.ridingPenalty)).toEqual(['sangle-cassee']);                 // l.174 (−20)
    expect(porteuses((m) => m.forcedAllure)).toEqual(['perte-d-un-fer']);                 // « doit se déplacer au pas »
    expect(porteuses((m) => m.preventsMount)).toEqual(['boiteux', 'patte-brisee']);       // l.159 / l.161
    expect(porteuses((m) => m.notHealedByCare)).toEqual(['patte-brisee']);
    // Fragments d'AFFICHAGE dérivés du verbatim : toute séquelle à durée BORNÉE dit sa condition de fin
    // (sinon le joueur perdrait « jusqu'à réparation » / « jusqu'au maréchal-ferrant »), et l'issue
    // de la bête n'est portée que là où le RAW en pose une.
    expect(porteuses((m) => m.endCondition)).toEqual(['sangle-cassee', 'perte-d-un-fer']);
    expect(porteuses((m) => m.outcome)).toEqual(['patte-brisee']);
    const bornees = MOUNT_INCIDENTS.filter((e) => e.mount && (e.mount.ridingPenalty || e.mount.forcedAllure) && !e.mount.notHealedByCare);
    expect(bornees.filter((e) => !e.mount!.endCondition).map((e) => e.id), 'séquelle bornée sans condition de fin affichée').toEqual([]);
    // Toute entrée de la table porte une suite (aucun incident muet), et les valeurs sont celles du RAW.
    expect(MOUNT_INCIDENTS.filter((e) => !e.mount)).toEqual([]);
    const sangle = MOUNT_INCIDENTS.find((e) => e.id === 'sangle-cassee')!.mount!;
    expect(sangle.ridingPenalty).toBe(-20);
    expect(sangle.riderTest).toEqual({ skill: { id: 'chevaucher' }, char: 'agilite', difficulty: 'complexe', fallM: 2 });
  });

  it('CARGAISONS — `tradeHub` : exactement le marqueur « Commerce » des DEUX catalogues, et les deux commerces le lisent', () => {
    // Le concept « plaque tournante » vivait sur 6 sites `production.includes('commerce')` : il est
    // désormais DÉCLARÉ sur l'entrée marqueur, lu par `isTradeHubEntry` (`engine/cargo.ts`).
    expect(LAND_CARGO_ENTRIES.filter(isTradeHubEntry).map((e) => e.id)).toEqual(['commerce']);
    expect(CARGO_ENTRIES.filter(isTradeHubEntry).map((e) => e.id)).toEqual(['commerce']);
    // Les autres marqueurs (« Subsistance », « Minimum vital ») ne le portent PAS.
    expect(LAND_CARGO_ENTRIES.filter((e) => !isEchangeable(e) && !isTradeHubEntry(e)).map((e) => e.id)).toEqual(['subsistance']);
    expect(CARGO_ENTRIES.filter((e) => !isEchangeable(e) && !isTradeHubEntry(e)).map((e) => e.id)).toEqual(['minimum-vital']);
    // …et les deux prédicats de colonne le lisent, chacun sur SON catalogue.
    expect(isLandTradeHub(['commerce', 'vin'])).toBe(true);
    expect(isLandTradeHub(['subsistance', 'vin'])).toBe(false);
    expect(isLandTradeHub(undefined)).toBe(false);
    expect(isSeaTradeHub(['commerce'])).toBe(true);
    expect(isSeaTradeHub(['minimum-vital'])).toBe(false);
  });
});

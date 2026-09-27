/**
 * #1694 train B2 — CONTRAT POSITIF des enums de GRAMMAIRE nommés (ceux que plusieurs defs partagent,
 * et ceux de l'algèbre `Condition`). Même contrat que `defs/enums-nommes.test.ts` : la table du nœud
 * est la SEULE, dans l'ordre de ses options, et le site d'affichage ne fait que la lire.
 *
 * Deux verrous s'ajoutent ici, propres aux enums PARTAGÉS :
 *  — `specsSourceSchema` couvre EXACTEMENT le catalogue `SPEC_SOURCES` (SSOT du runtime) : une source
 *    ajoutée là-bas sans son libellé ici rougit, au lieu de retomber en silence sur sa clé technique
 *    (ce que faisait le `Partial` du Record mort) ;
 *  — les nœuds de l'algèbre sont UNIQUES : `conditionSchema` est un `z.lazy` non mémoïsé, une
 *    déclaration inline sous lui rendrait un jumeau par déroulé (1 475 mesurés pour `who`).
 */
import { describe, it, expect } from 'vitest';
import { valeursDe, libelleDeValeur } from './meta';
import {
  specsSourceSchema,
  symptomSeveritySchema,
  mutationKindSchema,
  chaosAlignSchema,
  exposureLevelSchema,
  dir8Schema,
  shipSizeSchema,
} from './valeurs';
import {
  actorRefSchema,
  actorFieldSchema,
  hasWhatSchema,
  partyWhoSchema,
  relationOrCampSchema,
  startleCauseSchema,
  effectOnSchema,
  effectTriggerSchema,
  senseSchema,
} from './mecanique';
import { SPEC_SOURCES } from '../../index';

/** Un vocabulaire migré : son nœud, et la table FR ATTENDUE — dans l'ordre de ses options. */
const MIGRES: readonly [string, unknown, Record<string, string>][] = [
  ['skills|talents|traits.specsSource', specsSourceSchema, {
    weaponGroupsMelee: 'Groupes d’arme (mêlée)', weaponGroupsRanged: 'Groupes d’arme (distance)',
    winds: 'Vents de magie', arcaneDomains: 'Domaines arcaniques', cultBlessings: 'Bénédictions (dieux)',
    cultMiracles: 'Miracles (dieux)', cultChaos: 'Magie du Chaos (dieux)', seaShanties: 'Chansons de marin',
    groups: 'Groupes (créatures/factions)', diseases: 'Maladies', sizes: 'Tailles', mutations: 'Mutations',
    breathTypes: 'Types de Souffle', damageTypes: 'Types de Dégâts (immunité)',
    weaponsMelee: 'Armes de mêlée', weaponsRanged: 'Armes à distance',
  }],
  ['maladies.symptoms[].severity + ops aggravateSymptom/grantSymptom', symptomSeveritySchema, {
    moderee: 'Modérée', grave: 'Grave',
  }],
  ['Condition.who (acteur désigné)', actorRefSchema, { target: 'la cible', caster: 'le lanceur' }],
  ['Condition compare.subject.field', actorFieldSchema, {
    woundsCurrent: 'PB courants', woundsMax: 'PB max', size: 'Taille', advantage: 'Avantage',
  }],
  ['Condition has.what', hasWhatSchema, {
    group: 'le Groupe', talent: 'le Talent', trait: 'le Trait', psych: 'l’état psy',
  }],
  ['Condition partyDead|skill|career|species|status.who', partyWhoSchema, {
    any: 'un héros au moins', all: 'tout le groupe',
  }],
  ['Condition relation.is', relationOrCampSchema, {
    self: 'soi-même', ally: 'allié (même camp)', opponent: 'adversaire (camp ≠)',
    party: 'du groupe (joueur)', neutral: 'neutre (PNJ)', hostile: 'hostile (ennemi)',
  }],
  ['Condition startleCause.is', startleCauseSchema, { noise: 'Bruits forts', magic: 'Magie' }],
  ['TriggeredEffect.on (cible simple)', effectOnSchema, {
    self: 'soi-même', victim: 'la victime', engaged: 'les adversaires engagés',
    grappled: 'la victime empoignée (absorbée)',
  }],
  ['TriggeredEffect.trigger', effectTriggerSchema, {
    onHit: 'À la touche', onCrit: 'Sur un Critique', onWoundLoss: 'En perdant des PB',
    onSlain: 'À sa mise hors de combat', onRoundStart: 'Au début du Round',
    onStartled: 'Surpris (magie / bruit)', onKill: 'En tuant un adversaire', onCharged: 'Quand Chargé',
    onGainCondition: 'En gagnant un État', onCombatStart: 'Au début du combat',
    onCombatEnd: 'À la fin du combat', onRoundEnd: 'À la fin du Round', onTurnStart: 'Au début de son tour',
    onTurnEnd: 'À la fin de son tour', onDayStart: 'Au début de chaque jour', onWake: 'Au réveil',
    onAttackResolved: 'Après une attaque résolue', onCastResolved: 'Après une incantation résolue',
    onMiscast: 'Sur une Imparfaite', onOwnTestFailed: 'En échouant à un Test',
  }],
  ['op corruption.align + effet de scène corruption.align', chaosAlignSchema, {
    toute: 'Toute Puissance', khorne: 'Khorne', nurgle: 'Nurgle', slaanesh: 'Slaanesh', tzeentch: 'Tzeentch',
  }],
  ['op corruptionExposure.level + effet de scène corruptionExposure.level', exposureLevelSchema, {
    mineure: 'mineure', moderee: 'modérée', majeure: 'majeure',
  }],
  ['scene.entities[].facing + props.places[].facing (Dir8)', dir8Schema, {
    N: 'Nord', NE: 'Nord-Est', E: 'Est', SE: 'Sud-Est', S: 'Sud', SO: 'Sud-Ouest', O: 'Ouest', NO: 'Nord-Ouest',
  }],
  ['ship-construction.size + sea-perils.min|maxSize + ship-criticals.tailles[]', shipSizeSchema, {
    minuscule: 'Minuscule', 'tres-petite': 'Très petite', petite: 'Petite', moyenne: 'Moyenne',
    grande: 'Grande', enorme: 'Énorme', monstrueuse: 'Monstrueuse',
  }],
  ['FlowTest.sense (op senseLoss)', senseSchema, { vue: 'la vue', ouie: "l'ouïe" }],
];

describe('enums de GRAMMAIRE nommés (#1694 B2) — le libellé de chaque VALEUR vit sur son nœud', () => {
  for (const [chemin, noeud, attendu] of MIGRES) {
    it(`${chemin} : toutes ses options portent leur libellé FR`, () => {
      const valeurs = valeursDe(noeud);
      expect(valeurs, `${chemin} n’est pas un enum NOMMÉ`).toBeDefined();
      expect(Object.keys(valeurs!)).toEqual(Object.keys(attendu));
      expect(valeurs).toEqual(attendu);
      for (const [v, l] of Object.entries(attendu)) expect(libelleDeValeur(noeud, v)).toBe(l);
    });
  }

  it('les options d’un enum nommé SONT les clés de sa table — aucun libellé orphelin', () => {
    for (const [chemin, noeud] of MIGRES) {
      expect((noeud as { options: string[] }).options, chemin).toEqual(Object.keys(valeursDe(noeud)!));
    }
  });

  it('`specsSource` couvre EXACTEMENT le catalogue SPEC_SOURCES, dans son ordre', () => {
    expect(Object.keys(valeursDe(specsSourceSchema)!)).toEqual(Object.keys(SPEC_SOURCES));
  });

  it('un enum de grammaire est UNE instance — deux nœuds de même vocabulaire ne coexistent pas', () => {
    // `mutationKindSchema` (B1) est le témoin du patron : un vocabulaire partagé = une const importée.
    expect(valeursDe(mutationKindSchema)).toEqual({ physique: 'Physique', mentale: 'Mentale' });
    // Aucun des nœuds de l'algèbre n'est identique à un autre : ils portent des univers distincts.
    const noeuds = MIGRES.map(([, n]) => n);
    expect(new Set(noeuds).size).toBe(noeuds.length);
  });
});

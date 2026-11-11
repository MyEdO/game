/**
 * LE CHOIX D'UNE FENÊTRE (#3369) : `fenetreChoisir(fenetre, axe, valeur)` joue le corps que `CorpsDesChoix` donne à
 * l'axe, parmi les valeurs que l'état lui ouvre (`OUVERTS_DU_CHOIX`), et refuse le reste en le disant ; en coop, il suit
 * le siège que sa déclaration nomme (`CHOIX_DES_FENETRES`, `netOwnership.ROUTES`) : l'hôte seul, ou le propriétaire de
 * la fenêtre nommée, jamais celui de la modale qui tient la main.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet } from './etat';
import { intentAllowedFor } from './netOwnership';
import { modalOwnerOf } from './modalArbiter';
import { siegeDe } from './sieges';
import type { ArgumentsDuChoix } from './choixDesFenetres';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { t } from '../i18n';
import { libelleDeLaFermeture } from './libelles';
import { refusDeLaValidationNommee } from './validationDeFenetre';
import { withBourseMoney } from '../engine/bourse';
import type { Combatant } from '../engine/types';

/** Coop : l'hôte (siège 0) et un invité (siège 1), un héros chacun. */
function hoteEtUnInvite(banc: Banc): { a: string; b: string } {
  const [a, b] = groupeDeScenario(idsDeTest, 'soldat', 'tueur');
  banc.setState({ party: [a, b], net: { ...initialNet(), mode: 'hote', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Invité' }, ownership: { [a.id]: 0, [b.id]: 1 }, slots: [1, 1, 0, 0] } });
  return { a: a.id, b: b.id };
}

/** Chaque choix que l'hôte seul joue, l'état qui ouvre sa fenêtre, et le champ qui reste tant qu'il ne se joue pas. */
const CHOIX_DE_L_HOTE: readonly (readonly [string, ArgumentsDuChoix, Record<string, unknown>])[] = [
  ['conseil', ['conseil', 'paie', 'pas-de-paie'], { pendingCouncil: { today: 7, wageBrass: 240, phase: 'choix' } }],
  ['relacheATerre', ['relacheATerre', 'accorder', true], { pendingShoreLeave: { to: { id: 'B', label: 'B' } } }],
  ['finDeSeance', ['finDeSeance', 'ambitionCourte', true], { finDeSeance: { heros: {}, groupe: {} } }],
  ['port', ['port', 'vendre', 'lot-1'], { port: { placeId: 'P', label: 'Port', port: { taille: 4, richesse: 4, production: [] }, offers: [] } }],
  ['marcheDeTerre', ['marcheDeTerre', 'offre', 'metal'], { landMarket: { placeId: 'A', label: 'Halle', market: { taille: 4, richesse: 4, produits: [] }, offers: [] } }],
  ['ecranDuLieu', ['ecranDuLieu', 'entrer', 'poi-cave'], { lieuOuvert: true }],
];

describe('fenetreChoisir', () => {
  it('un choix que la fenêtre ne déclare pas, une fenêtre fermée, une valeur que l’état n’ouvre pas : refusés et dits', () => {
    const banc = ouvrirLeBanc();
    banc.getState().fenetreChoisir(...(['cascade', 'abandon', true] as unknown as ArgumentsDuChoix));
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('choix.refus.inconnu'));
    banc.getState().fenetreChoisir('renier', 'renier', true);
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('choix.refus.fermee'));
    const { a } = hoteEtUnInvite(banc);
    banc.setState({ pendingFateSave: { heroId: a, source: 'slow' } as never });
    banc.getState().fenetreChoisir('destin', 'issue', 'eviter');
    expect(banc.getState().journal.slice(-1)[0], 'une mort lente ne s’évite pas (LDB 17 l.31)').toBe(t('choix.refus.valeur'));
    expect(banc.getState().pendingFateSave, 'la fenêtre reste ouverte').not.toBeNull();
    expect(intentAllowedFor(banc.getState(), 0, 'fenetreChoisir', ['destin', 'inconnu', 'eviter']), 'axe inconnu : aucun siège').toBe(false);
  });

  it.each(CHOIX_DE_L_HOTE)('le choix de l’hôte reste à l’hôte (%s) : refusé dans l’état d’un invité, et au siège d’un invité', (_fenetre, args, ouverte) => {
    const banc = ouvrirLeBanc();
    hoteEtUnInvite(banc);
    banc.setState({ ...ouverte, net: { ...banc.getState().net, mode: 'invite' } } as never);
    const avant = banc.getState();
    banc.getState().fenetreChoisir(...args);
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('choix.refus.hoteSeul'));
    for (const cle of Object.keys(ouverte)) expect((banc.getState() as unknown as Record<string, unknown>)[cle], 'la fenêtre reste ouverte').toBe((avant as unknown as Record<string, unknown>)[cle]);

    banc.setState({ net: { ...banc.getState().net, mode: 'hote' } });
    expect(intentAllowedFor(banc.getState(), 1, 'fenetreChoisir', args), 'au siège d’un invité').toBe(false);
    expect(intentAllowedFor(banc.getState(), 0, 'fenetreChoisir', args), 'au siège de l’hôte').toBe(true);
  });

  it('le choix du propriétaire suit son siège : une seule modale ouverte, le même siège que celui de la modale', () => {
    const banc = ouvrirLeBanc();
    const { b } = hoteEtUnInvite(banc);
    const ouvertes: readonly (readonly [Record<string, unknown>, ArgumentsDuChoix])[] = [
      [{ pendingFateSave: { heroId: b, source: 'slow' } }, ['destin', 'issue', 'survivre']],
      [{ pendingRenounce: { heroId: b, testRoll: 90, testTarget: 30 } }, ['renier', 'renier', false]],
      [{ battle: { order: [b], turn: 0, combatants: [] }, pendingMountTarget: { riderId: 'r', mountId: 'm' } }, ['cibleDeMonture', 'cible', 'r']],
    ];
    for (const [etat, args] of ouvertes) {
      banc.setState({ pendingFateSave: null, pendingRenounce: null, pendingMountTarget: null, battle: null, ...etat } as never);
      const s = banc.getState();
      expect(siegeDe(s, modalOwnerOf(s) as string), `${args[0]} : la modale est à l’invité`).toBe(1);
      expect([0, 1].filter((siege) => intentAllowedFor(s, siege, 'fenetreChoisir', args)), `${args[0]} : le choix aussi`).toEqual([1]);
    }
  });

  it('deux fenêtres ouvertes : le choix suit le propriétaire de la fenêtre qu’il nomme, pas la modale qui tient la main', () => {
    const banc = ouvrirLeBanc();
    const { a, b } = hoteEtUnInvite(banc);
    banc.setState({ pendingFateSave: { heroId: b, source: 'slow' }, pendingRenounce: { heroId: a, testRoll: 90, testTarget: 30 } } as never);
    const s = banc.getState();
    expect(siegeDe(s, modalOwnerOf(s) as string), 'le Destin, à l’invité, tient la main').toBe(1);
    expect([0, 1].filter((siege) => intentAllowedFor(s, siege, 'fenetreChoisir', ['renier', 'renier', true])), 'la mutation se renie au siège de son héros').toEqual([0]);
    expect([0, 1].filter((siege) => intentAllowedFor(s, siege, 'fenetreChoisir', ['destin', 'issue', 'survivre'])), 'le Destin, au siège du sien').toEqual([1]);
  });

  it('la décision de groupe (dialogue, désignation) suit le siège du MONDE : l’hôte, ou le MJ posé', () => {
    const banc = ouvrirLeBanc();
    const { a } = hoteEtUnInvite(banc);
    const decisions: readonly (readonly [Record<string, unknown>, string, unknown[]])[] = [
      [{ dialogue: { dialogue: { id: 'd', nodes: {} }, nodeId: 'n1', session: 1 } }, 'fenetreChoisir', ['dialogue', 'reponse', 'r1']],
      [{ pendingDesignationHeros: { etat: 'sosie', suite: [] } }, 'fenetreChoisir', ['designationHeros', 'heros', a]],
      [{ pendingDesignationHeros: { etat: 'sosie', suite: [] } }, 'fenetreFermer', ['designationHeros']],
    ];
    for (const [etat, intent, args] of decisions) {
      for (const [gmSeat, siege] of [[undefined, 0], [1, 1]] as const) {
        banc.setState({ dialogue: null, pendingDesignationHeros: null, ...etat, net: { ...banc.getState().net, gmSeat } } as never);
        expect([0, 1].filter((x) => intentAllowedFor(banc.getState(), x, intent, args)), `${intent} ${String(args[0])}, MJ ${String(gmSeat)}`).toEqual([siege]);
      }
    }
  });

  it('la désignation ne se ferme pas tant qu’un héros vit : la sortie est refusée et dite', () => {
    const banc = ouvrirLeBanc();
    hoteEtUnInvite(banc);
    banc.setState({ pendingDesignationHeros: { etat: 'sosie', suite: [] } } as never);
    banc.getState().fenetreFermer('designationHeros');
    expect(banc.getState().journal.slice(-1)[0]).toBe(libelleDeLaFermeture('herosADesigner'));
    expect(banc.getState().pendingDesignationHeros, 'la désignation reste ouverte').not.toBeNull();
  });

  describe('la semaine en mer (MDG 15 l.268) : un choix par héros, à son siège', () => {
    /** La semaine ouverte, sur un navire à la cale libre ; `a` sait cartographier, chacun a `bourse` CO. */
    function semaine(banc: Banc, bourse = 5): { a: string; b: string } {
      const { a, b } = hoteEtUnInvite(banc);
      banc.setState({
        party: banc.getState().party.map((h) => withBourseMoney(h.id === a ? { ...h, skills: [...h.skills, { id: 'metier', spec: 'cartographe', advances: 10 }] } as Combatant : h, { gold: bourse, silver: 0, brass: 0 }, idsDeTest)),
        vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [] },
        pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 40, hours: 24, lines: [] } },
      } as never);
      return { a, b };
    }

    it('chaque héros choisit à SON siège : la route suit le héros de la rangée, le choix du héros d’un autre siège se refuse et se dit', () => {
      const banc = ouvrirLeBanc();
      const { a, b } = semaine(banc);
      const s = banc.getState();
      expect([0, 1].filter((x) => intentAllowedFor(s, x, 'fenetreChoisir', ['activitesEnMer', 'activite', 'cartographie', a])), 'le héros de l’hôte').toEqual([0]);
      expect([0, 1].filter((x) => intentAllowedFor(s, x, 'fenetreChoisir', ['activitesEnMer', 'activite', null, b])), 'le héros de l’invité').toEqual([1]);
      banc.getState().fenetreChoisir('activitesEnMer', 'activite', null, b);
      expect(banc.getState().journal.slice(-1)[0], 'l’hôte ne choisit pas pour le héros de l’invité').toBe(t('choix.refus.autreSiege'));
      banc.getState().fenetreChoisir('activitesEnMer', 'activite', 'cartographie');
      expect(banc.getState().journal.slice(-1)[0], 'un choix de rangée sans héros').toBe(t('choix.refus.rangee'));
      banc.getState().fenetreChoisir('activitesEnMer', 'activite', 'cartographie', a);
      expect(banc.getState().pendingSeaActivities?.picks[a]).toEqual({ activityId: 'cartographie' });
    });

    it('la mise et la planque ne s’ouvrent qu’à leur Activité, bornées par la bourse (MDG 15 l.276, l.292)', () => {
      const banc = ouvrirLeBanc();
      const { a } = semaine(banc);
      banc.getState().fenetreChoisir('activitesEnMer', 'cacher', 1, a);
      expect(banc.getState().journal.slice(-1)[0], 'aucune planque sans Cartographie').toBe(t('choix.refus.valeur'));
      banc.getState().fenetreChoisir('activitesEnMer', 'activite', 'cartographie', a);
      banc.getState().fenetreChoisir('activitesEnMer', 'cacher', 6, a);
      expect(banc.getState().journal.slice(-1)[0], 'la planque passe la bourse du cartographe (5 CO)').toBe(t('choix.refus.bornes'));
      banc.getState().fenetreChoisir('activitesEnMer', 'cacher', 5, a);
      expect(banc.getState().pendingSeaActivities?.picks[a]).toEqual({ activityId: 'cartographie', stashGold: 5 });
      banc.getState().fenetreChoisir('activitesEnMer', 'activite', 'commerce-opportunite', a);
      expect(banc.getState().pendingSeaActivities?.picks[a], 'une autre Activité efface la planque').toEqual({ activityId: 'commerce-opportunite' });
      banc.getState().fenetreChoisir('activitesEnMer', 'investir', 11, a);
      expect(banc.getState().journal.slice(-1)[0], 'la mise passe la bourse du groupe (2 × 5 CO)').toBe(t('choix.refus.bornes'));
      banc.getState().fenetreChoisir('activitesEnMer', 'investir', 10, a);
      expect(banc.getState().pendingSeaActivities?.picks[a]).toEqual({ activityId: 'commerce-opportunite', investGold: 10 });
    });

    it('la mise et la planque se partagent les bourses du groupe : ce qu’un choix engage ne s’engage plus pour un autre (MDG 15 l.276, l.292)', () => {
      const banc = ouvrirLeBanc();
      const { a, b } = semaine(banc);
      banc.setState({ net: { ...banc.getState().net, ownership: { [a]: 0, [b]: 0 } } });
      banc.getState().fenetreChoisir('activitesEnMer', 'activite', 'cartographie', a);
      banc.getState().fenetreChoisir('activitesEnMer', 'cacher', 4, a);
      banc.getState().fenetreChoisir('activitesEnMer', 'activite', 'commerce-opportunite', b);
      banc.getState().fenetreChoisir('activitesEnMer', 'investir', 7, b);
      expect(banc.getState().journal.slice(-1)[0], 'la mise passe ce que la planque laisse des 2 × 5 CO').toBe(t('choix.refus.bornes'));
      banc.getState().fenetreChoisir('activitesEnMer', 'investir', 6, b);
      banc.getState().fenetreChoisir('activitesEnMer', 'cacher', 5, a);
      expect(banc.getState().journal.slice(-1)[0], 'la planque passe ce que la mise laisse').toBe(t('choix.refus.bornes'));
      expect(banc.getState().pendingSeaActivities?.picks).toEqual({ [a]: { activityId: 'cartographie', stashGold: 4 }, [b]: { activityId: 'commerce-opportunite', investGold: 6 } });
    });

    it('un choix que l’état ne tient plus (héros réédité, bourse, cale) ferme la validation de la semaine, jusqu’à ce qu’il se reprenne', () => {
      const banc = ouvrirLeBanc();
      const { a } = semaine(banc);
      const ferme = () => {
        banc.getState().fenetreValider('activitesEnMer');
        expect(banc.getState().journal.slice(-1)[0]).toBe(libelleDeLaFermeture('choixAReprendre'));
        expect(banc.getState().pendingSeaActivities?.opportunityQueue, 'rien ne se résout').toBeUndefined();
      };
      const heros = () => banc.getState().party.find((h) => h.id === a)!;
      const reedite = (h: Combatant) => banc.setState({ party: banc.getState().party.map((x) => (x.id === a ? h : x)) });
      banc.getState().fenetreChoisir('activitesEnMer', 'activite', 'cartographie', a);
      reedite({ ...heros(), skills: heros().skills.filter((sk) => sk.id !== 'metier') });
      ferme();
      banc.getState().fenetreChoisir('activitesEnMer', 'activite', 'commerce-opportunite', a);
      banc.getState().fenetreChoisir('activitesEnMer', 'investir', 10, a);
      reedite(withBourseMoney(heros(), { gold: 0, silver: 0, brass: 0 }, idsDeTest));
      ferme();
      banc.getState().fenetreChoisir('activitesEnMer', 'investir', 5, a);
      expect(refusDeLaValidationNommee(banc.getState(), 'activitesEnMer'), 'la mise reprise dans la bourse qui reste').toBeNull();
      banc.setState({ vessel: { ...banc.getState().vessel!, cargo: [{ uid: 'lot-1', cargoId: 'bois-mer', enc: 100_000, basePriceGold: 10 }] } } as never);
      ferme();
      banc.getState().fenetreChoisir('activitesEnMer', 'activite', null, a);
      expect(refusDeLaValidationNommee(banc.getState(), 'activitesEnMer'), 'le Repos repris').toBeNull();
    });

    it('l’hôte seul valide la semaine : refusée dans l’état d’un invité et au siège d’un invité, la semaine reste ouverte', () => {
      const banc = ouvrirLeBanc();
      semaine(banc);
      expect([0, 1].filter((x) => intentAllowedFor(banc.getState(), x, 'fenetreValider', ['activitesEnMer']))).toEqual([0]);
      banc.setState({ net: { ...banc.getState().net, mode: 'invite' } });
      banc.getState().fenetreValider('activitesEnMer');
      expect(banc.getState().journal.slice(-1)[0]).toBe(t('validation.refus.hoteSeul'));
      expect(banc.getState().pendingSeaActivities, 'la semaine reste ouverte').not.toBeNull();
    });
  });

  describe('le butin, l’échoppe et la nuit (#3371) : chaque axe au siège que sa déclaration nomme', () => {
    /** Le butin de victoire et hors combat, l'échoppe et la nuit ouverts ensemble, une ligne de chaque. */
    function tout(banc: Banc): { a: string; b: string } {
      const { a, b } = hoteEtUnInvite(banc);
      const gear = [{ uid: 'L0', label: 'Épée', magic: false, effect: { type: 'giveTrapping', trappingId: 'epee' } }];
      banc.setState({
        pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, gear, defeated: [], harvested: [] },
        pendingLoot: { title: 'Coffre', gear },
        pendingRest: { places: { camp: true }, lieu: 'x', quality: 'normale', days: 1, perHero: { [a]: { lodging: 'dehors', food: 'rien' }, [b]: { lodging: 'dehors', food: 'rien' } }, phase: 'setup' },
        merchant: {
          entityId: 'm', archetype: 'x', settlement: 'village', resaleRate: 0.5, stock: [{ id: 'corde', qty: 3 }], cart: [{ id: 'corde', qty: 1 }], bargainLocked: false,
          pendingDistribution: [{ uid: 'D0', item: { uid: 'u2', label: 'Corde', kind: 'misc', qualities: [], enc: 0 }, heroId: a }],
        },
      } as never);
      return { a, b };
    }
    const admis = (banc: Banc, args: ArgumentsDuChoix) => [0, 1].filter((x) => intentAllowedFor(banc.getState(), x, 'fenetreChoisir', args));

    it('la ligne de victoire se prend au siège du héros qui la prend ; l’hôte ne la donne pas au héros de l’invité', () => {
      const banc = ouvrirLeBanc();
      const { a, b } = tout(banc);
      expect(admis(banc, ['victoire', 'ligne', 'L0', a]), 'le héros de l’hôte').toEqual([0]);
      expect(admis(banc, ['victoire', 'ligne', 'L0', b]), 'le héros de l’invité').toEqual([1]);
      banc.getState().fenetreChoisir('victoire', 'ligne', 'L0', b);
      expect(banc.getState().journal.slice(-1)[0]).toBe(t('choix.refus.autreSiege'));
      banc.getState().fenetreChoisir('victoire', 'ligne', 'L0', a);
      expect(banc.getState().pendingVictory?.gear, 'la ligne a quitté la fenêtre').toEqual([]);
    });

    it('chaque dormeur règle sa nuit à son siège', () => {
      const banc = ouvrirLeBanc();
      const { a, b } = tout(banc);
      expect(admis(banc, ['repos', 'couchage', 'dehors', a]), 'le héros de l’hôte').toEqual([0]);
      expect(admis(banc, ['repos', 'pitance', 'rien', b]), 'le héros de l’invité').toEqual([1]);
    });

    it('le butin hors combat et la répartition sont à l’hôte : refusés au siège et dans l’état d’un invité', () => {
      const banc = ouvrirLeBanc();
      const { b } = tout(banc);
      const deLHote: readonly ArgumentsDuChoix[] = [['butin', 'ligne', 'L0', b], ['marchand', 'repartition', 'D0', b]];
      for (const args of deLHote) expect(admis(banc, args), `${args[0]}.${args[1]}`).toEqual([0]);
      banc.setState({ net: { ...banc.getState().net, mode: 'invite' } });
      for (const args of deLHote) {
        banc.getState().fenetreChoisir(...args);
        expect(banc.getState().journal.slice(-1)[0], `${args[0]}.${args[1]}`).toBe(t('choix.refus.hoteSeul'));
      }
    });

    it('l’article se désigne par son id, la ligne par son uid : un libellé, un rang, refusés et dits', () => {
      const banc = ouvrirLeBanc();
      const { a } = tout(banc);
      banc.getState().fenetreChoisir('marchand', 'retirerDuPanier', 'Corde');
      expect(banc.getState().journal.slice(-1)[0], 'le libellé de l’article').toBe(t('choix.refus.valeur'));
      expect(banc.getState().merchant?.cart).toEqual([{ id: 'corde', qty: 1 }]);
      banc.getState().fenetreChoisir(...(['butin', 'ligne', 0, a] as unknown as ArgumentsDuChoix));
      expect(banc.getState().journal.slice(-1)[0], 'le rang de la ligne').toBe(t('choix.refus.valeur'));
      expect(banc.getState().pendingLoot?.gear).toHaveLength(1);
    });

    it('l’évaluation en cours suit sa ligne quand une autre ligne part avant elle', () => {
      const banc = ouvrirLeBanc();
      const { a } = tout(banc);
      const ligne = (uid: string, trappingId: string) => ({ uid, label: trappingId, magic: true, effect: { type: 'giveTrapping', trappingId, identified: false } });
      banc.setState({ pendingVictory: null, merchant: null, pendingRest: null, pendingLoot: { title: 'Coffre', gear: [ligne('L0', 'epee'), ligne('L1', 'dague')] } } as never);
      banc.getState().evaluerLObjet('L1');
      const pa = banc.getState().pendingAppraise!;
      expect(pa.gear).toEqual({ scope: 'butin', uid: 'L1' });
      banc.getState().fenetreChoisir('butin', 'ligne', 'L0', a);
      banc.setState({ pendingAppraise: { ...pa, roll: 10, success: true, sl: 2 } });
      banc.getState().jetValider('evaluation');
      expect(banc.getState().pendingLoot?.gear.map((g) => [g.uid, g.effect.identified]), 'la dague, révélée').toEqual([['L1', undefined]]);
    });

    it('le panier et la vente sont au siège de l’hôte, et se composent dans l’état d’un invité (#3059)', () => {
      const banc = ouvrirLeBanc();
      tout(banc);
      const duPanier: readonly ArgumentsDuChoix[] = [
        ['marchand', 'ajouterAuPanier', 'corde'], ['marchand', 'oterDuPanier', 'corde'], ['marchand', 'retirerDuPanier', 'corde'],
        ['marchand', 'viderLePanier', true], ['marchand', 'ajouterALaVente', 'u2'],
      ];
      for (const args of duPanier) expect(admis(banc, args), `${args[0]}.${args[1]}`).toEqual([0]);
      banc.setState({ net: { ...banc.getState().net, mode: 'invite' } });
      banc.getState().fenetreChoisir('marchand', 'oterDuPanier', 'corde');
      expect(banc.getState().merchant?.cart, 'le panier de l’invité se compose chez lui').toEqual([]);
    });
  });
});

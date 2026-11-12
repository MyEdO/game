/**
 * LES ARGUMENTS D'UNE FENÊTRE OUVERTE SE CHOISISSENT PARMI CE QUE LE VERBE ACCEPTE (#2937) : `fenetreADessiner` rend un
 * argument désigné (`DESIGNATIONS`) en `choix` des seuls éléments que la garde de son op accepte, chacun nommé. Fichier
 * à part de `gestes.hors-store.test.ts`, dont la table (`fenetres.testkit.ts`) tient le jeu branché. Un argument qui
 * désigne une ligne de l'état (ligne de butin, Blessure Critique) se choisit parmi les valeurs que le lecteur de sa
 * fenêtre nomme (`fenetreDuButin`, `OUVERTS_DU_CHOIX`). Qui tient la main se dit par son genre
 * (`proprietaireDeLaFenetre`), en mots à l'hôte texte. Un verbe de jet que son flux ferme se dessine fermé, avec ce qui
 * le ferme (`fermeturesDeLaFenetre`, #2936).
 */
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie, type Jeu, type Partie } from '../noyau/index';
import { auContact, heroDuDuel } from '../noyau/combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import { fenetreADessiner, type ArgumentDuGeste } from './gestes';
import { proprietaireDeLaFenetre } from './projection';
import { t } from '../i18n';
import { nouvelEntete, ouvrirLaPartie } from './partie';
import { projeter, rendreLaVue } from '../hoteTexte/vue';
import { choixDePaieOuverts } from '../noyau/shipCrew';
import { gameDay } from '../noyau/merchantFlow';
import { findMoraleFactor, payChoices } from '../engine/crewMorale';
import { locationLabel, type Trauma } from '../engine/types';

/** L'état de la partie `dome` (graine 7) à son lancement, la pause de début de Round ouverte. */
function auDebutDuRound<T>(faire: (etat: Jeu) => T): T {
  const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
  try {
    return faire(partie.etat());
  } finally {
    partie.fermer();
  }
}

/** L'argument `nom` du geste `verbe` de la fenêtre que `etat` dessine, ou du geste de clé `verbe` (`cleDuGeste`). */
function argumentDe(etat: Jeu, verbe: string, nom: string): ArgumentDuGeste {
  const geste = fenetreADessiner(etat)?.gestes.find((g) => g.cle === verbe) ?? fenetreADessiner(etat)?.gestes.find((g) => g.verbe === verbe);
  const a = geste?.arguments.find((x) => x.nom === nom);
  if (!a) throw new Error(`${verbe}.${nom} absent de la fenêtre ${fenetreADessiner(etat)?.titre ?? 'fermée'}`);
  return a;
}


describe('une fenêtre ouverte n’offre que ce que son verbe accepte', () => {
  it('Début du round (dome) : promouvoir et préempter n’offrent que des héros, chacun nommé', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const b = etat.battle!;
      expect(b.combatants.some((c) => c.kind !== 'heros'), 'témoin : le dome a des ennemis').toBe(true);
      const camp = (id: unknown) => b.combatants.find((c) => c.id === id)?.kind;
      const promouvoir = argumentDe(etat, 'fenetreChoisir@debutDuRound#promouvoir', 'valeur');
      expect(promouvoir.saisie).toBe('choix');
      expect(promouvoir.valeurs!.length, 'témoin : un héros peut agir en premier').toBeGreaterThan(0);
      expect(promouvoir.valeurs!.map((v) => camp(v.valeur)), 'promouvoir offre un non-héros').toEqual(promouvoir.valeurs!.map(() => 'heros'));
      expect(promouvoir.valeurs!.every((v) => v.libelle === b.combatants.find((c) => c.id === v.valeur)!.label)).toBe(true);
      expect(argumentDe(etat, 'fenetreChoisir@debutDuRound#viser', 'valeur').valeurs, 'sans tireur, aucune visée ne s’offre').toEqual([]);
      expect(fenetreADessiner(etat)!.gestes.find((g) => g.verbe === 'fenetreValider')!.rendu).toBe('bouton');
    });
  });

  it('Victoire : dépecer se choisit parmi les vaincues à profil de récolte, nommées', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const victoire: Jeu = {
        ...etat,
        pendingRoundStart: null,
        battle: { ...etat.battle!, over: 'victoire' },
        pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, gear: [], defeated: [{ label: 'Griffon', count: 1, creatureId: 'griffon' }, { label: 'Humain', count: 1, creatureId: 'humain' }, { label: 'Pillard', count: 2 }], harvested: [] },
      };
      const depecer = argumentDe(victoire, 'fenetreChoisir@victoire#depecer', 'valeur');
      expect(depecer.saisie).toBe('choix');
      expect(depecer.valeurs!.map((v) => [v.valeur, v.libelle])).toEqual([['griffon', 'Griffon']]);
    });
  });
});

describe('une fenêtre de combat ne désigne que les combattants que son verbe accepte (#3328)', () => {
  const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };
  /** Le duel au contact : le héros `H` face à l'ennemi `E`, les autres ennemis hors de combat. */
  function leDuel() {
    const ouverture = creerPartie(etatInitialDuJeu(), ENTREES);
    ouverture.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null, combatDirect: 'enc-mutants' });
    ouverture.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] });
    const garde = ouverture.etat();
    ouverture.fermer();
    const { H, E, patch } = auContact(garde);
    return { H, E, etat: { ...garde, ...patch } as Jeu };
  }
  const valeurs = (a: ArgumentDuGeste) => [a.saisie, a.valeurs?.map((v) => [v.valeur, v.libelle])];

  it('le combat monté vise le cavalier ou sa monture, rien d’autre', { timeout: 120_000 }, () => {
    const { E, etat } = leDuel();
    const monture = etat.battle!.combatants.find((c) => c.kind === 'ennemi' && c.id !== E.id)!;
    const couple: Jeu = { ...etat, pendingMountTarget: { riderId: E.id, mountId: monture.id } };
    expect(valeurs(argumentDe(couple, 'fenetreChoisir', 'valeur'))).toEqual(['choix', [[E.id, E.label], [monture.id, monture.label]]]);
  });
});

describe('un argument qui désigne une ligne se choisit parmi les lignes que sa fenêtre nomme', () => {
  const lignes = (a: ArgumentDuGeste) => [a.saisie, a.valeurs?.map((v) => [v.valeur, v.libelle])];
  const gear = [{ uid: 'L0', label: 'Épée', magic: false, effect: { type: 'giveTrapping', trappingId: 'epee' } }, { uid: 'L1', label: 'Bouclier', magic: false, effect: { type: 'giveTrapping', trappingId: 'bouclier' } }] as never;
  const nommees = ['choix', [['L0', 'Épée'], ['L1', 'Bouclier']]];

  it('Victoire : attribuer et évaluer désignent une ligne du butin, l’évaluation porte sur la victoire', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const victoire: Jeu = { ...etat, pendingRoundStart: null, battle: { ...etat.battle!, over: 'victoire' }, pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, gear, defeated: [], harvested: [] } };
      expect(lignes(argumentDe(victoire, 'fenetreChoisir@victoire#ligne', 'valeur'))).toEqual(nommees);
      expect(lignes(argumentDe(victoire, 'evaluerLObjet', 'aEvaluer'))).toEqual(nommees);
      const sansLigne: Jeu = { ...victoire, pendingVictory: { ...victoire.pendingVictory!, gear: [] } };
      expect(fenetreADessiner(sansLigne)!.gestes.filter((g) => !g.ouvert).map((g) => g.cle), 'sans ligne ni créature à dépecer, rien à attribuer, dépecer ni évaluer').toEqual(['fenetreChoisir@victoire#ligne', 'fenetreChoisir@victoire#depecer', 'evaluerLObjet']);
    });
  });

  it('Butin hors combat : attribuer désigne une ligne du butin, l’évaluation porte sur le butin', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const butin: Jeu = { ...etat, pendingRoundStart: null, battle: null, pendingLoot: { title: 'Coffre', gear } };
      expect(lignes(argumentDe(butin, 'fenetreChoisir@butin#ligne', 'valeur'))).toEqual(nommees);
      expect(lignes(argumentDe(butin, 'evaluerLObjet', 'aEvaluer'))).toEqual(nommees);
    });
  });

  it('Butin : evaluerLObjet offre chaque ligne, fermée par le refus de l’Évaluation quand aucun mode ne l’évalue', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const jour = gameDay(etat);
      const manquee = [{ uid: 'L0', label: 'Épée', magic: false, effect: { type: 'giveTrapping', trappingId: 'epee', identified: false, appraiseTriedDay: jour } }, { uid: 'L1', label: 'Bouclier', magic: false, effect: { type: 'giveTrapping', trappingId: 'bouclier', identified: false } }] as never;
      const butin: Jeu = { ...etat, pendingRoundStart: null, battle: null, pendingLoot: { title: 'Coffre', gear: manquee } };
      expect(butin.party.some((h) => (h.talents ?? []).some((x) => x.talentId === 'detection-d-artefact')), 'témoin : aucun détecteur').toBe(false);
      expect(argumentDe(butin, 'evaluerLObjet', 'aEvaluer').valeurs!.map((v) => [v.valeur, v.refus])).toEqual([['L0', t('mf.evaluationARetenter', { label: 'Épée', jours: 1 })], ['L1', null]]);
    });
  });

  it('Bande de Peur : la Détermination offre l’immunité au porteur de chaque rangée, fermée par son refus (LDB 17 l.59)', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const [h1, h2] = etat.party;
      const sansPoint = { ...etat, battle: { ...etat.battle!, combatants: etat.battle!.combatants.map((c) => (c.id === h2.id ? { ...c, resolve: 0 } : c)) } };
      const rangee = (id: string, result: unknown = null) => ({ id, interactive: true, base: 50, target: 50, result });
      const bande = (rangees: unknown[]): Jeu => ({ ...sansPoint, pendingRoundStart: null, pendingCascade: { title: 'Peur', cursor: 0, seq: 1, log: [], purpose: 'test', participants: [{
        id: 'bande-peur', kind: 'psychologieDeCombat', label: 'Peur', aggregate: 'none', groupOwner: true, result: null, participants: rangees,
        psychologieDeCombat: { kind: 'peur', sourceId: 'e1', sourceName: 'Bête', indice: 2, round: 1 },
      }] } } as never);
      const porteur = argumentDe(bande([rangee(h1.id), rangee(h2.id)]), 'depenserLaDetermination', 'combattantId');
      expect(porteur.valeurs!.map((v) => [v.valeur, v.libelle, v.refus])).toEqual([[h1.id, h1.label, null], [h2.id, h2.label, t('agate.noResolve')]]);
      expect(argumentDe(bande([rangee(h1.id)]), 'depenserLaDetermination', 'option').valeurs!.map((v) => v.valeur)).toEqual(['immuniserALaPsychologie']);
      const jetee = fenetreADessiner(bande([rangee(h1.id, { roll: 30, target: 50, sl: 2, success: true })]))!.gestes.find((g) => g.verbe === 'depenserLaDetermination')!;
      expect(jetee.arguments.find((x) => x.nom === 'combattantId')!.valeurs!.map((v) => v.refus), 'le jet tombé, la Peur a pesé').toEqual([t('jet.ferme.jetLance')]);
    });
  });

  it('Infirmerie : l’opération armée désigne la Blessure Critique à opérer, nommée avec sa Localisation', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const plaies: Trauma[] = [{ uid: 'bras', label: 'Bras broyé', location: 'brasG', needsSurgery: true }, { uid: 'crane', label: 'Crâne fendu', location: 'tete', needsSurgery: true }, { uid: 'doigt', label: 'Doigt perdu', location: 'brasD' }];
      const patient = { ...etat.party[0], traumas: plaies };
      const operation = { kind: 'chirurgie', difficulty: 'intermediaire', healerName: 'Berta', skill: 40, intBonus: 3, traumaUid: 'crane', drCible: 5, cumDR: 0, stake: {} } as never;
      const infirmerie: Jeu = { ...etat, pendingRoundStart: null, battle: null, party: [patient, ...etat.party.slice(1)], medic: { patientId: patient.id, surgery: operation } };
      const plaie = argumentDe(infirmerie, 'fenetreChoisir@infirmerie#plaie', 'valeur');
      expect(lignes(plaie)).toEqual(['choix', [['bras', t('medic.plaie', { plaie: 'Bras broyé', localisation: locationLabel('brasG') })], ['crane', t('medic.plaie', { plaie: 'Crâne fendu', localisation: locationLabel('tete') })]]]);
      expect(plaie.valeur, 'la plaie visée est la valeur courante').toBe('crane');
      const choix = (cle: string) => fenetreADessiner(infirmerie)!.gestes.find((g) => g.cle === cle);
      expect(choix('fenetreChoisir@infirmerie#patient')?.reglage, 'le patient se reprend (`reprenable`) : une option de la fenêtre').toBe(true);
      expect(choix('fenetreChoisir@infirmerie#plaie')?.reglage, 'la plaie se reprend (`reprenable`)').toBe(true);
      expect(choix('fenetreChoisir@infirmerie#abandon')?.reglage, 'l’abandon clôt l’opération (`clot`) : un pas de la fenêtre').toBe(false);
    });
  });

  it('Conseil de bord : la paie se choisit parmi les choix ouverts, chacun nommé par son facteur', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const conseil = (wageBrass: number): Jeu => ({ ...etat, battle: null, pendingRoundStart: null, vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } as never, pendingCouncil: { phase: 'choix', wageBrass, today: 7 } as never });
      for (const c of [conseil(0), conseil(1_000_000)]) {
        const paie = argumentDe(c, 'fenetreChoisir', 'valeur');
        expect(paie.saisie).toBe('choix');
        expect(paie.valeurs!.map((v) => [v.valeur, v.libelle])).toEqual(payChoices().map(({ factorId }) => [factorId, findMoraleFactor(factorId)!.label]));
        expect(paie.valeurs!.filter((v) => v.refus === null).map((v) => v.valeur), 'les choix ouverts, les autres disent leur refus').toEqual(choixDePaieOuverts(c));
      }
      expect(choixDePaieOuverts(conseil(0)).length, 'témoin : sans gages, chaque choix est ouvert').toBeGreaterThan(choixDePaieOuverts(conseil(1_000_000)).length);
    });
  });

  it('Semaine en mer : chaque choix vise le héros de sa rangée (`pid`), saisi parmi ceux auxquels il ouvre une valeur ; l’hôte valide', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const [a, ...autres] = etat.party;
      const semaine: Jeu = { ...etat, battle: null, pendingRoundStart: null, party: [a, ...autres.map((h) => ({ ...h, dead: true }))], vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [] } as never, pendingSeaActivities: { picks: { [a.id]: { activityId: 'commerce-opportunite' } }, day: { kmFrom: 0, kmTo: 40, hours: 24, lines: [] } } };
      const fenetre = fenetreADessiner(semaine)!;
      expect(fenetre.gestes.map((g) => g.cle)).toEqual(['fenetreChoisir@activitesEnMer#activite', 'fenetreChoisir@activitesEnMer#investir', 'fenetreChoisir@activitesEnMer#cacher', 'fenetreValider@activitesEnMer']);
      expect(lignes(argumentDe(semaine, 'fenetreChoisir@activitesEnMer#activite', 'pid')), 'le seul héros vivant').toEqual(['choix', [[a.id, a.label]]]);
      expect(lignes(argumentDe(semaine, 'fenetreChoisir@activitesEnMer#investir', 'pid')), 'la mise ne s’ouvre qu’au Commerce d’opportunité').toEqual(['choix', [[a.id, a.label]]]);
      expect(argumentDe(semaine, 'fenetreChoisir@activitesEnMer#cacher', 'pid').valeurs, 'aucune Cartographie : aucune planque').toEqual([]);
      expect(fenetre.gestes.find((g) => g.cle === 'fenetreValider@activitesEnMer')!.rendu).toBe('bouton');
    });
  });

  it('Fin de séance : les cases du groupe, celles de chaque héros (`pid`), sa validation et sa sortie', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const seance: Jeu = { ...etat, battle: null, pendingRoundStart: null, finDeSeance: { heros: {}, groupe: {} } };
      const fenetre = fenetreADessiner(seance)!;
      expect(fenetre.gestes.map((g) => g.cle)).toEqual([
        'fenetreChoisir@finDeSeance#ambitionCourte', 'fenetreChoisir@finDeSeance#ambitionLongue', 'fenetreChoisir@finDeSeance#ambitionPersonnelleCourte',
        'fenetreChoisir@finDeSeance#ambitionPersonnelleLongue', 'fenetreChoisir@finDeSeance#motivation', 'fenetreValider@finDeSeance', 'fenetreFermer@finDeSeance',
      ]);
      expect(lignes(argumentDe(seance, 'fenetreChoisir@finDeSeance#motivation', 'pid')), 'chaque héros du groupe').toEqual(['choix', seance.party.map((h) => [h.id, h.label])]);
    });
  });
});

describe('qui tient la main se dit par son genre, nommé sans id', () => {
  it('aucun sans propriétaire, tous pour `*`, le porteur nommé, `null` pour un id que l’état ne nomme pas', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const heros = etat.party[0];
      expect([undefined, null, '*', heros.id, 'sans-porteur'].map((id) => proprietaireDeLaFenetre(etat, id))).toEqual([
        { genre: 'aucun' }, { genre: 'aucun' }, { genre: 'tous' }, { genre: 'porteur', nom: heros.label }, { genre: 'porteur', nom: null },
      ]);
      expect(fenetreADessiner(etat)!.proprietaire, 'la pause de début de Round est à tous').toEqual({ genre: 'tous' });
    });
  });

  it('l’hôte texte le dit en mots du catalogue : « (à tous) », « (à l’hôte) », le nom du porteur', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const p = projeter(etat, 0, 0);
      const ligne = (proprietaire: NonNullable<typeof p.fenetre>['proprietaire']) => rendreLaVue({ ...p, fenetre: { ...p.fenetre!, proprietaire } }).find((l) => l.startsWith('fenêtre '));
      expect(ligne(p.fenetre!.proprietaire)).toContain(`(à ${t('ecran.proprietaire.tous')})`);
      expect(ligne({ genre: 'aucun' })).toContain(`(à ${t('ecran.proprietaire.aucun')})`);
      expect(ligne({ genre: 'porteur', nom: 'Berta' })).toContain('(à Berta)');
      expect(ligne({ genre: 'porteur', nom: null })).toContain(`(à ${t('ecran.proprietaire.sansNom')})`);
    });
  });
});

describe('un verbe de jet que son flux ferme ne se dessine pas, et dit pourquoi (#2936)', () => {
  const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };
  /** Le geste d'identité `cle` (`cleDuGeste`) de la fenêtre que `partie` dessine. */
  const geste = (partie: Partie, cle: string) => {
    const g = fenetreADessiner(partie.etat())?.gestes.find((x) => x.cle === cle);
    if (!g) throw new Error(`${cle} absent de la fenêtre`);
    return { ouvert: g.ouvert, raison: g.raison };
  };

  it('attaque du duel : avant le jet, ni clôture ni dé fixé ; après, ni jet ni Localisation', { timeout: 120_000 }, () => {
    const ouverture = creerPartie(etatInitialDuJeu(), ENTREES);
    ouverture.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null, combatDirect: 'enc-mutants' });
    ouverture.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] });
    const garde = ouverture.etat();
    ouverture.fermer();
    const { E, patch } = auContact(garde);
    const partie = creerPartie({ ...garde, ...patch }, ENTREES);
    try {
      partie.envoyer({ type: 'cliquerLaCase', args: [{ ...E.pos! }, E.id, { confirm: true }] });
      expect(geste(partie, 'jetLancer@attaque')).toEqual({ ouvert: true, raison: null });
      expect(geste(partie, 'jetRegler@attaque#localisation')).toEqual({ ouvert: true, raison: null });
      expect(geste(partie, 'jetImposerLeResultat@attaque')).toEqual({ ouvert: false, raison: t('jet.ferme.jetNonLance') });
      expect(geste(partie, 'jetValider@attaque')).toEqual({ ouvert: false, raison: t('jet.ferme.jetNonLance') });
      partie.envoyer({ type: 'jetLancer', args: ['attaque'] });
      expect(geste(partie, 'jetLancer@attaque')).toEqual({ ouvert: false, raison: t('jet.ferme.jetLance') });
      expect(geste(partie, 'jetAnnuler@attaque')).toEqual({ ouvert: false, raison: t('jet.ferme.jetLance') });
      expect(geste(partie, 'jetRegler@attaque#localisation').ouvert, 'la Localisation se vise avant le jet').toBe(false);
      expect(geste(partie, 'jetImposerLeResultat@attaque')).toEqual({ ouvert: true, raison: null });
      expect(geste(partie, 'jetValider@attaque')).toEqual({ ouvert: true, raison: null });
    } finally {
      partie.fermer();
    }
  });
});

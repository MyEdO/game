/**
 * LES ARGUMENTS D'UNE FENÊTRE OUVERTE SE CHOISISSENT PARMI CE QUE LE VERBE ACCEPTE (#2937) : `fenetreADessiner` rend un
 * argument désigné (`DESIGNATIONS`) en `choix` des seuls éléments que la garde de son op accepte, chacun nommé. Fichier
 * à part de `gestes.hors-store.test.ts`, dont la table (`fenetres.testkit.ts`) tient le jeu branché. Un argument qui
 * désigne une ligne de l'état sans id (ligne de butin, Blessure Critique) se choisit parmi les valeurs que le lecteur de
 * sa fenêtre nomme (`fenetreDuButin`, `fenetreDeLOperation`). Qui tient la main se dit par son genre
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
import { findMoraleFactor } from '../engine/crewMorale';
import { locationLabel, type Trauma } from '../engine/types';

/** L'état de la partie `dome` (graine 7) à son lancement, la pause de début de Round ouverte. */
function auDebutDuRound<T>(faire: (etat: Jeu) => T): T {
  const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }));
  try {
    return faire(partie.etat());
  } finally {
    partie.fermer();
  }
}

/** L'argument `nom` du geste `verbe` de la fenêtre que `etat` dessine. */
function argumentDe(etat: Jeu, verbe: string, nom: string): ArgumentDuGeste {
  const geste = fenetreADessiner(etat)?.gestes.find((g) => g.verbe === verbe);
  const a = geste?.arguments.find((x) => x.nom === nom);
  if (!a) throw new Error(`${verbe}.${nom} absent de la fenêtre ${fenetreADessiner(etat)?.titre ?? 'fermée'}`);
  return a;
}


describe('une fenêtre ouverte n’offre que ce que son verbe accepte', () => {
  it('Début du round (dome) : promouvoir et préempter n’offrent que des héros, chacun nommé', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const b = etat.battle!;
      expect(b.combatants.some((c) => c.kind !== 'hero'), 'témoin : le dome a des ennemis').toBe(true);
      const camp = (id: unknown) => b.combatants.find((c) => c.id === id)?.kind;
      const promouvoir = argumentDe(etat, 'roundStartPromote', 'heroId');
      expect(promouvoir.saisie).toBe('choix');
      expect(promouvoir.valeurs!.length, 'témoin : un héros peut agir en premier').toBeGreaterThan(0);
      expect(promouvoir.valeurs!.map((v) => camp(v.valeur)), 'roundStartPromote offre un non-héros').toEqual(promouvoir.valeurs!.map(() => 'hero'));
      expect(promouvoir.valeurs!.every((v) => v.libelle === b.combatants.find((c) => c.id === v.valeur)!.label)).toBe(true);
      const preempter = argumentDe(etat, 'armPreempt', 'heroId');
      expect(preempter.saisie).toBe('choix');
      expect(preempter.valeurs!.filter((v) => v.valeur !== null).map((v) => camp(v.valeur)), 'armPreempt offre un non-héros').toEqual(preempter.valeurs!.filter((v) => v.valeur !== null).map(() => 'hero'));
      expect(fenetreADessiner(etat)!.gestes.find((g) => g.verbe === 'roundStartReady')!.rendu).toBe('bouton');
    });
  });

  it('Victoire : dépecer se choisit parmi les vaincues à profil de récolte, nommées', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const victoire: Jeu = {
        ...etat,
        pendingRoundStart: null,
        battle: { ...etat.battle!, over: 'victory' },
        pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, gear: [], defeated: [{ label: 'Griffon', count: 1, creatureId: 'griffon' }, { label: 'Humain', count: 1, creatureId: 'humain' }, { label: 'Pillard', count: 2 }], harvested: [] },
      };
      const depecer = argumentDe(victoire, 'harvestCreature', 'creatureId');
      expect(depecer.saisie).toBe('choix');
      expect(depecer.valeurs!.map((v) => [v.valeur, v.libelle])).toEqual([['griffon', 'Griffon']]);
    });
  });
});

describe('un argument qui désigne une ligne sans id se choisit parmi les lignes que sa fenêtre nomme', () => {
  const lignes = (a: ArgumentDuGeste) => [a.saisie, a.valeurs?.map((v) => [v.valeur, v.libelle])];
  const gear = [{ label: 'Épée', magic: false, effect: { type: 'giveTrapping', trappingId: 'epee' } }, { label: 'Bouclier', magic: false, effect: { type: 'giveTrapping', trappingId: 'bouclier' } }] as never;
  const nommees = ['choix', [[0, 'Épée'], [1, 'Bouclier']]];

  it('Victoire : attribuer et évaluer désignent une ligne du butin, l’évaluation porte sur la victoire', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const victoire: Jeu = { ...etat, pendingRoundStart: null, battle: { ...etat.battle!, over: 'victory' }, pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, gear, defeated: [], harvested: [] } };
      expect(lignes(argumentDe(victoire, 'assignVictoryGear', 'index'))).toEqual(nommees);
      expect(lignes(argumentDe(victoire, 'appraiseGear', 'index'))).toEqual(nommees);
      expect(lignes(argumentDe(victoire, 'appraiseGear', 'scope'))).toEqual(['choix', [['victory', t('valeur.victory')]]]);
      const sansLigne: Jeu = { ...victoire, pendingVictory: { ...victoire.pendingVictory!, gear: [] } };
      expect(fenetreADessiner(sansLigne)!.gestes.filter((g) => !g.ouvert).map((g) => g.verbe), 'sans ligne, rien à attribuer ni à évaluer').toEqual(['assignVictoryGear', 'appraiseGear']);
    });
  });

  it('Butin hors combat : attribuer désigne une ligne du butin, l’évaluation porte sur le butin', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const butin: Jeu = { ...etat, pendingRoundStart: null, battle: null, pendingLoot: { title: 'Coffre', gear } };
      expect(lignes(argumentDe(butin, 'assignLootGear', 'index'))).toEqual(nommees);
      expect(lignes(argumentDe(butin, 'appraiseGear', 'scope'))).toEqual(['choix', [['loot', t('valeur.loot')]]]);
    });
  });

  it('Infirmerie : l’opération armée désigne la Blessure Critique à opérer, nommée avec sa Localisation', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const plaies: Trauma[] = [{ label: 'Bras broyé', location: 'brasG', needsSurgery: true }, { label: 'Crâne fendu', location: 'tete', needsSurgery: true }, { label: 'Doigt perdu', location: 'brasD' }] as Trauma[];
      const patient = { ...etat.party[0], traumas: plaies };
      const operation = { kind: 'surgery', difficulty: 'intermediaire', healerName: 'Berta', skill: 40, intBonus: 3, traumaIdx: 1, targetDR: 5, cumDR: 0, stake: {} } as never;
      const infirmerie: Jeu = { ...etat, pendingRoundStart: null, battle: null, party: [patient, ...etat.party.slice(1)], medic: { patientId: patient.id, surgery: operation } };
      const plaie = argumentDe(infirmerie, 'medicSetWound', 'idx');
      expect(lignes(plaie)).toEqual(['choix', [[0, t('medic.plaie', { plaie: 'Bras broyé', localisation: locationLabel('brasG') })], [1, t('medic.plaie', { plaie: 'Crâne fendu', localisation: locationLabel('tete') })]]]);
      expect(plaie.valeur, 'la plaie visée est la valeur courante').toBe(1);
    });
  });

  it('Conseil de bord : la paie se choisit parmi les choix ouverts, chacun nommé par son facteur', { timeout: 120_000 }, () => {
    auDebutDuRound((etat) => {
      const conseil = (wageBrass: number): Jeu => ({ ...etat, battle: null, pendingRoundStart: null, vessel: { id: 'nef' } as never, pendingCouncil: { phase: 'choix', wageBrass, today: 1 } as never });
      for (const c of [conseil(0), conseil(1_000_000)]) {
        const paie = argumentDe(c, 'councilPay', 'decision');
        expect(paie.saisie).toBe('choix');
        expect(paie.valeurs!.map((v) => [v.valeur, v.libelle])).toEqual(choixDePaieOuverts(c).map((id) => [id, findMoraleFactor(id)!.label]));
      }
      expect(choixDePaieOuverts(conseil(0)).length, 'témoin : sans gages, chaque choix est ouvert').toBeGreaterThan(choixDePaieOuverts(conseil(1_000_000)).length);
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
  /** Le geste `verbe` de la fenêtre que `partie` dessine. */
  const geste = (partie: Partie, verbe: string) => {
    const g = fenetreADessiner(partie.etat())?.gestes.find((x) => x.verbe === verbe);
    if (!g) throw new Error(`${verbe} absent de la fenêtre`);
    return { ouvert: g.ouvert, raison: g.raison };
  };

  it('attaque du duel : avant le jet, ni clôture ni dé fixé ; après, ni jet ni Localisation', { timeout: 120_000 }, () => {
    const ouverture = creerPartie({ ...etatInitialDuJeu(), party: [heroDuDuel()] }, ENTREES);
    ouverture.envoyer({ type: 'startScene', args: [testScene()] });
    ouverture.envoyer({ type: 'startCombat', args: ['enc-mutants'] });
    ouverture.envoyer({ type: 'confirmRoundStart', args: [] });
    const garde = ouverture.etat();
    ouverture.fermer();
    const { E, patch } = auContact(garde);
    const partie = creerPartie({ ...garde, ...patch }, ENTREES);
    try {
      partie.envoyer({ type: 'battleClickEntity', args: [E.id, { confirm: true }] });
      expect(geste(partie, 'attackRoll')).toEqual({ ouvert: true, raison: null });
      expect(geste(partie, 'attackSetLocation')).toEqual({ ouvert: true, raison: null });
      expect(geste(partie, 'attackSetForcedRoll')).toEqual({ ouvert: false, raison: t('jet.ferme.jetNonLance') });
      expect(geste(partie, 'attackConfirm')).toEqual({ ouvert: false, raison: t('jet.ferme.jetNonLance') });
      partie.envoyer({ type: 'attackRoll', args: [] });
      expect(geste(partie, 'attackRoll')).toEqual({ ouvert: false, raison: t('jet.ferme.jetLance') });
      expect(geste(partie, 'attackCancel')).toEqual({ ouvert: false, raison: t('jet.ferme.jetLance') });
      expect(geste(partie, 'attackSetLocation').ouvert, 'la Localisation se vise avant le jet').toBe(false);
      expect(geste(partie, 'attackSetForcedRoll')).toEqual({ ouvert: true, raison: null });
      expect(geste(partie, 'attackConfirm')).toEqual({ ouvert: true, raison: null });
    } finally {
      partie.fermer();
    }
  });
});

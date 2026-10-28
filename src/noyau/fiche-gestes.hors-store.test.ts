/**
 * LES GESTES DE LA FICHE, sans store (#3059) : un hôte qui n'a que la surface du noyau (`creerPartie`)
 * joue les gestes de l'équipement, de l'avancement et des possessions. Chaque verdict que l'écran web
 * affiche est celui que le geste applique : le geste refusé ne change rien et dit pourquoi.
 */
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie, type EtatDeJeu, type Partie, type ResultatDeLAppel } from './index';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import { refusEmplacementDeMain, refusAchatDeComposant, refusDeSupprimerSet } from './partyFlow';
import { refusDInventaire, refusDuLanceurDeFiche, refusDuBackground, refusDeRompreUneFaveur } from './verrousDeFiche';
import { buildAdvancementView } from './monde/advancement';
import { refusGestePossession, ciblesDEmbarquement } from './possessionsFlow';
import { refusDeSoins } from './medicFlow';
import { activeLoadout, itemFromTrappingById } from '../engine/items';
import { createHero } from '../engine/character';
import { possessionLabel, type Possession } from '../engine/possession';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

const lignesDuJournal = ({ journal }: ResultatDeLAppel) => journal.flatMap((l) => (l.de === 'journal' ? [l.texte] : []));

/** Une partie ouverte sur `etat`, fermée après `jouer`. */
function avecPartie(etat: EtatDeJeu, jouer: (partie: Partie) => void, entrees: EntreesDeLaPartie = ENTREES): void {
  const partie = creerPartie(etat, entrees);
  try {
    jouer(partie);
  } finally {
    partie.fermer();
  }
}

/** Le refus NEUF qu'a prononcé `envoyer` (`nonce` changé), ou `undefined` : un refus resté d'un geste
 *  précédent ne passe pas pour celui du geste courant. */
function refusNeuf(partie: Partie, envoyer: () => unknown): string | undefined {
  const avant = partie.etat().refus?.nonce;
  envoyer();
  const apres = partie.etat().refus;
  return apres && apres.nonce !== avant ? apres.texte : undefined;
}

/** Le duel de `combatDeTest.testkit.ts`, ouvert : le héros est en combat. */
function enCombat(jouer: (partie: Partie, H: Combatant) => void, patch: Partial<EtatDeJeu> | ((H: Combatant) => Partial<EtatDeJeu>) = {}): void {
  const ouverture = creerPartie({ ...etatInitialDuJeu(), party: [heroDuDuel()] }, ENTREES);
  ouverture.envoyer({ type: 'startScene', args: [testScene()] });
  ouverture.envoyer({ type: 'startCombat', args: ['enc-mutants'] });
  ouverture.envoyer({ type: 'confirmRoundStart', args: [] });
  const garde = ouverture.etat();
  ouverture.fermer();
  const contact = auContact(garde);
  avecPartie({ ...garde, ...contact.patch, ...(typeof patch === 'function' ? patch(contact.H) : patch) }, (partie) => jouer(partie, contact.H));
}

describe('setLoadoutSlot — le verdict de main (`refusEmplacementDeMain`) est celui du geste', () => {
  it('en combat, l’hôte texte ne change pas les mains : rien ne bouge, le refus se dit', () => {
    enCombat((partie, H) => {
      const lu = () => partie.etat().battle!.combatants.find((c) => c.id === H.id)!;
      const set = activeLoadout(lu())!;
      expect(set.main, 'témoin : le héros du duel tient une arme').toBeTruthy();
      const attendu = refusEmplacementDeMain(partie.etat(), lu(), set.id, 'main', null);
      expect(attendu).toBe(t('pf.inventoryLocked'));
      partie.envoyer({ type: 'setLoadoutSlot', args: [H.id, set.id, 'main', null] });
      expect(activeLoadout(lu())!.main, 'la main principale a changé en plein combat').toBe(set.main);
      expect(partie.etat().refus?.texte).toBe(attendu);
    });
  });

  it('hors combat, une arme inéligible n’entre pas en seconde main (LDB 14 l.138)', () => {
    const heros = heroDuDuel();
    const arc = { ...itemFromTrappingById('arc-long')!, uid: 'arc-du-test' };
    heros.items = [...(heros.items ?? []), arc];
    avecPartie({ ...etatInitialDuJeu(), party: [heros] }, (partie) => {
      const lu = () => partie.etat().party[0];
      const set = activeLoadout(lu())!;
      const attendu = refusEmplacementDeMain(partie.etat(), lu(), set.id, 'off', arc.uid);
      expect(attendu, 'un arc long n’est ni une arme de mêlée à une main ni un pistolet').toBeTruthy();
      const appel = partie.envoyer({ type: 'setLoadoutSlot', args: [heros.id, set.id, 'off', arc.uid] });
      expect(activeLoadout(lu())!.off, 'l’arc a été pris en seconde main').not.toBe(arc.uid);
      expect(lignesDuJournal(appel)).toEqual([attendu]);
    });
  });
});

describe('gestes de set — le verrou (`refusDInventaire`) est celui des gestes', () => {
  it('en combat, l’hôte texte ne crée, ne supprime ni n’active de set : rien ne bouge, le refus se dit', () => {
    enCombat((partie, H) => {
      const lu = () => partie.etat().battle!.combatants.find((c) => c.id === H.id)!;
      const avant = structuredClone({ loadouts: lu().loadouts, actif: lu().activeLoadoutId });
      expect(avant.loadouts!.length, 'témoin : le héros du duel a deux sets').toBeGreaterThan(1);
      const autre = avant.loadouts!.find((l) => l.id !== avant.actif)!;
      const appels: [string, () => void][] = [
        ['setActiveLoadout', () => partie.envoyer({ type: 'setActiveLoadout', args: [H.id, autre.id] })],
        ['createLoadout', () => partie.envoyer({ type: 'createLoadout', args: [H.id] })],
        ['deleteLoadout', () => partie.envoyer({ type: 'deleteLoadout', args: [H.id, autre.id] })],
      ];
      for (const [nom, envoyer] of appels) {
        expect(refusNeuf(partie, envoyer), `${nom} n’a pas prononcé son propre refus`).toBe(t('pf.inventoryLocked'));
        expect({ loadouts: lu().loadouts, actif: lu().activeLoadoutId }, `${nom} a touché aux sets en combat`).toEqual(avant);
      }
      expect(refusDInventaire(partie.etat()), 'l’écran lit le verrou que rendent les gestes').toBe(t('pf.inventoryLocked'));
    });
  });
});

describe('deleteLoadout — le verdict (`refusDeSupprimerSet`) est celui du geste', () => {
  it('hors combat, le dernier set ne se supprime pas : le geste le dit, jamais un no-op muet', () => {
    avecPartie({ ...etatInitialDuJeu(), party: [heroDuDuel()] }, (partie) => {
      const lu = () => partie.etat().party[0];
      const ids = (lu().loadouts ?? []).map((l) => l.id);
      expect(ids.length, 'témoin : le héros du duel a deux sets').toBe(2);
      partie.envoyer({ type: 'deleteLoadout', args: [lu().id, ids[0]] });
      expect(lu().loadouts!.map((l) => l.id), 'témoin : un set sur deux se supprime').toEqual([ids[1]]);
      const appel = partie.envoyer({ type: 'deleteLoadout', args: [lu().id, ids[1]] });
      expect(lu().loadouts!.map((l) => l.id), 'le dernier set a été supprimé').toEqual([ids[1]]);
      expect(lignesDuJournal(appel)).toEqual([t('pf.loadoutLast')]);
      expect(refusDeSupprimerSet(partie.etat(), lu(), ids[1]), 'l’écran lit le refus que rend le geste').toBe(t('pf.loadoutLast'));
    });
  });
});

describe('transferItem et stowItem — le verdict (`refusDInventaire`, co-localisation) est celui des gestes', () => {
  const mule = (ownerId: string, location: Possession['location'] = { kind: 'avec-le-groupe' }): Possession =>
    ({ uid: 'pos-1', ownerId, nature: 'bete', ref: { creatureId: 'mule' }, location, items: [] }) as Possession;

  it('en combat, le héros ne donne pas son armure portée à sa mule (le verrou de `toggleEquip` ne se contourne pas)', () => {
    const H0 = heroDuDuel();
    enCombat((partie, H) => {
      const lu = () => partie.etat().battle!.combatants.find((c) => c.id === H.id)!;
      const armure = (lu().items ?? []).find((i) => i.kind === 'armor' && i.equipped)!;
      partie.envoyer({ type: 'transferItem', args: [armure.uid, H.id, 'pos-1'] });
      expect(lu().items!.some((i) => i.uid === armure.uid), 'l’armure a quitté le héros en plein combat').toBe(true);
      expect(partie.etat().possessions[0].items).toEqual([]);
      expect(partie.etat().refus?.texte).toBe(refusDInventaire(partie.etat()));
    }, { possessions: [mule(H0.id)] });
  });

  it('en combat, rien ne se range ni ne sort d’un sac', () => {
    enCombat((partie, H) => {
      const lu = () => partie.etat().battle!.combatants.find((c) => c.id === H.id)!;
      const avant = structuredClone(lu().items);
      const objet = avant!.find((i) => !i.container)!;
      const sac = avant!.find((i) => i.container);
      partie.envoyer({ type: 'stowItem', args: [H.id, objet.uid, sac?.uid ?? null] });
      expect(lu().items).toEqual(avant);
      expect(partie.etat().refus?.texte).toBe(t('pf.inventoryLocked'));
    });
  });

  it('hors combat : vers une mule laissée ailleurs, refusé ; vers soi-même, refusé avec sa propre raison', () => {
    const heros = heroDuDuel();
    const objet = (heros.items ?? [])[0];
    avecPartie({ ...etatInitialDuJeu(), party: [heros], possessions: [mule(heros.id, { kind: 'au-lieu', placeId: 'altdorf' })] }, (partie) => {
      const loin = partie.envoyer({ type: 'transferItem', args: [objet.uid, heros.id, 'pos-1'] });
      expect(partie.etat().possessions[0].items, 'l’objet a voyagé jusqu’à la mule laissée ailleurs').toEqual([]);
      expect(lignesDuJournal(loin)).toEqual([t('pf.giveNotColocated', { from: heros.label, to: possessionLabel(partie.etat().possessions[0]), item: objet.label })]);
      const soi = partie.envoyer({ type: 'transferItem', args: [objet.uid, heros.id, heros.id] });
      expect(lignesDuJournal(soi)).toEqual([t('pf.giveSelf', { from: heros.label, item: objet.label })]);
      expect(partie.etat().party[0].items!.filter((i) => i.uid === objet.uid)).toHaveLength(1);
    });
  });
});

describe('gestes d’objet et de fiche en combat — un verdict par famille, celui des gestes', () => {
  it('choisirForme, usePartyItem, appraiseItem : refusés en combat (`refusDInventaire`), rien ne change', () => {
    const H0 = heroDuDuel();
    const arme = { ...itemFromTrappingById('arme-simple')!, uid: 'arme-simple-1' };
    const biere = { ...itemFromTrappingById('biere-pinte')!, uid: 'biere-1' };
    const inconnu = { ...itemFromTrappingById('arme-simple')!, uid: 'inconnu-1', identified: false };
    H0.items = [...(H0.items ?? []), arme, biere, inconnu];
    H0.skills = [...H0.skills, { id: 'evaluation', characteristic: 'intelligence', advances: 10 }, { id: 'intuition', characteristic: 'initiative', advances: 10 }];
    enCombat((partie, H) => {
      const lu = () => partie.etat().battle!.combatants.find((c) => c.id === H.id)!;
      const avant = structuredClone(lu().items);
      const gestes: [string, () => void][] = [
        ['choisirForme', () => partie.envoyer({ type: 'choisirForme', args: [H.id, arme.uid, 'hache'] })],
        ['usePartyItem', () => partie.envoyer({ type: 'usePartyItem', args: [H.id, biere.uid] })],
        ['appraiseItem', () => partie.envoyer({ type: 'appraiseItem', args: [inconnu.uid, H.id] })],
        ['appraiseItem (detect)', () => partie.envoyer({ type: 'appraiseItem', args: [inconnu.uid, H.id, 'detect'] })],
      ];
      for (const [nom, envoyer] of gestes) {
        expect(refusNeuf(partie, envoyer), `${nom} n’a pas prononcé son refus`).toBe(refusDInventaire(partie.etat()));
        expect(lu().items, `${nom} a touché à l’objet en combat`).toEqual(avant);
        expect(partie.etat().party[0].items, `${nom} a touché à la copie du groupe`).toEqual(H0.items);
        expect(partie.etat().pendingAppraise ?? null, `${nom} a ouvert une évaluation en combat`).toBeNull();
      }
    }, { party: [H0] });
  });

  it('la Parure, cosmétique, reste ouverte en combat : `setItemSkin` écrit les deux copies', () => {
    enCombat((partie, H) => {
      const objet = H.items!.find((i) => i.kind === 'armor')!;
      expect(refusNeuf(partie, () => partie.envoyer({ type: 'setItemSkin', args: [H.id, objet.uid, { metal: '#ff0000' }] })), 'la Parure a été refusée en combat').toBeUndefined();
      const peau = (c: Combatant) => c.items!.find((i) => i.uid === objet.uid)!.skin;
      expect(peau(partie.etat().battle!.combatants.find((c) => c.id === H.id)!)).toEqual({ metal: '#ff0000' });
      expect(peau(partie.etat().party.find((c) => c.id === H.id)!)).toEqual({ metal: '#ff0000' });
    });
  });

  it('les lanceurs hors combat (`refusDuLanceurDeFiche`), le background (`refusDuBackground`) et la Faveur (`refusDeRompreUneFaveur`) refusent en combat', () => {
    enCombat((partie, H) => {
      const lu = () => partie.etat().party.find((c) => c.id === H.id)!;
      const motivation = lu().motivation;
      expect(refusNeuf(partie, () => partie.envoyer({ type: 'oocCastSpell', args: [H.id, 'x', H.id] }))).toBe(refusDuLanceurDeFiche(partie.etat()));
      expect(refusNeuf(partie, () => partie.envoyer({ type: 'oocFocusSpell', args: [H.id, 'x'] }))).toBe(t('cs.oocInCombat'));
      expect(refusNeuf(partie, () => partie.envoyer({ type: 'oocDispelSpell', args: [H.id, 'x', H.id] }))).toBe(t('cs.oocInCombat'));
      expect(refusNeuf(partie, () => partie.envoyer({ type: 'setHeroBackground', args: [H.id, { motivation: 'Venger mon frère' }] }))).toBe(refusDuBackground(partie.etat()));
      expect(lu().motivation, 'le background a changé en combat').toBe(motivation);
      expect(refusNeuf(partie, () => partie.envoyer({ type: 'favorBreak', args: [H.id, 'faveur-1'] }))).toBe(refusDeRompreUneFaveur(partie.etat()));
      expect(partie.etat().favors?.map((f) => f.id), 'la Faveur a été rompue en combat').toEqual(['faveur-1']);
    }, (H) => ({ favors: [{ id: 'faveur-1', heroId: H.id, level: 'mineure', owedTo: 'Gotthard', desc: 'x', progress: 0 }] }));
  });
});

describe('moveCargo — co-localisation des porteurs de cargaison (`carriersColocated`)', () => {
  it('hors carte, la cale du navire et la mule, tous deux avec le groupe, échangent leur vrac', () => {
    const h = heroDuDuel();
    const mule = { uid: 'pos-mule', ownerId: h.id, nature: 'bete', ref: { creatureId: 'mule' }, location: { kind: 'avec-le-groupe' }, items: [], cargo: [] } as unknown as Possession;
    const vessel = { vehicleId: 'barge', cargo: [{ cargoId: 'vin', enc: 10, basePriceGold: 1 }] } as unknown as EtatDeJeu['vessel'];
    avecPartie({ ...etatInitialDuJeu(), party: [h], possessions: [mule], vessel, worldMap: null }, (partie) => {
      partie.envoyer({ type: 'moveCargo', args: ['vessel', 'pos-mule', 'vin', 2] });
      expect(partie.etat().vessel!.cargo).toEqual([{ cargoId: 'vin', enc: 8, basePriceGold: 1 }]);
      expect(partie.etat().possessions[0].cargo).toEqual([{ cargoId: 'vin', enc: 2, basePriceGold: 1 }]);
    });
  });
});

describe('toggleEquip — le verrou (`refusDInventaire`) est celui du geste', () => {
  it('en combat, l’hôte texte ne retire pas une armure portée : rien ne bouge, le refus se dit', () => {
    enCombat((partie, H) => {
      const lu = () => partie.etat().battle!.combatants.find((c) => c.id === H.id)!;
      const armure = (lu().items ?? []).find((i) => i.kind === 'armor' && i.equipped);
      expect(armure, 'témoin : le héros du duel porte une armure').toBeTruthy();
      partie.envoyer({ type: 'toggleEquip', args: [H.id, armure!.uid] });
      expect(lu().items!.find((i) => i.uid === armure!.uid)!.equipped, 'l’armure a été retirée en plein combat').toBe(true);
      expect(partie.etat().refus?.texte).toBe(refusDInventaire(partie.etat()));
    });
  });
});

describe('buildAdvancementView — chaque achat porte le refus que son geste rend', () => {
  it('règle « mentor » active, sans mentor : la Caractéristique hors carrière n’est pas offerte, et le geste la refuse', () => {
    const heros = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 }), xp: 5000 };
    avecPartie({ ...etatInitialDuJeu(), party: [heros], flags: {} }, (partie) => {
      const vue = buildAdvancementView(partie.etat(), partie.etat().party[0]);
      const hors = vue.chars.find((c) => !c.inCareer)!;
      const dans = vue.chars.find((c) => c.inCareer)!;
      expect(hors.refus, 'la vue offre un achat que le geste refuse').toBe(t('pf.charNeedsMentor', { name: heros.label, what: hors.label }));
      const refuse = partie.envoyer({ type: 'buyCharAdvance', args: [heros.id, hors.key] });
      expect(partie.etat().party[0].xp, 'le geste a dépensé des PX que la vue refusait').toBe(5000);
      expect(lignesDuJournal(refuse)).toEqual([hors.refus]);
      expect(dans.refus, 'témoin : la Caractéristique de carrière reste offerte').toBeNull();
      partie.envoyer({ type: 'buyCharAdvance', args: [heros.id, dans.key] });
      expect(partie.etat().party[0].xp).toBe(5000 - dans.nextCost);
    }, { ...ENTREES, reglesMaison: { 'advancement-mentor': true } });
  });

  it('à 0 PX : la vue refuse l’Augmentation au coût près, et le geste ne dépense rien', () => {
    const heros = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 }), xp: 0 };
    avecPartie({ ...etatInitialDuJeu(), party: [heros], flags: {} }, (partie) => {
      const vue = buildAdvancementView(partie.etat(), partie.etat().party[0]);
      const c = vue.chars.find((x) => x.inCareer)!;
      expect(c.refus).toBe(t('pf.notEnoughXp', { name: heros.label, cost: c.nextCost }));
      expect(vue.refusPx(0)).toBeNull();
      const appel = partie.envoyer({ type: 'buyCharAdvance', args: [heros.id, c.key] });
      expect(partie.etat().party[0].charAdvances?.[c.key] ?? 0, 'le geste a acheté ce que la vue refusait').toBe(heros.charAdvances?.[c.key] ?? 0);
      expect(lignesDuJournal(appel)).toEqual([c.refus]);
    });
  });

  it('à 0 PX, chaque achat de la vue porte EXACTEMENT le refus que rend son geste (Caractéristique, Compétence, Talent, Carrière)', () => {
    const heros = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 }), xp: 0 };
    avecPartie({ ...etatInitialDuJeu(), party: [heros], flags: {} }, (partie) => {
      const v = buildAdvancementView(partie.etat(), partie.etat().party[0]);
      const c = v.chars.find((x) => x.inCareer)!;
      const sk = v.skills.find((x) => x.known && x.inCareer)!;
      const ta = v.talents.find((x) => x.talentId && !x.maxReached)!;
      const tg = v.targets.find((x) => x.ok) ?? v.targets[0];
      const lignes: [string, string | null, () => ResultatDeLAppel][] = [
        ['Caractéristique', c.refus, () => partie.envoyer({ type: 'buyCharAdvance', args: [heros.id, c.key] })],
        ['Compétence', sk.refus, () => partie.envoyer({ type: 'buySkillAdvance', args: [heros.id, sk.skillId, sk.spec] })],
        ['Talent', ta.refus, () => partie.envoyer({ type: 'buyTalent', args: [heros.id, ta.talentId!, ta.spec] })],
        ['Carrière', tg.refus, () => partie.envoyer({ type: 'changeCareer', args: [heros.id, tg.career, tg.level] })],
      ];
      for (const [nom, refus, envoyer] of lignes) {
        expect(refus, `${nom} : la vue l’offre à 0 PX`).toBeTruthy();
        expect(lignesDuJournal(envoyer()), `${nom} : la vue et le geste ne disent pas la même chose`).toEqual([refus]);
      }
      expect(partie.etat().party[0].xp).toBe(0);
    });
  });

  it('changement de carrière libre : la vue porte le refus COMPLET du geste (validation, puis PX)', () => {
    const heros = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 }), xp: 0 };
    avecPartie({ ...etatInitialDuJeu(), party: [heros], flags: {} }, (partie) => {
      const v = buildAdvancementView(partie.etat(), partie.etat().party[0]);
      for (const cible of ['agitateur', 'carriere-inconnue']) {
        const refus = v.refusChangementVers(cible);
        expect(refus, `${cible} : la vue offre un changement que le geste refuse`).toBeTruthy();
        expect(lignesDuJournal(partie.envoyer({ type: 'changeCareer', args: [heros.id, cible, 1] })), `${cible} : la vue et le geste ne disent pas la même chose`).toEqual([refus]);
      }
      expect(partie.etat().party[0].career).toBe('soldat');
    });
    const riche = { ...heros, xp: 5000 };
    avecPartie({ ...etatInitialDuJeu(), party: [riche], flags: {} }, (partie) => {
      const refus = buildAdvancementView(partie.etat(), partie.etat().party[0]).refusChangementVers('carriere-inconnue');
      expect(refus, 'PX suffisants : la vue offre une carrière que la validation du geste refuse').toBeTruthy();
      expect(lignesDuJournal(partie.envoyer({ type: 'changeCareer', args: [riche.id, 'carriere-inconnue', 1] }))).toEqual([refus]);
    });
  });

  it('un Talent au Maxi n’est pas offert : la ligne porte le refus que rend `buyTalent`', () => {
    const heros = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 }), xp: 5000 };
    avecPartie({ ...etatInitialDuJeu(), party: [heros], flags: {} }, (partie) => {
      let ligne = buildAdvancementView(partie.etat(), partie.etat().party[0]).talents.find((r) => r.talentId && !r.maxReached)!;
      for (let pas = 0; !ligne.maxReached && pas < 10; pas++) {
        partie.envoyer({ type: 'buyTalent', args: [heros.id, ligne.talentId!, ligne.spec] });
        ligne = buildAdvancementView(partie.etat(), partie.etat().party[0]).talents.find((r) => r.slotKey === ligne.slotKey)!;
      }
      expect(ligne.maxReached, 'témoin : le Talent a atteint son Maxi').toBe(true);
      const xp = partie.etat().party[0].xp;
      const appel = partie.envoyer({ type: 'buyTalent', args: [heros.id, ligne.talentId!, ligne.spec] });
      expect(partie.etat().party[0].xp, 'le geste a dépensé au-delà du Maxi').toBe(xp);
      expect(lignesDuJournal(appel)).toEqual([ligne.refus]);
    });
  });
});

describe('gestes de possession — le verdict (`refusGestePossession`) est celui des cinq gestes', () => {
  const mule: Possession = { uid: 'pos-1', ownerId: 'h1', nature: 'bete', ref: { creatureId: 'mule' }, location: { kind: 'avec-le-groupe' }, items: [] } as Possession;
  const navire = (location: Possession['location']): Possession => ({
    uid: 'pos-2', ownerId: 'h1', nature: 'navire', vehicleId: 'barge', location, items: [],
    naval: { morale: { score: 0, lastMoraleWeek: 0, factors: [] } },
  }) as unknown as Possession;
  const heros = () => ({ ...heroDuDuel(), id: 'h1' });

  it('embarquer sur un navire laissé à quai ailleurs : refusé, la mule reste avec le groupe', () => {
    const etat = { ...etatInitialDuJeu(), party: [heros()], possessions: [mule, navire({ kind: 'au-lieu', placeId: 'altdorf' })] };
    avecPartie(etat, (partie) => {
      const attendu = refusGestePossession(partie.etat(), mule.uid, { kind: 'embarquer', hostUid: 'pos-2' });
      expect(attendu).toBe(t('pos.ailleurs', { chose: possessionLabel(partie.etat().possessions[1]) }));
      const appel = partie.envoyer({ type: 'embark', args: [mule.uid, 'pos-2'] });
      expect(partie.etat().possessions[0].location, 'la mule a embarqué sur un navire absent').toEqual({ kind: 'avec-le-groupe' });
      expect(lignesDuJournal(appel)).toEqual([attendu]);
      expect(ciblesDEmbarquement(partie.etat(), mule.uid)).toEqual({ cibles: [], refus: t('pos.aucunNavire') });
    });
  });

  it('laisser sans lieu courant (hors campagne) : refusé, la mule ne part nulle part', () => {
    avecPartie({ ...etatInitialDuJeu(), party: [heros()], possessions: [mule] }, (partie) => {
      const appel = partie.envoyer({ type: 'stablePossession', args: [mule.uid] });
      expect(partie.etat().possessions[0].location).toEqual({ kind: 'avec-le-groupe' });
      expect(lignesDuJournal(appel)).toEqual([t('pos.aucunLieu')]);
    });
  });

  it('reprendre une possession laissée à un AUTRE Lieu que celui du groupe : refusé ; au bon Lieu, elle revient', () => {
    const aAltdorf = { ...mule, location: { kind: 'au-lieu', placeId: 'altdorf' } } as Possession;
    const carte = { places: [{ id: 'altdorf', scene: 'sc-altdorf' }, { id: 'ubersreik', scene: 'sc-ubersreik' }] } as unknown as EtatDeJeu['worldMap'];
    const etat = (sceneId: string) => ({ ...etatInitialDuJeu(), party: [heros()], possessions: [aAltdorf], worldMap: carte, scene: { ...testScene(), id: sceneId } });
    avecPartie(etat('sc-ubersreik'), (partie) => {
      const appel = partie.envoyer({ type: 'retrievePossession', args: [aAltdorf.uid] });
      expect(partie.etat().possessions[0].location, 'la mule a rejoint le groupe depuis un autre Lieu').toEqual({ kind: 'au-lieu', placeId: 'altdorf' });
      expect(lignesDuJournal(appel)).toEqual([t('pos.ailleurs', { chose: possessionLabel(aAltdorf) })]);
    });
    avecPartie(etat('sc-altdorf'), (partie) => {
      partie.envoyer({ type: 'retrievePossession', args: [aAltdorf.uid] });
      expect(partie.etat().possessions[0].location).toEqual({ kind: 'avec-le-groupe' });
    });
  });

  it('débarquer d’un navire laissé à un autre Lieu : refusé (la mule ne contourne pas « Reprendre ») ; au Lieu du navire, elle débarque', () => {
    const aQuai = navire({ kind: 'au-lieu', placeId: 'altdorf' });
    const aBord = { ...mule, location: { kind: 'embarquee', hostUid: 'pos-2' } } as Possession;
    const carte = { places: [{ id: 'altdorf', scene: 'sc-altdorf' }, { id: 'ubersreik', scene: 'sc-ubersreik' }] } as unknown as EtatDeJeu['worldMap'];
    const etat = (sceneId: string) => ({ ...etatInitialDuJeu(), party: [heros()], possessions: [aBord, aQuai], worldMap: carte, scene: { ...testScene(), id: sceneId } });
    avecPartie(etat('sc-ubersreik'), (partie) => {
      const appel = partie.envoyer({ type: 'disembark', args: [aBord.uid] });
      expect(partie.etat().possessions[0].location, 'la mule a quitté un navire resté à Altdorf').toEqual({ kind: 'embarquee', hostUid: 'pos-2' });
      expect(lignesDuJournal(appel)).toEqual([t('pos.ailleurs', { chose: possessionLabel(aQuai) })]);
    });
    avecPartie(etat('sc-altdorf'), (partie) => {
      partie.envoyer({ type: 'disembark', args: [aBord.uid] });
      expect(partie.etat().possessions[0].location).toEqual({ kind: 'avec-le-groupe' });
    });
  });

  it('embarquer sur un navire à quai AU LIEU COURANT : accepté (même règle que pour le quitter)', () => {
    const aQuai = navire({ kind: 'au-lieu', placeId: 'altdorf' });
    const carte = { places: [{ id: 'altdorf', scene: 'sc-altdorf' }] } as unknown as EtatDeJeu['worldMap'];
    avecPartie({ ...etatInitialDuJeu(), party: [heros()], possessions: [mule, aQuai], worldMap: carte, scene: { ...testScene(), id: 'sc-altdorf' } }, (partie) => {
      expect(ciblesDEmbarquement(partie.etat(), mule.uid).cibles.map((p) => p.uid)).toEqual(['pos-2']);
      partie.envoyer({ type: 'embark', args: [mule.uid, 'pos-2'] });
      expect(partie.etat().possessions[0].location).toEqual({ kind: 'embarquee', hostUid: 'pos-2' });
    });
  });

  it('un immeuble ne se reprend pas, même au bon Lieu', () => {
    const maison = { uid: 'pos-1', ownerId: 'h1', nature: 'immeuble', ref: {}, location: { kind: 'au-lieu', placeId: 'altdorf' }, items: [] } as unknown as Possession;
    const carte = { places: [{ id: 'altdorf', scene: 'sc-altdorf' }] } as unknown as EtatDeJeu['worldMap'];
    avecPartie({ ...etatInitialDuJeu(), party: [heros()], possessions: [maison], worldMap: carte, scene: { ...testScene(), id: 'sc-altdorf' } }, (partie) => {
      const appel = partie.envoyer({ type: 'retrievePossession', args: [maison.uid] });
      expect(partie.etat().possessions[0].location).toEqual({ kind: 'au-lieu', placeId: 'altdorf' });
      expect(lignesDuJournal(appel)).toEqual([t('pos.immeubleImmobile')]);
    });
  });

  it('débarquer une possession qui n’est pas embarquée, abandonner une possession hors du groupe : refusés, et dits', () => {
    const orpheline = { ...mule, uid: 'pos-3', ownerId: 'parti' } as Possession;
    avecPartie({ ...etatInitialDuJeu(), party: [heros()], possessions: [mule, orpheline] }, (partie) => {
      const debarque = partie.envoyer({ type: 'disembark', args: [mule.uid] });
      expect(lignesDuJournal(debarque)).toEqual([t('pos.dejaAvecLeGroupe')]);
      const abandon = partie.envoyer({ type: 'abandonPossession', args: [orpheline.uid] });
      expect(partie.etat().possessions[1].destroyed, 'une possession hors du groupe a été abandonnée').toBeFalsy();
      expect(lignesDuJournal(abandon)).toEqual([t('pos.horsDuGroupe')]);
    });
  });

  it('une possession dont le propriétaire n’est pas du groupe ne se déplace pas', () => {
    const orpheline = { ...mule, ownerId: 'parti' } as Possession;
    avecPartie({ ...etatInitialDuJeu(), party: [heros()], possessions: [orpheline, navire({ kind: 'avec-le-groupe' })] }, (partie) => {
      partie.envoyer({ type: 'embark', args: [orpheline.uid, 'pos-2'] });
      expect(partie.etat().possessions[0].location).toEqual({ kind: 'avec-le-groupe' });
      expect(refusGestePossession(partie.etat(), orpheline.uid, { kind: 'abandonner' })).toBe(t('pos.horsDuGroupe'));
    });
  });

  it('témoin : sur un navire du groupe, la mule embarque', () => {
    avecPartie({ ...etatInitialDuJeu(), party: [heros()], possessions: [mule, navire({ kind: 'avec-le-groupe' })] }, (partie) => {
      expect(ciblesDEmbarquement(partie.etat(), mule.uid).cibles.map((p) => p.uid)).toEqual(['pos-2']);
      partie.envoyer({ type: 'embark', args: [mule.uid, 'pos-2'] });
      expect(partie.etat().possessions[0].location).toEqual({ kind: 'embarquee', hostUid: 'pos-2' });
    });
  });
});

describe('openMedic — le verdict (`refusDeSoins`) est celui du geste', () => {
  it('en combat, l’infirmerie ne s’ouvre pas et le refus se dit (jamais un no-op muet)', () => {
    enCombat((partie, H) => {
      partie.envoyer({ type: 'openMedic', args: [{ patientId: H.id }] });
      expect(partie.etat().medic).toBeFalsy();
      expect(partie.etat().refus?.texte).toBe(t('medic.inCombat'));
    });
  });

  it('sur un héros indemne, l’infirmerie ne s’ouvre pas : le geste dit qu’il n’y a rien à soigner', () => {
    const heros = heroDuDuel();
    avecPartie({ ...etatInitialDuJeu(), party: [heros] }, (partie) => {
      const appel = partie.envoyer({ type: 'openMedic', args: [{ patientId: heros.id }] });
      expect(partie.etat().medic, 'l’infirmerie s’est ouverte sur un héros indemne').toBeFalsy();
      expect(lignesDuJournal(appel)).toEqual([t('medic.rienASoigner', { name: heros.label })]);
      expect(refusDeSoins(partie.etat(), heros.id), 'l’écran lit le refus que rend le geste').toBe(lignesDuJournal(appel)[0]);
    });
  });
});

describe('buySpellComponent — le verdict (`refusAchatDeComposant`) est celui du geste', () => {
  it('un sort inconnu du héros : refusé, rien n’est payé', () => {
    const heros = heroDuDuel();
    expect(refusAchatDeComposant(heros, 'projectile-magique-inexistant')).toBe(t('pf.componentSpellNotFound'));
    avecPartie({ ...etatInitialDuJeu(), party: [heros] }, (partie) => {
      const appel = partie.envoyer({ type: 'buySpellComponent', args: [heros.id, 'projectile-magique-inexistant'] });
      expect(partie.etat().party[0].componentSpells ?? []).toEqual([]);
      expect(lignesDuJournal(appel)).toEqual([t('pf.componentSpellNotFound')]);
    });
  });
});

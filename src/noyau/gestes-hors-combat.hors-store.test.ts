/**
 * LES GESTES HORS COMBAT OFFERTS PAR LE NOYAU (#4938) : un hôte désigne la cible (une rangée d'avancement, un sort, un
 * set, un patient, un lanceur et sa cible), le noyau rend le `GesteFermable`. Joué par la partie, le geste offert a son
 * effet ; refusé, son refus est la ligne que le verbe écrit au journal.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import {
  buildAdvancementView,
  creerPartie,
  etatInitialDuJeu,
  fenetreDuJeu,
  gesteDAchatDuSort,
  gesteDeLaPanoplie,
  gesteDeDetermination,
  gesteDeSoins,
  gesteDIncantation,
  gesteDeLaisserPasserLeTemps,
  gesteDuRepos,
  gestesDeLObjet,
  arena,
  MINUTES_PER_DAY,
  VERBE_DE_VALIDATION,
  type EntreesDeLaPartie,
  type EtatDeJeu,
  type Intention,
  type Partie,
  type ResultatDeLAppel,
  type TalentDesigne,
} from './index';
import type { GesteDuNoyau, GesteFermable } from './actionsDuNoyau';
import { heroDuDuel } from './combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import { createHero } from '../engine/character';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { chaosSpellsOf, findSpellById, spells } from '../data';
import { eligibleTalent } from '../engine/grimoire';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';
import { nomDe } from '../engine/nom';
import { poserLaDetermination } from '../engine/talentEffects';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

const lignesDuJournal = ({ journal }: ResultatDeLAppel) => journal.flatMap((l) => (l.de === 'journal' ? [l.entree.texte] : []));

/** Une partie ouverte sur le groupe `party`, fermée après `jouer`. */
function avecGroupe(party: Combatant[], jouer: (partie: Partie) => void): void {
  const partie = creerPartie({ ...etatInitialDuJeu(), party, flags: {} } as EtatDeJeu, ENTREES);
  try {
    jouer(partie);
  } finally {
    partie.fermer();
  }
}

/** Joue le geste offert, tel qu'un hôte le joue : son verbe, ses arguments. */
const jouer = (partie: Partie, { verbe, args }: GesteDuNoyau): ResultatDeLAppel => partie.envoyer({ type: verbe, args } as unknown as Intention);

/** Le geste offert, refusé : rien ne change, et le journal dit son refus. */
function refuseCommeLeVerbe(partie: Partie, offre: GesteFermable | null): void {
  expect(offre?.refus, 'l’offre ne refuse pas').toBeTruthy();
  expect(lignesDuJournal(jouer(partie, offre!.geste)), 'l’offre et le verbe ne disent pas la même chose').toEqual([offre!.refus]);
}

const heros = (careerId: string, patch: Partial<Combatant> = {}): Combatant =>
  ({ ...createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId, label: 'H', seed: 1 }), ...patch });

describe('buildAdvancementView — chaque rangée achetable est le geste de son achat', () => {
  it('joué, le geste de la rangée achète : Caractéristique, Compétence connue et à acquérir, Talent, option d’un emplacement, Carrière', () => {
    const jouees: [string, (v: ReturnType<typeof buildAdvancementView>) => GesteFermable, (h: Combatant) => unknown][] = [
      ['Caractéristique', (v) => v.chars.find((c) => c.inCareer)!, (h) => h.charAdvances],
      ['Compétence connue', (v) => v.skills.find((s) => s.known && s.inCareer)!, (h) => h.skills],
      ['Compétence à acquérir', (v) => v.skills.find((s) => !s.known)!, (h) => h.skills],
      ['Talent', (v) => v.talents.find((r): r is TalentDesigne => !!r.geste && !r.refus)!, (h) => h.talents],
      ['Carrière', (v) => v.targets.find((c) => !c.refus)!, (h) => h.careerLevel],
    ];
    for (const [nom, rangee, lu] of jouees) {
      avecGroupe([heros('soldat', { careerLevel: 2, xp: 5000 })], (partie) => {
        const offre = rangee(buildAdvancementView(partie.etat(), partie.etat().party[0]));
        expect(offre.refus, `${nom} : témoin, l’achat est ouvert`).toBeNull();
        const avant = structuredClone(lu(partie.etat().party[0]));
        jouer(partie, offre.geste);
        expect(partie.etat().party[0].xp, `${nom} : le geste n’a rien dépensé`).toBeLessThan(5000);
        expect(lu(partie.etat().party[0]), `${nom} : le geste n’a rien acheté`).not.toEqual(avant);
      });
    }
    avecGroupe([heros('artisan', { xp: 5000 })], (partie) => {
      const emplacement = buildAdvancementView(partie.etat(), partie.etat().party[0]).talents.find((r) => r.options?.length)!;
      const option = emplacement.options!.find((o) => !o.refus && !o.owned)!;
      jouer(partie, option.geste);
      const vue = buildAdvancementView(partie.etat(), partie.etat().party[0]);
      expect(vue.talents.find((r) => r.slotKey === emplacement.slotKey)?.geste, 'l’option jouée n’a pas désigné son emplacement').toEqual(option.geste);
    });
  });

  it('à 0 PX, le refus de chaque rangée est celui que son geste écrit au journal', () => {
    avecGroupe([heros('soldat', { careerLevel: 2, xp: 0 })], (partie) => {
      const v = buildAdvancementView(partie.etat(), partie.etat().party[0]);
      const offres: GesteFermable[] = [
        v.chars.find((x) => x.inCareer)!,
        v.skills.find((s) => s.known && s.inCareer)!,
        v.skills.find((s) => !s.known)!,
        v.talents.find((r): r is TalentDesigne => !!r.geste)!,
        v.targets[0],
      ];
      for (const offre of offres) refuseCommeLeVerbe(partie, offre);
      expect(partie.etat().party[0].xp).toBe(0);
    });
  });

  it('la Compétence de carrière à acquérir porte la remise du Talent qui l’ajoute : ouverte à son coût remisé, son geste l’achète à ce coût (LDB 10)', () => {
    const base = heros('emissaire', { careerLevel: 2 });
    const emissaire = { ...base, talents: [...base.talents, { talentId: 'artiste', spec: 'ecriture', times: 1 }], xp: 0 };
    const art = (h: Combatant) => buildAdvancementView({ battle: null, flags: {} }, h).skills.find((s) => !s.known && s.skill.id === 'art' && s.skill.spec === 'ecriture')!;
    const cout = art(emissaire).nextCost!;
    expect(cout, 'témoin : la remise abaisse le coût de la 1re Augmentation').toBe(5);
    avecGroupe([{ ...emissaire, xp: cout }], (partie) => {
      const rangee = art(partie.etat().party[0]);
      expect(rangee.refus).toBeNull();
      jouer(partie, rangee.geste);
      const h = partie.etat().party[0];
      expect([h.xp, h.skills.find((s) => s.id === 'art' && s.spec === 'ecriture')?.advances]).toEqual([0, 1]);
    });
  });

  it('la Compétence d’un emplacement à désigner, désigné ou non, pas encore apprise, est à acquérir : son geste l’achète', () => {
    const soldat = heros('soldat', { careerLevel: 2, xp: 5000 });
    const ouvert = buildAdvancementView({ battle: null, flags: {} }, soldat).skillSlotsOpen.find((r) => r.options.some((o) => !o.ownedAdvances))!;
    const { skill, geste, refus } = ouvert.options.find((o) => !o.ownedAdvances)!;
    const apprise = (h: Combatant) => h.skills.find((s) => s.id === skill.id && s.spec === skill.spec)?.advances;
    expect(refus, 'témoin : l’option de l’emplacement non désigné est ouverte').toBeNull();
    avecGroupe([soldat], (partie) => {
      jouer(partie, geste);
      expect(apprise(partie.etat().party[0]), 'l’option jouée n’a pas acheté sa Compétence').toBe(1);
    });
    const designe = { ...soldat, careerSlotChoices: { soldat: { [ouvert.slotKey]: `${skill.id}|${skill.spec}` } } };
    avecGroupe([designe], (partie) => {
      const vue = buildAdvancementView(partie.etat(), partie.etat().party[0]);
      expect(vue.skillSlotsOpen.some((r) => r.slotKey === ouvert.slotKey), 'témoin : l’emplacement est désigné').toBe(false);
      const rangee = vue.skills.find((s) => !s.known && s.skill.id === skill.id && s.skill.spec === skill.spec)!;
      expect(rangee?.refus, 'la Compétence désignée n’est pas offerte').toBeNull();
      jouer(partie, rangee.geste);
      expect(apprise(partie.etat().party[0])).toBe(1);
    });
  });

  it('un emplacement « A ou B » non désigné propose ses deux Compétences, et elles seules (Alchimiste, Métier (Forgeron) ou Métier (Orfèvre))', () => {
    const alchimiste = heros('alchimiste', { careerLevel: 2, xp: 0 });
    const emplacement = buildAdvancementView({ battle: null, flags: {} }, alchimiste).skillSlotsOpen.find((r) => r.options.some((o) => o.skill.id === 'metier'))!;
    expect(emplacement.options.map((o) => o.skill)).toEqual([{ id: 'metier', spec: 'forgeron' }, { id: 'metier', spec: 'orfevre' }]);
    avecGroupe([alchimiste], (partie) => refuseCommeLeVerbe(partie, emplacement.options[0]));
  });

  it('l’option d’un joker déjà possédée au bout de la table des coûts : son refus est celui que le verbe écrit (Érudit 5e, Savoir (Empire) à 75)', () => {
    const base = heros('erudit-5e', { careerLevel: 4 });
    const savant = { ...base, xp: 100000, progression: '5e' as const, skills: [...base.skills.filter((s) => s.id !== 'savoir'), { id: 'savoir', spec: 'empire', characteristic: 'intelligence' as const, advances: 75 }] };
    avecGroupe([savant], (partie) => {
      const option = buildAdvancementView(partie.etat(), partie.etat().party[0]).skillSlotsOpen.flatMap((r) => r.options).find((o) => o.skill.id === 'savoir' && o.skill.spec === 'empire');
      refuseCommeLeVerbe(partie, option ?? null);
    });
  });

});

describe('gesteDAchatDuSort — apprendre un sort désigné', () => {
  /** Un sorcier à Magie mineure, BFM 2, deux sorts mineurs déjà connus : le suivant coûte 50 PX (LDB 10 l.718). */
  const sorcier = (xp: number): Combatant => {
    const w = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 707, careerTalent: { id: 'magie-mineure' }, talentsRolled: false });
    w.spells = ['flechette', 'choc'];
    w.characteristics['force-mentale'] = 25;
    return { ...w, xp };
  };

  it('joué, le geste offert apprend le sort contre ses PX', () => {
    avecGroupe([sorcier(60)], (partie) => {
      const offre = gesteDAchatDuSort(partie.etat(), partie.etat().party[0].id, 'drain')!;
      expect(offre.refus).toBeNull();
      jouer(partie, offre.geste);
      expect(partie.etat().party[0].spells).toContain('drain');
      expect(partie.etat().party[0].xp).toBe(10);
    });
  });

  it('PX insuffisants, sort déjà connu, sort introuvable : le refus de l’offre est celui du verbe', () => {
    avecGroupe([sorcier(10)], (partie) => {
      const w = partie.etat().party[0];
      expect(gesteDAchatDuSort(partie.etat(), w.id, 'drain')!.refus).toBe(t('pf.notEnoughXp', { name: nomDe(w), cost: 50 }));
      for (const sort of ['drain', 'choc', 'sort-inconnu']) refuseCommeLeVerbe(partie, gesteDAchatDuSort(partie.etat(), w.id, sort));
      expect(partie.etat().party[0].spells).toEqual(['flechette', 'choc']);
    });
  });

  it('Magie du Chaos au Maxi : la prise payée hors de son Domaine épuise le Talent, et le sort suivant est refusé comme le verbe le refuse (LDB 10 l.704-708)', () => {
    const domaine = chaosSpellsOf('nurgle');
    const w = { ...createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 707, talentsRolled: false }), spells: [], xp: 1000 };
    w.talents = [{ talentId: 'magie-du-chaos', spec: 'nurgle', times: 1 }];
    const horsDomaine = spells.find((sp) => !domaine.includes(sp.id) && eligibleTalent(w, sp)?.kind === 'chaos')!.id;
    avecGroupe([w], (partie) => {
      const premiere = gesteDAchatDuSort(partie.etat(), w.id, horsDomaine)!;
      expect(premiere.refus).toBeNull();
      jouer(partie, premiere.geste);
      expect(partie.etat().party[0].spells, 'témoin : la 1re prise est apprise').toEqual([horsDomaine]);
      const xp = partie.etat().party[0].xp;
      const offre = gesteDAchatDuSort(partie.etat(), w.id, domaine[0])!;
      expect(offre.refus).toBe(t('adv.talentMax'));
      refuseCommeLeVerbe(partie, offre);
      expect(partie.etat().party[0].xp).toBe(xp);
      expect(partie.etat().party[0].spells).not.toContain(domaine[0]);
    });
  });
});

describe('gesteDeLaPanoplie et gestesDeLObjet(…, setId) — le set désigné par son id', () => {
  /** Un soldat à un set d'armes de plus (`creerLaPanoplie`), et l'un de ses sets vides hors de l'actif. */
  function deuxSets(jouerAvec: (partie: Partie, heros: Combatant, neuf: string) => void): void {
    avecGroupe([heros('soldat')], (partie) => {
      const id = partie.etat().party[0].id;
      partie.envoyer({ type: 'creerLaPanoplie', args: [id] });
      const h = partie.etat().party[0];
      jouerAvec(partie, h, h.loadouts!.find((l) => l.id !== h.activeLoadoutId && !l.main)!.id);
    });
  }

  it('joué, le geste offert prend le set désigné', () => {
    deuxSets((partie, h, neuf) => {
      const offre = gesteDeLaPanoplie(partie.etat(), h.id, neuf)!;
      expect(offre.refus).toBeNull();
      jouer(partie, offre.geste);
      expect(partie.etat().party[0].activeLoadoutId).toBe(neuf);
    });
  });

  it('un set introuvable : le refus de l’offre est celui du verbe', () => {
    deuxSets((partie, h) => {
      refuseCommeLeVerbe(partie, gesteDeLaPanoplie(partie.etat(), h.id, 'set-inconnu'));
      expect(partie.etat().party[0].activeLoadoutId).toBe(h.activeLoadoutId);
    });
  });

  it('`mains` vise le set désigné, sans repli sur l’actif : joué, son geste garnit CE set', () => {
    deuxSets((partie, h, neuf) => {
      const arme = h.items!.find((i) => i.kind === 'melee')!;
      const gestes = gestesDeLObjet(partie.etat(), h.id, arme.uid, neuf)!;
      expect(gestes.mains!.set).toBe(neuf);
      expect(gestes.mains!.main.refus).toBeNull();
      jouer(partie, gestes.mains!.main.geste);
      expect(partie.etat().party[0].loadouts!.find((l) => l.id === neuf)!.main).toBe(arme.uid);
      expect(gestesDeLObjet(partie.etat(), h.id, arme.uid, 'set-inconnu')!.mains, 'un set inconnu retombe sur l’actif').toBeNull();
    });
  });
});

describe('gesteDeSoins — soigner un patient désigné', () => {
  it('joué, le geste offert ouvre l’infirmerie sur le patient ; un patient indemne : le refus de l’offre est celui du verbe', () => {
    const blesse = { ...heros('soldat'), id: 'blesse' };
    const indemne = { ...heros('soldat'), id: 'indemne' };
    indemne.skills = [...indemne.skills, { id: 'guerison', characteristic: 'intelligence', advances: 10 }];
    blesse.wounds = { ...blesse.wounds, current: 1 };
    avecGroupe([blesse, indemne], (partie) => {
      refuseCommeLeVerbe(partie, gesteDeSoins(partie.etat(), 'indemne'));
      expect(partie.etat().medic).toBeFalsy();
      const offre = gesteDeSoins(partie.etat(), 'blesse');
      expect(offre.refus).toBeNull();
      jouer(partie, offre.geste);
      expect(partie.etat().medic?.patientId).toBe('blesse');
    });
  });
});

describe('gesteDIncantation — incanter hors combat sur une cible désignée', () => {
  const SORT = 'benediction-de-puissance';
  /** Un prêtre de Sigmar Béni qui connaît `SORT` (LDB 41), et un compagnon. */
  const groupe = (beni: boolean): Combatant[] => {
    const p = { ...herosDeScenario(idsDeTest, 'pretre'), id: 'p' };
    p.talents = [...p.talents.filter((x) => x.talentId !== 'beni'), ...(beni ? [{ talentId: 'beni', spec: 'sigmar', times: 1 }] : [])];
    p.spells = [...(p.spells ?? []), SORT];
    return [p, { ...heros('soldat'), id: 'c' }];
  };

  it('joué, le geste offert ouvre l’incantation sur la cible désignée', () => {
    avecGroupe(groupe(true), (partie) => {
      const offre = gesteDIncantation(partie.etat(), 'p', SORT, 'c')!;
      expect(offre.refus).toBeNull();
      jouer(partie, offre.geste);
      expect(partie.etat().pendingCast).toMatchObject({ casterId: 'p', targetId: 'c', spellId: SORT });
    });
  });

  it('sans le Talent Béni, ou sur une cible hors du groupe : le refus de l’offre est celui du verbe', () => {
    avecGroupe(groupe(false), (partie) => {
      const spell = findSpellById(SORT)!;
      refuseCommeLeVerbe(partie, gesteDIncantation(partie.etat(), 'p', SORT, 'c'));
      expect(gesteDIncantation(partie.etat(), 'p', SORT, 'inconnu')!.refus).toBe(t('cs.cibleHorsDuGroupe', { spell: spell.label, id: 'inconnu' }));
      refuseCommeLeVerbe(partie, gesteDIncantation(partie.etat(), 'p', SORT, 'inconnu'));
      expect(partie.etat().pendingCast).toBeFalsy();
    });
  });
});

describe('gesteDeDetermination — dépenser la Détermination hors combat pour retirer un État désigné', () => {
  const aTerre = (points: number): Combatant => {
    const h = heros('soldat');
    poserLaDetermination(h, points);
    return { ...h, conditions: [...h.conditions, { id: 'a-terre', value: 1 }] };
  };
  const porteATerre = (h: Combatant) => h.conditions.some((c) => c.id === 'a-terre');
  it('joué, le geste offert retire l’État contre un point ; sans Détermination, le refus de l’offre est celui du verbe (LDB 17 l.61)', () => {
    avecGroupe([aTerre(1)], (partie) => {
      const offre = gesteDeDetermination(partie.etat(), partie.etat().party[0].id, 'retirerUnEtat', 'a-terre')!;
      expect(offre.refus).toBeNull();
      jouer(partie, offre.geste);
      expect(porteATerre(partie.etat().party[0]), 'le geste n’a pas retiré l’État').toBe(false);
    });
    avecGroupe([aTerre(0)], (partie) => {
      refuseCommeLeVerbe(partie, gesteDeDetermination(partie.etat(), partie.etat().party[0].id, 'retirerUnEtat', 'a-terre'));
      expect(porteATerre(partie.etat().party[0])).toBe(true);
    });
  });
});

describe('VERBE_DE_VALIDATION — la validation d’une fenêtre, désignée sans nommer son verbe', () => {
  it('le début du Round offre sa validation ; jouée, la fenêtre se ferme', () => {
    const partie = creerPartie(etatInitialDuJeu(), ENTREES);
    try {
      partie.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null, combatDirect: 'enc-mutants' });
      const fenetre = fenetreDuJeu(partie.etat() as never)!;
      const validation = fenetre.gestes.find((g) => g.verbe === VERBE_DE_VALIDATION)!;
      expect(validation.fenetre).toBe(fenetre.cle);
      partie.envoyer({ type: validation.verbe, args: [validation.fenetre] } as unknown as Intention);
      expect(fenetreDuJeu(partie.etat() as never)?.cle).not.toBe(fenetre.cle);
    } finally {
      partie.fermer();
    }
  });
});

describe('gesteDuRepos et gesteDeLaisserPasserLeTemps — la nuit et le jour qui passent, hors combat', () => {
  /** Une Colique déclarée, `jours` jours de Durée. LDB 20 */
  const colique = (jours: number) => ({ id: 'colique', phase: 'active' as const, symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: jours * MINUTES_PER_DAY, durationMinutes: jours * MINUTES_PER_DAY });
  const malade = (): Combatant => ({ ...heros('soldat'), id: 'malade', diseases: [colique(10)] });
  const soignant = (): Combatant => {
    const h = { ...heros('soldat'), id: 'soignant' };
    h.skills = [...h.skills, { id: 'guerison', characteristic: 'intelligence', advances: 10 }];
    return h;
  };
  const dureeDe = (partie: Partie) => partie.etat().party.find((h) => h.id === 'malade')!.diseases![0].minutesLeft;
  /** Une partie lancée sur une place dégagée, en exploration, fermée après `jouer`. */
  function surLaPlace(party: Combatant[], jouer: (partie: Partie) => void): void {
    const partie = creerPartie(etatInitialDuJeu(), ENTREES);
    try {
      partie.lancer({ party, scene: arena({ id: 'place', label: 'Place' }), projet: null });
      jouer(partie);
    } finally {
      partie.fermer();
    }
  }

  it('hors de toute scène, pas de repos : le refus de l’offre est celui du verbe, et rien ne s’ouvre', () => {
    avecGroupe([malade()], (partie) => {
      refuseCommeLeVerbe(partie, gesteDuRepos(partie.etat()));
      expect(partie.etat().pendingRest).toBeFalsy();
    });
  });

  it('joué sur une place, le geste offert ouvre la nuit au camp ; la nuit à régler ferme le repos et le temps qui passe', () => {
    surLaPlace([malade()], (partie) => {
      const offre = gesteDuRepos(partie.etat());
      expect(offre.refus).toBeNull();
      jouer(partie, offre.geste);
      expect(partie.etat().pendingRest?.places.camp).toBe(true);
      refuseCommeLeVerbe(partie, gesteDuRepos(partie.etat()));
      refuseCommeLeVerbe(partie, gesteDeLaisserPasserLeTemps(partie.etat(), MINUTES_PER_DAY));
    });
  });

  it('en combat, ni repos ni temps qui passe : chaque refus est celui que le verbe affiche', () => {
    const partie = creerPartie(etatInitialDuJeu(), ENTREES);
    try {
      partie.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null, combatDirect: 'enc-mutants' });
      const heure = partie.etat().gameTime;
      for (const offre of [gesteDuRepos(partie.etat()), gesteDeLaisserPasserLeTemps(partie.etat(), MINUTES_PER_DAY)]) {
        expect(offre.refus, 'l’offre ne refuse pas').toBeTruthy();
        jouer(partie, offre.geste);
        expect(partie.etat().refus?.texte, 'l’offre et le verbe ne disent pas la même chose').toBe(offre.refus);
      }
      expect(partie.etat().pendingRest).toBeFalsy();
      expect(partie.etat().gameTime).toBe(heure);
    } finally {
      partie.fermer();
    }
  });

  it('un jour passe : l’horloge avance d’un jour, la maladie veillée par un autre que le patient perd deux jours (LDB 09 l.265, LDB 20)', () => {
    surLaPlace([malade(), soignant()], (partie) => {
      refuseCommeLeVerbe(partie, gesteDeLaisserPasserLeTemps(partie.etat(), 0));
      refuseCommeLeVerbe(partie, gesteDeLaisserPasserLeTemps(partie.etat(), 1.5));
      const [heure, duree] = [partie.etat().gameTime, dureeDe(partie)];
      const offre = gesteDeLaisserPasserLeTemps(partie.etat(), MINUTES_PER_DAY);
      expect(offre.refus).toBeNull();
      jouer(partie, offre.geste);
      expect(partie.etat().gameTime).toBe(heure + MINUTES_PER_DAY);
      expect(dureeDe(partie)).toBe(duree - 2 * MINUTES_PER_DAY);
    });
  });

  it('un jour passe pour le malade seul : il ne se soigne pas lui-même, sa maladie perd un jour', () => {
    surLaPlace([{ ...malade(), skills: [...malade().skills, { id: 'guerison', characteristic: 'intelligence', advances: 10 }] }], (partie) => {
      const duree = dureeDe(partie);
      jouer(partie, gesteDeLaisserPasserLeTemps(partie.etat(), MINUTES_PER_DAY).geste);
      expect(dureeDe(partie)).toBe(duree - MINUTES_PER_DAY);
    });
  });
});

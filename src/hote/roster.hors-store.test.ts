/**
 * LA PROCÉDURE DU ROSTER sur le `Stockage` d'un hôte (#3041) : charger, ajouter, retirer, mettre à jour ; tout
 * chargement qui retire (autre format) ou élague (#1463 LD.1) écrit son témoin dans le même stockage, consommé
 * par `prendreLesTemoinsDuRoster`, quel que soit le geste qui a chargé. Un stockage absent ou qui lève ne casse
 * aucun geste.
 */
import { idsDeTest, rosterDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ajouterAuRoster, chargerLeRoster, mettreAJourLeRoster, prendreLesTemoinsDuRoster, retirerDuRoster } from './roster';
import { engagerSurLeJeu } from './roster.testkit';
import { ouvrirLeBanc, surUnBancHorsTest } from '../noyau/banc.testkit';
import { newDraft } from '../noyau/creation/brouillon';
import { createHero } from '../engine/character';
import { ecrireLeRoster, type Combatant, type HerosDuRoster, type RosterEntry } from '../noyau/index';
import { rosterExport, rosterImport } from '../noyau/persistance/roster';
import { stockageEnMemoire, stockageQuiLeve } from '../lib/stockage.testkit';
import { brouillonComplet } from '../noyau/creation/engagement.testkit';
import { idDuPretire } from '../data/pregens';
import { PRETIRE_DE_TEST, poserLesPretires } from '../noyau/creation/pretireDeTest.testkit';

const CLE = 'wfrp4.roster';
/** `FORMAT_ROSTER` avant que l'id d'un héros de roster soit un `IdDeHerosDuRoster` (#2907 L3). */
const FORMAT_ROSTER_SANS_ID_DE_ROSTER = '0b4ad0cb46304157';
const ETAT_CONNU = 'a-terre';
const ETAT_INCONNU = 'etat-hors-registre';

const hero = (id: string, label = 'Héros'): HerosDuRoster => ({ id, label, kind: 'heros' }) as unknown as HerosDuRoster;
const entry = (id: string, label?: string): RosterEntry => ({ hero: hero(id, label), wealth: { gold: 1, silver: 2, brass: 3 }, draft: brouillonComplet() });

describe('la procédure du roster sur un stockage', () => {
  it('vide au départ, sans témoin', () => {
    const s = stockageEnMemoire();
    expect(chargerLeRoster(s)).toEqual([]);
    expect(prendreLesTemoinsDuRoster(s)).toBeNull();
  });

  it('ajouter puis charger ; ajouter le même héros le remplace ; retirer garde les autres', () => {
    const s = stockageEnMemoire();
    ajouterAuRoster(s, entry('h1'));
    ajouterAuRoster(s, entry('h2'));
    ajouterAuRoster(s, entry('h1', 'Renommé'));
    expect(chargerLeRoster(s)).toEqual([entry('h2'), entry('h1', 'Renommé')]);
    retirerDuRoster(s, 'h2');
    expect(chargerLeRoster(s)).toEqual([entry('h1', 'Renommé')]);
    expect(prendreLesTemoinsDuRoster(s)).toBeNull();
    expect(s.contenu.get(CLE)).toBe(ecrireLeRoster([entry('h1', 'Renommé')]));
  });

  it('mettre à jour porte le héros présent, et n’ajoute pas un héros absent', () => {
    const s = stockageEnMemoire();
    ajouterAuRoster(s, entry('h1'));
    const edite = { ...hero('h1'), motivation: 'Foi' } as unknown as Combatant;
    mettreAJourLeRoster(s, edite);
    mettreAJourLeRoster(s, hero('absent'));
    expect(chargerLeRoster(s)).toEqual([{ ...entry('h1'), hero: edite, draft: { ...brouillonComplet(), motivation: 'Foi', ambitionShort: '', ambitionLong: '' } }]);
  });

  it('un roster d’un autre format, ou illisible : RETIRÉ du stockage, témoin `retire` posé, pris une fois', () => {
    for (const brut of [JSON.stringify({ version: 'autre-format', heros: [entry('h1')] }), '{pas du json']) {
      const s = stockageEnMemoire();
      s.contenu.set(CLE, brut);
      expect(chargerLeRoster(s)).toEqual([]);
      expect(s.contenu.has(CLE)).toBe(false);
      chargerLeRoster(s);
      expect(prendreLesTemoinsDuRoster(s)).toEqual({ retire: true, elagage: null });
      expect(prendreLesTemoinsDuRoster(s), 'le témoin pris ne se reprend pas').toBeNull();
    }
  });

  it('un roster stocké sous le format d’avant l’id de roster (#2907), aux héros `hero-N` : RETIRÉ au chargement', () => {
    const s = stockageEnMemoire();
    s.contenu.set(CLE, JSON.stringify({ version: FORMAT_ROSTER_SANS_ID_DE_ROSTER, heros: [entry('hero-1')] }));
    expect(chargerLeRoster(s)).toEqual([]);
    expect(s.contenu.has(CLE)).toBe(false);
    expect(prendreLesTemoinsDuRoster(s)).toEqual({ retire: true, elagage: null });
  });

  it('le témoin survit à un geste d’ÉCRITURE : `ajouterAuRoster` sur un roster d’un autre format', () => {
    const s = stockageEnMemoire();
    s.contenu.set(CLE, JSON.stringify({ version: 'autre-format', heros: [entry('h0')] }));
    ajouterAuRoster(s, entry('h1'));
    expect(chargerLeRoster(s)).toEqual([entry('h1')]);
    expect(prendreLesTemoinsDuRoster(s)?.retire).toBe(true);
    expect(prendreLesTemoinsDuRoster(s)).toBeNull();
  });

  it('le témoin survit à un geste d’ÉCRITURE : `mettreAJourLeRoster` sur un roster qui porte un État inconnu', () => {
    const s = stockageEnMemoire();
    const porteur = { ...entry('h1'), hero: { ...hero('h1'), conditions: [{ id: ETAT_INCONNU, value: 1 }] } as unknown as HerosDuRoster };
    s.contenu.set(CLE, ecrireLeRoster([porteur]));
    mettreAJourLeRoster(s, hero('h1', 'Édité'));
    expect(prendreLesTemoinsDuRoster(s)?.elagage?.etats).toContain(ETAT_INCONNU);
  });

  it('un héros qui porte un État hors du registre : gardé sans lui, roster RÉÉCRIT élagué, témoin `elagage` posé (#1463 LD.1)', () => {
    const s = stockageEnMemoire();
    const porteur = { ...entry('h2'), hero: { ...hero('h2'), conditions: [{ id: ETAT_CONNU, value: 1 }, { id: ETAT_INCONNU, value: 1 }] } as unknown as HerosDuRoster };
    s.contenu.set(CLE, ecrireLeRoster([entry('h1'), porteur]));
    const heros = chargerLeRoster(s);
    expect(heros[1].hero.conditions).toEqual([{ id: ETAT_CONNU, value: 1 }]);
    expect(s.contenu.get(CLE)).toBe(ecrireLeRoster(heros));
    expect(prendreLesTemoinsDuRoster(s)).toEqual({ retire: false, elagage: { regles: [], etats: [ETAT_INCONNU], groupes: [] } });
    chargerLeRoster(s);
    expect(prendreLesTemoinsDuRoster(s), 'le roster réécrit ne se ré-élague pas').toBeNull();
  });

  it('sans stockage, ou un stockage qui lève : roster vide, aucun geste ne lève', () => {
    for (const s of [null, stockageQuiLeve]) {
      expect(chargerLeRoster(s)).toEqual([]);
      expect(prendreLesTemoinsDuRoster(s)).toBeNull();
      expect(() => ajouterAuRoster(s, entry('h1'))).not.toThrow();
      expect(() => retirerDuRoster(s, 'h1')).not.toThrow();
      expect(() => mettreAJourLeRoster(s, hero('h1'))).not.toThrow();
    }
  });
});

describe('ré-importer un export (#2907)', () => {
  it('l’export d’un héros du roster, ré-importé, met à jour son entrée ; un héros neuf s’ajoute', () => {
    const s = stockageEnMemoire();
    ajouterAuRoster(s, entry('h1', 'Avant'));
    for (const e of [entry('h1', 'Après'), entry('h2', 'Neuf')]) {
      const lu = rosterImport(rosterExport(e));
      ajouterAuRoster(s, lu.entry!);
    }
    expect(chargerLeRoster(s).map((e) => `${e.hero.id}:${e.hero.label}`)).toEqual(['h1:Après', 'h2:Neuf']);
  });
});

describe('engager un brouillon de création (#3059)', () => {
  const membre = (i: number) => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: `Membre ${i}`, seed: i });

  it('valide : l’entrée au roster garde le brouillon exact, le héros entre au groupe', () => {
    const s = stockageEnMemoire();
    const banc = ouvrirLeBanc();
    const d = brouillonComplet();
    expect(engagerSurLeJeu(s, banc.getState(), d, rosterDeTest('session'))).toBeNull();
    const [entree] = chargerLeRoster(s);
    expect(entree.draft).toEqual(d);
    expect(banc.getState().party.map((h) => h.id)).toEqual([entree.hero.id]);
  });

  it('une étape invalide refuse, sans rien écrire', () => {
    const s = stockageEnMemoire();
    const banc = ouvrirLeBanc();
    expect(engagerSurLeJeu(s, banc.getState(), newDraft(4242), rosterDeTest('session'))).toBe('Choisissez votre race.');
    expect(chargerLeRoster(s)).toEqual([]);
    expect(banc.getState().party).toEqual([]);
  });

  it('un groupe complet refuse, sans rien écrire', () => {
    const s = stockageEnMemoire();
    const banc = ouvrirLeBanc({ etat: { party: [1, 2, 3, 4].map(membre) } });
    expect(engagerSurLeJeu(s, banc.getState(), brouillonComplet(), rosterDeTest('session'))).toBe('Le groupe est complet (4 héros).');
    expect(chargerLeRoster(s)).toEqual([]);
  });

  it('deux sessions engagent chacune un brouillon au même roster : il garde les deux héros (#2907 S2)', () => {
    const s = stockageEnMemoire();
    for (const label of ['Alda', 'Bruno']) surUnBancHorsTest((banc) => expect(engagerSurLeJeu(s, banc.getState(), brouillonComplet(label), rosterDeTest(label))).toBeNull());
    expect(chargerLeRoster(s).map((e) => e.hero.label)).toEqual(['Alda', 'Bruno']);
  });

  it('en édition, le héros remplace en place celui qu’il modifie ; son id de roster, ou de pré-tiré, est conservé', () => {
    const s = stockageEnMemoire();
    const auRoster = { ...membre(1), id: rosterDeTest('avant')('hero') };
    ajouterAuRoster(s, { hero: auRoster, wealth: { gold: 0, silver: 0, brass: 0 }, draft: brouillonComplet() });
    poserLesPretires();
    const pretire = { ...membre(2), id: idDuPretire(PRETIRE_DE_TEST.id) };
    const banc = ouvrirLeBanc({ etat: { party: [auRoster, pretire] } });
    for (const h of [auRoster, pretire]) expect(engagerSurLeJeu(s, banc.getState(), brouillonComplet(), rosterDeTest('session'), h.id)).toBeNull();
    expect(banc.getState().party.map((h) => h.id)).toEqual([auRoster.id, pretire.id]);
    expect(banc.getState().party.map((h) => h.label)).toEqual([brouillonComplet().label, brouillonComplet().label]);
    expect(chargerLeRoster(s).map((e) => e.hero.id)).toEqual([auRoster.id, pretire.id]);
  });

  it('en édition, un héros sans id de roster garde son id : ce que l’état cite de lui pointe toujours vers lui ; une seule entrée de roster', () => {
    const s = stockageEnMemoire();
    const [a, b] = [membre(1), membre(2)];
    const banc = ouvrirLeBanc({ etat: {
      party: [a, b],
      possessions: [{ uid: 'pos-a', nature: 'bete', ownerId: a.id, location: { kind: 'avec-le-groupe' }, items: [], beastId: 'cheval-de-selle', label: 'Cheval' } as never],
      etats: { sosie: a.id },
      pendingOrders: [{ heroId: a.id, trappingId: 'corde' }],
    } });
    for (const label of ['Édité', 'Rééditée']) expect(engagerSurLeJeu(s, banc.getState(), brouillonComplet(label), rosterDeTest(label), a.id)).toBeNull();
    const etat = banc.getState();
    expect(etat.party.map((h) => h.id)).toEqual([a.id, b.id]);
    const cites = [...etat.possessions.map((p) => p.ownerId), ...Object.values(etat.etats), ...etat.pendingOrders.map((o) => o.heroId)];
    expect(cites).toEqual([a.id, a.id, a.id]);
    const roster = chargerLeRoster(s);
    expect(roster.map((e) => `${e.hero.id}:${e.hero.label}`)).toEqual(['Édité-hero-1:Rééditée']);
    expect(etat.party[0].idDeRoster).toBe('Édité-hero-1');
    expect(etat.party[0].label).toBe('Rééditée');
  });
});

/**
 * LA PROCÉDURE DU ROSTER sur le `Stockage` d'un hôte (#3041) : charger, ajouter, retirer, mettre à jour ; tout
 * chargement qui retire (autre format) ou élague (#1463 LD.1) écrit son témoin dans le même stockage, consommé
 * par `prendreLesTemoinsDuRoster`, quel que soit le geste qui a chargé. Un stockage absent ou qui lève ne casse
 * aucun geste.
 */
import { describe, it, expect } from 'vitest';
import { ajouterAuRoster, chargerLeRoster, mettreAJourLeRoster, prendreLesTemoinsDuRoster, retirerDuRoster } from './roster';
import { ecrireLeRoster, type Combatant, type RosterEntry } from '../noyau/index';
import { stockageEnMemoire, stockageQuiLeve } from '../lib/stockage.testkit';

const CLE = 'wfrp4.roster';
const ETAT_CONNU = 'a-terre';
const ETAT_INCONNU = 'etat-hors-registre';

const hero = (id: string, label = 'Héros'): Combatant => ({ id, label, kind: 'hero' }) as unknown as Combatant;
const entry = (id: string, label?: string): RosterEntry => ({ hero: hero(id, label), wealth: { gold: 1, silver: 2, brass: 3 } });

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
    expect(chargerLeRoster(s)).toEqual([{ ...entry('h1'), hero: edite, draft: undefined }]);
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
    const porteur = { ...entry('h1'), hero: { ...hero('h1'), conditions: [{ id: ETAT_INCONNU, value: 1 }] } as unknown as Combatant };
    s.contenu.set(CLE, ecrireLeRoster([porteur]));
    mettreAJourLeRoster(s, hero('h1', 'Édité'));
    expect(prendreLesTemoinsDuRoster(s)?.elagage?.etats).toContain(ETAT_INCONNU);
  });

  it('un héros qui porte un État hors du registre : gardé sans lui, roster RÉÉCRIT élagué, témoin `elagage` posé (#1463 LD.1)', () => {
    const s = stockageEnMemoire();
    const porteur = { ...entry('h2'), hero: { ...hero('h2'), conditions: [{ id: ETAT_CONNU, value: 1 }, { id: ETAT_INCONNU, value: 1 }] } as unknown as Combatant };
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

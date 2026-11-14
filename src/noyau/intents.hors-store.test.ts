/**
 * Garde-fou de l'allowlist coop : chaque intent DOIT exister comme action du noyau (un
 * renommage d'action casse ici, pas en prod chez un invité) — et l'allowlist reste
 * combat-only (aucune action de persistance/économie n'y traîne).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Jeu } from './etat';
import {
  GUEST_INTENTS, PARTY_INTENTS, INTERLUDE_INTENTS,
  type ActionManuscrite, type ClasseCoop, type Ouverture, type TableDesClasses,
} from './intentionsDeSiege';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('#2724 — table TOTALE des classes coop : une action non classée ne compile pas', () => {
  type EtatAvecActionNeuve = Jeu & { actionNeuve: (id: string) => void; champNeuf: number };

  it('la table réelle, privée de l’action neuve, ne satisfait plus le type total', () => {
    const sansClasse = (t: TableDesClasses): TableDesClasses<EtatAvecActionNeuve> =>
      // @ts-expect-error — `actionNeuve` n'a pas de classe
      t;
    const classee = (t: TableDesClasses): TableDesClasses<EtatAvecActionNeuve> => ({ ...t, actionNeuve: 'hôte' });
    const table = { terminerLeTour: 'invité' } as TableDesClasses;
    expect(sansClasse(table)).toBe(table);
    expect(classee(table).actionNeuve).toBe('hôte');
  });

  it('seules les actions MANUSCRITES s’écrivent : ni champ d’état, ni verbe de jet', () => {
    const neuve: ActionManuscrite<EtatAvecActionNeuve> = 'actionNeuve';
    // @ts-expect-error — un champ d'état n'est pas une action
    const champ: ActionManuscrite<EtatAvecActionNeuve> = 'champNeuf';
    // @ts-expect-error — un verbe de jet a sa classe DÉRIVÉE de `FLOW_VERBS`
    const delegue: ActionManuscrite = 'jetRelancer';
    // @ts-expect-error — trois classes, aucune autre
    const classe: ClasseCoop = 'miroir';
    expect([neuve, champ, delegue, classe]).toHaveLength(4);
  });

  it('un ouvreur `parHote` reste `hôte`, une élection locale reste `local`', () => {
    const t = { terminerLeTour: 'invité' } as TableDesClasses;
    // @ts-expect-error — `evaluerLObjet` ouvre le flux `evaluation` depuis un écran d'hôte
    const ouvreur: TableDesClasses = { ...t, evaluerLObjet: 'invité' };
    // @ts-expect-error — `designerLeSupport` n'écrit qu'un champ hors snapshot
    const election: TableDesClasses = { ...t, designerLeSupport: 'invité' };
    expect([ouvreur.evaluerLObjet, election.designerLeSupport]).toEqual(['invité', 'invité']);
  });

  it('une ouverture `interne` nomme son site `<module>.<fonction>`', () => {
    const site: Ouverture = { interne: 'combatFlow.maybeOpenDefense' };
    // @ts-expect-error — ouverture muette
    const muette: Ouverture = { interne: '' };
    // @ts-expect-error — aucun site nommé
    const vague: Ouverture = { interne: 'quelque part' };
    expect([site, muette, vague]).toHaveLength(3);
  });
});

describe('allowlist coop', () => {
  it('chaque intent correspond à une action existante du store', () => {
    const state = banc.getState() as unknown as Record<string, unknown>;
    const missing = [...GUEST_INTENTS].filter((name) => typeof state[name] !== 'function');
    expect(missing).toEqual([]);
  });

  it('la composition du groupe est allowlistée (chaque joueur remplit SES emplacements)', () => {
    for (const name of ['recruterLeHeros', 'renvoyerLeHeros', 'remplacerLeHeros']) {
      expect(PARTY_INTENTS.has(name), name).toBe(true);
      expect(GUEST_INTENTS.has(name), name).toBe(true);
    }
  });

  it('aucune action de persistance/économie/exploration dans l’allowlist (périmètre combat + groupe)', () => {
    for (const forbidden of ['saveGame', 'loadGame', 'importGame',
      'partirEnVoyage', 'deplacerLeGroupe', 'ouvrirLInterlude', 'chargerLeProjet',
      'lancerLaScene', 'fixerLeGroupe', 'accorderLesPx', 'ensemencerLeTirage', 'affecterLEmplacementAuSiege', 'affecterLeHerosAuSiege', 'affecterLeSiegeMJ']) {
      expect(GUEST_INTENTS.has(forbidden), forbidden).toBe(false);
    }
  });
});

describe('Activités d’interlude allowlistées (audit M7) — l’ouverture/clôture reste à l’hôte', () => {
  it('les activités par héros et le flux de jet sont permis à l’invité', () => {
    for (const name of INTERLUDE_INTENTS) expect(GUEST_INTENTS.has(name), name).toBe(true);
    expect(GUEST_INTENTS.has('fenetreChoisir'), 'composer et pratiquer une Activité').toBe(true);
    expect(GUEST_INTENTS.has('jetValider'), 'la clôture du jet d’Activité').toBe(true);
  });
});

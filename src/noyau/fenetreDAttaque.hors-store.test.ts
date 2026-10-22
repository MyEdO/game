/**
 * LA FENÊTRE D'ATTAQUE EN DONNÉES (`fenetreDAttaque`), sans store : un hôte qui n'a que la surface du noyau
 * (`./index`) lit ce que la modale du jet d'attaque montre, de la déclaration au jet, par les mêmes intentions que
 * le web. Le duel est celui de `combatDeTest.testkit.ts`, dans la scène de fixture.
 */
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, fenetreDAttaque, LOCALISATIONS_DE_COUP, type EntreesDeLaPartie, type FenetreDAttaque, type Partie } from './index';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

/** Le duel ouvert, le tour au héros, gardé puis repris par une seconde partie. */
function duel() {
  const ouverture = creerPartie({ ...etatInitialDuJeu(), party: [heroDuDuel()] }, ENTREES);
  ouverture.envoyer({ type: 'startScene', args: [testScene()] });
  ouverture.envoyer({ type: 'startCombat', args: ['enc-mutants'] });
  ouverture.envoyer({ type: 'confirmRoundStart', args: [] });
  const garde = ouverture.etat();
  ouverture.fermer();
  const contact = auContact(garde);
  return { ...contact, partie: creerPartie({ ...garde, ...contact.patch }, ENTREES) };
}

/** La vue lue, après avoir prouvé qu'elle traverse le JSON sans perte : aucune clé `undefined` ne s'y efface. */
const vue = (partie: Partie): FenetreDAttaque => {
  const f = fenetreDAttaque(partie.etat());
  expect(f, 'aucune fenêtre d’attaque lue').not.toBeNull();
  expect(JSON.parse(JSON.stringify(f)), 'la vue perd une clé ou une valeur au passage du JSON').toStrictEqual(f);
  return f!;
};

describe('fenetreDAttaque — la modale d’attaque lue par la seule surface du noyau', () => {
  it('rien à lire sans attaque en attente', () => {
    const { partie } = duel();
    try {
      expect(fenetreDAttaque(partie.etat())).toBeNull();
    } finally {
      partie.fermer();
    }
  });

  it('avant le jet : intitulé, Localisation, aperçu à jeter et défense annoncée ; après : le jet, l’opposition et l’issue', () => {
    const { H, E, partie } = duel();
    try {
      partie.envoyer({ type: 'battleClickEntity', args: [E.id, { confirm: true }] });
      const avant = vue(partie);
      expect(avant).toMatchObject({ intitule: 'Attaque', jete: false, bloque: null, issue: null, opposition: null, defenseAttendue: false });
      expect(avant.attaquantId).toBe(H.id);
      expect(avant.cibleId).toBe(E.id);
      expect(avant.sousTitre.startsWith(`${H.label} — Attaque`), avant.sousTitre).toBe(true);
      expect(avant.enTete).toContain('Dégâts +');
      expect(avant.localisation).toMatchObject({ verbe: 'attackSetLocation', choisie: null });
      expect(avant.localisation!.options.map((o) => o.valeur)).toEqual(expect.arrayContaining([null, ...LOCALISATIONS_DE_COUP]));
      expect(avant.localisation!.options).toHaveLength(LOCALISATIONS_DE_COUP.length + 1);
      expect(avant.jet && 'pending' in avant.jet ? avant.jet.pending.labelRef.category : null).toBe('skills');
      expect(avant.defense && 'pending' in avant.defense, 'la défense adverse n’est pas annoncée').toBe(true);
      expect(avant.influences).toMatchObject({ relancee: false, sombrePacte: true, inversion: null });

      partie.envoyer({ type: 'attackSetLocation', args: ['tete'] });
      const visee = vue(partie);
      expect(visee.localisation!.choisie).toBe('tete');
      const cibleDe = (f: FenetreDAttaque) => (f.jet && 'pending' in f.jet ? f.jet.pending.target : null);
      expect(cibleDe(visee), 'viser une Localisation ne change pas la cible annoncée').not.toBe(cibleDe(avant));
      partie.envoyer({ type: 'attackSetLocation', args: [null] });
      expect(vue(partie).localisation!.choisie).toBeNull();

      partie.envoyer({ type: 'attackRoll', args: [] });
      partie.envoyer({ type: 'attackSetForcedRoll', args: [11] });
      const apres = vue(partie);
      expect(apres.jete).toBe(true);
      expect(apres.jet && 'd' in apres.jet ? apres.jet.d?.roll : null).toBe(11);
      const res = partie.etat().pendingAttack!.result!;
      expect(apres.opposition).toEqual({ gagnante: 0, drNet: res.netSL });
      expect(apres.issue).toMatchObject({ genre: 'damage' });
      expect(apres.issue!.ligne.length).toBeGreaterThan(0);
    } finally {
      partie.fermer();
    }
  });
});

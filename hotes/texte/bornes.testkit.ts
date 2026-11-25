/**
 * LES BORNES DE SORTIE DE L'HÔTE TEXTE (#2898, M2) : le texte d'une réponse tient ses lignes ET ses caractères
 * (`BORNES`) ; le parcours d'un tour de combat que chaque suite joue sur son scénario (`bornes.hors-store.test.ts`,
 * celle d'un jeu sur le sien).
 */
import { expect } from 'vitest';
import { BORNES, caracteresAuPlus, type Commande } from './vue';
import { verbe, type table } from './hote.testkit';
import type { Reponse } from './serveur';

/** Le texte d'une réponse tient ses bornes : lignes, largeur de chaque ligne, caractères. */
export function tientSesBornes(nom: string, commande: Commande, r: Reponse, erreur = false) {
  expect(r.erreur !== null, `${nom} : ${r.texte}`).toBe(erreur);
  const lignes = r.texte.split('\n');
  expect(lignes.length, `${nom} : lignes\n${r.texte}`).toBeLessThanOrEqual(BORNES.lignes[commande]);
  expect(Math.max(...lignes.map((l) => l.length)), `${nom} : la ligne la plus longue`).toBeLessThanOrEqual(BORNES.largeur);
  expect(r.texte.length, `${nom} : caractères`).toBeLessThanOrEqual(caracteresAuPlus(commande));
}

/** Sur la table `t`, une partie neuve de `scenario` (graine 7) : nouvelle, jouer, vue, offres, carte, cases, fiche et
 *  journal d'un tour de combat tiennent leurs bornes. */
export function lesBornesDuCombat(t: ReturnType<typeof table>, scenario: string): void {
  tientSesBornes('nouvelle', 'nouvelle', t.nouvelle(scenario, { graine: 7 }));
  tientSesBornes('fenetreValider', 'jouer', t.jouer(verbe('fenetreValider', 'debutDuRound')));
  const vue = t.lire('vue');
  tientSesBornes('vue', 'vue', vue);
  expect(vue.texte, 'témoin : la vue est celle d’un tour de combat').toMatch(/^R1 tour \d+\/\d+ · actif /);
  tientSesBornes('offres', 'offres', t.lire('offres'));
  tientSesBornes('offres toutes', 'offres', t.lire('offres', { toutes: true }));
  tientSesBornes('carte', 'carte', t.lire('carte'));
  tientSesBornes('carte depuis 15', 'carte', t.lire('carte', { depuis: 15 }));
  tientSesBornes('journal', 'journal', t.lire('journal'));
  tientSesBornes('cases', 'cases', t.lire('cases'));
  const actif = /^R1 tour \d+\/\d+ · actif (\S+) /.exec(vue.texte)![1];
  tientSesBornes('fiche', 'fiche', t.lire('fiche', { id: actif }));
  tientSesBornes('terminerLeTour', 'jouer', t.jouer(verbe('terminerLeTour')));
}

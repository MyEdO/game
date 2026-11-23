/**
 * Le hameau : bâtir, engager, renvoyer.
 */

import { BATIMENTS, IdBatiment, nomDeCarriere, phraseDuPalier } from './valeurs';
import { Etat, renouvelerLesCandidats } from './etat';
import { noter } from './outils';

/** Les bâtiments qui servent dès le premier jour ; les autres sont en ruine tant qu'on ne les a pas relevés. */
const SERVENT_DES_LE_DEBUT: ReadonlySet<IdBatiment> = new Set(['relais', 'forge', 'cartographe']);
export const enRuine = (batiments: Etat['batiments'], id: IdBatiment): boolean => batiments[id] === 0 && !SERVENT_DES_LE_DEBUT.has(id);

export const palierSuivant = (e: Etat, id: IdBatiment) => BATIMENTS.find((b) => b.id === id)!.paliers[e.batiments[id] + 1];

export function ameliorer(e: Etat, id: IdBatiment): string | null {
  const p = palierSuivant(e, id);
  if (!p) return 'Déjà au plus haut.';
  if (e.or < p.cout) return `Il faut ${p.cout} CO.`;
  if (e.trophees < p.trophees) return `Il faut ${p.trophees} trophée(s).`;
  e.or -= p.cout; e.trophees -= p.trophees; e.batiments[id]++;
  noter(e, `${BATIMENTS.find((b) => b.id === id)!.nom} : ${phraseDuPalier(p)}.`);
  if (id === 'relais') renouvelerLesCandidats(e);
  return null;
}

export function recruter(e: Etat, i: number): string | null {
  const cand = e.candidats[i];
  if (!cand) return 'Candidat parti.';
  const gratuit = e.roster.length === 0 && e.or < cand.prix;
  if (!gratuit && e.or < cand.prix) return `Il faut ${cand.prix} CO.`;
  if (!gratuit) e.or -= cand.prix;
  const { prix: _prix, ...h } = cand;
  e.roster.push(h);
  e.candidats.splice(i, 1);
  noter(e, `${h.c.label}, ${nomDeCarriere(h.carriere).toLowerCase()}, rejoint la compagnie${gratuit ? ' sans solde, faute de mieux' : ''}.`);
  return null;
}

export function congedier(e: Etat, id: string): void {
  e.roster = e.roster.filter((h) => h.c.id !== id);
}

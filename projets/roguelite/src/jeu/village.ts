/**
 * Le hameau : bâtir, engager, loger, renvoyer.
 */
import { nomDeCarriere, prixDuSejourALAuberge, type QualiteDeRepos } from '../noyau';

import { BATIMENTS, CHAMBRE_DU_RELAIS, ECHELLE_DES_PRIX, IdBatiment, SEMAINE_DE_REPOS, phraseDuPalier } from './valeurs';
import { Etat, Heros, renouvelerLesCandidats } from './etat';
import { blesse } from './soins';
import { sejourDit } from './expedition';
import { heros, noter, refusDuPrix } from './outils';

/** Les bâtiments qui servent dès le premier jour ; les autres sont en ruine tant qu'on ne les a pas relevés. */
const SERVENT_DES_LE_DEBUT: ReadonlySet<IdBatiment> = new Set(['relais', 'forge', 'cartographe']);
export const enRuine = (batiments: Etat['batiments'], id: IdBatiment): boolean => batiments[id] === 0 && !SERVENT_DES_LE_DEBUT.has(id);

export const palierSuivant = (e: Etat, id: IdBatiment) => BATIMENTS.find((b) => b.id === id)!.paliers[e.batiments[id] + 1];

export function ameliorer(e: Etat, id: IdBatiment): string | null {
  const p = palierSuivant(e, id);
  if (!p) return 'Déjà au plus haut.';
  const refus = refusDuPrix(e.or, p.cout);
  if (refus) return refus;
  if (e.trophees < p.trophees) return `Il faut ${p.trophees} trophée(s).`;
  e.or -= p.cout; e.trophees -= p.trophees; e.batiments[id]++;
  noter(e, `${BATIMENTS.find((b) => b.id === id)!.nom} : ${phraseDuPalier(p)}.`);
  if (id === 'relais') renouvelerLesCandidats(e);
  return null;
}

/** Engage le candidat `i`, sans frais. */
export function recruter(e: Etat, i: number): string | null {
  const [h] = e.candidats.splice(i, 1);
  if (!h) return 'Candidat parti.';
  e.roster.push(h);
  noter(e, `${h.c.label}, ${nomDeCarriere(h.c).toLowerCase()}, rejoint la compagnie.`);
  return null;
}

/** La qualité de la chambre que le relais loue à son palier. */
export const qualiteDeLaChambre = (e: Etat) => CHAMBRE_DU_RELAIS[e.batiments.relais];
/** Le prix d'une semaine en chambre de qualité `qualite` : le séjour d'auberge du noyau, à l'échelle des prix du hameau. */
export const prixDUneChambre = (qualite: QualiteDeRepos): number => Math.max(1, Math.round(prixDuSejourALAuberge(qualite, SEMAINE_DE_REPOS) * ECHELLE_DES_PRIX));
export const prixDeLaChambre = (e: Etat): number => prixDUneChambre(qualiteDeLaChambre(e));
const enExpedition = (e: Etat, h: Heros): boolean => !!e.expedition?.groupe.includes(h.c.id);

/** Pourquoi le héros ne peut pas prendre de chambre (en expédition, déjà en séjour, rien à reposer), `null` s'il le
 *  peut ; l'or se lit à part. */
export function refusDeChambre(e: Etat, h: Heros): string | null {
  if (enExpedition(e, h)) return `${h.c.label} est en expédition.`;
  return sejourDit(h) ?? (blesse(h) ? null : 'Ni blessé ni fatigué : rien à reposer.');
}

/** Loue au héros une chambre du relais pour une semaine : il ne part pas en expédition, et se repose au fil des jours
 *  (`gesteDeDormir`, la nuit du noyau). */
export function prendreUneChambre(e: Etat, id: string): string | null {
  const h = heros(e, id);
  if (!h) return 'Héros introuvable.';
  const refus = refusDeChambre(e, h);
  if (refus) return refus;
  const prix = prixDeLaChambre(e);
  const manque = refusDuPrix(e.or, prix);
  if (manque) return manque;
  e.or -= prix;
  h.sejour = { ou: 'relais', reste: SEMAINE_DE_REPOS, total: SEMAINE_DE_REPOS };
  noter(e, `${h.c.label} prend une chambre à l’auberge pour une semaine.`);
  return null;
}

/** Pourquoi le héros ne peut pas être renvoyé (dernier de la compagnie, en expédition), `null` s'il le peut. */
export function refusDeRenvoi(e: Etat, h: Heros): string | null {
  if (e.roster.length <= 1) return 'Le dernier héros de la compagnie ne se renvoie pas.';
  return enExpedition(e, h) ? `${h.c.label} est en expédition.` : null;
}

/** Renvoie le héros de la compagnie, sans rien en retour. */
export function congedier(e: Etat, id: string): string | null {
  const h = heros(e, id);
  if (!h) return 'Héros introuvable.';
  const refus = refusDeRenvoi(e, h);
  if (refus) return refus;
  e.roster = e.roster.filter((x) => x !== h);
  noter(e, `${h.c.label} quitte la compagnie.`);
  return null;
}

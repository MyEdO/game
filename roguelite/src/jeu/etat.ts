/**
 * L'état d'une partie et sa création : la compagnie, les candidats, le hameau.
 */
import { generateName, nouvelleRecrue, type Combatant } from '../noyau';

import { ESPECES, IdBatiment, OR_INITIAL, PRIX_DE_RECRUE, PROFILS, TypeDeSalle } from './valeurs';
import { choisir, noter, profil, tirer } from './outils';

/** `retrait` : jours restants à l'hospice, sur `retraitTotal` ; le héros ne part pas en expédition. */
export interface Heros { c: Combatant; carriere: string; espece: string; expeditions: number; victoires: number; retrait?: number; retraitTotal?: number }
export interface Candidat extends Heros { prix: number }
export interface Tombe { nom: string; carriere: string; expeditions: number; ou: string; jour: number }
export interface Salle { type: TypeDeSalle; ennemis: string[]; faite: boolean }
/** `prieres` : les Bénis qui ont déjà prié pour soigner pendant l'expédition. */
export interface Expedition { destination: string; salles: Salle[]; index: number; groupe: string[]; or: number; trophees: number; px: number; prieres: string[] }

export interface Etat {
  version: 2;
  graine: number;
  jour: number;
  or: number;
  trophees: number;
  batiments: Record<IdBatiment, number>;
  roster: Heros[];
  candidats: Candidat[];
  cimetiere: Tombe[];
  expedition: Expedition | null;
  bossVaincus: string[];
  journal: string[];
}


export function nouvellePartie(graine: number): Etat {
  const e: Etat = {
    version: 2, graine, jour: 1, or: OR_INITIAL, trophees: 0,
    batiments: { relais: 0, temple: 0, salle: 0, forge: 0, cartographe: 0, peage: 0, memorial: 0 },
    roster: [], candidats: [], cimetiere: [], expedition: null, bossVaincus: [], journal: [],
  };
  for (const carriere of ['soldat', 'chasseur', 'pretre', 'sorcier']) e.roster.push(tirerUnHeros(e, carriere));
  renouvelerLesCandidats(e);
  noter(e, 'Quatre aventuriers descendent de la diligence à Grisefosse. Le hameau est en ruines ; tout reste à bâtir.');
  return e;
}

function tirerUnHeros(e: Etat, carriereImposee?: string): Heros {
  const rng = tirer(e);
  const p = carriereImposee ? profil(carriereImposee)! : choisir(rng, PROFILS.filter((x) => x.relais <= e.batiments.relais));
  const espece = p.espece ?? (rng.int(1, 10) <= 8 ? 'humains-reiklander' : choisir(rng, ['nains', 'halflings']));
  const sexe = rng.int(0, 1) ? 'M' : 'F';
  const nom = generateName(ESPECES[espece].race, sexe, rng) ?? 'Sans-nom';
  const c = nouvelleRecrue(e.graine++, p.id, espece, nom, p.identite);
  const morr = e.batiments.memorial;
  if (morr) c.xp = (c.xp ?? 0) + Math.min(morr * 100, e.cimetiere.length * 10 * morr);
  return { c, carriere: p.id, espece, expeditions: 0, victoires: 0 };
}

export function renouvelerLesCandidats(e: Etat): void {
  e.candidats = Array.from({ length: 2 + e.batiments.relais }, () => {
    const h = tirerUnHeros(e);
    return { ...h, prix: PRIX_DE_RECRUE[profil(h.carriere)!.relais] };
  });
}

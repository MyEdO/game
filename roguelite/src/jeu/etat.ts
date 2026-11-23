/**
 * L'état d'une partie et sa création : la compagnie, les candidats, le hameau.
 */
import { generateName, nouvelleRecrue, porterAuNiveau, tirerUneEspece, type Combatant } from '../noyau';

import { ESPECES, IdBatiment, OR_INITIAL, PRIX_DE_RECRUE, PROFILS, Profil, Role, SUPPLEMENT_PAR_NIVEAU, TypeDeSalle } from './valeurs';
import { choisir, noter, profil, tirer } from './outils';
import { remettreLesObjets } from './boutiques';

/** `retrait` : jours restants à l'hospice, sur `retraitTotal` ; le héros ne part pas en expédition. */
export interface Heros { c: Combatant; carriere: string; espece: string; expeditions: number; victoires: number; retrait?: number; retraitTotal?: number }
export interface Candidat extends Heros { prix: number }
export interface Tombe { nom: string; carriere: string; expeditions: number; ou: string; jour: number }
export interface Salle { type: TypeDeSalle; ennemis: string[]; faite: boolean }
/** `prieres` : les Bénis qui ont déjà prié pour soigner pendant l'expédition. */
/** `munitions` : les munitions de chaque héros au départ, par objet du catalogue ; elles sont ramassées au retour. */
export interface Expedition { destination: string; salles: Salle[]; index: number; groupe: string[]; or: number; trophees: number; px: number; prieres: string[]; munitions?: Record<string, Record<string, number>> }

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
  for (const carriere of ['soldat', 'chasseur', 'nonne', 'sorcier']) e.roster.push(recrue(e, profil(carriere)!));
  renouvelerLesCandidats(e);
  noter(e, 'Quatre aventuriers descendent de la diligence à Grisefosse. Le hameau est en ruines ; tout reste à bâtir.');
  return e;
}

/** Une recrue de la carrière `p` : une espèce que sa carrière admet (`tirerUneEspece`), créée par le moteur, portée par
 *  le noyau au niveau où la carrière s'engage (`porterAuNiveau`), puis dotée de ce que le roster lui remet en plus. */
export function recrue(e: Etat, p: Profil): Heros {
  const rng = tirer(e);
  const espece = tirerUneEspece(rng, p.id, Object.keys(ESPECES));
  const sexe = rng.int(0, 1) ? 'M' : 'F';
  const nom = generateName(ESPECES[espece].race, sexe, rng) ?? 'Sans-nom';
  const graine = e.graine++;
  const h: Heros = { c: porterAuNiveau(nouvelleRecrue(graine, p.id, espece, nom, p.identite), p.niveau, graine), carriere: p.id, espece, expeditions: 0, victoires: 0 };
  if (p.dotation) remettreLesObjets(e, h, p.dotation);
  const morr = e.batiments.memorial;
  if (morr) h.c.xp = (h.c.xp ?? 0) + Math.min(morr * 100, e.cimetiere.length * 10 * morr);
  return h;
}

/** Les candidats du relais : chacun d'un rôle que le tirage n'a pas encore donné, tant qu'il en reste, puis d'une
 *  carrière de ce rôle, chacune des carrières ouvertes par le palier du relais à chance égale. */
export function renouvelerLesCandidats(e: Etat): void {
  const ouvertes = PROFILS.filter((p) => p.relais <= e.batiments.relais);
  const roles = [...new Set(ouvertes.map((p) => p.role))];
  const rng = tirer(e);
  let restants: Role[] = [];
  e.candidats = Array.from({ length: 2 + e.batiments.relais }, () => {
    if (!restants.length) restants = [...roles];
    const role = choisir(rng, restants);
    restants = restants.filter((r) => r !== role);
    const p = choisir(rng, ouvertes.filter((x) => x.role === role));
    return { ...recrue(e, p), prix: PRIX_DE_RECRUE[p.relais] + SUPPLEMENT_PAR_NIVEAU * (p.niveau - 1) };
  });
}

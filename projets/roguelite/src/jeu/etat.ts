/**
 * L'état d'une partie et sa création : la compagnie, les candidats, le hameau.
 */
import { dotationDesNiveaux, nouvelleRecrue, porterAuNiveau, tirerUneEspece, type Combatant } from '../noyau';

import {
  ESPECES,
  estUtile,
  IdBatiment,
  type Rang,
  type LieuDeSejour,
  OR_INITIAL,
  PRIX_DE_RECRUE,
  PROFILS,
  Profil,
  SUPPLEMENT_PAR_NIVEAU,
  TypeDeSalle,
} from './valeurs';
import { choisir, noter, tirer } from './outils';
import { prendreSesArmes, remettreLesObjets, tenirLesObjets } from './boutiques';

/** Un séjour au bâtiment `ou` : `reste` jours sur `total` ; le héros ne part pas en expédition. */
export interface Sejour { ou: LieuDeSejour; reste: number; total: number }
/** `rang` : où le joueur l'a placé à l'entrée d'une rencontre (`rangDe`) ; sa consigne de combat est la doctrine de son
 *  combattant (`Combatant.aiDoctrine`). */
export interface Heros { c: Combatant; carriere: string; espece: string; expeditions: number; victoires: number; sejour?: Sejour; rang?: Rang }
export interface Candidat extends Heros { prix: number }
export interface Tombe { nom: string; carriere: string; expeditions: number; ou: string; jour: number }
/** `ouverte` : le groupe est entré dans une salle à choix (`EPREUVES`, `CAMP`) et attend le choix de son action ;
 *  `soignes` : les héros déjà soignés au camp. */
export interface Salle { type: TypeDeSalle; ennemis: string[]; faite: boolean; ouverte?: true; soignes?: string[] }
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
  for (const p of compagnieDeDepart(e)) e.roster.push(recrue(e, p));
  renouvelerLesCandidats(e);
  noter(e, 'Quatre aventuriers descendent de la diligence à Grisefosse. Le hameau est en ruines ; tout reste à bâtir.');
  return e;
}

/** La compagnie de départ : le front et le soigneur ouverts au relais 0, puis deux autres carrières de ce palier tirées
 *  sans doublon. */
function compagnieDeDepart(e: Etat): Profil[] {
  const ouvertes = PROFILS.filter((p) => p.relais === 0);
  const fixes = (['front', 'soigneur'] as const).map((r) => ouvertes.find((p) => p.role === r)!);
  const rng = tirer(e);
  const autres = ouvertes.filter((p) => !fixes.includes(p));
  const premier = choisir(rng, autres);
  return [...fixes, premier, choisir(rng, autres.filter((p) => p !== premier))];
}

/** Une recrue de la carrière `p` : une espèce que sa carrière admet (`tirerUneEspece`), son dieu tiré parmi ceux du
 *  profil, créée par le brouillon du noyau (`nouvelleRecrue`), portée par le noyau au niveau où la carrière s'engage
 *  (`porterAuNiveau`), dotée de ce que les niveaux atteints dotent (`dotationDesNiveaux`) et de ce que le roster lui
 *  remet en plus, ses armes en main. */
export function recrue(e: Etat, p: Profil): Heros {
  const rng = tirer(e);
  const espece = tirerUneEspece(rng, p.id, Object.keys(ESPECES));
  const identite = p.dieux ? { ...p.identite, talent: { ...p.identite.talent, spec: choisir(rng, p.dieux) } } : p.identite;
  const graine = e.graine++;
  const h: Heros = { c: porterAuNiveau(nouvelleRecrue(graine, p.id, espece, identite, estUtile), p.niveau, graine), carriere: p.id, espece, expeditions: 0, victoires: 0 };
  tenirLesObjets(e, h, dotationDesNiveaux(h.c, p.niveau, e.graine++));
  if (p.dotation) remettreLesObjets(e, h, p.dotation);
  prendreSesArmes(e, h);
  const morr = e.batiments.memorial;
  if (morr) h.c.xp = (h.c.xp ?? 0) + Math.min(morr * 100, e.cimetiere.length * 10 * morr);
  return h;
}

/** Les candidats du relais : chacun tiré à chance égale parmi les carrières ouvertes par le palier du relais dont le
 *  rôle manque encore au tirage, et parmi toutes les carrières ouvertes quand chaque rôle y est déjà. */
export function renouvelerLesCandidats(e: Etat): void {
  const ouvertes = PROFILS.filter((p) => p.relais <= e.batiments.relais);
  const rng = tirer(e);
  const tires: Profil[] = [];
  e.candidats = Array.from({ length: 2 + e.batiments.relais }, () => {
    const neuves = ouvertes.filter((x) => !tires.some((t) => t.role === x.role));
    const p = choisir(rng, neuves.length ? neuves : ouvertes);
    tires.push(p);
    return { ...recrue(e, p), prix: PRIX_DE_RECRUE[p.relais] + SUPPLEMENT_PAR_NIVEAU * (p.niveau - 1) };
  });
}

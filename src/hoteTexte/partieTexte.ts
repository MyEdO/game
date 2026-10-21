/**
 * LE CŒUR DE L'HÔTE TEXTE (#2898, plan v3 étape 4) : le fichier de partie, son rejeu et le geste suivant, sans
 * écran ni disque. Le fichier (JSONL) est la vérité de la partie : un en-tête (`Entete`), puis une ligne par geste
 * appliqué (`Geste`). Le rejeu ouvre une partie du noyau (`creerPartie`), lance le scénario de l'en-tête
 * (`Partie.lancer`), puis rejoue chaque ligne ; après chaque appel, l'hôte reprend tous les jetons programmés, par
 * échéance puis par ordre d'arrivée, jusqu'à ce qu'il n'en reste aucun. Un geste en erreur (validation, permission,
 * règle) n'est pas écrit. Une seule partie par contexte JS (`branchement.ts`) : un processus par appel.
 */
import {
  creerPartie, etatInitialDuJeu, actionGate, etatDeLaBarre, offresDeLActif, offreDesignee, ACTIONS,
  type ActionRunCtx, type Intention, type Jeton, type Jeu, type LigneDuJournal, type Offre, type Partie, type ResultatDeLAppel,
} from '../noyau/index';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';

const CADENCES = ['manuel', 'rapide', 'auto'] as const;

/** L'en-tête du fichier : le scénario lancé et les entrées de la partie (D8). */
export interface Entete {
  scenario: string;
  graine: number;
  regles: Record<string, unknown>;
  cadence: (typeof CADENCES)[number];
  desFixes: boolean;
}

/** Un geste du fichier : une offre du registre (`jouerLOffre`), ou un verbe brut de la partie. */
export type Geste =
  | { offre: string; ctx?: ActionRunCtx }
  | { type: string; args: unknown[]; siege?: number };

/** Les trois catégories d'erreur d'un geste (plan v3, « L'issue d'un geste »). */
export type CategorieDErreur = 'validation' | 'permission' | 'regle';

/** Une erreur structurée : sa catégorie et ce qui la dit. */
export class ErreurDeGeste extends Error {
  constructor(readonly categorie: CategorieDErreur, message: string) {
    super(message);
  }
}

const valider = (condition: unknown, message: string): void => {
  if (!condition) throw new ErreurDeGeste('validation', message);
};

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** L'en-tête d'une partie neuve, ou l'erreur de validation qui le refuse. */
export function nouvelEntete(scenario: string, options: { graine?: number; cadence?: string; desFixes?: boolean; regles?: Record<string, unknown> }): Entete {
  valider(testScenarios.some((s) => s.id === scenario), `scénario inconnu : ${scenario}`);
  const graine = options.graine ?? 1;
  valider(Number.isInteger(graine), `graine non entière : ${graine}`);
  const cadence = options.cadence ?? 'manuel';
  valider((CADENCES as readonly string[]).includes(cadence), `cadence inconnue : ${cadence} (${CADENCES.join(', ')})`);
  return { scenario, graine, regles: options.regles ?? {}, cadence: cadence as Entete['cadence'], desFixes: options.desFixes ?? false };
}

/** Lit un geste écrit (une ligne JSON), ou lève une erreur de validation. */
export function lireGeste(v: unknown): Geste {
  valider(estObjet(v), 'un geste est un objet JSON');
  const g = v as Record<string, unknown>;
  if ('offre' in g) {
    valider(typeof g.offre === 'string', 'offre : un id d’action');
    valider(g.ctx === undefined || estObjet(g.ctx), 'offre : le contexte est un objet JSON');
    return g.ctx === undefined ? { offre: g.offre as string } : { offre: g.offre as string, ctx: g.ctx as ActionRunCtx };
  }
  valider(typeof g.type === 'string', 'jouer : un nom d’action du noyau');
  valider(Array.isArray(g.args), 'jouer : les arguments sont un tableau JSON');
  valider(g.siege === undefined || Number.isInteger(g.siege), 'jouer : le siège est un entier');
  return g.siege === undefined ? { type: g.type as string, args: g.args as unknown[] } : { type: g.type as string, args: g.args as unknown[], siege: g.siege as number };
}

/** Le texte d'un fichier : l'en-tête, puis les gestes. */
export function lireLeFichier(texte: string): { entete: Entete; gestes: Geste[] } {
  const lignes = texte.split('\n').filter((l) => l.trim() !== '');
  valider(lignes.length > 0, 'fichier de partie vide : `nouvelle <scenario>` d’abord');
  const json = lignes.map((l, i) => {
    try {
      return JSON.parse(l) as unknown;
    } catch {
      throw new ErreurDeGeste('validation', `ligne ${i + 1} du fichier : JSON illisible`);
    }
  });
  const [tete, ...reste] = json;
  valider(estObjet(tete), 'en-tête : objet JSON attendu');
  const e = tete as Record<string, unknown>;
  const entete = nouvelEntete(String(e.scenario), { graine: e.graine as number, cadence: e.cadence as string, desFixes: e.desFixes === true, regles: estObjet(e.regles) ? e.regles : {} });
  return { entete, gestes: reste.map(lireGeste) };
}

/** La ligne écrite d'un en-tête ou d'un geste. */
export const ligneDuFichier = (v: Entete | Geste): string => `${JSON.stringify(v)}\n`;

/** Une ligne du journal de la partie, numérotée depuis le lancement, avec le pas qui l'a écrite (0 : le lancement)
 *  et l'acteur courant au moment de l'écriture. */
export interface LigneNumerotee {
  n: number;
  pas: number;
  ligne: LigneDuJournal;
  /** Écrite pendant une reprise de jeton (tour de l'IA, beat différé), et non par le geste lui-même. */
  differee: boolean;
}

/** Une partie rejouée : la partie ouverte, son en-tête, ses gestes, son journal entier, et le nombre de jetons repris
 *  après chaque pas (0 : le lancement). */
export interface PartieRejouee {
  partie: Partie;
  entete: Entete;
  gestes: Geste[];
  journal: LigneNumerotee[];
  reprises: number[];
}

/** Le plafond de reprises après un appel : au-delà, la partie boucle. */
const PLAFOND_DE_REPRISES = 100_000;

/** Absorbe le résultat d'un appel : ses lignes au journal, puis la reprise de tous ses jetons, par échéance puis par
 *  ordre d'arrivée, sur une horloge virtuelle propre à l'appel. */
function absorber(r: PartieRejouee, resultat: ResultatDeLAppel, pas: number): void {
  const file: { jeton: Jeton; echeance: number; rang: number }[] = [];
  let horloge = 0;
  let rang = 0;
  const lire = (res: ResultatDeLAppel, differee: boolean): void => {
    for (const ligne of res.journal) r.journal.push({ n: r.journal.length, pas, ligne, differee });
    for (const e of res.evenements) if (e.type === 'programme') file.push({ jeton: e.jeton, echeance: horloge + e.delai, rang: rang++ });
  };
  lire(resultat, false);
  let reprises = 0;
  for (; file.length; reprises++) {
    if (reprises >= PLAFOND_DE_REPRISES) throw new Error(`[hôte texte] plus de ${PLAFOND_DE_REPRISES} reprises après le pas ${pas} : la partie boucle`);
    file.sort((a, b) => a.echeance - b.echeance || a.rang - b.rang);
    const { jeton, echeance } = file.shift()!;
    horloge = echeance;
    lire(r.partie.reprendre(jeton), true);
  }
  r.reprises[pas] = reprises;
}

/** Les offres de l'actif (`offresDeLActif`), ou l'erreur de règle qui dit pourquoi la barre n'est pas ouverte
 *  (`etatDeLaBarre`, le verdict que lit aussi la console). */
export function offresDeLaBarre(etat: Jeu): Offre[] {
  const barre = etatDeLaBarre(etat);
  if (barre.forme !== 'ouverte') throw new ErreurDeGeste('regle', `aucune offre : ${barre.raison} (\`vue\`)`);
  return offresDeLActif({ active: barre.active, battle: barre.battle, netMode: etat.net.mode, state: etat });
}

/** L'intention d'un geste, contrôlée. Une offre que l'énumérateur ne rend pas, ou qu'aucun candidat ne désigne
 *  (`offreDesignee`), est une erreur de règle avec la raison du registre ; une offre fermée aussi (`actionGate`, sur les
 *  arguments du geste) ; un verbe inconnu est une erreur de validation. */
function intentionDuGeste(etat: Jeu, geste: Geste): Intention {
  if ('offre' in geste) {
    valider(ACTIONS.some((a) => a.id === geste.offre), `offre inconnue : ${geste.offre} (\`offres --toutes\`)`);
    const offres = offresDeLaBarre(etat);
    const barre = etatDeLaBarre(etat);
    const ctx = barre.forme === 'ouverte' ? { active: barre.active, battle: barre.battle, netMode: etat.net.mode, args: geste.ctx } : undefined;
    if (!offreDesignee(offres, geste.offre, geste.ctx)) {
      const pertinence = ctx ? actionGate(geste.offre, ctx) : undefined;
      const raison = pertinence && !pertinence.ok ? pertinence.reason : offres.some((o) => o.actionId === geste.offre) ? 'aucun candidat ne correspond au contexte' : 'aucun candidat';
      throw new ErreurDeGeste('regle', `${geste.offre} n’est pas offerte : ${raison} (\`offres ${geste.offre}\`)`);
    }
    const gate = actionGate(geste.offre, ctx!);
    if (!gate.ok) throw new ErreurDeGeste('regle', `${geste.offre} fermée : ${gate.reason ?? 'sans raison'}`);
    return { type: 'jouerLOffre', args: geste.ctx ? [geste.offre, geste.ctx] : [geste.offre] };
  }
  valider(typeof (etat as unknown as Record<string, unknown>)[geste.type] === 'function', `verbe inconnu : ${geste.type}`);
  return { type: geste.type, args: geste.args, ...(geste.siege === undefined ? {} : { siege: geste.siege }) } as Intention;
}

/** Joue un geste sur la partie rejouée : l'intention contrôlée, envoyée, ses jetons repris. L'issue de la partie fait
 *  foi : `hors-allowlist` est une erreur de validation, `refusee` une erreur de permission ; un verbe qui lève est une
 *  erreur de validation. Rend les lignes de journal du geste. */
export function jouerUnGeste(r: PartieRejouee, geste: Geste): LigneNumerotee[] {
  const intention = intentionDuGeste(r.partie.etat(), geste);
  let resultat: ResultatDeLAppel;
  try {
    resultat = r.partie.envoyer(intention);
  } catch (erreur) {
    throw new ErreurDeGeste('validation', `${intention.type} a levé : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  }
  if (resultat.issue === 'hors-allowlist') throw new ErreurDeGeste('validation', `${intention.type} hors de l’allowlist d’un siège`);
  if (resultat.issue === 'refusee') throw new ErreurDeGeste('permission', `${intention.type} refusée au siège ${'siege' in geste ? String(geste.siege) : '—'}`);
  const debut = r.journal.length;
  r.gestes.push(geste);
  absorber(r, resultat, r.gestes.length);
  return r.journal.slice(debut);
}

/** Rejoue un fichier : la partie ouverte sur l'en-tête, le scénario lancé, chaque geste rejoué. Une ligne qui ne se
 *  rejoue plus ferme la partie et lève, avec son rang (1 : l'en-tête, le lancement). */
export function rejouer(entete: Entete, gestes: readonly Geste[]): PartieRejouee {
  const scenario = testScenarios.find((s) => s.id === entete.scenario);
  valider(scenario, `scénario inconnu : ${entete.scenario}`);
  const heros = new Map<string, unknown>();
  const partie = creerPartie(etatInitialDuJeu(), {
    graine: entete.graine,
    reglesMaison: entete.regles,
    cadence: entete.cadence,
    desFixes: entete.desFixes,
    persisterLeHeros: (h) => heros.set(h.id, structuredClone(h)),
  });
  const r: PartieRejouee = { partie, entete, gestes: [], journal: [], reprises: [] };
  let ligne = 1;
  try {
    absorber(r, partie.lancer(lancementDuScenario(scenario!)), 0);
    for (const geste of gestes) {
      ligne++;
      jouerUnGeste(r, geste);
    }
    return r;
  } catch (erreur) {
    partie.fermer();
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    throw new ErreurDeGeste('validation', `ligne ${ligne} du fichier ne se rejoue plus : ${message}`);
  }
}

/** L'empreinte de l'état : FNV-1a 32 bits de ses données (fonctions et `Map` exclues), pour comparer deux rejeux. */
export function empreinte(etat: Jeu): string {
  const texte = JSON.stringify(etat, (_cle, v: unknown) => (typeof v === 'function' || v instanceof Map ? undefined : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

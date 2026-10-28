/**
 * LE GESTE D'UN HÔTE DU NOYAU (#2928), commun à l'hôte texte
 * (`src/hoteTexte/`) et aux hôtes externes (`hotes/`) : un geste écrit en JSON (une offre du registre, ou un verbe de la
 * partie), sa lecture, le contrôle de son verbe et de ses arguments contre ses paramètres (`formes.ts`,
 * `verbes.generated.ts`), son intention contrôlée, et l'issue de son envoi traduite en catégorie d'erreur. Chaque
 * refus nomme ce que l'état offre ; l'hôte y joint ses pistes de lecture (`PistesDeLecture`), là où son auteur lit la suite.
 */
import {
  ACTIONS, DESIGNATIONS, actionGate, argsAvecVerdictLocal, etatDeLaBarre, fenetreDuJeu, offreDesignee, porteurParId,
  quiTientLaMain, runAction, siegeDe,
  type ActionRunCtx, type Intention, type Jeu, type Offre, type Partie, type ResultatDeLAppel,
} from '../noyau/index';
import { estObjet, lireALaForme, signature, type Designes, type ParametreDeVerbe } from './formes';
import { ErreurDeGeste, valider } from './partie';
import { offresDeLaBarreOuverte } from './projection';
import { VERBES } from './verbes.generated';

/** Un geste écrit : une offre du registre (`jouerLOffre`), ou un verbe brut de la partie, joué au nom d'un siège s'il
 *  est posé. */
export type Geste =
  | { offre: string; ctx?: ActionRunCtx }
  | { type: string; args: unknown[]; siege?: number };

/** Les pistes de lecture d'un hôte, jointes au refus d'un geste : où lire la vue, toutes les offres, les offres d'un id, la
 *  signature d'un verbe. Chacune est le texte qui suit le message, vide pour un hôte qui n'en a pas (`SANS_PISTE`). */
export interface PistesDeLecture {
  vue: string;
  offres: string;
  offre: (id: string) => string;
  verbe: (id: string) => string;
}

/** Les pistes d'un hôte qui n'en joint aucune. */
export const SANS_PISTE: PistesDeLecture = { vue: '', offres: '', offre: () => '', verbe: () => '' };

/** Lit un geste écrit (un objet JSON), ou lève une erreur de validation. */
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

/** Ce que l'état désigne, lu par la table du noyau (`DESIGNATIONS`). */
const designesDe = (etat: Jeu): Designes => (cle) =>
  cle in DESIGNATIONS ? DESIGNATIONS[cle as keyof typeof DESIGNATIONS].lire(etat) : undefined;

/** Les arguments d'un verbe, lus à leurs paramètres (`lireALaForme`) : un id que l'état ne désigne pas lève une erreur
 *  de validation qui nomme les ids valides, un objet désigné par son id est complété, `null` omet un paramètre
 *  optionnel, un argument de forme fausse, en trop ou manquant lève une erreur de validation. */
export function argumentsDuVerbe(etat: Jeu, verbe: string, args: readonly unknown[], parametres: readonly ParametreDeVerbe[]): unknown[] {
  valider(args.length <= parametres.length, `${verbe} : ${parametres.length} argument(s) au plus (${signature(verbe, parametres)})`);
  for (const p of parametres.slice(args.length)) valider(p.optionnel, `${verbe} : l’argument ${p.nom} manque (${signature(verbe, parametres)})`);
  return args.map((brut, i) => {
    const p = parametres[i];
    // JSON n'a pas d'`undefined` : `null` omet un paramètre optionnel, pour en poser un suivant.
    if (brut === null && p.optionnel) return brut;
    const lu = lireALaForme(brut, p.forme, p.nom, designesDe(etat));
    if ('ecart' in lu) throw new ErreurDeGeste('validation', `${verbe} : ${lu.ecart} (${signature(verbe, parametres)})`);
    return lu.valeur;
  });
}

/** Les verbes voisins d'un nom inconnu nommés dans le refus, au plus. */
const VOISINS_AU_PLUS = 8;

/** Le geste d'un verbe, ses arguments contrôlés contre le type du verbe (`VERBES`, `argumentsDuVerbe`) ; les arguments
 *  absents sont un tableau vide. Un verbe inconnu se refuse avec ceux de la fenêtre qui tient la main et ses voisins de
 *  nom. */
export function gesteDuVerbe(etat: Jeu, v: { type: unknown; args?: unknown; siege?: unknown }, pistes: PistesDeLecture): Geste {
  valider(typeof v.type === 'string', 'jouer : un nom d’action du noyau');
  const verbe = v.type as string;
  const parametres = Object.prototype.hasOwnProperty.call(VERBES, verbe) ? VERBES[verbe] : null;
  if (!parametres) {
    const m = verbe.toLowerCase();
    const voisins = Object.keys(VERBES).filter((x) => x.toLowerCase().includes(m) || m.includes(x.toLowerCase())).slice(0, VOISINS_AU_PLUS);
    const fenetre = fenetreDuJeu(etat);
    const dits = [
      ...(fenetre?.verbes.length ? [`verbes de la fenêtre ${fenetre.cle} : ${fenetre.verbes.join(', ')}`] : []),
      ...(voisins.length ? [`voisins : ${voisins.join(', ')}`] : []),
    ];
    throw new ErreurDeGeste('validation', `verbe inconnu : ${verbe}${dits.length ? ` ; ${dits.join(' ; ')}` : ''}${pistes.verbe(verbe)}`);
  }
  const geste = lireGeste({ type: verbe, args: v.args ?? [], siege: v.siege });
  return 'offre' in geste ? geste : { ...geste, args: argumentsDuVerbe(etat, geste.type, geste.args, parametres) };
}

/** Les offres de l'actif (`offresDeLActif`), ou l'erreur de règle qui dit pourquoi la barre n'est pas ouverte
 *  (`etatDeLaBarre`, le verdict que lit aussi la console). */
export function offresDeLaBarre(etat: Jeu, pistes: PistesDeLecture): Offre[] {
  const barre = etatDeLaBarre(etat);
  if (barre.forme !== 'ouverte') throw new ErreurDeGeste('regle', `aucune offre : ${barre.raison}${pistes.vue}`);
  return offresDeLaBarreOuverte(etat, barre);
}

/** La sonde : elle répond à toute lecture et à tout appel par elle-même, et se convertit en `0`. */
const SONDE: unknown = new Proxy(function sonde() {}, {
  get: (_cible, cle) => (cle === Symbol.toPrimitive ? () => 0 : SONDE),
  apply: () => SONDE,
});

/** Les champs du contexte qu'une offre lit : ceux que sa porte (`runAction`) lit en se jouant sur la sonde, une fois
 *  chaque champ présent, une fois chaque champ absent ; la sonde ne joue rien. Une porte que la sonde fait lever ne
 *  dit pas ce qu'elle lit : `null`, et son contexte ne se contrôle pas. */
function champsLusParLOffre(actionId: string): Set<string> | null {
  const lus = new Set<string>();
  try {
    for (const valeur of [SONDE, undefined]) {
      const ctx = new Proxy({}, {
        get: (_cible, cle) => {
          if (typeof cle === 'string') lus.add(cle);
          return valeur;
        },
      });
      runAction(actionId, () => SONDE as Jeu, ctx as ActionRunCtx);
    }
  } catch {
    return null;
  }
  return lus;
}

/** Un champ du contexte d'une offre que ni elle ni ses candidats ne lisent lève une erreur de validation, qui nomme les
 *  champs acceptés ; pour une offre qui arme une intention, la cible se choisit après elle. */
function controlerLeContexte(offre: string, ctx: ActionRunCtx | undefined, offres: readonly Offre[], pistes: PistesDeLecture): void {
  const lus = champsLusParLOffre(offre);
  if (!lus) return;
  const acceptes = new Set([...lus, ...offres.flatMap((o) => (o.actionId === offre ? Object.keys(o.args) : []))]);
  const ignores = Object.keys(ctx ?? {}).filter((k) => !acceptes.has(k));
  if (!ignores.length) return;
  const cible = ACTIONS.find((a) => a.id === offre)?.intent ? ' ; la cible de cette offre se choisit après elle, par le clic de son combattant' : '';
  throw new ErreurDeGeste('validation', `${offre} ne lit pas ${ignores.join(', ')} du contexte (champs acceptés : ${[...acceptes].join(', ') || 'aucun'})${cible}${pistes.offre(offre)}`);
}

/** L'intention d'un geste, contrôlée. Une offre que l'énumérateur ne rend pas, ou qu'aucun candidat ne désigne
 *  (`offreDesignee`), est une erreur de règle avec la raison du registre ; une offre fermée aussi (`actionGate`, sur les
 *  arguments du geste) ; un champ du contexte que l'offre ne lit pas (`controlerLeContexte`) et un verbe inconnu sont
 *  des erreurs de validation. Un verbe joué au nom d'un siège joint le verdict d'armement que ce siège voit
 *  (`argsAvecVerdictLocal`), comme le client du web le joint à son intention. */
export function intentionDuGeste(etat: Jeu, geste: Geste, pistes: PistesDeLecture): Intention {
  if ('offre' in geste) {
    valider(ACTIONS.some((a) => a.id === geste.offre), `offre inconnue : ${geste.offre}${pistes.offres}`);
    const offres = offresDeLaBarre(etat, pistes);
    controlerLeContexte(geste.offre, geste.ctx, offres, pistes);
    const barre = etatDeLaBarre(etat);
    const ctx = barre.forme === 'ouverte' ? { active: barre.active, battle: barre.battle, netMode: etat.net.mode, gameTime: etat.gameTime, args: geste.ctx } : undefined;
    if (!offreDesignee(offres, geste.offre, geste.ctx)) {
      const pertinence = ctx ? actionGate(geste.offre, ctx) : undefined;
      const raison = pertinence && !pertinence.ok ? pertinence.reason : offres.some((o) => o.actionId === geste.offre) ? 'aucun candidat ne correspond au contexte' : 'aucun candidat';
      throw new ErreurDeGeste('regle', `${geste.offre} n’est pas offerte : ${raison}${pistes.offre(geste.offre)}`);
    }
    const gate = actionGate(geste.offre, ctx!);
    if (!gate.ok) throw new ErreurDeGeste('regle', `${geste.offre} fermée : ${gate.reason ?? 'sans raison'}`);
    return { type: 'jouerLOffre', args: geste.ctx ? [geste.offre, geste.ctx] : [geste.offre] };
  }
  valider(typeof (etat as unknown as Record<string, unknown>)[geste.type] === 'function', `verbe inconnu : ${geste.type}`);
  if (geste.siege === undefined) return { type: geste.type, args: geste.args } as Intention;
  return { type: geste.type, args: argsAvecVerdictLocal(() => etat, geste.type, geste.args), siege: geste.siege } as Intention;
}

/** Qui tient la main (`quiTientLaMain`) et le siège qui le joue (`siegeDe`) : ce qui rendrait le geste permis. */
function laMain(etat: Jeu): string {
  const main = quiTientLaMain(etat);
  if (main === '*') return 'la fenêtre est à tous les sièges';
  const nom = main && porteurParId(etat, main)?.label;
  return `la main est à ${nom ?? main ?? 'l’hôte'}, siège ${siegeDe(etat, main)}`;
}

/** Envoie l'intention à la partie. L'issue de la partie fait foi : `hors-allowlist` est une erreur de validation,
 *  `refusee` une erreur de permission ; un verbe qui lève est une erreur de validation. */
export function envoyerLIntention(partie: Partie, intention: Intention): ResultatDeLAppel {
  const avant = partie.etat();
  let resultat: ResultatDeLAppel;
  try {
    resultat = partie.envoyer(intention);
  } catch (erreur) {
    throw new ErreurDeGeste('validation', `${intention.type} a levé : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  }
  if (resultat.issue === 'hors-allowlist') throw new ErreurDeGeste('validation', `${intention.type} hors de l’allowlist d’un siège`);
  if (resultat.issue === 'refusee') throw new ErreurDeGeste('permission', `${intention.type} refusée au siège ${intention.siege === undefined ? '—' : String(intention.siege)} : ${laMain(avant)}`);
  return resultat;
}

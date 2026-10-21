/**
 * L'ENTRÉE DE L'HÔTE TEXTE (#2898) : une commande par appel, une partie par processus. Le lanceur
 * (`scripts/hote-texte.mjs`) la charge par le module runner de Vite et lui passe le disque (`Disque`) ; elle rend le
 * texte à écrire et le code de sortie. Doc généré : `npm run docs:hote-texte` (`COMMANDES`).
 */
import { ErreurDeGeste, empreinte, jouerUnGeste, ligneDuFichier, lireGeste, lireLeFichier, nouvelEntete, offresDeLaBarre, rejouer, type Geste, type PartieRejouee } from './partieTexte';
import { BORNES, borner, offresListees, pageDeLaCarte, projeter, rendreLaCarte, rendreLaFiche, rendreLaReponse, rendreLaVue, rendreLeJournal, rendreLesOffres } from './vue';

/** Le disque que le lanceur prête : lire un fichier (`null` s'il n'existe pas), l'écrire, y ajouter. */
export interface Disque {
  lire: (chemin: string) => string | null;
  ecrire: (chemin: string, texte: string) => void;
  ajouter: (chemin: string, texte: string) => void;
}

/** Ce qu'un appel rend : le texte de sortie et le code de sortie (0 : succès, 1 : erreur structurée). */
export interface Sortie {
  texte: string;
  code: 0 | 1;
}

const OPTIONS_A_VALEUR = new Set(['--partie', '--graine', '--siege', '--depuis', '--cadence']);
const DRAPEAUX = new Set(['--json', '--des-fixes', '--toutes']);

/** Les commandes, leur forme et ce qu'elles rendent (doc généré). */
export const COMMANDES: readonly (readonly [forme: string, rendu: string])[] = [
  ['nouvelle <scenario> [--graine N] [--cadence manuel|rapide|auto] [--des-fixes]', 'écrit l’en-tête d’une partie neuve, rend la vue'],
  ['offre <actionId> [ctx JSON]', 'joue une offre de l’énumérateur (jouerLOffre), l’écrit au fichier, rend la réponse'],
  ['jouer <type> [args JSON] [--siege n]', 'envoie un verbe de la partie, l’écrit au fichier, rend la réponse'],
  ['vue', 'la projection : actif, fenêtre, voisins, offres ouvertes, cibles'],
  ['offres [<actionId>] [--toutes] [--depuis k]', 'les offres ouvertes, ou toutes avec la raison des fermées ; pour un id, ses candidats et leur ctx'],
  ['carte [--depuis k]', 'les combattants, l’actif d’abord, par page'],
  ['fiche <id>', 'la fiche d’un combattant, armure en PA par localisation'],
  ['journal [--depuis k]', 'le journal de la partie, par page'],
];

const USAGE = ['usage : npm run hote-texte -- --partie <fichier.jsonl> <commande> [--json]', ...COMMANDES.map(([forme]) => `  ${forme}`), 'doc : npm run docs:hote-texte'].join('\n');

/** Les arguments : la commande et ses positionnels, les options à valeur, les drapeaux. */
function analyser(argv: readonly string[]): { positionnels: string[]; options: Map<string, string>; drapeaux: Set<string> } {
  const positionnels: string[] = [];
  const options = new Map<string, string>();
  const drapeaux = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (OPTIONS_A_VALEUR.has(a)) {
      if (i + 1 >= argv.length) throw new ErreurDeGeste('validation', `${a} attend une valeur`);
      options.set(a, argv[++i]);
    } else if (DRAPEAUX.has(a)) drapeaux.add(a);
    else if (a.startsWith('--')) throw new ErreurDeGeste('validation', `option inconnue : ${a}`);
    else positionnels.push(a);
  }
  return { positionnels, options, drapeaux };
}

const entier = (v: string | undefined, nom: string): number | undefined => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new ErreurDeGeste('validation', `${nom} : un entier attendu, pas ${v}`);
  return n;
};

const json = (v: string | undefined, nom: string): unknown => {
  if (v === undefined) return undefined;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    throw new ErreurDeGeste('validation', `${nom} : JSON illisible`);
  }
};

/** La partie du fichier `chemin`, rejouée. */
function ouvrir(disque: Disque, chemin: string): PartieRejouee {
  const texte = disque.lire(chemin);
  if (texte === null) throw new ErreurDeGeste('validation', `aucune partie à ${chemin} : \`nouvelle <scenario>\` d’abord`);
  const { entete, gestes } = lireLeFichier(texte);
  return rejouer(entete, gestes);
}

/** Le geste d'une commande `offre` ou `jouer`. */
function gesteDe(commande: string, positionnels: readonly string[], options: Map<string, string>): Geste {
  const [nom, brut] = positionnels;
  if (!nom) throw new ErreurDeGeste('validation', `${commande} : un nom attendu`);
  if (commande === 'offre') return lireGeste({ offre: nom, ...(brut === undefined ? {} : { ctx: json(brut, 'ctx') }) });
  const siege = entier(options.get('--siege'), '--siege');
  return lireGeste({ type: nom, args: brut === undefined ? [] : json(brut, 'args'), ...(siege === undefined ? {} : { siege }) });
}

function executerSansErreur(argv: readonly string[], disque: Disque): { lignes: string[]; json: unknown } {
  const { positionnels, options, drapeaux } = analyser(argv);
  const [commande, ...reste] = positionnels;
  if (!commande) return { lignes: [USAGE], json: { usage: USAGE } };
  const chemin = options.get('--partie');
  if (!chemin) throw new ErreurDeGeste('validation', `--partie <fichier.jsonl> attendu\n${USAGE}`);

  if (commande === 'nouvelle') {
    const [scenario] = reste;
    if (!scenario) throw new ErreurDeGeste('validation', 'nouvelle : un id de scénario attendu');
    const entete = nouvelEntete(scenario, { graine: entier(options.get('--graine'), '--graine'), cadence: options.get('--cadence'), desFixes: drapeaux.has('--des-fixes') });
    return avecLaPartie(rejouer(entete, []), (r) => {
      disque.ecrire(chemin, ligneDuFichier(entete));
      const p = projeter(r.partie.etat(), 0, r.journal.length);
      return { lignes: borner([`partie neuve : ${scenario}, graine ${entete.graine}, cadence ${entete.cadence}`, ...rendreLaVue(p)], 'nouvelle'), json: { projection: p, empreinte: empreinte(r.partie.etat()) } };
    });
  }
  return avecLaPartie(ouvrir(disque, chemin), (r) => commandeSurLaPartie(r, commande, reste, options, drapeaux, disque, chemin));
}

/** Rend `faire(r)`, puis ferme la partie : le contexte JS reste libre pour la suivante. */
function avecLaPartie<T>(r: PartieRejouee, faire: (r: PartieRejouee) => T): T {
  try {
    return faire(r);
  } finally {
    r.partie.fermer();
  }
}

/** Une commande sur la partie rejouée. */
function commandeSurLaPartie(r: PartieRejouee, commande: string, reste: readonly string[], options: Map<string, string>, drapeaux: Set<string>, disque: Disque, chemin: string): { lignes: string[]; json: unknown } {
  const etat = () => r.partie.etat();
  const depuis = entier(options.get('--depuis'), '--depuis');
  const projection = () => projeter(etat(), r.gestes.length, r.journal.length);
  switch (commande) {
    case 'offre':
    case 'jouer': {
      const geste = gesteDe(commande, reste, options);
      const avant = projection();
      const lignes = jouerUnGeste(r, geste);
      disque.ajouter(chemin, ligneDuFichier(geste));
      const apres = projection();
      const nom = 'offre' in geste ? `offre ${geste.offre}` : `jouer ${geste.type}`;
      const reprises = r.reprises[r.gestes.length];
      const journal = lignes.map((l) => l.n);
      return {
        lignes: rendreLaReponse(nom, avant, apres, lignes, reprises),
        json: { issue: 'appliquee', reprises, projection: apres, empreinte: empreinte(r.partie.etat()), journal: { n: journal.slice(0, BORNES.journalEnReponse), enPlus: Math.max(0, journal.length - BORNES.journalEnReponse) } },
      };
    }
    case 'vue': {
      const p = projection();
      return { lignes: rendreLaVue(p), json: { projection: p, empreinte: empreinte(etat()) } };
    }
    case 'fiche': {
      const [id] = reste;
      const fiche = id ? rendreLaFiche(etat(), id) : null;
      if (!fiche) throw new ErreurDeGeste('validation', `fiche : aucun combattant ${id ?? '(id attendu)'}`);
      return { lignes: fiche, json: { fiche } };
    }
    case 'carte': {
      const p = projection();
      const { combattants, suite } = pageDeLaCarte(etat(), depuis);
      return { lignes: rendreLaCarte(etat(), p, depuis), json: { combattants, suite, exploration: p.exploration } };
    }
    case 'journal': {
      const lignes = rendreLeJournal(r.journal, depuis);
      return { lignes, json: { journal: lignes } };
    }
    case 'offres': {
      const offres = offresDeLaBarre(etat());
      const choix = { id: reste[0], toutes: drapeaux.has('--toutes'), depuis };
      const debut = Math.max(0, depuis ?? 0);
      const listees = offresListees(offres, choix);
      return {
        lignes: rendreLesOffres(etat(), offres, choix),
        json: { offres: listees.slice(debut, debut + BORNES.page).map((o) => ({ id: o.actionId, candidat: o.candidat, cout: o.cost, ctx: o.args, gate: o.gate })), enPlus: Math.max(0, listees.length - debut - BORNES.page) },
      };
    }
    default:
      throw new ErreurDeGeste('validation', `commande inconnue : ${commande}\n${USAGE}`);
  }
}

/** Exécute une commande. Une erreur structurée sort en `erreur <catégorie> : <message>`, code 1, et rien n'est écrit. */
export function executer(argv: readonly string[], disque: Disque): Sortie {
  const enJson = argv.includes('--json');
  try {
    const { lignes, json: donnees } = executerSansErreur(argv, disque);
    return { texte: `${enJson ? JSON.stringify(donnees) : lignes.join('\n')}\n`, code: 0 };
  } catch (erreur) {
    if (!(erreur instanceof ErreurDeGeste)) throw erreur;
    const texte = enJson ? JSON.stringify({ erreur: { categorie: erreur.categorie, message: erreur.message } }) : `erreur ${erreur.categorie} : ${erreur.message}`;
    return { texte: `${texte}\n`, code: 1 };
  }
}

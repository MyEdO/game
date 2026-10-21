/**
 * L'ENTRÉE DE L'HÔTE TEXTE (#2898) : une commande par appel, une partie par processus. Le lanceur
 * (`scripts/hote-texte.mjs`) la charge par le module runner de Vite et lui passe le disque (`Disque`) ; elle rend le
 * texte à écrire et le code de sortie. Doc généré : `npm run docs:hote-texte` (`COMMANDES`).
 */
import { argumentsDuVerbe, ErreurDeGeste, empreinte, jouerUnGeste, ligneDuFichier, lireGeste, lireLeFichier, nouvelEntete, offresDeLaBarre, rejouer, type Geste, type PartieRejouee } from './partieTexte';
import { VERBES } from './verbes.generated';
import { BORNES, borner, casesAtteignables, replier, offresListees, pageDeLaCarte, projeter, rendreLaCarte, rendreLaFiche, rendreLaReponse, rendreLaVue, rendreLeJournal, rendreLesCases, rendreLesOffres, rendreLesScenarios } from './vue';
import { etatDeLaBarre } from '../noyau/index';
import { testScenarios } from '../scenes/test-scenarios';

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

const OPTIONS_A_VALEUR = new Set(['--partie', '--graine', '--siege', '--depuis', '--ligne', '--cadence']);
const DRAPEAUX = new Set(['--json', '--des-fixes', '--toutes']);

/** Les commandes, leur forme et ce qu'elles rendent (doc généré). */
export const COMMANDES: readonly (readonly [forme: string, rendu: string])[] = [
  ['scenarios [--depuis k]', 'les ids de scénario que `nouvelle` accepte, et leur titre, par page (sans `--partie`)'],
  ['nouvelle <scenario> [--graine N] [--cadence manuel|rapide|auto] [--des-fixes]', 'écrit l’en-tête d’une partie neuve, rend la vue'],
  ['offre <actionId> [ctx JSON]', 'joue une offre de l’énumérateur (jouerLOffre), l’écrit au fichier, rend la réponse'],
  ['jouer <type> [args JSON] [--siege n]', 'envoie un verbe de la partie (arguments contrôlés contre son type), l’écrit au fichier s’il change la partie, rend la réponse'],
  ['vue', 'la projection : actif, fenêtre, voisins, offres ouvertes, cibles'],
  ['offres [<actionId>] [--toutes] [--depuis k]', 'les offres ouvertes, ou toutes avec la raison des fermées ; pour un id, ses candidats et leur ctx'],
  ['carte [--depuis k]', 'en combat, les combattants, l’actif d’abord ; en exploration, les entités de la scène ; par page'],
  ['cases [--depuis k]', 'les cases que le champ peint au tour de l’actif (marche, course armée, intention armée), avec leur coût, par page'],
  ['fiche <id>', 'la fiche d’un combattant, armure en PA par localisation'],
  ['journal [--depuis k] [--ligne m]', 'le journal de la partie, par page ; une entrée plus haute que la page, par ses lignes'],
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
  if (commande === 'scenarios') {
    const depuis = entier(options.get('--depuis'), '--depuis') ?? 0;
    return { lignes: rendreLesScenarios(testScenarios, depuis), json: { scenarios: testScenarios.slice(depuis, depuis + BORNES.page).map((sc) => sc.id), enPlus: Math.max(0, testScenarios.length - depuis - BORNES.page) } };
  }
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
  return avecLaPartie(ouvrir(disque, chemin), (r) => commandeSurLaPartie(r, { commande, reste, options, drapeaux }, disque, chemin));
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
interface CommandeAnalysee {
  commande: string;
  reste: readonly string[];
  options: Map<string, string>;
  drapeaux: Set<string>;
}

/** Le geste d'une commande, ses arguments contrôlés contre le type du verbe (`argumentsDuVerbe`, `VERBES`). */
function gesteControle(r: PartieRejouee, commande: string, reste: readonly string[], options: Map<string, string>): Geste {
  const geste = gesteDe(commande, reste, options);
  if ('offre' in geste) return geste;
  const parametres = Object.prototype.hasOwnProperty.call(VERBES, geste.type) ? VERBES[geste.type] : null;
  if (!parametres) throw new ErreurDeGeste('validation', `verbe inconnu : ${geste.type}`);
  return { ...geste, args: argumentsDuVerbe(r.partie.etat(), geste.type, geste.args, parametres) };
}

function commandeSurLaPartie(r: PartieRejouee, { commande, reste, options, drapeaux }: CommandeAnalysee, disque: Disque, chemin: string): { lignes: string[]; json: unknown } {
  const etat = () => r.partie.etat();
  const depuis = entier(options.get('--depuis'), '--depuis');
  const projection = () => projeter(etat(), r.gestes.length, r.journal.length);
  switch (commande) {
    case 'offre':
    case 'jouer': {
      const geste = gesteControle(r, commande, reste, options);
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
    case 'cases': {
      const cases = casesAtteignables(etat(), etatDeLaBarre(etat()).forme === 'ouverte');
      const debut = Math.max(0, depuis ?? 0);
      return { lignes: rendreLesCases(cases, depuis), json: { cases: cases.slice(debut, debut + BORNES.cases), enPlus: Math.max(0, cases.length - debut - BORNES.cases) } };
    }
    case 'journal': {
      const lignes = rendreLeJournal(r.journal, depuis, entier(options.get('--ligne'), '--ligne') ?? 0);
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

/** Exécute une commande. Une erreur structurée sort en `erreur <catégorie> : <message>`, bornée comme toute sortie, code 1, et
 *  rien n'est écrit. */
export function executer(argv: readonly string[], disque: Disque): Sortie {
  const enJson = argv.includes('--json');
  try {
    const { lignes, json: donnees } = executerSansErreur(argv, disque);
    return { texte: `${enJson ? JSON.stringify(donnees) : lignes.join('\n')}\n`, code: 0 };
  } catch (erreur) {
    if (!(erreur instanceof ErreurDeGeste)) throw erreur;
    const texte = enJson ? JSON.stringify({ erreur: { categorie: erreur.categorie, message: erreur.message } }) : borner(replier(`erreur ${erreur.categorie} : ${erreur.message}`), 'erreur').join('\n');
    return { texte: `${texte}\n`, code: 1 };
  }
}

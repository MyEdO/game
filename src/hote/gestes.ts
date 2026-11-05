/**
 * LES GESTES DE LA FENÊTRE QUI TIENT LA MAIN (#2928), communs aux hôtes qui la dessinent : son titre, son étape, et
 * chacun de ses gestes (`fenetreDuJeu`) avec son libellé (`libelleDuGeste`) et chacun
 * de ses arguments (`VERBES`) prêt à saisir. Le flux d'un geste de jet et l'id que la fenêtre désigne (`pid`) sont posés
 * d'office (`argumentsPosesDuGeste`) ; un autre argument est saisi d'après le réglage que le
 * noyau nomme pour son verbe et ce paramètre, ou pour le premier argument libre (`reglages.ts` : la valeur courante, les
 * valeurs ouvertes, les bornes), sinon d'après sa
 * forme (`formes.ts`) : un choix parmi les valeurs qu'elle énumère (littéraux, booléen, `null`, ids que l'état désigne),
 * un nombre, une chaîne, un objet champ par champ, ou, pour une forme qui n'en dit pas plus (tableau, dictionnaire,
 * union d'objets), un texte JSON. Aucune règle ne se calcule ici : chaque valeur vient d'un lecteur du noyau ou du type.
 */
import {
  DESIGNATIONS, FERMETURES_DITES, VERBE_DE_REGLAGE, argumentsPosesDuGeste, cleDuGeste, declarationDuReglage, fenetreDAttaque, fenetreDIncantation, fenetreDeDefense, fenetreDeLOperation, fenetreDuButin, fenetreDuJeu, fermeturesDeLaFenetre, libelleDeLaFenetre, libelleDeLaFermeture, libelleDuJet, libelleDuLitteral,
  libelleDuGeste, libelleDuParametre, libelleDuReglage, verbeDeJetDe, viseUneRangee, reglagesDesElements, REGLAGES_DE_L_OPERATION, REGLAGES_DU_BUTIN,
  stepInteraction,
  VERBES_D_INTERACTION, type GesteDuJeu, type Jeu, type Reglage, type ValeurDuReglage,
} from '../noyau/index';
import { garanti } from '../lib/garanti';
import { proprietaireDeLaFenetre, type ProprietaireDeLaFenetre } from './projection';
import type { Forme, ParametreDeVerbe } from './formes';
import { parametresDuReglage } from './geste';
import { VERBES } from './verbes.generated';

/** Le nom du paramètre qui reçoit l'id que la fenêtre désigne (`argumentsPosesDuGeste`). */
const PARAMETRE_DESIGNE = 'pid';

/** Les paramètres d'un geste (`VERBES`, ceux de son réglage pour un réglage de jet : `parametresDuReglage`), hors la
 *  rangée (`pid`) d'un geste de jet qui n'en vise aucune (`viseUneRangee`) ou d'un réglage de la fenêtre entière. */
export function parametresDuGeste(g: GesteDuJeu): readonly ParametreDeVerbe[] {
  if (g.reglage) {
    const deLaFenetre = declarationDuReglage(g.flux, g.reglage)?.portee !== 'rangee';
    return (parametresDuReglage(g.flux, g.reglage) ?? []).filter((p) => !(deLaFenetre && p.nom === PARAMETRE_DESIGNE));
  }
  const deJet = verbeDeJetDe(g.verbe);
  const sansRangee = !!deJet && !!g.flux && !viseUneRangee(g.flux, deJet);
  return (VERBES[g.verbe] ?? []).filter((p) => !(sansRangee && p.nom === PARAMETRE_DESIGNE));
}

/** Au-delà de ce nombre de valeurs, un choix se rend en liste plutôt qu'en rangée de boutons. */
const CHOIX_EN_BOUTONS = 7;

/** Un argument d'un geste : `fixe`, posé par la fenêtre (`valeur`) ; `choix` parmi `valeurs` ; `nombre`, entre ses
 *  `bornes` quand le réglage en pose ; `texte`, une chaîne ; `objet`, ses `champs` saisis chacun ; `json`, une valeur
 *  JSON. `valeur` est la valeur courante que le réglage dit (`null` sans réglage). */
export interface ArgumentDuGeste {
  nom: string;
  optionnel: boolean;
  saisie: 'fixe' | 'choix' | 'nombre' | 'texte' | 'objet' | 'json';
  libelle: string | null;
  valeur: unknown;
  valeurs: ValeurDuReglage[] | null;
  bornes: Reglage['bornes'];
  note: string | null;
  champs: ArgumentDuGeste[] | null;
}

/** Un geste de la fenêtre : son identité (`cleDuGeste`), son verbe, son libellé (`libelleDuGeste`), ses arguments, et
 *  son rendu : `bouton` (aucun argument à dire),
 *  `choix` (un seul argument à dire, un choix, nommé par `aChoisir` : chaque valeur se joue d'un clic), `liste` (le même
 *  choix, en liste), `formulaire` (les arguments saisis, puis le bouton). Un argument est à dire quand il est requis,
 *  ou optionnel avec des valeurs nommées : aucune valeur que le noyau nomme ne reste sans saisie. `attendu` : le geste que la politique de la fenêtre
 *  joue maintenant (`drive`, le jet puis sa clôture). `ouvert` : faux pour un geste qu'une fenêtre lue règle
 *  (`LECTEURS`) et qu'elle ne nomme pas maintenant, ou que le flux de jet qui le joue ferme maintenant
 *  (`fermeturesDeLaFenetre`) sans attendre de décision (`FERMETURES_DITES`), ou dont un argument requis se choisit parmi
 *  aucune valeur ; un hôte ne le dessine pas. `raison` : ce
 *  qui ferme ce verbe de jet, en mots du joueur ; un verbe ouvert qui la porte se dessine refusé. `reglage` : un verbe
 *  qu'une fenêtre lue règle (`LECTEURS`) ou un réglage de jet (`jetRegler`), une option du coup plutôt qu'un pas de sa
 *  séquence. */
export interface GesteDeLaFenetre {
  cle: string;
  verbe: string;
  libelle: string;
  arguments: ArgumentDuGeste[];
  rendu: 'bouton' | 'choix' | 'liste' | 'formulaire';
  aChoisir: string | null;
  attendu: boolean;
  ouvert: boolean;
  raison: string | null;
  reglage: boolean;
}

/** La fenêtre qui tient la main, prête à dessiner : sa disposition (la clé de la fenêtre, `<clé>/<jet>` pour l'étape
 *  d'un jet), son titre, son étape de séquence, qui tient la main, ses gestes. */
export interface FenetreADessiner {
  disposition: string;
  titre: string;
  etape: string | null;
  proprietaire: ProprietaireDeLaFenetre;
  gestes: GesteDeLaFenetre[];
}

/** Les réglages du flux de jet `flux` (`jetRegler`) : ceux de `reglages`, tous sans liste. */
const duFlux = (flux: string, reglages?: readonly string[]) => (g: GesteDuJeu): boolean =>
  g.verbe === VERBE_DE_REGLAGE && g.flux === flux && (!reglages || reglages.includes(g.reglage ?? ''));
/** Les gestes des verbes `verbes`. */
const parmi = (verbes: readonly string[]) => (g: GesteDuJeu): boolean => verbes.includes(g.verbe);

/** Les fenêtres lues qui règlent des gestes : chacune, sa lecture et les gestes qu'elle règle. */
const LECTEURS: readonly { lire: (s: Jeu) => object | null; regle: (g: GesteDuJeu) => boolean }[] = [
  { lire: fenetreDAttaque, regle: duFlux('attack') },
  { lire: fenetreDeDefense, regle: duFlux('defense') },
  // La fenêtre d'incantation nomme ses choix ; la Surincantation et les jets sur le Tableau sont des pas qu'elle ne
  // nomme pas.
  { lire: fenetreDIncantation, regle: duFlux('cast', ['discret', 'formeConjuree', 'effetCritique']) },
  { lire: fenetreDuButin, regle: parmi(REGLAGES_DU_BUTIN) },
  { lire: fenetreDeLOperation, regle: parmi(REGLAGES_DE_L_OPERATION) },
];

/** Les réglages de la fenêtre : ceux que nomment les fenêtres lues ouvertes et l'étape de séquence courante, et les
 *  gestes que ces fenêtres règlent. */
function reglagesDeLaFenetre(etat: Jeu, etape: NonNullable<ReturnType<typeof fenetreDuJeu>>['etape']): { reglages: Reglage[]; regle: (g: GesteDuJeu) => boolean } {
  const parEtape = etape ? VERBES_D_INTERACTION[stepInteraction(etape)].reglage?.(etape) : undefined;
  const ouverts = LECTEURS.map((l) => ({ lecture: l.lire(etat), regle: l.regle })).filter((l) => l.lecture !== null);
  return {
    reglages: [...ouverts.flatMap((l) => reglagesDesElements(l.lecture)), ...(parEtape ? [parEtape] : [])],
    regle: (g) => ouverts.some((l) => l.regle(g)),
  };
}

/** Une désignation du noyau (`DESIGNATIONS`) : les ids que l'état désigne, et le nom de l'élément d'un id. */
interface DesignationLue {
  lire: (s: Jeu) => readonly (string | { id: string })[];
  nom: (s: Jeu, id: string) => string | null;
}

/** Les valeurs que la forme `f` de l'argument `nom` énumère, chacune nommée ; `null` : la forme n'en énumère pas, ou
 *  l'une n'a pas de nom. */
function valeursDeLaForme(etat: Jeu, nom: string, f: Forme): ValeurDuReglage[] | null {
  const nommer = (valeur: string | number | boolean | null, libelle: string | null): ValeurDuReglage[] | null => (libelle === null ? null : [{ valeur, libelle, refus: null }]);
  switch (f.genre) {
    case 'litteral': return nommer(f.valeur, libelleDuLitteral(f.valeur, nom));
    case 'null': return nommer(null, libelleDuLitteral(null));
    case 'booleen': return [...nommer(true, libelleDuLitteral(true))!, ...nommer(false, libelleDuLitteral(false))!];
    case 'chaine': {
      const designation: DesignationLue | null = f.designe && f.designe.cle in DESIGNATIONS ? DESIGNATIONS[f.designe.cle as keyof typeof DESIGNATIONS] : null;
      if (!designation) return null;
      const valeurs = designation.lire(etat).map((e) => (typeof e === 'string' ? e : e.id)).map((id) => nommer(id, designation.nom(etat, id)));
      return valeurs.every((v) => v !== null) ? valeurs.flat() : null;
    }
    case 'union': {
      const membres = f.membres.map((m) => valeursDeLaForme(etat, nom, m));
      return membres.every((m) => m !== null) ? membres.flat() : null;
    }
    default: return null;
  }
}

/** La saisie d'une forme qui n'énumère pas ses valeurs. */
const SAISIE_DE_LA_FORME: Partial<Record<Forme['genre'], ArgumentDuGeste['saisie']>> = { nombre: 'nombre', chaine: 'texte' };

/** Ce qui nomme la valeur d'un réglage de jet : son libellé (`libelleDuReglage`), et le nom de ses valeurs littérales
 *  (`libelleDuLitteral`), celui du réglage. */
interface ValeurDuJetRegle { libelle: string; nom: string }

/** L'argument du paramètre (ou du champ) `p` du verbe `verbe`, saisi d'après le réglage `reglage` quand il en a un ;
 *  son libellé, celui du réglage, sinon celui de la valeur d'un réglage de jet (`regle`), sinon celui du paramètre
 *  (`libelleDuParametre`). */
function argument(etat: Jeu, verbe: string, p: { nom: string; optionnel: boolean; forme: Forme }, reglage: Reglage | undefined, regle?: ValeurDuJetRegle): ArgumentDuGeste {
  const libelle = reglage?.libelle ?? regle?.libelle ?? libelleDuParametre(verbe, p.nom);
  const base = { nom: p.nom, optionnel: p.optionnel, libelle, valeur: reglage?.courant ?? null, bornes: reglage?.bornes ?? null, note: reglage?.note ?? null, champs: null };
  const valeurs = reglage?.valeurs ?? (reglage?.bornes ? null : valeursDeLaForme(etat, regle?.nom ?? p.nom, p.forme));
  if (valeurs) return { ...base, saisie: 'choix', valeurs };
  if (p.forme.genre === 'objet' && p.forme.champs) return { ...base, saisie: 'objet', valeurs: null, champs: p.forme.champs.map((c) => argument(etat, verbe, c, undefined)) };
  return { ...base, saisie: SAISIE_DE_LA_FORME[p.forme.genre] ?? 'json', valeurs: null };
}

/** Le rendu d'un geste, d'après les arguments qu'il fait dire, et l'argument de son choix. */
function renduDe(args: readonly ArgumentDuGeste[]): Pick<GesteDeLaFenetre, 'rendu' | 'aChoisir'> {
  const aDire = args.filter((a) => a.saisie !== 'fixe' && (!a.optionnel || a.saisie === 'choix'));
  if (!aDire.length) return { rendu: 'bouton', aChoisir: null };
  const [seul] = aDire;
  if (aDire.length === 1 && seul.saisie === 'choix') return { rendu: seul.valeurs!.length > CHOIX_EN_BOUTONS ? 'liste' : 'choix', aChoisir: seul.nom };
  return { rendu: 'formulaire', aChoisir: null };
}

/** Le geste que la politique de la fenêtre joue maintenant, par son identité : le premier de son drive que son jet n'a
 *  pas fermé (`fermeturesDeLaFenetre`) — le jet tant qu'il reste à tomber, la clôture ensuite. */
function gesteAttendu(drive: readonly GesteDuJeu[] | undefined, fermetures: ReadonlyMap<string, unknown>): string | null {
  const g = drive?.find((d) => !fermetures.get(cleDuGeste(d)));
  return g ? cleDuGeste(g) : null;
}

/** La fenêtre qui tient la main, prête à dessiner ; `null` : rien ne tient la main. */
export function fenetreADessiner(etat: Jeu): FenetreADessiner | null {
  const fenetre = fenetreDuJeu(etat);
  if (!fenetre) return null;
  const { reglages: lus, regle } = reglagesDeLaFenetre(etat, fenetre.etape);
  const reglages = new Map<string, Reglage[]>();
  for (const r of lus) reglages.set(cleDuGeste(r.geste), [...(reglages.get(cleDuGeste(r.geste)) ?? []), r]);
  const fermetures = fermeturesDeLaFenetre(etat, fenetre);
  const attendu = gesteAttendu(fenetre.drive, fermetures);
  const gestes = fenetre.gestes.map((g): GesteDeLaFenetre => {
    const { verbe } = g;
    const cle = cleDuGeste(g);
    const poses: Readonly<Record<string, string | undefined>> = argumentsPosesDuGeste(fenetre, g);
    const duVerbe = reglages.get(cle) ?? [];
    // L'argument libre d'un réglage de jet est sa valeur, nommée par le réglage.
    const valeurRegle = g.flux && g.reglage ? { libelle: libelleDuReglage(g.flux, g.reglage), nom: g.reglage } : undefined;
    let libre = duVerbe.find((r) => r.parametre === undefined);
    const args = parametresDuGeste(g).map((p): ArgumentDuGeste => {
      const pose = poses[p.nom];
      if (pose !== undefined) return { nom: p.nom, optionnel: p.optionnel, saisie: 'fixe', libelle: null, valeur: pose, valeurs: null, bornes: null, note: null, champs: null };
      const nomme = duVerbe.find((r) => r.parametre === p.nom);
      const a = argument(etat, verbe, p, nomme ?? libre, valeurRegle);
      if (!nomme) libre = undefined;
      return a;
    });
    const fermeture = fermetures.get(cle) ?? null;
    const sansValeur = args.some((a) => !a.optionnel && a.saisie === 'choix' && !a.valeurs?.length);
    const ouvert = (!regle(g) || reglages.has(cle)) && (!fermeture || FERMETURES_DITES.has(fermeture)) && !sansValeur;
    return { cle, verbe, libelle: garanti(libelleDuGeste(g), cle, 'libellé du geste'), arguments: args, ...renduDe(args), attendu: cle === attendu, ouvert, raison: fermeture && libelleDeLaFermeture(fermeture), reglage: !!g.reglage || regle(g) };
  });
  const pc = fenetre.etape ? etat.pendingCascade : null;
  const etape = fenetre.etape ? (fenetre.etape.label ?? (fenetre.etape.jet ? libelleDuJet(fenetre.etape.jet) : null)) : null;
  const disposition = fenetre.etape?.jet ? `${fenetre.cle}/${fenetre.etape.jet}` : fenetre.cle;
  return { disposition, titre: pc?.title ?? garanti(libelleDeLaFenetre(fenetre.cle), fenetre.cle, 'titre de la fenêtre'), etape, proprietaire: proprietaireDeLaFenetre(etat, fenetre.proprietaire), gestes };
}

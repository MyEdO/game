/**
 * LES GESTES DE LA FENÊTRE QUI TIENT LA MAIN (#2928), communs aux hôtes qui la dessinent : son titre, son étape, et
 * chacun de ses verbes (`fenetreDuJeu`) avec son libellé (`libelleDuVerbe`) et chacun de ses arguments (`VERBES`) prêt à
 * saisir. L'id que la fenêtre désigne (`pid`) est posé d'office ; un autre argument est saisi d'après le réglage que le
 * noyau nomme pour son verbe (`reglages.ts` : la valeur courante, les valeurs ouvertes, les bornes), sinon d'après sa
 * forme (`formes.ts`) : un choix parmi les valeurs qu'elle énumère (littéraux, booléen, `null`, ids que l'état désigne),
 * un nombre, une chaîne, un objet champ par champ, ou, pour une forme qui n'en dit pas plus (tableau, dictionnaire,
 * union d'objets), un texte JSON. Aucune règle ne se calcule ici : chaque valeur vient d'un lecteur du noyau ou du type.
 */
import {
  DESIGNATIONS, fenetreDAttaque, fenetreDeDefense, fenetreDuJeu, jetsEnVue, libelleDeLaFenetre, libelleDuJet, libelleDuLitteral,
  libelleDuParametre, libelleDuVerbe, porteurParId, reglagesDesElements, stepInteraction, VERBES_D_INTERACTION,
  type Jeu, type Reglage, type ValeurDuReglage,
} from '../noyau/index';
import { garanti } from '../lib/garanti';
import type { Forme } from './formes';
import { VERBES } from './verbes.generated';

/** Le nom du paramètre qui reçoit l'id que la fenêtre désigne (`FlowVerbs`, `fenetreDuJeu`). */
const PARAMETRE_DESIGNE = 'pid';

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

/** Un geste de la fenêtre : son verbe, son libellé, ses arguments, et son rendu : `bouton` (aucun argument à saisir),
 *  `choix` (un seul argument requis à saisir, un choix : chaque valeur se joue d'un clic), `liste` (le même choix, en
 *  liste), `formulaire` (les arguments saisis, puis le bouton). `attendu` : le verbe que la politique de la fenêtre
 *  joue maintenant (`drive`, le jet puis sa clôture). */
export interface GesteDeLaFenetre {
  verbe: string;
  libelle: string;
  arguments: ArgumentDuGeste[];
  rendu: 'bouton' | 'choix' | 'liste' | 'formulaire';
  attendu: boolean;
}

/** La fenêtre qui tient la main, prête à dessiner : son titre, son étape de séquence, qui tient la main, ses gestes. */
export interface FenetreADessiner {
  titre: string;
  etape: string | null;
  proprietaire: string | null;
  gestes: GesteDeLaFenetre[];
}

/** Les réglages que nomment les lecteurs de la fenêtre : l'attaque, la Défense, l'étape de séquence courante. */
function reglagesDeLaFenetre(etat: Jeu, etape: NonNullable<ReturnType<typeof fenetreDuJeu>>['etape']): Reglage[] {
  const parEtape = etape ? VERBES_D_INTERACTION[stepInteraction(etape)].reglage?.(etape) : undefined;
  return [...reglagesDesElements(fenetreDAttaque(etat)), ...reglagesDesElements(fenetreDeDefense(etat)), ...(parEtape ? [parEtape] : [])];
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

/** L'argument du paramètre (ou du champ) `p` du verbe `verbe`, saisi d'après le réglage `reglage` quand il en a un ;
 *  son libellé, celui du réglage, sinon celui du paramètre (`libelleDuParametre`). */
function argument(etat: Jeu, verbe: string, p: { nom: string; optionnel: boolean; forme: Forme }, reglage: Reglage | undefined): ArgumentDuGeste {
  const libelle = reglage?.libelle || libelleDuParametre(verbe, p.nom);
  const base = { nom: p.nom, optionnel: p.optionnel, libelle, valeur: reglage?.courant ?? null, bornes: reglage?.bornes ?? null, note: reglage?.note ?? null, champs: null };
  const valeurs = reglage?.valeurs ?? (reglage?.bornes ? null : valeursDeLaForme(etat, p.nom, p.forme));
  if (valeurs) return { ...base, saisie: 'choix', valeurs };
  if (p.forme.genre === 'objet' && p.forme.champs) return { ...base, saisie: 'objet', valeurs: null, champs: p.forme.champs.map((c) => argument(etat, verbe, c, undefined)) };
  return { ...base, saisie: SAISIE_DE_LA_FORME[p.forme.genre] ?? 'json', valeurs: null };
}

/** Le rendu d'un geste, d'après les arguments qu'il fait saisir. */
function renduDe(args: readonly ArgumentDuGeste[]): GesteDeLaFenetre['rendu'] {
  const aSaisir = args.filter((a) => a.saisie !== 'fixe');
  const requis = aSaisir.filter((a) => !a.optionnel);
  if (!requis.length) return 'bouton';
  if (requis.length === 1 && requis[0].saisie === 'choix') return requis[0].valeurs!.length > CHOIX_EN_BOUTONS ? 'liste' : 'choix';
  return 'formulaire';
}

/** Le verbe que la politique de la fenêtre joue maintenant : son premier (le jet) tant qu'un jet de la fenêtre reste à
 *  tomber, son dernier (la clôture) ensuite. */
function verbeAttendu(etat: Jeu, drive: readonly string[] | undefined): string | null {
  if (!drive?.length) return null;
  const lignes = jetsEnVue(etat).flatMap((j) => j.lignes);
  return lignes.length && lignes.every((l) => l.jet !== null) ? drive[drive.length - 1] : drive[0];
}

/** La fenêtre qui tient la main, prête à dessiner ; `null` : rien ne tient la main. */
export function fenetreADessiner(etat: Jeu): FenetreADessiner | null {
  const fenetre = fenetreDuJeu(etat);
  if (!fenetre) return null;
  const reglages = new Map(reglagesDeLaFenetre(etat, fenetre.etape).map((r) => [r.verbe, r]));
  const attendu = verbeAttendu(etat, fenetre.drive);
  const gestes = fenetre.verbes.map((verbe): GesteDeLaFenetre => {
    let regle = reglages.get(verbe);
    const args = (VERBES[verbe] ?? []).map((p): ArgumentDuGeste => {
      if (p.nom === PARAMETRE_DESIGNE && fenetre.pid) return { nom: p.nom, optionnel: p.optionnel, saisie: 'fixe', libelle: null, valeur: fenetre.pid, valeurs: null, bornes: null, note: null, champs: null };
      const a = argument(etat, verbe, p, regle);
      regle = undefined;
      return a;
    });
    return { verbe, libelle: garanti(libelleDuVerbe(verbe), verbe, 'libellé du verbe'), arguments: args, rendu: renduDe(args), attendu: verbe === attendu };
  });
  const pc = fenetre.etape ? etat.pendingCascade : null;
  const etape = fenetre.etape ? (fenetre.etape.label ?? (fenetre.etape.jet ? libelleDuJet(fenetre.etape.jet) : null)) : null;
  const proprietaire = fenetre.proprietaire === '*' ? null : fenetre.proprietaire ? (porteurParId(etat, fenetre.proprietaire)?.label ?? null) : null;
  return { titre: pc?.title ?? garanti(libelleDeLaFenetre(fenetre.cle), fenetre.cle, 'titre de la fenêtre'), etape, proprietaire, gestes };
}

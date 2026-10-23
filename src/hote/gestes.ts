/**
 * LES GESTES DE LA FENÊTRE QUI TIENT LA MAIN (#2928), communs aux hôtes qui la dessinent : son titre, son étape, son
 * corps (`corpsDeLaFenetre`), et chacun de ses verbes (`fenetreDuJeu`) avec son libellé (`libelleDuVerbe`) et chacun
 * de ses arguments (`VERBES`) prêt à saisir. L'id que la fenêtre désigne (`pid`) est posé d'office ; un autre argument est saisi d'après le réglage que le
 * noyau nomme pour son verbe et ce paramètre, ou pour le premier argument libre (`reglages.ts` : la valeur courante, les
 * valeurs ouvertes, les bornes), sinon d'après sa
 * forme (`formes.ts`) : un choix parmi les valeurs qu'elle énumère (littéraux, booléen, `null`, ids que l'état désigne),
 * un nombre, une chaîne, un objet champ par champ, ou, pour une forme qui n'en dit pas plus (tableau, dictionnaire,
 * union d'objets), un texte JSON. Aucune règle ne se calcule ici : chaque valeur vient d'un lecteur du noyau ou du type.
 */
import {
  DESIGNATIONS, fenetreDAttaque, fenetreDeDefense, fenetreDeLOperation, fenetreDuButin, fenetreDuJeu, jetsEnVue, libelleDeLaFenetre, libelleDuJet, libelleDuLitteral,
  libelleDuParametre, libelleDuVerbe, reglagesDesElements, REGLAGES_DE_L_ATTAQUE, REGLAGES_DE_L_OPERATION, REGLAGES_DE_LA_DEFENSE, REGLAGES_DU_BUTIN,
  stepInteraction,
  VERBES_D_INTERACTION, type Jeu, type Reglage, type ValeurDuReglage,
} from '../noyau/index';
import { garanti } from '../lib/garanti';
import { corpsDeLaFenetre } from './ecran';
import { proprietaireDeLaFenetre, type ProprietaireDeLaFenetre } from './projection';
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

/** Un geste de la fenêtre : son verbe, son libellé, ses arguments, et son rendu : `bouton` (aucun argument à dire),
 *  `choix` (un seul argument à dire, un choix, nommé par `aChoisir` : chaque valeur se joue d'un clic), `liste` (le même
 *  choix, en liste), `formulaire` (les arguments saisis, puis le bouton). Un argument est à dire quand il est requis,
 *  ou optionnel avec des valeurs nommées : aucune valeur que le noyau nomme ne reste sans saisie. `attendu` : le verbe que la politique de la fenêtre
 *  joue maintenant (`drive`, le jet puis sa clôture). `ouvert` : faux pour un verbe qu'une fenêtre lue règle
 *  (`LECTEURS`) et qu'elle ne nomme pas maintenant ; un hôte ne le dessine pas. */
export interface GesteDeLaFenetre {
  verbe: string;
  libelle: string;
  arguments: ArgumentDuGeste[];
  rendu: 'bouton' | 'choix' | 'liste' | 'formulaire';
  aChoisir: string | null;
  attendu: boolean;
  ouvert: boolean;
}

/** La fenêtre qui tient la main, prête à dessiner : son titre, son étape de séquence, qui tient la main, son corps en
 *  lignes (`corpsDeLaFenetre`), ses gestes. */
export interface FenetreADessiner {
  titre: string;
  etape: string | null;
  proprietaire: ProprietaireDeLaFenetre;
  corps: string[];
  gestes: GesteDeLaFenetre[];
}

/** Les fenêtres lues qui règlent des verbes : chacune, sa lecture et les verbes qu'elle règle. */
const LECTEURS: readonly { lire: (s: Jeu) => object | null; verbes: readonly string[] }[] = [
  { lire: fenetreDAttaque, verbes: REGLAGES_DE_L_ATTAQUE },
  { lire: fenetreDeDefense, verbes: REGLAGES_DE_LA_DEFENSE },
  { lire: fenetreDuButin, verbes: REGLAGES_DU_BUTIN },
  { lire: fenetreDeLOperation, verbes: REGLAGES_DE_L_OPERATION },
];

/** Les réglages de la fenêtre : ceux que nomment les fenêtres lues ouvertes et l'étape de séquence courante, et les
 *  verbes que ces fenêtres règlent. */
function reglagesDeLaFenetre(etat: Jeu, etape: NonNullable<ReturnType<typeof fenetreDuJeu>>['etape']): { reglages: Reglage[]; regles: Set<string> } {
  const parEtape = etape ? VERBES_D_INTERACTION[stepInteraction(etape)].reglage?.(etape) : undefined;
  const ouverts = LECTEURS.map((l) => ({ lecture: l.lire(etat), verbes: l.verbes })).filter((l) => l.lecture !== null);
  return {
    reglages: [...ouverts.flatMap((l) => reglagesDesElements(l.lecture)), ...(parEtape ? [parEtape] : [])],
    regles: new Set(ouverts.flatMap((l) => l.verbes)),
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

/** L'argument du paramètre (ou du champ) `p` du verbe `verbe`, saisi d'après le réglage `reglage` quand il en a un ;
 *  son libellé, celui du réglage, sinon celui du paramètre (`libelleDuParametre`). */
function argument(etat: Jeu, verbe: string, p: { nom: string; optionnel: boolean; forme: Forme }, reglage: Reglage | undefined): ArgumentDuGeste {
  const libelle = reglage?.libelle ?? libelleDuParametre(verbe, p.nom);
  const base = { nom: p.nom, optionnel: p.optionnel, libelle, valeur: reglage?.courant ?? null, bornes: reglage?.bornes ?? null, note: reglage?.note ?? null, champs: null };
  const valeurs = reglage?.valeurs ?? (reglage?.bornes ? null : valeursDeLaForme(etat, p.nom, p.forme));
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
  const { reglages: lus, regles } = reglagesDeLaFenetre(etat, fenetre.etape);
  const reglages = new Map<string, Reglage[]>();
  for (const r of lus) reglages.set(r.verbe, [...(reglages.get(r.verbe) ?? []), r]);
  const attendu = verbeAttendu(etat, fenetre.drive);
  const gestes = fenetre.verbes.map((verbe): GesteDeLaFenetre => {
    const duVerbe = reglages.get(verbe) ?? [];
    let libre = duVerbe.find((r) => r.parametre === undefined);
    const args = (VERBES[verbe] ?? []).map((p): ArgumentDuGeste => {
      if (p.nom === PARAMETRE_DESIGNE && fenetre.pid) return { nom: p.nom, optionnel: p.optionnel, saisie: 'fixe', libelle: null, valeur: fenetre.pid, valeurs: null, bornes: null, note: null, champs: null };
      const nomme = duVerbe.find((r) => r.parametre === p.nom);
      const a = argument(etat, verbe, p, nomme ?? libre);
      if (!nomme) libre = undefined;
      return a;
    });
    const ouvert = !regles.has(verbe) || reglages.has(verbe);
    return { verbe, libelle: garanti(libelleDuVerbe(verbe), verbe, 'libellé du verbe'), arguments: args, ...renduDe(args), attendu: verbe === attendu, ouvert };
  });
  const pc = fenetre.etape ? etat.pendingCascade : null;
  const etape = fenetre.etape ? (fenetre.etape.label ?? (fenetre.etape.jet ? libelleDuJet(fenetre.etape.jet) : null)) : null;
  return { titre: pc?.title ?? garanti(libelleDeLaFenetre(fenetre.cle), fenetre.cle, 'titre de la fenêtre'), etape, proprietaire: proprietaireDeLaFenetre(etat, fenetre.proprietaire), corps: corpsDeLaFenetre(etat), gestes };
}

/**
 * LA RENCONTRE JOUÉE JUSQU'À SON ISSUE (#4829), pour un hôte qui la laisse au noyau (combat automatique, banc
 * d'équilibrage, simulation) : en cadence `auto`, le noyau pilote chaque combattant, héros compris, par ses jetons
 * programmés ; l'hôte les reprend sur l'horloge virtuelle (`horlogeVirtuelle`) et joue le geste attendu du drive de la
 * fenêtre qui tient alors la main (`fenetreADessiner`), jusqu'à la sortie de l'écran de fin.
 */
import {
  fenetreDuJeu, horlogeVirtuelle,
  type Combatant, type IdDEntiteDeScene, type IdDeHeros, type Intention, type ItemInstance, type Jeu, type ResultatDeLAppel,
} from '../noyau/index';
import { appelDuGeste } from './elements';
import { envoyerLIntention } from './geste';
import { fenetreADessiner } from './gestes';
import { valider, type PartieAuGroupe } from './partie';

/** Le plafond des gestes joués dans une rencontre : au-delà, elle s'arrête en impasse plutôt que de boucler. */
const PLAFOND_DE_GESTES = 1000;

/** Un lot posé au sol pendant la rencontre, que portait un héros du groupe : le décor qui le montre, que
 *  `ramasserLObjet` reprend, et ses objets, l'objet en tête. */
export interface LotAuSol {
  porteur: IdDeHeros;
  decor: IdDEntiteDeScene;
  objets: ItemInstance[];
}

/** L'issue d'une rencontre close : son vainqueur, le groupe qu'elle rend (`Jeu.party`, ce qui ne vit que le temps de la
 *  rencontre levé), les lots que ses héros ont laissés au sol, et le Destin que chacun a perdu pendant elle (son `fate`
 *  d'avant moins celui d'après). */
export interface RencontreClose {
  issue: 'victoire' | 'defaite';
  groupe: Combatant[];
  auSol: LotAuSol[];
  destinDepense: Record<IdDeHeros, number>;
}

/** Une rencontre arrêtée avant son issue : la fenêtre qui tient la main n'a pas de geste attendu (un choix sans défaut,
 *  le tour d'un héros hors de la cadence `auto`), le combat a cessé sans issue, ou le plafond est atteint. `fenetre` :
 *  sa clé, `null` sans fenêtre. */
export interface RencontreEnImpasse {
  issue: 'impasse';
  fenetre: NonNullable<ReturnType<typeof fenetreDuJeu>>['cle'] | null;
}

export type IssueDeRencontre = RencontreClose | RencontreEnImpasse;

/** Les lots de `apres.objetsAuSol` absents de `avant`, dont l'objet de tête était porté par un héros de `groupe`. */
function lotsAuSol(avant: Jeu['objetsAuSol'], apres: Jeu['objetsAuSol'], groupe: readonly Combatant[]): LotAuSol[] {
  return Object.entries(apres).flatMap(([decor, objets]) => {
    if (avant[decor]) return [];
    const porteur = groupe.find((h) => (h.items ?? []).some((i) => i.uid === objets[0].uid));
    return porteur ? [{ porteur: porteur.id, decor, objets: structuredClone(objets) }] : [];
  });
}

/**
 * Joue la rencontre ouverte de `o` jusqu'à son issue : reprend les jetons de `dernier`, le dernier résultat reçu dont les
 * jetons ne sont pas repris (celui du lancement d'un combat direct ; aucun à la reprise d'une rencontre qui en suit une
 * autre), puis, tant que la rencontre dure, ceux de chaque reprise et de chaque geste joué. La rencontre est close quand
 * l'écran de fin est sorti : le combat levé, ou celui d'une rencontre qui la suit (`onVictory`), qu'un nouvel appel joue.
 * Lève une erreur de validation sans rencontre ouverte.
 */
export function jouerLaRencontre(o: PartieAuGroupe, dernier?: ResultatDeLAppel): IssueDeRencontre {
  const { partie, jetons } = o;
  const avant = partie.etat();
  valider(avant.battle, 'aucune rencontre ouverte');
  const groupe = structuredClone(avant.party);
  const solAvant = { ...avant.objetsAuSol };
  const horloge = horlogeVirtuelle((id) => jetons.programmes(jetons.reprendre(id)), dernier ? jetons.programmes(dernier) : []);
  let issue: RencontreClose['issue'] | null = null;
  for (let n = 0; ; n++) {
    horloge.vider();
    const e = partie.etat();
    if (issue && !e.battle?.over) {
      return {
        issue,
        groupe: structuredClone(e.party),
        auSol: lotsAuSol(solAvant, e.objetsAuSol, groupe),
        destinDepense: Object.fromEntries(groupe.flatMap((h) => {
          const apres = e.party.find((x) => x.id === h.id);
          return apres ? [[h.id, (h.fate ?? 0) - (apres.fate ?? 0)]] : [];
        })),
      };
    }
    const fenetre = fenetreADessiner(e);
    const attendu = fenetre?.gestes.find((g) => g.attendu);
    if (!e.battle || !attendu || n === PLAFOND_DE_GESTES) return { issue: 'impasse', fenetre: e.battle ? (fenetreDuJeu(e)?.cle ?? null) : null };
    issue = e.battle.over;
    horloge.armer(jetons.programmes(envoyerLIntention(partie, appelDuGeste(attendu) as Intention)));
  }
}

/**
 * LES VERBES OUVERTS D'UN JET (#2936) : ce qui ferme MAINTENANT chaque verbe du cycle d'un flux de jet, lu aux gardes
 * de ses ops (`RollFlowHandlers.fermetures`), et chaque verbe de la fenêtre qui tient la main qu'un de ses flux joue.
 * Lu par la coquille web (`ui/RollShell`) et par les hôtes du noyau (`hote/gestes.ts`) : aucun ne date un verbe
 * « avant » ou « après » le jet de lui-même.
 */
import type { Jeu } from './etat';
import { fenetreDuJeu, TOUT_RESOUDRE, type FenetreDuJeu } from './combatAuto';
import { stepInteraction } from './cascade';
import type { PendingCascade } from './pendings';
import { estVerbeDeFenetre, FLOW_VERBS, verbeDeJetDe, viseUneRangee, type FlowKey, type FlowVerbs, type RollVerb } from './flowVerbs';
import { cleDuGeste, type CleDeRegistre, type FenetreAValider, type FenetreQuiSeFerme, type GesteDuJeu } from './modalArbiter';
import { fermetureDeLaSortie } from './sortieDeFenetre';
import { fermetureDeLaValidation } from './validationDeFenetre';
import { FLOWS, fermetureDuReglage, rangeesAReglerIci } from './rollFlowSpecs';
import type { FermetureDuJet, FermeturesDuJet } from './rollFlowFactory';
import { declarationDuReglageNomme, estFluxRegle, type ReglageDuJet } from './reglagesDuJet';

/** Ce qui ferme chaque verbe du cycle du flux `flux` sur le slot `pid` (`null` : ouvert) ; sans `pid`, un flux à
 *  plusieurs jets se juge en fenêtre. */
export function fermeturesDuFlux(s: Jeu, flux: FlowKey, pid?: string): FermeturesDuJet {
  return FLOWS[flux].fermetures(() => s, pid);
}

/** Le verbe du cycle que joue le geste `g` de la fenêtre sur son flux `flux`, un verbe de jet sur ce flux. `enFenetre` :
 *  le geste agit sur la fenêtre entière, jamais sur une rangée. `null` : le flux ne joue pas ce geste. */
function verbeDuCycle(flux: FlowKey, g: GesteDuJeu): { verbe: RollVerb; enFenetre: boolean } | null {
  const deJet = verbeDeJetDe(g.verbe);
  return deJet && g.flux === flux ? { verbe: deJet, enFenetre: estVerbeDeFenetre(deJet) } : null;
}

/** Ce qui ferme maintenant « tout résoudre » sur la cascade `pc` (`TOUT_RESOUDRE`) : la validation de l'étape
 *  (`jetValider('cascade')`) quand l'étape attend un choix que rien ne tranche à la place du joueur
 *  (`resolveRemainingCascade`), ou au bilan. */
function fermetureDeToutResoudre(s: Jeu, pc: PendingCascade): FermetureDuJet | null {
  const etape = pc.participants[pc.cursor];
  return !etape || stepInteraction(etape) === 'choix' ? fermeturesDuFlux(s, 'cascade').valider : null;
}

/** Les fermetures des gestes qu'une fenêtre juge elle-même, par l'identité de chacun (`cleDuGeste`). */
type FermeturesPropres = (s: Jeu) => Partial<Record<string, FermetureDuJet | null>> | null;

/** Ce qui ferme maintenant les gestes qu'une fenêtre juge elle-même, par sa clé, chacun par son identité
 *  (`cleDuGeste`) : « tout résoudre » sur la cascade, la déclaration du Contre-sort quand ce siège n'a plus de rangée à
 *  déclarer (`rangeesAReglerIci`) ; au début du Round, le clic du combattant sans visée armée (`preemptAiming`). Les
 *  valeurs d'un choix de fenêtre se ferment à `OUVERTS_DU_CHOIX`. */
const FERMETURES_DES_VERBES: Partial<Record<string, FermeturesPropres>> = {
  cascade: (s) => s.pendingCascade && {
    [cleDuGeste(TOUT_RESOUDRE)]: fermetureDeToutResoudre(s, s.pendingCascade),
    [cleDuGeste({ verbe: 'jetRegler', flux: 'contreSort', reglage: 'declaration', toutes: true })]: rangeesAReglerIci(s, declarationDuReglageNomme('contreSort', 'declaration')).length ? null : 'rienADeclarer',
  },
  debutDuRound: (s) => ({
    cliquerLaCase: s.preemptAiming ? null : 'nonOffert',
  }),
} satisfies Partial<Record<CleDeRegistre, FermeturesPropres>>;

/** Les arguments que la fenêtre pose d'office pour son geste `g` : la fenêtre d'une validation ou d'une sortie, la
 *  fenêtre et l'axe d'un choix, le flux d'un geste de jet, le flux et le réglage d'un réglage — et la valeur que son
 *  drive y joue (`valeur`) —, et l'id qu'elle désigne (`pid`), seulement quand le geste vise une rangée
 *  (`viseUneRangee`, un réglage de rangée) et ne joue pas sa rangée omise (`toutes`). */
export function argumentsPosesDuGeste(fenetre: FenetreDuJeu, g: GesteDuJeu): { fenetre?: GesteDuJeu['fenetre']; axe?: GesteDuJeu['axe']; flux?: FlowKey; reglage?: ReglageDuJet; valeur?: string; pid?: string } {
  if (g.fenetre) return { fenetre: g.fenetre, ...(g.axe ? { axe: g.axe } : {}) };
  const pid = fenetre.pid ? { pid: fenetre.pid } : {};
  if (g.flux && g.reglage) return { flux: g.flux, reglage: g.reglage, ...(g.valeur === undefined ? {} : { valeur: g.valeur }), ...(!g.toutes && declarationDuReglageNomme(g.flux, g.reglage)?.portee === 'rangee' ? pid : {}) };
  const deJet = verbeDeJetDe(g.verbe);
  if (!deJet || !g.flux) return pid;
  return { flux: g.flux, ...(!g.toutes && viseUneRangee(g.flux, deJet) ? pid : {}) };
}

/** Ce qui ferme maintenant chaque geste de la fenêtre qui tient la main que l'un de ses flux joue, chacun de ses
 *  réglages (sa phase, `fermetureDeLaPhase`), sa validation (`fermetureDeLaValidation`) et sa sortie
 *  (`fermetureDeLaSortie`) (`null` : ouvert), par son identité (`cleDuGeste`) ; un autre geste n'y figure pas. Un geste
 *  de rangée se juge sur la rangée que la fenêtre désigne (`pid`) ; un geste de fenêtre (`estVerbeDeFenetre`), sur la
 *  fenêtre entière, comme son verbe le joue. */
export function fermeturesDeLaFenetre(s: Jeu, fenetre: FenetreDuJeu | null = fenetreDuJeu(s)): ReadonlyMap<string, FermetureDuJet | null> {
  const out = new Map<string, FermetureDuJet | null>();
  if (!fenetre) return out;
  const parFlux = new Map<string, FermeturesDuJet>();
  const juger = (flux: FlowKey, pid: string | undefined): FermeturesDuJet => {
    const cle = `${flux}|${pid ?? ''}`;
    const deja = parFlux.get(cle);
    if (deja) return deja;
    const f = fermeturesDuFlux(s, flux, pid);
    parFlux.set(cle, f);
    return f;
  };
  const propres: Partial<Record<string, FermetureDuJet | null>> = FERMETURES_DES_VERBES[fenetre.cle]?.(s) ?? {};
  for (const g of fenetre.gestes) {
    if (g.verbe === 'fenetreValider') { out.set(cleDuGeste(g), fermetureDeLaValidation(s, g.fenetre as FenetreAValider)); continue; }
    if (g.verbe === 'fenetreFermer') { out.set(cleDuGeste(g), fermetureDeLaSortie(s, g.fenetre as FenetreQuiSeFerme)); continue; }
    if (cleDuGeste(g) in propres) {
      out.set(cleDuGeste(g), propres[cleDuGeste(g)] ?? null);
      continue;
    }
    if (g.reglage && estFluxRegle(g.flux)) {
      out.set(cleDuGeste(g), fermetureDuReglage(() => s, g.flux, g.reglage, declarationDuReglageNomme(g.flux, g.reglage)?.portee === 'rangee' ? fenetre.pid : undefined));
      continue;
    }
    for (const flux of fenetre.flux) {
      const cycle = verbeDuCycle(flux, g);
      if (!cycle) continue;
      const w: FlowVerbs = FLOW_VERBS[flux];
      const pid = w.kind === 'multi' && !cycle.enFenetre ? fenetre.pid : undefined;
      out.set(cleDuGeste(g), juger(flux, pid)[cycle.verbe]);
      break;
    }
  }
  return out;
}

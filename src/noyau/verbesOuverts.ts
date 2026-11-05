/**
 * LES VERBES OUVERTS D'UN JET (#2936) : ce qui ferme MAINTENANT chaque verbe du cycle d'un flux de jet, lu aux gardes
 * de ses ops (`RollFlowHandlers.fermetures`), et chaque verbe de la fenêtre qui tient la main qu'un de ses flux joue.
 * Lu par la coquille web (`ui/RollShell`) et par les hôtes du noyau (`hote/gestes.ts`) : aucun ne date un verbe
 * « avant » ou « après » le jet de lui-même.
 */
import type { Jeu } from './etat';
import { fenetreDuJeu, type FenetreDuJeu } from './combatAuto';
import { stepInteraction } from './cascade';
import type { PendingCascade } from './pendings';
import { estVerbeDeFenetre, FLOW_VERBS, verbeDeJetDe, viseUneRangee, type FlowKey, type FlowVerbs, type RollVerb } from './flowVerbs';
import { cleDuGeste, sortieDeLaFenetre, type FenetreQuiSeFerme, type GesteDuJeu } from './modalArbiter';
import { FLOW_HANDLERS } from './rollFlowSpecs';
import type { FermetureDuJet, FermeturesDuJet } from './rollFlowFactory';

/** Ce qui ferme chaque verbe du cycle du flux `flux` sur le slot `pid` (`null` : ouvert) ; sans `pid`, un flux à
 *  plusieurs jets se juge en fenêtre. */
export function fermeturesDuFlux(s: Jeu, flux: FlowKey, pid?: string): FermeturesDuJet {
  return FLOW_HANDLERS[flux].fermetures(() => s, pid);
}

/** Le verbe du cycle que joue le geste `g` de la fenêtre sur son flux `flux`, un verbe de jet sur ce flux. `enFenetre` :
 *  le geste agit sur la fenêtre entière, jamais sur une rangée. `null` : le flux ne joue pas ce geste. */
function verbeDuCycle(flux: FlowKey, g: GesteDuJeu): { verbe: RollVerb; enFenetre: boolean } | null {
  const deJet = verbeDeJetDe(g.verbe);
  return deJet && g.flux === flux ? { verbe: deJet, enFenetre: estVerbeDeFenetre(deJet) } : null;
}

/** Ce qui ferme maintenant « tout résoudre » sur la cascade `pc` (`NAVIGATION_DE_CASCADE`) : la validation de l'étape
 *  (`jetConfirm('cascade')`) quand l'étape attend un choix que rien ne tranche à la place du joueur
 *  (`resolveRemainingCascade`), ou au bilan. */
function fermetureDeToutResoudre(s: Jeu, pc: PendingCascade): FermetureDuJet | null {
  const etape = pc.participants[pc.cursor];
  return !etape || stepInteraction(etape) === 'choix' ? fermeturesDuFlux(s, 'cascade').confirm : null;
}

/** Les arguments que la fenêtre pose d'office pour son geste `g` : la fenêtre d'une sortie, le flux d'un geste de jet,
 *  et l'id qu'elle désigne (`pid`) — pour un geste de jet, seulement quand il vise une rangée (`viseUneRangee`). */
export function argumentsPosesDuGeste(fenetre: FenetreDuJeu, g: GesteDuJeu): { fenetre?: FenetreQuiSeFerme; flux?: FlowKey; pid?: string } {
  if (g.fenetre) return { fenetre: g.fenetre };
  const deJet = verbeDeJetDe(g.verbe);
  const pid = fenetre.pid ? { pid: fenetre.pid } : {};
  if (!deJet || !g.flux) return pid;
  return { flux: g.flux, ...(viseUneRangee(g.flux, deJet) ? pid : {}) };
}

/** Ce qui ferme maintenant chaque geste de la fenêtre qui tient la main que l'un de ses flux joue, et sa sortie
 *  (`sortieFermee`) (`null` : ouvert), par son identité (`cleDuGeste`) ; un autre geste n'y figure pas. Un geste de
 *  rangée se juge sur la rangée que la fenêtre désigne (`pid`) ; un geste de fenêtre (`estVerbeDeFenetre`), sur la
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
  const pc = fenetre.cle === 'cascade' ? s.pendingCascade : null;
  for (const g of fenetre.gestes) {
    const sortie = sortieDeLaFenetre(g.fenetre);
    if (sortie) { out.set(cleDuGeste(g), sortie.fermee(s)); continue; }
    if (pc && g.verbe === 'cascadeResolveAll') { out.set(cleDuGeste(g), fermetureDeToutResoudre(s, pc)); continue; }
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

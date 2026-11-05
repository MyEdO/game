/**
 * LES VERBES OUVERTS D'UN JET (#2936) : ce qui ferme MAINTENANT chaque verbe du cycle d'un flux de jet, lu aux gardes
 * de ses ops (`RollFlowHandlers.fermetures`), et chaque verbe de la fenêtre qui tient la main qu'un de ses flux joue.
 * Lu par la coquille web (`ui/RollShell`) et par les hôtes du noyau (`hote/gestes.ts`) : aucun ne date un verbe
 * « avant » ou « après » le jet de lui-même.
 */
import type { Jeu } from './etat';
import { fenetreDuJeu, NAVIGATION_DE_CASCADE, type FenetreDuJeu } from './combatAuto';
import { stepInteraction, stepReady } from './cascade';
import type { PendingCascade } from './pendings';
import { fateSaveOptions } from '../engine/fortune';
import { estVerbeDeFenetre, FLOW_VERBS, verbeDeJetDe, viseUneRangee, type FlowKey, type FlowVerbs, type RollVerb } from './flowVerbs';
import { cleDuGeste, type GesteDuJeu } from './modalArbiter';
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

/** Ce qui ferme maintenant la navigation de la cascade `pc` (`NAVIGATION_DE_CASCADE`). Sur une étape : la valider tant
 *  qu'elle n'est pas prête (`stepReady`), tout résoudre tant qu'elle attend un choix que rien ne tranche à la place du
 *  joueur (`resolveRemainingCascade`), terminer tant qu'il reste des étapes. Au bilan, seul « Terminer » reste. */
function fermeturesDeLaNavigation(s: Jeu, pc: PendingCascade): Record<(typeof NAVIGATION_DE_CASCADE)[number], FermetureDuJet | null> {
  const etape = pc.participants[pc.cursor];
  if (!etape) return { cascadeNext: 'etapesJouees', cascadeResolveAll: 'etapesJouees', cascadeFinish: null };
  const choix = stepInteraction(etape) === 'choix';
  const due: FermetureDuJet | null = stepReady(etape, s) ? null : choix ? 'choixDu' : 'jetNonLance';
  return { cascadeNext: due, cascadeResolveAll: choix ? due : null, cascadeFinish: 'etapesDues' };
}

/** Ce qui ferme maintenant les verbes qu'une fenêtre joue sans flux de jet, par sa clé : la navigation de la cascade,
 *  l'annulation du coup que le Sauvetage par le Destin n'offre pas (`fateSaveOptions`). */
const FERMETURES_DES_VERBES: Partial<Record<string, (s: Jeu) => Partial<Record<string, FermetureDuJet | null>> | null>> = {
  cascade: (s) => s.pendingCascade && fermeturesDeLaNavigation(s, s.pendingCascade),
  fateSave: (s) => s.pendingFateSave && { fateNegate: fateSaveOptions(s.pendingFateSave.source).includes('negate') ? null : 'nonOffert' },
};

/** Les arguments que la fenêtre pose d'office pour son geste `g` : le flux d'un geste de jet, et l'id qu'elle désigne
 *  (`pid`) — pour un geste de jet, seulement quand il vise une rangée (`viseUneRangee`). */
export function argumentsPosesDuGeste(fenetre: FenetreDuJeu, g: GesteDuJeu): { flux?: FlowKey; pid?: string } {
  const deJet = verbeDeJetDe(g.verbe);
  const pid = fenetre.pid ? { pid: fenetre.pid } : {};
  if (!deJet || !g.flux) return pid;
  return { flux: g.flux, ...(viseUneRangee(g.flux, deJet) ? pid : {}) };
}

/** Ce qui ferme maintenant chaque geste de la fenêtre qui tient la main que l'un de ses flux joue (`null` : ouvert),
 *  par son identité (`cleDuGeste`) ; un geste qu'aucun flux ne joue n'y figure pas. Un geste de rangée se juge sur la
 *  rangée que la fenêtre désigne (`pid`) ; un geste de fenêtre, sur l'étape que désigne une fenêtre dont les rangées
 *  n'ont pas d'acteur propre (`pidIsActor` faux), sinon sur la fenêtre entière. */
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
    if (g.verbe in propres) {
      out.set(cleDuGeste(g), propres[g.verbe] ?? null);
      continue;
    }
    for (const flux of fenetre.flux) {
      const cycle = verbeDuCycle(flux, g);
      if (!cycle) continue;
      const w: FlowVerbs = FLOW_VERBS[flux];
      const pid = w.kind === 'multi' && (!cycle.enFenetre || !w.pidIsActor) ? fenetre.pid : undefined;
      out.set(cleDuGeste(g), juger(flux, pid)[cycle.verbe]);
      break;
    }
  }
  return out;
}

/**
 * LES VERBES OUVERTS D'UN JET (#2936) : ce qui ferme MAINTENANT chaque verbe du cycle d'un flux de jet, lu aux gardes
 * de ses ops (`RollFlowHandlers.fermetures`), et chaque verbe de la fenêtre qui tient la main qu'un de ses flux joue.
 * Lu par la coquille web (`ui/RollShell`) et par les hôtes du noyau (`hote/gestes.ts`) : aucun ne date un verbe
 * « avant » ou « après » le jet de lui-même.
 */
import type { Jeu } from './etat';
import { fenetreDuJeu, type FenetreDuJeu } from './combatAuto';
import { FLOW_VERBS, VERBES_DE_JET, flowActionName, type FlowKey, type FlowVerbs } from './flowVerbs';
import { FLOW_HANDLERS } from './rollFlowSpecs';
import type { FermetureDuJet, FermeturesDuJet, VerbeDuCycle } from './rollFlowFactory';
import type { CascadeStep } from './pendings';

/** Ce qui ferme chaque verbe du cycle du flux `flux` sur le slot `pid` (`null` : ouvert) ; sans `pid`, un flux à
 *  plusieurs jets se juge en fenêtre. */
export function fermeturesDuFlux(s: Jeu, flux: FlowKey, pid?: string): FermeturesDuJet {
  return FLOW_HANDLERS[flux].fermetures(() => s, pid);
}

/** La Maladresse d'une étape (`jet:'fumble'`, LDB 14) : un tirage sur le Tableau des Oups !, sans cible ni influence,
 *  donc hors des flux de jet. Son tirage s'ouvre tant qu'il n'est pas tiré, son application une fois tiré ; lu par
 *  `fumbleRoll`/`fumbleConfirm` et par la fenêtre. */
export function fermeturesDeLaMaladresse(etape: CascadeStep): { fumbleRoll: FermetureDuJet | null; fumbleConfirm: FermetureDuJet | null } {
  if (!etape.fumble) return { fumbleRoll: 'sansJet', fumbleConfirm: 'sansJet' };
  const tire = !!etape.fumble.result;
  return { fumbleRoll: tire ? 'jetLance' : null, fumbleConfirm: tire ? null : 'jetNonLance' };
}

/** Le verbe du cycle que joue le verbe `nom` de la fenêtre sur son flux `flux` : son délégué `<flux><Verbe>`, le jet de
 *  chaque rangée (`<flux>RollAll`), la clôture (la première `resolution` déclarée, `<flux>Confirm`, ou le dernier verbe
 *  du drive pour le flux en tête). `enFenetre` : le verbe agit sur la fenêtre entière, jamais sur une rangée. `null` :
 *  le flux ne joue pas ce verbe. */
function verbeDuCycle(fenetre: FenetreDuJeu, flux: FlowKey, nom: string): { verbe: VerbeDuCycle; enFenetre: boolean } | null {
  const delegue = VERBES_DE_JET.find((v) => flowActionName(flux, v) === nom);
  if (delegue) return { verbe: delegue, enFenetre: delegue === 'cancel' };
  if (nom === flowActionName(flux, 'rollAll')) return { verbe: 'roll', enFenetre: true };
  const w: FlowVerbs = FLOW_VERBS[flux];
  const drive = fenetre.drive ?? [];
  const cloture = w.resolution?.[0] === nom || nom === flowActionName(flux, 'confirm') || (flux === fenetre.flux[0] && nom === drive[drive.length - 1]);
  return cloture ? { verbe: 'apply', enFenetre: true } : null;
}

/** Ce qui ferme maintenant chaque verbe de la fenêtre qui tient la main que l'un de ses flux joue (`null` : ouvert) ;
 *  un verbe qu'aucun flux ne joue n'y figure pas. Un verbe de rangée se juge sur la rangée que la fenêtre désigne
 *  (`pid`) ; un verbe de fenêtre, sur l'étape que désigne une fenêtre dont les rangées n'ont pas d'acteur propre
 *  (`pidIsActor` faux), sinon sur la fenêtre entière. */
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
  for (const nom of fenetre.verbes) {
    for (const flux of fenetre.flux) {
      const cycle = verbeDuCycle(fenetre, flux, nom);
      if (!cycle) continue;
      const w: FlowVerbs = FLOW_VERBS[flux];
      const pid = w.kind === 'multi' && (!cycle.enFenetre || !w.pidIsActor) ? fenetre.pid : undefined;
      out.set(nom, juger(flux, pid)[cycle.verbe]);
      break;
    }
  }
  if (fenetre.etape?.jet === 'fumble') {
    for (const [nom, f] of Object.entries(fermeturesDeLaMaladresse(fenetre.etape))) if (fenetre.verbes.includes(nom)) out.set(nom, f);
  }
  return out;
}

/**
 * LE RÉSEAU DU PROPRIÉTAIRE DE L'ÉTAT (#3009) : la session coop qu'il tient (`net`) et, chez l'INVITÉ, l'enrobage des
 * actions de l'allowlist (`GUEST_INTENTS`) qui les fait partir en intention vers l'hôte (`emettreIntentInvite`). Les
 * actions d'origine vivent dans la fermeture de la fabrique, jamais dans l'état.
 */
import type { Get, SetDesClesReservees } from './flowTypes';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { Jeu } from './etat';
import { GUEST_INTENTS } from './intentionsDeSiege';
import { argsAvecIntentionLocale, preparerLIntentLocal } from './localIntent';
import { intentEluLocalement } from './targetingModes';

/**
 * Le sort d'UNE action de l'allowlist chez l'invité, dans cet ordre :
 *  - ÉLECTION LOCALE (`intentEluLocalement`) : le clic n'ouvre qu'un CHOIX D'ÉCRAN — le paramètre borné qui reste à
 *    demander — et se joue ENTIER chez le client, par son action locale. Rien ne part : le porteur élu est hors
 *    instantané, l'exécuter chez l'hôte y ferait naître un panneau étranger et n'en montrerait aucun à l'émetteur ;
 *  - sinon l'émetteur PRÉPARE chez lui ce que l'hôte ne pose pas (`preparerLIntentLocal` : l'intention qu'arme une
 *    offre jouée chez l'hôte), puis l'intent PART, avec l'intention ARMÉE ICI (`argsAvecIntentionLocale`) : elle est
 *    locale au client, l'hôte ne peut pas la relire dans son propre état, il la juge.
 */
export function emettreIntentInvite(
  get: Get,
  name: string,
  local: (...args: unknown[]) => unknown,
  envoyer: (action: string, args: unknown[]) => void,
  args: unknown[],
): void {
  if (intentEluLocalement(get, name, args)) {
    local(...args);
    return;
  }
  preparerLIntentLocal(get, name, args);
  envoyer(name, argsAvecIntentionLocale(get, name, args));
}

/** Args JSON-sûrs pour un intent : les handlers React passent parfois l'ÉVÉNEMENT en argument
 *  (`onClick={action}`) — circulaire, il ferait échouer la sérialisation et PERDRAIT l'intent
 *  (bug trouvé à l'audit coop : « Appliquer » d'invité muet). On TRONQUE la queue non
 *  sérialisable (l'événement est toujours en dernier) sans toucher aux vrais arguments. */
export function sanitizeIntentArgs(args: unknown[]): unknown[] {
  const jsonSafe = (v: unknown) => {
    try {
      JSON.stringify(v);
      return true;
    } catch {
      return false;
    }
  };
  const out = [...args];
  while (out.length && (!jsonSafe(out[out.length - 1]) || typeof out[out.length - 1] === 'function')) out.pop();
  return out;
}

export function creerActionsDuReseau(get: Get, set: SetDesClesReservees) {
  let originaux: Partial<Jeu> | null = null;
  return {
    poserLeReseau: (net) => {
      if (net !== get().net) set({ net });
    },
    transmettreLesIntentions: (envoyer) => {
      if (originaux) return;
      const etat = get() as unknown as Record<string, unknown>;
      const sauves: Record<string, unknown> = {};
      const enrobes: Record<string, unknown> = {};
      for (const name of GUEST_INTENTS) {
        const fn = etat[name];
        if (typeof fn !== 'function') continue;
        const local = fn as (...args: unknown[]) => unknown;
        sauves[name] = local;
        enrobes[name] = (...args: unknown[]) =>
          emettreIntentInvite(get, name, local, (action, a) => envoyer(action, sanitizeIntentArgs(a)), args);
      }
      originaux = sauves as Partial<Jeu>;
      set(enrobes as Partial<Jeu>);
    },
    restaurerLesIntentions: () => {
      if (!originaux) return;
      set(originaux);
      originaux = null;
    },
  } satisfies FabriqueDuNoyau;
}

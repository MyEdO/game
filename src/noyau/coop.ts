/**
 * LA COOP sans hôte (#3041, L5-c) : le `build` comparé au `hello`, l'instantané qu'un hôte diffuse et son
 * application à l'état de jeu d'un invité. Le protocole et la session : `hote/coop/` ; le relay, les minuteries
 * et le store : la couture web (`state/netFlow.ts`).
 */
import { OPTIONAL_RULES, loadRuleOverrides, ruleOverrides } from '../engine/policy';
import { etatIdsConnus } from '../engine/conditions';
import { hash32 } from '../data/hash';
import { tableTotale } from '../lib/tableTotale';
import { etatInitialDuJeu, type EtatDeJeu } from './etat';
import { reposerPaquetDeCampagne } from './monde/registreDesScenes';
import { snapshotSave, packHouseRules, unpackHouseRules } from './persistance/save';
import { FORMAT_SAVE } from './persistance/formats.generated';

/** Le `build` comparé au `hello` (#1463 LD.1) : le FORMAT de l'état (`FORMAT_SAVE`) et l'empreinte des registres
 *  dont un instantané nomme les ids (règles optionnelles et leur forme, États connus). Deux clients qui divergent
 *  sur l'un ou l'autre sont refusés par le seul `format-mismatch` du handshake (`hote/coop/session.ts`). */
export function buildDeLaCoop(): string {
  const regles = OPTIONAL_RULES.flatMap((r) => [r.id, r.kind, (r.options ?? []).join('|'), r.min ?? '', r.max ?? '']);
  return `${FORMAT_SAVE}.${hash32(...regles, '§', ...etatIdsConnus()).toString(36)}`;
}

/** Les clés de `EtatDeJeu` LOCALES au client, hors instantané (spec HUD zone 4, spec HUD §1d, `refusVisible.ts`) :
 *  l'invité garde les siennes. */
export const LOCALES_AU_CLIENT = ['localIntent', 'dispelCarrierId', 'refus'] as const satisfies readonly (keyof EtatDeJeu)[];

/** L'instantané coop de `etat` (spec coop §3, spec v2 §5) : les clés de la sauvegarde (`snapshotSave`), le paquet de
 *  campagne réduit à son stub (ses scènes voyagent une fois au join, message `paquetDeCampagne`), sans `LOCALES_AU_CLIENT`,
 *  les règles maison de l'hôte jointes (`packHouseRules`). Sa forme est datée par `FORMAT_SAVE` (`buildDeLaCoop`). */
export function instantaneDeLaCoop(etat: EtatDeJeu): Record<string, unknown> {
  const data = snapshotSave(etat, 'net').data as unknown as Record<string, unknown>;
  const pc = data.pendingCampaign as EtatDeJeu['pendingCampaign'];
  const stub: EtatDeJeu['pendingCampaign'] = pc
    ? { id: pc.id, label: pc.label, scenes: [], startSceneId: pc.startSceneId, worldMap: null, projet: pc.projet }
    : null;
  data.pendingCampaign = stub;
  for (const k of LOCALES_AU_CLIENT) delete data[k];
  return packHouseRules(data, ruleOverrides());
}

/** Un instantané appliqué : l'état de jeu de l'invité, et ce que sa couture en tire pour son interface. */
export interface InstantaneApplique {
  etat: EtatDeJeu;
  /** `gameTime` recule : une autre partie (une partie n'avance que vers l'avant, `horloge.ts`). */
  neuve: boolean;
  /** La scène de l'hôte n'est plus celle de l'invité. */
  autreScene: boolean;
}

/** Applique l'instantané `data` à l'état `mien` d'un invité : l'invité adopte les règles maison de l'hôte
 *  (`loadRuleOverrides`), l'état de jeu de l'hôte est posé sur l'état initial du jeu, le paquet de campagne
 *  re-dérivé (`reposerPaquetDeCampagne`), et l'invité garde son identité réseau (mode, siège, liaison),
 *  `LOCALES_AU_CLIENT`, et son écran « créateur » pendant la composition d'équipe de l'hôte (son brouillon
 *  survit aux diffusions). */
export function appliquerLInstantane(data: Record<string, unknown>, mien: EtatDeJeu): InstantaneApplique {
  const { game, rules } = unpackHouseRules(data);
  if (rules) loadRuleOverrides(rules);
  const entrant = game as Partial<EtatDeJeu>;
  const locales = tableTotale(LOCALES_AU_CLIENT, (k) => mien[k]) as Pick<EtatDeJeu, (typeof LOCALES_AU_CLIENT)[number]>;
  const etat: EtatDeJeu = {
    ...etatInitialDuJeu(),
    ...entrant,
    ...reposerPaquetDeCampagne(entrant.campaignDoc),
    ...locales,
    ...(mien.screen === 'creator' && entrant.screen === 'party' ? { screen: 'creator' as const } : null),
    net: {
      ...(entrant.net ?? mien.net),
      mode: 'guest',
      mySeat: mien.net.mySeat,
      connection: mien.net.connection,
      hostAway: mien.net.hostAway,
    },
  };
  return {
    etat,
    neuve: (entrant.gameTime ?? mien.gameTime) < mien.gameTime,
    autreScene: (entrant.scene?.id ?? null) !== (mien.scene?.id ?? null),
  };
}

/**
 * LES EMPLACEMENTS RAPIDES (variante B de #3935, 2026-11-15) : les rangs `0…RANGS_RAPIDES-1` de la zone `capacites`
 * de la barre matérialisée (`materialiserLaBarre`), résolus contre les offres de l'actif (`offresDeLActif`). Lecture
 * pure : rien ne s'écrit ici. Une case pleine sans offre reste à son rang, refusée (fiche
 * `user-arbitrage-barre-materialisee-et-sans-pages`).
 */
import { ACTIONS, findSpellById, findTrappingById } from '../data/index';
import { garanti } from '../lib/garanti';
import { t } from '../i18n';
import { offreArmee, offresDeLActif, type Offre } from './actionRegistry';
import { CLE_DE_SORT, CLE_D_OBJET, RANGS_RAPIDES } from './dispositionConsole';
import type { IconId } from '../data/icons';
import type { SelecteurDAction } from '../data/schemas/defs/actions';
import type { Combatant, EntreeBarre } from '../engine/types';
import type { GesteDuNoyau } from './actionsDuNoyau';
import type { Jeu } from './etat';

/** Une case pleine : son entrée, le nom de ce qu'elle porte (le sort, l'objet, l'action), le sort qu'elle porte
 *  (`null` : un objet ou une action), le dessin de son action, le geste de son offre (`null` sans offre), son refus
 *  (`null` : elle se joue) et son état armé (`offreArmee`). */
export interface EmplacementRapide {
  entree: EntreeBarre;
  label: string;
  sort: string | null;
  icon: IconId;
  geste: GesteDuNoyau | null;
  refus: string | null;
  armee: boolean;
}

const actionDe = (e: EntreeBarre) => garanti(ACTIONS.find((a) => a.id === e.actionId), e.actionId, 'action de la case');

/** Le MODÈLE qu'une case désigne, par le genre de candidat que son action déclare (`ActionDef.candidates`) : le préfixe
 *  de sa clé, le nom du modèle, et le modèle que désigne une offre de cette action. */
interface Modele {
  prefixe: string;
  libelle: (id: string) => string | undefined;
  deLOffre: (o: Offre, heros: Combatant) => string | undefined;
}

const MODELES: Partial<Record<SelecteurDAction, Modele>> = {
  'sorts-du-heros': { prefixe: CLE_DE_SORT, libelle: (id) => findSpellById(id)?.label, deLOffre: (o) => o.args.spellId },
  consommables: { prefixe: CLE_D_OBJET, libelle: (id) => findTrappingById(id)?.label, deLOffre: (o, heros) => heros.items?.find((i) => i.uid === o.args.itemUid)?.trappingId },
};

const modeleDe = (e: EntreeBarre): Modele | undefined => {
  const candidats = actionDe(e).candidates;
  return candidats ? MODELES[candidats] : undefined;
};

/** Le nom de ce que la case porte : son modèle, sinon son action. */
function libelleDe(e: EntreeBarre): string {
  const m = modeleDe(e);
  return m ? garanti(m.libelle(e.cle.slice(m.prefixe.length)), e.cle, 'modèle de la case') : actionDe(e).label;
}

/** L'offre que la case désigne : celle de son action dont le modèle fait sa clé, sinon l'offre de son action. */
function offreDe(heros: Combatant, offres: readonly Offre[], e: EntreeBarre): Offre | undefined {
  const deLAction = offres.filter((o) => o.actionId === e.actionId);
  const m = modeleDe(e);
  return m ? deLAction.find((o) => `${m.prefixe}${m.deLOffre(o, heros)}` === e.cle) : deLAction[0];
}

/** Les emplacements rapides du héros actif `heros`, rang par rang : `null` pour une case libre ou vidée. */
export function emplacementsRapides(etat: Jeu, heros: Combatant): (EmplacementRapide | null)[] {
  const battle = garanti(etat.battle, heros.id, 'combat des emplacements rapides');
  const offres = offresDeLActif({ active: heros, battle, scene: etat.scene, netMode: etat.net.mode, gameTime: etat.gameTime, state: etat });
  const posees = heros.barre?.capacites ?? {};
  return Array.from({ length: RANGS_RAPIDES }, (_, i): EmplacementRapide | null => {
    const e = posees[i];
    if (!e) return null;
    const o = offreDe(heros, offres, e);
    return {
      entree: e,
      label: libelleDe(e),
      sort: e.cle.startsWith(CLE_DE_SORT) ? e.cle.slice(CLE_DE_SORT.length) : null,
      icon: actionDe(e).icon,
      geste: o?.geste ?? null,
      refus: o ? (o.gate.ok ? null : garanti(o.gate.reason, o.actionId, 'raison du refus de l’offre')) : t('rapides.plusEnMain'),
      armee: o ? offreArmee(etat, o.def, o.args) : false,
    };
  });
}

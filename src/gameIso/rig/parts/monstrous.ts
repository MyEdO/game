/**
 * Parts MONSTRUEUSES du rig — pour « construire son mutant » par slot, comme on
 * choisit la tête/le bras d'un PJ. Dessinées dans le repère LOCAL de l'os porteur
 * (mêmes conventions que cosmetic.ts / generic.ts) :
 *   - tête : repère de l'os `tete`, visage ≈ (0,7) r9 (remplace visage+cheveux).
 *   - bras : repère de l'os `epaule`, le membre descend en +y (~26-30), largeur ~6.
 *            Asymétrie native : on remplace UN seul bras (epauleG ou epauleD).
 *   - cornes/queue : calques (overlay) sur `tete` / `bassin` — FORME déclarée PAR la tête.
 * Aucune arme ici : l'arme reste de l'ÉQUIPEMENT (rendue par le rig si équipée).
 */
import type { View } from '../facing';
import type { BoneId, RigOverlay } from '../bones';
import { viewOrFront, type PartArt } from './types';
import { HEADS, ARMS, LEGS, HEAD_CORNES, HEAD_QUEUE } from './monster';
import { WINGS } from './wings';
import { dorsalOverlays } from './dorsal';
import { appendageArt } from './appendages';
// Art des calques NON-appendice : chacun est OWNED par son élément (`elements/defs/`), plus aucune
// string SVG inline. monsterInjection (flags m.griffes/plaie/verrues/cape/membresRouges) le compose.
import { GRIFFES_ART } from './elements/defs/griffes';
import { CROCS_ART } from './elements/defs/crocs';
import { PLAIE_ART } from './elements/defs/plaie';
import { VERRUES_ART } from './elements/defs/verrues';
import { BRAS_ROUGE_ART, CUISSE_ROUGE_ART, STRIES_ART } from './elements/defs/membres-rouges';

/** Sélection monstrueuse par slot (sur Appearance.monster). Tout est optionnel.
 *  Champs en `string` (libellés libres venant de la scène/éditeur) ; les lookups
 *  ci-dessous tolèrent une clé inconnue (→ ignorée). */
export interface MonsterParts {
  tete?: string;
  brasG?: string;
  brasD?: string;
  jambes?: string;
  cornes?: boolean;
  queue?: boolean;
  griffes?: boolean; // longues griffes aux mains (goule)
  verrues?: boolean; // peau verruqueuse + ventre pâle (troll) — casse l'aplat « blob »
  plaie?: boolean; // plaie de chair exposée (zombie)
  cape?: boolean; // col de cape dressé en éventail + crocs (vampire)
  membresRouges?: boolean; // bras/jambes rouge sang + stries au torse (démon bicolore)
  /** ailes repliées dans le dos — true = emplumées (harpie) ; 'cuir' = membrane (furie, démon). */
  ailes?: boolean | 'cuir';
}

export interface MonsterInjection {
  /** part par os (remplace la part normale de l'os) — orientée (front/back/profile). */
  replace: Partial<Record<BoneId, PartArt>>;
  /** calques additionnels. */
  overlays: RigOverlay[];
}

/** Traduit une sélection MonsterParts en surcharges par os + calques. Tolère les
 *  clés inconnues (ignorées) pour accepter les libellés libres de la scène.
 *  `view` : certains calques sont propres à une vue (les crocs du vampire = détail de FACE ;
 *  les dessiner de dos/de profil les ferait flotter sur la nuque ou hors du museau). */
export function monsterInjection(m: MonsterParts, view: View = 'front'): MonsterInjection {
  const replace: Partial<Record<BoneId, PartArt>> = {};
  const overlays: RigOverlay[] = [];
  const head = m.tete ? HEADS[m.tete] : undefined;
  const armG = m.brasG ? ARMS[m.brasG] : undefined;
  const armD = m.brasD ? ARMS[m.brasD] : undefined;
  const legs = m.jambes ? LEGS[m.jambes] : undefined;
  if (head) replace.tete = head;
  // Un bras monstrueux (pince, tentacule) intègre sa propre extrémité : on EFFACE le poing
  // générique de ce côté (sinon il flotte au milieu de la pince).
  if (armG) { replace.epauleG = armG; replace.mainG = ''; }
  if (armD) { replace.epauleD = armD; replace.mainD = ''; }
  if (legs) { replace.cuisseG = legs; replace.cuisseD = legs; } // 2 jambes (symétrique)
  // Cornes/queue : la FORME est DÉCLARÉE PAR la tête (monster/defs : `cornes`/`queue`) — bovine en V
  // pour taureau, noire de démon, ivoire de chèvre pour caprin/gobelin, rose de rat pour la queue —
  // sinon le calque GÉNÉRIQUE. Plus de name-matcher `m.tete === '…'` : donnée sur la part de tête.
  if (m.cornes) overlays.push({ bone: 'tete', svg: viewOrFront(appendageArt(HEAD_CORNES[m.tete ?? ''] ?? 'cornes-generique'), view), behind: true });
  if (m.queue) overlays.push({ bone: 'bassin', svg: viewOrFront(appendageArt(HEAD_QUEUE[m.tete ?? ''] ?? 'queue-generique'), view), behind: true });
  if (m.griffes) { overlays.push({ bone: 'mainG', svg: GRIFFES_ART }); overlays.push({ bone: 'mainD', svg: GRIFFES_ART }); }
  if (m.plaie) overlays.push({ bone: 'torse', svg: PLAIE_ART });
  if (m.verrues) overlays.push({ bone: 'torse', svg: VERRUES_ART });
  // Cape : le col haut est dans la TENUE Vampire (réutilisable) ; ici on ne garde que
  // les CROCS, détail de visage propre au vampire, en vue de FACE seulement (sinon ils flottaient
  // sur la nuque de dos / hors du museau de profil).
  if (m.cape && view === 'front') overlays.push({ bone: 'tete', svg: CROCS_ART });
  if (m.membresRouges) {
    overlays.push({ bone: 'epauleG', svg: BRAS_ROUGE_ART });
    overlays.push({ bone: 'epauleD', svg: BRAS_ROUGE_ART });
    overlays.push({ bone: 'cuisseG', svg: CUISSE_ROUGE_ART });
    overlays.push({ bone: 'cuisseD', svg: CUISSE_ROUGE_ART });
    overlays.push({ bone: 'torse', svg: STRIES_ART });
  }
  // Ailes : appendice DORSAL (règles de vue/profondeur codifiées par dorsalOverlays) —
  // monsterInjection composant PAR vue, on ne garde que le calque de la vue courante.
  if (m.ailes) {
    const set = m.ailes === 'cuir' ? WINGS.cuir : WINGS.plumes;
    overlays.push(...dorsalOverlays('torse', set).filter((o) => !o.view || o.view === view));
  }
  return { replace, overlays };
}

// Catalogues pour l'éditeur — DÉRIVÉS du registre monster/defs/ (1 part = 1 fichier).
export { MONSTER_HEAD_OPTIONS, MONSTER_ARM_OPTIONS, MONSTER_LEG_OPTIONS } from './monster';

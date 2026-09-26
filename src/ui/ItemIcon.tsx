import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ItemInstance, Weapon } from '../engine/types';
import { isCapeItem } from '../engine/items';
import { isConsumable } from '../engine/consumables';
import { weaponPart, armourPart, shieldPart, isShield, objetSansPorteur } from '../gameIso/rig/parts/equipment';
import { pickView } from '../gameIso/rig/parts/types';
import type { Slot } from '../gameIso/rig/bones';
import { defsGlobaux } from '../gameIso/sprites';
import { Icon } from './Icon';
import type { IconId } from './icons';

/**
 * Icône d'OBJET — primitive UNIQUE pour afficher une arme/armure/bouclier (silhouette SVG du rig,
 * cf. `weaponPart`/`armourPart`/`shieldPart`) ou un glyphe de catégorie (objets sans art). Réutilisée
 * par le Sac, l'onglet Combat de la fiche, les pickers `MediaSelect` et la hotbar de combat — il n'y a
 * PAS d'autre rendu d'objet autonome (l'ancien `ItemSkinPreview` ad-hoc est dissous ici).
 *
 * Cadrage carré : l'arme (manche à l'origine, lame vers -y) est tournée ~−40° puis recadrée serré sur
 * sa boîte englobante mesurée (`getBBox`) — affinage au navigateur AVANT peinture (`useLayoutEffect`),
 * repli par catégorie en SSR/test (jsdom n'implémente pas `getBBox`).
 */

type Geom = 'weapon' | 'shield' | 'armor';
/** `glyph` = id d'icône de catégorie (registre src/ui/icons, famille item/*) quand l'objet n'a pas d'art rig. */
type Resolved = { art: string; geom: Geom } | { glyph: IconId };

/** Ordre de préférence des emplacements pour l'aperçu d'une pièce d'armure (le torse = plus lisible). */
const ARMOUR_SLOTS: Slot[] = ['torse', 'tete', 'bras', 'jambes'];

/** Arme minimale pour le routage d'art (même recette que feu `ItemSkinPreview`) à partir d'un objet.
 *  Porte `shape` (id de FORME = routage de l'art), `skin`, `form` (+`subType`) — sans `shape` un
 *  ItemInstance retomberait sur l'art générique alors que l'arme dérivée (Weapon) l'a déjà. */
function asWeapon(item: ItemInstance): Weapon {
  return { label: item.label, type: item.kind === 'ranged' ? 'ranged' : 'melee', damage: { plusBF: false, flat: 0 }, qualities: item.qualities ?? [], skin: item.skin, form: item.form, shape: item.shape, subType: item.subType };
}

function resolve(item: ItemInstance | Weapon): Resolved {
  if ('kind' in item) {
    if (item.kind === 'armor') {
      for (const slot of ARMOUR_SLOTS) {
        const p = armourPart(item, slot); // null si l'item ne couvre pas ce slot → on essaie le suivant
        if (p) return { art: pickView(objetSansPorteur(p), 'front'), geom: 'armor' };
      }
      return { glyph: 'item/armour' };
    }
    if (item.kind === 'melee' || item.kind === 'ranged') {
      if (isShield(item)) { const a = pickView(objetSansPorteur(shieldPart(item)), 'front'); return a ? { art: a, geom: 'shield' } : { glyph: 'item/armour' }; }
      const a = pickView(objetSansPorteur(weaponPart(asWeapon(item))), 'front');
      return a ? { art: a, geom: 'weapon' } : { glyph: 'item/weapon' };
    }
    if (item.kind === 'ammo') return { glyph: 'item/ammo' };
    if (isCapeItem(item)) return { glyph: 'item/cloak' };
    if (isConsumable(item)) return { glyph: 'item/consumable' };
    return { glyph: 'item/misc' };
  }
  // `Weapon` (combat) : pas de champ `kind` — discriminant de l'union.
  if (isShield(item)) { const a = pickView(objetSansPorteur(shieldPart(item)), 'front'); return a ? { art: a, geom: 'shield' } : { glyph: 'item/armour' }; }
  const a = pickView(objetSansPorteur(weaponPart(item)), 'front');
  return a ? { art: a, geom: 'weapon' } : { glyph: 'item/weapon' };
}

const SIZE_PX = { sm: 24, md: 40, lg: 64 } as const;
type SizeKey = keyof typeof SIZE_PX;

/** ViewBox carré de repli par géométrie — seulement visible en SSR/test ; `getBBox` recadre serré au navigateur. */
const FALLBACK_VB: Record<Geom, string> = {
  weapon: '-58 -58 116 116',
  shield: '-18 -14 38 38',
  armor: '-39 -37 78 78',
};

// Mesure synchrone AVANT peinture au navigateur ; no-op silencieux en SSR/test (pas d'avertissement).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const ROTATE = -40; // arme en diagonale (look inventaire) ; boucliers/armures restent droits
/** Mémo des viewBox calculés par (art, rotation) — mesuré 1 fois, repeint sans flash ensuite. */
const VB_CACHE = new Map<string, string>();
const cacheKey = (art: string, rotate: boolean) => (rotate ? 'r:' : 'n:') + art;

export function ItemIcon({ item, size = 'sm' }: { item: ItemInstance | Weapon; size?: number | SizeKey }) {
  const r = resolve(item);
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  if ('glyph' in r) {
    return (
      <span className="item-icon item-icon-glyph" style={{ width: px, height: px, lineHeight: `${px}px` }} aria-hidden>
        <Icon id={r.glyph} size={Math.round(px * 0.72)} />
      </span>
    );
  }
  return <ArtIcon art={r.art} geom={r.geom} px={px} />;
}

function ArtIcon({ art, geom, px }: { art: string; geom: Geom; px: number }) {
  const rotate = geom === 'weapon';
  const gRef = useRef<SVGGElement>(null);
  const [vb, setVb] = useState(() => VB_CACHE.get(cacheKey(art, rotate)) ?? FALLBACK_VB[geom]);
  useIsoLayoutEffect(() => {
    const el = gRef.current;
    if (!el || typeof el.getBBox !== 'function') return; // SSR/jsdom : on garde le repli, jamais d'exception
    let next = VB_CACHE.get(cacheKey(art, rotate));
    if (!next) {
      const b = el.getBBox(); // bbox de l'art APRÈS sa rotation interne → cadrage serré direct
      if (!b || !isFinite(b.width) || b.width <= 0 || b.height <= 0) return;
      const pad = Math.max(b.width, b.height) * 0.08 + 1;
      const side = Math.max(b.width, b.height) + pad * 2;
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      next = `${(cx - side / 2).toFixed(2)} ${(cy - side / 2).toFixed(2)} ${side.toFixed(2)} ${side.toFixed(2)}`;
      VB_CACHE.set(cacheKey(art, rotate), next);
    }
    setVb(next);
  }, [art, rotate]);
  // `defsGlobaux()` injecté UNIQUEMENT si l'art réfère un id qu'il ne définit pas lui-même : un
  // dégradé dérivé `dg-` arrive avec sa propre définition (`applyTokenMap`, #1903 D2).
  const definis = new Set([...art.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const needsDefs = [...art.matchAll(/url\(#([^)]+)\)/g)].some((m) => !definis.has(m[1]));
  return (
    <svg className={`item-icon item-icon-${geom}`} viewBox={vb} width={px} height={px}
      style={{ background: '#222831', borderRadius: 4, flex: '0 0 auto' }} aria-hidden>
      {needsDefs && <defs dangerouslySetInnerHTML={{ __html: defsGlobaux() }} />}
      <g ref={gRef}>
        <g transform={rotate ? `rotate(${ROTATE})` : undefined} dangerouslySetInnerHTML={{ __html: art }} />
      </g>
    </svg>
  );
}

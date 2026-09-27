/**
 * Cœur d'inventaire d'un PORTEUR (#620 SOCLE POSSESSIONS T1-e, Lot 1b — « composer, pas dupliquer »,
 * #373). Extrait de la fiche héros (`CharacterSheet.tsx`) : la liste d'objets par groupe, la rangée
 * `PlaqueRow` (icône, libellé codex, stats mécaniques, Enc/remplissage, badges équipé/parure/non-
 * identifié) et les actions COMMUNES à tout porteur — Équiper/Porter, Ranger, Transférer, Parure,
 * Sortir — routées par `carrierId` (héros OU possession, `resolveCarrier`, Lot 1a #620).
 *
 * Les extensions HÉROS-ONLY (sets d'armes/mains, Évaluer/Détecter, Utiliser un consommable) restent
 * hors primitive : le slot `rowExtra` les injecte, l'appelant fournissant sa propre logique (armes
 * en main, jets, verrous de combat).
 */
import { useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { HitLocation, ItemInstance, Combatant } from '../engine/types';
import { isCapeItem, isWearable, containerFillEnc, canStow, armourLayer, itemLabel } from '../engine/items';
import { isConsumable } from '../engine/consumables';
import { possessionLabel } from '../engine/possession';
import { resolveCarrier, carriersCoLocated, type Carrier } from '../state/carrier';
import { weaponStatParts } from './weaponStats';
import { PlaqueRow } from './PlaqueRow';
import { ItemIcon } from './ItemIcon';
import { CodexRef } from './compendium/CodexRef';
import { Icon } from './Icon';
import { MediaSelect, type MediaOption } from './MediaSelect';
import { Band } from './Band';
import { CharFrame } from './CharFrame';
import { QualityChips } from './EntityChip';
import { resolveQualities } from '../engine/qualities/dispatch';
import { ColorPalettePickers } from './ColorPalettePickers';
import { prefixOf } from './PossessionsRegistry';
import { GatedAction } from './GatedAction';
import type { Palette } from '../gameIso/rig/palette';
import { projectionEditeur } from '../gameIso/rig/clesDePalette';

/** Raison UNIQUE du verrou d'équipement pendant un combat, partagée par les actions de sac. */
const VERROU_COMBAT = 'Équipement verrouillé en combat (seul le changement de set d’armes est permis).';

/** Emplacements de couleur d'un SKIN d'OBJET légendaire (`metal/cuir/accent` = slots de palette). */
const WEAPON_SKIN_SLOTS = projectionEditeur(['metal', 'cuir', 'accent'], {
  metal: 'Métal (lame / canon)', cuir: 'Bois & cuir', accent: 'Or & détails',
});
const ARMOUR_SKIN_SLOTS = projectionEditeur(['metal', 'cuir'], {
  metal: 'Métal (plaque / maille)', cuir: 'Cuir / rembourrage',
});
const skinSlotsFor = (kind: ItemInstance['kind']) => (kind === 'armor' ? ARMOUR_SKIN_SLOTS : WEAPON_SKIN_SLOTS);

const LOC_SHORT: Record<HitLocation, string> = {
  tete: 'Tête',
  brasG: 'Bras G',
  brasD: 'Bras D',
  corps: 'Corps',
  jambeG: 'Jambe G',
  jambeD: 'Jambe D',
};

export interface CarrierInventoryProps {
  /** id du porteur (héros `Combatant.id` OU possession `Possession.uid`) — routé par `resolveCarrier`. */
  carrierId: string;
  /** Objets du porteur (`hero.items` / `possession.items`). */
  items: ItemInstance[];
  /** Groupe pour le calcul mécanique des armes (BF du porteur) — `bonus(effectiveChar(hero,'force'))`
   *  côté héros ; 0 par défaut (porteur sans caractéristiques). */
  forceBonus?: number;
  /** Autre porteurs éligibles au « Donner » (typiquement le reste du groupe) — filtré de `carrierId`. */
  party?: Combatant[];
  /** Surbrillance « équipé/en main » d'une arme — défaut `it.equipped` (héros injecte `isWeaponActive`). */
  weaponHighlighted?: (it: ItemInstance) => boolean;
  /** Libellé de main portée d'une arme (« Main principale/secondaire ») — défaut aucun (« En main »). */
  weaponHandLabel?: (it: ItemInstance) => ReactNode | null;
  /** Extensions HÉROS-ONLY par objet (sets d'armes, Évaluer/Détecter, Utiliser un consommable),
   *  insérées AVANT les actions communes de la rangée. */
  rowExtra?: (it: ItemInstance, ctx: { inBattleNow: boolean; handLabel: ReactNode | null }) => ReactNode;
}

/** Groupes d'affichage du Sac (E3, langage du registre État) — chaque objet dans son PREMIER groupe. */
const GROUPS: { label: string; pred: (it: ItemInstance) => boolean }[] = [
  { label: 'Armes', pred: (it) => it.kind === 'melee' || it.kind === 'ranged' },
  { label: 'Armures & protections', pred: (it) => it.kind === 'armor' || isCapeItem(it) },
  { label: 'Consommables', pred: isConsumable },
  { label: 'Divers', pred: () => true },
];

export function CarrierInventory({
  carrierId,
  items,
  forceBonus = 0,
  party = [],
  weaponHighlighted,
  weaponHandLabel,
  rowExtra,
}: CarrierInventoryProps) {
  const toggleEquip = useGame((s) => s.toggleEquip);
  const stowItem = useGame((s) => s.stowItem);
  const transferItem = useGame((s) => s.transferItem);
  const setItemSkin = useGame((s) => s.setItemSkin);
  const inBattleNow = useGame((s) => !!s.battle);
  const possessions = useGame((s) => s.possessions);
  // Registre (#492 lot POSSESSIONS B) : un clic ÉLIT une seule rangée à la fois (ré-clic désélectionne).
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [skinOpenUid, setSkinOpenUid] = useState<string | null>(null);
  const carrier = { items };

  // Cibles « Donner » (#723) : héros ET possessions CO-LOCALISÉES avec le porteur source (`carriersCoLocated`,
  // MÊME invariant que la garde de `transferItem` — l'UI n'en est que le reflet, jamais une 2e vérité).
  const sourceCarrier = resolveCarrier({ party, possessions }, carrierId);
  const isCoLocated = (c: Carrier) => !!sourceCarrier && carriersCoLocated(sourceCarrier, c);
  const otherHeroes = party.filter((p) => p.id !== carrierId && isCoLocated({ kind: 'hero', hero: p }));
  const otherPossessions = possessions.filter(
    (p) => p.uid !== carrierId && !p.destroyed && isCoLocated({ kind: 'possession', possession: p }),
  );
  const otherCarriers = [...otherHeroes, ...otherPossessions];

  const itemStats = (it: ItemInstance): ReactNode => {
    // Objet non identifié : ses qualités sont MASQUÉES à l'affichage (elles restent actives au combat) ;
    // une identification RATÉE de beaucoup (ADE II) peut y ancrer de FAUSSES certitudes, affichées telles.
    const resolvedQuals = resolveQualities(it).map((r) => ({ id: r.id, value: r.indice }));
    const quals: ReactNode = it.identified === false
      ? (it.suspectedQualities?.length ? `soupçonné : ${it.suspectedQualities.join(', ')}` : null)
      : (resolvedQuals.length ? <QualityChips qualities={resolvedQuals} /> : null);
    if (it.kind === 'melee' || it.kind === 'ranged') {
      const mech = weaponStatParts(it, forceBonus).join(' · ');
      return <>{mech}{mech && quals ? ' · ' : ''}{quals}</>;
    }
    if (it.kind === 'armor')
      return [it.pa != null && `PA ${it.pa}`, (it.locs ?? []).map((l) => LOC_SHORT[l]).join(', '), `couche ${armourLayer(it)}`]
        .filter(Boolean)
        .join(' · ');
    return quals;
  };

  const renderRow = (it: ItemInstance, indent = false): ReactNode => {
    const isProsthesis = it.subType === 'protheses'; // prothèse (LDB 73, Groupe id) : se PORTE pour annuler un malus d'amputation
    const isCape = isCapeItem(it); // cape/manteau : emplacement Cape (cosmétique, onglet Combat)
    const consumable = isConsumable(it); // bandages / potion : utilisable depuis la fiche
    const equipable = isWearable(it) && !consumable; // armure/accessoire porté sur le corps (LDB 61) — pas une arme (tenue), pas un consommable
    // Rangement (LDB 64) : contenants où CET objet tient ; objet rangeable = ni contenant, ni déjà rangé, ≥1 sac dispo.
    const containers = it.container || it.inside ? [] : items.filter((i) => i.container && canStow(carrier, it, i.uid));
    const isWeaponItem = it.kind === 'melee' || it.kind === 'ranged';
    const handLabel = isWeaponItem ? (weaponHandLabel?.(it) ?? null) : null;
    // Surbrillance « équipé » : arme tenue dans le set ACTIF (défaut `it.equipped`) ; sinon armure portée.
    const highlighted = isWeaponItem ? (weaponHighlighted ? weaponHighlighted(it) : it.equipped) : it.equipped;
    const isSkinnable = it.kind === 'melee' || it.kind === 'ranged' || it.kind === 'armor';
    const skinned = !!it.skin && Object.keys(it.skin).length > 0;
    const selected = selectedUid === it.uid;
    const skinOpen = isSkinnable && skinOpenUid === it.uid;

    // Une vérité, un badge : équipé/en main · skin · non-identifié.
    const badges: ReactNode[] = [];
    if (highlighted) {
      badges.push(
        <span key="eq" className="chip tone-warn">
          {isWeaponItem ? (handLabel ?? 'En main') : it.kind === 'armor' ? 'Équipé' : 'Porté'}
        </span>,
      );
    }
    if (skinned) badges.push(<span key="skin" className="chip"><Icon id="action/cast" size="sm" /> Parure</span>);
    if (it.identified === false) {
      badges.push(
        <span key="unid" className="chip tone-warn" title="Évaluer (ou Détecter l'artefact) pour révéler ses qualités">
          {it.magicKnown ? (<><Icon id="action/cast" size="sm" /> Magique — non identifié</>) : (<><Icon id="nav/identify" size="sm" /> Non identifié</>)}
        </span>,
      );
    }

    return (
      <div key={it.uid} className="inv-item">
        <PlaqueRow
          valueMuted
          prefix={<ItemIcon item={it} size="sm" />}
          content={<CodexRef category="trappings" id={it.trappingId} label={itemLabel(it)} tooltipOnly>{itemLabel(it)}</CodexRef>}
          sub={itemStats(it)}
          meta={badges.length ? <>{badges}</> : undefined}
          value={it.container ? <>Enc {it.enc} · {containerFillEnc(carrier, it.uid)}/{it.container.capacity}</> : <>Enc {it.enc}</>}
          selected={selected}
          onClick={() => setSelectedUid(selected ? null : it.uid)}
          className={indent ? 'inv-item-nested' : undefined}
        />
        {selected && (
          <div className="inv-actionbar">
            {rowExtra?.(it, { inBattleNow, handLabel })}
            {equipable ? (
              <GatedAction
                id={`inv-equip-${it.uid}`}
                label={it.kind === 'armor' ? (it.equipped ? 'Équipé' : 'Équiper') : it.equipped ? 'Portée' : 'Porter'}
                enabled={!inBattleNow}
                reason={VERROU_COMBAT}
                descOfferte={isProsthesis ? 'Porter la prothèse (annule le malus d’amputation correspondant)' : isCape ? 'Porter la cape (cosmétique — visible dans le dos du héros)' : it.kind === 'misc' ? 'Porter (−1 Enc)' : undefined}
                onClick={() => toggleEquip(carrierId, it.uid)}
                primary={!!it.equipped}
                btnClassName="small"
              />
            ) : null}
            {isSkinnable && (
              <button
                className={`btn small ${skinOpen ? 'btn-primary' : ''}`}
                title="Parure légendaire — recolorer l'objet"
                onClick={() => setSkinOpenUid(skinOpen ? null : it.uid)}
              >
                <Icon id="action/cast" size="sm" /> Parure
              </button>
            )}
            {containers.length > 0 && !inBattleNow && (
              <MediaSelect
                align="right"
                triggerClassName="btn small"
                title="Ranger dans un contenant"
                trigger={<><Icon id="item/misc" size="sm" /> Ranger</>}
                options={containers.map((bag) => ({
                  key: bag.uid,
                  media: <ItemIcon item={bag} size="sm" />,
                  label: itemLabel(bag),
                  sub: `${containerFillEnc(carrier, bag.uid)}/${bag.container?.capacity ?? 0}`,
                }))}
                onSelect={(cid) => stowItem(carrierId, it.uid, cid)}
              />
            )}
            {otherCarriers.length > 0 && !inBattleNow && (
              <MediaSelect
                align="right"
                triggerClassName="btn small"
                title="Donner cet objet à un autre porteur"
                trigger={<><Icon id="action/pick-up" size="sm" /> Donner</>}
                options={otherCarriers.map(
                  (c): MediaOption =>
                    'uid' in c
                      ? { key: c.uid, media: prefixOf(c), label: possessionLabel(c) }
                      : { key: c.id, media: <CharFrame c={c} variant="identity" size="xs" />, label: c.label },
                )}
                onSelect={(cid) => transferItem(it.uid, carrierId, cid)}
              />
            )}
            {it.inside && (
              <GatedAction
                id={`inv-unstow-${it.uid}`}
                label="Sortir"
                enabled={!inBattleNow}
                reason={VERROU_COMBAT}
                descOfferte="Sortir du contenant"
                onClick={() => stowItem(carrierId, it.uid, null)}
                primary={false}
                btnClassName="small"
              />
            )}
          </div>
        )}
        {skinOpen && (
          <div className="inv-skin">
            <ItemIcon item={it} size="lg" />
            <div className="inv-skin-body">
              <ColorPalettePickers
                colors={it.skin as Palette | undefined}
                slots={skinSlotsFor(it.kind)}
                onColors={(patch) => setItemSkin(carrierId, it.uid, patch)}
              />
              {skinned && (
                <button className="btn small inv-skin-remove" onClick={() => setItemSkin(carrierId, it.uid, Object.fromEntries(skinSlotsFor(it.kind).map(([, s]) => [s, undefined])))}>
                  Retirer la parure
                </button>
              )}
            </div>
          </div>
        )}
        {it.container && (() => {
          const stowed = items.filter((i) => i.inside === it.uid);
          return stowed.length ? <div className="inv-nested">{stowed.map((s) => renderRow(s, true))}</div> : null;
        })()}
      </div>
    );
  };

  const partition: ItemInstance[][] = GROUPS.map(() => []);
  // Niveau supérieur = objets NON rangés ; les objets `inside` sont rendus IMBRIQUÉS sous leur contenant.
  for (const it of items.filter((i) => !i.inside)) {
    const gi = GROUPS.findIndex((g) => g.pred(it));
    partition[gi].push(it);
  }

  return (
    <div className="sheet-inventory">
      {items.length === 0 && <p className="muted">Aucun objet.</p>}
      {GROUPS.map((g, gi) => {
        const list = partition[gi];
        return list.length ? (
          <Band key={g.label} title={g.label} right={<b>{list.length}</b>}>
            <div className="inv-rows">{list.map((it) => renderRow(it))}</div>
          </Band>
        ) : null;
      })}
    </div>
  );
}

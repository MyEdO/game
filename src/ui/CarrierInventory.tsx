/**
 * Cœur d'inventaire d'un PORTEUR (#620 SOCLE POSSESSIONS T1-e, Lot 1b — « composer, pas dupliquer »,
 * #373). Extrait de la fiche héros (`CharacterSheet.tsx`) : la liste d'objets par groupe, la rangée
 * `PlaqueRow` (icône, libellé codex, stats mécaniques, Enc/remplissage, badges équipé/non-
 * identifié) et les actions COMMUNES à tout porteur — Équiper/Porter, Ranger, Transférer,
 * Sortir — routées par `carrierId` (héros OU possession, `resolveCarrier`, Lot 1a #620).
 *
 * Les extensions HÉROS-ONLY (sets d'armes/mains, Évaluer/Détecter, Utiliser un consommable) restent
 * hors primitive : le slot `rowExtra` les injecte, l'appelant fournissant sa propre logique (armes
 * en main, jets, verrous de combat).
 */
import { useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { HitLocation, ItemInstance } from '../engine/types';
import { isCapeItem, containerFillEnc, armourLayer, itemLabel } from '../engine/items';
import { isConsumable } from '../engine/consumables';
import { gestesDeLObjet, type GestesDeLObjet } from '../noyau/gestesDeLObjet';
import { weaponStatParts } from '../engine/weaponStats';
import { PlaqueRow } from './PlaqueRow';
import { ItemIcon } from './ItemIcon';
import { CodexRef } from './compendium/CodexRef';
import { Icon } from './Icon';
import { MediaSelect, type MediaOption } from './MediaSelect';
import { Band } from './Band';
import { CharFrame } from './CharFrame';
import { QualityChips } from './EntityChip';
import { resolveQualities } from '../engine/qualities/dispatch';
import { prefixOf } from './PossessionsRegistry';
import { GatedAction, raisonSi } from './GatedAction';

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
  /** BF du porteur pour le calcul mécanique des armes — `forceDuPorteur(hero)` côté héros ; nul par
   *  défaut (porteur sans caractéristiques). */
  force?: { bf: number; passif: number };
  /** Surbrillance « équipé/en main » d'une arme — défaut `it.equipped` (héros injecte `isWeaponActive`). */
  weaponHighlighted?: (it: ItemInstance) => boolean;
  /** Libellé de main portée d'une arme (« Main principale/secondaire ») — défaut aucun (« En main »). */
  weaponHandLabel?: (it: ItemInstance) => ReactNode | null;
  /** Extensions HÉROS-ONLY par objet (sets d'armes, Évaluer/Détecter, Utiliser un consommable), d'après ses gestes
   *  (`gestesDeLObjet`), insérées AVANT les actions communes de la rangée. */
  rowExtra?: (it: ItemInstance, gestes: GestesDeLObjet) => ReactNode;
}

/** Groupes d'affichage du Sac (E3, langage du registre État) — chaque objet dans son PREMIER groupe. */
const GROUPS: { label: string; pred: (it: ItemInstance) => boolean }[] = [
  { label: 'Armes', pred: (it) => it.kind === 'melee' || it.kind === 'distance' },
  { label: 'Armures & protections', pred: (it) => it.kind === 'armor' || isCapeItem(it) },
  { label: 'Consommables', pred: isConsumable },
  { label: 'Divers', pred: () => true },
];

export function CarrierInventory({
  carrierId,
  items,
  force = { bf: 0, passif: 0 },
  weaponHighlighted,
  weaponHandLabel,
  rowExtra,
}: CarrierInventoryProps) {
  const equiperLObjet = useGame((s) => s.equiperLObjet);
  const rangerLObjet = useGame((s) => s.rangerLObjet);
  const transmettreLObjet = useGame((s) => s.transmettreLObjet);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const possessions = useGame((s) => s.possessions);
  const gameTime = useGame((s) => s.gameTime);
  const scene = useGame((s) => s.scene);
  // Registre (#492 lot POSSESSIONS B) : un clic ÉLIT une seule rangée à la fois (ré-clic désélectionne).
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const carrier = { items };

  const itemStats = (it: ItemInstance): ReactNode => {
    // Objet non identifié : ses qualités sont MASQUÉES à l'affichage (elles restent actives au combat) ;
    // une identification RATÉE de beaucoup (ADE II) peut y ancrer de FAUSSES certitudes, affichées telles.
    const resolvedQuals = resolveQualities(it).map((r) => ({ id: r.id, value: r.indice }));
    const quals: ReactNode = it.identified === false
      ? (it.suspectedQualities?.length ? `soupçonné : ${it.suspectedQualities.join(', ')}` : null)
      : (resolvedQuals.length ? <QualityChips qualities={resolvedQuals} /> : null);
    if (it.kind === 'melee' || it.kind === 'distance') {
      const mech = weaponStatParts(it, force).join(' · ');
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
    const gestes = gestesDeLObjet({ battle, party, possessions, gameTime, scene }, carrierId, it.uid);
    const isWeaponItem = it.kind === 'melee' || it.kind === 'distance';
    const handLabel = isWeaponItem ? (weaponHandLabel?.(it) ?? null) : null;
    // Surbrillance « équipé » : arme tenue dans le set ACTIF (défaut `it.equipped`) ; sinon armure portée.
    const highlighted = isWeaponItem ? (weaponHighlighted ? weaponHighlighted(it) : it.equipped) : it.equipped;
    const selected = selectedUid === it.uid;

    // Une vérité, un badge : équipé/en main · non-identifié.
    const badges: ReactNode[] = [];
    if (highlighted) {
      badges.push(
        <span key="eq" className="chip tone-warn">
          {isWeaponItem ? (handLabel ?? 'En main') : it.kind === 'armor' ? 'Équipé' : 'Porté'}
        </span>,
      );
    }
    if (it.identified === false) {
      badges.push(
        <span key="unid" className="chip tone-warn" title="Évaluer (ou Détecter l'artefact) pour révéler ses qualités">
          {it.magicKnown ? (<><Icon id="action/incanter" size="sm" /> Magique — non identifié</>) : (<><Icon id="navigation/identifier" size="sm" /> Non identifié</>)}
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
        {selected && gestes && (
          <div className="inv-actionbar">
            {rowExtra?.(it, gestes)}
            {gestes.porter && (
              <GatedAction
                id={`inv-equip-${it.uid}`}
                label={it.kind === 'armor' ? (gestes.porter.porte ? 'Équipé' : 'Équiper') : gestes.porter.porte ? 'Portée' : 'Porter'}
                enabled={!gestes.porter.refus}
                {...raisonSi(gestes.porter.refus)}
                descOfferte={isProsthesis ? 'Porter la prothèse (annule le malus d’amputation correspondant)' : isCape ? 'Porter la cape (cosmétique — visible dans le dos du héros)' : it.kind === 'misc' ? 'Porter (−1 Enc)' : undefined}
                onClick={() => equiperLObjet(it.uid)}
                primary={false}
                ariaPressed={gestes.porter.porte}
                btnClassName="small"
              />
            )}
            {gestes.ranger?.refus && (
              <GatedAction id={`inv-stow-${it.uid}`} label={<><Icon id="objet/divers" size="sm" /> Ranger</>} enabled={false} {...raisonSi(gestes.ranger.refus)} onClick={() => {}} primary={false} btnClassName="small" />
            )}
            {gestes.ranger && !gestes.ranger.refus && (
              <MediaSelect
                align="right"
                triggerClassName="btn small"
                title="Ranger dans un contenant"
                trigger={<><Icon id="objet/divers" size="sm" /> Ranger</>}
                options={gestes.ranger.choix.map(({ cible: bag, libelle }) => ({
                  key: bag.uid,
                  media: <ItemIcon item={bag} size="sm" />,
                  label: libelle,
                  sub: `${containerFillEnc(carrier, bag.uid)}/${bag.container?.capacity ?? 0}`,
                }))}
                onSelect={(cid) => rangerLObjet(it.uid, cid)}
              />
            )}
            {gestes.donner?.refus && (
              <GatedAction id={`inv-give-${it.uid}`} label={<><Icon id="action/ramasser" size="sm" /> Donner</>} enabled={false} {...raisonSi(gestes.donner.refus)} onClick={() => {}} primary={false} btnClassName="small" />
            )}
            {gestes.donner && !gestes.donner.refus && (
              <MediaSelect
                align="right"
                triggerClassName="btn small"
                title="Donner cet objet à un autre porteur"
                trigger={<><Icon id="action/ramasser" size="sm" /> Donner</>}
                options={gestes.donner.choix.map(
                  ({ cible: c, libelle }): MediaOption =>
                    c.kind === 'possession'
                      ? { key: c.possession.uid, media: prefixOf(c.possession), label: libelle }
                      : { key: c.hero.id, media: <CharFrame c={c.hero} variant="identity" size="xs" decoratif />, label: libelle },
                )}
                onSelect={(cid) => transmettreLObjet(it.uid, cid)}
              />
            )}
            {gestes.sortir && (
              <GatedAction
                id={`inv-unstow-${it.uid}`}
                label="Sortir"
                enabled={!gestes.sortir.refus}
                {...raisonSi(gestes.sortir.refus)}
                descOfferte="Sortir du contenant"
                onClick={() => rangerLObjet(it.uid, null)}
                primary={false}
                btnClassName="small"
              />
            )}
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

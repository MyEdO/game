import { useGame } from '../state/store';
import type { Combatant, HitLocation, ItemInstance } from '../engine/types';
import { armourLayer, isCapeItem, itemLabel, weaponHands, compatibleAmmo, loadoutLabel, isOffHandEligible, isUnarmed, setADeuxMains, type ArmourLayer } from '../engine/items';
import { CodexRef } from './compendium/CodexRef';
import { QualityChips } from './EntityChip';
import { ItemIcon } from './ItemIcon';
import { MediaSelect, type MediaOption } from './MediaSelect';
import { bonus, effectiveChar } from '../engine/characteristics';
import { qualityRefLabel } from '../data';
import { weaponStatParts } from './weaponStats';
import { Icon } from './Icon';
import { Band } from './Band';
import { Grid } from './Layout';
import { GatedAction } from './GatedAction';
import { resolveQualities } from '../engine/qualities/dispatch';
import { objetSourceDeLArme } from '../engine/weaponLoad';

/** Raison UNIQUE du verrou des SETS d'armes pendant un combat. */
const VERROU_SETS = 'Équipement verrouillé en combat (changez de set depuis la barre d’action).';

/**
 * Écran d'EMPLACEMENTS d'équipement (onglet Possessions de la fiche) — façon jeu vidéo : colonne
 * d'emplacements d'armure en CELLULES-ICÔNES à gauche (une ligne par localisation Tête/Bras/
 * Corps/Jambes + Cape, trois cellules = les 3 COUCHES Ext./Flex./Soupl., LDB 63 : cuir souple
 * sous tout ; Flexible sous la couche rigide — les PA rigide+Flexible se cumulent) et les sets
 * d'armes en cellules à DROITE (pas de mannequin central : le rig grand format de la colonne de
 * fiche en tient lieu, #492). Le PA cumulé est affiché EN FACE de chaque localisation. Survol
 * d'une cellule → POPOVER (Codex de l'objet réel, ou stats + qualités pour une arme invoquée via
 * `fallback`) ; le CLIC sur la
 * cellule ouvre le picker changer/retirer (sauf cellule verrouillée : arme invoquée / combat).
 */

/** Zones de la fiche → localisations WFRP4. `apLoc` = localisation représentative pour le PA affiché. */
export const ZONES: { label: string; locs: HitLocation[]; apLoc: HitLocation }[] = [
  { label: 'Tête', locs: ['tete'], apLoc: 'tete' },
  { label: 'Bras', locs: ['brasG', 'brasD'], apLoc: 'brasG' },
  { label: 'Corps', locs: ['corps'], apLoc: 'corps' },
  { label: 'Jambes', locs: ['jambeG', 'jambeD'], apLoc: 'jambeG' },
];
const ZONE_OF_LOC: Partial<Record<HitLocation, string>> = { tete: 'Tête', brasG: 'Bras', brasD: 'Bras', corps: 'Corps', jambeG: 'Jambes', jambeD: 'Jambes' };

/** Couches : `label` plein (tooltip), `short` pour l'en-tête de colonne (cellules étroites). De gauche
 *  (extérieure, visible) à droite (intime). */
const LAYERS: { key: ArmourLayer; label: string; short: string; hint: string }[] = [
  { key: 'rigide', label: 'Extérieure', short: 'Rigide', hint: 'Couche rigide (cuir bouilli, plate…) — une seule pièce par zone.' },
  { key: 'flexible', label: 'Flexible', short: 'Flexible', hint: 'Mailles (Flexible) : portée sous une couche non Flexible, les PA des deux se cumulent.' },
  { key: 'souple', label: 'Souple', short: 'Souple', hint: 'Cuir souple : porté sans pénalité sous n’importe quelle autre armure — PA non cumulés sous une autre couche.' },
];

/** Zones couvertes par une pièce, pour l'indicateur multi-zones (« Bras+Corps »). */
function zonesOf(it: ItemInstance): string[] {
  const seen: string[] = [];
  for (const l of it.locs ?? []) {
    const z = ZONE_OF_LOC[l];
    if (z && !seen.includes(z)) seen.push(z);
  }
  return seen;
}

/** Qualités/atouts d'une arme en libellés lisibles (`resolveQualities` : propres + de FAMILLE, en libellés
 *  via `qualityRefLabel`). */
function weaponQualities(it: ItemInstance): string {
  return resolveQualities(it)
    .map((r) => qualityRefLabel({ id: r.id, value: r.indice }))
    .filter(Boolean)
    .join(', ');
}

/** Option « objet » (ItemIcon + libellé) d'un MediaSelect. Libellé d'armure = UN seul nœud
 *  (`nom · PA n[· zones]`) — lisible et indexable. */
const armourOpt = (it: ItemInstance): MediaOption => ({
  key: it.uid,
  media: <ItemIcon item={it} size="sm" />,
  label: `${itemLabel(it)} · PA ${it.pa ?? 0}${(it.locs?.length ?? 0) > 1 ? ` · ${zonesOf(it).join('+')}` : ''}`,
});
const weaponOpt = (w: ItemInstance): MediaOption => ({
  key: w.uid,
  media: <ItemIcon item={w} size="sm" />,
  label: `${itemLabel(w)}${weaponHands(w) === 2 ? ' (2M)' : ''}`,
});
const capeOpt = (c: ItemInstance): MediaOption => ({ key: c.uid, media: <ItemIcon item={c} size="sm" />, label: itemLabel(c) });

/** Corps du popover de stats (arme invoquée / hors-catalogue) : Dégâts résolus + Allonge/Portée
 *  (composeur partagé `weaponStatParts`) + qualités. */
function weaponStatsBody(it: ItemInstance, strBonus: number): string {
  return [...weaponStatParts(it, strBonus), weaponQualities(it)].filter(Boolean).join(' · ');
}

/**
 * Cellule-emplacement. Survol de l'icône → POPOVER : le Codex de l'objet (catalogue) ou, à défaut
 * (arme invoquée/enchantée), un `fallback` (stats + qualités) — toujours un popover, jamais de title
 * natif, et jamais d'ouverture de fiche au clic. Le CLIC ouvre le picker changer/retirer.
 * Une cellule FERMÉE (`refus`) compose `GatedAction` comme toute action refusée du jeu : elle DIT
 * pourquoi, au survol comme au focus, et reste atteignable (`aria-disabled`, jamais `disabled`). Sur
 * une cellule PLEINE la raison rejoint le popover DÉJÀ posé sur l'objet (`refus` de ce `CodexRef`) :
 * une seule infobulle par ancrage, d'où la forme `reasonId` et sa copie hors écran.
 */
function SlotCell({ id, nom, item, pa, fallback, options, value, onSelect, refus, desc }: {
  /** Id STABLE de la cellule — ancre de la copie accessible de sa raison. */
  id: string;
  /** Nom de l'emplacement (Corps, Cape, Main principale…) : nom accessible de la cellule. */
  nom: string;
  item?: ItemInstance;
  pa?: number;
  fallback?: { sub?: string; body?: string };
  options: MediaOption[];
  value: string;
  onSelect: (v: string) => void;
  /** RAISON de la fermeture de la cellule (verrou de combat, arme à deux mains…). Absente = ouverte. */
  refus?: string;
  /** Description de la cellule OUVERTE, portée en `title` du picker. */
  desc?: string;
}) {
  const rienAPorter = !options.some((o) => o.key);
  // Une cellule vide SANS candidat est fermée elle aussi — et le dit, plutôt que de rester muette.
  const refusCellule = refus ?? (!item && rienAPorter ? `Rien à porter à cet emplacement (${nom}).` : undefined);
  if (!item) {
    if (refusCellule) {
      return (
        <GatedAction
          id={id}
          label={<span className="eq-slot-plus" aria-hidden>·</span>}
          ariaLabel={`${nom} — emplacement vide`}
          enabled={false}
          reason={refusCellule}
          onClick={() => {}}
          primary={false}
          bare
          btnClassName="eq-slot disabled"
        />
      );
    }
    return (
      <MediaSelect
        options={options} value={value} onSelect={onSelect} title={desc}
        trigger={<span className="eq-slot-plus" aria-hidden>+</span>} triggerClassName="eq-slot empty"
      />
    );
  }
  const trigger = (
    <>
      <CodexRef category="trappings" id={item.trappingId} label={itemLabel(item)} className="eq-slot-icon" tooltipOnly fallback={fallback} refus={refusCellule}>
        <ItemIcon item={item} size="md" />
      </CodexRef>
      {pa != null && <span className="eq-slot-pa">{pa}</span>}
      {item.enchants?.length ? <span className="eq-slot-ench" title="Arme enchantée (effets actifs)">✦</span> : null}
    </>
  );
  // Verrouillée (arme invoquée / combat) : le popover de l'objet porte AUSSI la raison ; la cellule
  // reste atteignable et sa raison a sa copie hors écran.
  if (refusCellule) {
    return (
      <>
        <GatedAction
          id={id} reasonId={id} label={trigger} ariaLabel={`${nom} — ${itemLabel(item)}`}
          enabled={false} onClick={() => {}} primary={false} bare btnClassName="eq-slot filled locked"
        />
        <p className="hors-ecran" id={id}>{refusCellule}</p>
      </>
    );
  }
  return (
    <MediaSelect
      options={options} value={value} onSelect={onSelect} title="Changer / retirer"
      trigger={trigger} triggerClassName="eq-slot filled"
    />
  );
}

export function EquipmentPanel({ hero }: { hero: Combatant }) {
  const toggleEquip = useGame((s) => s.toggleEquip);
  const setLoadoutSlot = useGame((s) => s.setLoadoutSlot);
  const setActiveLoadout = useGame((s) => s.setActiveLoadout);
  const createLoadout = useGame((s) => s.createLoadout);
  const deleteLoadout = useGame((s) => s.deleteLoadout);
  const inBattle = useGame((s) => !!s.battle);

  const items = hero.items ?? [];
  const armours = items.filter((i) => i.kind === 'armor' && (i.locs?.length ?? 0) > 0);
  const capes = items.filter(isCapeItem);
  const wornCape = capes.find((i) => i.equipped);
  const weapons = items.filter((i) => (i.kind === 'melee' || i.kind === 'ranged') && !i.destroyed);
  // Main SECONDAIRE (LDB 14 l.138) : armes de mêlée à une main OU pistolets seulement (pas d'arc/arbalète ordinaire).
  const offHandWeapons = weapons.filter(isOffHandEligible);
  const strBonus = bonus(effectiveChar(hero, 'force'));

  const activeWeapons = hero.weapons.filter((w) => !isUnarmed(w));

  /** `fallback` popover d'une arme (stats + qualités) — sert l'invoquée/enchantée hors catalogue. */
  const weaponFallback = (it?: ItemInstance, conjured?: boolean) =>
    it ? { sub: conjured ? 'Arme invoquée' : undefined, body: weaponStatsBody(it, strBonus) } : undefined;

  return (
    <Grid cols={2} stackBelow={900} gap="lg" className="equip-panel">
      {/* COLONNE GAUCHE — emplacements d'armure en cellules, PA cumulé en face de chaque localisation */}
      <Band title="Harnois">
      <div className="equip-slots">
        <div className="eq-layers-head">
          <span className="eq-loc-spacer">Couche</span>
          {LAYERS.map((l) => <span key={l.key} className="eq-layer-col" title={`${l.label} — ${l.hint}`}>{l.short}</span>)}
        </div>

        {ZONES.map((z) => {
          const covering = armours.filter((i) => (i.locs ?? []).some((l) => z.locs.includes(l)));
          const ap = hero.armour[z.apLoc];
          return (
            <div className="eq-loc-row" key={z.label}>
              <span className="eq-loc-head">
                <span className="eq-loc-name">{z.label}</span>
                <span className="eq-loc-pa" data-pa={ap > 0 ? 'oui' : undefined} title="Points d'Armure de la zone (couches rigide + Flexible cumulées, mutations comprises)">PA {ap}</span>
              </span>
              {LAYERS.map((layer) => {
                const worn = covering.find((i) => i.equipped && armourLayer(i) === layer.key);
                const candidates = covering.filter((i) => !i.equipped && armourLayer(i) === layer.key);
                const netPa = worn ? Math.max(0, (worn.pa ?? 0) - (worn.damageTaken ?? 0)) : undefined;
                return (
                  <SlotCell
                    key={layer.key}
                    id={`eq-slot-${layer.key}`}
                    nom={layer.label}
                    item={worn}
                    pa={netPa}
                    value={worn?.uid ?? ''}
                    refus={inBattle ? VERROU_SETS : undefined}
                    desc={`${layer.label} — équiper`}
                    options={[{ key: '', label: '— retirer —', disabled: !worn }, ...candidates.map(armourOpt)]}
                    onSelect={(v) => toggleEquip(hero.id, v || worn!.uid)}
                  />
                );
              })}
            </div>
          );
        })}

        {/* Ligne Cape (cosmétique — rendue sur le rig de la colonne de fiche) */}
        <div className="eq-loc-row eq-loc-cape">
          <span className="eq-loc-head">
            <span className="eq-loc-name">Cape</span>
            <span className="eq-loc-pa" title="Purement cosmétique — aucun effet de règles"><Icon id="action/cast" size="sm" /></span>
          </span>
          <SlotCell
            id="eq-slot-cape"
            nom="Cape"
            item={wornCape}
            value={wornCape?.uid ?? ''}
            refus={inBattle ? VERROU_SETS : undefined}
            desc="Équiper une cape"
            options={[{ key: '', label: '— retirer —', disabled: !wornCape }, ...capes.filter((c) => !c.equipped).map(capeOpt)]}
            onSelect={(v) => toggleEquip(hero.id, v || wornCape!.uid)}
          />
        </div>
      </div>
      </Band>

      {/* COLONNE DROITE — sets d'armes auto-étiquetés par leur contenu (façon Dragon Age) + récap */}
      <Band title="Sets d’armes">
      <div className="equip-sets">
        {(hero.loadouts ?? []).map((lo) => {
          const conjured = !!(hero.items ?? []).find((it) => it.uid === lo.main)?.conjured;
          const setActive = hero.activeLoadoutId === lo.id;
          const mainItem = weapons.find((w) => w.uid === lo.main);
          const offItem = weapons.find((w) => w.uid === lo.off);
          const mainTwoHanded = setADeuxMains(hero, lo);
          const canDelete = !conjured && (hero.loadouts?.length ?? 0) > 1; // garder ≥1 set
          return (
            <div key={lo.id} className={`set-card ${setActive ? 'active' : ''} ${conjured ? 'conjured' : ''}`}>
              <div className="set-card-head">
                <span className="set-card-name">{loadoutLabel(lo, hero)}</span>
                {conjured && <span className="lo-name" title="Arme invoquée (auto-gérée)">✦</span>}
              </div>
              <div className="set-card-body">
                <div className="set-card-slots">
                  <div className="set-slot">
                    <SlotCell
                      id={`eq-slot-${lo.id}-main`}
                      nom="Main principale"
                      item={mainItem}
                      fallback={weaponFallback(mainItem, conjured)}
                      refus={conjured ? 'Arme invoquée — le sort la gère, elle ne se change pas à la main.' : inBattle ? VERROU_SETS : undefined}
                      value={lo.main ?? ''}
                      desc="Main principale — choisir une arme"
                      options={[{ key: '', label: '— mains nues —' }, ...weapons.map(weaponOpt)]}
                      onSelect={(v) => setLoadoutSlot(hero.id, lo.id, 'main', v || null)}
                    />
                    <span className="set-slot-cap">Principale</span>
                  </div>
                  <div className="set-slot">
                    <SlotCell
                      id={`eq-slot-${lo.id}-off`}
                      nom="Seconde main"
                      item={offItem}
                      fallback={weaponFallback(offItem, conjured)}
                      refus={mainTwoHanded ? 'Arme à deux mains — pas de seconde main.' : conjured ? 'Arme invoquée — le sort la gère, elle ne se change pas à la main.' : inBattle ? VERROU_SETS : undefined}
                      value={lo.off ?? ''}
                      desc="2nde — arme de mêlée à une main, bouclier ou pistolet"
                      options={[{ key: '', label: mainTwoHanded ? '— (2 mains) —' : '— vide —' }, ...offHandWeapons.filter((w) => w.uid !== lo.main).map(weaponOpt)]}
                      onSelect={(v) => setLoadoutSlot(hero.id, lo.id, 'off', v || null)}
                    />
                    <span className="set-slot-cap">2nde <CodexRef category="regles" id="main-secondaire" label="Attaque de la main secondaire" className="off-malus">−20</CodexRef></span>
                  </div>
                </div>
                <span className="set-card-actions">
                  {/* Actif = un ÉTAT (chip), pas une action à répéter — seul le set INACTIF porte le
                      bouton « Activer » (juge vision 2026-07-17). */}
                  {setActive ? (
                    <span className="chip tone-warn" title="Set actif (armes en main)">
                      <Icon id="ui/done" size="sm" /> Actif
                    </span>
                  ) : (
                    <GatedAction
                      id={`loadout-activate-${lo.id}`}
                      label="Activer"
                      enabled={!inBattle}
                      reason={VERROU_SETS}
                      onClick={() => setActiveLoadout(hero.id, lo.id)}
                      primary={false}
                      btnClassName="small"
                    />
                  )}
                  {canDelete && (
                    <GatedAction
                      id={`loadout-delete-${lo.id}`}
                      label={<Icon id="ui/delete" size="sm" />}
                      ariaLabel="Supprimer ce set"
                      enabled={!inBattle}
                      reason={VERROU_SETS}
                      onClick={() => deleteLoadout(hero.id, lo.id)}
                      primary={false}
                      btnClassName="small"
                    />
                  )}
                </span>
              </div>
            </div>
          );
        })}
        {(hero.loadouts?.length ?? 0) < 3 && (
          <GatedAction
            id="loadout-add"
            label="+ Set d’armes"
            enabled={!inBattle}
            reason={VERROU_SETS}
            onClick={() => createLoadout(hero.id)}
            primary={false}
            btnClassName="small set-add"
          />
        )}

        {/* Récap des armes EN MAIN du set actif (Dégâts effectifs, qualités/effets, munitions) */}
        <div className="eq-active-weapons">
          <span className="mini-title">En main</span>
          {activeWeapons.length === 0 ? (
            <span className="muted">Mains nues</span>
          ) : (
            activeWeapons.map((w, i) => {
              const ammo = w.type === 'ranged' ? compatibleAmmo(hero, w).reduce((s, a) => s + (a.qty ?? 0), 0) : null;
              return (
                <div className="weap" key={i}>
                  <ItemIcon item={w} size="sm" />
                  <span className="weap-text">
                    <CodexRef category="trappings" id={objetSourceDeLArme(hero, w)?.trappingId} label={w.label}>{w.label}</CodexRef>{' '}
                    <em>{weaponStatParts(w, strBonus).join(' · ')}</em>
                    {(() => {
                      const resolved = resolveQualities(w);
                      return resolved.length > 0 && (
                        <span className="weap-quals"> · <QualityChips qualities={resolved.map((r) => ({ id: r.id, value: r.indice }))} /></span>
                      );
                    })()}
                    {ammo != null && <span className="eq-ammo" title="Munitions compatibles dans le sac"> · <Icon id="item/ammo" size="sm" /> Munitions {ammo}</span>}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
      </Band>
    </Grid>
  );
}

/**
 * Écran Codex — référentiel browsable des règles/lore (pièce maîtresse).
 * Master-détail : familles (`Tabs`) → catégories (pastilles `.chip` + `.count`) →
 * liste (groupée si hiérarchie : Classe→Carrières, famille→Races, dossier→Créatures…) → fiche
 * RICHE (`CodexEntry` : sections + liens cross-réf). Ouverture ciblée via `store.openCodex(...)`,
 * qui porte aussi l'« instance » paramétrée (« 8 Tentacules +8 ») montrée en tête de fiche.
 */
import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../state/store';
import { Modal } from '../Modal';
import { CODEX, CODEX_GROUPS, categoriesIn, categoryByKey, clustersIn, codexItemKey, type CodexCategory, type CodexGroup, type CodexItem } from './registry';
import type { CodexFocus } from '../../state/codexFocus';
import { useVersionDesDatasets } from '../useVersionDesDatasets';
import { filterItems, facetValues, type FacetSelection } from './search';
import { CodexEntry } from './CodexEntry';
import { CodexEdit, isEditableCategory } from './CodexEdit';
import { useAtelierMode, setAtelierMode } from './atelierMode';
import { Icon } from '../Icon';
import { MasterDetail } from '../MasterDetail';
import { SourceBadge } from '../SourceBadge';
import { ListRow } from '../ListRow';
import { Tabs } from '../Tabs';
import { Row } from '../Layout';

/** Clé de navigation d'un `CodexFocus` (identité qualifiée `category+id`) — le focus PORTE l'id. */
const focusItemKey = (focus: CodexFocus | null | undefined): string | null =>
  focus ? codexItemKey(focus.category, focus.id) : null;

export function CompendiumScreen({ focus: focusProp }: {
  /** Présent : drill-in EN MODALE (`CodexOverlay`), dont le cadre porte la croix (`CadreFermer`). */
  focus?: CodexFocus | null;
} = {}) {
  const setScreen = useGame((s) => s.setScreen);
  const focusStore = useGame((s) => s.compendiumFocus);
  const back = useGame((s) => s.compendiumReturn);
  // En MODALE (drill-in : `focusProp` fourni) le focus vient de la prop et la fermeture du cadre ;
  // en ÉCRAN plein (depuis le menu) ils viennent du store.
  const enModale = focusProp !== undefined;
  const focus = enModale ? focusProp : focusStore;

  // État initial : si on a été ouvert sur une entrée précise, s'y poser ; sinon 1re catégorie.
  const initialCat = (focus && categoryByKey(focus.category)) || CODEX[0];
  const [group, setGroup] = useState<CodexGroup>(initialCat.group);
  const [catKey, setCatKey] = useState<string>(initialCat.key);
  const [picked, setPicked] = useState<string | null>(focusItemKey(focus));
  const [q, setQ] = useState('');
  const [facetSel, setFacetSel] = useState<FacetSelection>({});
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  // Mode ATELIER (édition des fiches) : bascule persistante et découvrable — l'éditabilité est un pilier
  // produit, jamais derrière un flag de build. OFF par défaut : la vue joueur n'expose aucune affordance DEV.
  const atelier = useAtelierMode();

  // Un clic de cross-référence (ou une ouverture externe) change `compendiumFocus` alors que
  // l'écran est DÉJÀ monté → on s'y déplace (les initialiseurs useState ne re-lisent pas le focus).
  useEffect(() => {
    if (!focus) return;
    const fc = categoryByKey(focus.category);
    if (!fc) return;
    setGroup(fc.group);
    setCatKey(fc.key);
    setPicked(focusItemKey(focus));
    setQ('');
    setFacetSel({}); // une facette cochée pourrait masquer l'entrée ciblée
  }, [focus]);

  // Fraîcheur : re-rend (et invalide les memos sur `cat.items`) après un persist de `CodexEdit`
  // (écriture au seam des datasets → les getters `items`/`facets` re-projettent la donnée persistée).
  const version = useVersionDesDatasets();
  const cats = useMemo(() => categoriesIn(group), [group]);
  // Barre de catégories : pastilles À PLAT + sous-groupes repliables (`cluster`) — anti-avalanche
  // des familles touffues (Effets/Tables). Ordre de déclaration préservé (`clustersIn`).
  const { flat: flatCats, clusters } = useMemo(() => clustersIn(group), [group]);
  const cat = categoryByKey(catKey) ?? cats[0];
  // Clé de navigation d'une entrée = identité qualifiée `category+id` (`codexItemKey`), jamais le label nu.
  const itemKey = (it: CodexItem): string => codexItemKey(cat?.key ?? '', it.id);
  const focusKey = focusItemKey(focus);
  // Repli par cluster : fermé par défaut ; s'ouvre si la catégorie active y vit (arrivée par cross-réf),
  // ou selon le dernier toggle utilisateur (mémorisé par nom, tant que l'écran est monté).
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const list = useMemo(() => filterItems(cat?.items ?? [], q, cat?.facets ?? [], facetSel), [cat, q, facetSel, version]);
  // Facettes de la catégorie : valeurs dérivées des items, avec COMPTEUR LIVE — chaque compte est
  // calculé sous la recherche + les AUTRES facettes (faceting standard) ; une facette à valeur
  // unique n'apporte rien → masquée.
  const facetRows = useMemo(
    () =>
      (cat?.facets ?? [])
        .map((facet) => ({
          facet,
          values: facetValues(filterItems(cat!.items, q, cat!.facets ?? [], { ...facetSel, [facet.key]: [] }), facet),
        }))
        .filter((r) => r.values.length > 1),
    [cat, q, facetSel, version],
  );
  const toggleFacet = (key: string, value: string) =>
    setFacetSel((s) => {
      const cur = s[key] ?? [];
      return { ...s, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  // Jamais d'état vide : à défaut de sélection valide dans la liste filtrée, on montre la 1re.
  const selected = list.find((it) => itemKey(it) === picked) ?? list[0] ?? null;
  // Instance paramétrée du lien d'ouverture (« 8 Tentacules +8 ») — seulement sur l'entrée ciblée.
  const instance = selected && focus?.instance && itemKey(selected) === focusKey ? focus.instance : undefined;
  // Revenir en mode lecture dès qu'on change d'entrée ou de catégorie (édition DEV ponctuelle).
  useEffect(() => setEditing(false), [selected?.label, cat?.key]);
  useEffect(() => setCreating(false), [cat?.key]); // abandonner la création en changeant de catégorie

  // Hiérarchie (Axe 3) : groupe les entrées si la catégorie en porte (famille/classe/dossier/parent).
  const grouped = useMemo(() => {
    if (!list.some((it) => it.group)) return null;
    const map = new Map<string, CodexItem[]>();
    for (const it of list) {
      const g = it.group ?? '—';
      const arr = map.get(g) ?? [];
      arr.push(it);
      map.set(g, arr);
    }
    return [...map.entries()];
  }, [list]);

  const pickGroup = (g: CodexGroup) => {
    setGroup(g);
    setCatKey(categoriesIn(g)[0]?.key);
    setPicked(null);
    setQ('');
    setFacetSel({});
  };
  const pickCat = (key: string) => {
    setCatKey(key);
    setPicked(null);
    setQ('');
    setFacetSel({});
  };

  const renderChip = (c: CodexCategory) => (
    <button key={c.key} className={`chip codex-cat${c.key === catKey ? ' on' : ''}`} onClick={() => pickCat(c.key)}>
      {c.label}
      <span className="count">{c.items.length}</span>
    </button>
  );

  const renderRow = (it: CodexItem, key: string) => (
    <ListRow
      key={key}
      variant="codex"
      selected={!!selected && itemKey(selected) === itemKey(it)}
      onClick={() => setPicked(itemKey(it))}
      label={it.label}
    >
      {it.source && <span className="codex-row-src">{it.source.book}</span>}
    </ListRow>
  );

  return (
    <div className="screen codex">
      <header className="codex-top">
        {/* Plein écran : « ← Retour » et le titre. En modale, le titre et la croix sont la tête du cadre. */}
        {!enModale && <button className="btn small" onClick={() => setScreen(back)}>← Retour</button>}
        {!enModale && <h1 className="codex-h1"><Icon id="nav/compendium" size="sm" /> Compendium</h1>}
        <div className="codex-groups">
          <Tabs
            label="Groupes du Codex"
            tabs={CODEX_GROUPS.map((g) => ({ key: g, label: g }))}
            active={group}
            onChange={pickGroup}
          />
        </div>
        {/* Bascule ATELIER (édition des fiches) — composée sur la primitive `.btn` (état ON = `aria-pressed`). Découvrable, sobre ; désactiver ferme toute édition en cours. */}
        <button
          className="btn small"
          aria-pressed={atelier}
          onClick={() => { if (atelier) { setEditing(false); setCreating(false); } setAtelierMode(!atelier); }}
          title="Mode atelier : éditer les fiches du Compendium"
        >
          <Icon id="ui/edit" size="sm" /> Atelier
        </button>
      </header>

      <Row className="codex-cats">
        {flatCats.map(renderChip)}
        {clusters.map((cl) => {
          const hasActive = cl.cats.some((c) => c.key === catKey);
          const open = manualOpen[cl.id] ?? hasActive;
          return (
            <details
              key={cl.id}
              className="fold"
              style={{ flexBasis: '100%' }}
              open={open}
              onToggle={(e) => {
                // `toggle` ne bulle pas (spec HTML) : React l'écoute en DIRECT sur le nœud, hors du
                // flush synchrone du batching d'événement délégué — le natif nullifie `currentTarget`
                // à la fin du `dispatchEvent`, AVANT que le rendu suivant applique cet updater. Capturer
                // la valeur ICI (synchrone), jamais la déréférencer depuis le corps du updater `setState`.
                const nowOpen = e.currentTarget.open;
                setManualOpen((m) => ({ ...m, [cl.id]: nowOpen }));
              }}
            >
              <summary>
                <span className="fold-title">{cl.label}</span>
                <span className="count">{cl.cats.length}</span>
              </summary>
              <Row className="fold-body codex-cats">{cl.cats.map(renderChip)}</Row>
            </details>
          );
        })}
      </Row>

      <MasterDetail
        className="codex-md"
        listLabel="Entrées du Codex"
        list={
          <div className="codex-aside panel flush">
            {/* Réf de source de la CATÉGORIE (table entière) — hors du libellé JOUEUR, en chip discret. */}
            {cat?.sourceRef && (
              <div className="codex-facets">
                <span className="codex-facet-label section-label">Source</span>
                <SourceBadge source={cat.sourceRef} />
              </div>
            )}
            {facetRows.map(({ facet, values }) => (
              <div className="codex-facets" key={facet.key}>
                <span className="codex-facet-label section-label">{facet.label}</span>
                {values.map(({ value, count }) => {
                  const on = (facetSel[facet.key] ?? []).includes(value);
                  return (
                    <button key={value} className={`chip codex-facet${on ? ' on' : ''}`} onClick={() => toggleFacet(facet.key, value)}>
                      {value}
                      <span className="count">{count}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            <input
              className="codex-search"
              type="search"
              placeholder={`Rechercher dans ${cat?.label ?? ''}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Rechercher dans le Codex"
            />
            <div className="codex-rows">
              {/* Liste TOUJOURS plate (aspect cohérent entre catégories) ; les hiérarchies n'ajoutent
                  qu'un séparateur léger par groupe (muet, collant), pas une structure différente. */}
              {grouped
                ? grouped.flatMap(([g, items]) => [
                    <div key={`grp-${g}`} className="codex-grouplbl">
                      <span>{g}</span>
                      <span className="count">{items.length}</span>
                    </div>,
                    ...items.map((it, i) => renderRow(it, `${g}-${it.label}-${i}`)),
                  ])
                : list.map((it, i) => renderRow(it, `${it.label}__${i}`))}
              {list.length === 0 && <div className="codex-noresult">Aucun résultat</div>}
            </div>
          </div>
        }
        detail={
          <section className="codex-detail panel">
            {atelier && cat && isEditableCategory(cat.key) && !creating && (
              <div className="codex-detail-actions">
                {selected && (
                  <button className="btn small" onClick={() => setEditing((v) => !v)}>
                    {editing ? '↩︎ Voir la fiche' : <><Icon id="ui/edit" size="sm" /> Éditer</>}
                  </button>
                )}
                <button className="btn small" onClick={() => { setEditing(false); setCreating(true); }}><Icon id="ui/add" size="sm" /> Nouveau</button>
              </div>
            )}
            {creating && atelier && cat && isEditableCategory(cat.key)
              ? <CodexEdit categoryKey={cat.key} isNew onClose={() => setCreating(false)} />
              : selected && editing && atelier && cat && isEditableCategory(cat.key)
                ? <CodexEdit categoryKey={cat.key} id={selected.id} onClose={() => setEditing(false)} />
                : selected && <CodexEntry item={selected} instance={instance} category={cat?.key} exergues={cat?.exergues} />}
          </section>
        }
      />
    </div>
  );
}

/** Drill-in d'une réf Codex EN JEU : la fiche s'ouvre en MODALE par-dessus la partie — l'écran,
 *  la musique et la fiche perso restent intacts derrière (cf. `openCodex`). Boîte vaste de `Modal`
 *  (Échap ferme la modale du dessus, piège de focus) ; le contenu est le MÊME `CompendiumScreen`
 *  (zéro renderer dupliqué), paramétré par `focus` ; le titre et la croix (`croix`) forment la tête
 *  du cadre, seul en-tête de la fenêtre. */
export function CodexOverlay() {
  const focus = useGame((s) => s.codexOverlay);
  const close = useGame((s) => s.closeCodexOverlay);
  if (!focus) return null;
  return (
    <Modal title={<><Icon id="nav/compendium" size="sm" /> Compendium</>} kind="codex" taille="vaste" className="codex-modal" onClose={close} croix backdropClose>
      <CompendiumScreen focus={focus} />
    </Modal>
  );
}

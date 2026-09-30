/** Rendu d'une fiche du Codex (détail) : en-tête + faits + prose + SECTIONS riches (statbloc,
 *  niveaux de carrière, bénédictions…) dont les entités citées sont des liens `CodexRef`. */
import type { CodexItem, CodexRow, CodexSection } from './registry';
import { EntityRef, ChoiceChips, PlainChip } from '../EntityChip';
import { CodexRef } from './CodexRef';
import { CreaturePreview } from './CreaturePreview';
import { TabbedEntry, type EntryTab } from '../TabbedEntry';
import { OrnateFrame } from '../Ornaments';
import { Prose } from '../Prose';
import type { Porteur } from '../liage';
import { libelleDuChamp } from './editFields';
import { uniqueSlugId } from '../../data/slug';
import { Row } from '../Layout';
import { SourceBadge } from '../SourceBadge';

/**
 * Porteur d'une rangée : la rangée dit SON `chemin` (et, si le champ vit dans une AUTRE entrée, son
 * `type`/`id`) ; la fiche dit QUI elle rend. Ni l'un ni l'autre seul ne suffit — sans les deux, la
 * rangée est nue et ne lie rien (#1392 Lot E).
 */
export function porteurDeRangee(row: CodexRow, entree?: { type: string; id: string }): Porteur | undefined {
  if (row.t !== 'text' || !row.porteur) return undefined;
  const type = row.porteur.type ?? entree?.type;
  const id = row.porteur.id ?? entree?.id;
  return type && id ? { type, id, chemin: row.porteur.chemin } : undefined;
}

function CodexRowView({ row, entree }: { row: CodexRow; entree?: { type: string; id: string } }) {
  switch (row.t) {
    case 'sub':
      return <div className="codex-rowsub">{row.label}</div>;
    case 'kv':
      return (
        <div className="codex-kv">
          <span className="ck-k">{row.kref ? <CodexRef category={row.kref.category} id={row.kref.id} label={row.kref.label}>{row.k}</CodexRef> : row.k}</span>
          <span className="ck-v">{row.v}</span>
        </div>
      );
    case 'couleur':
      // La couleur se VOIT : pastille peinte à la valeur de la donnée + le code hex en texte, qui
      // reste lisible et copiable. Même gabarit que `kv`. La pastille est DÉCORATIVE (`aria-hidden`) :
      // le hex adjacent porte déjà l'annonce, la nommer la doublerait au lecteur d'écran.
      return (
        <div className="codex-kv">
          <span className="ck-k">{row.k}</span>
          <span className="ck-v">
            <span className="swatch" style={{ background: row.v }} aria-hidden="true" />
            {row.v}
          </span>
        </div>
      );
    case 'text':
      return <div className="codex-rowtext"><Prose md={row.text} porteur={porteurDeRangee(row, entree)} /></div>;
    case 'chip':
      // Pastille NUE : même boîte que ses voisines `t:'ref'`, sans popover ni lien (rien à résoudre).
      return <PlainChip label={row.label} badge={row.badge} />;
    case 'ref':
      return <EntityRef category={row.category} id={row.id} label={row.label} show={row.show} instance={row.show} badge={row.badge} />;
    case 'choice':
      // « A ou B » : rendu via la brique PARTAGÉE (identique partout — Codex et écrans).
      return <ChoiceChips category={row.category} options={row.options} />;
    case 'fold':
      // Dépliable CANONIQUE (`.fold`, cf. components.css) : forme technique d'atelier sous la phrase humaine.
      return (
        <details className="fold codex-fold">
          <summary><span className="fold-title">{row.summary}</span></summary>
          <div className="fold-body"><Prose md={row.text} /></div>
        </details>
      );
    case 'nb':
      return <em className="nb">{row.text}</em>;
  }
}

function CodexSectionView({ section, entree }: { section: CodexSection; entree?: { type: string; id: string } }) {
  return (
    <section className="codex-sec">
      <h3 className="codex-sec-title section-label">{section.title}</h3>
      <div className={`codex-sec-body codex-${section.layout ?? 'list'}`}>
        {section.rows.map((row, i) => (
          <CodexRowView key={i} row={row} entree={entree} />
        ))}
      </div>
    </section>
  );
}

/** Rendu PARTAGÉ d'une liste de sections (fiche Codex ET statbloc d'inspection en combat).
 *  `entree` = l'entrée affichée (`{ type, id }`), qui complète le `chemin` des rangées en PORTEUR.
 *  Absente (statbloc d'un combattant, sections du créateur) : les rangées sont nues — un combattant
 *  n'est pas une entrée, il n'y a aucun champ à nommer. */
export function CodexSections({ sections, entree }: { sections: CodexSection[]; entree?: { type: string; id: string } }) {
  return (
    <>
      {sections.map((sec, i) => (
        <CodexSectionView key={i} section={sec} entree={entree} />
      ))}
    </>
  );
}

export function CodexEntry({ item, instance, category, exergues }: { item: CodexItem; instance?: string; category?: string; exergues?: boolean }) {
  // L'entrée AFFICHÉE : ce que la fiche sait d'elle-même, et qui fait d'un `chemin` de rangée un
  // PORTEUR complet. Sans `category` (appel hors navigation Codex) : rangées nues.
  const entree = category ? { type: category, id: item.id } : undefined;
  // ONGLETS data-driven : CHAQUE section de la fiche (statbloc, compétences, niveaux de carrière,
  // bénédictions…) devient un onglet → les onglets reflètent les données PROPRES de l'entité (une
  // créature, un sort et une race n'exposent pas les mêmes). La CHARTE (figurine + onglets) est, elle,
  // partagée avec le créateur via `TabbedEntry` — on ne se perd pas d'une fiche à l'autre.
  // `id` d'onglet STABLE = slug du titre (identité sémantique invariante d'une fiche à l'autre) : le
  // même onglet reste ouvert en feuilletant (« Caractéristiques »), par simple égalité d'id côté TabbedEntry.
  const tabIds = new Set<string>();
  const tabs: EntryTab[] = item.tabs
    ? // Regroupement EXPLICITE (ex. race : Profil bundle carac+compétences+talents) → sections avec titre.
      item.tabs.map((t) => ({
        id: uniqueSlugId(t.title, tabIds),
        label: t.title,
        content: (
          <div className="codex-tabpane">
            <CodexSections sections={t.sections} entree={entree} />
          </div>
        ),
      }))
    : // Sinon : UN onglet par section (corps seul, le libellé d'onglet porte déjà le titre).
      (item.sections ?? []).map((sec) => ({
        id: uniqueSlugId(sec.title, tabIds),
        label: sec.title,
        content: (
          <div className={`codex-tabpane codex-sec-body codex-${sec.layout ?? 'list'}`}>
            {sec.rows.map((row, j) => (
              <CodexRowView key={j} row={row} entree={entree} />
            ))}
          </div>
        ),
      }));
  if (item.desc) {
    // La Description ouvre la fiche : le premier onglet est celui qu'on lit d'abord.
    tabs.unshift({
      id: 'desc',
      label: 'Description',
      content: (
        <div className="codex-tabpane codex-body"><Prose md={item.desc} porteur={entree && { ...entree, chemin: 'desc' }} exergues={exergues} /></div>
      ),
    });
  }

  // Faits-clés : TOUJOURS visibles dans l'en-tête (jamais cachés derrière un onglet).
  const meta =
    item.meta && item.meta.length > 0 ? (
      <Row className="codex-meta">
        {item.meta.map((m) => (
          <span key={m.label} className="stat-chip codex-fact">
            <span className="sc-label" title={m.label}>{m.label}</span>
            <span className="sc-value">{m.value}</span>
          </span>
        ))}
      </Row>
    ) : undefined;

  return (
    <article className="codex-entry">
      {instance && instance !== item.label && (
        <div className="codex-instance">
          Cette occurrence : <b>{instance}</b>
        </div>
      )}
      {/* PAS de `key={item.label}` : TabbedEntry conserve l'onglet actif (par nom) au changement de fiche. */}
      <TabbedEntry
        figure={item.appearance ? <OrnateFrame className="codex-figure"><CreaturePreview label={item.previewRef ?? item.label} appearance={item.appearance} porteur={item.previewPorteur} /></OrnateFrame> : undefined}
        title={item.label}
        aside={item.source ? <SourceBadge source={item.source} /> : undefined}
        blurb={item.sub}
        meta={meta}
        tabs={tabs}
        band={item.statblock && (
          <div className="codex-statblock tx-parchment">
            <table className="codex-statblock-profile">
              <thead>
                <tr>
                  {item.statblock.profile.map((f) => (
                    <th key={f.label}>{f.kref ? <CodexRef category={f.kref.category} id={f.kref.id} label={f.kref.label}>{f.label}</CodexRef> : f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody><tr>{item.statblock.profile.map((f) => <td key={f.label}>{f.value}</td>)}</tr></tbody>
            </table>
            {item.statblock.traits.length > 0 && (
              <div className="codex-sec-body codex-chips">
                {item.statblock.traits.map((row, i) => <CodexRowView key={i} row={row} entree={entree} />)}
              </div>
            )}
          </div>
        )}
      />
      {item.maison && (
        // PROVENANCE d'un document sans folio : la valeur maison se LIT sur la fiche, comme la réf
        // de livre d'une entrée sourcée (`SourceBadge`). Rendu UNE fois ici, jamais par catégorie.
        <section className="codex-sec">
          <h3 className="codex-sec-title section-label">{libelleDuChamp('maison')}</h3>
          <div className="codex-sec-body codex-body"><Prose md={item.maison} porteur={entree && { ...entree, chemin: 'maison' }} /></div>
        </section>
      )}
    </article>
  );
}

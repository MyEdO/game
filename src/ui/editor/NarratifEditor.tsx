import { useState } from 'react';
import { ScreenShell } from '../ScreenShell';
import { Tabs, type TabItem } from '../Tabs';
import { Icon } from '../Icon';
import { MasterDetail } from '../MasterDetail';
import { MonsterPartsFields, ReglagesApparence } from './MonsterPartsFields';
import { coiffureChoisie, coiffureRetombee } from '../../gameIso/rig/parts/cosmetic';
import { creatures, creatureLabel, findCreatureById, memoParVersion } from '../../data';
import { CHAR_KEYS, CHAR_LABELS, type CharKey } from '../../engine/types';
import type { NarratifBlock, PresetPnj, Affaire, Indice, IndiceStade, OuvertureBlock, ClotureBlock, AmbianceCadre } from '../../state/campaignNarratif';
import { ConditionEditor } from './ConditionEditor';
import { CONDITION_KINDS_CARTE } from '../../data/schemas/defs-scenes/worldmap';
import type { CreatureData } from '../../data';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { ListRow } from '../ListRow';
import { NumberField } from '../NumberField';

/**
 * Éditeur du bloc NARRATIF d'un paquet de campagne (#765) — overlay plein-champ (`ScreenShell`, même
 * coquille que la Carte du monde). Les onglets Affaires/Indices (#670) et PNJ (#671 lot B) sont
 * ÉDITABLES ; l'onglet Objets reste en lecture. Frontière RÉFÉRENCE vs NARRATIF : ces entrées
 * référencent la règle globale PAR ID.
 */
type NarratifTab = 'cadre' | 'affaires' | 'indices' | 'presetsPnj' | 'objets';

/** Liste des créatures globales (base d'un preset), triée par libellé — patron `Inspector.tsx`. */
const optionsDeCreature = memoParVersion('creatures', () => [...creatures].map((c) => ({ id: c.id, label: c.label })).sort((a, b) => a.label.localeCompare(b.label)));

/** Nom affiché d'un preset dans la liste maître : profil.label, sinon la base, sinon l'id. */
function presetName(p: PresetPnj): string {
  return p.profil?.label ?? (p.base ? creatureLabel(p.base) : undefined) ?? p.id;
}

/** Id de preset frais, non-colluant avec les ids déjà présents. */
function freshPresetId(existing: PresetPnj[]): string {
  let n = existing.length + 1;
  const has = (x: string) => existing.some((p) => p.id === x);
  while (has(`pnj-${n}`)) n++;
  return `pnj-${n}`;
}

/** Id d'affaire frais, non-colluant avec les ids déjà présents. */
function freshAffaireId(existing: Affaire[]): string {
  let n = existing.length + 1;
  const has = (x: string) => existing.some((a) => a.id === x);
  while (has(`affaire-${n}`)) n++;
  return `affaire-${n}`;
}

/** Id d'indice frais, non-colluant avec les ids déjà présents. */
function freshIndiceId(existing: Indice[]): string {
  let n = existing.length + 1;
  const has = (x: string) => existing.some((i) => i.id === x);
  while (has(`indice-${n}`)) n++;
  return `indice-${n}`;
}

/** Id de stade frais, non-colluant DANS l'indice porteur (`narratifSchema` exige l'unicité locale). */
function freshStadeId(existing: IndiceStade[]): string {
  let n = existing.length + 1;
  const has = (x: string) => existing.some((s) => s.id === x);
  while (has(`stade-${n}`)) n++;
  return `stade-${n}`;
}

/** Un id candidat est déjà pris par une AUTRE entrée des trois catégories narratives (affaires/indices/
 *  presetsPnj), hors l'entrée elle-même. Collision inter-catégories gardée ici ; collision avec un id
 *  global reste vérifiée par `narratifSchema` au parse. */
function idUsedElsewhere(
  narratif: NarratifBlock,
  candidate: string,
  self: { kind: 'affaire' | 'indice' | 'preset'; id: string },
): boolean {
  const isSelf = (kind: typeof self.kind, id: string) => kind === self.kind && id === self.id;
  if (narratif.affaires.some((a) => a.id === candidate && !isSelf('affaire', a.id))) return true;
  if (narratif.indices.some((i) => i.id === candidate && !isSelf('indice', i.id))) return true;
  if (narratif.presetsPnj.some((p) => p.id === candidate && !isSelf('preset', p.id))) return true;
  return false;
}

export function NarratifEditor({ narratif, onChange, onClose }: {
  narratif: NarratifBlock;
  /** Chemin d'écriture (#671 lot B) — toute mutation de preset produit un `NarratifBlock` neuf (immutable). */
  onChange?: (n: NarratifBlock) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<NarratifTab>('affaires');
  const [selId, setSelId] = useState<string | null>(narratif.presetsPnj[0]?.id ?? null);
  const [selAffaireId, setSelAffaireId] = useState<string | null>(narratif.affaires[0]?.id ?? null);
  const [selIndiceId, setSelIndiceId] = useState<string | null>(narratif.indices[0]?.id ?? null);

  const setPresets = (presetsPnj: PresetPnj[]) => onChange?.({ ...narratif, presetsPnj });

  const addPreset = () => {
    const id = freshPresetId(narratif.presetsPnj);
    // Base par défaut = première créature globale : garantit un preset VALIDE au round-trip
    // (`narratifSchema` refuse un preset sans base ni profil) ; l'auteur la change ensuite.
    setPresets([...narratif.presetsPnj, { id, base: optionsDeCreature()[0]?.id }]);
    setSelId(id);
  };

  const removePreset = (id: string) => {
    setPresets(narratif.presetsPnj.filter((p) => p.id !== id));
    if (selId === id) setSelId(null);
  };

  const updatePreset = (id: string, patch: Partial<PresetPnj>) => {
    setPresets(narratif.presetsPnj.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const renamePreset = (id: string, nextId: string) => {
    const trimmed = nextId.trim();
    // Id STABLE : refuse le vide et toute collision avec un AUTRE preset OU une autre catégorie narrative.
    if (!trimmed || idUsedElsewhere(narratif, trimmed, { kind: 'preset', id })) return;
    setPresets(narratif.presetsPnj.map((p) => (p.id === id ? { ...p, id: trimmed } : p)));
    if (selId === id) setSelId(trimmed);
  };

  const selected = narratif.presetsPnj.find((p) => p.id === selId) ?? null;

  const setAffaires = (affaires: Affaire[]) => onChange?.({ ...narratif, affaires });

  const addAffaire = () => {
    const id = freshAffaireId(narratif.affaires);
    setAffaires([...narratif.affaires, { id, titre: 'Nouvelle affaire' }]);
    setSelAffaireId(id);
  };

  const affaireReferenced = (id: string) => narratif.indices.some((i) => i.affaireId === id);

  const removeAffaire = (id: string) => {
    if (affaireReferenced(id)) return;
    setAffaires(narratif.affaires.filter((a) => a.id !== id));
    if (selAffaireId === id) setSelAffaireId(null);
  };

  const updateAffaire = (id: string, patch: Partial<Affaire>) => {
    setAffaires(narratif.affaires.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const renameAffaire = (id: string, nextId: string) => {
    const trimmed = nextId.trim();
    if (!trimmed || idUsedElsewhere(narratif, trimmed, { kind: 'affaire', id })) return;
    // Propage aux indices rattachés : sinon `narratifSchema` rejette un `affaireId` orphelin.
    const affaires = narratif.affaires.map((a) => (a.id === id ? { ...a, id: trimmed } : a));
    const indices = narratif.indices.map((i) => (i.affaireId === id ? { ...i, affaireId: trimmed } : i));
    onChange?.({ ...narratif, affaires, indices });
    if (selAffaireId === id) setSelAffaireId(trimmed);
  };

  const selectedAffaire = narratif.affaires.find((a) => a.id === selAffaireId) ?? null;

  const setIndices = (indices: Indice[]) => onChange?.({ ...narratif, indices });

  const addIndice = () => {
    // Aucune affaire à rattacher : `narratifSchema` rejette un `affaireId` orphelin — no-op, le bouton
    // appelant est désactivé dans ce cas (garantit un indice VALIDE au round-trip, même esprit qu'`addPreset`).
    const firstAffaireId = narratif.affaires[0]?.id;
    if (!firstAffaireId) return;
    const id = freshIndiceId(narratif.indices);
    setIndices([...narratif.indices, { id, affaireId: firstAffaireId, kind: 'indice', titre: 'Nouvel indice', stades: [{ id: 'stade-1', prose: '' }] }]);
    setSelIndiceId(id);
  };

  const removeIndice = (id: string) => {
    // Retire aussi toute référence pendante (`refs`) d'un AUTRE indice vers celui-ci.
    const next = narratif.indices
      .filter((i) => i.id !== id)
      .map((i) => {
        if (!i.refs?.includes(id)) return i;
        const refs = i.refs.filter((r) => r !== id);
        return { ...i, refs: refs.length ? refs : undefined };
      });
    setIndices(next);
    if (selIndiceId === id) setSelIndiceId(null);
  };

  const updateIndice = (id: string, patch: Partial<Indice>) => {
    setIndices(narratif.indices.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const renameIndice = (id: string, nextId: string) => {
    const trimmed = nextId.trim();
    if (!trimmed || idUsedElsewhere(narratif, trimmed, { kind: 'indice', id })) return;
    // Propage aux `refs` des autres indices : sinon `narratifSchema` rejette une réf orpheline.
    const indices = narratif.indices.map((i) => {
      if (i.id === id) return { ...i, id: trimmed };
      if (i.refs?.includes(id)) return { ...i, refs: i.refs.map((r) => (r === id ? trimmed : r)) };
      return i;
    });
    setIndices(indices);
    if (selIndiceId === id) setSelIndiceId(trimmed);
  };

  const selectedIndice = narratif.indices.find((i) => i.id === selIndiceId) ?? null;

  const setOuverture = (ouverture: OuvertureBlock | undefined) => onChange?.({ ...narratif, ouverture });
  const setCloture = (cloture: ClotureBlock | undefined) => onChange?.({ ...narratif, cloture });

  const tabs: TabItem<NarratifTab>[] = [
    { key: 'cadre', label: 'Cadre', count: (narratif.ouverture ? 1 : 0) + (narratif.cloture ? 1 : 0) },
    { key: 'affaires', label: 'Affaires', count: narratif.affaires.length },
    { key: 'indices', label: 'Indices', count: narratif.indices.length },
    { key: 'presetsPnj', label: 'PNJ', count: narratif.presetsPnj.length },
    { key: 'objets', label: 'Objets', count: narratif.objets.length },
  ];

  return (
    <ScreenShell
      title={<><Icon id="nav/compendium" size="sm" /> Narratif de la campagne</>}
      onClose={onClose}
      body="centered"
      tabs={<Tabs tabs={tabs} active={tab} onChange={setTab} label="Rubriques du narratif" />}
    >
      {tab === 'cadre' && (
        <CadreForm
          ouverture={narratif.ouverture}
          cloture={narratif.cloture}
          onOuverture={setOuverture}
          onCloture={setCloture}
        />
      )}
      {tab === 'affaires' && (
        <MasterDetail
          listLabel="Affaires"
          list={
            <>
              {narratif.affaires.length === 0
                ? <p className="empty">Aucune affaire dans cette campagne.</p>
                : narratif.affaires.map((a) => (
                    <ListRow key={a.id} selected={a.id === selAffaireId} onClick={() => setSelAffaireId(a.id)} label={a.titre}>
                      <span className="chip">{a.id}</span>
                    </ListRow>
                  ))}
              <button type="button" className="btn small" onClick={addAffaire}>
                <Icon id="ui/add" size="sm" /> Ajouter une affaire
              </button>
            </>
          }
          detail={
            selectedAffaire
              ? <AffaireForm
                  affaire={selectedAffaire}
                  referenced={affaireReferenced(selectedAffaire.id)}
                  onRename={(nextId) => renameAffaire(selectedAffaire.id, nextId)}
                  onPatch={(patch) => updateAffaire(selectedAffaire.id, patch)}
                  onRemove={() => removeAffaire(selectedAffaire.id)}
                />
              : <p className="empty">Sélectionnez une affaire à éditer, ou ajoutez-en une.</p>
          }
        />
      )}
      {tab === 'indices' && (
        <MasterDetail
          listLabel="Indices"
          list={
            <>
              {narratif.indices.length === 0
                ? <p className="empty">Aucun indice dans cette campagne.</p>
                : narratif.indices.map((i) => (
                    <ListRow key={i.id} selected={i.id === selIndiceId} onClick={() => setSelIndiceId(i.id)} label={i.titre}>
                      <span className="chip">{i.kind === 'rumeur' ? 'Rumeur' : 'Indice'}</span>
                      <span className="chip">{i.id}</span>
                    </ListRow>
                  ))}
              <button
                type="button"
                className="btn small"
                disabled={narratif.affaires.length === 0}
                title={narratif.affaires.length === 0 ? 'Créez d\'abord une affaire.' : undefined}
                onClick={addIndice}
              >
                <Icon id="ui/add" size="sm" /> Ajouter un indice
              </button>
            </>
          }
          detail={
            selectedIndice
              ? <IndiceForm
                  indice={selectedIndice}
                  affaires={narratif.affaires}
                  otherIndices={narratif.indices.filter((i) => i.id !== selectedIndice.id)}
                  onRename={(nextId) => renameIndice(selectedIndice.id, nextId)}
                  onPatch={(patch) => updateIndice(selectedIndice.id, patch)}
                  onRemove={() => removeIndice(selectedIndice.id)}
                />
              : <p className="empty">Sélectionnez un indice à éditer, ou ajoutez-en un.</p>
          }
        />
      )}
      {tab === 'presetsPnj' && (
        <MasterDetail
          listLabel="PNJ pré-composés"
          list={
            <>
              {narratif.presetsPnj.length === 0
                ? <p className="empty">Aucun PNJ pré-composé dans cette campagne.</p>
                : narratif.presetsPnj.map((p) => (
                    <ListRow key={p.id} selected={p.id === selId} onClick={() => setSelId(p.id)} label={presetName(p)}>
                      <span className="chip">{p.id}</span>
                    </ListRow>
                  ))}
              <button type="button" className="btn small" onClick={addPreset}>
                <Icon id="ui/add" size="sm" /> Ajouter un PNJ
              </button>
            </>
          }
          detail={
            selected
              ? <PresetForm
                  preset={selected}
                  onRename={(nextId) => renamePreset(selected.id, nextId)}
                  onPatch={(patch) => updatePreset(selected.id, patch)}
                  onRemove={() => removePreset(selected.id)}
                />
              : <p className="empty">Sélectionnez un PNJ à éditer, ou ajoutez-en un.</p>
          }
        />
      )}
      {tab === 'objets' && (
        narratif.objets.length === 0
          ? <p className="empty">Aucun objet narratif dans cette campagne.</p>
          : narratif.objets.map((o) => (
              <div key={o.id} className="listrow">
                <span className="lr-name">{o.label}</span>
                <span className="chip">{o.id}</span>
              </div>
            ))
      )}
    </ScreenShell>
  );
}

/** CADRE du chapitre (#717) : l'ouverture cérémonielle et la clôture. Le `pitch` est un VERBATIM de
 *  source (règle stricte 5) — il se colle, il ne se rédige pas ici. La Condition de clôture est bornée
 *  aux kinds évaluables hors combat (`CONDITION_KINDS_CARTE`), comme un `when` de carte. */
function CadreForm({ ouverture, cloture, onOuverture, onCloture }: {
  ouverture?: OuvertureBlock;
  cloture?: ClotureBlock;
  onOuverture: (o: OuvertureBlock | undefined) => void;
  onCloture: (c: ClotureBlock | undefined) => void;
}) {
  const patchOuv = (patch: Partial<OuvertureBlock>) => onOuverture({ ...(ouverture ?? { titre: '', pitch: '' }), ...patch });
  // Clôture NEUVE : `{kind:'flag', expr:''}` — le défaut du `ConditionEditor` (`ConditionEditor.tsx`,
  // branche d'`all`/`any`) et de `FlowEditor`. Une Condition `always` fermerait le chapitre au PREMIER
  // lot d'effets ; un `expr` vide, lui, ne peut pas être sauvegardé (le schéma le refuse en nommant le
  // champ), donc l'auteur nomme son drapeau ou retire la clôture.
  const patchClo = (patch: Partial<ClotureBlock>) => onCloture({ ...(cloture ?? { titre: '', when: { kind: 'flag', expr: '' } }), ...patch });
  return (
    <div className="preset-form">
      <h4 className="mini-title">Ouverture cérémonielle</h4>
      {!ouverture ? (
        <button type="button" className="btn small" onClick={() => onOuverture({ titre: '', pitch: '' })}>
          <Icon id="ui/add" size="sm" /> Ajouter une ouverture
        </button>
      ) : (
        <>
          <label className="ed-field">
            Surtitre
            <input value={ouverture.surtitre ?? ''} onChange={(e) => patchOuv({ surtitre: e.target.value || undefined })} />
          </label>
          <label className="ed-field">
            Titre
            <input value={ouverture.titre} onChange={(e) => patchOuv({ titre: e.target.value })} />
          </label>
          <label className="ed-field">
            Sous-titre
            <input value={ouverture.sousTitre ?? ''} onChange={(e) => patchOuv({ sousTitre: e.target.value || undefined })} />
          </label>
          <label className="ed-field">
            Chapitre
            <input value={ouverture.chapitre ?? ''} onChange={(e) => patchOuv({ chapitre: e.target.value || undefined })} />
          </label>
          <label className="ed-field">
            Pitch (verbatim de la source, Markdown)
            <textarea value={ouverture.pitch} onChange={(e) => patchOuv({ pitch: e.target.value })} />
          </label>
          <label className="ed-field">
            Ambiance
            <select value={ouverture.ambiance ?? 'veillee'} onChange={(e) => patchOuv({ ambiance: e.target.value as AmbianceCadre })}>
              <option value="veillee">Veillée</option>
              <option value="parchemin">Parchemin</option>
            </select>
          </label>
          <button type="button" className="btn small danger" onClick={() => onOuverture(undefined)}>
            <Icon id="ui/delete" size="sm" /> Retirer l'ouverture
          </button>
        </>
      )}
      <h4 className="mini-title">Clôture du chapitre</h4>
      {!cloture ? (
        <button type="button" className="btn small" onClick={() => onCloture({ titre: '', when: { kind: 'flag', expr: '' } })}>
          <Icon id="ui/add" size="sm" /> Ajouter une clôture
        </button>
      ) : (
        <>
          <label className="ed-field">
            Titre
            <input value={cloture.titre} onChange={(e) => patchClo({ titre: e.target.value })} />
          </label>
          <label className="ed-field">
            Sous-titre
            <input value={cloture.sousTitre ?? ''} onChange={(e) => patchClo({ sousTitre: e.target.value || undefined })} />
          </label>
          <div className="ed-field">
            Condition de clôture
            <ConditionEditor cond={cloture.when} kinds={CONDITION_KINDS_CARTE} onChange={(when) => patchClo({ when })} />
          </div>
          <button type="button" className="btn small danger" onClick={() => onCloture(undefined)}>
            <Icon id="ui/delete" size="sm" /> Retirer la clôture
          </button>
        </>
      )}
    </div>
  );
}

/** Formulaire d'une affaire : identité + titre + description, suppression bloquée si des indices y sont rattachés. */
function AffaireForm({ affaire, referenced, onRename, onPatch, onRemove }: {
  affaire: Affaire;
  referenced: boolean;
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<Affaire>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="preset-form">
      <label className="ed-field">
        Identifiant (id stable)
        <input value={affaire.id} onChange={(e) => onRename(e.target.value)} />
      </label>
      <label className="ed-field">
        Titre
        <input value={affaire.titre} onChange={(e) => onPatch({ titre: e.target.value })} />
      </label>
      <label className="ed-field">
        Description
        <textarea
          value={affaire.desc ?? ''}
          onChange={(e) => onPatch({ desc: e.target.value || undefined })}
        />
      </label>
      <button
        type="button"
        className="btn small danger"
        disabled={referenced}
        title={referenced ? 'Des indices référencent encore cette affaire — les retirer ou les réaffecter d\'abord.' : undefined}
        onClick={onRemove}
      >
        <Icon id="ui/delete" size="sm" /> Supprimer cette affaire
      </button>
    </div>
  );
}

/** Formulaire d'un indice/rumeur : identité + affaire + nature + titre + recoupements + stades révélables. */
function IndiceForm({ indice, affaires, otherIndices, onRename, onPatch, onRemove }: {
  indice: Indice;
  affaires: Affaire[];
  otherIndices: Indice[];
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<Indice>) => void;
  onRemove: () => void;
}) {
  const toggleRef = (id: string) => {
    const refs = indice.refs ?? [];
    const next = refs.includes(id) ? refs.filter((r) => r !== id) : [...refs, id];
    onPatch({ refs: next.length ? next : undefined });
  };

  const setStades = (stades: IndiceStade[]) => onPatch({ stades });
  const addStade = () => setStades([...indice.stades, { id: freshStadeId(indice.stades), prose: '' }]);
  const removeStade = (id: string) => {
    if (indice.stades.length <= 1) return;
    setStades(indice.stades.filter((s) => s.id !== id));
  };
  const updateStade = (id: string, patch: Partial<IndiceStade>) => {
    setStades(indice.stades.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const renameStade = (id: string, nextId: string) => {
    const trimmed = nextId.trim();
    if (!trimmed || indice.stades.some((s) => s.id !== id && s.id === trimmed)) return;
    updateStade(id, { id: trimmed });
  };

  return (
    <div className="preset-form">
      <label className="ed-field">
        Identifiant (id stable)
        <input value={indice.id} onChange={(e) => onRename(e.target.value)} />
      </label>
      <div className="ed-field">
        <span>Affaire</span>
        {affaires.length === 0
          ? <p className="empty">Créez d'abord une affaire pour pouvoir y rattacher un indice.</p>
          : (
            <select value={indice.affaireId} onChange={(e) => onPatch({ affaireId: e.target.value })}>
              {affaires.map((a) => (
                <option key={a.id} value={a.id}>{a.titre}</option>
              ))}
            </select>
          )}
      </div>
      <label className="ed-field">
        Nature
        <select value={indice.kind} onChange={(e) => onPatch({ kind: e.target.value as Indice['kind'] })}>
          <option value="indice">Indice</option>
          <option value="rumeur">Rumeur</option>
        </select>
      </label>
      <label className="ed-field">
        Titre
        <input value={indice.titre} onChange={(e) => onPatch({ titre: e.target.value })} />
      </label>
      <div className="ed-field">
        <span>Recoupements (autres indices débloqués/liés)</span>
        {otherIndices.length === 0
          ? <p className="empty">Aucun autre indice à recouper.</p>
          : otherIndices.map((o) => (
              <label key={o.id} className="ed-subfield">
                <input type="checkbox" checked={(indice.refs ?? []).includes(o.id)} onChange={() => toggleRef(o.id)} />
                {o.titre}
              </label>
            ))}
      </div>
      <div className="ed-field">
        <span>Stades révélables</span>
        {indice.stades.map((s, idx) => (
          <div key={s.id} className="preset-form">
            <label className="ed-subfield">
              Id du stade
              <input value={s.id} onChange={(e) => renameStade(s.id, e.target.value)} />
            </label>
            <label className="ed-subfield">
              Prose (stade {idx + 1})
              <textarea value={s.prose} onChange={(e) => updateStade(s.id, { prose: e.target.value })} />
            </label>
            <div className="ed-subfield">
              <span>Source</span>
              <input
                placeholder="Livre"
                value={s.source?.book ?? ''}
                onChange={(e) => {
                  const book = e.target.value;
                  updateStade(s.id, { source: book || s.source?.page ? { book, page: s.source?.page ?? 0 } : undefined });
                }}
              />
              <NumberField
                variant="nu"
                label="Page de la source du stade"
                placeholder="Page"
                vide
                value={s.source?.page}
                onChange={(page) => {
                  updateStade(s.id, { source: s.source?.book || page != null ? { book: s.source?.book ?? '', page: page ?? 0 } : undefined });
                }}
              />
            </div>
            <button
              type="button"
              className="btn small danger"
              disabled={indice.stades.length <= 1}
              title={indice.stades.length <= 1 ? 'Un indice garde au moins un stade.' : undefined}
              onClick={() => removeStade(s.id)}
            >
              <Icon id="ui/delete" size="sm" /> Supprimer ce stade
            </button>
          </div>
        ))}
        <button type="button" className="btn small" onClick={addStade}>
          <Icon id="ui/add" size="sm" /> Ajouter un stade
        </button>
      </div>
      <button type="button" className="btn small danger" onClick={onRemove}>
        <Icon id="ui/delete" size="sm" /> Supprimer cet indice
      </button>
    </div>
  );
}

/** Formulaire d'un preset de PNJ : identité + base + surcharges de caracs + apparence + portrait + source. */
function PresetForm({ preset, onRename, onPatch, onRemove }: {
  preset: PresetPnj;
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<PresetPnj>) => void;
  onRemove: () => void;
}) {
  const profil = preset.profil ?? {};
  const appearance: EntityAppearance = preset.apparence ?? {};
  const base = preset.base ? findCreatureById(preset.base) : undefined;

  /** Fusionne un patch de `profil` (retire `profil` s'il redevient vide). */
  const patchProfil = (patch: Partial<CreatureData>) => {
    const next = { ...profil, ...patch };
    onPatch({ profil: Object.keys(next).length ? next : undefined });
  };
  /** Surcharge d'une carac (vide = héritée de la base) — retire `char` s'il redevient vide. */
  const setChar = (k: CharKey, v: number | null) => {
    const char = { ...(profil.char ?? {}) };
    if (v == null) delete char[k];
    else char[k] = v;
    patchProfil({ char: Object.keys(char).length ? char : undefined });
  };
  /** Fusionne un patch d'apparence (retire `apparence` si elle redevient vide). */
  const patchAppearance = (patch: Partial<EntityAppearance>) => {
    const next = coiffureRetombee({ ...appearance, ...patch });
    onPatch({ apparence: Object.keys(next).length ? next : undefined });
  };

  return (
    <div className="preset-form">
      <label className="ed-field">
        Identifiant (id stable)
        <input value={preset.id} onChange={(e) => onRename(e.target.value)} />
      </label>
      <label className="ed-field">
        Créature de base (profil de combat)
        <select value={preset.base ?? ''} onChange={(e) => onPatch({ base: e.target.value || undefined })}>
          <option value="">— aucune (profil ad hoc) —</option>
          {optionsDeCreature().map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </label>
      <label className="ed-field">
        Nom du PNJ
        <input
          value={profil.label ?? ''}
          placeholder={base?.label ?? 'ex. Josef Quartjin'}
          onChange={(e) => patchProfil({ label: e.target.value || undefined })}
        />
      </label>
      <div className="ed-field">
        <span>Surcharges de caractéristiques (vide = héritée de la base)</span>
        <div className="statblock-grid">
          {CHAR_KEYS.map((k) => (
            <label key={k} className="ed-subfield" title={CHAR_LABELS[k]}>
              {k}
              <NumberField
                variant="nu"
                label={CHAR_LABELS[k]}
                vide
                value={profil.char?.[k]}
                placeholder={base ? String(base.char[k] ?? '') : ''}
                onChange={(n) => setChar(k, n)}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="ed-field">
        <span>Apparence</span>
        <ReglagesApparence
          species={appearance.species}
          sex={appearance.sex}
          build={appearance.build}
          hairstyle={appearance.hairstyle}
          onSpecies={(id) => patchAppearance({ species: id })}
          onSex={(s) => patchAppearance({ sex: s })}
          onBuild={(b) => patchAppearance({ build: b })}
          onHairstyle={(id) => patchAppearance(coiffureChoisie(id))}
        />
      </div>
      <MonsterPartsFields
        monster={appearance.monster}
        colors={appearance.colors}
        tenue={appearance.tenue}
        eyes={appearance.eyes}
        features={appearance.features}
        onMonster={(patch) => patchAppearance({ monster: { ...(appearance.monster ?? {}), ...patch } })}
        onColors={(patch) => patchAppearance({ colors: { ...(appearance.colors ?? {}), ...patch } })}
        onTenue={(c) => patchAppearance({ tenue: c })}
        onEyes={(patch) => patchAppearance({ eyes: { ...(appearance.eyes ?? {}), ...patch } })}
        onFeatures={(f) => patchAppearance({ features: f.length ? f : undefined })}
      />
      <label className="ed-field">
        Portrait (id d'illustration)
        <input
          value={preset.portrait ?? ''}
          placeholder="id du registre d'art"
          onChange={(e) => onPatch({ portrait: e.target.value || undefined })}
        />
      </label>
      <div className="ed-field">
        <span>Source</span>
        <label className="ed-subfield">
          Livre
          <input
            value={preset.source?.book ?? ''}
            onChange={(e) => {
              const book = e.target.value;
              onPatch({ source: book || preset.source?.page ? { book, page: preset.source?.page ?? 0 } : undefined });
            }}
          />
        </label>
        <label className="ed-subfield">
          Page
          <NumberField
            variant="nu"
            label="Page de la source du PNJ"
            vide
            value={preset.source?.page}
            onChange={(page) => {
              onPatch({ source: preset.source?.book || page != null ? { book: preset.source?.book ?? '', page: page ?? 0 } : undefined });
            }}
          />
        </label>
      </div>
      <button type="button" className="btn small danger" onClick={onRemove}>
        <Icon id="ui/delete" size="sm" /> Supprimer ce PNJ
      </button>
    </div>
  );
}

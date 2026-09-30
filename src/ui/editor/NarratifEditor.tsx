import { useState } from 'react';
import { ScreenShell } from '../ScreenShell';
import { Tabs, type TabItem } from '../Tabs';
import { Icon } from '../Icon';
import { MasterDetail } from '../MasterDetail';
import { MonsterPartsFields, ReglagesApparence } from './MonsterPartsFields';
import { isSwarm } from '../../engine/traits/dispatch';
import { mergeCreatureProfile } from '../../state/campaignData';
import { creatures, findCreatureById, memoParVersion } from '../../data';
import { CHAR_KEYS, CHAR_LABELS, type CharKey } from '../../engine/types';
import type { NarratifBlock, PresetPnj, Affaire, Indice, IndiceStade, DocumentNarratif, OuvertureBlock, ClotureBlock, AmbianceCadre } from '../../state/campaignNarratif';
import { SourceRefField } from '../SourceRefField';
import { ProseField } from '../ProseField';
import { LIBELLE_NARRATIF, RefNarrativeField } from '../compendium/RefField';
import { ConditionEditor } from './ConditionEditor';
import { CONDITION_KINDS_CARTE } from '../../data/schemas/defs-scenes/worldmap';
import { REGISTRES_NARRATIFS, type CleDeRegistreNarratif, type RegistreReference } from '../../data/schemas/defs-scenes/registres-narratifs';
import { lieuxDesSites, referencesA, renommeRef, type CibleNarrative, type Renommage } from '../../data/schemas/defs-scenes/refs-narratives';
import type { Scene } from '../../state/scene';
import type { WorldMap } from '../../state/worldMap';
import type { CreatureData } from '../../data';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { ListRow } from '../ListRow';
import { GatedAction, raisonSi } from '../GatedAction';
import { NumberField } from '../NumberField';

/**
 * Éditeur du bloc NARRATIF d'un paquet de campagne (#765) — overlay plein-champ (`ScreenShell`, même
 * coquille que la Carte du monde). Les onglets Affaires/Indices (#670), Documents (#679) et PNJ (#671
 * lot B) sont ÉDITABLES ; l'onglet Objets reste en lecture. Frontière RÉFÉRENCE vs NARRATIF : ces entrées
 * référencent la règle globale PAR ID.
 */
type NarratifTab = 'cadre' | 'affaires' | 'indices' | 'documents' | 'presetsPnj' | 'objets';

/** Liste des créatures globales (base d'un preset), triée par libellé — patron `Inspector.tsx`. */
const optionsDeCreature = memoParVersion('creatures', () => [...creatures].map((c) => ({ id: c.id, label: c.label })).sort((a, b) => a.label.localeCompare(b.label)));

/** Id frais `<prefixe>-<n>` — `n` part de la taille de la liste `depuis` + 1 — qu'aucune entrée de `pris`
 *  ne porte. */
function idFrais(prefixe: string, depuis: readonly { id?: string }[], pris: readonly { id?: string }[] = depuis): string {
  let n = depuis.length + 1;
  while (pris.some((e) => e.id === `${prefixe}-${n}`)) n++;
  return `${prefixe}-${n}`;
}

/** Les entrées de TOUS les registres du narratif (`REGISTRES_NARRATIFS`) : l'id frais d'un registre n'en
 *  recoupe aucune (unicité inter-registres de `narratifSchema`). Un stade, lui, n'est unique que DANS son
 *  indice. */
const entreesDuNarratif = (narratif: NarratifBlock): readonly { id?: string }[] =>
  REGISTRES_NARRATIFS.flatMap((r) => narratif[r.cle] as readonly { id?: string }[]);

/** Un id candidat est déjà pris par une AUTRE entrée d'un registre narratif (`REGISTRES_NARRATIFS`),
 *  hors l'entrée elle-même. Collision inter-registres gardée ici ; collision avec un id global reste
 *  vérifiée par `narratifSchema` au parse. */
function idUsedElsewhere(
  narratif: NarratifBlock,
  candidate: string,
  self: { registre: CleDeRegistreNarratif; id: string },
): boolean {
  return REGISTRES_NARRATIFS.some((r) =>
    (narratif[r.cle] as readonly { id: string }[]).some((e) => e.id === candidate && !(r.cle === self.registre && e.id === self.id)),
  );
}

/** Le projet ÉDITÉ, tel que l'éditeur le détient : ses scènes (l'active en tête), sa carte du monde,
 *  son narratif. Un renommage d'entrée du narratif réécrit ses références PARTOUT (`renommeRef`). */
export interface ProjetEdite {
  scenes: Scene[];
  worldMap: WorldMap | null;
  narratif: NarratifBlock;
}

/** La raison qui refuse de retirer une entrée encore désignée : les lieux qui la désignent. */
function raisonDeRefus(projet: ProjetEdite, cible: CibleNarrative): string | undefined {
  const sites = referencesA(projet, cible);
  return sites.length ? `Encore désigné par : ${lieuxDesSites(projet, sites)} — changez ou retirez ces références d'abord.` : undefined;
}

export function NarratifEditor({ projet, onChange, onClose }: {
  projet: ProjetEdite;
  /** Chemin d'écriture (#671 lot B) — toute mutation produit un projet neuf (immutable) ; seules les
   *  racines touchées changent d'identité. Un renommage porte son `Renommage`, pour que le détenteur
   *  d'un historique le propage aussi aux instantanés. */
  onChange?: (p: ProjetEdite, renommage?: Renommage) => void;
  onClose: () => void;
}) {
  const narratif = projet.narratif;
  const [tab, setTab] = useState<NarratifTab>('affaires');
  const [selId, setSelId] = useState<string | null>(narratif.presetsPnj[0]?.id ?? null);
  const [selAffaireId, setSelAffaireId] = useState<string | null>(narratif.affaires[0]?.id ?? null);
  const [selIndiceId, setSelIndiceId] = useState<string | null>(narratif.indices[0]?.id ?? null);
  const [selDocumentId, setSelDocumentId] = useState<string | null>(narratif.documents[0]?.id ?? null);

  const poserNarratif = (n: NarratifBlock) => onChange?.({ ...projet, narratif: n });

  /** Renomme l'entrée `id` du `registre` et PROPAGE le renommage à toute référence du projet
   *  (`renommeRef`) ; `suite` achève le narratif renommé (les `refs` d'indice). Rend le nouvel id, ou
   *  `null` si refusé (vide, ou déjà porté par une entrée d'un registre). */
  const renommeEntree = (registre: RegistreReference, id: string, nextId: string, suite = (n: NarratifBlock) => n): string | null => {
    const trimmed = nextId.trim();
    if (!trimmed || idUsedElsewhere(narratif, trimmed, { registre, id })) return null;
    const p = renommeRef(projet, { registre, id }, trimmed);
    const liste = (p.narratif[registre] as readonly { id: string }[]).map((e) => (e.id === id ? { ...e, id: trimmed } : e));
    onChange?.({ ...p, narratif: suite({ ...p.narratif, [registre]: liste }) }, { cible: { registre, id }, nouveau: trimmed });
    return trimmed;
  };
  /** Retire l'entrée `id` du `registre`. La seule porte du retrait est `BoutonRetirer` (`raisonDeRefus`). */
  const retireEntree = (registre: RegistreReference, id: string, suite = (n: NarratifBlock) => n) =>
    poserNarratif(suite({ ...narratif, [registre]: (narratif[registre] as readonly { id: string }[]).filter((e) => e.id !== id) }));

  const setPresets = (presetsPnj: PresetPnj[]) => poserNarratif({ ...narratif, presetsPnj });

  const addPreset = () => {
    const id = idFrais('pnj', narratif.presetsPnj, entreesDuNarratif(narratif));
    // Base par défaut = première créature globale : garantit un preset VALIDE au round-trip
    // (`narratifSchema` refuse un preset sans base ni profil) ; l'auteur la change ensuite.
    setPresets([...narratif.presetsPnj, { id, base: optionsDeCreature()[0]?.id }]);
    setSelId(id);
  };

  const removePreset = (id: string) => {
    retireEntree('presetsPnj', id);
    if (selId === id) setSelId(null);
  };

  const updatePreset = (id: string, patch: Partial<PresetPnj>) => {
    setPresets(narratif.presetsPnj.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const renamePreset = (id: string, nextId: string) => {
    const nouveau = renommeEntree('presetsPnj', id, nextId);
    if (nouveau && selId === id) setSelId(nouveau);
  };

  const selected = narratif.presetsPnj.find((p) => p.id === selId) ?? null;

  const setAffaires = (affaires: Affaire[]) => poserNarratif({ ...narratif, affaires });

  const addAffaire = () => {
    const id = idFrais('affaire', narratif.affaires, entreesDuNarratif(narratif));
    setAffaires([...narratif.affaires, { id, titre: 'Nouvelle affaire' }]);
    setSelAffaireId(id);
  };

  const removeAffaire = (id: string) => {
    retireEntree('affaires', id);
    if (selAffaireId === id) setSelAffaireId(null);
  };

  const updateAffaire = (id: string, patch: Partial<Affaire>) => {
    setAffaires(narratif.affaires.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const renameAffaire = (id: string, nextId: string) => {
    const nouveau = renommeEntree('affaires', id, nextId);
    if (nouveau && selAffaireId === id) setSelAffaireId(nouveau);
  };

  const selectedAffaire = narratif.affaires.find((a) => a.id === selAffaireId) ?? null;

  const setIndices = (indices: Indice[]) => poserNarratif({ ...narratif, indices });

  const addIndice = () => {
    // Aucune affaire à rattacher : `narratifSchema` rejette un `affaireId` orphelin — no-op, le bouton
    // appelant est désactivé dans ce cas (garantit un indice VALIDE au round-trip, même esprit qu'`addPreset`).
    const firstAffaireId = narratif.affaires[0]?.id;
    if (!firstAffaireId) return;
    const id = idFrais('indice', narratif.indices, entreesDuNarratif(narratif));
    setIndices([...narratif.indices, { id, affaireId: firstAffaireId, kind: 'indice', titre: 'Nouvel indice', stades: [{ id: 'stade-1', prose: '' }] }]);
    setSelIndiceId(id);
  };

  /** Les `refs` d'indice (recoupements) ne sont pas une clé de `REFERENCES_NARRATIVES` : un recoupement
   *  vers l'indice retiré tombe avec lui, un recoupement vers l'indice renommé le suit. */
  const refsSans = (id: string) => (n: NarratifBlock): NarratifBlock => ({
    ...n,
    indices: n.indices.map((i) => {
      if (!i.refs?.includes(id)) return i;
      const refs = i.refs.filter((r) => r !== id);
      return { ...i, refs: refs.length ? refs : undefined };
    }),
  });
  const refsVers = (id: string, nouveau: string) => (n: NarratifBlock): NarratifBlock => ({
    ...n,
    indices: n.indices.map((i) => (i.refs?.includes(id) ? { ...i, refs: i.refs.map((r) => (r === id ? nouveau : r)) } : i)),
  });

  const removeIndice = (id: string) => {
    retireEntree('indices', id, refsSans(id));
    if (selIndiceId === id) setSelIndiceId(null);
  };

  const updateIndice = (id: string, patch: Partial<Indice>) => {
    setIndices(narratif.indices.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const renameIndice = (id: string, nextId: string) => {
    const nouveau = renommeEntree('indices', id, nextId, refsVers(id, nextId.trim()));
    if (nouveau && selIndiceId === id) setSelIndiceId(nouveau);
  };

  /** Renomme le stade `from` de l'indice `indiceId` et le propage aux Effects qui le désignent. */
  const renameStade = (indiceId: string, from: string, nextId: string) => {
    const trimmed = nextId.trim();
    const ind = narratif.indices.find((i) => i.id === indiceId);
    if (!ind || !trimmed || ind.stades.some((s) => s.id !== from && s.id === trimmed)) return;
    const cible: CibleNarrative = { registre: 'indices', id: indiceId, stade: from };
    const p = renommeRef(projet, cible, trimmed);
    const indices = p.narratif.indices.map((i) => (i.id === indiceId ? { ...i, stades: i.stades.map((s) => (s.id === from ? { ...s, id: trimmed } : s)) } : i));
    onChange?.({ ...p, narratif: { ...p.narratif, indices } }, { cible, nouveau: trimmed });
  };

  const selectedIndice = narratif.indices.find((i) => i.id === selIndiceId) ?? null;

  const setDocuments = (documents: DocumentNarratif[]) => poserNarratif({ ...narratif, documents });

  const addDocument = () => {
    const id = idFrais('document', narratif.documents, entreesDuNarratif(narratif));
    setDocuments([...narratif.documents, { id, titre: 'Nouveau document', prose: '' }]);
    setSelDocumentId(id);
  };

  const removeDocument = (id: string) => {
    retireEntree('documents', id);
    if (selDocumentId === id) setSelDocumentId(null);
  };

  const updateDocument = (id: string, patch: Partial<DocumentNarratif>) => {
    setDocuments(narratif.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const renameDocument = (id: string, nextId: string) => {
    const nouveau = renommeEntree('documents', id, nextId);
    if (nouveau && selDocumentId === id) setSelDocumentId(nouveau);
  };

  const selectedDocument = narratif.documents.find((d) => d.id === selDocumentId) ?? null;

  const setOuverture = (ouverture: OuvertureBlock | undefined) => poserNarratif({ ...narratif, ouverture });
  const setCloture = (cloture: ClotureBlock | undefined) => poserNarratif({ ...narratif, cloture });

  const tabs: TabItem<NarratifTab>[] = [
    { key: 'cadre', label: 'Cadre', count: (narratif.ouverture ? 1 : 0) + (narratif.cloture ? 1 : 0) },
    { key: 'affaires', label: 'Affaires', count: narratif.affaires.length },
    { key: 'indices', label: 'Indices', count: narratif.indices.length },
    { key: 'documents', label: 'Documents', count: narratif.documents.length },
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
            </>
          }
          action={
            <button type="button" className="btn small" onClick={addAffaire}>
              <Icon id="ui/add" size="sm" /> Ajouter une affaire
            </button>
          }
          detail={
            selectedAffaire
              ? <AffaireForm
                  affaire={selectedAffaire}
                  refus={raisonDeRefus(projet, { registre: 'affaires', id: selectedAffaire.id })}
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
            </>
          }
          action={
            <GatedAction
              id="ajouter-indice"
              label={<><Icon id="ui/add" size="sm" /> Ajouter un indice</>}
              enabled={narratif.affaires.length > 0}
              {...raisonSi(narratif.affaires.length === 0 ? 'Créez d’abord une affaire.' : undefined)}
              onClick={addIndice}
              primary={false}
              btnClassName="small"
            />
          }
          detail={
            selectedIndice
              ? <IndiceForm
                  indice={selectedIndice}
                  narratif={narratif}
                  affaires={narratif.affaires}
                  otherIndices={narratif.indices.filter((i) => i.id !== selectedIndice.id)}
                  onRename={(nextId) => renameIndice(selectedIndice.id, nextId)}
                  onPatch={(patch) => updateIndice(selectedIndice.id, patch)}
                  onRenameStade={(from, nextId) => renameStade(selectedIndice.id, from, nextId)}
                  refusDeStade={(stade) => raisonDeRefus(projet, { registre: 'indices', id: selectedIndice.id, stade })}
                  refus={raisonDeRefus(projet, { registre: 'indices', id: selectedIndice.id })}
                  onRemove={() => removeIndice(selectedIndice.id)}
                />
              : <p className="empty">Sélectionnez un indice à éditer, ou ajoutez-en un.</p>
          }
        />
      )}
      {tab === 'documents' && (
        <MasterDetail
          listLabel="Documents"
          list={
            <>
              {narratif.documents.length === 0
                ? <p className="empty">Aucun document dans cette campagne.</p>
                : narratif.documents.map((d) => (
                    <ListRow key={d.id} selected={d.id === selDocumentId} onClick={() => setSelDocumentId(d.id)} label={d.titre}>
                      <span className="chip">{d.id}</span>
                    </ListRow>
                  ))}
            </>
          }
          action={
            <button type="button" className="btn small" onClick={addDocument}>
              <Icon id="ui/add" size="sm" /> Ajouter un document
            </button>
          }
          detail={
            selectedDocument
              ? <DocumentForm
                  doc={selectedDocument}
                  refus={raisonDeRefus(projet, { registre: 'documents', id: selectedDocument.id })}
                  onRename={(nextId) => renameDocument(selectedDocument.id, nextId)}
                  onPatch={(patch) => updateDocument(selectedDocument.id, patch)}
                  onRemove={() => removeDocument(selectedDocument.id)}
                />
              : <p className="empty">Sélectionnez un document à éditer, ou ajoutez-en un.</p>
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
                    <ListRow key={p.id} selected={p.id === selId} onClick={() => setSelId(p.id)} label={LIBELLE_NARRATIF.presetsPnj(p)}>
                      <span className="chip">{p.id}</span>
                    </ListRow>
                  ))}
            </>
          }
          action={
            <button type="button" className="btn small" onClick={addPreset}>
              <Icon id="ui/add" size="sm" /> Ajouter un PNJ
            </button>
          }
          detail={
            selected
              ? <PresetForm
                  preset={selected}
                  onRename={(nextId) => renamePreset(selected.id, nextId)}
                  onPatch={(patch) => updatePreset(selected.id, patch)}
                  refus={raisonDeRefus(projet, { registre: 'presetsPnj', id: selected.id })}
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
          <ProseField label="Pitch (verbatim de la source, Markdown)" value={ouverture.pitch} onChange={(pitch) => patchOuv({ pitch })} />
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
function AffaireForm({ affaire, refus, onRename, onPatch, onRemove }: {
  affaire: Affaire;
  refus: string | undefined;
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
      <ProseField label="Description" value={affaire.desc ?? ''} onChange={(desc) => onPatch({ desc: desc || undefined })} />
      <BoutonRetirer id={`supprimer-affaire-${affaire.id}`} libelle="Supprimer cette affaire" refus={refus} onRemove={onRemove} />
    </div>
  );
}

/** Formulaire d'un document remis au joueur (#679) : identité + titre + prose Markdown VERBATIM + source,
 *  suppression bloquée tant qu'un stade d'indice le croise. */
function DocumentForm({ doc, refus, onRename, onPatch, onRemove }: {
  doc: DocumentNarratif;
  refus: string | undefined;
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<DocumentNarratif>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="preset-form">
      <label className="ed-field">
        Identifiant (id stable)
        <input value={doc.id} onChange={(e) => onRename(e.target.value)} />
      </label>
      <label className="ed-field">
        Titre
        <input value={doc.titre} onChange={(e) => onPatch({ titre: e.target.value })} />
      </label>
      <ProseField label="Texte (verbatim de la source, Markdown)" value={doc.prose} onChange={(prose) => onPatch({ prose })} />
      <SourceRefField label="Source du document" value={doc.source} onChange={(source) => onPatch({ source })} />
      <BoutonRetirer id={`supprimer-document-${doc.id}`} libelle="Supprimer ce document" refus={refus} onRemove={onRemove} />
    </div>
  );
}

/** Retrait d'une entrée du narratif, REFUSÉ tant qu'une référence la désigne : la raison nomme les
 *  lieux qui la désignent (`raisonDeRefus`). */
function BoutonRetirer({ id, libelle, refus, onRemove }: { id: string; libelle: string; refus: string | undefined; onRemove: () => void }) {
  return (
    <GatedAction
      id={id}
      label={<><Icon id="ui/delete" size="sm" /> {libelle}</>}
      enabled={!refus}
      {...raisonSi(refus)}
      onClick={onRemove}
      primary={false}
      btnClassName="small danger"
    />
  );
}

/** Formulaire d'un indice/rumeur : identité + affaire + nature + titre + recoupements + stades révélables. */
function IndiceForm({ indice, narratif, affaires, otherIndices, onRename, onPatch, onRenameStade, refusDeStade, refus, onRemove }: {
  indice: Indice;
  narratif: NarratifBlock;
  affaires: Affaire[];
  otherIndices: Indice[];
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<Indice>) => void;
  /** Renomme un stade ET propage le renommage aux Effects qui le désignent. */
  onRenameStade: (from: string, nextId: string) => void;
  /** Raison qui refuse de retirer ce stade (des Effects le désignent), ou `undefined`. */
  refusDeStade: (stade: string) => string | undefined;
  refus: string | undefined;
  onRemove: () => void;
}) {
  const toggleRef = (id: string) => {
    const refs = indice.refs ?? [];
    const next = refs.includes(id) ? refs.filter((r) => r !== id) : [...refs, id];
    onPatch({ refs: next.length ? next : undefined });
  };

  const setStades = (stades: IndiceStade[]) => onPatch({ stades });
  const addStade = () => setStades([...indice.stades, { id: idFrais('stade', indice.stades), prose: '' }]);
  /** Un indice garde au moins un stade ; un stade qu'un Effect désigne ne se retire pas. */
  const refusDuRetrait = (id: string): string | undefined =>
    (indice.stades.length <= 1 ? 'Un indice garde au moins un stade.' : refusDeStade(id));
  const removeStade = (id: string) => setStades(indice.stades.filter((s) => s.id !== id));
  const updateStade = (id: string, patch: Partial<IndiceStade>) => {
    setStades(indice.stades.map((s) => (s.id === id ? { ...s, ...patch } : s)));
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
            <label className="ed-field">
              Id du stade
              <input value={s.id} onChange={(e) => onRenameStade(s.id, e.target.value)} />
            </label>
            {/* Au moins la prose ou le document (`raffineNarratif`). */}
            <ProseField
              label={`Prose (stade ${idx + 1}${s.documentId ? ', facultative : le stade croise un document' : ''})`}
              value={s.prose ?? ''}
              onChange={(prose) => updateStade(s.id, { prose: prose || !s.documentId ? prose : undefined })}
            />
            <RefNarrativeField
              cle="documentId"
              narratif={narratif}
              label="Document croisé"
              value={s.documentId}
              onChange={(documentId) => updateStade(s.id, { documentId, prose: documentId ? s.prose : (s.prose ?? '') })}
              nullable
            />
            <SourceRefField label="Source du stade" value={s.source} onChange={(source) => updateStade(s.id, { source })} />
            <BoutonRetirer id={`supprimer-stade-${indice.id}-${s.id}`} libelle="Supprimer ce stade" refus={refusDuRetrait(s.id)} onRemove={() => removeStade(s.id)} />
          </div>
        ))}
        <button type="button" className="btn small" onClick={addStade}>
          <Icon id="ui/add" size="sm" /> Ajouter un stade
        </button>
      </div>
      <BoutonRetirer id={`supprimer-indice-${indice.id}`} libelle="Supprimer cet indice" refus={refus} onRemove={onRemove} />
    </div>
  );
}

/** Formulaire d'un preset de PNJ : identité + base + surcharges de caracs + apparence + portrait + source. */
function PresetForm({ preset, onRename, onPatch, refus, onRemove }: {
  preset: PresetPnj;
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<PresetPnj>) => void;
  refus: string | undefined;
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
  /** Pose l'apparence suivante (retire `apparence` si elle redevient vide). */
  const poserApparence = (next: EntityAppearance) => onPatch({ apparence: Object.keys(next).length ? next : undefined });

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
        <ReglagesApparence appearance={appearance} onChange={poserApparence} reglages={['species', 'sex', 'build', 'hairstyle']}
          nuee={isSwarm(base ? mergeCreatureProfile(base, profil).traits : profil.traits)} />
      </div>
      <MonsterPartsFields appearance={appearance} onChange={poserApparence} reglages={['monster', 'eyes', 'features', 'tenue', 'colors']} />
      <label className="ed-field">
        Portrait (id d'illustration)
        <input
          value={preset.portrait ?? ''}
          placeholder="id du registre d'art"
          onChange={(e) => onPatch({ portrait: e.target.value || undefined })}
        />
      </label>
      <SourceRefField label="Source du PNJ" value={preset.source} onChange={(source) => onPatch({ source })} />
      <BoutonRetirer id={`supprimer-preset-${preset.id}`} libelle="Supprimer ce PNJ" refus={refus} onRemove={onRemove} />
    </div>
  );
}

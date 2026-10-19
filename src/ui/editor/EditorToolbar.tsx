/**
 * Barre d'outils de l'éditeur v2 : menu « Fichier ▾ » (fini les 8 boutons à plat du POC),
 * annuler/rétablir, SÉLECTEUR DE SCÈNE du projet (+ nouvelle / dupliquer / retirer — remplace
 * la liste de l'ancien onglet « Scène »), carte du monde et ▶ Tester.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import type { Scene } from '../../state/scene';
import { publierEditeur } from '../../state/editeurBridge';
import { Icon } from '../Icon';
import { ENTREE_DE_MENU, Menu, type EntreeDeMenu } from '../composites/Menu';
import { useBoutonAPopup } from '../composites/boutonAPopup';

export function EditorToolbar({
  onBack,
  projectName,
  onNew,
  onOpen,
  onSave,
  onImport,
  onExport,
  onExportAscii,
  onExportDepot,
  onAdvanced,
  undo,
  redo,
  canUndo,
  canRedo,
  scenes,
  activeId,
  onSwitchScene,
  onAddScene,
  onDuplicateScene,
  onDeleteScene,
  worldCount,
  onWorld,
  narratifCount,
  onNarratif,
  onTest,
}: {
  onBack: () => void;
  projectName: string;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onImport: (f: File) => void;
  onExport: () => void;
  /** Ouvre la modale d'export ASCII (grilles `walled`/`zoneMap` de la scène active, cf. `sceneToAscii`). */
  onExportAscii: () => void;
  /** Export en FORME DÉPÔT (`projetVersDepot` : prose et ports), offert pour une campagne LIVRÉE ouverte,
   *  réservé au DEV : absent, l'entrée de menu n'existe pas. */
  onExportDepot?: () => void;
  onAdvanced: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Scènes du projet, l'active EN PREMIER. */
  scenes: Scene[];
  activeId: string;
  onSwitchScene: (id: string) => void;
  onAddScene: () => void;
  onDuplicateScene: () => void;
  onDeleteScene: () => void;
  worldCount: number | null;
  onWorld: () => void;
  /** Nombre d'entrées du bloc narratif du projet (affaires + indices + PNJ + objets), badge du bouton. */
  narratifCount: number;
  onNarratif: () => void;
  onTest: () => void;
}) {
  const fichier = useBoutonAPopup<HTMLDivElement>({ popup: 'menu', items: ENTREE_DE_MENU });
  const { ouvert: fileOpen, fermer } = fichier;
  // Échap passe par le REGISTRE (`editeur-echap`) : la commande n'est publiée au pont QUE tant que le
  // menu est ouvert — sa PRÉSENCE est ce qui donne la touche au menu plutôt qu'à la désélection.
  useEffect(() => {
    if (!fileOpen) return;
    return publierEditeur({ fermerMenuFichier: fermer });
  }, [fileOpen, fermer]);
  const importRef = useRef<HTMLInputElement>(null);
  const item = (cle: string, label: ReactNode, fn: () => void): EntreeDeMenu => ({
    cle,
    label,
    onSelect: () => {
      fermer();
      fn();
    },
  });
  const entrees: EntreeDeMenu[] = [
    item('nouveau', <><Icon id="file/new" size="sm" /> Nouveau projet</>, onNew),
    item('ouvrir', <><Icon id="file/open" size="sm" /> Ouvrir…</>, onOpen),
    item('enregistrer', <><Icon id="file/save" size="sm" /> Enregistrer…</>, onSave),
    { cle: 'sep-fichier', separateur: true },
    item('importer', <><Icon id="file/import" size="sm" /> Importer JSON…</>, () => importRef.current?.click()),
    item('exporter', <><Icon id="file/export" size="sm" /> Exporter JSON</>, onExport),
    item('exporter-ascii', <><Icon id="file/export" size="sm" /> Exporter ASCII (grilles carte)</>, onExportAscii),
    ...(onExportDepot ? [item('exporter-depot', <><Icon id="file/export" size="sm" /> Exporter forme dépôt (dev)</>, onExportDepot)] : []),
    { cle: 'sep-avance', separateur: true },
    item('avance', <><Icon id="ui/settings" size="sm" /> Avancé — JSON (dialogues, triggers, rencontres)</>, onAdvanced),
  ];

  return (
    <header className="bar editor-bar">
      <button className="btn small" onClick={onBack}>
        ← Menu
      </button>
      <h2 title={projectName}>Éditeur</h2>

      <div className="editor-file" {...fichier.racine}>
        <button {...fichier.declencheur} className="btn small">
          Fichier ▾
        </button>
        {fileOpen && <Menu entrees={entrees} label="Fichier" className="editor-menu panel" />}
        <input
          ref={importRef}
          type="file"
          accept="application/json"
          aria-label="Importer JSON"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onImport(f);
          }}
        />
      </div>

      <div className="editor-undo">
        <button className="btn small" onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
          ↶
        </button>
        <button className="btn small" onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Y)">
          ↷
        </button>
      </div>

      <div className="editor-scenes" title="Scènes du projet">
        <select value={activeId} onChange={(e) => onSwitchScene(e.target.value)} aria-label="Scène active">
          {scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label || s.id}
            </option>
          ))}
        </select>
        <button className="btn small" onClick={onAddScene} title="Nouvelle scène dans le projet">
          ＋
        </button>
        <button className="btn small" onClick={onDuplicateScene} title="Dupliquer la scène active">
          ⧉
        </button>
        <button className="btn small danger" onClick={onDeleteScene} disabled={scenes.length <= 1} title="Retirer la scène active du projet">
          ✕
        </button>
      </div>

      <div className="editor-toolbar">
        <button className="btn small" onClick={onWorld} title="Carte du monde du projet : lieux, routes, voyage">
          <Icon id="nav/campaign" size="sm" /> Monde{worldCount !== null ? ` (${worldCount})` : ''}
        </button>
        <button className="btn small" onClick={onNarratif} title="Narratif du projet : affaires, indices, PNJ, objets">
          <Icon id="nav/compendium" size="sm" /> Narratif{narratifCount > 0 ? ` (${narratifCount})` : ''}
        </button>
        <button className="btn small btn-primary" onClick={onTest}>
          ▶ Tester
        </button>
      </div>
    </header>
  );
}

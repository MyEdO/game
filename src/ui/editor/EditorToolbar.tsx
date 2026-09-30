/**
 * Barre d'outils de l'éditeur v2 : menu « Fichier ▾ » (fini les 8 boutons à plat du POC),
 * annuler/rétablir, SÉLECTEUR DE SCÈNE du projet (+ nouvelle / dupliquer / retirer — remplace
 * la liste de l'ancien onglet « Scène »), carte du monde et ▶ Tester.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Scene } from '../../state/scene';
import { publierEditeur } from '../../state/editeurBridge';
import { Icon } from '../Icon';

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
  const [fileOpen, setFileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Fermeture du menu au clic extérieur. Échap passe par le REGISTRE (`editeur-echap`) : la commande
  // n'est publiée au pont QUE tant que le menu est ouvert — sa PRÉSENCE est ce qui donne la touche au
  // menu plutôt qu'à la désélection.
  useEffect(() => {
    if (!fileOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setFileOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    const retirer = publierEditeur({ fermerMenuFichier: () => setFileOpen(false) });
    return () => {
      document.removeEventListener('pointerdown', onDown);
      retirer();
    };
  }, [fileOpen]);
  const item = (label: ReactNode, fn: () => void) => (
    <button
      className="menu-item"
      onClick={() => {
        setFileOpen(false);
        fn();
      }}
    >
      {label}
    </button>
  );

  return (
    <header className="bar editor-bar">
      <button className="btn small" onClick={onBack}>
        ← Menu
      </button>
      <h2 title={projectName}>Éditeur</h2>

      <div className="editor-file" ref={menuRef}>
        <button className="btn small" onClick={() => setFileOpen(!fileOpen)} aria-haspopup="menu" aria-expanded={fileOpen}>
          Fichier ▾
        </button>
        {fileOpen && (
          <div className="editor-menu panel" role="menu">
            {item(<><Icon id="file/new" size="sm" /> Nouveau projet</>, onNew)}
            {item(<><Icon id="file/open" size="sm" /> Ouvrir…</>, onOpen)}
            {item(<><Icon id="file/save" size="sm" /> Enregistrer…</>, onSave)}
            <hr />
            <label className="menu-item">
              <Icon id="file/import" size="sm" /> Importer JSON…
              <input
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) {
                    setFileOpen(false);
                    onImport(f);
                  }
                }}
              />
            </label>
            {item(<><Icon id="file/export" size="sm" /> Exporter JSON</>, onExport)}
            {item(<><Icon id="file/export" size="sm" /> Exporter ASCII (grilles carte)</>, onExportAscii)}
            {onExportDepot && item(<><Icon id="file/export" size="sm" /> Exporter forme dépôt (dev)</>, onExportDepot)}
            <hr />
            {item(<><Icon id="ui/settings" size="sm" /> Avancé — JSON (dialogues, triggers, rencontres)</>, onAdvanced)}
          </div>
        )}
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

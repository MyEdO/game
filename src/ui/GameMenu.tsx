import { useRef, useState } from 'react';
import { useGame } from '../state/store';
import { useModalA11y } from './Modal';
import { ScreenMeta } from './ScreenMeta';
import { MenuCard, MenuCardHead, MenuSection, MenuButton, MenuSubScreen } from './MenuCard';
import { OptionsSubScreen } from './OptionsScreen';
import { CoopMenuSection, GmSoloToggle } from './CoopPanels';
import { t } from '../i18n';

/**
 * Menu SYSTÈME plein écran (pause) — bouton ☰ de la barre HUD ET touche Échap (binding `toggle-menu`,
 * `state.gameMenuOpen`) l'ouvrent quand aucune modale n'est active. Voile sombre + colonne d'entrées :
 * MÊME langage que le menu principal (`MainMenu`), tous deux composant `MenuCard`. Contenu STRICT à six
 * entrées (Reprendre · Sauvegarder/Charger · Coopération · Options · Fin de séance · Quitter) ; la
 * Coopération et les Options sont des SOUS-ÉCRANS (retour au menu), jamais des widgets inline.
 * A11y de dialogue (`role="dialog"`, focus piégé, Échap = Retour/Fermer) via `useModalA11y`. Pur à props
 * pour ce qui délègue vers le haut (Sauvegarder/Charger, Fin de séance, Quitter) ; le reste est composé ici.
 */
type MenuView = 'root' | 'coop' | 'options';

export function GameMenu({ sceneName, time, onQuit, onSaveLoad, onEndSession, initialView = 'root', initialOpen = false }: {
  sceneName?: string;
  /** Horloge de campagne (minutes depuis l'époque) — méta d'en-tête discrète (lieu + date, jamais la bourse). */
  time: number;
  onQuit: () => void;
  /** Ouvre la modale Sauvegarder/Charger (Jalon 5) — absent en combat (sauvegarde refusée) ou chez l'invité. */
  onSaveLoad?: () => void;
  /** Ouvre l'écran de fin de séance (Ambitions + Détermination + Chance restaurée) — exploration seule. */
  onEndSession?: () => void;
  /** Sous-écran affiché à l'ouverture — aide de test (défaut `root`). */
  initialView?: MenuView;
  /** Force l'ouverture — aide de test (le rendu SSR de zustand v5 lit l'état INITIAL, pas `gameMenuOpen`). */
  initialOpen?: boolean;
}) {
  const storeOpen = useGame((s) => s.gameMenuOpen);
  const open = storeOpen || initialOpen;
  const setOpen = useGame((s) => s.setGameMenu);
  const [view, setView] = useState<MenuView>(initialView);
  const boxRef = useRef<HTMLDivElement>(null);

  const close = () => { setOpen(false); setView('root'); };
  // Une entrée qui délègue vers le haut FERME d'abord le menu (la modale/écran cible s'ouvre par-dessus la scène).
  const act = (fn?: () => void) => () => { close(); fn?.(); };
  // Échap / bouton Retour : UN APPUI = UN ÉCHELON — depuis un sous-écran on remonte au menu, et le
  // menu RESTE à l'écran, donc sa couche reste empilée (`false`, #1752) ; à la racine, on ferme.
  const back = (): boolean | void => { if (view !== 'root') { setView('root'); return false; } close(); };
  useModalA11y(boxRef, back, { kind: 'menu-systeme', actif: open, etape: view }); // monté en PERMANENCE : fermé, il n'est aucune couche

  return (
    <div className="game-menu">
      <button
        type="button"
        className="gm-btn skin-tole"
        data-ton="laiton"
        aria-label={open ? t('gameMenu.close') : t('gameMenu.menu')}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={open ? t('gameMenu.close') : t('gameMenu.menu')}
        onClick={() => (open ? close() : setOpen(true))}
      >
        ☰
      </button>
      {open && (
        <div className="game-menu-overlay" role="dialog" aria-modal="true" aria-label={t('gameMenu.menu')} ref={boxRef}>
          {view === 'root' && (
            <MenuCard
              className="game-menu-card"
              header={<MenuCardHead
                title={t('gameMenu.menu')}
                sub={sceneName ? <>{t('gameMenu.scene')} — {sceneName}</> : undefined}
                meta={<ScreenMeta meta={{ time }} />}
              />}
            >
              <MenuSection rule={false}>
                <MenuButton icon="ui/round-start" onClick={close}>{t('gameMenu.resume')}</MenuButton>
                <MenuButton icon="file/save" onClick={act(onSaveLoad)} refus={onSaveLoad ? undefined : 'Indisponible en combat'}>{t('gameMenu.saveLoad')}</MenuButton>
                <MenuButton icon="nav/online" onClick={() => setView('coop')}>{t('gameMenu.section.coop')}</MenuButton>
                <MenuButton icon="ui/settings" onClick={() => setView('options')}>{t('gameMenu.options')}</MenuButton>
                <MenuButton icon="resource/xp" onClick={act(onEndSession)} refus={onEndSession ? undefined : 'Indisponible en combat'}>{t('gameMenu.endSession')}</MenuButton>
                <MenuButton icon="map-tool/door" onClick={onQuit}>{t('gameMenu.quit')}</MenuButton>
              </MenuSection>
            </MenuCard>
          )}

          {view === 'coop' && (
            <MenuSubScreen title={t('gameMenu.section.coop')} onBack={back} wide>
              <p className="hint">{t('gameMenu.coop.hint')}</p>
              <CoopMenuSection />
              <GmSoloToggle />
            </MenuSubScreen>
          )}

          {view === 'options' && (
            <OptionsSubScreen onBack={back} />
          )}
        </div>
      )}
    </div>
  );
}

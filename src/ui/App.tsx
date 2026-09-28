import { lazy, Suspense, useEffect } from 'react';
import { useGame } from '../state/store';
import { loadHouseRules } from '../state/houseRules';
import { loadPreferences } from '../state/preferences';
import { MainMenu } from './MainMenu';
import { PartyScreen } from './PartyScreen';
import { CharacterCreator } from './creator/CharacterCreator';
import { GlobalSvgDefs } from './GlobalSvgDefs';
import { CoopBanner, liaisonASignaler } from './CoopPanels';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { PossessionsScreen } from './PossessionsScreen';
import { useGameKeyboard } from './useGameKeyboard';

// Le rendu de jeu (iso SVG + sprites du bestiaire) et l'éditeur d'authoring ne
// sont pas nécessaires à l'écran menu : chunks async séparés (React.lazy) pour
// alléger le démarrage. Un joueur n'ouvre jamais l'éditeur.
const CampaignView = lazy(() => import('./CampaignView').then((m) => ({ default: m.CampaignView })));
const Editor = lazy(() => import('./editor/Editor').then((m) => ({ default: m.Editor })));
const TestScenariosScreen = lazy(() => import('./TestScenariosScreen').then((m) => ({ default: m.TestScenariosScreen })));
const InterludeScreen = lazy(() => import('./InterludeScreen').then((m) => ({ default: m.InterludeScreen })));
const MassBattleView = lazy(() => import('./MassBattleView').then((m) => ({ default: m.MassBattleView })));
const CoopLobby = lazy(() => import('./CoopLobby').then((m) => ({ default: m.CoopLobby })));
const CompendiumScreen = lazy(() => import('./compendium/CompendiumScreen').then((m) => ({ default: m.CompendiumScreen })));
const CodexOverlay = lazy(() => import('./compendium/CompendiumScreen').then((m) => ({ default: m.CodexOverlay })));
// #304 : bandeau DEV du collecteur d'erreurs — chunk async chargé SEULEMENT en dev (garde statique
// `import.meta.env.DEV`, éliminée au build prod par Vite/Rollup) ; en prod le collecteur reste actif
// (installErrorCollector dans main.tsx) mais sans bandeau, export via `window.__wfrp.errors()`.
const ErrorCollectorBanner = import.meta.env.DEV
  ? lazy(() => import('./ErrorCollectorBanner').then((m) => ({ default: m.ErrorCollectorBanner })))
  : null;
// Galerie design system (#412) : écran DEV-only — même garde statique que le bandeau du collecteur
// d'erreurs (`import.meta.env.DEV`, éliminée au build prod par Vite/Rollup).
const DesignGallery = import.meta.env.DEV
  ? lazy(() => import('./gallery/DesignGallery').then((m) => ({ default: m.DesignGallery })))
  : null;

/** Le bandeau de liaison coop, monté au-dessus de l'écran courant : sa matière et sa lecture de la
 *  vue réseau vivent avec les autres briques coop (`CoopPanels`), le foyer de montage est ICI. */
function BandeauLiaison() {
  const net = useGame((s) => s.net);
  const signal = liaisonASignaler(net);
  if (!signal) return null;
  return <CoopBanner icone={signal.icone}>{signal.texte}</CoopBanner>;
}

export function App() {
  // Raccourcis clavier de TOUTE l'application (registre unique `state/keybindings`) : UN SEUL
  // montage, au-dessus de tous les écrans — le `when` de chaque raccourci dit où il vit (l'éditeur y
  // a sa section, atteinte par le pont `editeurBridge`).
  useGameKeyboard();
  const screen = useGame((s) => s.screen);
  const codexOverlay = useGame((s) => s.codexOverlay);
  const possessionsScreen = useGame((s) => s.possessionsScreen);
  // Règles maison + préférences de confort persistées → registres (avant tout jet) ; lien d'invitation ?join=CODE → écran coop.
  useEffect(() => {
    loadHouseRules();
    loadPreferences();
    if (new URLSearchParams(location.search).get('join')) useGame.getState().setScreen('coop');
  }, []);
  return (
    // #225 : filet de DERNIER RECOURS — un crash de render N'IMPORTE OÙ dans l'app (menu, éditeur,
    // interlude…) retombe sur le menu principal plutôt que sur un écran vide. La boundary de
    // CampaignView (plus ciblée) intercepte déjà les crashs de la campagne avant qu'ils remontent ici.
    <SceneErrorBoundary
      className="app-error-boundary"
      message="Une erreur d'affichage est survenue. Votre partie n'est pas perdue."
      retryLabel="Revenir au menu"
      onRetry={() => useGame.getState().setScreen('menu')}
    >
      {/* L'écran COURANT est porté par le conteneur (`app-<screen>`) : quelques réglages de cadre en
          dépendent — le voile des modales de jet est ALLÉGÉ en combat pour garder le champ lisible,
          mais un écran plein-champ (interlude) a besoin du voile PLEIN pour séparer les niveaux. */}
      <div className={`app app-${screen}`}>
        <GlobalSvgDefs />
        <BandeauLiaison />
        <Suspense fallback={<div className="lazy-fallback" role="status">Chargement…</div>}>
          {screen === 'menu' && <MainMenu />}
          {screen === 'party' && <PartyScreen />}
          {screen === 'creator' && <CharacterCreator />}
          {screen === 'campaign' && <CampaignView />}
          {screen === 'editor' && <Editor />}
          {screen === 'test' && <TestScenariosScreen />}
          {screen === 'interlude' && <InterludeScreen />}
          {screen === 'massBattle' && <MassBattleView />}
          {screen === 'coop' && <CoopLobby />}
          {screen === 'compendium' && <CompendiumScreen />}
          {screen === 'gallery' && DesignGallery && <DesignGallery />}
          {/* Écran de gestion des Possessions du groupe (#762) : modale GLOBALE, atteignable depuis
              n'importe quel écran (campagne EN JEU comme roster) — même patron que `codexOverlay`. */}
          {possessionsScreen && (
            <PossessionsScreen
              onClose={() => useGame.getState().closePossessionsScreen()}
              initialUid={possessionsScreen.uid}
            />
          )}
        </Suspense>
        {/* Drill-in d'une réf Codex EN JEU : modale par-dessus l'écran courant (n'importe lequel),
            sans démonter le jeu/la fiche → musique et contexte préservés (cf. openCodex). Sa propre
            frontière `Suspense` : le chargement de la fiche ne remplace jamais l'écran qu'elle couvre. */}
        {codexOverlay && (
          <Suspense fallback={null}>
            <CodexOverlay />
          </Suspense>
        )}
        {ErrorCollectorBanner && (
          <Suspense fallback={null}>
            <ErrorCollectorBanner />
          </Suspense>
        )}
      </div>
    </SceneErrorBoundary>
  );
}

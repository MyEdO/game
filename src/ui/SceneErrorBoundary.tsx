import { Component, ReactNode } from 'react';
import { recordError } from './errorCollector';

export interface SceneErrorBoundaryProps {
  children: ReactNode;
  /** Classe CSS du conteneur de repli — défaut : rendu dans `.stage` (scène). #225 : passer
   *  `app-error-boundary` pour un filet de niveau application (n'importe où hors du stage). */
  className?: string;
  /** Message FR affiché — défaut : message de scène. */
  message?: string;
  /** Libellé du bouton de reprise — défaut « Recharger ». */
  retryLabel?: string;
  /** Action de reprise. Défaut ABSENT = rechargement de page (comportement historique : la scène
   *  peut avoir un état corrompu). Fournie = un simple retour au rendu normal (réessaie les
   *  enfants sans recharger) — le crash de rendu ne touche pas le store, la session survit. */
  onRetry?: () => void;
  /** CLÉ DE REPRISE : sa première valeur NEUVE (identité) après un crash relève le rendu, sans geste —
   *  la donnée qui a fait tomber les enfants a changé, ils se réessaient. Absente = seul le bouton
   *  relève. */
  cleDeReprise?: unknown;
}

interface State {
  crashed: boolean;
}

/** Garde de CLASSE (seul moyen React) : un crash de rendu (ex. #203/régression — TypeError sur une
 *  entité sans arme ; #225 — TypeError hors du stage, WorldMapView) démonte tout l'arbre React en
 *  silence et coûte la partie (écran noir). Capture, logue, et affiche un panneau de reprise EN
 *  FRANÇAIS au lieu de laisser l'écran noir. Réutilisée à DEUX niveaux : autour du stage (scène iso/
 *  POV, défaut = recharger) et autour de tout l'écran de jeu (#225, `onRetry` = simple reprise du
 *  rendu, la session en mémoire survit). Ne PEUT PAS être un composant fonction (pas de hook
 *  équivalent à `componentDidCatch`). */
export class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }): void {
    console.error('SceneErrorBoundary : crash de rendu', error, info.componentStack);
    recordError(error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : info.componentStack);
  }

  componentDidUpdate(prev: SceneErrorBoundaryProps): void {
    if (this.state.crashed && prev.cleDeReprise !== this.props.cleDeReprise) this.setState({ crashed: false });
  }

  handleRetry = (): void => {
    if (this.props.onRetry) {
      this.props.onRetry();
      this.setState({ crashed: false });
    } else {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.crashed) {
      return (
        <div className={this.props.className ?? 'stage scene-error-boundary'}>
          <div className="panel">
            <p>{this.props.message ?? 'La scène a rencontré une erreur de rendu.'}</p>
            <button type="button" className="btn" onClick={this.handleRetry}>
              {this.props.retryLabel ?? 'Recharger'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

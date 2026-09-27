import { useState } from 'react';
import { Modal } from '../Modal';
import { GatedAction } from '../GatedAction';
import { Icon } from '../Icon';
import { Scene } from '../../state/scene';
import { testScenarios, TestScenario } from '../../scenes/test-scenarios';
import { projectsLoad, projectRemove, nomDeProjet, SavedProject } from '../../state/projectLibrary';
import { allBuiltinCampaigns, BuiltinCampaign } from '../../scenes/campaign';
import { Row, Stack } from '../Layout';
import { exigerUnRefus, type ProjetRefuse } from '../../state/worldMap';
import { cheminLisible, type Faute, type SegmentDeLieu } from '../../data/schemas/validate';
import { projetDoc } from '../../data/schemas/defs-scenes/projet';

/** Un refus RENDU à l'auteur : `message` en mots d'auteur, `detail` = le rapport de la porte
 *  (`parseProject`), replié sous le message quand le message ne le reprend pas. */
export type RefusRendu = { message: string; detail?: string };

/** Le refus RENDU dans sa modale, en `role="alert"` : le message en `.chip.tone-danger`, le rapport
 *  replié derrière la primitive `.fold` (`components.css`), une ligne du rapport par bloc. */
export function ChipDeRefus({ refus }: { refus: RefusRendu }) {
  return (
    <Stack role="alert">
      <p className="chip tone-danger">{refus.message}</p>
      {refus.detail && (
        <details className="fold">
          <summary><span className="fold-title">Détail technique</span></summary>
          <div className="fold-body">
            {refus.detail.split('\n').map((ligne, i) => <div key={i}>{ligne}</div>)}
          </div>
        </details>
      )}
    </Stack>
  );
}

/**
 * Les gestes qui font passer un document par la porte du projet (`parseProject`, et
 * `migreSceneDeProjet` pour la reprise d'une sauvegarde locale), chacun avec le VERBE de son
 * refus, la CONSÉQUENCE qu'il ÉNONCE, et ce qu'il dit d'un projet SANS NOM. UNE table : ces chaînes
 * ne sont pas libres, un appelant ne peut pas les désaccorder — « Import refusé : ce projet ne
 * pourrait plus être rouvert » serait faux, rien n'ayant jamais été ouvert ni écrit.
 */
const GESTES_DE_PORTE = {
  ouverture: {
    verbe: 'Ouverture refusée',
    consequence: 'ce projet ne peut pas être ouvert',
    sansNom: 'Ce projet n’a pas de nom : impossible de l’ouvrir tel quel.',
  },
  enregistrement: {
    verbe: 'Enregistrement refusé',
    consequence: 'ce projet ne pourrait plus être rouvert',
    sansNom: 'Ce projet n’a pas de nom : impossible de l’enregistrer tel quel.',
  },
  export: {
    verbe: 'Export refusé',
    consequence: 'ce fichier ne pourrait plus être rouvert',
    sansNom: 'Ce projet n’a pas de nom : impossible de l’exporter tel quel.',
  },
  import: {
    verbe: 'Import refusé',
    consequence: 'ce fichier ne peut pas être ouvert',
    sansNom: 'Ce projet n’a pas de nom : impossible de l’importer tel quel.',
  },
  test: {
    verbe: 'Mise à l’essai refusée',
    consequence: 'ce projet ne pourrait pas être joué',
    sansNom: 'Ce projet n’a pas de nom : impossible de le mettre à l’essai tel quel.',
  },
  reprise: {
    verbe: 'Restauration refusée',
    consequence: 'cette sauvegarde locale ne peut pas être restaurée',
    sansNom: 'Cette sauvegarde locale n’a pas de nom : impossible de la restaurer telle quelle.',
  },
} as const;

/** Geste dont la porte du document peut opposer un refus — union FERMÉE. */
export type GesteDePorte = keyof typeof GESTES_DE_PORTE;

/** Une faute SANS NOM : elle porte sur `id` ou `label` à la racine du document — aucun réglage de
 *  contenu ne sauvera le projet. credo.md:7, 1ʳᵉ phrase. */
const estSansNom = (f: Faute): boolean => f.chemin.length === 1 && (f.chemin[0] === 'id' || f.chemin[0] === 'label');

/** Le lieu d'une faute en mots d'AUTEUR : le champ RACINE sous son LIBELLÉ de document
 *  (`projetDoc.meta`), chaque élément à clé par son libellé (sa clé à défaut). */
function lieuDAuteur(lieu: readonly SegmentDeLieu[]): string {
  const [racine, ...suite] = lieu;
  const libelleDe = (champ: string): string => projetDoc.meta[champ]?.label ?? champ;
  const tete: SegmentDeLieu | undefined =
    typeof racine === 'string' ? libelleDe(racine) : typeof racine === 'object' ? { ...racine, liste: libelleDe(racine.liste) } : racine;
  return cheminLisible(tete === undefined ? [] : [tete, ...suite], (element) => element.libelle ?? element.cle);
}

/** Ce qu'un refus HORS SCHÉMA dit à l'auteur, par CAUSE : le rapport technique reste en détail. */
const PHRASE_DE_CAUSE: Record<Exclude<ProjetRefuse['cause'], 'schema'>, string> = {
  version: 'Ce projet vient d’une version du jeu que celle-ci ne sait pas lire.',
  'mal-forme': 'Ce document n’est pas un projet lisible.',
  entree: 'Sa scène de départ n’existe pas dans le projet.',
};

/**
 * Traduit en refus d'ÉCRAN le refus que la porte oppose à un geste — UN traducteur pour tous les
 * gestes, qui lit la CAUSE et les fautes (`ProjetRefuse`), jamais le texte du rapport. Une version
 * illisible ou un document mal formé se disent en mots d'auteur ; un projet SANS NOM aussi. Sinon,
 * ce que l'auteur doit savoir tient en deux faits : la CONSÉQUENCE du refus, et OÙ est la première
 * faute ; les suivantes sont COMPTÉES. Le rapport de la porte reste en `detail` dès que le message
 * ne le reprend pas. Toute autre erreur n'est pas un refus de la porte : elle remonte telle quelle.
 */
export function refusDeLaPorteDuProjet(erreur: unknown, geste: GesteDePorte): RefusRendu {
  exigerUnRefus(erreur);
  const { verbe, consequence, sansNom } = GESTES_DE_PORTE[geste];
  if (erreur.cause !== 'schema') {
    return { message: `${verbe} : ${consequence}. ${PHRASE_DE_CAUSE[erreur.cause]}`, detail: erreur.message };
  }
  if (erreur.fautes.some(estSansNom)) return { message: sansNom, detail: erreur.message };
  const [premiere, ...autres] = erreur.fautes;
  const suite = autres.length > 0 ? ` (et ${autres.length} autre${autres.length > 1 ? 's' : ''} à corriger)` : '';
  // Une phrase reprend en MAJUSCULE après le point : `lieuDAuteur` rend un fragment (« Scènes … »),
  // il est donc INTRODUIT au lieu d'être recollé nu derrière la ponctuation.
  const message = `${verbe} : ${consequence}. Faute : ${lieuDAuteur(premiere.lieu)} — ${premiere.message}${suite}`;
  return autres.length > 0 ? { message, detail: erreur.message } : { message };
}

/** Refus d'un geste HORS de la porte (fichier qui n'est pas du JSON, groupe vide) : le verbe vient
 *  de la même table, le `motif` dit ce qui manque. */
export function refusMotive(geste: GesteDePorte, motif: string): RefusRendu {
  return { message: `${GESTES_DE_PORTE[geste].verbe} : ${motif}.` };
}

/** « Ouvrir » : reprendre un projet enregistré (localStorage), repartir d'une campagne du jeu
 *  (Arène + campagnes built-in — #367 : les fichiers `src/scenes/**‑projet.json` sont commités,
 *  jamais écrasés depuis l'éditeur, donc ouverture = COPIE de travail) ou d'un scénario de test. */
export function OpenProjectModal({
  onScenario,
  onProject,
  onBuiltin,
  onClose,
  error,
}: {
  onScenario: (sc: TestScenario) => void;
  onProject: (p: SavedProject) => void;
  onBuiltin: (bc: BuiltinCampaign) => void;
  onClose: () => void;
  /** Refus de la porte à l'ouverture d'un projet (#1552) — la modale reste ouverte et le DIT :
   *  `message` est écrit en mots d'auteur (règle 4), `detail` porte le rapport de la porte, replié. */
  error?: RefusRendu | null;
}) {
  const [projects, setProjects] = useState(() => projectsLoad());
  const [delError, setDelError] = useState<string | null>(null);
  const del = (id: string) => {
    setDelError(null);
    projectRemove(id).then((res) => {
      if (!res.ok) setDelError(res.message);
    });
    setProjects(projectsLoad());
  };

  return (
    <Modal variant="plain" className="wide" title="Ouvrir" onClose={onClose}>
      {error && <ChipDeRefus refus={error} />}
      {delError && <p className="chip tone-danger" role="alert">{delError}</p>}
      {projects.length > 0 && (
        <>
          <div className="mini-title">Mes projets</div>
          <Stack>
            {projects.map((p) => (
              <div className="listrow" key={p.id}>
                <span className="lr-name">{nomDeProjet(p.label)}</span>
                {p.published && <span className="chip">publiée</span>}
                <button className="btn small btn-primary" onClick={() => onProject(p)}>
                  Ouvrir
                </button>
                <button className="btn small danger" onClick={() => del(p.id)}>
                  Suppr.
                </button>
              </div>
            ))}
          </Stack>
        </>
      )}
      <div className="mini-title">Campagnes du jeu</div>
      <Stack>
        {allBuiltinCampaigns.map((bc) => (
          <div className="listrow" key={bc.id}>
            <span className="lr-name">
              <Icon id={bc.icon} size="sm" /> {bc.label}
            </span>
            <span className="chip">s’ouvre en copie</span>
            <button className="btn small btn-primary" onClick={() => onBuiltin(bc)}>
              Ouvrir
            </button>
          </div>
        ))}
      </Stack>
      <div className="mini-title">Scénarios de test</div>
      <Stack>
        {testScenarios.map((sc) => (
          <div className="listrow" key={sc.id}>
            <div className="lr-name">
              <Icon id={sc.icon} size="sm" /> {sc.title}
              <div className="hint">{sc.partyNote}</div>
            </div>
            <button className="btn small" onClick={() => onScenario(sc)}>
              Ouvrir
            </button>
          </div>
        ))}
      </Stack>
    </Modal>
  );
}

/** « Enregistrer » : nomme le projet, choisit la scène de départ jouable, publie au menu. */
export function SaveProjectModal({
  initialName,
  initialPublished,
  scenes,
  initialStartId,
  onSave,
  onClose,
  error,
}: {
  initialName: string;
  initialPublished: boolean;
  scenes: Scene[];
  initialStartId: string;
  onSave: (name: string, published: boolean, startSceneId: string) => void;
  onClose: () => void;
  /** #811 : refus le plus récent (porte du document ou échec de `projectSave`), ou `null` si le chemin nominal. */
  error?: RefusRendu | null;
}) {
  const [name, setName] = useState(initialName);
  const [published, setPublished] = useState(initialPublished);
  const [start, setStart] = useState(initialStartId);

  return (
    <Modal variant="plain" title="Enregistrer le projet" onClose={onClose}>
      {error && <ChipDeRefus refus={error} />}
      <label className="field">
        <span>Nom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ma campagne" autoFocus />
      </label>
      {scenes.length > 1 && (
        <label className="field">
          <span>Scène de départ (au jeu)</span>
          <select value={start} onChange={(e) => setStart(e.target.value)}>
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label ?? s.id}
              </option>
            ))}
          </select>
        </label>
      )}
      <Row as="label">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        <span>Jouable depuis le menu principal</span>
      </Row>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
        <GatedAction
          id="projet-enregistrer"
          label="Enregistrer"
          enabled={!!name.trim()}
          reason="Un projet se nomme avant d’être enregistré : saisissez un nom dans le champ Nom."
          onClick={() => onSave(name.trim(), published, start)}
        />
      </div>
    </Modal>
  );
}

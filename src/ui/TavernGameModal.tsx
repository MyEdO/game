import { useEffect, useState } from 'react';
import { useGame } from '../state/store';
import { TAVERN_GAMES, findTavernGameById, tavernFastRegime, TAVERN_TEST_DIFFICULTY, type TavernGame } from '../engine/tavernGame';
import { CHAR_LABELS, DIFFICULTY_LABELS, type Combatant, type Difficulty } from '../engine/types';
import { HABITUE, tavernGameValue, tavernPartieEnCours, tavernNpcOffers, type TavernOpponent } from '../state/tavernFlow';
import { pnjAuProfil, sceneNpc } from '../state/sceneNpc';
import { pickActiveModalKey } from '../state/modalArbiter';
import { Row } from './Layout';
import { bourseOf } from '../state/bourseFlow';
import { creatureLabel, profilsStandard, refLabel } from '../data/index';
import { PA_PER_SC, toBrass, fromBrass } from '../engine/money';
import { Modal } from './Modal';
import { OptionChooser } from './OptionChooser';
import { CharFrame } from './CharFrame';
import { Coins } from './Coins';
import { Prose } from './Prose';
import { GatedAction } from './GatedAction';
import { t } from '../i18n';
import { SceneBackdrop } from './SceneBackdrop';
import { NumberField } from './NumberField';

/** Un sport d'ÉQUIPE n'oppose pas deux personnes : le camp d'en face est tenu par la salle. Raison
 *  UNIQUE, portée par les deux adversaires individuels qu'elle ferme. */
const REFUS_EQUIPE = 'Sport d’équipe : tout le groupe joue dans le même camp — le camp d’en face est tenu par la salle.';

/** Le PROFIL STANDARD d'un figurant de la salle (`LDB 77 l.7`) et la valeur de jeu que sa fiche en dérive. */
function ChoixDeProfil({ titre, profils, choisi, onChoisir, fiche, game }: {
  titre: string; profils: readonly string[]; choisi: string; onChoisir: (id: string) => void;
  fiche: Combatant | undefined; game: TavernGame | undefined;
}) {
  return (
    <div className="tavern-block">
      <span className="mini-title">{titre}</span>
      <OptionChooser
        layout="grid"
        options={profils.map((id) => ({ key: id, label: creatureLabel(id), primary: id === choisi, onSelect: () => onChoisir(id) }))}
      />
      {fiche && game && (
        <p className="tavern-detail">{fiche.label} : valeur de jeu <b>{tavernGameValue(fiche, game)}</b> (de sa fiche).</p>
      )}
    </div>
  );
}

/**
 * Jeux de taverne (Nuits agitées & dures journées, ch.16) — modale UNIQUE : choisir un jeu, un
 * challenger et un adversaire (compagnon, PNJ de la scène OU habitué au profil standard), puis résoudre EN
 * DEUX TEMPS (#370) : le jet du challenger s'ouvre par le seam de jet (`openRoll`, modale RollShell
 * influençable Chance/Pacte/Résilience, rendue par l'arbitre `ActiveModal`) ; à son retour, le
 * réducteur de la séquence décide de la manche. Une situation = une modale : tant que l'arbitre
 * tient une modale, la table CÈDE (patron `CombatStartSplash.tsx:20-21`, `ActiveModal.tsx:66`). Le jeu présenté ici est celui du RÉGIME en vigueur
 * (`findTavernGameById` : complet, ou rapide sous la règle `tavern-games-rapides` — le formulaire
 * n'offre alors ni mise ni table, le jeu n'en portant plus). Affiche l'issue et la mise éventuelle. Ouverte via
 * `openTavernGames` (affordance montrée seulement si l'option `tavern-games` est active).
 */
export function TavernGameModal() {
  const state = useGame((s) => s.tavernGames);
  const party = useGame((s) => s.party);
  const play = useGame((s) => s.playTavernGame);
  const replay = useGame((s) => s.openTavernGames);
  const close = useGame((s) => s.closeTavernGames);
  // Manche EN COURS (jet du challenger surfacé par-dessus, cf. docstring) : masque le formulaire de
  // réglage — la cascade (RollShell) porte l'interaction tant qu'elle n'a pas committé.
  const rolling = useGame(tavernPartieEnCours);
  const arbitreTientLaMain = useGame((s) => !!pickActiveModalKey(s));

  const heroes = party.filter((h) => !h.dead);
  const [gameId, setGameId] = useState(TAVERN_GAMES[0]?.id ?? '');
  const [challengerId, setChallengerId] = useState(heroes[0]?.id ?? '');
  const [oppMode, setOppMode] = useState<'hero' | 'npc' | 'profil'>(heroes.length > 1 ? 'hero' : 'profil');
  const [oppNpcId, setOppNpcId] = useState('');
  const [oppHeroId, setOppHeroId] = useState('');
  // L'HABITUÉ et les coéquipiers figurants jouent une FICHE : un profil standard choisi (`LDB 77 l.7`).
  const profils = profilsStandard();
  const [profilId, setProfilId] = useState(profils[0] ?? '');
  const [allyProfilId, setAllyProfilId] = useState(profils[0] ?? '');
  const [stakePa, setStakePa] = useState(0);
  // JEU DE MISE : l'effectif de la table est une grandeur de TABLE (la source décrit un cercle sans
  // en fixer le nombre) — éditable ici, jamais figée au code.
  const [tablePlayers, setTablePlayers] = useState(3);

  // CE QUE LA SCÈNE PROPOSE (`SceneEntity.tavernGame`) : les PNJ à FICHE qui offrent une partie.
  // Lu par SÉLECTEUR — la scène change (transition, PNJ retiré) et l'offre doit se re-rendre ; une
  // lecture directe de `getState` la figeait au premier rendu.
  const scene = useGame((s) => s.scene);
  const npcs = tavernNpcOffers(scene);
  const npc = npcs.find((n) => n.id === oppNpcId) ?? npcs[0];
  const npcActor = npc ? sceneNpc(scene, npc.id) : undefined;
  // CE QUE L'AUTEUR PRESCRIT (`NADJ 04 l.72` : un jeu ET une mise de départ) : la modale s'y POSE
  // quand on choisit ce PNJ — le joueur reste libre d'en dévier, l'auteur ne fait qu'ouvrir la table.
  useEffect(() => {
    if (oppMode !== 'npc' || !npc) return;
    setGameId(npc.gameId);
    if (npc.stakeBrass != null) setStakePa(Math.floor(npc.stakeBrass / PA_PER_SC));
  }, [oppMode, npc?.id, npc?.gameId, npc?.stakeBrass]);
  // OUVERTURE PAR LE PROPOSEUR (`tavernGames.npcId`, posé par l'Effet de son dialogue) : la table
  // s'ouvre SUR SON OFFRE. Le joueur qui accepte une partie ne devrait pas avoir à re-désigner celui
  // qui vient de la lui proposer — et l'effet ci-dessus enchaîne alors son jeu et sa mise.
  const proposeur = state?.npcId;
  useEffect(() => {
    if (!proposeur) return;
    setOppMode('npc');
    setOppNpcId(proposeur);
  }, [proposeur]);

  if (!state || arbitreTientLaMain) return null;
  const result = state.result;
  const game = findTavernGameById(gameId);
  const challenger = heroes.find((h) => h.id === challengerId);

  // LE CADRE DU JET, DÉRIVÉ DU RÉGIME EN VIGUEUR — jamais une phrase figée :
  //  · rapide (`NADJ 16 l.11`) : le Test que la projection a retenu, à Intermédiaire (+0) ;
  //  · complet : le Test de la PREMIÈRE option quand l'entrée en déclare (Cerevis « Pari Accessible
  //    (+20) », Middenball), sinon celui du jeu à sa Difficulté de manche.
  // Le nom d'une Caractéristique passe par `CHAR_LABELS` : un id moteur (« force ») n'est pas un
  // libellé d'écran (doctrine « on ne manipule que des ids, on n'AFFICHE que des labels »).
  const rapide = tavernFastRegime();
  const opt = !rapide ? game?.options?.[0] : undefined;
  const testAffiche = {
    skill: opt?.skill ?? game?.skill,
    char: opt?.char ?? (opt?.skill ? undefined : game?.characteristic),
  };
  const difficulteAffichee: Difficulty = rapide ? TAVERN_TEST_DIFFICULTY : (opt?.difficulty ?? TAVERN_TEST_DIFFICULTY);
  const nomDuTest = testAffiche.skill
    ? refLabel('skills', testAffiche.skill)
    : testAffiche.char
      ? CHAR_LABELS[testAffiche.char]
      : refLabel('skills', { id: 'pari' });
  const skillLine = game ? `${nomDuTest} ${DIFFICULTY_LABELS[difficulteAffichee]}` : '';
  const challengerVal = game && challenger ? tavernGameValue(challenger, game) : 0;
  const habitue = pnjAuProfil(profilId, HABITUE);
  const coequipier = pnjAuProfil(allyProfilId, HABITUE);
  // JEU D'ÉQUIPE (Middenball) : le groupe joue ENSEMBLE — tous ses héros sont dans le MÊME camp. Un
  // compagnon ne peut donc pas y tenir le camp d'en face, qui est celui de la salle.
  const equipe = !!game?.team;
  const oppKind: 'hero' | 'npc' | 'profil' = equipe ? 'profil' : oppMode;

  const oppCandidates = heroes.filter((h) => h.id !== challengerId);
  // La mise sort de la bourse du CHALLENGER (débit/crédit personnel) : le plafond affiché est SA bourse.
  const challengerPurse = challenger ? bourseOf(challenger) : { gold: 0, silver: 0, brass: 0 };
  const purseInPa = Math.floor(toBrass(challengerPurse) / PA_PER_SC);
  // MISE : un jeu de POT en exige une de chacun (Al-zahr l.17) — l'argent change vraiment de bourse,
  // y compris entre compagnons. Les autres jeux du chapitre n'en portent aucune.
  const stakeActive = !!game?.pot;
  const stake = stakeActive ? Math.min(Math.max(0, stakePa), purseInPa) : 0;
  const joueurs = Math.max(2, Math.min(8, tablePlayers));

  // POURQUOI on ne peut pas jouer — en TEXTE, jamais un bouton muet (`GatedAction`). La raison d'une
  // mise absente est celle de la garde du moteur, à la lettre : une seule vérité pour les deux.
  const raison = !game
    ? 'Choisissez un jeu.'
    : !challenger
      ? 'Choisissez qui joue.'
      : stakeActive && stake <= 0
        ? t('tavern.potSansMise', { who: challenger.label })
        : oppKind === 'hero' && !oppCandidates.length
          ? 'Aucun compagnon disponible : jouez contre un habitué de la salle.'
          : oppKind === 'npc' && !npc
            ? 'Personne dans cette scène ne propose de partie.'
          : oppKind === 'profil' && (!habitue || (equipe && !coequipier))
            ? 'Choisissez un profil standard.'
            : '';
  const canPlay = !raison;

  const onPlay = () => {
    if (!game || !challenger) return;
    const opponent: TavernOpponent = oppKind === 'hero'
      ? { kind: 'hero', id: oppHeroId || oppCandidates[0]?.id || '' }
      : oppKind === 'npc' && npc
        ? { kind: 'npc', id: npc.id }
        : { kind: 'profil', id: profilId };
    play({
      gameId: game.id, challengerId: challenger.id, opponent, stakeBrass: stake * PA_PER_SC,
      ...(equipe ? { allyProfil: allyProfilId } : {}),
      ...(game.pot ? { tablePlayers: joueurs } : {}),
    });
  };

  return (
    <Modal title="Jeux de taverne" variant="plain" className="tavern-modal" onClose={close} backdropClose>
      <SceneBackdrop backdropId="taverne-commune" />
      {rolling ? (
        <div className="tavern-result panel">
          <p className="tavern-detail muted">Jet en cours…</p>
        </div>
      ) : result ? (
        <div className="tavern-result panel">
          <p className="tavern-vs">
            <strong>{result.gameLabel}</strong> — {result.challengerName} contre {result.opponentName}
          </p>
          <p className={`tavern-verdict ${result.winner === 'player' ? 'ok-text' : result.winner === 'opponent' ? 'ko-text' : ''}`}>
            {result.winner === 'player' ? `✓ ${result.challengerName} l'emporte !` : result.winner === 'opponent' ? `✗ ${result.opponentName} l'emporte.` : 'Égalité.'}
          </p>
          <p className="tavern-detail">
            {/* Un jeu qui ne compte pas en DR (jeu de MISE) porte SA ligne, composée par le jeu. */}
            {result.detail ?? `DR ${result.playerSL} contre ${result.opponentSL}`}
            {result.rounds > 1 ? ` · ${result.rounds} manches` : ''}
          </p>
          {result.netBrass !== 0 && (
            <p className="tavern-detail">
              {result.netBrass > 0 ? 'Gain : +' : 'Perte : −'}
              <Coins money={fromBrass(Math.abs(result.netBrass))} />
            </p>
          )}
          <div className="modal-actions">
            <button className="btn" onClick={() => replay()}>Rejouer</button>
            <button className="btn btn-primary" onClick={close}>Fermer</button>
          </div>
        </div>
      ) : (
        <div className="tavern-setup">
          <div className="tavern-block">
            <span className="mini-title">Le jeu</span>
            <OptionChooser
              layout="grid"
              options={TAVERN_GAMES.map((g) => ({ key: g.id, label: g.label, primary: g.id === gameId, onSelect: () => setGameId(g.id) }))}
            />
          </div>
          {game && (
            <>
              <div className="tavern-desc"><Prose md={game.desc} porteur={{ type: 'tavernGames', id: game.id, chemin: 'desc' }} /></div>
              {/* La règle affichée est le VERBATIM de la source (CLAUDE.md règle 5) : on ne la coupe
                  pas au régime rapide — c'est la note ci-dessous qui DIT ce que ce régime joue. */}
              {rapide && <p className="tavern-detail muted">{t('tavern.regimeRapideNote')}</p>}
              {game.pot ? (
                <p className="tavern-detail">
                  Lancer : <b>{game.pot.dice.count}d{game.pot.dice.faces}</b> à chaque tour
                  {game.pot.targetRange ? ` · nombre cible de ${game.pot.targetRange.min} à ${game.pot.targetRange.max}` : ''}.
                </p>
              ) : (
                <p className="tavern-detail">Test opposé : <b>{skillLine}</b>{game.mode === 'extended' ? ` · premier à ${game.target ?? 10} DR cumulés` : ''}.</p>
              )}
            </>
          )}
          <div className="tavern-block">
            <span className="mini-title">Qui joue ?</span>
            <Row gap="sm" align="start">
              {heroes.map((h) => (
                <CharFrame key={h.id} c={h} variant="identity" size="xs" selected={h.id === challengerId} onClick={() => setChallengerId(h.id)} />
              ))}
            </Row>
            {game && challenger && <p className="tavern-detail">{challenger.label} : valeur de jeu <b>{challengerVal}</b>.</p>}
          </div>
          <div className="tavern-block">
            <span className="mini-title">Adversaire</span>
            <OptionChooser
              layout="seg"
              options={[
                // Chaque adversaire indisponible PORTE sa cause au survol/focus/tap : « équipe » et
                // « personne à opposer » sont deux refus différents, et un segment muet les confondait.
                { key: 'hero', label: 'Un compagnon', selected: oppKind === 'hero', refus: equipe ? REFUS_EQUIPE : oppCandidates.length === 0 ? 'Aucun compagnon disponible pour ce jeu.' : undefined, onSelect: () => setOppMode('hero') },
                { key: 'npc', label: 'Un joueur de la salle', selected: oppKind === 'npc', refus: equipe ? REFUS_EQUIPE : npcs.length === 0 ? 'Personne dans la salle ne joue à ce jeu.' : undefined, onSelect: () => setOppMode('npc') },
                { key: 'profil', label: equipe ? 'L’équipe adverse' : 'Un habitué', selected: oppKind === 'profil', onSelect: () => setOppMode('profil') },
              ]}
            />
            {equipe && (
              <p className="tavern-detail muted">
                Sport d'équipe : tout le groupe joue dans le MÊME camp — le camp d'en face est tenu par la salle.
              </p>
            )}
            {oppKind === 'npc' ? (
              <div className="tavern-block">
                {/* Le PNJ joue de SA fiche : on annonce SON nom et SA valeur de jeu, dérivée par le
                    même collecteur que celle du challenger — jamais une valeur saisie. */}
                <OptionChooser
                  layout="grid"
                  options={npcs.map((n) => ({ key: n.id, label: n.label, primary: n.id === npc?.id, onSelect: () => setOppNpcId(n.id) }))}
                />
                {npc && game && npcActor && (
                  <p className="tavern-detail">{npc.label} : valeur de jeu <b>{tavernGameValue(npcActor, game)}</b> (de sa fiche).</p>
                )}
              </div>
            ) : oppKind === 'hero' ? (
              <Row gap="sm" align="start">
                {oppCandidates.map((h) => (
                  <CharFrame key={h.id} c={h} variant="identity" size="xs" selected={h.id === (oppHeroId || oppCandidates[0]?.id)} onClick={() => setOppHeroId(h.id)} />
                ))}
              </Row>
            ) : (
              <ChoixDeProfil
                titre={equipe ? 'Les joueurs de l’équipe adverse' : 'Son profil'}
                profils={profils} choisi={profilId} onChoisir={setProfilId} fiche={habitue} game={game}
              />
            )}
            {equipe && (
              <ChoixDeProfil
                titre={`Vos coéquipiers (les ${(game?.team?.size ?? 1) - heroes.length} figurants qui complètent VOTRE camp)`}
                profils={profils} choisi={allyProfilId} onChoisir={setAllyProfilId} fiche={coequipier} game={game}
              />
            )}
          </div>
          {stakeActive && (
            <div className="tavern-block">
              <span className="mini-title">Mise de chaque joueur</span>
              <NumberField
                id="tavern-stake"
                label={`Pistoles d'argent (bourse : ${purseInPa})`}
                min={0}
                max={purseInPa}
                value={stakePa}
                onChange={setStakePa}
              />
              <NumberField
                id="tavern-table-players"
                label="Joueurs autour de la table (fixé par la table)"
                min={2}
                max={8}
                value={joueurs}
                onChange={setTablePlayers}
              />
              <p className="tavern-detail muted">
                Chacun mise la même somme ; le pot se gagne à la manche. Sans mise, personne ne s'assoit.
              </p>
            </div>
          )}
          <div className="modal-actions">
            <button className="btn" onClick={close}>Fermer</button>
            {/* Raison EN CLAIR (`raisonInline`) : dans une modale d'activité, le refus d'entrer en jeu est
                le seul texte qui explique l'écran — il ne se cache pas derrière un survol. */}
            <GatedAction id="tavern-play" raisonInline label="Jouer" enabled={canPlay} reason={raison} onClick={onPlay} />
          </div>
        </div>
      )}
    </Modal>
  );
}

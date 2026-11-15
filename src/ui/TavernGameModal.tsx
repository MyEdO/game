import { useEffect, useState } from 'react';
import { useGame } from '../state/store';
import { findTavernGameById, tavernFastRegime, difficulteDeBase, difficulteDuJoueur, specialsApplicables, type TavernGame } from '../engine/tavernGame';
import { TAVERN_GAMES } from '../data';
import { DIFFICULTY_LABELS, type Combatant, type Difficulty } from '../engine/types';
import {
  HABITUE,
  refusDAdversaire,
  refusDeJouer,
  refusDOuvrirLaTaverne,
  tavernGameValue,
  tavernPartieEnCours,
  tavernNpcOffers,
  type ReglageDePartie,
  type TavernOpponent,
} from '../noyau/tavernFlow';
import { pnjAuProfil, sceneNpc } from '../noyau/monde/sceneNpc';
import { pickActiveModalKey } from '../noyau/modalArbiter';
import type { IdDeJeuDeTaverne } from '../noyau/designations';
import { Row } from './Layout';
import { bourseOf } from '../engine/bourse';
import { creatureLabel, profilsStandard, refLabel, testSkillLabel } from '../data/index';
import { toBrass, fromBrass } from '../engine/money';
import { Modal } from './Modal';
import { OptionChooser } from './OptionChooser';
import { CharFrame } from './CharFrame';
import { Coins } from './Coins';
import { Prose } from './Prose';
import { GatedAction, raisonSi } from './GatedAction';
import { t } from '../i18n';
import { SceneBackdrop } from './SceneBackdrop';
import { NumberField } from './NumberField';
import { deDeLaTableTiree, fourchette } from '../engine/tables';
import { formatDice } from '../engine/dice';
import { presetPnjById } from '../state/campaignData';

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
        options={profils.map((id) => ({ key: id, label: creatureLabel(id), selected: id === choisi, onSelect: () => onChoisir(id) }))}
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
 * (`findTavernGameById` : complet, ou rapide sous la règle `jeux-de-taverne-rapides` — le formulaire
 * n'offre alors ni mise ni table, le jeu n'en portant plus). Affiche l'issue et la mise éventuelle. Ouverte via
 * `ouvrirLesJeux` (affordance montrée seulement si l'option `jeux-de-taverne` est active).
 */
export function TavernGameModal() {
  const state = useGame((s) => s.tavernGames);
  const party = useGame((s) => s.party);
  const play = useGame((s) => s.jouerALaTaverne);
  const replay = useGame((s) => s.ouvrirLesJeux);
  const fermer = useGame((s) => s.fenetreFermer);
  const close = () => fermer('jeuxDeTaverne');
  // Manche EN COURS (jet du challenger surfacé par-dessus, cf. docstring) : masque le formulaire de
  // réglage — la cascade (RollShell) porte l'interaction tant qu'elle n'a pas committé.
  const rolling = useGame(tavernPartieEnCours);
  const arbitreTientLaMain = useGame((s) => !!pickActiveModalKey(s));
  const refusDeRejouer = useGame(refusDOuvrirLaTaverne);

  const heroes = party.filter((h) => !h.dead);
  const [gameId, setGameId] = useState<IdDeJeuDeTaverne>(TAVERN_GAMES[0]?.id ?? '');
  const [challengerId, setChallengerId] = useState(heroes[0]?.id ?? '');
  const [oppMode, setOppMode] = useState<TavernOpponent['kind']>(heroes.length > 1 ? 'heros' : 'profil');
  const [oppNpcId, setOppNpcId] = useState('');
  const [oppHeroId, setOppHeroId] = useState('');
  // L'HABITUÉ et les coéquipiers figurants jouent une FICHE : un profil standard choisi (`LDB 77 l.7`).
  const profils = profilsStandard();
  const [profilId, setProfilId] = useState(profils[0] ?? '');
  const [allyProfilId, setAllyProfilId] = useState(profils[0] ?? '');
  // MISE de chaque joueur, en sous de cuivre : l'unité du geste (`stakeBrass`).
  const [stakeBrass, setStakeBrass] = useState(0);
  // JEU DE MISE : l'effectif de la table est une grandeur de TABLE (la source décrit un cercle sans
  // en fixer le nombre, NADJ 16 l.17) — éditable ici, jamais figée au code.
  const [tablePlayers, setTablePlayers] = useState(3);

  // CE QUE LA SCÈNE PROPOSE (`SceneEntity.tavernGame`) : les PNJ à FICHE qui offrent une partie.
  // Lu par SÉLECTEUR — la scène change (transition, PNJ retiré) et l'offre doit se re-rendre ; une
  // lecture directe de `getState` la figeait au premier rendu.
  const scene = useGame((s) => s.scene);
  const npcs = tavernNpcOffers(scene, presetPnjById);
  const npc = npcs.find((n) => n.id === oppNpcId) ?? npcs[0];
  const npcActor = npc ? sceneNpc(scene, npc.id, presetPnjById) : undefined;
  // CE QUE L'AUTEUR PRESCRIT (`NADJ 04 l.72` : un jeu ET une mise de départ) : la modale s'y POSE
  // quand on choisit ce PNJ — le joueur reste libre d'en dévier, l'auteur ne fait qu'ouvrir la table.
  useEffect(() => {
    if (oppMode !== 'pnj' || !npc) return;
    setGameId(npc.gameId);
    if (npc.stakeBrass != null) setStakeBrass(npc.stakeBrass);
  }, [oppMode, npc?.id, npc?.gameId, npc?.stakeBrass]);
  // OUVERTURE PAR LE PROPOSEUR (`tavernGames.npcId`, posé par l'Effet de son dialogue) : la table
  // s'ouvre SUR SON OFFRE. Le joueur qui accepte une partie ne devrait pas avoir à re-désigner celui
  // qui vient de la lui proposer — et l'effet ci-dessus enchaîne alors son jeu et sa mise.
  const proposeur = state?.npcId;
  useEffect(() => {
    if (!proposeur) return;
    setOppMode('pnj');
    setOppNpcId(proposeur);
  }, [proposeur]);

  const game = findTavernGameById(gameId);
  const challenger = heroes.find((h) => h.id === challengerId);
  // JEU D'ÉQUIPE (Middenball) : le groupe joue ENSEMBLE — tous ses héros sont dans le MÊME camp. Un
  // compagnon ne peut donc pas y tenir le camp d'en face, qui est celui de la salle.
  const equipe = !!game?.team;
  const oppKind: TavernOpponent['kind'] = equipe ? 'profil' : oppMode;
  const oppCandidates = heroes.filter((h) => h.id !== challengerId);
  const joueurs = Math.max(2, tablePlayers);
  // LE RÉGLAGE que « Jouer » soumet au geste — et que son verdict (`refusDeJouer`) juge.
  const partie: ReglageDePartie = {
    gameId, stakeBrass,
    opponent: oppKind === 'heros'
      ? { kind: 'heros', id: oppHeroId || oppCandidates[0]?.id || '' }
      : oppKind === 'pnj' ? { kind: 'pnj', id: npc?.id ?? '' } : { kind: 'profil', id: profilId },
    ...(equipe ? { allyProfil: allyProfilId } : {}),
    ...(game?.pot ? { tablePlayers: joueurs } : {}),
  };
  const raison = useGame((s) => refusDeJouer(s, challengerId, partie));
  const refusHero = useGame((s) => refusDAdversaire(s, gameId, challengerId, 'heros'));
  const refusNpc = useGame((s) => refusDAdversaire(s, gameId, challengerId, 'pnj'));

  if (!state || arbitreTientLaMain) return null;
  const result = state.result;

  // LE CADRE DU JET, DÉRIVÉ DU RÉGIME EN VIGUEUR — jamais une phrase figée :
  //  · rapide (`NADJ 16 l.11`) : le Test que la projection a retenu, à Intermédiaire (+0) ;
  //  · complet : le Test de la PREMIÈRE option quand l'entrée en déclare (Middenball), sinon celui du
  //    jeu, à la Difficulté de base (`difficulteDeBase`) que les Spéciaux du challenger ajustent.
  // Le nom du Test passe par `testSkillLabel` : un id moteur (« force ») n'est pas un
  // libellé d'écran (doctrine « on ne manipule que des ids, on n'AFFICHE que des labels »).
  const rapide = tavernFastRegime();
  const opt = !rapide ? game?.options?.[0] : undefined;
  const testAffiche = {
    skill: opt?.test.skill ?? game?.skill,
    characteristic: opt?.test.characteristic ?? (opt?.test.skill ? undefined : game?.characteristic),
  };
  const difficulteAffichee: Difficulty | undefined = game && difficulteDuJoueur(difficulteDeBase(game), specialsApplicables(game, challenger));
  const nomDuTest = testSkillLabel(testAffiche) ?? refLabel('skills', { id: 'pari' });
  const skillLine = difficulteAffichee ? `${nomDuTest} ${DIFFICULTY_LABELS[difficulteAffichee]}` : '';
  const challengerVal = game && challenger ? tavernGameValue(challenger, game) : 0;
  const habitue = pnjAuProfil(profilId, HABITUE);
  const coequipier = pnjAuProfil(allyProfilId, HABITUE);
  // La mise sort de la bourse du CHALLENGER (débit/crédit personnel) : le plafond affiché est SA bourse.
  const purseBrass = challenger ? toBrass(bourseOf(challenger)) : 0;
  // MISE : un jeu de POT en exige une de chacun (Al-zahr l.17) — l'argent change vraiment de bourse,
  // y compris entre compagnons. Les autres jeux du chapitre n'en portent aucune.
  const stakeActive = !!game?.pot;

  // PIED : les gestes du volet courant — rejouer ou fermer après une partie ; fermer ou jouer avant.
  const footer = rolling ? undefined : result ? (
    <>
      <GatedAction id="tavern-replay" label="Rejouer" enabled={!refusDeRejouer} {...raisonSi(refusDeRejouer)} onClick={() => replay()} primary={false} />
      <button className="btn btn-primary" onClick={close}>Fermer</button>
    </>
  ) : (
    <>
      <button className="btn" onClick={close}>Fermer</button>
      {/* Raison EN CLAIR (`raisonInline`) : dans une modale d'activité, le refus d'entrer en jeu est
          le seul texte qui explique l'écran — il ne se cache pas derrière un survol. */}
      <GatedAction id="tavern-play" raisonInline label="Jouer" enabled={!raison} {...raisonSi(raison)} onClick={() => play(challengerId, partie)} />
    </>
  );

  return (
    <Modal title="Jeux de taverne" onClose={close} backdropClose footer={footer} etape={result ? 'apres' : 'avant'}>
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
          <p className={`tavern-verdict ${result.winner === 'joueur' ? 'ok-text' : result.winner === 'adversaire' ? 'ko-text' : ''}`}>
            {result.winner === 'joueur' ? `✓ ${result.challengerName} l'emporte !` : result.winner === 'adversaire' ? `✗ ${result.opponentName} l'emporte.` : 'Égalité.'}
          </p>
          {/* Le score dans l'unité du jeu, composé par son dénouement (`TavernGamesResult.detail`). */}
          <p className="tavern-detail">{result.detail}</p>
          {result.netBrass !== 0 && (
            <p className="tavern-detail">
              {result.netBrass > 0 ? 'Gain : +' : 'Perte : −'}
              <Coins money={fromBrass(Math.abs(result.netBrass))} />
            </p>
          )}
        </div>
      ) : (
        <div className="tavern-setup">
          <div className="tavern-block">
            <span className="mini-title">Le jeu</span>
            <OptionChooser
              layout="grid"
              options={TAVERN_GAMES.map((g) => ({ key: g.id, label: g.label, selected: g.id === gameId, onSelect: () => setGameId(g.id) }))}
            />
          </div>
          {game && (
            <>
              {game.desc && <div className="tavern-desc"><Prose md={game.desc} porteur={{ type: 'tavernGames', id: game.id, chemin: 'desc' }} /></div>}
              {/* La règle affichée est le VERBATIM de la source (AGENTS.md règle 5) : on ne la coupe
                  pas au régime rapide — c'est la note ci-dessous qui DIT ce que ce régime joue. */}
              {rapide && <p className="tavern-detail muted">{t('tavern.regimeRapideNote')}</p>}
              {game.pot ? (
                <p className="tavern-detail">
                  Lancer : <b>{formatDice(deDeLaTableTiree(game.pot))}</b> à chaque tour
                  {game.pot.targetRange ? ` · nombre cible ${fourchette(game.pot.targetRange.min, game.pot.targetRange.max)}` : ''}.
                </p>
              ) : (
                <p className="tavern-detail">Test opposé : <b>{skillLine}</b>{game.mode === 'etendu' ? ` · premier à ${game.target ?? 10} DR cumulés` : ''}.</p>
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
                { key: 'heros', label: 'Un compagnon', selected: oppKind === 'heros', refus: refusHero ?? undefined, onSelect: () => setOppMode('heros') },
                { key: 'pnj', label: 'Un joueur de la salle', selected: oppKind === 'pnj', refus: refusNpc ?? undefined, onSelect: () => setOppMode('pnj') },
                { key: 'profil', label: equipe ? 'L’équipe adverse' : 'Un habitué', selected: oppKind === 'profil', onSelect: () => setOppMode('profil') },
              ]}
            />
            {equipe && (
              <p className="tavern-detail muted">{refusHero}</p>
            )}
            {oppKind === 'pnj' ? (
              <div className="tavern-block">
                {/* Le PNJ joue de SA fiche : on annonce SON nom et SA valeur de jeu, dérivée par le
                    même collecteur que celle du challenger — jamais une valeur saisie. */}
                <OptionChooser
                  layout="grid"
                  options={npcs.map((n) => ({ key: n.id, label: n.label, selected: n.id === npc?.id, onSelect: () => setOppNpcId(n.id) }))}
                />
                {npc && game && npcActor && (
                  <p className="tavern-detail">{npc.label} : valeur de jeu <b>{tavernGameValue(npcActor, game)}</b> (de sa fiche).</p>
                )}
              </div>
            ) : oppKind === 'heros' ? (
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
                label={`Sous de cuivre (bourse : ${purseBrass})`}
                min={0}
                max={purseBrass}
                value={stakeBrass}
                onChange={setStakeBrass}
              />
              <NumberField
                id="tavern-table-players"
                label="Joueurs autour de la table (fixé par la table)"
                min={2}
                value={joueurs}
                onChange={setTablePlayers}
              />
              <p className="tavern-detail muted">
                Chacun mise la même somme ; le pot se gagne à la manche. Sans mise, personne ne s'assoit.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

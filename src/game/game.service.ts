import { Injectable } from '@nestjs/common';
import { Connection } from 'typeorm';
import { BaseGame } from 'z-games-base-game';
import { NoThanks } from 'z-games-no-thanks';
import { Perudo } from 'z-games-perudo';

import { Game } from '../db/entities/game.entity';
import { User } from '../db/entities/user.entity';
import { LoggerService } from '../logger/logger.service';
import { JoiningGameError } from '../errors/joining-game';
import { OpeningGameError } from '../errors/opening-game';
import { WatchingGameError } from '../errors/watching-game';
import { LeavingGameError } from '../errors/leaving-game';
import { ClosingGameError } from '../errors/closing-game';
import { StartingGameError } from '../errors/starting-game';
import { MakingMoveError } from '../errors/making-move';
import {
  OPEN_GAME_FIELDS,
  ALL_GAMES_JOIN_PLAYERS,
  OPEN_GAME_JOIN_WATCHERS,
  OPEN_GAME_JOIN_PLAYERS_ONLINE,
  OPEN_GAME_JOIN_NEXT_PLAYERS,
  OPEN_GAME_JOIN_LOGS,
  OPEN_GAME_JOIN_LOGS_USERNAMES,
  LOGS_FIELD_ORDER_BY,
  FIELDS_TO_REMOVE_IN_ALL_GAMES,
  ALL_GAMES_FIELDS,
} from '../db/scopes/Game';

import * as types from '../constants';

const gamesServices: { [key: string]: BaseGame } = {
  [types.NO_THANKS]: NoThanks.Instance,
  [types.PERUDO]: Perudo.Instance,
};

@Injectable()
export class GameService {

  constructor(private connection: Connection, private logger: LoggerService) { }

  public findOne(gameNumber: number): Promise<Game | undefined> {
    this.logger.info(`Find one game number ${gameNumber}`);

    return this.connection.getRepository(Game)
      .createQueryBuilder('game')
      .select(OPEN_GAME_FIELDS)
      .leftJoin(...ALL_GAMES_JOIN_PLAYERS)
      .leftJoin(...OPEN_GAME_JOIN_WATCHERS)
      .leftJoin(...OPEN_GAME_JOIN_PLAYERS_ONLINE)
      .leftJoin(...OPEN_GAME_JOIN_NEXT_PLAYERS)
      .leftJoin(...OPEN_GAME_JOIN_LOGS)
      .leftJoin(...OPEN_GAME_JOIN_LOGS_USERNAMES)
      .where({ number: gameNumber })
      .orderBy({ [LOGS_FIELD_ORDER_BY]: 'DESC' })
      .getOne();
  }

  getAllGames({ ignoreNotStarted, ignoreStarted, ignoreFinished }: {
    ignoreNotStarted: boolean,
    ignoreStarted: boolean,
    ignoreFinished: boolean,
  }): Promise<Game[]> {
    this.logger.info('Get all games');

    return this.connection.getRepository(Game)
      .createQueryBuilder('game')
      .select(ALL_GAMES_FIELDS)
      .leftJoin(...ALL_GAMES_JOIN_PLAYERS)
      .orderBy({ number: 'DESC' })
      .getMany();
  }

  public async newGame(name: string): Promise<Game> {
    this.logger.info(`New ${name} game`);

    const { playersMax, playersMin, gameData } = gamesServices[name].getNewGame();

    const game = new Game();
    game.name = name;
    game.isPrivate = false;
    game.playersMax = playersMax;
    game.playersMin = playersMin;
    game.players = [];
    game.gameData = gameData;

    const newGame = await this.connection.getRepository(Game).save(game);
    return newGame;
  }

  public async joinGame({ user, gameNumber }: { user: User, gameNumber: number }): Promise<Game> {
    const game = await this.findOne(gameNumber);

    if (game.state) {
      throw new JoiningGameError('Can\'t join started or finished game');
    }

    if (game.players.length >= game.playersMax) {
      throw new JoiningGameError('Can\'t join game with maximum players inside');
    }

    if (game.players.some(player => player.id === user.id)) {
      throw new JoiningGameError('Can\'t join game twice');
    }

    if (game.playersOnline.some(playerOnline => playerOnline.id === user.id)) {
      throw new JoiningGameError('Can\'t join opened game');
    }

    const newUser = new User();
    newUser.id = user.id;
    newUser.username = user.username;

    game.players.push(newUser);
    game.playersOnline.push(newUser);

    game.gameData = gamesServices[game.name].addPlayer({ gameData: game.gameData, userId: user.id });

    return this.connection.getRepository(Game).save(game);
  }

  public async openGame({ user, gameNumber }: { user: User, gameNumber: number }): Promise<Game> {
    const game = await this.findOne(gameNumber);

    if (!game.players.some(player => player.id === user.id)) {
      throw new OpeningGameError('Can\'t open game without joining');
    }

    if (game.playersOnline.some(playerOnline => playerOnline.id === user.id)) {
      throw new OpeningGameError('Can\'t open game twice');
    }

    game.playersOnline.push(user);

    return this.connection.getRepository(Game).save(game);
  }

  public async watchGame({ user, gameNumber }: { user: User, gameNumber: number }): Promise<Game> {
    const game = await this.findOne(gameNumber);

    if (!game.state) {
      throw new WatchingGameError('Can\'t watch not started game');
    }

    if (game.players.some(player => player.id === user.id)) {
      throw new WatchingGameError('Can\'t watch joining game');
    }

    if (game.watchers.some(watcher => watcher.id === user.id)) {
      throw new WatchingGameError('Can\'t watch game twice');
    }

    game.watchers.push(user);

    return this.connection.getRepository(Game).save(game);
  }

  public async leaveGame({ user, gameNumber }: { user: User, gameNumber: number }): Promise<Game> {
    const game = await this.findOne(gameNumber);

    if (game.state === types.GAME_STARTED) {
      throw new LeavingGameError('Can\'t leave started and not finished game');
    }

    if (!game.players.some(player => player.id === user.id)) {
      throw new LeavingGameError('Can\'t leave game without joining');
    }

    game.players = game.players.filter(player => player.id !== user.id);
    game.playersOnline = game.players.filter(player => player.id !== user.id);

    game.gameData = gamesServices[game.name].removePlayer({ gameData: game.gameData, userId: user.id });

    return this.connection.getRepository(Game).save(game);
  }

  public async closeGame({ user, gameNumber }: { user: User, gameNumber: number }): Promise<Game> {
    const game = await this.findOne(gameNumber);

    const isUserInPlayers = game.players.some(player => player.id === user.id);
    const isUserInWatchers = game.watchers.some(player => player.id === user.id);

    if (!isUserInPlayers && !isUserInWatchers) {
      throw new ClosingGameError('Can\'t close game without joining or watching');
    }

    if (isUserInWatchers) {
      game.watchers = game.watchers.filter(watcher => watcher.id !== user.id);
    }

    if (isUserInPlayers) {
      game.playersOnline = game.players.filter(player => player.id !== user.id);
    }

    return this.connection.getRepository(Game).save(game);
  }

  public async toggleReady({ user, gameNumber }: { user: User, gameNumber: number }): Promise<Game> {
    const game = await this.findOne(gameNumber);

    game.gameData = gamesServices[game.name].toggleReady({ gameData: game.gameData, userId: user.id });

    return this.connection.getRepository(Game).save(game);
  }

  public async startGame({ gameNumber }: { gameNumber: number }): Promise<Game> {
    const game = await this.findOne(gameNumber);

    if (game.players.length < game.playersMin) {
      throw new StartingGameError('Not enough players');
    }

    if (game.players.length > game.playersMax) {
      throw new StartingGameError('Too many players');
    }

    if (!gamesServices[game.name].checkReady(game.gameData)) {
      throw new StartingGameError('Not all players are ready');
    }

    const { gameData, nextPlayersIds } = gamesServices[game.name].startGame(game.gameData);
    game.gameData = gameData;
    game.state = types.GAME_STARTED;

    game.nextPlayers = [];
    nextPlayersIds.forEach(nextPlayerId => {
      const nextUser = new User();
      nextUser.id = nextPlayerId;
      game.nextPlayers.push(nextUser);
    });

    return this.connection.getRepository(Game).save(game);
  }

  public async makeMove({ move, gameNumber, userId }: { move: string, gameNumber: number, userId: string }): Promise<Game> {
    const game = await this.findOne(gameNumber);

    if (!game.nextPlayers.some(nextPlayer => nextPlayer.id === userId)) {
      throw new MakingMoveError('It\'s not your turn to move');
    }

    const { gameData, nextPlayersIds } = gamesServices[game.name].makeMove({ gameData: game.gameData, move, userId });
    game.gameData = gameData;

    if (nextPlayersIds.length) {

      game.nextPlayers = [];
      nextPlayersIds.forEach(nextPlayerId => {
        const nextUser = new User();
        nextUser.id = nextPlayerId;
        game.nextPlayers.push(nextUser);
      });

    } else {
      game.state = types.GAME_FINISHED;

      const gameDataParsed = JSON.parse(game.gameData);

      game.players.forEach(player => {
        const user = new User();

        user.id = player.id;
        user.gamesPlayed = player.gamesPlayed + 1;

        if (gameDataParsed.players.find(playerInGame => playerInGame.id === player.id)!.place === 1) {
          user.gamesWon = player.gamesWon + 1;
        }

        this.connection.getRepository(Game).save(user);
      });
    }

    return this.connection.getRepository(Game).save(game);
  }

  public parseGameForAllUsers(game: Game): Game {
    const newGame = { ...game } as Game;

    FIELDS_TO_REMOVE_IN_ALL_GAMES.forEach(field => {
      if (newGame[field]) {
        delete newGame[field];
      }
    });

    return newGame;
  }

  public parseGameForUser({ game, user }: { game: Game, user: User }): Game {
    if (game.state === types.GAME_FINISHED) {
      return { ...game, gameData: JSON.parse(JSON.stringify(game.gameData)) } as Game;
    }

    const gameData = gamesServices[game.name].parseGameDataForUser({ gameData: game.gameData, userId: user.id });

    return { ...game, gameData } as Game;
  }

}
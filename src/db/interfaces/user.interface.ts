import { Document } from 'mongoose';

import { IGame, ILog, IInvite } from './';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  username: string;
  isConfirmed: boolean;
  provider: string;
  avatar: string;
  openedGame: IGame;
  currentGames: IGame[];
  openedGameWatcher: IGame;
  currentMoves: IGame[];
  createdGames: IGame[];
  gamesPlayed: number;
  gamesWon: number;
  logs: ILog[];
  invitesInviter: IInvite[];
  invitesInvitee: IInvite[];
  createdAt: Date;
  updatedAt: Date;
}

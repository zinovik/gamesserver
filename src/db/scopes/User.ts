export const USER_FIELDS = [
  'user.id',
  'user.username',
  'user.password',
  'user.avatar',
  'user.email',
  'user.firstName',
  'user.lastName',
  'user.createdAt',
  'user.updatedAt',
  'openedGame.number',
  'openedGame.id',
  'currentGames.number',
  'currentGames.id',
  'currentWatch.number',
  'currentWatch.id',
];

export const USER_JOIN_OPENED_GAME: [string, string] = [
  'user.openedGame',
  'openedGame',
];

export const USER_JOIN_CURRENT_GAMES: [string, string] = [
  'user.currentGames',
  'currentGames',
];

export const USER_JOIN_CURRENT_WATCH: [string, string] = [
  'user.currentWatch',
  'currentWatch',
];

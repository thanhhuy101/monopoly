// ─── BOARD / SPACE TYPES ─────────────────────────────────────────────────────

export type SpaceType =
  | 'go' | 'jail' | 'free' | 'gotojail'
  | 'prop' | 'railroad' | 'utility'
  | 'tax' | 'chance' | 'chest';

export type ColorKey =
  | 'brown' | 'lightblue' | 'pink' | 'orange'
  | 'red' | 'yellow' | 'green' | 'darkblue';

export interface Space {
  id: number;
  name: string;
  type: SpaceType;
  icon?: string;
  color?: ColorKey;
  price?: number;
  rent?: readonly number[];
  group?: number;
  amount?: number; // for tax cells
}

// ─── CARD TYPES ───────────────────────────────────────────────────────────────

export type CardAction =
  | 'money'          // give/take fixed amount
  | 'goto'           // move to specific space
  | 'jail'           // go to jail
  | 'jailfree'       // get out of jail free
  | 'nearest_rr'     // advance to nearest railroad
  | 'nearest_util'   // advance to nearest utility
  | 'back'           // move back N spaces
  | 'repairs'        // pay per house/hotel
  | 'payeach'        // pay each other player
  | 'collecteach';   // collect from each other player

export interface GameCard {
  text: string;
  action: CardAction;
  amount?: number;    // for 'money', 'payeach', 'collecteach', 'back' (steps)
  target?: number;    // for 'goto'
  collect?: boolean;  // for 'goto' — collect $200 if passing GO
  perHouse?: number;  // for 'repairs'
  perHotel?: number;  // for 'repairs'
}

// ─── TOKEN SHAPE ──────────────────────────────────────────────────────────────

export type TokenShape = 'hat' | 'car' | 'guitar' | 'crown';

// ─── PLAYER TYPES ─────────────────────────────────────────────────────────────

export interface PlayerSetup {
  name: string;
  emoji: string;
  color: string;
  glow: string;
  tokenShape: TokenShape;
  isBot: boolean;
}

export interface Player extends PlayerSetup {
  id: number;
  uid: string; // User ID from backend
  username: string;
  money: number;
  position: number;
  properties: string[];
  jailStatus: {
    inJail: boolean;
    turns: number;
  };
  bankrupt: boolean;
  isCurrentTurn: boolean;
  lastAction?: string;
  // Frontend specific properties
  pos: number;
  inJail: boolean;
  jailTurns: number;
  doubleCount: number;
  isWalking: boolean;
}

// ─── MODAL TYPES ──────────────────────────────────────────────────────────────

export type ModalButtonAction = 'buy' | 'build' | 'pass' | 'restart';

export interface ModalButton {
  label: string;
  cls: string;
  action: ModalButtonAction;
  spaceId?: number;
  playerId?: number;
  price?: number;
  cost?: number;
}

export interface ModalConfig {
  icon: string;
  title: string;
  body: string;
  buttons: ModalButton[];
  playerId?: number;
}

// ─── TOAST / FLOAT TYPES ──────────────────────────────────────────────────────

export interface ToastConfig {
  id: number;
  msg: string;
}

export interface FloatMoney {
  id: number;
  text: string;
  color: string;
  x: number;
  y: number;
}

// ─── GAME PHASE ───────────────────────────────────────────────────────────────

export type GamePhase = 'roll' | 'rolling' | 'walking' | 'landed' | 'modal' | 'gameover' | 'paused';

// ─── BACKEND GAME STATE TYPES ──────────────────────────────────────────────────

export interface BackendGameState {
  id: string;
  roomId: string;
  players: Player[];
  currentPlayer: number;
  phase: 'waiting' | 'playing' | 'finished';
  dice: number[];
  board: {
    properties: Record<string, {
      ownerId: string;
      houses: number;
      isMortgaged: boolean;
    }>;
    houses: Record<string, number>;
    mortgages: Record<string, boolean>;
  };
  log: {
    timestamp: Date;
    message: string;
    playerId: number;
    type: 'action' | 'system' | 'trade' | 'property';
  }[];
  settings: {
    turnTimeLimit: number;
    autoRoll: boolean;
    startingMoney: number;
  };
  createdAt: Date;
  lastUpdated: Date;
  winner?: number;
}

// ─── SPECTATOR TYPES ───────────────────────────────────────────────────────────

export interface Spectator {
  playerId: number;
  username: string;
  joinedAt: Date;
  canChat: boolean;
}

// ─── BANKRUPTCY TYPES ──────────────────────────────────────────────────────────

export interface BankruptcyFlow {
  flowId: string;
  playerId: number;
  debtAmount: number;
  liquidationOptions: {
    propertyId: string;
    action: 'sell_house' | 'sell_deed' | 'mortgage';
    value: number;
  }[];
  tradeOptions: {
    playerId: number;
    username: string;
    canHelp: boolean;
  }[];
  timeLimit: number;
  expiresAt: Date;
}

export interface TradeOffer {
  fromId: number;
  toId: number;
  fromProps: number[]; // space IDs
  toProps: number[];   // space IDs
  fromCash: number;
  toCash: number;
}

// ─── GAME STATS TYPES ──────────────────────────────────────────────────────────

export interface GameStats {
  players: {
    playerId: number;
    username: string;
    money: number;
    properties: number;
    totalAssets: number;
    rank: number;
    isBankrupt: boolean;
    isSpectator: boolean;
  }[];
  market: {
    totalPropertiesInPlay: number;
    totalMortgaged: number;
    averagePropertyValue: number;
  };
  game: {
    currentTurn: number;
    timeRemaining: number;
    activePlayers: number;
    spectators: number;
  };
}

// ─── STORE STATE + ACTIONS ────────────────────────────────────────────────────

export interface GameState {
  players: Player[];
  cur: number;
  props: Record<number, number>;   // spaceId → playerId
  houses: Record<number, number>;  // spaceId → count (5 = hotel)
  phase: GamePhase;
  dice: [number, number];
  log: string[];
  modal: ModalConfig | null;
  toast: ToastConfig | null;
  floats: FloatMoney[];
  pausedFrom: GamePhase | null;
  _walkInfo: { playerId: number; stepsLeft: number } | null;
  _chanceDeck: number[];
  _chestDeck: number[];
  cardReveal: { type: 'chance' | 'chest'; card: GameCard; playerId: number } | null;
  bankruptcyFlow: boolean;
  gameOver: boolean;
  winner: Player | null;
  spectators: number[]; // Array of player IDs who are spectating
  viewingPlayerId: number | null;
  activeTab: string;
}

export interface GameActions {
  init: (setup?: PlayerSetup[]) => void;
  roll: () => void;
  handleModalAction: (action: ModalButton) => void;
  dismissCardReveal: () => void;
  // internal (prefixed _) — still exported so store methods can call each other
  _log: (msg: string) => void;
  _toast: (msg: string) => void;
  _floatMoney: (player: Pick<Player, 'pos'>, text: string, color: string) => void;
  _mutPlayer: (id: number, fn: (p: Player) => Partial<Player>) => void;
  _processRoll: (v1: number, v2: number) => void;
  _walkPlayer: (playerId: number, steps: number) => void;
  _moveToSpace: (player: Player, target: number, collect200?: boolean) => void;
  _gotoJail: (player: Player) => void;
  _landOn: (p: Player) => void;
  _applyCard: (p: Player, card: GameCard) => void;
  _checkBankrupt: (p: Player) => void;
  _checkWin: () => boolean;
  _nextTurn: () => void;
  _openBuyModal: (p: Player, sp: Space) => void;
  _openBuildModal: (p: Player, sp: Space) => void;
  _openViewModal: (sp: Space) => void;
  openBankruptcyFlow: () => void;
  closeBankruptcyFlow: () => void;
  resolveDebt: () => void;
  testBankruptcy: () => void;
  eliminatePlayer: (playerId: number) => void;
  spectateGame: (playerId: number) => void;
  leaveGame: (playerId: number) => void;
  endGame: (winner: Player) => void;
  setViewingPlayerId: (id: number | null) => void;
  setActiveTab: (tab: string) => void;
  executeTrade: (offer: TradeOffer) => void;
}

export type GameStore = GameState & GameActions;

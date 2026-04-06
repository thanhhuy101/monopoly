import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import { gameApi } from '../services/gameApi';
import { PLAYER_SETUP, SPACES, CHANCE_CARDS, CHEST_CARDS } from '../data/gameData';
import { BackendGameState, Player, PlayerSetup, GamePhase, GameCard, Space, TradeOffer } from '../types/game';
import type { GameStore, GameState } from '../types/game';
import type {
  RollDiceRequest,
  BuyPropertyRequest,
  BuildHouseRequest,
  MortgagePropertyRequest,
  TradeRequest,
  EndTurnRequest,
  FinishGameRequest,
  UpdatePlayerStatusRequest,
  CheckBankruptcyRequest,
  BankruptcyFlowRequest,
  LiquidateAssetsRequest,
  DebtTradeRequest,
  EliminatePlayerRequest,
  SpectateRequest,
  LeaveSpectatorRequest,
} from '../services/gameApi';

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeShuffledDeck(length: number): number[] {
  return shuffle(Array.from({ length }, (_, i) => i));
}

const STEP_MS = 450;

// Timer registry for API store
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

function gameTimeout(fn: () => void, ms: number) {
  const id = setTimeout(() => {
    pendingTimers.delete(id);
    fn();
  }, ms);
  pendingTimers.add(id);
  return id;
}

function clearGameTimers() {
  pendingTimers.forEach(id => clearTimeout(id));
  pendingTimers.clear();
}

let lastSetup: PlayerSetup[] = PLAYER_SETUP;

const initialState = (setup?: PlayerSetup[]): GameState => {
  const src = setup ?? lastSetup;
  lastSetup = src;
  return {
    players: src.map((p, i): Player => ({
      ...p, id: i, money: 1200, pos: 0,
      bankrupt: false, inJail: false, jailTurns: 0, doubleCount: 0, isWalking: false,
      uid: `player-${i}`, username: p.name, position: 0, properties: [],
      jailStatus: { inJail: false, turns: 0 }, isCurrentTurn: i === 0,
    })),
    cur: 0, props: {}, houses: {},
    phase: 'roll', dice: [1, 1],
    log: ['🎮 Trò chơi bắt đầu!'],
    modal: null, toast: null, floats: [],
    pausedFrom: null,
    _walkInfo: null,
    _chanceDeck: makeShuffledDeck(CHANCE_CARDS.length),
    _chestDeck: makeShuffledDeck(CHEST_CARDS.length),
    cardReveal: null,
    bankruptcyFlow: false,
    gameOver: false,
    winner: null,
    spectators: [],
    viewingPlayerId: null,
    activeTab: 'BÀN CỜ',
  };
};

// API integrated store interface
interface ApiGameStore extends GameStore {
  // API specific state
  roomId: string | null;
  gameId: string | null;
  isOnline: boolean;
  syncing: boolean;
  lastSyncTime: number | null;
  
  // API integration methods
  setRoomId: (roomId: string) => void;
  setGameId: (gameId: string) => void;
  syncWithBackend: () => Promise<void>;
  startOnlineGame: (roomId: string) => Promise<boolean>;
  rollDiceOnline: (playerId: number) => Promise<boolean>;
  buyPropertyOnline: (playerId: number, propertyId: string) => Promise<boolean>;
  buildHouseOnline: (playerId: number, propertyId: string) => Promise<boolean>;
  mortgagePropertyOnline: (playerId: number, propertyId: string) => Promise<boolean>;
  tradeOnline: (fromPlayerId: number, toPlayerId: number, properties: string[], amount: number) => Promise<boolean>;
  endTurnOnline: () => Promise<boolean>;
  finishGameOnline: (winnerId: number) => Promise<boolean>;
  updatePlayerStatusOnline: (userId: string, status: 'online' | 'offline' | 'disconnected') => Promise<boolean>;
  checkBankruptcyOnline: (playerId: number) => Promise<boolean>;
  startBankruptcyFlowOnline: (playerId: number, debtAmount: number) => Promise<boolean>;
  liquidateAssetsOnline: (playerId: number, assets: any[]) => Promise<boolean>;
  eliminatePlayerOnline: (playerId: number, reason: 'bankruptcy' | 'disconnect' | 'quit') => Promise<boolean>;
  createDebtTradeOnline: (playerId: number, tradePartnerId: number, offeredAssets: any[], requestedAmount: number) => Promise<boolean>;
  spectateGameOnline: (playerId: number) => Promise<boolean>;
  leaveSpectateOnline: (playerId: number, spectatorToken: string) => Promise<boolean>;
  
  // Utility methods
  convertBackendToFrontendState: (backendState: BackendGameState) => GameState;
  convertFrontendToBackendPlayer: (player: Player) => any;
  
  // Internal helper methods
  _initLocal: (setup?: PlayerSetup[]) => void;
  _fallbackRoll: () => void;
  _handleModalActionLocal: (action: any) => void;
  _handleModalActionOnline: (action: any) => void;
  _applyCardOnline: (p: Player, card: GameCard) => void;
  _nextTurnLocal: () => void;
  _openBuyModal: (p: Player, sp: Space) => void;
  _openBuildModal: (p: Player, sp: Space) => void;
  // Trading logic validation
  validateTradeProposal: (fromPlayerId: number, toPlayerId: number, offeredProperties: string[], requestedAmount: number) => { valid: boolean; reason?: string };
  executeTrade: (offer: TradeOffer) => void;
}

const createApiGameStore: StateCreator<ApiGameStore> = (set, get) => ({
  // Initialize with initial state
  ...initialState(),
  
  // Internal helper methods
  _initLocal(_setup?: PlayerSetup[]) {
    // Now handled by init() method
  },
  init(setup?: PlayerSetup[]) {
    clearGameTimers();
    const { isOnline, roomId } = get();
    
    if (isOnline && roomId) {
      // Initialize with online game
      set({ ...initialState(setup) });
      get().syncWithBackend();
    } else {
      // Local initialization
      set({ ...initialState(setup) });
    }
  },

  pause() {
    // Pause functionality removed
  },

  resume() {
    // Resume functionality removed  
  },

  roll() {
    const { isOnline, rollDiceOnline, players, cur } = get();
    if (isOnline) {
      // Use online version - call backend API
      set({ phase: 'rolling' });
      rollDiceOnline(players[cur]?.id || 0).then(success => {
        if (!success) {
          // Fallback to local if API fails
          get()._fallbackRoll();
        }
      }).catch(() => {
        // Fallback to local if API fails
        get()._fallbackRoll();
      });
    } else {
      // Local version
      get()._fallbackRoll();
    }
  },

  _fallbackRoll() {
    set({ phase: 'rolling' });
    gameTimeout(() => {
      const v1 = Math.ceil(Math.random() * 6);
      const v2 = Math.ceil(Math.random() * 6);
      set({ dice: [v1, v2] });
      get()._processRoll(v1, v2);
    }, 550);
  },

  handleModalAction(action: any) {
    const { isOnline } = get();
    
    if (isOnline) {
      // Handle modal actions via API
      get()._handleModalActionOnline(action);
    } else {
      // Handle modal actions locally
      get()._handleModalActionLocal(action);
    }
  },

  _handleModalActionLocal(action: any) {
    set({ modal: null, phase: 'roll' });
    if (action.action === 'buy' && action.spaceId !== undefined && action.playerId !== undefined) {
      const price = action.price ?? 0;
      get()._mutPlayer(action.playerId, p => ({ money: p.money - price }));
      set(s => ({ props: { ...s.props, [action.spaceId!]: action.playerId! } }));
      get()._floatMoney(get().players[action.playerId], `-${price}₫`, '#3af4ff');
      get()._log(`${get().players[action.playerId].emoji} Mua ${SPACES[action.spaceId].name}`);
      get()._nextTurn();
    } else if (action.action === 'build' && action.spaceId !== undefined && action.playerId !== undefined) {
      const cost = action.cost ?? 0;
      get()._mutPlayer(action.playerId, p => ({ money: p.money - cost }));
      set(s => ({ houses: { ...s.houses, [action.spaceId!]: (s.houses[action.spaceId!] ?? 0) + 1 } }));
      get()._floatMoney(get().players[action.playerId], `-${cost}₫`, '#3af4ff');
      get()._log(`${get().players[action.playerId].emoji} Xây ở ${SPACES[action.spaceId].name}`);
      get()._nextTurn();
    } else if (action.action === 'pass') {
      get()._nextTurn();
    } else if (action.action === 'restart') {
      get().init();
    }
  },

  _handleModalActionOnline(action: any) {
    const { gameId } = get();
    if (!gameId) {
      // Fallback to local if no game ID
      get()._handleModalActionLocal(action);
      return;
    }

    set({ modal: null });
    
    if (action.action === 'buy' && action.spaceId !== undefined && action.playerId !== undefined) {
      get().buyPropertyOnline(action.playerId, action.spaceId.toString()).then(success => {
        if (!success) {
          get()._toast('❌ Mua đất thất bại');
          set({ phase: 'roll' });
        }
      }).catch(() => {
        get()._toast('❌ Lỗi kết nối');
        set({ phase: 'roll' });
      });
    } else if (action.action === 'build' && action.spaceId !== undefined && action.playerId !== undefined) {
      get().buildHouseOnline(action.playerId, action.spaceId.toString()).then(success => {
        if (!success) {
          get()._toast('❌ Xây nhà thất bại');
          set({ phase: 'roll' });
        }
      }).catch(() => {
        get()._toast('❌ Lỗi kết nối');
        set({ phase: 'roll' });
      });
    } else if (action.action === 'pass') {
      get().endTurnOnline().then(success => {
        if (!success) {
          get()._toast('❌ Kết thúc lượt thất bại');
          set({ phase: 'roll' });
        }
      }).catch(() => {
        get()._toast('❌ Lỗi kết nối');
        set({ phase: 'roll' });
      });
    } else if (action.action === 'restart') {
      get().init();
    }
  },

  dismissCardReveal() {
    const { isOnline, cardReveal } = get();
    if (!cardReveal) return;
    
    const { card, playerId } = cardReveal;
    const p = get().players[playerId];
    const icon = cardReveal.type === 'chance' ? '❓' : '📦';
    get()._log(`${p.emoji} ${icon} ${card.text}`);
    set({ cardReveal: null });
    
    if (isOnline) {
      // Apply card effects via API
      get()._applyCardOnline(p, card);
    } else {
      // Apply card effects locally
      get()._applyCard(p, card);
    }
  },

  _applyCardOnline(p: Player, card: GameCard) {
    // For now, handle basic card effects locally
    // In a full implementation, this would call backend API for card effects
    get()._applyCard(p, card);
  },

  // Internal methods (simplified)
  _log(msg: string) {
    set(s => ({ log: [msg, ...s.log].slice(0, 40) }));
  },

  _toast(msg: string) {
    const id = Date.now();
    set({ toast: { id, msg } });
    setTimeout(() => set(s => (s.toast?.id === id ? { toast: null } : {})), 2400);
  },

  _floatMoney(player: Pick<Player, 'pos'>, text: string, color: string) {
    const cell = document.getElementById(`cell-${player.pos}`);
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    const id = Date.now() + Math.random();
    set(s => ({ floats: [...s.floats, { id, text, color, x: rect.left + rect.width / 2 - 24, y: rect.top }] }));
    setTimeout(() => set(s => ({ floats: s.floats.filter(f => f.id !== id) })), 1100);
  },

  _mutPlayer(id: number, fn: (p: Player) => Partial<Player>) {
    set(s => ({ players: s.players.map(p => (p.id === id ? { ...p, ...fn(p) } : p)) }));
  },

  _processRoll(v1: number, v2: number) {
    const { isOnline, players, cur } = get();
    const p = players[cur];
    const total = v1 + v2;
    const isDouble = v1 === v2;

    get()._log(`${p.emoji} ${p.name} tung ${v1}+${v2}=${total}`);

    // Track consecutive doubles
    if (isDouble && !p.inJail) {
      const newDCount = p.doubleCount + 1;
      if (newDCount === 3) {
        get()._mutPlayer(p.id, () => ({ doubleCount: 0 }));
        get()._toast(`🛑 3 lần đổ đôi! Vào tù!`);
        get()._gotoJail(p);
        return;
      }
      get()._mutPlayer(p.id, () => ({ doubleCount: newDCount }));
    } else {
      get()._mutPlayer(p.id, () => ({ doubleCount: 0 }));
    }

    if (p.inJail) {
      const jailTurns = (p.jailTurns ?? 0) + 1;
      if (isDouble) {
        get()._mutPlayer(p.id, () => ({ inJail: false, jailTurns: 0, doubleCount: 0 }));
        get()._toast(`${p.emoji} Đôi! Thoát tù!`);
        get()._log(`${p.emoji} Đổ đôi, thoát tù (Cần đổ lại để di chuyển)`);
        set({ phase: 'roll' });
        return;
      } else if (jailTurns >= 4) {
        get()._mutPlayer(p.id, pl => ({ money: pl.money - 200, inJail: false, jailTurns: 0 }));
        get()._log(`${p.emoji} Lần 4 bắt buộc trả 200₫ ra tù`);
        get()._toast(`${p.emoji} Trả 200₫ ra tù`);
        get()._floatMoney(p, '-200₫', '#ff5555');
      } else {
        get()._mutPlayer(p.id, () => ({ jailTurns }));
        get()._toast(`${p.emoji} Vẫn trong tù (${jailTurns}/3)`);
        get()._nextTurn();
        return;
      }
    }
    
    if (!isOnline) {
      get()._walkPlayer(p.id, total);
    } else {
      // Online mode - let backend handle movement
      set({ phase: 'landed' });
    }
  },

  _walkPlayer(playerId: number, stepsRemaining: number) {
    set({ phase: 'walking', _walkInfo: { playerId, stepsLeft: stepsRemaining } });
    get()._mutPlayer(playerId, () => ({ isWalking: true }));

    const step = (remaining: number): void => {
      if (remaining === 0) {
        set({ _walkInfo: null });
        get()._mutPlayer(playerId, () => ({ isWalking: false }));
        get()._landOn(get().players[playerId]);
        return;
      }

      // Update remaining steps for tracking
      set({ _walkInfo: { playerId, stepsLeft: remaining } });

      get()._mutPlayer(playerId, p => {
        const nextPos = (p.pos + 1) % 40;
        const passedGo = nextPos === 0 && p.pos !== 0;
        if (passedGo) {
          setTimeout(() => {
            get()._floatMoney({ pos: 0 }, '+200₫ GO!', '#f5c842');
            get()._log(`${p.emoji} Qua Xuất Phát +200₫`);
          }, 0);
          return { pos: nextPos, money: p.money + 200 };
        }
        return { pos: nextPos };
      });
      gameTimeout(() => step(remaining - 1), STEP_MS);
    };
    gameTimeout(() => step(stepsRemaining), 300);
  },

  _moveToSpace(player: Player, target: number, collect200 = false) {
    if (!collect200) {
      get()._mutPlayer(player.id, () => ({ pos: target }));
      get()._landOn(get().players[player.id]);
      return;
    }
    const steps = target >= player.pos ? target - player.pos : 40 - player.pos + target;
    get()._walkPlayer(player.id, steps);
  },

  _gotoJail(player: Player) {
    get()._mutPlayer(player.id, () => ({ pos: 10, inJail: true, jailTurns: 0, isWalking: false }));
    get()._log(`${player.emoji} VÀO TÙ! 🔒`);
    get()._toast(`${player.emoji} VÀO TÙ! 🔒`);
    get()._nextTurn();
  },

  _landOn(p: Player) {
    set({ phase: 'landed' });
    const sp = SPACES[p.pos];
    get()._log(`${p.emoji} → ${sp.name}`);
    if (['go', 'free', 'jail'].includes(sp.type)) { get()._nextTurn(); return; }
    if (sp.type === 'gotojail') { get()._gotoJail(p); return; }
    if (sp.type === 'tax') {
      const amount = sp.amount ?? 0;
      get()._mutPlayer(p.id, pl => ({ money: pl.money - amount }));
      get()._floatMoney(p, `-${amount}₫`, '#ff5555');
      get()._log(`${p.emoji} Thuế -${amount}₫`);
      get()._checkBankrupt(get().players[p.id]);
      get()._nextTurn(); return;
    }
    if (sp.type === 'chance') {
      let deck = get()._chanceDeck;
      if (deck.length === 0) deck = makeShuffledDeck(CHANCE_CARDS.length);
      const idx = deck[deck.length - 1];
      set({ _chanceDeck: deck.slice(0, -1) });
      const card = CHANCE_CARDS[idx];
      get()._log(`${p.emoji} ❓ Rút thẻ Cơ Hội`);
      set({ cardReveal: { type: 'chance', card, playerId: p.id } });
      return;
    }
    if (sp.type === 'chest') {
      let deck = get()._chestDeck;
      if (deck.length === 0) deck = makeShuffledDeck(CHEST_CARDS.length);
      const idx = deck[deck.length - 1];
      set({ _chestDeck: deck.slice(0, -1) });
      const card = CHEST_CARDS[idx];
      get()._log(`${p.emoji} 📦 Rút thẻ Khí Vận`);
      set({ cardReveal: { type: 'chest', card, playerId: p.id } });
      return;
    }
    if (sp.type === 'railroad' || sp.type === 'utility') {
      const { props, players } = get();
      const ownerId = props[sp.id];
      if (ownerId === undefined) { get()._openBuyModal(p, sp); }
      else if (ownerId === p.id) { get()._log(`${p.emoji} Đất của mình`); get()._nextTurn(); }
      else {
        const { props, players, dice } = get();
        const diceTotal = dice[0] + dice[1];
        
        let rent = 0;
        if (sp.type === 'railroad') {
          const railCount = Object.keys(props).filter(k => props[Number(k)] === ownerId && SPACES[Number(k)].type === 'railroad').length;
          const railroadRents = [0, 25, 50, 100, 200];
          rent = railroadRents[railCount] || 25;
        } else if (sp.type === 'utility') {
          const utilityCount = Object.keys(props).filter(k => props[Number(k)] === ownerId && SPACES[Number(k)].type === 'utility').length;
          const multiplier = utilityCount === 2 ? 10 : 4;
          rent = multiplier * diceTotal;
        }

        const owner = players[ownerId];
        get()._mutPlayer(p.id, pl => ({ money: pl.money - rent }));
        get()._mutPlayer(ownerId, pl => ({ money: pl.money + rent }));
        get()._floatMoney(p, `-${rent}₫`, '#ff5555');
        get()._floatMoney(owner, `+${rent}₫`, '#39ff85');
        get()._log(`${p.emoji} Trả ${rent}₫ → ${owner.emoji}`);
        get()._checkBankrupt(get().players[p.id]); get()._nextTurn();
      }
      return;
    }
    if (sp.type === 'prop') {
      const { props, houses, players } = get();
      const ownerId = props[sp.id];
      if (ownerId === undefined) { get()._openBuyModal(p, sp); }
      else if (ownerId === p.id) {
        const h = houses[sp.id] ?? 0;
        if (h < 5 && p.money >= 100) get()._openBuildModal(p, sp);
        else { get()._log(`${p.emoji} Đất của mình`); get()._nextTurn(); }
      } else {
        const h = houses[sp.id] ?? 0;
        const rent = sp.rent?.[h] ?? 0;
        const owner = players[ownerId];
        get()._mutPlayer(p.id, pl => ({ money: pl.money - rent }));
        get()._mutPlayer(ownerId, pl => ({ money: pl.money + rent }));
        get()._floatMoney(p, `-${rent}₫`, '#ff5555');
        get()._floatMoney(owner, `+${rent}₫`, '#39ff85');
        get()._log(`${p.emoji} Thuê ${rent}₫ → ${owner.emoji} ${owner.name}`);
        get()._checkBankrupt(get().players[p.id]); get()._nextTurn();
      }
      return;
    }
    get()._nextTurn();
  },

  _applyCard(p: Player, card: GameCard) {
    if (card.action === 'money') {
      const amount = card.amount ?? 0;
      get()._mutPlayer(p.id, pl => ({ money: pl.money + amount }));
      get()._floatMoney(p, `${amount > 0 ? '+' : ''}${amount}₫`, amount > 0 ? '#39ff85' : '#ff5555');
      get()._checkBankrupt(get().players[p.id]); get()._nextTurn();
    } else if (card.action === 'goto') {
      get()._moveToSpace(p, card.target ?? 0, card.collect);
    } else if (card.action === 'jail') {
      get()._gotoJail(p);
    } else if (card.action === 'jailfree') {
      if (p.inJail) {
        get()._mutPlayer(p.id, () => ({ inJail: false, jailTurns: 0 }));
        get()._toast(`${p.emoji} Thoát tù miễn phí! 🎫`);
      } else {
        get()._toast(`${p.emoji} Giữ thẻ thoát tù 🎫`);
      }
      get()._nextTurn();
    } else if (card.action === 'nearest_rr') {
      const rrIds = [5, 15, 25, 35];
      const target = rrIds.find(id => id > p.pos) ?? rrIds[0];
      get()._moveToSpace(p, target, true);
    } else if (card.action === 'nearest_util') {
      const utilIds = [12, 28];
      const target = utilIds.find(id => id > p.pos) ?? utilIds[0];
      get()._moveToSpace(p, target, true);
    } else if (card.action === 'back') {
      const steps = card.amount ?? 3;
      const newPos = (p.pos - steps + 40) % 40;
      get()._mutPlayer(p.id, () => ({ pos: newPos }));
      get()._landOn(get().players[p.id]);
    } else if (card.action === 'repairs') {
      const { houses } = get();
      let total = 0;
      Object.entries(houses).forEach(([spaceId, count]) => {
        if (get().props[Number(spaceId)] === p.id) {
          total += count >= 5
            ? (card.perHotel ?? 0)
            : count * (card.perHouse ?? 0);
        }
      });
      if (total > 0) {
        get()._mutPlayer(p.id, pl => ({ money: pl.money - total }));
        get()._floatMoney(p, `-${total}₫`, '#ff5555');
        get()._log(`${p.emoji} Sửa chữa -${total}₫`);
        get()._checkBankrupt(get().players[p.id]);
      }
      get()._nextTurn();
    } else if (card.action === 'payeach') {
      const amt = card.amount ?? 0;
      const others = get().players.filter(pl => !pl.bankrupt && pl.id !== p.id);
      const totalPay = amt * others.length;
      get()._mutPlayer(p.id, pl => ({ money: pl.money - totalPay }));
      others.forEach(o => get()._mutPlayer(o.id, pl => ({ money: pl.money + amt })));
      get()._floatMoney(p, `-${totalPay}₫`, '#ff5555');
      get()._log(`${p.emoji} Trả mỗi người ${amt}₫`);
      get()._checkBankrupt(get().players[p.id]); get()._nextTurn();
    } else if (card.action === 'collecteach') {
      const amt = card.amount ?? 0;
      const others = get().players.filter(pl => !pl.bankrupt && pl.id !== p.id);
      const totalGet = amt * others.length;
      others.forEach(o => {
        get()._mutPlayer(o.id, pl => ({ money: pl.money - amt }));
        get()._checkBankrupt(get().players[o.id]);
      });
      get()._mutPlayer(p.id, pl => ({ money: pl.money + totalGet }));
      get()._floatMoney(p, `+${totalGet}₫`, '#39ff85');
      get()._log(`${p.emoji} Thu mỗi người ${amt}₫`);
      get()._nextTurn();
    }
  },

  _checkBankrupt(p: Player) {
    if (p.money < 0) {
      // Instead of immediate bankruptcy, open bankruptcy flow
      get().openBankruptcyFlow();
      get()._toast(`⚠️ ${p.name} không đủ tiền trả nợ!`);
    }
  },

  _checkWin(): boolean {
    const { players } = get();
    const alive = players.filter(p => !p.bankrupt);
    if (alive.length === 1) {
      const w = alive[0];
      get().endGame(w);
      return true;
    }
    return false;
  },

  _nextTurn() {
    if (get()._checkWin()) return;
    const { players, cur, dice, isOnline } = get();
    const p = players[cur];
    const isDouble = dice[0] === dice[1];

    // Extra turn rule: doubles rolled, not bankrupt, and not just sent to jail
    if (isDouble && !p.bankrupt && !p.inJail && p.doubleCount > 0) {
      get()._log(`${p.emoji} ${p.name} đổ đôi! Thêm một lượt`);
      set({ phase: 'roll' });
      return;
    }

    const n = players.length;
    let nx = (cur + 1) % n;
    while (players[nx].bankrupt) nx = (nx + 1) % n;
    
    // Reset double count for new player
    get()._mutPlayer(nx, () => ({ doubleCount: 0 }));
    
    if (isOnline) {
      // Let backend handle turn changes
      get().endTurnOnline().then(success => {
        if (!success) {
          // Fallback to local turn change
          get()._nextTurnLocal();
        }
      }).catch(() => {
        // Fallback to local turn change
        get()._nextTurnLocal();
      });
    } else {
      // Local turn change
      get()._nextTurnLocal();
    }
  },

  openBankruptcyFlow() {
    set({ bankruptcyFlow: true });
  },

  closeBankruptcyFlow() {
    set({ bankruptcyFlow: false });
  },

  _openBuyModal(p: Player, sp: Space) {
    const canBuy = p.money >= (sp.price ?? 0);
    const ico = sp.type === 'prop' ? '🏘️' : sp.type === 'railroad' ? '🚂' : '⚡';
    const rentInfo = sp.rent ? `\nThuê cơ bản: ${sp.rent[0]}₫` : '';
    set({ phase: 'modal', modal: { icon: ico, title: sp.name,
      body: `Giá mua: ${sp.price}₫\nSố dư: ${p.money}₫${rentInfo}\n\n${canBuy ? 'Bạn có muốn mua không?' : '⚠️ Không đủ tiền!'}`,
      playerId: p.id,
      buttons: canBuy
        ? [{ label: '✅ Mua Ngay', cls: 'btn-buy', action: 'buy',  spaceId: sp.id, playerId: p.id, price: sp.price },
           { label: 'Bỏ Qua',     cls: 'btn-pass', action: 'pass' }]
        : [{ label: 'OK', cls: 'btn-ok', action: 'pass' }] } });
  },

  _openBuildModal(p: Player, sp: Space) {
    const h = get().houses[sp.id] ?? 0;
    const cost = h < 4 ? 100 : 200;
    const label = h < 4 ? `🏠 Nhà ${h + 1}` : '🏨 Khách Sạn';
    set({ phase: 'modal', modal: { icon: '🔨', title: 'Xây Dựng',
      body: `${sp.name}\nHiện tại: ${h === 0 ? 'Trống' : h < 5 ? '🏠'.repeat(h) : '🏨'}\nXây: ${label}\nChi phí: ${cost}₫\nSố dư: ${p.money}₫`,
      playerId: p.id,
      buttons: [{ label, cls: 'btn-buy', action: 'build', spaceId: sp.id, playerId: p.id, cost },
                { label: 'Bỏ Qua', cls: 'btn-pass', action: 'pass' }] } });
  },
  _openViewModal(sp: Space) {
    const ico = sp.type === 'prop' ? '🏘️' : sp.type === 'railroad' ? '🚂' : '⚡';
    set({ phase: 'modal', modal: { icon: ico, title: sp.name, body: '', 
      buttons: [{ label: 'Đóng', cls: 'btn-pass', action: 'pass', spaceId: sp.id }] } });
  },

  _nextTurnLocal() {
    const { players, cur } = get();
    const nextCur = (cur + 1) % players.length;
    set({ cur: nextCur, phase: 'roll' });
    players.forEach((_p, i) => get()._mutPlayer(i, () => ({ isCurrentTurn: i === nextCur })));
  },
  resolveDebt() {
    const { players, cur } = get();
    const currentPlayer = players[cur];
    
    // Reset player money to a positive amount after debt resolution
    get()._mutPlayer(currentPlayer.id, () => ({ money: 500 }));
    get()._log(`${currentPlayer.emoji} Đã giải quyết nợ nần, tiếp tục trò chơi`);
    
    // Close bankruptcy flow and resume game
    set({ bankruptcyFlow: false, phase: 'roll' });
  },

  // Trading logic validation
  validateTradeProposal(fromPlayerId: number, toPlayerId: number, offeredProperties: string[], requestedAmount: number): { valid: boolean; reason?: string } {
    const { players, props } = get();
    const fromPlayer = players[fromPlayerId];
    const toPlayer = players[toPlayerId];
    
    if (!fromPlayer || !toPlayer) {
      return { valid: false, reason: 'Người chơi không tồn tại' };
    }
    
    if (fromPlayerId === toPlayerId) {
      return { valid: false, reason: 'Không thể tự trao đổi' };
    }
    
    // Check if from player owns all offered properties
    for (const propId of offeredProperties) {
      const propertyOwnerId = props[parseInt(propId)];
      if (propertyOwnerId !== fromPlayerId) {
        return { valid: false, reason: `Bạn không sở hữu property ${propId}` };
      }
    }
    
    // Check if to player has enough money
    if (toPlayer.money < requestedAmount) {
      return { valid: false, reason: `${toPlayer.name} không đủ tiền (${requestedAmount}₫)` };
    }
    
    // Check for houses on offered properties (must sell houses first)
    const { houses } = get();
    for (const propId of offeredProperties) {
      const houseCount = houses[parseInt(propId)];
      if (houseCount && houseCount > 0) {
        return { valid: false, reason: `Phải bán nhà trên property ${propId} trước khi trao đổi` };
      }
    }
    
    return { valid: true };
  },
  
  executeTrade(offer: TradeOffer) {
    const { players, props } = get();
    const fromP = players[offer.fromId];
    const toP   = players[offer.toId];
    if (!fromP || !toP) return;

    // 1. Move money
    get()._mutPlayer(offer.fromId, p => ({ money: p.money - offer.fromCash + offer.toCash }));
    get()._mutPlayer(offer.toId,   p => ({ money: p.money + offer.fromCash - offer.toCash }));

    // 2. Swap properties in store 'props'
    const nextProps = { ...props };
    offer.fromProps.forEach((id: number) => { nextProps[id] = offer.toId; });
    offer.toProps.forEach((id: number) => { nextProps[id] = offer.fromId; });
    set({ props: nextProps });

    // 3. Log
    const fromDesc = offer.fromProps.length > 0 ? `${offer.fromProps.length} BĐS` : '';
    const toDesc   = offer.toProps.length > 0 ? `${offer.toProps.length} BĐS` : '';
    const fromMoneyDesc = offer.fromCash > 0 ? `$${offer.fromCash}` : '';
    const toMoneyDesc   = offer.toCash > 0 ? `$${offer.toCash}` : '';
    
    get()._log(`🤝 GIAO DỊCH: ${fromP.name} ↔️ ${toP.name}`);
    if (fromDesc || fromMoneyDesc) get()._log(`  📤 ${fromP.name} đưa: ${fromDesc} ${fromMoneyDesc}`);
    if (toDesc || toMoneyDesc)     get()._log(`  📥 ${toP.name} đưa: ${toDesc} ${toMoneyDesc}`);
    
    get()._toast('Giao dịch thành công! ✅');
  },
  testBankruptcy() {
    const { players, cur } = get();
    const currentPlayer = players[cur];
    get()._mutPlayer(currentPlayer.id, () => ({ money: -100 }));
    get()._checkBankrupt(currentPlayer);
  },

  eliminatePlayer(playerId: number) {
    const { players } = get();
    get()._mutPlayer(playerId, () => ({ bankrupt: true, money: 0 }));
    set(s => {
      const np = { ...s.props };
      Object.keys(np).forEach(k => { if (np[Number(k)] === playerId) delete np[Number(k)]; });
      return { props: np };
    });
    get()._log(`💀 Người chơi ${players[playerId].name} đã bị loại`);
    get()._checkWin();
  },

  spectateGame(playerId: number) {
    const { players } = get();
    set(s => ({ spectators: [...s.spectators, playerId] }));
    get()._log(`👁️ Người chơi ${players[playerId].name} đang theo dõi`);
  },

  leaveGame(playerId: number) {
    const { players } = get();
    get()._log(`👋 Người chơi ${players[playerId].name} đã rời phòng`);
    get().spectateGame(playerId);
  },

  endGame(winner: Player) {
    set({ gameOver: true, winner, phase: 'gameover' });
    get()._log(`🏆 ${winner.name} chiến thắng!`);
  },

  setViewingPlayerId(id: number | null) {
    set({ viewingPlayerId: id });
  },

  setActiveTab(tab: string) {
    set({ activeTab: tab });
  },
  
  // API specific state
  roomId: null,
  gameId: null,
  isOnline: false,
  syncing: false,
  lastSyncTime: null,
  
  // API integration methods
  setRoomId: (roomId: string) => {
    set({ roomId, isOnline: true });
  },
  
  setGameId: (gameId: string) => {
    set({ gameId });
  },
  
  syncWithBackend: async () => {
    const { roomId, syncing } = get();
    if (!roomId || syncing) return;
    
    set({ syncing: true });
    
    try {
      const response = await gameApi.getGameState(roomId);
      const frontendState = get().convertBackendToFrontendState(response.gameState);
      
      // Update local state with backend data
      set({
        ...frontendState,
        lastSyncTime: Date.now(),
      });
    } catch (error) {
      console.error('Failed to sync with backend:', error);
    } finally {
      set({ syncing: false });
    }
  },
  
  startOnlineGame: async (roomId: string) => {
    try {
      set({ syncing: true });
      const response = await gameApi.startGame(roomId);
      
      if (response.game) {
        const frontendState = get().convertBackendToFrontendState(response.game);
        set({
          ...frontendState,
          roomId,
          gameId: response.game.id,
          isOnline: true,
          lastSyncTime: Date.now(),
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to start online game:', error);
      return false;
    } finally {
      set({ syncing: false });
    }
  },
  
  rollDiceOnline: async (playerId: number) => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: RollDiceRequest = { gameId, playerId };
      const response = await gameApi.rollDice(request);
      
      if (response.game) {
        const frontendState = get().convertBackendToFrontendState(response.game);
        set({
          ...frontendState,
          dice: response.dice,
          lastSyncTime: Date.now(),
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to roll dice online:', error);
      return false;
    }
  },
  
  buyPropertyOnline: async (playerId: number, propertyId: string) => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: BuyPropertyRequest = { gameId, playerId, propertyId };
      const response = await gameApi.buyProperty(request);
      
      if (response.game) {
        const frontendState = get().convertBackendToFrontendState(response.game);
        set({
          ...frontendState,
          lastSyncTime: Date.now(),
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to buy property online:', error);
      return false;
    }
  },
  
  buildHouseOnline: async (playerId: number, propertyId: string) => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: BuildHouseRequest = { gameId, playerId, propertyId };
      const response = await gameApi.buildHouse(request);
      
      if (response.game) {
        const frontendState = get().convertBackendToFrontendState(response.game);
        set({
          ...frontendState,
          lastSyncTime: Date.now(),
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to build house online:', error);
      return false;
    }
  },
  
  mortgagePropertyOnline: async (playerId: number, propertyId: string) => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: MortgagePropertyRequest = { gameId, playerId, propertyId };
      const response = await gameApi.mortgageProperty(request);
      
      if (response.game) {
        const frontendState = get().convertBackendToFrontendState(response.game);
        set({
          ...frontendState,
          lastSyncTime: Date.now(),
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to mortgage property online:', error);
      return false;
    }
  },
  
  tradeOnline: async (fromPlayerId: number, toPlayerId: number, properties: string[], amount: number) => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: TradeRequest = { gameId, fromPlayerId, toPlayerId, properties, amount };
      const response = await gameApi.trade(request);
      
      if (response.game) {
        const frontendState = get().convertBackendToFrontendState(response.game);
        set({
          ...frontendState,
          lastSyncTime: Date.now(),
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to trade online:', error);
      return false;
    }
  },
  
  endTurnOnline: async () => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: EndTurnRequest = { gameId };
      const response = await gameApi.endTurn(request);
      
      if (response.game) {
        const frontendState = get().convertBackendToFrontendState(response.game);
        set({
          ...frontendState,
          lastSyncTime: Date.now(),
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to end turn online:', error);
      return false;
    }
  },
  
  finishGameOnline: async (winnerId: number) => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: FinishGameRequest = { gameId, winnerId };
      const response = await gameApi.finishGame(request);
      
      if (response.game) {
        const frontendState = get().convertBackendToFrontendState(response.game);
        set({
          ...frontendState,
          lastSyncTime: Date.now(),
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to finish game online:', error);
      return false;
    }
  },
  
  updatePlayerStatusOnline: async (userId: string, status: 'online' | 'offline' | 'disconnected') => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: UpdatePlayerStatusRequest = { gameId, userId, status };
      const response = await gameApi.updatePlayerStatus(request);
      return response !== null;
    } catch (error) {
      console.error('Failed to update player status online:', error);
      return false;
    }
  },
  
  checkBankruptcyOnline: async (playerId: number) => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: CheckBankruptcyRequest = { gameId, playerId };
      const response = await gameApi.checkBankruptcy(request);
      return response?.isBankrupt ?? false;
    } catch (error) {
      console.error('Failed to check bankruptcy online:', error);
      return false;
    }
  },
  
  startBankruptcyFlowOnline: async (playerId: number, debtAmount: number) => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: BankruptcyFlowRequest = { gameId, playerId, debtAmount };
      const response = await gameApi.startBankruptcyFlow(request);
      return response !== null;
    } catch (error) {
      console.error('Failed to start bankruptcy flow online:', error);
      return false;
    }
  },
  
  liquidateAssetsOnline: async (playerId: number, assets: any[]) => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: LiquidateAssetsRequest = { gameId, playerId, assetsToLiquidate: assets };
      const response = await gameApi.liquidateAssets(request);
      return response?.success ?? false;
    } catch (error) {
      console.error('Failed to liquidate assets online:', error);
      return false;
    }
  },
  
  eliminatePlayerOnline: async (playerId: number, reason: 'bankruptcy' | 'disconnect' | 'quit') => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: EliminatePlayerRequest = { gameId, playerId, reason };
      const response = await gameApi.eliminatePlayer(request);
      return response?.eliminated ?? false;
    } catch (error) {
      console.error('Failed to eliminate player online:', error);
      return false;
    }
  },
  
  createDebtTradeOnline: async (playerId: number, tradePartnerId: number, offeredAssets: any[], requestedAmount: number) => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: DebtTradeRequest = { gameId, playerId, tradePartnerId, offeredAssets, requestedAmount };
      const response = await gameApi.createDebtTrade(request);
      return response !== null;
    } catch (error) {
      console.error('Failed to create debt trade online:', error);
      return false;
    }
  },
  
  spectateGameOnline: async (playerId: number) => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: SpectateRequest = { gameId, playerId };
      const response = await gameApi.spectateGame(request);
      return response !== null;
    } catch (error) {
      console.error('Failed to spectate game online:', error);
      return false;
    }
  },
  
  leaveSpectateOnline: async (playerId: number, spectatorToken: string) => {
    const { gameId } = get();
    if (!gameId) return false;
    
    try {
      const request: LeaveSpectatorRequest = { gameId, playerId, spectatorToken };
      const response = await gameApi.leaveSpectateRoom(request);
      return response?.left ?? false;
    } catch (error) {
      console.error('Failed to leave spectator online:', error);
      return false;
    }
  },
  
  // Utility methods
  convertBackendToFrontendState: (backendState: BackendGameState): GameState => {
    const { players, currentPlayer, dice, log, phase } = backendState;
    
    // Convert backend players to frontend players
    const frontendPlayers = players.map(p => ({
      ...p,
      pos: p.position,
      inJail: p.jailStatus.inJail,
      jailTurns: p.jailStatus.turns,
      doubleCount: 0,
      isWalking: false,
    }));
    
    // Convert backend properties to frontend props format
    const props: Record<number, number> = {};
    Object.entries(backendState.board.properties).forEach(([propertyId, property]) => {
      if (property.ownerId) {
        const owner = players.find(p => p.uid === property.ownerId);
        if (owner) {
          props[parseInt(propertyId)] = owner.id;
        }
      }
    });
    
    // Convert backend houses to frontend houses format
    const houses: Record<number, number> = {};
    Object.entries(backendState.board.houses).forEach(([propertyId, houseCount]) => {
      houses[parseInt(propertyId)] = houseCount;
    });
    
    // Convert backend log to frontend log format
    const frontendLog = log.map(entry => entry.message);
    
    // Map backend phase to frontend phase
    let frontendPhase: GamePhase = 'roll';
    switch (phase) {
      case 'waiting':
        frontendPhase = 'roll';
        break;
      case 'playing':
        frontendPhase = 'roll';
        break;
      case 'finished':
        frontendPhase = 'gameover';
        break;
    }
    
    return {
      players: frontendPlayers,
      cur: currentPlayer,
      props,
      houses,
      phase: frontendPhase,
      dice: dice.length >= 2 ? [dice[0], dice[1]] as [number, number] : [1, 1],
      log: frontendLog.length > 0 ? frontendLog : ['🎮 Trò chơi bắt đầu!'],
      modal: null,
      toast: null,
      floats: [],
      pausedFrom: null,
      _walkInfo: null,
      _chanceDeck: [],
      _chestDeck: [],
      cardReveal: null,
      bankruptcyFlow: false,
      gameOver: phase === 'finished',
      winner: backendState.winner !== undefined ? players.find(p => p.id === backendState.winner) || null : null,
      spectators: [],
      viewingPlayerId: get()?.viewingPlayerId ?? null,
      activeTab: get()?.activeTab ?? 'BÀN CỜ',
    };
  },
  
  convertFrontendToBackendPlayer: (player: Player) => {
    return {
      id: player.id,
      uid: player.uid,
      username: player.username,
      emoji: player.emoji,
      money: player.money,
      position: player.pos,
      properties: player.properties,
      jailStatus: {
        inJail: player.inJail,
        turns: player.jailTurns,
      },
      bankrupt: player.bankrupt,
      isCurrentTurn: false, // This would be determined by the backend
      lastAction: player.lastAction,
    };
  },
});

export const useApiGameStore = create<ApiGameStore>()(
  persist(
    createApiGameStore,
    {
      name: 'monopoly-api-save',
      partialize: (state) => {
        // Only persist non-transient state
        return {
          players: state.players,
          cur: state.cur,
          props: state.props,
          houses: state.houses,
          phase: state.phase === 'walking' || state.phase === 'rolling' ? 'roll' : state.phase,
          dice: state.dice,
          log: state.log,
          gameOver: state.gameOver,
          winner: state.winner,
          spectators: state.spectators,
          roomId: state.roomId,
          gameId: state.gameId,
          isOnline: state.isOnline,
          bankruptcyFlow: state.bankruptcyFlow,
          viewingPlayerId: state.viewingPlayerId,
          activeTab: state.activeTab,
        };
      },
    }
  )
);

export type { ApiGameStore };

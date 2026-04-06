import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import { PLAYER_SETUP, SPACES, CHANCE_CARDS, CHEST_CARDS } from '../data/gameData';
import type { GameStore, GameState, Player, PlayerSetup, Space, GameCard, ModalButton, TradeOffer } from '../types/game';

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

// ── Timer registry: track all game timeouts so pause can clear them ──
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

const storeCreator: StateCreator<GameStore> = (set, get) => ({
  ...initialState(),

  init(setup?: PlayerSetup[]) {
    clearGameTimers();
    set({ ...initialState(setup) });
  },

  pause() {
    // Pause functionality removed
  },

  resume() {
    // Resume functionality removed
  },


  dismissCardReveal() {
    const reveal = get().cardReveal;
    if (!reveal) return;
    const { card, playerId } = reveal;
    const p = get().players[playerId];
    const icon = reveal.type === 'chance' ? '❓' : '📦';
    get()._log(`${p.emoji} ${icon} ${card.text}`);
    set({ cardReveal: null });
    get()._applyCard(p, card);
  },

  roll() {
    if (get().phase !== 'roll') return;
    set({ phase: 'rolling' });
    gameTimeout(() => {
      const v1 = Math.ceil(Math.random() * 6);
      const v2 = Math.ceil(Math.random() * 6);
      set({ dice: [v1, v2] });
      get()._processRoll(v1, v2);
    }, 550);
  },

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
    const { players, cur } = get();
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
        // According to user: "Lần 4 bắt buộc trả tiền và đi"
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
    get()._walkPlayer(p.id, total);
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
    const { players, cur, dice } = get();
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
    set({ cur: nx, phase: 'roll' });
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

  openBankruptcyFlow() {
    set({ bankruptcyFlow: true });
    get()._log('⚠️ Người chơi không đủ tiền trả nợ - Mở quy trình phá sản');
  },

  closeBankruptcyFlow() {
    set({ bankruptcyFlow: false });
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

  // Test function to trigger bankruptcy - remove in production
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
    // In a real multiplayer game, this would disconnect the player
    get()._log(`👋 Người chơi ${players[playerId].name} đã rời phòng`);
    // For now, just mark as spectator
    get().spectateGame(playerId);
  },

  endGame(winner: Player) {
    set({ gameOver: true, winner, phase: 'gameover' });
    get()._log(`🏆 ${winner.name} chiến thắng!`);
  },

  handleModalAction(action: ModalButton) {
    const { players } = get();
    set({ modal: null, phase: 'roll' });
    if (action.action === 'buy' && action.spaceId !== undefined && action.playerId !== undefined) {
      const price = action.price ?? 0;
      get()._mutPlayer(action.playerId, p => ({ money: p.money - price }));
      set(s => ({ props: { ...s.props, [action.spaceId!]: action.playerId! } }));
      get()._floatMoney(players[action.playerId], `-${price}₫`, '#3af4ff');
      get()._log(`${players[action.playerId].emoji} Mua ${SPACES[action.spaceId].name}`);
      get()._nextTurn();
    } else if (action.action === 'build' && action.spaceId !== undefined && action.playerId !== undefined) {
      const cost = action.cost ?? 0;
      get()._mutPlayer(action.playerId, p => ({ money: p.money - cost }));
      set(s => ({ houses: { ...s.houses, [action.spaceId!]: (s.houses[action.spaceId!] ?? 0) + 1 } }));
      get()._floatMoney(players[action.playerId], `-${cost}₫`, '#3af4ff');
      get()._log(`${players[action.playerId].emoji} Xây ở ${SPACES[action.spaceId].name}`);
      get()._nextTurn();
    } else if (action.action === 'pass') {
      get()._nextTurn();
    } else if (action.action === 'restart') {
      get().init();
    }
  },

  setViewingPlayerId(id: number | null) {
    set({ viewingPlayerId: id });
  },

  setActiveTab(tab: string) {
    set({ activeTab: tab });
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
});

export const useGameStore = create<GameStore>()(
  persist(
    storeCreator,
    {
      name: 'monopoly-save',
      partialize: (state) => {
        // Xoá các state animation/transient để tránh kẹt khi reload
        let safePhase = state.phase;
        if (state.phase === 'walking' || state.phase === 'rolling') {
          safePhase = 'roll'; // Trả về trạng thái chờ tung xúc xắc
        }
        return {
          ...state,
          players: state.players.map(p => ({ ...p, isWalking: false })),
          phase: safePhase,
          _walkInfo: null,
          toast: null,
          floats: [],
        };
      },
    }
  )
);

export type { GameStore };
export type { GameActions } from '../types/game';

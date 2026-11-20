// js/game.js
// Complete Game State, Rules Engine, Elemental Resonances, Ley Lines, Trading, Auctions, Save/Load, AI & UI Controller

const SAVE_STORAGE_KEY = 'genshin_monopoly_save_v1';

class GenshinMonopolyGame {
  constructor() {
    this.renderer = null;
    this.players = [];
    this.tileState = {};
    this.currentPlayerIndex = 0;
    this.roundNumber = 1;
    this.doublesCount = 0;
    this.hasRolled = false;
    this.isAnimating = false;
    this.gameOver = false;
    this.lastDice = [1, 1];
    this.forcedRentMultiplier = 1;
    this.forcedUtilityTenX = false;

    this.gameMode = 'elimination'; // 'elimination' | 'sprint20'
    this.potPoolEnabled = true;
    this.potPool = 0;
    this.speedMultiplier = 1;

    this.chanceDeck = [];
    this.chestDeck = [];
    this.selectedTileIndex = null;
  }

  async init() {
    const container = document.getElementById('canvas-container');
    this.renderer = new BoardRenderer3D(container);
    this.renderer.init((tileIdx) => this.inspectTile(tileIdx));

    if (window.assetManager) {
      if (typeof window.assetManager.whenEmblemsReady === 'function') {
        window.assetManager.whenEmblemsReady(() => {
          this.renderer.refreshAllTileTextures(this.tileState, this.players);
        });
      }
      if (typeof window.assetManager.loadCustomOverrides === 'function') {
        window.assetManager.loadCustomOverrides().then(() => {
          this.renderer.refreshAllTileTextures(this.tileState, this.players);
        });
      }
    }

    this.setupLobbyUI();
    this.bindGlobalUI();
    this.refreshResumeButton();

    if (typeof this.renderer.preloadGnosisModels === 'function') {
      await this.renderer.preloadGnosisModels();
    }
  }

  refreshResumeButton() {
    const btn = document.getElementById('resume-game-btn');
    if (!btn) return;
    btn.classList.toggle('hidden', !localStorage.getItem(SAVE_STORAGE_KEY));
  }

  setupLobbyUI() {
    const slotsContainer = document.getElementById('player-slots');
    const defaults = [
      { name: 'Traveler (You)', archonId: 'furina', isAI: false },
      { name: 'Morax AI', archonId: 'zhongli', isAI: true },
      { name: 'Barbatos AI', archonId: 'venti', isAI: true },
      { name: 'Tsaritsa AI', archonId: 'tsaritsa', isAI: true },
    ];

    const renderSlots = () => {
      const count = parseInt(document.getElementById('player-count').value, 10);
      slotsContainer.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const def = defaults[i];
        const archon = ARCHONS.find((a) => a.id === def.archonId) || ARCHONS[i];
        const row = document.createElement('div');
        row.className = 'lobby-slot';
        row.innerHTML = `
          <div class="slot-header">
            <span class="slot-badge" style="background:${archon.color}">P${i + 1}</span>
            <input type="text" class="slot-name" data-slot="${i}" value="${def.name}" maxlength="18" />
            <select class="slot-type" data-slot="${i}">
              <option value="human" ${!def.isAI ? 'selected' : ''}>Human</option>
              <option value="ai" ${def.isAI ? 'selected' : ''}>AI Bot</option>
            </select>
          </div>
          <div class="slot-archon-row">
            <select class="slot-archon" data-slot="${i}">
              ${ARCHONS.map((a) => `<option value="${a.id}" ${a.id === def.archonId ? 'selected' : ''}>${a.name} (${a.element})</option>`).join('')}
            </select>
            <div class="slot-passive" id="slot-passive-${i}">
              <strong>${archon.passiveName}:</strong> ${archon.passiveDesc}
            </div>
          </div>
        `;
        slotsContainer.appendChild(row);
      }

      slotsContainer.querySelectorAll('.slot-archon').forEach((sel) => {
        sel.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.slot, 10);
          defaults[idx].archonId = e.target.value;
          const a = ARCHONS.find((x) => x.id === e.target.value);
          const badge = slotsContainer.querySelectorAll('.slot-badge')[idx];
          if (badge && a) badge.style.background = a.color;
          const passiveBox = document.getElementById(`slot-passive-${idx}`);
          if (passiveBox && a) {
            passiveBox.innerHTML = `<strong>${a.passiveName}:</strong> ${a.passiveDesc}`;
          }
        });
      });

      slotsContainer.querySelectorAll('.slot-name').forEach((inp) => {
        inp.addEventListener('input', (e) => {
          defaults[parseInt(e.target.dataset.slot, 10)].name = e.target.value;
        });
      });

      slotsContainer.querySelectorAll('.slot-type').forEach((sel) => {
        sel.addEventListener('change', (e) => {
          defaults[parseInt(e.target.dataset.slot, 10)].isAI =
            e.target.value === 'ai';
        });
      });
    };

    document
      .getElementById('player-count')
      .addEventListener('change', renderSlots);
    renderSlots();

    document.getElementById('start-game-btn').addEventListener('click', () => {
      window.soundEngine.init();
      window.soundEngine.startBGM();
      const count = parseInt(document.getElementById('player-count').value, 10);
      const fastDraft = document.getElementById('fast-draft-toggle').checked;
      this.gameMode = document.getElementById('game-mode-select').value;
      this.potPoolEnabled = document.getElementById('pot-pool-toggle').checked;

      const configs = [];
      for (let i = 0; i < count; i++) {
        configs.push({
          id: `p${i + 1}`,
          name: defaults[i].name.trim() || `Archon ${i + 1}`,
          archonId: defaults[i].archonId,
          isAI: defaults[i].isAI,
        });
      }
      document.getElementById('lobby-modal').classList.add('hidden');
      this.startMatch(configs, fastDraft);
    });

    document.getElementById('resume-game-btn').addEventListener('click', () => {
      window.soundEngine.init();
      window.soundEngine.startBGM();
      this.loadSavedMatch();
    });
  }

  bindGlobalUI() {
    document
      .getElementById('btn-roll')
      .addEventListener('click', () => this.handleRollClick());
    document
      .getElementById('btn-end-turn')
      .addEventListener('click', () => this.endTurn());
    document
      .getElementById('btn-trade')
      .addEventListener('click', () => this.openTradeModal());
    document
      .getElementById('btn-bail')
      .addEventListener('click', () => this.payJailBail());
    document
      .getElementById('btn-pardon')
      .addEventListener('click', () => this.useJailCard());

    document.getElementById('btn-speed').addEventListener('click', (e) => {
      this.speedMultiplier = this.speedMultiplier === 1 ? 2 : 1;
      this.renderer.speedMultiplier = this.speedMultiplier;
      e.currentTarget.textContent = `⚡ ${this.speedMultiplier}x`;
    });

    document.getElementById('btn-bgm').addEventListener('click', (e) => {
      const muted = window.soundEngine.toggleBGM();
      e.currentTarget.textContent = muted ? '🔇 BGM' : '🎵 BGM';
    });

    document.getElementById('btn-sfx').addEventListener('click', (e) => {
      const muted = window.soundEngine.toggleSFX();
      e.currentTarget.textContent = muted ? '🔇 SFX' : '🔊 SFX';
    });

    document.getElementById('btn-exit-game').addEventListener('click', () => {
      if (!this.gameOver && this.players.length > 0) {
        if (
          !window.confirm(
            'Exit the current match and return to the lobby? (Progress is auto-saved)',
          )
        )
          return;
        this.saveMatchState();
      }
      this.exitToLobby();
    });

    document.querySelectorAll('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.renderer.setCameraPreset(btn.dataset.cam, this.getCurrentPlayer());
      });
    });

    document.getElementById('close-inspector').addEventListener('click', () => {
      document.getElementById('tile-inspector').classList.add('hidden');
      this.selectedTileIndex = null;
    });

    document.getElementById('btn-rules-help').addEventListener('click', () => {
      document.getElementById('rules-modal').classList.remove('hidden');
    });
    document.getElementById('close-rules').addEventListener('click', () => {
      document.getElementById('rules-modal').classList.add('hidden');
    });
    document.getElementById('close-portfolio').addEventListener('click', () => {
      document.getElementById('portfolio-modal').classList.add('hidden');
    });

    // Keyboard shortcuts: Space (Roll / End Turn) & Escape (Close non-blocking modals)
    window.addEventListener('keydown', (e) => {
      if (
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)
      )
        return;
      if (e.code === 'Escape') {
        document.getElementById('tile-inspector').classList.add('hidden');
        document.getElementById('rules-modal').classList.add('hidden');
        document.getElementById('portfolio-modal').classList.add('hidden');
        document.getElementById('trade-modal').classList.add('hidden');
      } else if (e.code === 'Space') {
        const anyBlockingModal = [
          ...document.querySelectorAll('.modal-backdrop'),
        ].some((m) => !m.classList.contains('hidden'));
        if (anyBlockingModal) return;
        e.preventDefault();
        const rollBtn = document.getElementById('btn-roll');
        const endBtn = document.getElementById('btn-end-turn');
        if (!rollBtn.disabled) this.handleRollClick();
        else if (!endBtn.disabled) this.endTurn();
      }
    });
  }

  exitToLobby() {
    this.gameOver = true;
    this.isAnimating = false;
    window.soundEngine.stopBGM();
    document
      .querySelectorAll('.modal-backdrop')
      .forEach((m) => m.classList.add('hidden'));
    document.getElementById('tile-inspector').classList.add('hidden');
    document.getElementById('lobby-modal').classList.remove('hidden');
    this.refreshResumeButton();
  }

  saveMatchState() {
    if (this.gameOver || !this.players.length) return;
    try {
      const payload = {
        players: this.players,
        tileState: this.tileState,
        currentPlayerIndex: this.currentPlayerIndex,
        roundNumber: this.roundNumber,
        gameMode: this.gameMode,
        potPoolEnabled: this.potPoolEnabled,
        potPool: this.potPool,
        lastDice: this.lastDice,
      };
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  loadSavedMatch() {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      this.renderer.clearTokens();
      this.players = data.players;
      this.tileState = data.tileState;
      this.currentPlayerIndex = data.currentPlayerIndex || 0;
      this.roundNumber = data.roundNumber || 1;
      this.gameMode = data.gameMode || 'elimination';
      this.potPoolEnabled = Boolean(data.potPoolEnabled);
      this.potPool = data.potPool || 0;
      this.lastDice = data.lastDice || [1, 1];
      this.gameOver = false;
      this.isAnimating = false;

      BOARD_TILES.forEach((t) => {
        const st = this.tileState[t.index];
        if (st) {
          const owner = st.ownerId ? this.getPlayerById(st.ownerId) : null;
          this.renderer.updateTileAppearance(
            t.index,
            owner ? owner.color : null,
            st.mortgaged,
          );
          this.renderer.updateTileBuildings(t.index, st.level || 0);
        }
      });

      this.players.forEach((p) => {
        if (!p.bankrupt) {
          this.renderer.createArchonToken(p);
          this.renderer.placeTokenImmediate(p, this.players);
        }
      });

      this.chanceDeck = this.shuffle(EVENT_WISH_CARDS);
      this.chestDeck = this.shuffle(DAILY_COMMISSION_CARDS);
      this.refreshMonopolyVisuals();
      this.applyCurrentLeyLineTheme();

      document.getElementById('lobby-modal').classList.add('hidden');
      document.getElementById('event-log').innerHTML = '';
      this.log(`⏯️ Resumed saved match on Round ${this.roundNumber}!`);
      this.startTurn();
    } catch (_) {
      localStorage.removeItem(SAVE_STORAGE_KEY);
      this.refreshResumeButton();
    }
  }

  shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  startMatch(configs, fastDraft = false) {
    this.renderer.clearTokens();
    this.tileState = {};
    this.potPool = 0;

    BOARD_TILES.forEach((t) => {
      if (
        t.type === 'property' ||
        t.type === 'railroad' ||
        t.type === 'utility'
      ) {
        this.tileState[t.index] = { ownerId: null, level: 0, mortgaged: false };
        this.renderer.updateTileAppearance(t.index, null, false);
        this.renderer.updateTileBuildings(t.index, 0);
        this.renderer.setTileMonopoly(t.index, false);
      }
    });

    this.players = configs.map((cfg) => {
      const archon = ARCHONS.find((a) => a.id === cfg.archonId) || ARCHONS[0];
      return {
        ...cfg,
        color: archon.color,
        mora: 1500,
        position: 0,
        inJail: false,
        jailTurns: 0,
        jailCards: 0,
        bankrupt: false,
        ventiUsedThisLap: false,
        forfeitNextGo: false,
        skipNextTurn: false,
        selectedResonanceId: null,
        stats: {
          rentEarned: 0,
          rentPaid: 0,
          buildsCount: 0,
          jailCount: 0,
          maxSingleRent: 0,
        },
      };
    });

    this.players.forEach((p) => {
      this.renderer.createArchonToken(p);
      this.renderer.placeTokenImmediate(p, this.players);
    });

    this.chanceDeck = this.shuffle(EVENT_WISH_CARDS);
    this.chestDeck = this.shuffle(DAILY_COMMISSION_CARDS);
    this.roundNumber = 1;
    this.currentPlayerIndex = 0;
    this.gameOver = false;

    document.getElementById('event-log').innerHTML = '';
    this.log(
      `✨ Welcome to Teyvat (${this.gameMode === 'sprint20' ? '20-Round Celestia Sprint' : 'Last Archon Standing'})! Every Archon starts with 1,500 Mora.`,
    );

    if (fastDraft) {
      const purchasable = this.shuffle(
        BOARD_TILES.filter(
          (t) =>
            t.type === 'property' ||
            t.type === 'railroad' ||
            t.type === 'utility',
        ),
      );
      this.players.forEach((p) => {
        for (let k = 0; k < 2; k++) {
          const deed = purchasable.pop();
          if (deed && p.mora >= deed.price) {
            p.mora -= deed.price;
            this.setTileOwner(deed.index, p.id);
            this.log(
              `📜 Fast Draft: ${p.name} acquired ${deed.name} (${deed.price} Mora).`,
            );
          }
        }
      });
    }

    this.refreshMonopolyVisuals();
    this.applyCurrentLeyLineTheme();
    this.startTurn();
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  getPlayerById(id) {
    return this.players.find((p) => p.id === id) || null;
  }

  calculateNetWorth(player) {
    if (!player || player.bankrupt) return 0;
    let total = player.mora + (player.jailCards || 0) * 50;
    Object.entries(this.tileState).forEach(([idxStr, st]) => {
      if (st.ownerId === player.id) {
        const tile = BOARD_TILES[parseInt(idxStr, 10)];
        total += st.mortgaged ? tile.mortgage : tile.price;
        if (tile.type === 'property' && st.level > 0) {
          total += st.level * Math.floor(REGIONS[tile.region].buildCost * 0.5);
        }
      }
    });
    return total;
  }

  getRollDangerStats(player) {
    let riskyOutcomes = 0;
    let maxRent = 0;
    const totalOutcomes = 36;

    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        const sum = d1 + d2;
        const idx = (player.position + sum) % 40;
        const tile = BOARD_TILES[idx];
        const st = this.tileState[idx];
        if (st && st.ownerId && st.ownerId !== player.id && !st.mortgaged) {
          const owner = this.getPlayerById(st.ownerId);
          if (owner && !owner.bankrupt) {
            riskyOutcomes += 1;
            const r = this.calculateRent(tile, owner, sum);
            if (r > maxRent) maxRent = r;
          }
        } else if (tile.type === 'tax' || tile.index === 30) {
          riskyOutcomes += 1;
        }
      }
    }

    return {
      pct: Math.round((riskyOutcomes / totalOutcomes) * 100),
      maxRent,
    };
  }

  triggerElementalReactionFX(
    tileIndex,
    label,
    color1 = '#fcd34d',
    color2 = '#38bdf8',
  ) {
    this.renderer.spawnDualBurst(tileIndex, color1, color2);
    const toast = document.getElementById('reaction-toast');
    if (!toast) return;
    toast.textContent = label;
    toast.style.borderColor = color1;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 2400);
  }

  addToPotPool(amount, reason = '') {
    if (!this.potPoolEnabled || amount <= 0) return;
    this.potPool += amount;
    this.log(
      `🍵 +${amount} Mora added to Serenitea Pot Jackpot (${reason}) — Pool: ${this.potPool} Mora.`,
    );
  }

  getCurrentLeyLine() {
    const idx = Math.min(
      Math.floor((this.roundNumber - 1) / 4),
      LEY_LINE_DISORDERS.length - 1,
    );
    return LEY_LINE_DISORDERS[idx];
  }

  applyCurrentLeyLineTheme() {
    const ll = this.getCurrentLeyLine();
    this.renderer.setLeyLineTheme(ll.lightHex);
    const banner = document.getElementById('leyline-banner');
    banner.style.borderColor = ll.color;
    const modeTag = this.gameMode === 'sprint20' ? ` / 20` : '';
    banner.innerHTML = `
      <div class="ll-header">
        <span class="ll-dot" style="background:${ll.color}"></span>
        <span class="ll-title">Round ${this.roundNumber}${modeTag} · ${ll.name}</span>
        <span class="ll-range">${ll.roundRange}</span>
      </div>
      <div class="ll-desc">${ll.desc}</div>
    `;
  }

  log(msg) {
    const logEl = document.getElementById('event-log');
    const item = document.createElement('div');
    item.className = 'log-entry';
    item.textContent = msg;
    logEl.prepend(item);
    while (logEl.children.length > 50) {
      logEl.removeChild(logEl.lastChild);
    }
  }

  // --- REGION & RESONANCE HELPERS ---
  getCompletedRegions(playerId) {
    return Object.keys(REGIONS).filter((regId) => {
      const tiles = REGIONS[regId].tiles;
      return tiles.every(
        (idx) =>
          this.tileState[idx] && this.tileState[idx].ownerId === playerId,
      );
    });
  }

  refreshMonopolyVisuals() {
    Object.values(REGIONS).forEach((reg) => {
      const firstOwner = this.tileState[reg.tiles[0]]?.ownerId;
      const isMono =
        Boolean(firstOwner) &&
        reg.tiles.every((idx) => this.tileState[idx]?.ownerId === firstOwner);
      const owner = isMono ? this.getPlayerById(firstOwner) : null;
      reg.tiles.forEach((idx) => {
        this.renderer.setTileMonopoly(
          idx,
          isMono,
          owner ? owner.color : '#fcd34d',
        );
      });
    });
  }

  getEligibleResonances(playerId) {
    const full = this.getCompletedRegions(playerId);
    if (full.length < 2) return [];

    return ELEMENTAL_RESONANCES.filter((res) => {
      const [r1, r2] = res.regions;
      if (!full.includes(r1)) return false;
      if (r2 === '*') return full.length >= 2;
      if (Array.isArray(r2))
        return r2.some((candidate) => full.includes(candidate));
      return full.includes(r2);
    });
  }

  getActiveResonance(playerId) {
    const eligible = this.getEligibleResonances(playerId);
    if (eligible.length === 0) return null;
    const player = this.getPlayerById(playerId);
    if (player && player.selectedResonanceId) {
      const found = eligible.find((r) => r.id === player.selectedResonanceId);
      if (found) return found;
    }
    return eligible[0];
  }

  hasResonance(playerId, resonanceId) {
    const active = this.getActiveResonance(playerId);
    return active && active.id === resonanceId;
  }

  setTileOwner(tileIndex, ownerId) {
    const st = this.tileState[tileIndex];
    if (!st) return;
    st.ownerId = ownerId;
    const owner = ownerId ? this.getPlayerById(ownerId) : null;
    this.renderer.updateTileAppearance(
      tileIndex,
      owner ? owner.color : null,
      st.mortgaged,
    );
    this.refreshMonopolyVisuals();
  }

  // --- TURN FLOW ---
  async startTurn() {
    if (this.gameOver) return;
    const player = this.getCurrentPlayer();
    if (player.bankrupt) {
      this.advanceToNextPlayer();
      return;
    }

    this.hasRolled = false;
    this.doublesCount = 0;
    this.forcedRentMultiplier = 1;
    this.forcedUtilityTenX = false;
    this.saveMatchState();
    this.updateHUD();

    if (player.skipNextTurn) {
      player.skipNextTurn = false;
      if (player.isAI) {
        if (player.mora >= 150) {
          player.mora -= 50;
          this.addToPotPool(50, 'Cryo thaw fee');
          this.log(
            `❄️ ${player.name} paid 50 Mora to thaw out from Frozen Resonance!`,
          );
        } else {
          this.log(
            `❄️ ${player.name} is Frozen and skips their roll this turn.`,
          );
          this.hasRolled = true;
          this.updateHUD();
          setTimeout(() => this.endTurn(), 900 / this.speedMultiplier);
          return;
        }
      } else {
        const thaw = await this.showChoiceModal(
          '❄️ Frozen by Hydro + Cryo Resonance!',
          'You are encased in Cryo ice! Pay 50 Mora to thaw immediately, or skip your roll this turn.',
          [
            {
              label: 'Pay 50 Mora to Thaw',
              value: 'thaw',
              disabled: player.mora < 50,
            },
            { label: 'Skip Roll This Turn', value: 'skip' },
          ],
        );
        if (thaw === 'thaw') {
          player.mora -= 50;
          this.addToPotPool(50, 'Cryo thaw fee');
          window.soundEngine.playPay();
          this.log(`❄️ ${player.name} paid 50 Mora to thaw out!`);
        } else {
          this.log(`❄️ ${player.name} skips their roll while thawing.`);
          this.hasRolled = true;
          this.updateHUD();
          return;
        }
      }
    }

    this.updateHUD();

    if (player.isAI) {
      setTimeout(() => this.runAITurn(), 680 / this.speedMultiplier);
    }
  }

  getJailBailCost() {
    return this.getCurrentLeyLine().id === 'glacial' ? 100 : 50;
  }

  payJailBail() {
    const player = this.getCurrentPlayer();
    const bail = this.getJailBailCost();
    if (
      !player.inJail ||
      this.hasRolled ||
      this.isAnimating ||
      player.mora < bail
    )
      return;
    player.mora -= bail;
    this.addToPotPool(bail, 'Meropide bail');
    player.inJail = false;
    player.jailTurns = 0;
    window.soundEngine.playPay();
    this.log(
      `🔓 ${player.name} paid ${bail} Mora bail to leave Fortress of Meropide.`,
    );
    this.updateHUD();
  }

  useJailCard() {
    const player = this.getCurrentPlayer();
    if (
      !player.inJail ||
      this.hasRolled ||
      this.isAnimating ||
      player.jailCards <= 0
    )
      return;
    player.jailCards -= 1;
    player.inJail = false;
    player.jailTurns = 0;
    window.soundEngine.playCoin();
    this.log(
      `📜 ${player.name} used an Official Pardon to leave Fortress of Meropide!`,
    );
    this.updateHUD();
  }

  async handleRollClick() {
    if (this.isAnimating || this.hasRolled || this.gameOver) return;
    const player = this.getCurrentPlayer();
    this.isAnimating = true;
    this.updateHUD();

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    this.lastDice = [d1, d2];
    const isDoubles = d1 === d2;

    window.soundEngine.playDice();
    await this.renderer.animateDiceRoll(d1, d2);

    let sum = d1 + d2;
    this.log(
      `🎲 ${player.name} rolled ${d1} + ${d2} = ${sum}${isDoubles ? ' (DOUBLES!)' : ''}.`,
    );

    if (player.inJail) {
      if (isDoubles) {
        player.inJail = false;
        player.jailTurns = 0;
        this.log(
          `🎉 Doubles! ${player.name} escapes the Fortress of Meropide!`,
        );
      } else {
        player.jailTurns += 1;
        if (player.jailTurns >= 3) {
          const bail = this.getJailBailCost();
          await this.chargePlayer(
            player,
            bail,
            null,
            'Meropide 3rd-turn mandatory bail',
            false,
            true,
          );
          if (player.bankrupt) {
            this.isAnimating = false;
            this.endTurn();
            return;
          }
          player.inJail = false;
          player.jailTurns = 0;
          this.log(
            `⚖️ 3rd turn in Meropide: ${player.name} paid ${bail} Mora bail and moves ${sum} spaces.`,
          );
        } else {
          this.log(
            `⛓️ ${player.name} failed to roll doubles (Attempt ${player.jailTurns}/3).`,
          );
          this.hasRolled = true;
          this.isAnimating = false;
          this.updateHUD();
          return;
        }
      }
    } else {
      if (isDoubles) {
        this.doublesCount += 1;
        if (player.archonId === 'mavuika') {
          player.mora += 50;
          window.soundEngine.playCoin();
          this.log(
            `🔥 Blazing Momentum: Mavuika collects +50 Mora for rolling doubles!`,
          );
        }
        if (this.getCurrentLeyLine().id === 'blazing') {
          player.mora += 50;
          window.soundEngine.playCoin();
          this.log(
            `☀️ Blazing Tithe: ${player.name} gains +50 Mora for rolling doubles!`,
          );
        }
        if (this.doublesCount >= 3) {
          this.log(
            `🚨 Three consecutive doubles! ${player.name} is detained in Fortress of Meropide!`,
          );
          await this.sendPlayerToJail(player);
          this.hasRolled = true;
          this.isAnimating = false;
          this.updateHUD();
          return;
        }
      }

      if (player.archonId === 'venti' && !player.ventiUsedThisLap) {
        let nudge = 0;
        if (player.isAI) {
          nudge = this.chooseAINudge(player, sum);
        } else {
          const prevTile = BOARD_TILES[(player.position + sum - 1) % 40];
          const curTile = BOARD_TILES[(player.position + sum) % 40];
          const nextTile = BOARD_TILES[(player.position + sum + 1) % 40];
          nudge = await this.showChoiceModal(
            '🍃 Guiding Breeze (Venti Passive)',
            `You rolled ${sum}. Once per lap, nudge your wind current by -1 or +1?`,
            [
              { label: `-1 (${sum - 1} → ${prevTile.name})`, value: -1 },
              { label: `Keep ${sum} (→ ${curTile.name})`, value: 0 },
              { label: `+1 (${sum + 1} → ${nextTile.name})`, value: 1 },
            ],
          );
        }
        if (nudge !== 0) {
          player.ventiUsedThisLap = true;
          sum += nudge;
          this.log(
            `🍃 Guiding Breeze: ${player.name} adjusted roll by ${nudge > 0 ? '+1' : '-1'} to ${sum}!`,
          );
        }
      }
    }

    await this.movePlayerSteps(player, sum, true);
    await this.resolveTileLanding(player, sum);

    if (
      isDoubles &&
      !player.inJail &&
      !player.bankrupt &&
      this.doublesCount > 0 &&
      this.doublesCount < 3
    ) {
      this.hasRolled = false;
      this.log(`🎲 Doubles bonus roll! ${player.name} may roll again.`);
    } else {
      this.hasRolled = true;
    }

    this.isAnimating = false;
    this.saveMatchState();
    this.updateHUD();
  }

  chooseAINudge(player, sum) {
    const scoreTarget = (steps) => {
      const idx = (player.position + steps) % 40;
      const tile = BOARD_TILES[idx];
      const st = this.tileState[idx];
      if (tile.index === 30) return -100;
      if (st && !st.ownerId && player.mora >= tile.price) return 40;
      if (st && st.ownerId && st.ownerId !== player.id && !st.mortgaged)
        return -50;
      return 0;
    };
    const base = scoreTarget(sum);
    const minus = scoreTarget(sum - 1);
    const plus = scoreTarget(sum + 1);
    if (plus > base + 25 && plus >= minus) return 1;
    if (minus > base + 25) return -1;
    return 0;
  }

  async movePlayerSteps(player, steps, checkGo = true) {
    const direction = steps >= 0 ? 1 : -1;
    const count = Math.abs(steps);

    for (let s = 0; s < count; s++) {
      const nextPos = (player.position + direction + 40) % 40;
      if (checkGo && direction === 1 && nextPos === 0) {
        this.grantGoReward(player);
      }
      player.position = nextPos;
      const coLocated = this.players.filter(
        (p) => !p.bankrupt && p.position === nextPos,
      );
      const slotIdx = Math.max(
        0,
        coLocated.findIndex((p) => p.id === player.id),
      );
      await this.renderer.animateTokenStep(player, nextPos, slotIdx);
    }
  }

  grantGoReward(player) {
    player.ventiUsedThisLap = false;
    if (player.forfeitNextGo) {
      player.forfeitNextGo = false;
      this.log(
        `🔥 Burning Resonance aftermath: ${player.name} forfeited their GO Mora reward!`,
      );
      return;
    }
    const ll = this.getCurrentLeyLine();
    let reward = 200;
    if (ll.id === 'abundance') reward = 250;
    if (ll.id === 'abyssal') reward = 100;
    if (player.archonId === 'furina') reward += 50;

    player.mora += reward;
    window.soundEngine.playCoin();
    this.renderer.spawnBurst(0, 0xfcd34d);
    this.log(
      `🌟 ${player.name} passed Adventurers' Guild (GO) and collected +${reward} Mora!`,
    );
  }

  async sendPlayerToJail(player) {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    if (player.stats) player.stats.jailCount += 1;
    window.soundEngine.playJail();
    const coLocated = this.players.filter(
      (p) => !p.bankrupt && p.position === 10,
    );
    this.renderer.placeTokenImmediate(player, coLocated);
    this.renderer.spawnBurst(10, 0xef4444);
  }

  getPurchasePrice(tile) {
    let price = tile.price;
    if (this.getCurrentLeyLine().id === 'abundance') {
      price = Math.floor((price * 0.9) / 5) * 5;
    }
    return price;
  }

  calculateRent(tile, owner, diceSum) {
    const st = this.tileState[tile.index];
    if (!st || st.mortgaged) return 0;

    const ll = this.getCurrentLeyLine();
    let rent = 0;

    if (tile.type === 'property') {
      const reg = REGIONS[tile.region];
      const ownsFullSet = reg.tiles.every(
        (i) => this.tileState[i] && this.tileState[i].ownerId === owner.id,
      );
      if (st.level === 0) {
        rent = ownsFullSet ? tile.rents[1] : tile.rents[0];
      } else {
        rent = tile.rents[st.level + 1];
      }

      if (owner.archonId === 'tsaritsa' && st.level >= 1) {
        rent = Math.round(rent * 1.1);
      }
      if (
        this.hasResonance(owner.id, 'vaporize') &&
        (tile.region === 'natlan' || tile.region === 'fontaine')
      ) {
        rent = Math.round(rent * 1.2);
      }
      if (
        this.hasResonance(owner.id, 'melt') &&
        (tile.region === 'natlan' || tile.region === 'snezhnaya')
      ) {
        rent = Math.round(rent * 1.25);
      }
      if (
        this.hasResonance(owner.id, 'lunarsurge') &&
        tile.region === 'nodkrai'
      ) {
        rent += 100;
      }
      if (
        ll.id === 'engulfing' &&
        (tile.region === 'inazuma' || tile.region === 'sumeru')
      ) {
        rent = Math.round(rent * 1.25);
      }
      if (
        ll.id === 'glacial' &&
        ['fontaine', 'natlan', 'nodkrai', 'snezhnaya'].includes(tile.region)
      ) {
        rent = Math.round(rent * 1.2);
      }
      if (ll.id === 'abyssal') {
        rent = Math.round(rent * 1.25);
      }
    } else if (tile.type === 'railroad') {
      const ownedCount = BOARD_TILES.filter(
        (t) =>
          t.type === 'railroad' &&
          this.tileState[t.index] &&
          this.tileState[t.index].ownerId === owner.id,
      ).length;
      rent =
        tile.rents[Math.max(0, ownedCount - 1)] * this.forcedRentMultiplier;
      if (ll.id === 'engulfing' || ll.id === 'abyssal') {
        rent = Math.round(rent * 1.25);
      }
    } else if (tile.type === 'utility') {
      const ownedCount = BOARD_TILES.filter(
        (t) =>
          t.type === 'utility' &&
          this.tileState[t.index] &&
          this.tileState[t.index].ownerId === owner.id,
      ).length;
      let mult = this.forcedUtilityTenX ? 10 : ownedCount >= 2 ? 12 : 5;
      if (this.hasResonance(owner.id, 'lunarsurge')) {
        mult *= 2;
      }
      rent = diceSum * mult;
      if (owner.archonId === 'columbina') {
        rent = Math.round(rent * 1.5);
      }
      if (ll.id === 'abyssal') {
        rent = Math.round(rent * 1.25);
      }
    }

    return Math.max(0, Math.round(rent));
  }

  async resolveTileLanding(player, diceSum) {
    const tile = BOARD_TILES[player.position];
    this.updateHUD();

    if (
      tile.type === 'property' ||
      tile.type === 'railroad' ||
      tile.type === 'utility'
    ) {
      const st = this.tileState[tile.index];
      if (!st.ownerId) {
        const price = this.getPurchasePrice(tile);
        if (player.isAI) {
          const completesSet =
            tile.type === 'property' &&
            REGIONS[tile.region].tiles
              .filter((i) => i !== tile.index)
              .every((i) => this.tileState[i].ownerId === player.id);
          const reserve = completesSet ? 80 : 200;
          if (player.mora >= price + reserve) {
            player.mora -= price;
            this.setTileOwner(tile.index, player.id);
            window.soundEngine.playCoin();
            this.renderer.spawnBurst(tile.index, 0xfcd34d);
            this.log(
              `🏛️ ${player.name} purchased ${tile.name} for ${price} Mora.`,
            );
          } else {
            this.log(
              `🔨 ${player.name} declined ${tile.name} — starting Auction!`,
            );
            await this.runAuction(tile);
          }
        } else {
          const decision = await this.showPurchaseModal(
            tile,
            price,
            player.mora >= price,
          );
          if (decision === 'buy' && player.mora >= price) {
            player.mora -= price;
            this.setTileOwner(tile.index, player.id);
            window.soundEngine.playCoin();
            this.renderer.spawnBurst(tile.index, 0xfcd34d);
            this.log(
              `🏛️ ${player.name} purchased ${tile.name} for ${price} Mora.`,
            );
          } else {
            this.log(`🔨 ${tile.name} sent to Teyvat Auction!`);
            await this.runAuction(tile);
          }
        }
      } else if (st.ownerId !== player.id) {
        const owner = this.getPlayerById(st.ownerId);
        if (st.mortgaged || !owner || owner.bankrupt) {
          this.log(`💤 ${tile.name} is mortgaged — no rent collected.`);
        } else {
          const rent = this.calculateRent(tile, owner, diceSum);
          const forbidMortgage = this.hasResonance(owner.id, 'superconduct');
          if (forbidMortgage) {
            window.soundEngine.playResonance();
            this.triggerElementalReactionFX(
              tile.index,
              '❄️⚡ SUPERCONDUCT! Mortgaging Locked',
              '#38BDF8',
              '#9333EA',
            );
          }
          this.log(
            `💰 ${player.name} landed on ${owner.name}'s ${tile.name} and owes ${rent} Mora rent!`,
          );
          await this.chargePlayer(
            player,
            rent,
            owner,
            `${tile.name} rent`,
            forbidMortgage,
            false,
            true,
          );

          if (!player.bankrupt) {
            await this.applyPostRentResonances(tile, owner, player, diceSum);
          }
        }
      } else {
        this.log(`🏡 ${player.name} visits their own territory: ${tile.name}.`);
      }
    } else if (tile.type === 'tax') {
      let amount = tile.amount;
      const notes = [];
      if (tile.subtype === 'income' && player.archonId === 'furina') {
        amount = Math.max(0, amount - 50);
        notes.push('Furina -50');
      }
      if (this.getCurrentLeyLine().id === 'blazing') {
        amount += 50;
        notes.push('Blazing Tithe +50');
      }
      if (this.hasResonance(player.id, 'crystallize')) {
        amount = Math.floor(amount * 0.5);
        notes.push('Crystallize 50%');
        window.soundEngine.playResonance();
        this.triggerElementalReactionFX(
          tile.index,
          '🪨✨ CRYSTALLIZE! Tax Halved',
          '#F59E0B',
          '#FCD34D',
        );
      }
      const suffix = notes.length ? ` (${notes.join(', ')})` : '';
      this.log(
        `💸 ${player.name} hit ${tile.name} and pays ${amount} Mora to the Bank${suffix}.`,
      );
      await this.chargePlayer(player, amount, null, tile.name, false, true);
    } else if (tile.type === 'corner' && tile.subtype === 'freeparking') {
      if (this.potPoolEnabled && this.potPool > 0) {
        const jackpot = this.potPool;
        this.potPool = 0;
        player.mora += jackpot;
        window.soundEngine.playCoin();
        this.renderer.spawnBurst(20, 0x2dd4bf);
        this.log(
          `🍵 Serenitea Pot Jackpot! ${player.name} claimed ${jackpot} Mora!`,
        );
      } else {
        this.log(
          `🍵 ${player.name} rests peacefully inside the Serenitea Pot.`,
        );
      }
    } else if (tile.type === 'corner' && tile.subtype === 'gotojail') {
      this.log(
        `⚖️ Detained by the Gardes! ${player.name} is sent directly to Fortress of Meropide.`,
      );
      await this.sendPlayerToJail(player);
    } else if (tile.type === 'chance' || tile.type === 'chest') {
      await this.drawAndResolveCard(player, tile.type, diceSum);
    }

    this.forcedRentMultiplier = 1;
    this.forcedUtilityTenX = false;
    this.updateHUD();
  }

  async applyPostRentResonances(tile, owner, payer, diceSum) {
    if (tile.type !== 'property') return;

    if (
      this.hasResonance(owner.id, 'overloaded') &&
      (tile.region === 'natlan' || tile.region === 'inazuma')
    ) {
      window.soundEngine.playResonance();
      this.triggerElementalReactionFX(
        tile.index,
        '⚡🔥 OVERLOADED! +50 Mora Blast',
        '#DC2626',
        '#9333EA',
      );
      this.log(
        `⚡🔥 Overloaded Resonance! ${payer.name} takes 50 Mora blast damage to the Bank!`,
      );
      await this.chargePlayer(
        payer,
        50,
        null,
        'Overloaded blast penalty',
        false,
        true,
      );
    }

    if (
      this.hasResonance(owner.id, 'burning') &&
      (tile.region === 'natlan' || tile.region === 'sumeru')
    ) {
      payer.forfeitNextGo = true;
      window.soundEngine.playResonance();
      this.triggerElementalReactionFX(
        tile.index,
        '🌿🔥 BURNING! Next GO Forfeited',
        '#16A34A',
        '#DC2626',
      );
      this.log(
        `🌿🔥 Burning Resonance! ${payer.name} will forfeit their next +200 Mora GO reward!`,
      );
    }

    if (
      this.hasResonance(owner.id, 'frozen') &&
      (tile.region === 'fontaine' || tile.region === 'snezhnaya')
    ) {
      payer.skipNextTurn = true;
      window.soundEngine.playResonance();
      this.triggerElementalReactionFX(
        tile.index,
        '💧❄️ FROZEN! Roll Encased in Ice',
        '#2563EB',
        '#38BDF8',
      );
      this.log(
        `💧❄️ Frozen Resonance! ${payer.name} is frozen and will skip their next roll unless thawed!`,
      );
    }

    if (this.hasResonance(owner.id, 'electrocharged')) {
      window.soundEngine.playResonance();
      this.triggerElementalReactionFX(
        tile.index,
        '💧⚡ ELECTRO-CHARGED! AoE Shock',
        '#2563EB',
        '#9333EA',
      );
      for (const other of this.players) {
        if (!other.bankrupt && other.id !== owner.id && other.id !== payer.id) {
          this.log(
            `💧⚡ Electro-Charged! ${other.name} takes 25 Mora shock damage paid to ${owner.name}!`,
          );
          await this.chargePlayer(other, 25, owner, 'Electro-Charged shock');
        }
      }
    }

    if (this.hasResonance(owner.id, 'swirl') && tile.region === 'mondstadt') {
      window.soundEngine.playResonance();
      this.triggerElementalReactionFX(
        tile.index,
        '🍃 SWIRL! Gale Gust +2 Tiles',
        '#2DD4BF',
        '#A7F3D0',
      );
      this.log(
        `🍃 Swirl Resonance! Anemo gusts push ${payer.name} forward 2 spaces!`,
      );
      await this.movePlayerSteps(payer, 2, true);
      await this.resolveTileLanding(payer, diceSum);
    }
  }

  async drawAndResolveCard(player, deckType, diceSum) {
    const deck = deckType === 'chance' ? this.chanceDeck : this.chestDeck;
    const deckLabel = deckType === 'chance' ? 'Event Wish' : 'Daily Commission';

    for (const p of this.players) {
      if (!p.bankrupt && p.archonId === 'nahida') {
        p.mora += 25;
        this.log(
          `🌱 All Schemes to Know: Nahida (${p.name}) gains +25 Mora from card draw!`,
        );
      }
    }

    const drawOne = () => {
      if (deck.length === 0) {
        deck.push(
          ...this.shuffle(
            deckType === 'chance' ? EVENT_WISH_CARDS : DAILY_COMMISSION_CARDS,
          ),
        );
      }
      return deck.shift();
    };

    let chosenCard = drawOne();

    if (player.archonId === 'nahida') {
      const secondCard = drawOne();
      if (player.isAI) {
        const pickFirst =
          chosenCard.action === 'gain' || chosenCard.action === 'jailCard';
        const unpicked = pickFirst ? secondCard : chosenCard;
        chosenCard = pickFirst ? chosenCard : secondCard;
        deck.push(unpicked);
      } else {
        chosenCard = await this.showNahidaPickModal(
          deckLabel,
          chosenCard,
          secondCard,
        );
      }
    }

    deck.push(chosenCard);
    window.soundEngine.playWish(chosenCard.rarity || 4);

    if (!player.isAI) {
      await this.showCardRevealModal(deckLabel, chosenCard);
    } else {
      this.log(
        `🎴 ${player.name} drew [${deckLabel}] "${chosenCard.title}": ${chosenCard.effectText}`,
      );
    }

    await this.executeCardEffect(player, chosenCard, diceSum);
  }

  async executeCardEffect(player, card, diceSum) {
    const isCrystallize = this.hasResonance(player.id, 'crystallize');

    switch (card.action) {
      case 'gain':
        player.mora += card.amount;
        window.soundEngine.playCoin();
        this.log(`✨ ${player.name} collected +${card.amount} Mora.`);
        break;
      case 'payBank': {
        if (player.archonId === 'raiden') {
          this.log(
            `⚡ Euthymic Decree: Raiden Shogun is immune to Bank card payments!`,
          );
          break;
        }
        const amt = isCrystallize ? Math.floor(card.amount * 0.5) : card.amount;
        await this.chargePlayer(player, amt, null, card.title, false, true);
        break;
      }
      case 'payEach': {
        for (const other of this.players) {
          if (!other.bankrupt && other.id !== player.id) {
            await this.chargePlayer(player, card.amount, other, card.title);
          }
        }
        break;
      }
      case 'collectEach': {
        for (const other of this.players) {
          if (!other.bankrupt && other.id !== player.id) {
            await this.chargePlayer(other, card.amount, player, card.title);
          }
        }
        break;
      }
      case 'jailCard':
        player.jailCards += 1;
        this.log(`📜 ${player.name} kept an Official Pardon card.`);
        break;
      case 'goToJail':
        await this.sendPlayerToJail(player);
        break;
      case 'moveTo': {
        const steps = (card.target - player.position + 40) % 40;
        await this.movePlayerSteps(player, steps, card.passGo);
        await this.resolveTileLanding(player, diceSum);
        break;
      }
      case 'moveRel':
        await this.movePlayerSteps(player, card.delta, false);
        await this.resolveTileLanding(player, diceSum);
        break;
      case 'nearestRailroad': {
        const rails = [5, 15, 23, 35];
        let minDist = 40;
        for (const r of rails) {
          const d = (r - player.position + 40) % 40;
          if (d > 0 && d < minDist) minDist = d;
        }
        this.forcedRentMultiplier = 2;
        await this.movePlayerSteps(player, minDist, true);
        await this.resolveTileLanding(player, diceSum);
        break;
      }
      case 'nearestUtility': {
        const utils = [13, 33];
        let minDist = 40;
        for (const u of utils) {
          const d = (u - player.position + 40) % 40;
          if (d > 0 && d < minDist) minDist = d;
        }
        this.forcedUtilityTenX = true;
        await this.movePlayerSteps(player, minDist, true);
        await this.resolveTileLanding(player, diceSum);
        break;
      }
      case 'repairs': {
        if (player.archonId === 'raiden') {
          this.log(
            `⚡ Euthymic Decree: Raiden Shogun is immune to structure repair fees!`,
          );
          break;
        }
        let total = 0;
        Object.values(this.tileState).forEach((st) => {
          if (st.ownerId === player.id) {
            if (st.level === 5) total += card.tavern;
            else if (st.level > 0) total += st.level * card.outpost;
          }
        });
        if (isCrystallize) total = Math.floor(total * 0.5);
        if (total > 0) {
          this.log(
            `🔨 ${player.name} pays ${total} Mora in regional structure upkeep.`,
          );
          await this.chargePlayer(player, total, null, card.title, false, true);
        } else {
          this.log(`✨ ${player.name} has no buildings to repair.`);
        }
        break;
      }
    }
  }

  // --- DEBT, LIQUIDATION & BANKRUPTCY ---
  async chargePlayer(
    payer,
    amount,
    creditor = null,
    reason = '',
    forbidMortgage = false,
    toPot = false,
    isRent = false,
  ) {
    if (amount <= 0 || payer.bankrupt) return;

    const recordTransfer = (paid) => {
      if (isRent && payer.stats) {
        payer.stats.rentPaid += paid;
        if (paid > payer.stats.maxSingleRent) payer.stats.maxSingleRent = paid;
      }
      if (isRent && creditor && creditor.stats) {
        creditor.stats.rentEarned += paid;
      }
      if (!creditor && toPot) {
        this.addToPotPool(paid, reason);
      }
    };

    if (payer.mora >= amount) {
      payer.mora -= amount;
      if (creditor) creditor.mora += amount;
      recordTransfer(amount);
      window.soundEngine.playPay();
      this.updateHUD();
      return;
    }

    const maxRecoverable =
      payer.mora + this.getLiquidationPotential(payer, forbidMortgage);
    if (maxRecoverable < amount) {
      const paid = payer.mora;
      payer.mora = 0;
      if (creditor) creditor.mora += paid;
      recordTransfer(paid);
      this.declareBankruptcy(payer, creditor);
      this.updateHUD();
      return;
    }

    if (payer.isAI) {
      this.autoLiquidateAI(payer, amount, forbidMortgage);
    } else {
      while (payer.mora < amount && !payer.bankrupt) {
        await this.showLiquidationModal(payer, amount, reason, forbidMortgage);
      }
    }

    if (!payer.bankrupt) {
      payer.mora -= amount;
      if (creditor) creditor.mora += amount;
      recordTransfer(amount);
      window.soundEngine.playPay();
    }
    this.updateHUD();
  }

  getLiquidationPotential(player, forbidMortgage = false) {
    let potential = 0;
    Object.entries(this.tileState).forEach(([idxStr, st]) => {
      const idx = parseInt(idxStr, 10);
      if (st.ownerId !== player.id) return;
      const tile = BOARD_TILES[idx];
      if (st.level > 0) {
        const refund = Math.floor(REGIONS[tile.region].buildCost * 0.5);
        potential += st.level * refund;
      }
      if (!forbidMortgage && !st.mortgaged) {
        potential += tile.mortgage;
      }
    });
    return potential;
  }

  autoLiquidateAI(player, targetMora, forbidMortgage) {
    while (player.mora < targetMora) {
      let soldOne = false;
      for (const [idxStr, st] of Object.entries(this.tileState)) {
        const idx = parseInt(idxStr, 10);
        if (
          st.ownerId === player.id &&
          st.level > 0 &&
          this.canSellBuilding(idx, player)
        ) {
          this.sellBuilding(idx, player);
          soldOne = true;
          if (player.mora >= targetMora) return;
        }
      }
      if (!soldOne) break;
    }

    if (!forbidMortgage && player.mora < targetMora) {
      for (const [idxStr, st] of Object.entries(this.tileState)) {
        const idx = parseInt(idxStr, 10);
        if (
          st.ownerId === player.id &&
          !st.mortgaged &&
          this.canMortgageTile(idx, player)
        ) {
          this.mortgageTile(idx, player, true);
          if (player.mora >= targetMora) return;
        }
      }
    }
  }

  declareBankruptcy(player, creditor) {
    player.bankrupt = true;
    this.log(`💀 BANKRUPTCY! ${player.name} has been eliminated from Teyvat!`);
    if (this.renderer.tokenMeshes[player.id]) {
      this.renderer.scene.remove(this.renderer.tokenMeshes[player.id]);
    }

    Object.entries(this.tileState).forEach(([idxStr, st]) => {
      const idx = parseInt(idxStr, 10);
      if (st.ownerId === player.id) {
        st.level = 0;
        this.renderer.updateTileBuildings(idx, 0);
        if (creditor && !creditor.bankrupt) {
          this.setTileOwner(idx, creditor.id);
        } else {
          st.mortgaged = false;
          this.setTileOwner(idx, null);
        }
      }
    });
    this.refreshMonopolyVisuals();

    const alive = this.players.filter((p) => !p.bankrupt);
    if (alive.length <= 1) {
      this.endMatchWithWinner(alive[0]);
    }
  }

  endMatchWithWinner(winner) {
    this.gameOver = true;
    localStorage.removeItem(SAVE_STORAGE_KEY);
    this.refreshResumeButton();
    window.soundEngine.playVictory();
    this.log(
      `👑 VICTORY! ${winner ? winner.name : 'An Archon'} rules all of Teyvat!`,
    );
    this.showVictoryModal(winner);
  }

  // --- BUILDING, MORTGAGE & DEED MANAGEMENT ---
  getBuildCost(tile, player) {
    const reg = REGIONS[tile.region];
    let cost = reg.buildCost;
    if (
      this.hasResonance(player.id, 'quicken') &&
      (tile.region === 'inazuma' || tile.region === 'sumeru')
    ) {
      cost = Math.max(25, cost - 25);
    }
    if (this.getCurrentLeyLine().id === 'tectonic') {
      cost = Math.max(25, cost - 25);
    }
    if (player.archonId === 'zhongli') {
      cost = Math.floor((cost * 0.85) / 5) * 5;
    }
    return Math.max(10, cost);
  }

  canBuildOnTile(tileIndex, player) {
    const tile = BOARD_TILES[tileIndex];
    const st = this.tileState[tileIndex];
    if (
      !tile ||
      tile.type !== 'property' ||
      !st ||
      st.ownerId !== player.id ||
      st.mortgaged
    )
      return false;
    if (st.level >= 5) return false;

    const reg = REGIONS[tile.region];
    const regStates = reg.tiles.map((i) => this.tileState[i]);
    if (regStates.some((s) => !s || s.ownerId !== player.id || s.mortgaged))
      return false;

    const minLevel = Math.min(...regStates.map((s) => s.level));
    if (st.level > minLevel) return false;

    return player.mora >= this.getBuildCost(tile, player);
  }

  buildOnTile(tileIndex, player = this.getCurrentPlayer()) {
    if (!this.canBuildOnTile(tileIndex, player)) return false;
    const tile = BOARD_TILES[tileIndex];
    const st = this.tileState[tileIndex];
    const cost = this.getBuildCost(tile, player);

    player.mora -= cost;
    st.level += 1;
    if (player.stats) player.stats.buildsCount += 1;

    if (this.hasResonance(player.id, 'bloom')) {
      player.mora += 50;
      this.triggerElementalReactionFX(
        tileIndex,
        '💧🌿 BLOOM! +50 Mora Rebate',
        '#2563EB',
        '#16A34A',
      );
      this.log(
        `💧🌿 Bloom Resonance! ${player.name} received +50 Mora ecological rebate.`,
      );
    }

    window.soundEngine.playBuild(st.level === 5);
    this.renderer.updateTileBuildings(tileIndex, st.level);
    this.renderer.spawnBurst(tileIndex, 0x2dd4bf);
    const label =
      st.level === 5 ? 'Grand Tavern' : `Adventurers' Outpost #${st.level}`;
    this.log(
      `🏗️ ${player.name} constructed ${label} on ${tile.name} (${cost} Mora).`,
    );
    this.updateHUD();
    if (this.selectedTileIndex === tileIndex) this.inspectTile(tileIndex);
    return true;
  }

  canSellBuilding(tileIndex, player) {
    const tile = BOARD_TILES[tileIndex];
    const st = this.tileState[tileIndex];
    if (
      !tile ||
      tile.type !== 'property' ||
      !st ||
      st.ownerId !== player.id ||
      st.level <= 0
    )
      return false;
    const reg = REGIONS[tile.region];
    const maxLevel = Math.max(...reg.tiles.map((i) => this.tileState[i].level));
    return st.level >= maxLevel;
  }

  sellBuilding(tileIndex, player = this.getCurrentPlayer()) {
    if (!this.canSellBuilding(tileIndex, player)) return false;
    const tile = BOARD_TILES[tileIndex];
    const st = this.tileState[tileIndex];
    const refund = Math.floor(REGIONS[tile.region].buildCost * 0.5);
    st.level -= 1;
    player.mora += refund;
    window.soundEngine.playCoin();
    this.renderer.updateTileBuildings(tileIndex, st.level);
    this.log(
      `🔨 ${player.name} dismantled a structure on ${tile.name} for +${refund} Mora.`,
    );
    this.updateHUD();
    if (this.selectedTileIndex === tileIndex) this.inspectTile(tileIndex);
    return true;
  }

  canMortgageTile(tileIndex, player) {
    const st = this.tileState[tileIndex];
    const tile = BOARD_TILES[tileIndex];
    if (!st || st.ownerId !== player.id || st.mortgaged || st.level > 0)
      return false;
    if (tile.type === 'property') {
      const reg = REGIONS[tile.region];
      if (reg.tiles.some((i) => this.tileState[i].level > 0)) return false;
    }
    return true;
  }

  mortgageTile(tileIndex, player = this.getCurrentPlayer(), force = false) {
    if (!force && !this.canMortgageTile(tileIndex, player)) return false;
    const tile = BOARD_TILES[tileIndex];
    const st = this.tileState[tileIndex];
    st.mortgaged = true;
    player.mora += tile.mortgage;
    window.soundEngine.playCoin();
    this.renderer.updateTileAppearance(tileIndex, player.color, true);
    this.log(
      `🏦 ${player.name} mortgaged ${tile.name} for +${tile.mortgage} Mora.`,
    );
    this.updateHUD();
    if (this.selectedTileIndex === tileIndex) this.inspectTile(tileIndex);
    return true;
  }

  getUnmortgageCost(tile, player) {
    if (player.archonId === 'tsaritsa') return tile.mortgage;
    return Math.ceil(tile.mortgage * 1.1);
  }

  unmortgageTile(tileIndex, player = this.getCurrentPlayer()) {
    const tile = BOARD_TILES[tileIndex];
    const st = this.tileState[tileIndex];
    if (!st || st.ownerId !== player.id || !st.mortgaged) return false;
    const cost = this.getUnmortgageCost(tile, player);
    if (player.mora < cost) return false;
    player.mora -= cost;
    st.mortgaged = false;
    window.soundEngine.playPay();
    this.renderer.updateTileAppearance(tileIndex, player.color, false);
    this.log(`📜 ${player.name} unmortgaged ${tile.name} for ${cost} Mora.`);
    this.updateHUD();
    if (this.selectedTileIndex === tileIndex) this.inspectTile(tileIndex);
    return true;
  }

  // --- AI TRADE PROPOSALS & TURN EXECUTION ---
  async tryAITradeProposal(ai) {
    if (ai.mora < 320 || Math.random() > 0.45) return;

    for (const reg of Object.values(REGIONS)) {
      const ownedByAI = reg.tiles.filter(
        (i) => this.tileState[i].ownerId === ai.id,
      );
      if (ownedByAI.length !== 2) continue;

      const missingIdx = reg.tiles.find(
        (i) => this.tileState[i].ownerId !== ai.id,
      );
      const missingSt = this.tileState[missingIdx];
      if (!missingSt || !missingSt.ownerId || missingSt.level > 0) continue;

      const targetPlayer = this.getPlayerById(missingSt.ownerId);
      if (!targetPlayer || targetPlayer.bankrupt || targetPlayer.id === ai.id)
        continue;

      const targetTile = BOARD_TILES[missingIdx];
      const offerMora = Math.min(
        ai.mora - 180,
        Math.round((targetTile.price * 1.45) / 10) * 10,
      );
      if (offerMora < targetTile.price) continue;

      if (!targetPlayer.isAI) {
        const resp = await this.showChoiceModal(
          `🤝 Diplomatic Offer from ${ai.name}`,
          `${ai.name} wants to buy ${targetTile.name} (${reg.name}) from you for ${offerMora} Mora!`,
          [
            { label: `Accept (+${offerMora} Mora)`, value: 'accept' },
            { label: 'Decline Offer', value: 'decline' },
          ],
        );
        if (resp === 'accept') {
          ai.mora -= offerMora;
          targetPlayer.mora += offerMora;
          this.setTileOwner(missingIdx, ai.id);
          window.soundEngine.playTrade();
          this.log(
            `🤝 ${targetPlayer.name} sold ${targetTile.name} to ${ai.name} for ${offerMora} Mora!`,
          );
          this.updateHUD();
        } else {
          this.log(
            `🤝 ${targetPlayer.name} declined ${ai.name}'s offer for ${targetTile.name}.`,
          );
        }
      }
      break;
    }
  }

  async runAITurn() {
    if (this.gameOver) return;
    const ai = this.getCurrentPlayer();
    if (!ai || !ai.isAI || ai.bankrupt) return;

    if (ai.inJail) {
      if (ai.jailCards > 0) {
        this.useJailCard();
      } else if (ai.mora >= 350 && this.roundNumber >= 5) {
        this.payJailBail();
      }
    }

    await this.tryAITradeProposal(ai);
    if (this.gameOver || ai.bankrupt) return;

    await this.handleRollClick();

    while (!this.hasRolled && !this.gameOver && !ai.bankrupt && !ai.inJail) {
      await new Promise((r) => setTimeout(r, 600 / this.speedMultiplier));
      await this.handleRollClick();
    }

    if (this.gameOver || ai.bankrupt) return;

    for (const [idxStr, st] of Object.entries(this.tileState)) {
      const idx = parseInt(idxStr, 10);
      if (st.ownerId === ai.id && st.mortgaged) {
        const cost = this.getUnmortgageCost(BOARD_TILES[idx], ai);
        if (ai.mora >= cost + 250) {
          this.unmortgageTile(idx, ai);
        }
      }
    }

    let built = true;
    let safety = 0;
    while (built && safety < 15) {
      built = false;
      safety++;
      for (const [idxStr, st] of Object.entries(this.tileState)) {
        const idx = parseInt(idxStr, 10);
        if (st.ownerId === ai.id && this.canBuildOnTile(idx, ai)) {
          const cost = this.getBuildCost(BOARD_TILES[idx], ai);
          if (ai.mora >= cost + 180) {
            this.buildOnTile(idx, ai);
            built = true;
            await new Promise((r) => setTimeout(r, 220 / this.speedMultiplier));
          }
        }
      }
    }

    await new Promise((r) => setTimeout(r, 580 / this.speedMultiplier));
    this.endTurn();
  }

  endTurn() {
    if (this.isAnimating || !this.hasRolled || this.gameOver) return;
    this.advanceToNextPlayer();
  }

  advanceToNextPlayer() {
    const prevIdx = this.currentPlayerIndex;
    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % this.players.length;
      if (this.currentPlayerIndex <= prevIdx) {
        this.roundNumber += 1;
        if (this.gameMode === 'sprint20' && this.roundNumber > 20) {
          const alive = this.players.filter((p) => !p.bankrupt);
          alive.sort(
            (a, b) => this.calculateNetWorth(b) - this.calculateNetWorth(a),
          );
          this.endMatchWithWinner(alive[0]);
          return;
        }
        this.applyCurrentLeyLineTheme();
      }
    } while (this.players[this.currentPlayerIndex].bankrupt && !this.gameOver);

    this.startTurn();
  }

  // --- AUCTION SYSTEM ---
  runAuction(tile) {
    return new Promise((resolve) => {
      const activeBidders = this.players.filter((p) => !p.bankrupt);
      if (activeBidders.length === 0) return resolve();

      const modal = document.getElementById('auction-modal');
      let highBid = Math.max(10, Math.floor(tile.price * 0.25));
      let highBidder = null;
      const passed = new Set();
      let turnIdx = 0;

      const aiMaxBid = (ai) => {
        let cap = tile.price * 1.1;
        if (tile.type === 'property') {
          const ownedInReg = REGIONS[tile.region].tiles.filter(
            (i) => this.tileState[i].ownerId === ai.id,
          ).length;
          if (ownedInReg === 2) cap = tile.price * 1.65;
          else if (ownedInReg === 1) cap = tile.price * 1.25;
        }
        return Math.min(ai.mora - 80, Math.floor(cap));
      };

      const renderAuction = () => {
        while (
          passed.has(activeBidders[turnIdx].id) &&
          passed.size < activeBidders.length
        ) {
          turnIdx = (turnIdx + 1) % activeBidders.length;
        }

        if (
          passed.size >= activeBidders.length ||
          (passed.size === activeBidders.length - 1 && highBidder)
        ) {
          modal.classList.add('hidden');
          if (highBidder) {
            highBidder.mora -= highBid;
            this.setTileOwner(tile.index, highBidder.id);
            window.soundEngine.playAuction();
            this.renderer.spawnBurst(tile.index, 0xfcd34d);
            this.log(
              `🔨 Auction Sold! ${highBidder.name} won ${tile.name} for ${highBid} Mora.`,
            );
          } else {
            this.log(`🔨 No bids placed for ${tile.name}. It remains unowned.`);
          }
          this.updateHUD();
          resolve();
          return;
        }

        const bidder = activeBidders[turnIdx];
        document.getElementById('auction-tile-name').textContent = tile.name;
        document.getElementById('auction-current-bid').textContent = highBidder
          ? `${highBid} Mora (by ${highBidder.name})`
          : `Starting at ${highBid} Mora`;
        document.getElementById('auction-turn-label').textContent =
          `Current Bidder: ${bidder.name} (${bidder.mora} Mora)`;

        const controls = document.getElementById('auction-controls');
        if (bidder.isAI) {
          controls.innerHTML = `<div class="ai-thinking">Evaluating bid...</div>`;
          setTimeout(() => {
            const nextBid = highBidder ? highBid + 15 : highBid;
            if (nextBid <= aiMaxBid(bidder)) {
              highBid = nextBid;
              highBidder = bidder;
            } else {
              passed.add(bidder.id);
            }
            turnIdx = (turnIdx + 1) % activeBidders.length;
            renderAuction();
          }, 380 / this.speedMultiplier);
        } else {
          const minNext = highBidder ? highBid + 10 : highBid;
          controls.innerHTML = `
            <button class="btn-primary" id="auc-bid-10" ${bidder.mora < minNext ? 'disabled' : ''}>Bid ${minNext}</button>
            <button class="btn-primary" id="auc-bid-25" ${bidder.mora < minNext + 15 ? 'disabled' : ''}>Bid ${minNext + 15}</button>
            <button class="btn-secondary" id="auc-pass">Pass</button>
          `;
          document.getElementById('auc-bid-10').onclick = () => {
            highBid = minNext;
            highBidder = bidder;
            turnIdx = (turnIdx + 1) % activeBidders.length;
            renderAuction();
          };
          document.getElementById('auc-bid-25').onclick = () => {
            highBid = minNext + 15;
            highBidder = bidder;
            turnIdx = (turnIdx + 1) % activeBidders.length;
            renderAuction();
          };
          document.getElementById('auc-pass').onclick = () => {
            passed.add(bidder.id);
            turnIdx = (turnIdx + 1) % activeBidders.length;
            renderAuction();
          };
        }
      };

      modal.classList.remove('hidden');
      renderAuction();
    });
  }

  // --- PLAYER-TO-PLAYER TRADE MODAL (Includes Official Pardons) ---
  openTradeModal() {
    const me = this.getCurrentPlayer();
    if (me.isAI || this.isAnimating) return;

    const partners = this.players.filter((p) => !p.bankrupt && p.id !== me.id);
    if (partners.length === 0) return;

    const modal = document.getElementById('trade-modal');
    const partnerSelect = document.getElementById('trade-partner');
    partnerSelect.innerHTML = partners
      .map((p) => `<option value="${p.id}">${p.name} (${p.mora} Mora)</option>`)
      .join('');

    const renderTradeLists = () => {
      const partner = this.getPlayerById(partnerSelect.value);
      const myProps = Object.entries(this.tileState)
        .filter(([, st]) => st.ownerId === me.id && st.level === 0)
        .map(([idx]) => BOARD_TILES[parseInt(idx, 10)]);
      const theirProps = Object.entries(this.tileState)
        .filter(([, st]) => st.ownerId === partner.id && st.level === 0)
        .map(([idx]) => BOARD_TILES[parseInt(idx, 10)]);

      document.getElementById('trade-my-props').innerHTML = myProps.length
        ? myProps
            .map(
              (t) =>
                `<label class="trade-item"><input type="checkbox" value="${t.index}"> ${t.name} (${t.price})${this.tileState[t.index].mortgaged ? ' [M]' : ''}</label>`,
            )
            .join('')
        : '<div class="muted">No unbuilt deeds</div>';

      document.getElementById('trade-their-props').innerHTML = theirProps.length
        ? theirProps
            .map(
              (t) =>
                `<label class="trade-item"><input type="checkbox" value="${t.index}"> ${t.name} (${t.price})${this.tileState[t.index].mortgaged ? ' [M]' : ''}</label>`,
            )
            .join('')
        : '<div class="muted">No unbuilt deeds</div>';

      document.getElementById('trade-my-mora').max = me.mora;
      document.getElementById('trade-my-mora').value = 0;
      document.getElementById('trade-their-mora').max = partner.mora;
      document.getElementById('trade-their-mora').value = 0;

      const myPardonInput = document.getElementById('trade-my-pardons');
      const theirPardonInput = document.getElementById('trade-their-pardons');
      myPardonInput.max = me.jailCards || 0;
      myPardonInput.value = 0;
      theirPardonInput.max = partner.jailCards || 0;
      theirPardonInput.value = 0;
      document
        .getElementById('trade-my-pardon-wrap')
        .classList.toggle('hidden', (me.jailCards || 0) <= 0);
      document
        .getElementById('trade-their-pardon-wrap')
        .classList.toggle('hidden', (partner.jailCards || 0) <= 0);
    };

    partnerSelect.onchange = renderTradeLists;
    renderTradeLists();

    document.getElementById('trade-cancel').onclick = () =>
      modal.classList.add('hidden');
    document.getElementById('trade-submit').onclick = () => {
      const partner = this.getPlayerById(partnerSelect.value);
      const myMora = Math.max(
        0,
        Math.min(
          me.mora,
          parseInt(document.getElementById('trade-my-mora').value || '0', 10),
        ),
      );
      const theirMora = Math.max(
        0,
        Math.min(
          partner.mora,
          parseInt(
            document.getElementById('trade-their-mora').value || '0',
            10,
          ),
        ),
      );
      const myOffered = [
        ...document.querySelectorAll('#trade-my-props input:checked'),
      ].map((c) => parseInt(c.value, 10));
      const theirRequested = [
        ...document.querySelectorAll('#trade-their-props input:checked'),
      ].map((c) => parseInt(c.value, 10));
      const myPardons = Math.max(
        0,
        Math.min(
          me.jailCards || 0,
          parseInt(
            document.getElementById('trade-my-pardons').value || '0',
            10,
          ),
        ),
      );
      const theirPardons = Math.max(
        0,
        Math.min(
          partner.jailCards || 0,
          parseInt(
            document.getElementById('trade-their-pardons').value || '0',
            10,
          ),
        ),
      );

      if (
        myMora === 0 &&
        theirMora === 0 &&
        myOffered.length === 0 &&
        theirRequested.length === 0 &&
        myPardons === 0 &&
        theirPardons === 0
      )
        return;

      let accepted = true;
      if (partner.isAI) {
        const valueGivenToAI =
          myMora +
          myPardons * 75 +
          myOffered.reduce((acc, idx) => {
            const t = BOARD_TILES[idx];
            let v = this.tileState[idx].mortgaged ? t.price * 0.55 : t.price;
            if (t.type === 'property') {
              const c = REGIONS[t.region].tiles.filter(
                (i) => this.tileState[i].ownerId === partner.id,
              ).length;
              if (c >= 2) v *= 1.65;
            }
            return acc + v;
          }, 0);

        const valueTakenFromAI =
          theirMora +
          theirPardons * 75 +
          theirRequested.reduce((acc, idx) => {
            const t = BOARD_TILES[idx];
            let v =
              (this.tileState[idx].mortgaged ? t.price * 0.65 : t.price) * 1.15;
            if (t.type === 'property') {
              const c = REGIONS[t.region].tiles.filter(
                (i) => this.tileState[i].ownerId === partner.id,
              ).length;
              if (c >= 2) v *= 1.8;
            }
            return acc + v;
          }, 0);

        accepted = valueGivenToAI >= valueTakenFromAI * 0.95;
      }

      if (!accepted) {
        this.log(`🤝 ${partner.name} declined your trade proposal.`);
        modal.classList.add('hidden');
        return;
      }

      me.mora = me.mora - myMora + theirMora;
      partner.mora = partner.mora - theirMora + myMora;
      me.jailCards = (me.jailCards || 0) - myPardons + theirPardons;
      partner.jailCards = (partner.jailCards || 0) - theirPardons + myPardons;
      myOffered.forEach((idx) => this.setTileOwner(idx, partner.id));
      theirRequested.forEach((idx) => this.setTileOwner(idx, me.id));

      window.soundEngine.playTrade();
      this.log(`🤝 Trade completed between ${me.name} and ${partner.name}!`);
      modal.classList.add('hidden');
      this.saveMatchState();
      this.updateHUD();
    };

    modal.classList.remove('hidden');
  }

  openPortfolioModal(playerId) {
    const p = this.getPlayerById(playerId);
    if (!p) return;
    const archon = ARCHONS.find((a) => a.id === p.archonId) || ARCHONS[0];
    document.getElementById('port-title').textContent =
      `${p.name} · ${archon.name}`;
    document.getElementById('port-sub').textContent =
      `Liquid: ${p.mora} Mora · Net Worth: ${this.calculateNetWorth(p)} Mora · Official Pardons: ${p.jailCards || 0}`;

    const owned = Object.entries(this.tileState)
      .filter(([, st]) => st.ownerId === p.id)
      .map(([idxStr, st]) => ({ tile: BOARD_TILES[parseInt(idxStr, 10)], st }));

    const body = document.getElementById('port-body');
    body.innerHTML = owned.length
      ? owned
          .map(({ tile, st }) => {
            const reg = tile.region ? REGIONS[tile.region] : null;
            const color = reg ? reg.color : '#38BDF8';
            const levelText =
              st.level === 5
                ? 'Grand Tavern'
                : st.level > 0
                  ? `${st.level} Outpost(s)`
                  : 'Unbuilt';
            return `
            <div class="port-item" style="border-left-color:${color}">
              <strong>${tile.name}</strong>
              <div class="muted">${reg ? reg.name : tile.subtitle} · ${levelText} ${st.mortgaged ? '· [MORTGAGED]' : ''}</div>
            </div>
          `;
          })
          .join('')
      : '<div class="muted">No deeds owned yet.</div>';

    document.getElementById('portfolio-modal').classList.remove('hidden');
  }

  // --- MODALS ---
  showPurchaseModal(tile, price, canAfford) {
    return new Promise((resolve) => {
      const modal = document.getElementById('purchase-modal');
      const reg = tile.region ? REGIONS[tile.region] : null;
      document.getElementById('purch-badge').textContent = reg
        ? `${reg.name} · ${reg.element}`
        : tile.subtitle;
      document.getElementById('purch-badge').style.background = reg
        ? reg.color
        : '#38BDF8';
      document.getElementById('purch-title').textContent = tile.name;
      document.getElementById('purch-price').textContent = `${price} Mora`;
      document.getElementById('purch-rent-info').innerHTML =
        tile.type === 'property'
          ? `Base Rent: <strong>${tile.rents[0]}</strong> · Full Set: <strong>${tile.rents[1]}</strong> · Grand Tavern: <strong>${tile.rents[6]}</strong>`
          : tile.description ||
            'Expedition Realm Transit Hub (25 / 50 / 100 / 200 Mora)';

      const buyBtn = document.getElementById('purch-buy-btn');
      buyBtn.disabled = !canAfford;
      buyBtn.textContent = canAfford
        ? `Buy Deed (${price} Mora)`
        : 'Insufficient Mora';

      buyBtn.onclick = () => {
        modal.classList.add('hidden');
        resolve('buy');
      };
      document.getElementById('purch-auction-btn').onclick = () => {
        modal.classList.add('hidden');
        resolve('auction');
      };

      modal.classList.remove('hidden');
    });
  }

  showCardRevealModal(deckLabel, card) {
    return new Promise((resolve) => {
      const modal = document.getElementById('card-modal');
      const box = document.getElementById('card-modal-box');
      box.className = `modal-card wish-rarity-${card.rarity || 4}`;
      document.getElementById('card-deck-tag').textContent =
        `${deckLabel} · ${'★'.repeat(card.rarity || 4)}`;
      document.getElementById('card-title').textContent = card.title;
      document.getElementById('card-flavor').textContent = `"${card.flavor}"`;
      document.getElementById('card-effect').textContent = card.effectText;

      document.getElementById('card-ok-btn').onclick = () => {
        modal.classList.add('hidden');
        resolve();
      };
      modal.classList.remove('hidden');
    });
  }

  showNahidaPickModal(deckLabel, c1, c2) {
    return new Promise((resolve) => {
      const modal = document.getElementById('nahida-modal');
      document.getElementById('nahida-deck-label').textContent =
        `${deckLabel} — Choose 1 Fate to Keep`;
      const container = document.getElementById('nahida-choices');
      container.innerHTML = [c1, c2]
        .map(
          (c, idx) => `
        <div class="nahida-option" data-idx="${idx}">
          <div class="n-rarity">${'★'.repeat(c.rarity || 4)}</div>
          <h4>${c.title}</h4>
          <p class="n-flavor">"${c.flavor}"</p>
          <p class="n-eff">${c.effectText}</p>
        </div>
      `,
        )
        .join('');

      container.querySelectorAll('.nahida-option').forEach((el) => {
        el.onclick = () => {
          const picked = parseInt(el.dataset.idx, 10) === 0 ? c1 : c2;
          const unpicked = picked === c1 ? c2 : c1;
          const deck =
            deckLabel === 'Event Wish' ? this.chanceDeck : this.chestDeck;
          deck.push(unpicked);
          modal.classList.add('hidden');
          resolve(picked);
        };
      });

      modal.classList.remove('hidden');
    });
  }

  showChoiceModal(title, body, options) {
    return new Promise((resolve) => {
      const modal = document.getElementById('choice-modal');
      document.getElementById('choice-title').textContent = title;
      document.getElementById('choice-body').textContent = body;
      const btnRow = document.getElementById('choice-buttons');
      btnRow.innerHTML = options
        .map(
          (opt, idx) =>
            `<button class="btn-primary" data-idx="${idx}" ${opt.disabled ? 'disabled' : ''}>${opt.label}</button>`,
        )
        .join('');

      btnRow.querySelectorAll('button').forEach((btn) => {
        btn.onclick = () => {
          modal.classList.add('hidden');
          resolve(options[parseInt(btn.dataset.idx, 10)].value);
        };
      });
      modal.classList.remove('hidden');
    });
  }

  showLiquidationModal(player, requiredAmount, reason, forbidMortgage) {
    return new Promise((resolve) => {
      const modal = document.getElementById('liquidation-modal');
      document.getElementById('liq-header').textContent =
        `Raise ${requiredAmount} Mora for ${reason} (Current: ${player.mora} Mora)`;
      const list = document.getElementById('liq-list');
      list.innerHTML = '';

      Object.entries(this.tileState).forEach(([idxStr, st]) => {
        const idx = parseInt(idxStr, 10);
        if (st.ownerId !== player.id) return;
        const tile = BOARD_TILES[idx];
        const row = document.createElement('div');
        row.className = 'liq-row';

        let actionHtml = '';
        if (st.level > 0 && this.canSellBuilding(idx, player)) {
          const refund = Math.floor(REGIONS[tile.region].buildCost * 0.5);
          actionHtml = `<button class="btn-secondary" data-act="sell" data-idx="${idx}">Sell Building (+${refund})</button>`;
        } else if (!forbidMortgage && this.canMortgageTile(idx, player)) {
          actionHtml = `<button class="btn-secondary" data-act="mort" data-idx="${idx}">Mortgage (+${tile.mortgage})</button>`;
        } else {
          actionHtml = `<span class="muted">${st.mortgaged ? 'Mortgaged' : 'Locked'}</span>`;
        }

        row.innerHTML = `<span>${tile.name} ${st.level > 0 ? `(Lvl ${st.level})` : ''}</span>${actionHtml}`;
        list.appendChild(row);
      });

      list.querySelectorAll('button').forEach((btn) => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.idx, 10);
          if (btn.dataset.act === 'sell') this.sellBuilding(idx, player);
          else this.mortgageTile(idx, player);
          modal.classList.add('hidden');
          resolve();
        };
      });

      document.getElementById('liq-done-btn').onclick = () => {
        modal.classList.add('hidden');
        resolve();
      };

      modal.classList.remove('hidden');
    });
  }

  showVictoryModal(winner) {
    const modal = document.getElementById('victory-modal');
    const archon = winner
      ? ARCHONS.find((a) => a.id === winner.archonId)
      : null;
    document.getElementById('vic-winner').textContent = winner
      ? `${winner.name} (${archon ? archon.name : ''})`
      : 'Champion';
    document.getElementById('vic-stats').textContent = winner
      ? `Net Worth: ${this.calculateNetWorth(winner)} Mora (Liquid: ${winner.mora}) · Round ${this.roundNumber}`
      : '';

    const byRent = [...this.players].sort(
      (a, b) => (b.stats?.rentEarned || 0) - (a.stats?.rentEarned || 0),
    )[0];
    const byBuilds = [...this.players].sort(
      (a, b) => (b.stats?.buildsCount || 0) - (a.stats?.buildsCount || 0),
    )[0];
    const byJail = [...this.players].sort(
      (a, b) => (b.stats?.jailCount || 0) - (a.stats?.jailCount || 0),
    )[0];

    document.getElementById('vic-awards').innerHTML = `
      <div class="award-card"><strong>💰 Pantalone's Heir</strong>${byRent ? `${byRent.name} (${byRent.stats?.rentEarned || 0} Mora rent collected)` : '—'}</div>
      <div class="award-card"><strong>🏗️ Kaveh's Blueprint</strong>${byBuilds ? `${byBuilds.name} (${byBuilds.stats?.buildsCount || 0} structures built)` : '—'}</div>
      <div class="award-card"><strong>⛓️ Meropide Regular</strong>${byJail ? `${byJail.name} (${byJail.stats?.jailCount || 0} detentions)` : '—'}</div>
    `;

    document.getElementById('vic-restart').onclick = () => {
      modal.classList.add('hidden');
      document.getElementById('lobby-modal').classList.remove('hidden');
    };
    modal.classList.remove('hidden');
  }

  // --- TILE INSPECTOR & HUD ---
  inspectTile(tileIndex) {
    this.selectedTileIndex = tileIndex;
    const tile = BOARD_TILES[tileIndex];
    const panel = document.getElementById('tile-inspector');
    const body = document.getElementById('inspector-body');
    const me = this.getCurrentPlayer();

    if (tile.type === 'property') {
      const reg = REGIONS[tile.region];
      const st = this.tileState[tileIndex];
      const owner = st.ownerId ? this.getPlayerById(st.ownerId) : null;
      const isMine = owner && me && owner.id === me.id && !me.isAI;

      let actionsHtml = '';
      if (isMine) {
        const buildCost = this.getBuildCost(tile, me);
        const canBuild = this.canBuildOnTile(tileIndex, me);
        const canSell = this.canSellBuilding(tileIndex, me);
        const canMort = this.canMortgageTile(tileIndex, me);
        const unmortCost = this.getUnmortgageCost(tile, me);

        actionsHtml = `
          <div class="insp-actions">
            <button class="btn-primary" id="insp-build" ${canBuild ? '' : 'disabled'}>
              ${st.level === 4 ? `Upgrade to Grand Tavern (${buildCost})` : `Build Outpost (${buildCost})`}
            </button>
            <button class="btn-secondary" id="insp-sell" ${canSell ? '' : 'disabled'}>Sell Building</button>
            ${
              st.mortgaged
                ? `<button class="btn-primary" id="insp-unmort" ${me.mora >= unmortCost ? '' : 'disabled'}>Unmortgage (${unmortCost})</button>`
                : `<button class="btn-secondary" id="insp-mort" ${canMort ? '' : 'disabled'}>Mortgage (+${tile.mortgage})</button>`
            }
          </div>
        `;
      }

      body.innerHTML = `
        <div class="deed-banner" style="background:${reg.color}">${reg.name} · ${reg.element}</div>
        <h3>${tile.name}</h3>
        <div class="deed-owner">Owner: <strong>${owner ? owner.name : 'Unowned'}</strong> ${st.mortgaged ? '(MORTGAGED)' : ''}</div>
        <table class="rent-table">
          <tr><td>Base Rent</td><td>${tile.rents[0]} Mora</td></tr>
          <tr><td>Full Region Set (3/3)</td><td>${tile.rents[1]} Mora</td></tr>
          <tr><td>1 Adventurers' Outpost</td><td>${tile.rents[2]} Mora</td></tr>
          <tr><td>2 Adventurers' Outposts</td><td>${tile.rents[3]} Mora</td></tr>
          <tr><td>3 Adventurers' Outposts</td><td>${tile.rents[4]} Mora</td></tr>
          <tr><td>4 Adventurers' Outposts</td><td>${tile.rents[5]} Mora</td></tr>
          <tr class="tavern-row"><td>Grand Tavern (Max)</td><td>${tile.rents[6]} Mora</td></tr>
        </table>
        <div class="deed-meta">Price: ${tile.price} · Base Build: ${reg.buildCost} · Mortgage: ${tile.mortgage}</div>
        ${actionsHtml}
      `;

      if (isMine) {
        const bBtn = document.getElementById('insp-build');
        if (bBtn) bBtn.onclick = () => this.buildOnTile(tileIndex, me);
        const sBtn = document.getElementById('insp-sell');
        if (sBtn) sBtn.onclick = () => this.sellBuilding(tileIndex, me);
        const mBtn = document.getElementById('insp-mort');
        if (mBtn) mBtn.onclick = () => this.mortgageTile(tileIndex, me);
        const uBtn = document.getElementById('insp-unmort');
        if (uBtn) uBtn.onclick = () => this.unmortgageTile(tileIndex, me);
      }
    } else if (tile.type === 'railroad' || tile.type === 'utility') {
      const st = this.tileState[tileIndex];
      const owner = st.ownerId ? this.getPlayerById(st.ownerId) : null;
      const isMine = owner && me && owner.id === me.id && !me.isAI;
      const unmortCost = this.getUnmortgageCost(tile, me || { archonId: '' });

      body.innerHTML = `
        <div class="deed-banner" style="background:#38BDF8">${tile.subtitle}</div>
        <h3>${tile.name}</h3>
        <div class="deed-owner">Owner: <strong>${owner ? owner.name : 'Unowned'}</strong></div>
        <p class="deed-desc">${
          tile.type === 'railroad'
            ? 'Rent scales by Expedition Realms owned: 1 → 25 · 2 → 50 · 3 → 100 · All 4 → 200 Mora.'
            : tile.description
        }</p>
        <div class="deed-meta">Price: ${tile.price} · Mortgage: ${tile.mortgage}</div>
        ${
          isMine
            ? `
          <div class="insp-actions">
            ${
              st.mortgaged
                ? `<button class="btn-primary" id="insp-unmort" ${me.mora >= unmortCost ? '' : 'disabled'}>Unmortgage (${unmortCost})</button>`
                : `<button class="btn-secondary" id="insp-mort" ${!st.mortgaged ? '' : 'disabled'}>Mortgage (+${tile.mortgage})</button>`
            }
          </div>
        `
            : ''
        }
      `;
      if (isMine) {
        const mBtn = document.getElementById('insp-mort');
        if (mBtn) mBtn.onclick = () => this.mortgageTile(tileIndex, me);
        const uBtn = document.getElementById('insp-unmort');
        if (uBtn) uBtn.onclick = () => this.unmortgageTile(tileIndex, me);
      }
    } else {
      body.innerHTML = `
        <div class="deed-banner" style="background:#D4AF37;color:#0f172a">Special Tile #${tile.index}</div>
        <h3>${tile.name}</h3>
        <p class="deed-desc">${tile.description}</p>
      `;
    }

    panel.classList.remove('hidden');
  }

  updateHUD() {
    const me = this.getCurrentPlayer();
    if (!me) return;

    // Serenitea Pot Jackpot Badge
    const potBadge = document.getElementById('pot-pool-badge');
    if (potBadge) {
      potBadge.classList.toggle('hidden', !this.potPoolEnabled);
      document.getElementById('pot-pool-amount').textContent =
        `${this.potPool} Mora`;
    }

    // Render Player Cards
    const roster = document.getElementById('player-roster');
    roster.innerHTML = this.players
      .map((p, idx) => {
        const archon = ARCHONS.find((a) => a.id === p.archonId) || ARCHONS[0];
        const activeRes = this.getActiveResonance(p.id);
        const eligibleRes = this.getEligibleResonances(p.id);
        const ownedCount = Object.values(this.tileState).filter(
          (s) => s.ownerId === p.id,
        ).length;
        const isTurn = idx === this.currentPlayerIndex && !this.gameOver;
        const netWorth = this.calculateNetWorth(p);

        let resSelector = '';
        if (activeRes) {
          if (eligibleRes.length > 1 && isTurn && !p.isAI) {
            resSelector = `
            <select class="res-select" data-pid="${p.id}">
              ${eligibleRes.map((r) => `<option value="${r.id}" ${r.id === activeRes.id ? 'selected' : ''}>⚡ ${r.name} (${r.elements})</option>`).join('')}
            </select>
          `;
          } else {
            resSelector = `<div class="res-pill" style="border-color:${activeRes.color}" title="${activeRes.desc}">✦ ${activeRes.name}: ${activeRes.desc}</div>`;
          }
        }

        return `
        <div class="player-card ${isTurn ? 'active-turn' : ''} ${p.bankrupt ? 'bankrupt' : ''}" data-pid="${p.id}" style="border-left:4px solid ${p.color}">
          <div class="pc-top">
            <span class="pc-name">${p.name} ${p.isAI ? '🤖' : ''}</span>
            <span class="pc-mora">${p.bankrupt ? 'ELIMINATED' : `${p.mora} Mora`}</span>
          </div>
          <div class="pc-sub">
            <span>${archon.name} (${archon.passiveName})</span>
            <span>${ownedCount} Deeds${p.jailCards ? ` · 📜×${p.jailCards}` : ''}</span>
          </div>
          ${!p.bankrupt ? `<div class="pc-networth">Net Worth: ${netWorth} Mora</div>` : ''}
          ${p.inJail ? '<div class="pc-jail">⛓️ Detained in Fortress of Meropide</div>' : ''}
          ${resSelector}
        </div>
      `;
      })
      .join('');

    roster.querySelectorAll('.player-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('select')) return;
        this.openPortfolioModal(card.dataset.pid);
      });
    });

    roster.querySelectorAll('.res-select').forEach((sel) => {
      sel.onchange = (e) => {
        const pl = this.getPlayerById(e.target.dataset.pid);
        if (pl) {
          pl.selectedResonanceId = e.target.value;
          window.soundEngine.playResonance();
          this.updateHUD();
        }
      };
    });

    // Action Bar & Pre-Roll Danger Preview
    const isHumanTurn = !me.isAI && !me.bankrupt && !this.gameOver;
    document.getElementById('turn-banner').textContent =
      `${me.name}'s Turn · ${BOARD_TILES[me.position].name}`;
    document.getElementById('dice-readout').textContent =
      `🎲 ${this.lastDice[0]} + ${this.lastDice[1]} = ${this.lastDice[0] + this.lastDice[1]}`;

    const dangerEl = document.getElementById('danger-preview');
    if (isHumanTurn && !this.hasRolled && !me.inJail) {
      const stats = this.getRollDangerStats(me);
      dangerEl.classList.remove('hidden');
      dangerEl.classList.toggle('safe', stats.pct <= 15 && stats.maxRent === 0);
      dangerEl.textContent =
        stats.maxRent > 0
          ? `⚠️ ${stats.pct}% Hazard · Max Rent: ${stats.maxRent}`
          : `✅ ${stats.pct}% Hazard Ahead`;
    } else {
      dangerEl.classList.add('hidden');
    }

    const rollBtn = document.getElementById('btn-roll');
    const endBtn = document.getElementById('btn-end-turn');
    const tradeBtn = document.getElementById('btn-trade');
    const bailBtn = document.getElementById('btn-bail');
    const pardonBtn = document.getElementById('btn-pardon');

    rollBtn.disabled = !isHumanTurn || this.hasRolled || this.isAnimating;
    endBtn.disabled = !isHumanTurn || !this.hasRolled || this.isAnimating;
    tradeBtn.disabled = !isHumanTurn || this.isAnimating;

    const bailCost = this.getJailBailCost();
    bailBtn.textContent = `Pay Bail (${bailCost})`;
    bailBtn.classList.toggle(
      'hidden',
      !(isHumanTurn && me.inJail && !this.hasRolled),
    );
    bailBtn.disabled = me.mora < bailCost || this.isAnimating;

    pardonBtn.classList.toggle(
      'hidden',
      !(isHumanTurn && me.inJail && !this.hasRolled && me.jailCards > 0),
    );
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new GenshinMonopolyGame();
  window.game.init();
});

// js/audio.js
// Hybrid Web Audio API Procedural BGM & SFX + Custom Audio File Overrides (assets/audio/*.mp3)

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.sfxMuted = false;
    this.bgmMuted = false;
    this.bgmPlaying = false;
    this.bgmTimer = null;
    this.bgmStep = 0;

    this.customBgm = null;
    this.customBgmAvailable = false;
    this.customSfx = {};

    this.probeCustomAudio();
  }

  probeCustomAudio() {
    const bgmCandidates = [
      'assets/audio/bgm.mp3',
      'assets/audio/bgm.ogg',
      'assets/audio/bgm.wav',
    ];
    const tryNextBgm = (idx) => {
      if (idx >= bgmCandidates.length) return;
      const audio = new Audio();
      audio.preload = 'auto';
      audio.loop = true;
      audio.volume = 0.28;
      audio.addEventListener(
        'canplaythrough',
        () => {
          this.customBgm = audio;
          this.customBgmAvailable = true;
          if (this.bgmPlaying && !this.bgmMuted) {
            this.stopProceduralBGM();
            this.customBgm.play().catch(() => {});
          }
        },
        { once: true },
      );
      audio.onerror = () => tryNextBgm(idx + 1);
      audio.src = bgmCandidates[idx];
    };
    tryNextBgm(0);

    const sfxNames = [
      'dice',
      'step',
      'coin',
      'pay',
      'build',
      'wish',
      'resonance',
      'jail',
      'auction',
      'trade',
      'victory',
    ];
    sfxNames.forEach((name) => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.volume = 0.45;
      audio.addEventListener(
        'canplaythrough',
        () => {
          this.customSfx[name] = audio;
        },
        { once: true },
      );
      audio.onerror = () => {};
      audio.src = `assets/audio/${name}.mp3`;
    });
  }

  playCustomSfx(name) {
    const base = this.customSfx[name];
    if (!base) return false;
    try {
      const clone = base.cloneNode();
      clone.volume = base.volume;
      clone.play().catch(() => {});
      return true;
    } catch (_) {
      return false;
    }
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleSFX() {
    this.sfxMuted = !this.sfxMuted;
    return this.sfxMuted;
  }

  toggleBGM() {
    this.bgmMuted = !this.bgmMuted;
    if (this.bgmMuted) {
      this.stopBGM();
    } else {
      this.startBGM();
    }
    return this.bgmMuted;
  }

  toggleMute() {
    const next = !this.sfxMuted;
    this.sfxMuted = next;
    this.bgmMuted = next;
    if (next) this.stopBGM();
    else this.startBGM();
    return next;
  }

  startBGM() {
    this.bgmPlaying = true;
    if (this.bgmMuted) return;

    if (this.customBgmAvailable && this.customBgm) {
      this.stopProceduralBGM();
      this.customBgm.play().catch(() => {});
      return;
    }

    this.init();
    if (!this.ctx || this.bgmTimer) return;

    const motif = [
      293.66, 369.99, 440.0, 587.33, 659.25, 587.33, 440.0, 369.99, 246.94,
      369.99, 440.0, 493.88, 587.33, 493.88, 440.0, 369.99, 196.0, 293.66,
      369.99, 440.0, 587.33, 440.0, 369.99, 293.66, 220.0, 329.63, 440.0,
      493.88, 659.25, 493.88, 440.0, 329.63,
    ];
    const bassNotes = [146.83, 123.47, 98.0, 110.0];

    const tick = () => {
      if (this.bgmMuted || !this.bgmPlaying) return;
      this.init();
      if (!this.ctx) return;

      const freq = motif[this.bgmStep % motif.length];
      this.playBgmNote(freq, 'sine', 1.35, 0.032);

      if (this.bgmStep % 8 === 0) {
        const bass = bassNotes[Math.floor(this.bgmStep / 8) % bassNotes.length];
        this.playBgmNote(bass, 'triangle', 3.4, 0.026);
      }

      this.bgmStep += 1;
    };

    tick();
    this.bgmTimer = setInterval(tick, 540);
  }

  stopProceduralBGM() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  stopBGM() {
    this.bgmPlaying = false;
    this.stopProceduralBGM();
    if (this.customBgm) {
      this.customBgm.pause();
    }
  }

  playBgmNote(freq, type = 'sine', duration = 1.2, gainVal = 0.03) {
    if (this.bgmMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  playTone(freq, type = 'sine', duration = 0.25, gainVal = 0.14, delay = 0) {
    if (this.sfxMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  playDice() {
    if (this.sfxMuted || this.playCustomSfx('dice')) return;
    for (let i = 0; i < 6; i++) {
      this.playTone(
        180 + Math.random() * 220,
        'triangle',
        0.07,
        0.12,
        i * 0.065,
      );
    }
  }

  playStep() {
    if (this.sfxMuted || this.playCustomSfx('step')) return;
    this.playTone(360 + Math.random() * 60, 'sine', 0.08, 0.07, 0);
  }

  playCoin() {
    if (this.sfxMuted || this.playCustomSfx('coin')) return;
    this.playTone(987.77, 'sine', 0.18, 0.13, 0);
    this.playTone(1318.51, 'sine', 0.32, 0.14, 0.08);
  }

  playPay() {
    if (this.sfxMuted || this.playCustomSfx('pay')) return;
    this.playTone(440, 'triangle', 0.16, 0.12, 0);
    this.playTone(311.13, 'triangle', 0.28, 0.12, 0.1);
  }

  playBuild(isTavern = false) {
    if (this.sfxMuted || this.playCustomSfx('build')) return;
    if (isTavern) {
      [261.63, 329.63, 392.0, 523.25, 659.25].forEach((f, i) => {
        this.playTone(f, 'triangle', 0.42, 0.13, i * 0.06);
      });
    } else {
      this.playTone(220, 'triangle', 0.15, 0.14, 0);
      this.playTone(330, 'sine', 0.22, 0.12, 0.07);
    }
  }

  playWish(rarity = 4) {
    if (this.sfxMuted || this.playCustomSfx('wish')) return;
    const notes =
      rarity === 5
        ? [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]
        : [440, 554.37, 659.25, 880];
    notes.forEach((f, i) => {
      this.playTone(f, 'sine', 0.45, 0.13, i * 0.07);
    });
  }

  playResonance() {
    if (this.sfxMuted || this.playCustomSfx('resonance')) return;
    [392.0, 493.88, 587.33, 783.99].forEach((f, i) => {
      this.playTone(f, 'sine', 0.55, 0.12, i * 0.05);
    });
  }

  playJail() {
    if (this.sfxMuted || this.playCustomSfx('jail')) return;
    this.playTone(146.83, 'sawtooth', 0.28, 0.12, 0);
    this.playTone(110.0, 'sawtooth', 0.4, 0.13, 0.14);
  }

  playAuction() {
    if (this.sfxMuted || this.playCustomSfx('auction')) return;
    this.playTone(329.63, 'triangle', 0.14, 0.13, 0);
    this.playTone(493.88, 'triangle', 0.24, 0.13, 0.08);
  }

  playTrade() {
    if (this.sfxMuted || this.playCustomSfx('trade')) return;
    [440, 554.37, 659.25].forEach((f, i) => {
      this.playTone(f, 'sine', 0.28, 0.12, i * 0.07);
    });
  }

  playVictory() {
    if (this.sfxMuted || this.playCustomSfx('victory')) return;
    [293.66, 369.99, 440.0, 587.33, 739.99, 880.0].forEach((f, i) => {
      this.playTone(f, 'triangle', 0.55, 0.14, i * 0.09);
    });
  }
}

window.soundEngine = new SoundEngine();

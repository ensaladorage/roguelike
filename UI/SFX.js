const DEFAULT_SOUND_LEVEL = 100;
const REFERENCE_SOUND_LEVEL = 100;
const MAX_OUTPUT_BOOST = 2;
const SOUND_LEVEL_STORAGE_KEY = "roguelike.soundLevel";

export class SFX {
  constructor() {
    this.audioContext = null;
    this.audioUnlocked = false;
    this.pendingType = null;
    this.audioFiles = {};
    this.soundLevel = this.loadSoundLevel();

    this.tones = {
      playerAttack: {
        frequency: 620,
        duration: 0.08,
      },

      playerAttackHit: {
        frequency: 520,
        endFrequency: 360,
        duration: 0.09,
        type: "triangle",
        gain: 0.07,
      },

      playerAttackWhiff: {
        frequency: 760,
        endFrequency: 420,
        duration: 0.11,
        type: "sawtooth",
        gain: 0.035,
      },

      interactionOutOfRange: {
        frequency: 680,
        endFrequency: 360,
        duration: 0.09,
        type: "sawtooth",
        gain: 0.03,
      },

      enemyAttack: {
        frequency: 180,
        duration: 0.12,
      },

      playerDamaged: {
        frequency: 120,
        endFrequency: 70,
        duration: 0.16,
        type: "sawtooth",
        gain: 0.075,
      },

      playerDash: {
        frequency: 860,
        endFrequency: 1180,
        duration: 0.12,
        type: "triangle",
        gain: 0.045,
      },

      playerDashReady: {
        frequency: 980,
        duration: 0.08,
        type: "sine",
        gain: 0.035,
      },

      playerDashBlocked: {
        frequency: 180,
        endFrequency: 120,
        duration: 0.08,
        type: "square",
        gain: 0.025,
      },

      enemyDefeated: {
        frequency: 820,
        duration: 0.16,
      },

      chest: {
        frequency: 760,
        duration: 0.12,
      },

      purpleShroom: {
        frequency: 260,
        endFrequency: 90,
        duration: 0.28,
        type: "sawtooth",
        gain: 0.06,
      },
    };

    this.files = {
      entryStairsBlocked: {
        src: "Assets/SFXs/Wrong.mp3",
        volume: 0.85,
      },
    };

    this.setupAudioUnlock();
  }

  getSoundLevelPercent() {
    return this.soundLevel;
  }

  setSoundLevelPercent(value) {
    this.soundLevel = this.normalizeSoundLevel(value);
    this.persistSoundLevel();
    this.applySoundLevelToCachedFiles();
  }

  getVolumeMultiplier() {
    return (this.soundLevel / REFERENCE_SOUND_LEVEL) * MAX_OUTPUT_BOOST;
  }

  resolveOutputVolume(baseVolume = 1) {
    if (this.soundLevel <= 0) return 0;

    return Math.max(
      0,
      Math.min(1, baseVolume * this.getVolumeMultiplier())
    );
  }

  loadSoundLevel() {
    try {
      const storedValue = window.localStorage?.getItem(SOUND_LEVEL_STORAGE_KEY);

      if (storedValue !== null) {
        return this.normalizeSoundLevel(Number(storedValue));
      }
    } catch (error) {}

    return DEFAULT_SOUND_LEVEL;
  }

  persistSoundLevel() {
    try {
      window.localStorage?.setItem(
        SOUND_LEVEL_STORAGE_KEY,
        String(this.soundLevel)
      );
    } catch (error) {}
  }

  normalizeSoundLevel(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) return DEFAULT_SOUND_LEVEL;

    return Math.max(0, Math.min(100, Math.round(numericValue)));
  }

  play(type) {
    const file = this.files[type];
    if (file) {
      this.playFile(type, file);
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) return;

    if (!this.audioContext) {
      this.audioContext = new AudioContextClass();
    }

    const tone = this.tones[type];
    if (!tone) return;

    if (this.audioContext.state === "suspended") {
      this.pendingType = type;
      const resume = this.audioContext.resume?.();
      if (!resume?.then) return;

      resume.then(() => {
        const pendingType = this.pendingType;
        this.pendingType = null;
        if (pendingType) this.play(pendingType);
      });
      return;
    }

    this.pendingType = null;
    this.playTone(tone);
  }

  playFile(type, file) {
    if (!this.audioUnlocked) {
      this.pendingType = type;
      return;
    }

    const audio = this.getAudioFile(type, file);

    audio.currentTime = 0;
    audio.volume = this.resolveOutputVolume(file.volume ?? 1);
    audio.play().catch(() => {
      this.pendingType = type;
      this.audioUnlocked = false;
      this.setupAudioUnlock();
    });
  }

  getAudioFile(type, file) {
    if (!this.audioFiles[type]) {
      const audio = new Audio(file.src);

      audio.preload = "auto";
      audio.volume = this.resolveOutputVolume(file.volume ?? 1);
      this.audioFiles[type] = audio;
    }

    return this.audioFiles[type];
  }

  playTone(tone) {
    if (this.soundLevel <= 0) return;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = tone.type ?? "sine";
    osc.frequency.setValueAtTime(tone.frequency, now);

    if (tone.endFrequency) {
      osc.frequency.exponentialRampToValueAtTime(
        tone.endFrequency,
        now + tone.duration
      );
    }

    gain.gain.setValueAtTime(
      (tone.gain ?? 0.05) * this.getVolumeMultiplier(),
      now
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + tone.duration
    );

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + tone.duration);
  }

  applySoundLevelToCachedFiles() {
    for (const [type, audio] of Object.entries(this.audioFiles)) {
      const file = this.files[type];
      if (!file) continue;

      audio.volume = this.resolveOutputVolume(file.volume ?? 1);
    }
  }

  setupAudioUnlock() {
    const unlock = () => {
      if (this.audioUnlocked) return;

      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (AudioContextClass && !this.audioContext) {
        this.audioContext = new AudioContextClass();
      }

      const resume = this.audioContext?.resume?.();
      this.audioUnlocked = true;

      const playPending = () => {
        const pendingType = this.pendingType;
        this.pendingType = null;
        this.play(pendingType);
      };

      if (resume?.then) {
        resume.then(() => {
          if (this.pendingType) playPending();
        });
      } else if (this.pendingType) {
        playPending();
      }

      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);
  }
}

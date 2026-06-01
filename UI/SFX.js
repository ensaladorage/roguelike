export class SFX {
  constructor() {
    this.audioContext = null;
    this.audioUnlocked = false;
    this.pendingType = null;

    this.tones = {
      playerAttack: {
        frequency: 620,
        duration: 0.08,
      },

      enemyAttack: {
        frequency: 180,
        duration: 0.12,
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

      entryStairsBlocked: {
        frequency: 170,
        endFrequency: 70,
        duration: 0.34,
        type: "square",
        gain: 0.09,
      },
    };

    this.setupAudioUnlock();
  }

  play(type) {
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

  playTone(tone) {
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

    gain.gain.setValueAtTime(tone.gain ?? 0.05, now);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + tone.duration
    );

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + tone.duration);
  }

  setupAudioUnlock() {
    const unlock = () => {
      if (this.audioUnlocked) return;

      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioContext) {
        this.audioContext = new AudioContextClass();
      }

      const resume = this.audioContext.resume?.();
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

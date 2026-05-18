export class SFX {
  constructor() {
    this.audioContext = null;

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
    };
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

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.frequency.value = tone.frequency;

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + tone.duration
    );

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + tone.duration);
  }
}

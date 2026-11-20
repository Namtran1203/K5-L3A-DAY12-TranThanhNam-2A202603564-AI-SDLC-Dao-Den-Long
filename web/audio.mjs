const cues = {
  mote_picked: [659, 880], lantern_lit: [392, 523, 659, 784], pulse: [330, 494, 659],
  player_hit: [165, 110], jump: [293, 392], dash: [330, 220], won: [523, 659, 784, 1047],
  lost: [392, 311, 196], shade_spawned: [98, 131], countdown: [587], wind: [130, 98, 131],
  charm_picked: [440, 660, 990], drifter_steal: [300, 205], drifter_drop: [494, 740]
};

export class Sounds {
  constructor(volume) {
    this.volume = volume;
    this.context = null;
  }

  unlock() {
    if (!this.context && typeof AudioContext === 'function') {
      this.context = new AudioContext();
      this.gain = this.context.createGain();
      this.gain.gain.value = this.volume;
      this.gain.connect(this.context.destination);
    }
    if (this.context?.state === 'suspended') this.context.resume().catch(() => {});
  }

  setVolume(value) {
    this.volume = value;
    if (this.gain) this.gain.gain.value = value;
  }

  note(hz, offset, length, volume, wave = 'sine') {
    if (!this.gain || !this.volume) return;
    const source = this.context.createOscillator();
    const shape = this.context.createGain();
    const start = this.context.currentTime + offset;
    source.type = wave;
    source.frequency.value = hz;
    shape.gain.setValueAtTime(0.0001, start);
    shape.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.04, length / 3));
    shape.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(shape);
    shape.connect(this.gain);
    source.start(start);
    source.stop(start + length);
  }

  play(name) {
    const melody = cues[name];
    if (!melody) return;
    const short = name === 'mote_picked' || name === 'countdown';
    melody.forEach((hz, i) => this.note(hz, i * (short ? 0.055 : 0.09), short ? 0.105 : 0.24,
      short ? 0.07 : 0.11, name === 'wind' ? 'triangle' : 'sine'));
  }

  ambient(index) {
    const roots = [146.83, 130.81, 110, 130.81, 146.83, 174.61, 130.81, 146.83];
    const root = roots[index % roots.length];
    this.note(root, 0, 1.25, 0.035, 'triangle');
    this.note(root * 1.5, 0.15, 1.0, 0.027);
    this.note(root * 3, 0.44, 0.6, 0.017);
  }
}

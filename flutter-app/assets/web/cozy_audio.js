// ============================================================================
// PROCEDURAL COZY LO-FI / AMBIENT SYNTHESIZER & TOWN SOUNDSCAPE (Web Audio API)
// Pure procedural synthesis — zero external MP3 dependencies.
// Features:
// 1. Warm Rhodes / Electric Piano Chords (Fmaj7 -> Em7 -> Dm7 -> Cmaj7)
//    with sine + triangle oscillators, BiquadFilterNode (800Hz–1200Hz), & ADSR.
// 2. Gentle C Major Pentatonic Melody with dreamy stereo feedback delay.
// 3. Automatic Day/Night Mood Shift:
//    - Day (06:00–17:59): brighter filter (~1150Hz), livelier tempo, soft bird chirps
//    - Night (18:00–05:59): warmer filter (~820Hz), slower tempo, lush ambient pad
// 4. 0.8s linearRampToValueAtTime fade-in / fade-out & first-interaction autoplay unlock.
// ============================================================================

export class CozyAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.chordFilter = null;
    this.delayNode = null;
    this.delayFeedback = null;
    this.delayFilter = null;

    this.isEnabled = true;     // Desired user state (On by default, starts on first gesture)
    this.isPlaying = false;    // Whether scheduler loop is active
    this.isUnlocked = false;   // Whether AudioContext has been resumed by user interaction
    this.volume = 0.42;        // Master target volume (0.0 – 1.0)
    this.currentHour = 17.5;   // Synced with town clock (0.0 – 24.0)

    this.chordIndex = 0;
    this.chordTimer = null;
    this.melodyTimer = null;
    this.birdTimer = null;

    // Cozy Jazz / Lo-Fi Chord Progression: Fmaj7 -> Em7 -> Dm7 -> Cmaj7
    this.chords = [
      {
        name: 'Fmaj7',
        root: 87.31, // F2
        fifth: 130.81, // C3
        notes: [174.61, 220.00, 261.63, 329.63, 392.00] // F3, A3, C4, E4, G4 (Fmaj9 voicing)
      },
      {
        name: 'Em7',
        root: 82.41, // E2
        fifth: 123.47, // B2
        notes: [164.81, 196.00, 246.94, 293.66, 329.63] // E3, G3, B3, D4, E4
      },
      {
        name: 'Dm7',
        root: 73.42, // D2
        fifth: 110.00, // A2
        notes: [146.83, 174.61, 220.00, 261.63, 329.63] // D3, F3, A3, C4, E4 (Dm9 voicing)
      },
      {
        name: 'Cmaj7',
        root: 65.41, // C2
        fifth: 98.00,  // G2
        notes: [130.81, 164.81, 196.00, 246.94, 293.66] // C3, E3, G3, B3, D4 (Cmaj9 voicing)
      }
    ];

    // C Major Pentatonic Scale (C, D, E, G, A across octaves 4 & 5)
    this.pentatonic = [
      261.63, // C4
      293.66, // D4
      329.63, // E4
      392.00, // G4
      440.00, // A4
      523.25, // C5
      587.33, // D5
      659.25, // E5
      783.99, // G5
      880.00  // A5
    ];

    this.lastMelodyIdx = 4;
    this.onStateChange = null;
  }

  isDaytime() {
    return this.currentHour >= 6 && this.currentHour < 18;
  }

  setTimeOfDay(hour) {
    if (typeof hour === 'number' && !Number.isNaN(hour)) {
      const prevDay = this.isDaytime();
      this.currentHour = ((hour % 24) + 24) % 24;
      const nowDay = this.isDaytime();

      // Smoothly adapt BiquadFilterNode cutoff & delay time when shifting between Day & Night
      if (this.ctx && this.chordFilter) {
        const now = this.ctx.currentTime;
        const targetCutoff = nowDay ? 1150 : 820;
        this.chordFilter.frequency.cancelScheduledValues(now);
        this.chordFilter.frequency.setValueAtTime(this.chordFilter.frequency.value, now);
        this.chordFilter.frequency.linearRampToValueAtTime(targetCutoff, now + 1.2);
      }

      if (prevDay !== nowDay && this.onStateChange) {
        this.onStateChange(this.getStatus());
      }
    }
  }

  initContext() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    // Master Gain Node (starts at 0 for click-free 0.8s linear fade-in)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Warm Low-Pass BiquadFilterNode (800Hz–1200Hz) for Rhodes Chords & Pad
    this.chordFilter = this.ctx.createBiquadFilter();
    this.chordFilter.type = 'lowpass';
    this.chordFilter.frequency.setValueAtTime(this.isDaytime() ? 1150 : 820, this.ctx.currentTime);
    this.chordFilter.Q.setValueAtTime(0.75, this.ctx.currentTime);
    this.chordFilter.connect(this.masterGain);

    // Dreamy Delay / Soft Echo Network for Pentatonic Melody & Bird Ambience
    this.delayNode = this.ctx.createDelay(1.0);
    this.delayNode.delayTime.setValueAtTime(0.38, this.ctx.currentTime);

    this.delayFilter = this.ctx.createBiquadFilter();
    this.delayFilter.type = 'lowpass';
    this.delayFilter.frequency.setValueAtTime(1450, this.ctx.currentTime);

    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.setValueAtTime(0.34, this.ctx.currentTime);

    const delayWet = this.ctx.createGain();
    delayWet.gain.setValueAtTime(0.32, this.ctx.currentTime);

    this.delayNode.connect(this.delayFilter);
    this.delayFilter.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayFilter.connect(delayWet);
    delayWet.connect(this.masterGain);
  }

  async unlockAndStart() {
    this.initContext();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        return;
      }
    }

    this.isUnlocked = this.ctx.state === 'running';
    if (this.isUnlocked && this.isEnabled && !this.isPlaying) {
      this.startLoop();
      this.fadeMaster(this.volume, 0.8);
      if (this.onStateChange) this.onStateChange(this.getStatus());
    }
  }

  fadeMaster(targetGain, durationSec = 0.8) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const current = this.masterGain.gain.value;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(0.0001, current), now);
    this.masterGain.gain.linearRampToValueAtTime(Math.max(0.0001, targetGain), now + durationSec);
  }

  async toggle() {
    this.initContext();
    if (!this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {}
    }
    this.isUnlocked = this.ctx.state === 'running';

    if (!this.isEnabled || !this.isPlaying) {
      this.isEnabled = true;
      this.startLoop();
      this.fadeMaster(this.volume, 0.8);
    } else {
      this.isEnabled = false;
      this.fadeMaster(0.0001, 0.8);
      clearTimeout(this._stopTimeout);
      this._stopTimeout = setTimeout(() => {
        if (!this.isEnabled) {
          this.stopLoop();
        }
      }, 820);
    }

    if (this.onStateChange) this.onStateChange(this.getStatus());
    return this.isEnabled;
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, parseFloat(val) || 0));
    if (this.ctx && this.isEnabled && this.isPlaying) {
      this.fadeMaster(this.volume, 0.25);
    }
    if (this.onStateChange) this.onStateChange(this.getStatus());
  }

  getStatus() {
    return {
      enabled: this.isEnabled,
      playing: this.isPlaying && this.isEnabled,
      unlocked: this.isUnlocked,
      volume: this.volume,
      isDay: this.isDaytime(),
      chordName: this.chords[this.chordIndex]?.name || 'Fmaj7'
    };
  }

  startLoop() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    clearTimeout(this._stopTimeout);

    // Start Rhodes chord progression loop
    this.scheduleNextChord(80);
    // Start gentle Pentatonic melody loop
    this.scheduleNextMelody(650);
    // Start daytime bird soundscape loop
    this.scheduleNextBird(1800);
  }

  stopLoop() {
    this.isPlaying = false;
    clearTimeout(this.chordTimer);
    clearTimeout(this.melodyTimer);
    clearTimeout(this.birdTimer);
  }

  scheduleNextChord(delayMs) {
    clearTimeout(this.chordTimer);
    this.chordTimer = setTimeout(() => {
      if (!this.isPlaying || !this.isEnabled) return;
      this.playRhodesChord();
      // Day: slightly livelier tempo (~3.5s per bar); Night: slower, mellower (~4.5s per bar)
      const nextMs = this.isDaytime() ? 3500 : 4500;
      this.scheduleNextChord(nextMs);
    }, delayMs);
  }

  scheduleNextMelody(delayMs) {
    clearTimeout(this.melodyTimer);
    this.melodyTimer = setTimeout(() => {
      if (!this.isPlaying || !this.isEnabled) return;
      if (Math.random() < (this.isDaytime() ? 0.78 : 0.62)) {
        this.playPentatonicNote();
      }
      const baseWait = this.isDaytime() ? 680 : 950;
      const jitter = Math.floor(Math.random() * (this.isDaytime() ? 900 : 1300));
      this.scheduleNextMelody(baseWait + jitter);
    }, delayMs);
  }

  scheduleNextBird(delayMs) {
    clearTimeout(this.birdTimer);
    this.birdTimer = setTimeout(() => {
      if (!this.isPlaying || !this.isEnabled) return;
      if (this.isDaytime()) {
        this.playProceduralBirdChirp();
      }
      const nextBirdMs = 4200 + Math.floor(Math.random() * 5200);
      this.scheduleNextBird(nextBirdMs);
    }, delayMs);
  }

  // --------------------------------------------------------------------------
  // 1. WARM RHODES / ELECTRIC PIANO CHORDS + NIGHT AMBIENT PAD
  // --------------------------------------------------------------------------
  playRhodesChord() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const chord = this.chords[this.chordIndex];
    this.chordIndex = (this.chordIndex + 1) % this.chords.length;

    const isDay = this.isDaytime();
    const now = this.ctx.currentTime;
    const holdDur = isDay ? 3.3 : 4.3;

    // Update low-pass filter smoothly according to Day (950–1200Hz) vs Night (800–900Hz)
    const targetCutoff = isDay ? 1120 : 830;
    this.chordFilter.frequency.setTargetAtTime(targetCutoff, now, 0.5);

    // Strum each voice of the chord softly (45ms arpeggio stagger)
    chord.notes.forEach((freq, idx) => {
      const start = now + idx * 0.048;
      const voiceGain = this.ctx.createGain();

      // Gentle ADSR Envelope (soft attack, warm sustain, long smooth release)
      const peak = 0.075 / Math.sqrt(chord.notes.length) * (idx === 0 ? 1.15 : 0.92);
      const attack = 0.16;
      const decay = 0.7;
      const sustain = peak * 0.58;
      const release = isDay ? 1.5 : 2.1;

      voiceGain.gain.setValueAtTime(0.0001, start);
      voiceGain.gain.linearRampToValueAtTime(peak, start + attack);
      voiceGain.gain.linearRampToValueAtTime(sustain, start + attack + decay);
      voiceGain.gain.setValueAtTime(sustain, start + holdDur - 0.3);
      voiceGain.gain.linearRampToValueAtTime(0.0001, start + holdDur + release);

      voiceGain.connect(this.chordFilter);

      // Oscillator 1: Warm Sine Fundamental
      const oscSine = this.ctx.createOscillator();
      oscSine.type = 'sine';
      oscSine.frequency.setValueAtTime(freq, start);

      // Oscillator 2: Soft Triangle Harmonic (detuned +3.5 cents for warm Rhodes chorus)
      const oscTri = this.ctx.createOscillator();
      oscTri.type = 'triangle';
      oscTri.frequency.setValueAtTime(freq, start);
      oscTri.detune.setValueAtTime(3.5, start);

      const triMix = this.ctx.createGain();
      triMix.gain.setValueAtTime(0.45, start);

      oscSine.connect(voiceGain);
      oscTri.connect(triMix);
      triMix.connect(voiceGain);

      const stopTime = start + holdDur + release + 0.1;
      oscSine.start(start);
      oscTri.start(start);
      oscSine.stop(stopTime);
      oscTri.stop(stopTime);
    });

    // Warm Bass Root Note (Sine + Triangle sub foundation)
    this.playWarmBass(chord.root, now, holdDur);

    // Night Mode (18:00 – 05:59): Add lush, syahdu Warm Ambient Pad layer
    if (!isDay) {
      this.playNightAmbientPad(chord.root * 2, chord.fifth * 2, now, holdDur + 1.2);
    }

    if (this.onStateChange) this.onStateChange(this.getStatus());
  }

  playWarmBass(freq, start, dur) {
    const bassGain = this.ctx.createGain();
    bassGain.gain.setValueAtTime(0.0001, start);
    bassGain.gain.linearRampToValueAtTime(0.065, start + 0.22);
    bassGain.gain.linearRampToValueAtTime(0.04, start + dur * 0.7);
    bassGain.gain.linearRampToValueAtTime(0.0001, start + dur + 1.2);
    bassGain.connect(this.chordFilter);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    osc.connect(bassGain);
    osc.start(start);
    osc.stop(start + dur + 1.3);
  }

  playNightAmbientPad(rootFreq, fifthFreq, start, dur) {
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(620, start);
    padFilter.connect(this.masterGain);

    const padGain = this.ctx.createGain();
    padGain.gain.setValueAtTime(0.0001, start);
    padGain.gain.linearRampToValueAtTime(0.038, start + 1.8);
    padGain.gain.linearRampToValueAtTime(0.028, start + dur - 1.2);
    padGain.gain.linearRampToValueAtTime(0.0001, start + dur + 1.8);
    padGain.connect(padFilter);

    [rootFreq, fifthFreq].forEach((f, i) => {
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      o1.type = 'triangle';
      o2.type = 'sine';
      o1.frequency.setValueAtTime(f, start);
      o2.frequency.setValueAtTime(f * 2, start);
      o1.detune.setValueAtTime(i === 0 ? -6 : 6, start);
      o2.detune.setValueAtTime(i === 0 ? 5 : -5, start);

      o1.connect(padGain);
      o2.connect(padGain);
      o1.start(start);
      o2.start(start);
      o1.stop(start + dur + 1.9);
      o2.stop(start + dur + 1.9);
    });
  }

  // --------------------------------------------------------------------------
  // 2. GENTLE PENTATONIC MELODY (C Major Pentatonic + Dreamy Delay/Reverb)
  // --------------------------------------------------------------------------
  playPentatonicNote() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const isDay = this.isDaytime();
    const now = this.ctx.currentTime;

    // Step smoothly around neighboring pentatonic notes for natural phrasing
    const stepChoices = [-2, -1, 1, 2, 0];
    const step = stepChoices[Math.floor(Math.random() * stepChoices.length)];
    let idx = this.lastMelodyIdx + step;
    if (!isDay && idx > 6) idx -= 2; // Slightly warmer/lower register at night
    idx = Math.max(0, Math.min(this.pentatonic.length - 1, idx));
    this.lastMelodyIdx = idx;

    const freq = this.pentatonic[idx];

    const noteFilter = this.ctx.createBiquadFilter();
    noteFilter.type = 'lowpass';
    noteFilter.frequency.setValueAtTime(isDay ? 1650 : 1080, now);

    const noteGain = this.ctx.createGain();
    const peak = isDay ? 0.046 : 0.036;
    const attack = 0.045;
    const release = isDay ? 1.35 : 1.75;

    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(peak, now + attack);
    noteGain.gain.exponentialRampToValueAtTime(peak * 0.35, now + 0.35);
    noteGain.gain.linearRampToValueAtTime(0.0001, now + release);

    // Send both dry (via chordFilter/masterGain) and wet (into dreamy delay loop)
    noteGain.connect(noteFilter);
    noteFilter.connect(this.masterGain);
    noteFilter.connect(this.delayNode);

    const oscSine = this.ctx.createOscillator();
    oscSine.type = 'sine';
    oscSine.frequency.setValueAtTime(freq, now);

    const oscTri = this.ctx.createOscillator();
    oscTri.type = 'triangle';
    oscTri.frequency.setValueAtTime(freq * 2, now); // Delicate celesta/rhodes bell overtone
    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.14, now);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    oscSine.connect(noteGain);
    oscTri.connect(overtoneGain);
    overtoneGain.connect(noteGain);

    oscSine.start(now);
    oscTri.start(now);
    oscSine.stop(now + release + 0.08);
    oscTri.stop(now + 0.32);
  }

  // --------------------------------------------------------------------------
  // 3. DAYTIME PROCEDURAL BIRD CHIRPS (Subtle Nature Soundscape 06:00–17:59)
  // --------------------------------------------------------------------------
  playProceduralBirdChirp() {
    if (!this.ctx || this.ctx.state !== 'running' || !this.isDaytime()) return;
    const now = this.ctx.currentTime;
    const chirpCount = 2 + Math.floor(Math.random() * 2); // 2 or 3 gentle tweets
    const baseFreq = 2300 + Math.random() * 650;

    for (let i = 0; i < chirpCount; i++) {
      const t0 = now + i * (0.14 + Math.random() * 0.05);
      const dur = 0.095;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, t0);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.28, t0 + dur * 0.55);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.96, t0 + dur);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.014, t0 + 0.02);
      gain.gain.linearRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(gain);
      gain.connect(this.masterGain);
      gain.connect(this.delayNode);

      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
  }
}

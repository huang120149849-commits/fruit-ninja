const AudioMan = (() => {
  let ctx = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuf = null;
  let schedulerTimer = null;
  let nextNoteTime = 0;
  let step = 0;
  let musicOn = true;
  let sfxOn = true;
  let bpm = 104;
  let targetBpm = 104;
  let intensity = 0;
  const beatCallbacks = [];

  const MELODY = [
    261.63, 0, 329.63, 0, 392.0, 0, 523.25, 0, 659.25, 0, 523.25, 0, 392.0, 0, 523.25, 0,
    220.0, 0, 261.63, 0, 329.63, 0, 440.0, 0, 523.25, 0, 440.0, 0, 329.63, 0, 440.0, 0,
    174.61, 0, 220.0, 0, 261.63, 0, 349.23, 0, 440.0, 0, 349.23, 0, 261.63, 0, 349.23, 0,
    196.0, 0, 246.94, 0, 293.66, 0, 392.0, 0, 493.88, 0, 392.0, 0, 293.66, 0, 392.0, 0,
  ];
  const BASS = [130.81, 110.0, 87.31, 98.0];

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    musicGain = ctx.createGain();
    musicGain.gain.value = musicOn ? 0.715 : 0;
    musicGain.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = sfxOn ? 1 : 0;
    sfxGain.connect(ctx.destination);
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  function tone(freq, time, dur, type, vol, dest) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(vol, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g).connect(dest || musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function sweepTone(freqFrom, freqTo, time, dur, type, vol, dest) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), time + dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(vol, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g).connect(dest || sfxGain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function noise(freq, q, dur, vol, filterType) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType || "bandpass";
    f.frequency.value = freq;
    f.Q.value = q || 1;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(sfxGain);
    src.start(t);
    src.stop(t + dur);
  }

  function kick(time) {
    sweepTone(95, 42, time, 0.12, "sine", 0.55, musicGain);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    src.connect(f).connect(g).connect(musicGain);
    src.start(time);
    src.stop(time + 0.1);
  }

  function fireBeat() {
    for (const cb of beatCallbacks) {
      try {
        cb();
      } catch (e) {}
    }
  }

  function scheduler() {
    if (!ctx || !musicOn) return;
    bpm += (targetBpm - bpm) * 0.08;
    const stepDur = 60 / bpm / 4;
    while (nextNoteTime < ctx.currentTime + 0.3) {
      const s = step % 64;
      const bar = Math.floor(s / 16);
      const f = MELODY[s];
      const vol = 0.16 + intensity * 0.09;
      if (f) tone(f, nextNoteTime, stepDur * 1.8, "sine", vol);
      if (s % 8 === 0) tone(BASS[bar], nextNoteTime, stepDur * 6, "triangle", 0.22 + intensity * 0.1);
      if (s % 8 === 4) tone(BASS[bar], nextNoteTime, stepDur * 5, "triangle", 0.16);
      if (s % 4 === 0) {
        kick(nextNoteTime);
        const delay = Math.max(0, (nextNoteTime - ctx.currentTime) * 1000);
        setTimeout(fireBeat, delay);
      }
      nextNoteTime += stepDur;
      step++;
    }
  }

  function setIntensity(v) {
    intensity = Math.max(0, Math.min(1, v || 0));
    targetBpm = 104 + intensity * 56;
  }

  function onBeat(cb) {
    beatCallbacks.push(cb);
  }

  function startMusic() {
    ensure();
    if (!ctx || schedulerTimer) return;
    nextNoteTime = ctx.currentTime + 0.1;
    schedulerTimer = setInterval(scheduler, 100);
  }

  function stopMusic() {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  }

  function setMusic(on) {
    musicOn = on;
    ensure();
    if (musicGain) musicGain.gain.value = on ? 0.715 : 0;
    if (on) startMusic();
    else stopMusic();
  }

  function setSfx(on) {
    sfxOn = on;
    ensure();
    if (sfxGain) sfxGain.gain.value = on ? 1 : 0;
  }

  function playSlice() {
    if (!sfxOn) return;
    ensure();
    if (!ctx) return;
    noise(1800, 2, 0.12, 0.5);
    noise(3200, 3, 0.06, 0.2, "bandpass");
  }

  function playSplat() {
    if (!sfxOn) return;
    ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    sweepTone(560, 150, t, 0.16, "sine", 0.55);
    noise(900, 1, 0.2, 0.5, "lowpass");
    noise(2600, 4, 0.07, 0.22, "bandpass");
  }

  function playBomb() {
    if (!sfxOn) return;
    ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    sweepTone(130, 34, t, 0.55, "sawtooth", 0.55);
    sweepTone(60, 25, t, 0.6, "sine", 0.6);
    noise(300, 1, 0.5, 0.6, "lowpass");
    noise(4200, 4, 0.18, 0.3, "highpass");
  }

  function playClick() {
    if (!sfxOn) return;
    ensure();
    if (!ctx) return;
    tone(700, ctx.currentTime, 0.05, "sine", 0.25, sfxGain);
  }

  function playBonus() {
    if (!sfxOn) return;
    ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(880, t, 0.1, "sine", 0.3, sfxGain);
    tone(1174.66, t + 0.08, 0.12, "sine", 0.3, sfxGain);
    tone(1568, t + 0.16, 0.22, "sine", 0.32, sfxGain);
    noise(5000, 3, 0.2, 0.15, "highpass");
  }

  function playCountdown() {
    if (!sfxOn) return;
    ensure();
    if (!ctx) return;
    tone(440, ctx.currentTime, 0.12, "sine", 0.3, sfxGain);
  }

  function playGo() {
    if (!sfxOn) return;
    ensure();
    if (!ctx) return;
    tone(880, ctx.currentTime, 0.25, "sine", 0.35, sfxGain);
  }

  return {
    ensure,
    startMusic,
    setMusic,
    setSfx,
    playSlice,
    playSplat,
    playBomb,
    playClick,
    playBonus,
    playCountdown,
    playGo,
    setIntensity,
    onBeat,
    get musicOn() {
      return musicOn;
    },
    get sfxOn() {
      return sfxOn;
    },
  };
})();

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

  const BPM = 104;
  const STEP = 60 / BPM / 4;

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
    musicGain.gain.value = musicOn ? 0.55 : 0;
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

  function scheduler() {
    if (!ctx || !musicOn) return;
    while (nextNoteTime < ctx.currentTime + 0.3) {
      const s = step % 64;
      const bar = Math.floor(s / 16);
      const f = MELODY[s];
      if (f) tone(f, nextNoteTime, STEP * 1.8, "sine", 0.16);
      if (s % 8 === 0) tone(BASS[bar], nextNoteTime, STEP * 6, "triangle", 0.22);
      if (s % 8 === 4) tone(BASS[bar], nextNoteTime, STEP * 5, "triangle", 0.16);
      nextNoteTime += STEP;
      step++;
    }
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
    if (musicGain) musicGain.gain.value = on ? 0.55 : 0;
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
  }

  function playSplat() {
    if (!sfxOn) return;
    ensure();
    if (!ctx) return;
    tone(520, ctx.currentTime, 0.12, "sine", 0.45, sfxGain);
    noise(800, 1, 0.15, 0.3, "lowpass");
  }

  function playBomb() {
    if (!sfxOn) return;
    ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g).connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.55);
    noise(300, 1, 0.4, 0.5, "lowpass");
  }

  function playClick() {
    if (!sfxOn) return;
    ensure();
    if (!ctx) return;
    tone(700, ctx.currentTime, 0.05, "sine", 0.25, sfxGain);
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
    playCountdown,
    playGo,
    get musicOn() {
      return musicOn;
    },
    get sfxOn() {
      return sfxOn;
    },
  };
})();

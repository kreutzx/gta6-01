// All sound is synthesised with WebAudio — no audio files. An engine loop whose pitch
// follows the revs, a two-tone siren that swells as the nearest police car closes in,
// and one-shot effects (gunshot, punch, cash register, mission jingles) built from
// oscillators and filtered noise. Everything starts only after a user gesture.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engine = null;
  let siren = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.45;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function env(gain, t0, peak, decay) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  }

  function tone(freqA, freqB, dur, type = 'sine', vol = 0.5, when = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqB, 1), t0 + dur);
    env(gain, t0, vol, dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, freqFrom, freqTo, when = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freqFrom, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 10), t0 + dur);
    const gain = ctx.createGain();
    env(gain, t0, vol, dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  function startEngine() {
    if (!ensure() || engine) return;
    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    const oscB = ctx.createOscillator();
    oscB.type = 'square';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain).connect(master);
    oscA.start();
    oscB.start();
    engine = { oscA, oscB, filter, gain };
  }

  function setEngine(revs, load) {
    if (!engine) return;
    const t = ctx.currentTime;
    const f = 55 + revs * 165 + load * 12;
    engine.oscA.frequency.setTargetAtTime(f, t, 0.06);
    engine.oscB.frequency.setTargetAtTime(f * 0.5 + 3, t, 0.06);
    engine.filter.frequency.setTargetAtTime(320 + revs * 900, t, 0.08);
    engine.gain.gain.setTargetAtTime(0.05 + revs * 0.075, t, 0.09);
  }

  function stopEngine() {
    if (!engine) return;
    try { engine.oscA.stop(); engine.oscB.stop(); } catch { /* already stopped */ }
    engine = null;
  }

  function setSiren(on, nearestDist) {
    if (!ensure()) return;
    if (on && !siren) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.frequency.value = 950;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(master);
      osc.start();
      lfo.start();
      siren = { osc, lfo, gain };
    }
    if (siren) {
      const vol = on ? Math.max(0, 0.16 * (1 - nearestDist / 95)) : 0;
      siren.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.2);
      if (!on && vol === 0) {
        const s = siren;
        siren = null;
        setTimeout(() => { try { s.osc.stop(); s.lfo.stop(); } catch { /* fine */ } }, 600);
      }
    }
  }

  return {
    ensure,
    startEngine,
    setEngine,
    stopEngine,
    setSiren,
    shot(vol = 1) { noise(0.14, 0.5 * vol, 3200, 300); tone(160, 40, 0.1, 'square', 0.25 * vol); },
    punch() { tone(130, 45, 0.09, 'sine', 0.6); noise(0.05, 0.2, 1200, 300); },
    hurt() { tone(220, 90, 0.12, 'sawtooth', 0.3); },
    cash() { tone(880, 880, 0.07, 'square', 0.22); tone(1318, 1318, 0.12, 'square', 0.22, 0.07); },
    pickup() { tone(660, 990, 0.1, 'sine', 0.35); },
    complete() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.35, i * 0.09)); },
    fail() { tone(392, 392, 0.14, 'triangle', 0.3); tone(311, 311, 0.2, 'triangle', 0.3, 0.13); tone(233, 200, 0.3, 'triangle', 0.3, 0.26); },
    click() { tone(740, 740, 0.05, 'square', 0.18); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.45;
    },
    get muted() { return muted; },
  };
}

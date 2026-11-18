// Sons synthétisés via Web Audio API (aucun fichier audio à charger/héberger).
(function () {
  let ctx = null;
  let ambient = null;

  function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playClick() {
    const c = ensureCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(760, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(420, c.currentTime + 0.08);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.1);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.11);
  }

  function startAmbient() {
    if (ambient) return;
    const c = ensureCtx();
    const master = c.createGain();
    master.gain.setValueAtTime(0, c.currentTime);
    master.gain.linearRampToValueAtTime(0.05, c.currentTime + 1);
    master.connect(c.destination);

    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 55 * 1.5;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.06;
    const lfoGain = c.createGain(); lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain).connect(master.gain);

    o1.connect(master); o2.connect(master);
    o1.start(); o2.start(); lfo.start();
    ambient = { master, o1, o2, lfo };
  }

  function stopAmbient() {
    if (!ambient) return;
    const { master, o1, o2, lfo } = ambient;
    const c = ctx;
    master.gain.setTargetAtTime(0, c.currentTime, 0.25);
    setTimeout(() => { try { o1.stop(); o2.stop(); lfo.stop(); } catch (e) {} }, 600);
    ambient = null;
  }

  function isAmbientOn() { return !!ambient; }

  window.CyberSound = { playClick, startAmbient, stopAmbient, isAmbientOn };
})();

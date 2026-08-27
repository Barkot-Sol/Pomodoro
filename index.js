/**
 * SYNTH·PULSE // 1984 Retro Arcade Pomodoro Console
 * Drift-free countdown engine, 80s Web Audio synthesizers, cassette deck animations, and arcade HUD scoring.
 */

// =============================================================================
// State & Configuration
// =============================================================================

const STORAGE_KEYS = {
  SETTINGS: 'synthpulse_settings_v4',
  STATS: 'synthpulse_stats_v4',
};

const DEFAULT_SETTINGS = {
  focusDuration: 25,       // minutes
  shortBreakDuration: 5,   // minutes
  longBreakDuration: 15,   // minutes
  soundTheme: 'synth',     // synth | bell | marimba | bowl | sparkle
  volume: 0.8,             // 0.0 to 1.0
  isMuted: false,
  autoStartBreaks: false,
  autoStartPomodoros: false,
};

let settings = { ...DEFAULT_SETTINGS };

let timerState = {
  mode: 'focus',          // 'focus' | 'shortBreak' | 'longBreak'
  isRunning: false,
  remainingSeconds: 25 * 60,
  totalDurationSeconds: 25 * 60,
  cycleCount: 1,          // 1, 2, 3, 4 (Rounds)
  intervalId: null,
  targetTimestamp: null,  // Drift-free precision
};

let stats = {
  date: new Date().toDateString(),
  completedSessions: 0,
  focusMinutes: 0,
};

// =============================================================================
// 80s Web Audio API Engine
// =============================================================================

let audioCtx = null;
let masterGainNode = null;
let ambientSource = null;
let ambientGainNode = null;
let ambientOsc1 = null;
let ambientOsc2 = null;
let ambientSubOsc = null;
let ambientLFO = null;
let currentAmbientSound = 'none';
let vuIntervalId = null;

function initAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      masterGainNode = audioCtx.createGain();
      const currentVol = settings.isMuted ? 0 : settings.volume;
      masterGainNode.gain.setValueAtTime(currentVol, audioCtx.currentTime);
      masterGainNode.connect(audioCtx.destination);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function updateMasterVolume() {
  if (!audioCtx || !masterGainNode) return;
  const targetGain = settings.isMuted ? 0 : settings.volume;
  masterGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  masterGainNode.gain.setValueAtTime(targetGain, audioCtx.currentTime);
}

function playUnmuteFeedback() {
  if (!audioCtx || !masterGainNode) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(440, now); // A4
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(masterGainNode);

  osc.start(now);
  osc.stop(now + 0.09);
}

/**
 * Synthesize 80s polyphonic arcade/synth notification chimes
 */
function playAlarmSound(theme = settings.soundTheme, forcePlay = false) {
  initAudioContext();
  if (!audioCtx || !masterGainNode) return;
  if (!forcePlay && (settings.isMuted || settings.volume <= 0)) return;

  const now = audioCtx.currentTime;
  const alarmGain = audioCtx.createGain();
  alarmGain.gain.setValueAtTime(0.85, now);

  if (forcePlay && settings.isMuted) {
    alarmGain.connect(audioCtx.destination);
  } else {
    alarmGain.connect(masterGainNode);
  }

  switch (theme) {
    case 'synth':
      // ⚡ 1984 Polyphonic Synth Brass Fanfare (D4, F#4, A4, D5)
      [293.66, 369.99, 440.00, 587.33].forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();
        const noteStart = now + (index * 0.04);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, noteStart);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, noteStart);
        filter.frequency.exponentialRampToValueAtTime(3600, noteStart + 0.15);
        filter.frequency.exponentialRampToValueAtTime(600, noteStart + 1.3);

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.5, noteStart + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 1.4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(alarmGain);

        osc.start(noteStart);
        osc.stop(noteStart + 1.45);
      });
      break;

    case 'marimba':
      // Uplifting rapid pentatonic chime (C5, E5, G5, C6)
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const noteStart = now + (index * 0.12);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.8, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.8);

        osc.connect(gain);
        gain.connect(alarmGain);

        osc.start(noteStart);
        osc.stop(noteStart + 0.85);
      });
      break;

    case 'bowl':
      // Cosmic Singing Bowl
      [220, 440, 660, 1100].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const amp = 0.6 / (idx + 1);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(amp, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

        osc.connect(gain);
        gain.connect(alarmGain);

        osc.start(now);
        osc.stop(now + 3.3);
      });
      break;

    case 'sparkle':
      // Laser Sparkle
      [880, 1108.73, 1318.51, 1760, 2093].forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const noteStart = now + (index * 0.08);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.5, noteStart + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.9);

        osc.connect(gain);
        gain.connect(alarmGain);

        osc.start(noteStart);
        osc.stop(noteStart + 0.95);
      });
      break;

    case 'bell':
    default:
      // Crystal FM Bell (F6, A6, C7)
      [1396.91, 1760.00, 2093.00].forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const noteStart = now + (index * 0.14);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.7, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 1.4);

        osc.connect(gain);
        gain.connect(alarmGain);

        osc.start(noteStart);
        osc.stop(noteStart + 1.5);
      });
      break;
  }
}

/**
 * Stop any active ambient audio generators
 */
function cleanupAmbientNodes() {
  if (ambientSource) {
    try { ambientSource.stop(); ambientSource.disconnect(); } catch (e) {}
    ambientSource = null;
  }
  if (ambientOsc1) {
    try { ambientOsc1.stop(); ambientOsc1.disconnect(); } catch (e) {}
    ambientOsc1 = null;
  }
  if (ambientOsc2) {
    try { ambientOsc2.stop(); ambientOsc2.disconnect(); } catch (e) {}
    ambientOsc2 = null;
  }
  if (ambientSubOsc) {
    try { ambientSubOsc.stop(); ambientSubOsc.disconnect(); } catch (e) {}
    ambientSubOsc = null;
  }
  if (ambientLFO) {
    try { ambientLFO.stop(); ambientLFO.disconnect(); } catch (e) {}
    ambientLFO = null;
  }
}

/**
 * Ambient focus soundscape generator (Audible & Authentic 80s Soundscapes)
 */
function setAmbientSound(type) {
  currentAmbientSound = type;
  cleanupAmbientNodes();

  // Update cassette tape UI
  const tapeNames = {
    none: 'NO TAPE',
    rain: 'SIDE A · NEON RAIN',
    brown: 'SIDE A · CYBER DRIFT',
    fire: 'SIDE A · RETRO GLOW',
  };
  elements.tapeLabel.textContent = tapeNames[type] || 'NO TAPE';
  const isTapeActive = type !== 'none';
  elements.spoolLeft.classList.toggle('spinning', isTapeActive);
  elements.spoolRight.classList.toggle('spinning', isTapeActive);

  if (type === 'none') {
    stopVUMeter();
    return;
  }

  initAudioContext();
  if (!audioCtx || !masterGainNode) return;

  const now = audioCtx.currentTime;
  ambientGainNode = audioCtx.createGain();
  ambientGainNode.gain.setValueAtTime(0.32, now);
  ambientGainNode.connect(masterGainNode);

  if (type === 'rain') {
    // 🌧️ NEON RAIN: Rich Pink Noise Rainfall with Lowpass Modulation
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      data[i] = (b0 + b1 + b2 + b3) * 0.28;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;

    noise.connect(filter);
    filter.connect(ambientGainNode);
    noise.start(now);
    ambientSource = noise;

  } else if (type === 'brown') {
    // 🌌 CYBER DRIFT: 80s Cosmic Analog Synth Drone (D2 + A2 + Sub Bass + LFO sweep)
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const subOsc = audioCtx.createOscillator();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(73.42, now); // D2

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(110.00, now); // A2 (fifth)
    osc2.detune.setValueAtTime(8, now); // Chorus detune

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(36.71, now); // Sub D1

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.Q.setValueAtTime(4, now);

    // LFO to sweep synth filter
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.18, now); // Slow 0.18 Hz sweep
    lfoGain.gain.setValueAtTime(220, now);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);

    const droneGain = audioCtx.createGain();
    droneGain.gain.setValueAtTime(0.28, now);

    osc1.connect(filter);
    osc2.connect(filter);
    subOsc.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(ambientGainNode);

    osc1.start(now);
    osc2.start(now);
    subOsc.start(now);

    ambientOsc1 = osc1;
    ambientOsc2 = osc2;
    ambientSubOsc = subOsc;
    ambientLFO = lfo;

  } else if (type === 'fire') {
    // 🪵 RETRO GLOW: Warm Vinyl Crackle + Analog Vacuum Tube Tone
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const isPop = Math.random() < 0.001;
      const isCrackle = Math.random() < 0.012;
      if (isPop) {
        data[i] = (Math.random() * 2 - 1) * 0.95;
      } else if (isCrackle) {
        data[i] = (Math.random() * 2 - 1) * 0.45;
      } else {
        data[i] = (Math.random() * 2 - 1) * 0.07;
      }
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1600;
    filter.Q.value = 1.0;

    // 55Hz Warm analog transformer hum
    const humOsc = audioCtx.createOscillator();
    const humGain = audioCtx.createGain();
    humOsc.type = 'triangle';
    humOsc.frequency.setValueAtTime(55, now);
    humGain.gain.setValueAtTime(0.12, now);

    noise.connect(filter);
    filter.connect(ambientGainNode);

    humOsc.connect(humGain);
    humGain.connect(ambientGainNode);

    noise.start(now);
    humOsc.start(now);

    ambientSource = noise;
    ambientOsc1 = humOsc;
  }

  startVUMeter();
}

/**
 * Animated Stereo VU Meters
 */
function startVUMeter() {
  if (vuIntervalId) return;
  const ledsL = elements.vuL.querySelectorAll('.v-led');
  const ledsR = elements.vuR.querySelectorAll('.v-led');

  vuIntervalId = setInterval(() => {
    if (currentAmbientSound === 'none' && !timerState.isRunning) {
      stopVUMeter();
      return;
    }
    const levelL = Math.floor(Math.random() * (ledsL.length + 1));
    const levelR = Math.floor(Math.random() * (ledsR.length + 1));

    ledsL.forEach((led, i) => led.classList.toggle('lit', i < levelL));
    ledsR.forEach((led, i) => led.classList.toggle('lit', i < levelR));
  }, 110);
}

function stopVUMeter() {
  if (vuIntervalId) {
    clearInterval(vuIntervalId);
    vuIntervalId = null;
  }
  elements.vuL.querySelectorAll('.v-led').forEach(l => l.classList.remove('lit'));
  elements.vuR.querySelectorAll('.v-led').forEach(l => l.classList.remove('lit'));
}

// =============================================================================
// DOM Elements
// =============================================================================

const elements = {
  body: document.body,
  timeDisplay: document.getElementById('timeDisplay'),
  progressCircle: document.getElementById('progressCircle'),
  startPauseBtn: document.getElementById('startPauseBtn'),
  startPauseText: document.getElementById('startPauseText'),
  startPauseIcon: document.getElementById('startPauseIcon'),
  resetBtn: document.getElementById('resetBtn'),
  skipBtn: document.getElementById('skipBtn'),
  plusMinuteBtn: document.getElementById('plusMinuteBtn'),
  minusMinuteBtn: document.getElementById('minusMinuteBtn'),
  plus5MinBtn: document.getElementById('plus5MinBtn'),
  minus5MinBtn: document.getElementById('minus5MinBtn'),
  sessionBadgeText: document.getElementById('sessionBadgeText'),
  timerTagline: document.getElementById('timerTagline'),

  // Mode Rockers
  tabFocus: document.getElementById('tabFocus'),
  tabShortBreak: document.getElementById('tabShortBreak'),
  tabLongBreak: document.getElementById('tabLongBreak'),
  modeTabs: document.querySelectorAll('.rocker-btn'),

  // Cassette & VU
  spoolLeft: document.getElementById('spoolLeft'),
  spoolRight: document.getElementById('spoolRight'),
  tapeLabel: document.getElementById('tapeLabel'),
  vuL: document.getElementById('vuL'),
  vuR: document.getElementById('vuR'),
  ambientTracks: document.querySelectorAll('.track-btn'),

  // Stats, HUD Score & Reset
  statScore: document.getElementById('statScore'),
  statCompletedSessions: document.getElementById('statCompletedSessions'),
  statTotalMinutes: document.getElementById('statTotalMinutes'),
  statCycleProgress: document.getElementById('statCycleProgress'),
  meterFill: document.getElementById('meterFill'),
  ledRec: document.getElementById('ledRec'),
  resetStatsBtn: document.getElementById('resetStatsBtn'),

  // Sound & Settings
  muteToggleBtn: document.getElementById('muteToggleBtn'),
  soundOnIcon: document.getElementById('soundOnIcon'),
  soundOffIcon: document.getElementById('soundOffIcon'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  settingsForm: document.getElementById('settingsForm'),
  inputFocus: document.getElementById('inputFocus'),
  inputShortBreak: document.getElementById('inputShortBreak'),
  inputLongBreak: document.getElementById('inputLongBreak'),
  soundSelect: document.getElementById('soundSelect'),
  previewSoundBtn: document.getElementById('previewSoundBtn'),
  volumeSlider: document.getElementById('volumeSlider'),
  volumeValue: document.getElementById('volumeValue'),
  autoStartBreaks: document.getElementById('autoStartBreaks'),
  autoStartPomodoros: document.getElementById('autoStartPomodoros'),
  resetDefaultsBtn: document.getElementById('resetDefaultsBtn'),

  // Toast
  toastNotification: document.getElementById('toastNotification'),
  toastEmoji: document.getElementById('toastEmoji'),
  toastTitle: document.getElementById('toastTitle'),
  toastMessage: document.getElementById('toastMessage'),
  toastCloseBtn: document.getElementById('toastCloseBtn'),
};

// =============================================================================
// Helper Functions
// =============================================================================

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getModeDurationMinutes(mode) {
  switch (mode) {
    case 'shortBreak':
      return settings.shortBreakDuration;
    case 'longBreak':
      return settings.longBreakDuration;
    case 'focus':
    default:
      return settings.focusDuration;
  }
}

function getModeTagline(mode) {
  switch (mode) {
    case 'shortBreak':
      return 'PIT STOP · COOLING DOWN CORE';
    case 'longBreak':
      return 'CRUISING THE SYNTHWAVE HORIZON';
    case 'focus':
    default:
      return 'CHANNEL SYNTHWAVE MOMENTUM';
  }
}

function getCircleCircumference() {
  if (!elements.progressCircle) return 867.08;
  const radius = elements.progressCircle.r?.baseVal?.value || 138;
  return 2 * Math.PI * radius;
}

// Dynamic 80s Favicon
const faviconCanvas = document.createElement('canvas');
faviconCanvas.width = 32;
faviconCanvas.height = 32;
let faviconLink = document.querySelector("link[rel~='icon']");
if (!faviconLink) {
  faviconLink = document.createElement('link');
  faviconLink.rel = 'icon';
  document.head.appendChild(faviconLink);
}

function updateFavicon(fraction, mode) {
  const ctx = faviconCanvas.getContext('2d');
  ctx.clearRect(0, 0, 32, 32);

  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, 2 * Math.PI);
  ctx.fillStyle = '#090314';
  ctx.fill();

  const color = mode === 'focus' ? '#FF007F' : (mode === 'shortBreak' ? '#00F0FF' : '#9D00FF');
  ctx.beginPath();
  ctx.arc(16, 16, 12, -Math.PI / 2, (-Math.PI / 2) + (fraction * 2 * Math.PI));
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();

  faviconLink.href = faviconCanvas.toDataURL();
}

// =============================================================================
// UI Update Logic
// =============================================================================

function updateDisplay() {
  const timeFormatted = formatTime(timerState.remainingSeconds);
  elements.timeDisplay.textContent = timeFormatted;

  const circumference = getCircleCircumference();
  elements.progressCircle.style.strokeDasharray = `${circumference}`;
  const progressRatio = timerState.totalDurationSeconds > 0 
    ? (timerState.remainingSeconds / timerState.totalDurationSeconds) 
    : 0;
  const offset = circumference * (1 - progressRatio);
  elements.progressCircle.style.strokeDashoffset = offset;

  const modeLabels = { focus: '⚡ FOCUS', shortBreak: '☕ PIT STOP', longBreak: '🌴 CRUISE' };
  document.title = `${timeFormatted} — ${modeLabels[timerState.mode]} // SYNTH·PULSE`;
  updateFavicon(progressRatio, timerState.mode);

  if (timerState.mode === 'focus') {
    elements.sessionBadgeText.textContent = `ROUND 0${timerState.cycleCount} / 04`;
  } else if (timerState.mode === 'shortBreak') {
    elements.sessionBadgeText.textContent = `PIT STOP (0${timerState.cycleCount}/04)`;
  } else {
    elements.sessionBadgeText.textContent = `CRUISE COMPLETED`;
  }
  elements.timerTagline.textContent = getModeTagline(timerState.mode);

  elements.modeTabs.forEach(tab => {
    const isActive = tab.dataset.mode === timerState.mode;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive);
  });

  elements.body.setAttribute('data-mode', timerState.mode);

  // LED & Ignition Pushbutton state
  if (timerState.isRunning) {
    elements.startPauseText.textContent = 'PAUSE';
    elements.startPauseIcon.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" rx="1.5"></rect>
        <rect x="14" y="4" width="4" height="16" rx="1.5"></rect>
      </svg>
    `;
    elements.body.classList.add('is-running');
    elements.ledRec.classList.add('active');
    startVUMeter();
  } else {
    elements.startPauseText.textContent = timerState.mode === 'focus' ? 'IGNITION' : 'START BREAK';
    elements.startPauseIcon.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    `;
    elements.body.classList.remove('is-running');
    elements.ledRec.classList.remove('active');
    if (currentAmbientSound === 'none') {
      stopVUMeter();
    }
  }

  // Arcade Scoreboard & Power Meter
  const scoreVal = (stats.completedSessions * 1000) + (stats.focusMinutes * 50);
  elements.statScore.textContent = scoreVal.toString().padStart(6, '0');
  elements.statCompletedSessions.textContent = stats.completedSessions;
  elements.statTotalMinutes.textContent = stats.focusMinutes;
  elements.statCycleProgress.textContent = `${timerState.cycleCount} / 4`;
  elements.meterFill.style.width = `${(timerState.cycleCount / 4) * 100}%`;
}

// =============================================================================
// Timer Actions
// =============================================================================

function switchMode(newMode, forceDuration = null) {
  pauseTimer();
  timerState.mode = newMode;
  const minutes = forceDuration !== null ? forceDuration : getModeDurationMinutes(newMode);
  timerState.totalDurationSeconds = minutes * 60;
  timerState.remainingSeconds = timerState.totalDurationSeconds;
  updateDisplay();
}

function startTimer() {
  initAudioContext();
  if (timerState.isRunning) return;

  timerState.isRunning = true;
  timerState.targetTimestamp = Date.now() + (timerState.remainingSeconds * 1000);

  timerState.intervalId = setInterval(() => {
    const msRemaining = timerState.targetTimestamp - Date.now();
    const secRemaining = Math.max(0, Math.ceil(msRemaining / 1000));

    timerState.remainingSeconds = secRemaining;
    updateDisplay();

    if (secRemaining <= 0) {
      handleTimerCompletion();
    }
  }, 250);

  updateDisplay();
}

function pauseTimer() {
  if (!timerState.isRunning) return;
  timerState.isRunning = false;
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  updateDisplay();
}

function toggleStartPause() {
  if (timerState.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function resetTimer() {
  pauseTimer();
  const minutes = getModeDurationMinutes(timerState.mode);
  timerState.totalDurationSeconds = minutes * 60;
  timerState.remainingSeconds = timerState.totalDurationSeconds;
  updateDisplay();
}

function skipPhase() {
  pauseTimer();
  if (timerState.mode === 'focus') {
    if (timerState.cycleCount >= 4) {
      switchMode('longBreak');
    } else {
      switchMode('shortBreak');
    }
  } else {
    if (timerState.mode === 'longBreak') {
      timerState.cycleCount = 1;
    } else {
      timerState.cycleCount = (timerState.cycleCount % 4) + 1;
    }
    switchMode('focus');
  }
}

function adjustMinutes(deltaMinutes) {
  const newSeconds = Math.max(60, timerState.remainingSeconds + (deltaMinutes * 60));
  timerState.remainingSeconds = newSeconds;
  if (newSeconds > timerState.totalDurationSeconds) {
    timerState.totalDurationSeconds = newSeconds;
  }
  if (timerState.isRunning) {
    timerState.targetTimestamp = Date.now() + (timerState.remainingSeconds * 1000);
  }
  updateDisplay();
}

function resetAllStats() {
  initAudioContext();
  stats.completedSessions = 0;
  stats.focusMinutes = 0;
  timerState.cycleCount = 1;
  saveStats();
  updateDisplay();
  playUnmuteFeedback();
  showToast('🏆', 'SCORE & STATS RESET', 'XP Score, completed sessions, and round cycle reset to 0.');
}

function handleTimerCompletion() {
  pauseTimer();

  playAlarmSound(settings.soundTheme);

  if (timerState.mode === 'focus') {
    stats.completedSessions += 1;
    stats.focusMinutes += Math.round(timerState.totalDurationSeconds / 60);
    saveStats();

    showToast('⚡', 'MISSION COMPLETE // +1000 PTS', `Awesome run! Round ${timerState.cycleCount} of 4 complete.`);

    if (timerState.cycleCount >= 4) {
      switchMode('longBreak');
      if (settings.autoStartBreaks) startTimer();
    } else {
      switchMode('shortBreak');
      if (settings.autoStartBreaks) startTimer();
    }
  } else {
    showToast('🚀', 'PIT STOP OVER // READY UP', 'Time to jump back into hyper focus!');
    if (timerState.mode === 'longBreak') {
      timerState.cycleCount = 1;
    } else {
      timerState.cycleCount = (timerState.cycleCount % 4) + 1;
    }
    switchMode('focus');
    if (settings.autoStartPomodoros) startTimer();
  }

  updateDisplay();
}

// =============================================================================
// Toast Notifications
// =============================================================================

let toastTimeout = null;

function showToast(emoji, title, message) {
  elements.toastEmoji.textContent = emoji;
  elements.toastTitle.textContent = title;
  elements.toastMessage.textContent = message;
  elements.toastNotification.classList.remove('hidden');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    elements.toastNotification.classList.add('hidden');
  }, 4500);
}

function hideToast() {
  elements.toastNotification.classList.add('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
}

// =============================================================================
// LocalStorage Persistence
// =============================================================================

function loadSavedData() {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (savedSettings) {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
    }

    const savedStats = localStorage.getItem(STORAGE_KEYS.STATS);
    if (savedStats) {
      const parsedStats = JSON.parse(savedStats);
      if (parsedStats.date === new Date().toDateString()) {
        stats = parsedStats;
      } else {
        stats = { date: new Date().toDateString(), completedSessions: 0, focusMinutes: 0 };
        saveStats();
      }
    }
  } catch (e) {
    console.warn('Could not read from localStorage:', e);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.warn('Could not save settings:', e);
  }
}

function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  } catch (e) {
    console.warn('Could not save stats:', e);
  }
}

// =============================================================================
// Settings Modal Handling
// =============================================================================

function openSettings() {
  elements.inputFocus.value = settings.focusDuration;
  elements.inputShortBreak.value = settings.shortBreakDuration;
  elements.inputLongBreak.value = settings.longBreakDuration;
  elements.soundSelect.value = settings.soundTheme;
  elements.volumeSlider.value = Math.round(settings.volume * 100);
  elements.volumeValue.textContent = `${Math.round(settings.volume * 100)}%`;
  elements.autoStartBreaks.checked = settings.autoStartBreaks;
  elements.autoStartPomodoros.checked = settings.autoStartPomodoros;

  if (typeof elements.settingsModal.showModal === 'function') {
    elements.settingsModal.showModal();
  } else {
    elements.settingsModal.setAttribute('open', '');
  }
}

function closeSettings() {
  if (typeof elements.settingsModal.close === 'function') {
    elements.settingsModal.close();
  } else {
    elements.settingsModal.removeAttribute('open');
  }
}

function saveSettingsForm(e) {
  e.preventDefault();
  settings.focusDuration = Math.max(1, parseInt(elements.inputFocus.value, 10) || 25);
  settings.shortBreakDuration = Math.max(1, parseInt(elements.inputShortBreak.value, 10) || 5);
  settings.longBreakDuration = Math.max(1, parseInt(elements.inputLongBreak.value, 10) || 15);
  settings.soundTheme = elements.soundSelect.value;
  settings.volume = parseInt(elements.volumeSlider.value, 10) / 100;
  settings.autoStartBreaks = elements.autoStartBreaks.checked;
  settings.autoStartPomodoros = elements.autoStartPomodoros.checked;

  saveSettings();
  updateMasterVolume();
  closeSettings();

  if (!timerState.isRunning) {
    resetTimer();
  }
}

function resetSettingsToDefaults() {
  settings = { ...DEFAULT_SETTINGS };
  saveSettings();
  updateMasterVolume();
  updateMuteUI();
  openSettings();
}

function toggleMute() {
  initAudioContext();
  settings.isMuted = !settings.isMuted;
  saveSettings();
  updateMasterVolume();
  updateMuteUI();

  if (!settings.isMuted) {
    playUnmuteFeedback();
    showToast('🔊', 'AUDIO UNMUTED', 'Console SFX and Ambient soundscapes active.');
  } else {
    showToast('🔇', 'AUDIO MUTED', 'Console SFX and Ambient soundscapes silenced.');
  }
}

function updateMuteUI() {
  if (settings.isMuted) {
    elements.soundOnIcon.classList.add('hidden');
    elements.soundOffIcon.classList.remove('hidden');
    elements.muteToggleBtn.classList.add('is-muted');
    elements.muteToggleBtn.title = 'Unmute Sound (M)';
    elements.muteToggleBtn.setAttribute('aria-pressed', 'true');
  } else {
    elements.soundOnIcon.classList.remove('hidden');
    elements.soundOffIcon.classList.add('hidden');
    elements.muteToggleBtn.classList.remove('is-muted');
    elements.muteToggleBtn.title = 'Mute Sound (M)';
    elements.muteToggleBtn.setAttribute('aria-pressed', 'false');
  }
}

// =============================================================================
// Event Listeners
// =============================================================================

function setupEventListeners() {
  // Main Ignition & Controls
  elements.startPauseBtn.addEventListener('click', toggleStartPause);
  elements.resetBtn.addEventListener('click', resetTimer);
  elements.skipBtn.addEventListener('click', skipPhase);

  // Reset Stats Button
  if (elements.resetStatsBtn) {
    elements.resetStatsBtn.addEventListener('click', resetAllStats);
  }

  // Time Trim Controls
  elements.plusMinuteBtn.addEventListener('click', () => adjustMinutes(1));
  elements.minusMinuteBtn.addEventListener('click', () => adjustMinutes(-1));
  if (elements.plus5MinBtn) {
    elements.plus5MinBtn.addEventListener('click', () => adjustMinutes(5));
  }
  if (elements.minus5MinBtn) {
    elements.minus5MinBtn.addEventListener('click', () => adjustMinutes(-5));
  }

  // Mode Rockers
  elements.modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      if (mode && mode !== timerState.mode) {
        switchMode(mode);
      }
    });
  });

  // Cassette Ambient Tracks
  elements.ambientTracks.forEach(track => {
    track.addEventListener('click', () => {
      elements.ambientTracks.forEach(t => t.classList.remove('active'));
      track.classList.add('active');
      setAmbientSound(track.dataset.sound);
    });
  });

  // Mute & Settings
  elements.muteToggleBtn.addEventListener('click', toggleMute);
  elements.openSettingsBtn.addEventListener('click', openSettings);
  elements.closeSettingsBtn.addEventListener('click', closeSettings);
  elements.settingsForm.addEventListener('submit', saveSettingsForm);
  elements.resetDefaultsBtn.addEventListener('click', resetSettingsToDefaults);

  // Sound preview in settings
  elements.previewSoundBtn.addEventListener('click', () => {
    const selectedSound = elements.soundSelect.value;
    playAlarmSound(selectedSound, true);
  });

  // Volume slider
  elements.volumeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    elements.volumeValue.textContent = `${val}%`;
    settings.volume = val / 100;
    
    if (settings.isMuted && val > 0) {
      settings.isMuted = false;
      updateMuteUI();
    }
    saveSettings();
    updateMasterVolume();
  });

  elements.toastCloseBtn.addEventListener('click', hideToast);

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      toggleStartPause();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      resetTimer();
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      skipPhase();
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      toggleMute();
    } else if (e.key === 'Escape') {
      closeSettings();
      hideToast();
    }
  });

  elements.settingsModal.addEventListener('click', (e) => {
    const dialogDimensions = elements.settingsModal.getBoundingClientRect();
    if (
      e.clientX < dialogDimensions.left ||
      e.clientX > dialogDimensions.right ||
      e.clientY < dialogDimensions.top ||
      e.clientY > dialogDimensions.bottom
    ) {
      closeSettings();
    }
  });
}

// =============================================================================
// Initialization
// =============================================================================

function init() {
  loadSavedData();
  updateMuteUI();
  setupEventListeners();

  timerState.totalDurationSeconds = settings.focusDuration * 60;
  timerState.remainingSeconds = timerState.totalDurationSeconds;

  updateDisplay();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

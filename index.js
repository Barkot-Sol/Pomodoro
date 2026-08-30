/**
 * FocusPulse — Modern Pomodoro Timer (80s Retro Synthwave Multi-Theme Edition)
 * High-precision timer, Unified Web Audio API synthesizer, Theme Manager, and Ambient Sounds.
 */

// =============================================================================
// State & Configuration
// =============================================================================

const STORAGE_KEYS = {
  SETTINGS: 'focuspulse_settings_v2',
  STATS: 'focuspulse_stats_v2',
  THEME: 'focuspulse_theme_v2',
};

const DEFAULT_SETTINGS = {
  theme: 'synthwave',      // synthwave | cyber | lofi | sakura | nordic
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
  cycleCount: 1,          // 1, 2, 3, 4 (Pomodoro rounds)
  intervalId: null,
  targetTimestamp: null,  // For drift-free precision
};

let stats = {
  date: new Date().toDateString(),
  completedSessions: 0,
  focusMinutes: 0,
};

// =============================================================================
// Unified Web Audio API Engine
// =============================================================================

let audioCtx = null;
let masterGainNode = null;
let ambientSource = null;
let ambientGainNode = null;
let currentAmbientSound = 'none';

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
  osc.frequency.setValueAtTime(587.33, now); // D5
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(masterGainNode);

  osc.start(now);
  osc.stop(now + 0.09);
}

/**
 * Synthesize musical notification chimes
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
      // ⚡ 80s Synthwave Polyphonic Brass / Chord (D4, F#4, A4, D5)
      [293.66, 369.99, 440.00, 587.33].forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();
        const noteStart = now + (index * 0.04);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, noteStart);

        // Lowpass sweep for 80s synth character
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, noteStart);
        filter.frequency.exponentialRampToValueAtTime(3200, noteStart + 0.15);
        filter.frequency.exponentialRampToValueAtTime(600, noteStart + 1.2);

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
      // Tibetan singing bowl
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
      // Ascending crystalline sparkle
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
      // Crystal 3-Tone chime (F6, A6, C7)
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

let ambientNodes = [];

function stopAmbientSound() {
  if (ambientNodes.length > 0) {
    ambientNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {
        // Ignore
      }
    });
    ambientNodes = [];
  }
  ambientSource = null;
  ambientGainNode = null;
}

/**
 * Ambient focus sound generators:
 * - 'rain': 🌧️ Neon Rain (multiband pink rain with soft droplet taps)
 * - 'brown': 🌌 Deep Horizon (cinematic cosmic synth drone + warm resonant brown noise)
 * - 'fire': 🪵 Retro Glow (realistic crackling campfire with pops, flame body & warm embers)
 */
function setAmbientSound(type) {
  currentAmbientSound = type;
  stopAmbientSound();

  if (type === 'none') return;
  initAudioContext();
  if (!audioCtx || !masterGainNode) return;

  const sampleRate = audioCtx.sampleRate;
  const duration = 4; // 4 seconds buffer for seamless rich textures
  const bufferSize = sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  ambientGainNode = audioCtx.createGain();
  ambientGainNode.connect(masterGainNode);

  if (type === 'rain') {
    // 🌧️ Neon Rain: Multiband pink noise with scattered raindrop taps
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.14;
      b6 = white * 0.115926;
    }

    // Add gentle random droplet impulses
    const dropCount = duration * 45;
    for (let d = 0; d < dropCount; d++) {
      const pos = Math.floor(Math.random() * (bufferSize - 400));
      const dropAmp = (Math.random() * 0.15 + 0.05);
      const dropFreq = 0.08 + Math.random() * 0.08;
      for (let j = 0; j < 350; j++) {
        data[pos + j] += Math.sin(j * dropFreq) * Math.exp(-j / 60) * dropAmp;
      }
    }

    applyBufferCrossfade(data, sampleRate, bufferSize);

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, audioCtx.currentTime);

    noiseSource.connect(filter);
    filter.connect(ambientGainNode);
    ambientGainNode.gain.setValueAtTime(0.35, audioCtx.currentTime);

    noiseSource.start();
    ambientNodes.push(noiseSource, filter, ambientGainNode);
    ambientSource = noiseSource;

  } else if (type === 'brown') {
    // 🌌 Deep Horizon: Cinematic analog cosmic drone + resonant deep brownian atmosphere
    let last = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + (0.04 * white)) / 1.025;
      data[i] = last * 2.2;
    }

    applyBufferCrossfade(data, sampleRate, bufferSize);

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, audioCtx.currentTime);
    filter.Q.setValueAtTime(1.8, audioCtx.currentTime);

    noiseSource.connect(filter);
    filter.connect(ambientGainNode);

    // Warm sub-drone oscillators (C2 = 65.41Hz & G2 = 98.00Hz) for deep soothing presence
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(65.41, audioCtx.currentTime);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(98.00, audioCtx.currentTime);

    oscGain.gain.setValueAtTime(0.12, audioCtx.currentTime);

    // Subtle slow cosmic pulse
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.frequency.setValueAtTime(0.08, audioCtx.currentTime);
    lfoGain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(oscGain.gain);

    osc1.connect(oscGain);
    osc2.connect(oscGain);
    oscGain.connect(ambientGainNode);

    ambientGainNode.gain.setValueAtTime(0.38, audioCtx.currentTime);

    const now = audioCtx.currentTime;
    noiseSource.start(now);
    osc1.start(now);
    osc2.start(now);
    lfo.start(now);

    ambientNodes.push(noiseSource, filter, osc1, osc2, oscGain, lfo, lfoGain, ambientGainNode);
    ambientSource = noiseSource;

  } else if (type === 'fire') {
    // 🪵 Retro Glow: Warm crackling campfire / vintage glowing embers
    // Base layer: warm low-frequency flame air
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.05;
      b1 = 0.985 * b1 + white * 0.08;
      b2 = 0.950 * b2 + white * 0.15;
      data[i] = (b0 + b1 + b2) * 0.08;
    }

    // Crackles and distinct wood snapping pops
    const popCount = duration * 35;
    for (let p = 0; p < popCount; p++) {
      const pos = Math.floor(Math.random() * (bufferSize - 800));
      const popAmp = (Math.random() * 0.65 + 0.25);
      const popFreq = 0.15 + Math.random() * 0.45; // 1kHz to 3kHz crackle tone
      const decay = 25 + Math.random() * 60;
      for (let j = 0; j < 600; j++) {
        data[pos + j] += (Math.sin(j * popFreq) + (Math.random() * 0.4 - 0.2)) * Math.exp(-j / decay) * popAmp;
      }
    }

    // Micro-embers and sizzle
    for (let i = 0; i < bufferSize; i++) {
      if (Math.random() < 0.008) {
        data[i] += (Math.random() * 0.3 - 0.15);
      }
    }

    applyBufferCrossfade(data, sampleRate, bufferSize);

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, audioCtx.currentTime);

    noiseSource.connect(filter);
    filter.connect(ambientGainNode);
    ambientGainNode.gain.setValueAtTime(0.42, audioCtx.currentTime);

    noiseSource.start();
    ambientNodes.push(noiseSource, filter, ambientGainNode);
    ambientSource = noiseSource;
  }
}

/**
 * Smooth crossfade at buffer loop boundaries to eliminate clicks
 */
function applyBufferCrossfade(data, sampleRate, bufferSize) {
  const fadeSamples = Math.floor(sampleRate * 0.06);
  for (let i = 0; i < fadeSamples; i++) {
    const ratio = i / fadeSamples;
    data[i] = data[i] * ratio + data[bufferSize - fadeSamples + i] * (1 - ratio);
    data[bufferSize - fadeSamples + i] = data[i];
  }
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
  sessionBadgeText: document.getElementById('sessionBadgeText'),
  timerTagline: document.getElementById('timerTagline'),

  // Tabs
  tabFocus: document.getElementById('tabFocus'),
  tabShortBreak: document.getElementById('tabShortBreak'),
  tabLongBreak: document.getElementById('tabLongBreak'),
  modeTabs: document.querySelectorAll('.mode-tab'),

  // Ambient Chips
  ambientChips: document.querySelectorAll('.ambient-chip'),

  // Header & Stats
  headerPomoCount: document.getElementById('headerPomoCount'),
  statCompletedSessions: document.getElementById('statCompletedSessions'),
  statTotalMinutes: document.getElementById('statTotalMinutes'),
  statCycleProgress: document.getElementById('statCycleProgress'),

  // Theme Picker
  themePickerBtn: document.getElementById('themePickerBtn'),
  themePaletteDrawer: document.getElementById('themePaletteDrawer'),
  closeThemeDrawerBtn: document.getElementById('closeThemeDrawerBtn'),
  themeOptionCards: document.querySelectorAll('.theme-option-card'),
  settingsThemeSelect: document.getElementById('settingsThemeSelect'),

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
  const isSynth = settings.theme === 'synthwave';
  switch (mode) {
    case 'shortBreak':
      return isSynth ? 'Recharge your cybernetics. Take 5.' : 'Step away, stretch, and refresh your mind.';
    case 'longBreak':
      return isSynth ? 'Horizon reached! Full reboot & cool down.' : 'Great milestone achieved! Rest and recharge.';
    case 'focus':
    default:
      return isSynth ? 'Locked in. Channel the synthwave momentum.' : 'Time to concentrate and build momentum.';
  }
}

function getCircleCircumference() {
  if (!elements.progressCircle) return 879.64;
  const radius = elements.progressCircle.r?.baseVal?.value || 140;
  return 2 * Math.PI * radius;
}

// Update Dynamic Favicon
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
  ctx.fillStyle = '#0B0416';
  ctx.fill();

  const color = mode === 'focus' ? '#FF007F' : (mode === 'shortBreak' ? '#00F0FF' : '#A855F7');
  ctx.beginPath();
  ctx.arc(16, 16, 12, -Math.PI / 2, (-Math.PI / 2) + (fraction * 2 * Math.PI));
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();

  faviconLink.href = faviconCanvas.toDataURL();
}

// =============================================================================
// Theme Switcher Engine
// =============================================================================

function setTheme(themeName) {
  settings.theme = themeName;
  elements.body.setAttribute('data-theme', themeName);

  elements.themeOptionCards.forEach(card => {
    card.classList.toggle('active', card.dataset.theme === themeName);
  });

  if (elements.settingsThemeSelect) {
    elements.settingsThemeSelect.value = themeName;
  }

  saveSettings();
  updateDisplay();
}

function toggleThemeDrawer() {
  elements.themePaletteDrawer.classList.toggle('hidden');
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

  const modeLabels = { focus: '⚡ Focus', shortBreak: '☕ Break', longBreak: '🌴 Long Break' };
  document.title = `${timeFormatted} — ${modeLabels[timerState.mode]} | FocusPulse`;
  updateFavicon(progressRatio, timerState.mode);

  if (timerState.mode === 'focus') {
    elements.sessionBadgeText.textContent = `Focus Session #${timerState.cycleCount}`;
  } else if (timerState.mode === 'shortBreak') {
    elements.sessionBadgeText.textContent = `Short Break (${timerState.cycleCount}/4)`;
  } else {
    elements.sessionBadgeText.textContent = `Long Break Complete`;
  }
  elements.timerTagline.textContent = getModeTagline(timerState.mode);

  elements.modeTabs.forEach(tab => {
    const isActive = tab.dataset.mode === timerState.mode;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive);
  });

  elements.body.setAttribute('data-mode', timerState.mode);

  if (timerState.isRunning) {
    elements.startPauseText.textContent = 'Pause';
    elements.startPauseIcon.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" rx="1.5"></rect>
        <rect x="14" y="4" width="4" height="16" rx="1.5"></rect>
      </svg>
    `;
    elements.body.classList.add('is-running');
  } else {
    elements.startPauseText.textContent = timerState.mode === 'focus' ? 'Start Focus' : 'Start Break';
    elements.startPauseIcon.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    `;
    elements.body.classList.remove('is-running');
  }

  elements.headerPomoCount.textContent = stats.completedSessions;
  elements.statCompletedSessions.textContent = stats.completedSessions;
  elements.statTotalMinutes.textContent = stats.focusMinutes;
  elements.statCycleProgress.textContent = `${timerState.cycleCount}/4`;
}

// =============================================================================
// Timer State Actions
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

function handleTimerCompletion() {
  pauseTimer();

  playAlarmSound(settings.soundTheme);

  if (timerState.mode === 'focus') {
    stats.completedSessions += 1;
    stats.focusMinutes += Math.round(timerState.totalDurationSeconds / 60);
    saveStats();

    showToast('⚡', 'Focus Session Completed!', `Level complete! Round ${timerState.cycleCount} of 4 done.`);

    if (timerState.cycleCount >= 4) {
      switchMode('longBreak');
      if (settings.autoStartBreaks) startTimer();
    } else {
      switchMode('shortBreak');
      if (settings.autoStartBreaks) startTimer();
    }
  } else {
    showToast('🚀', 'Break Ended!', 'Ready to hit the next synthwave streak?');
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
  elements.settingsThemeSelect.value = settings.theme;
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
  setTheme(elements.settingsThemeSelect.value);
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
  setTheme(settings.theme);
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
    showToast('🔊', 'Sound Unmuted', 'Audio alerts and ambient sounds are active.');
  } else {
    showToast('🔇', 'Sound Muted', 'Audio alerts and ambient sounds are silenced.');
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
  // Main Controls
  elements.startPauseBtn.addEventListener('click', toggleStartPause);
  elements.resetBtn.addEventListener('click', resetTimer);
  elements.skipBtn.addEventListener('click', skipPhase);
  elements.plusMinuteBtn.addEventListener('click', () => adjustMinutes(1));
  elements.minusMinuteBtn.addEventListener('click', () => adjustMinutes(-1));

  // Mode Tabs
  elements.modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      if (mode && mode !== timerState.mode) {
        switchMode(mode);
      }
    });
  });

  // Ambient Audio Chips
  elements.ambientChips.forEach(chip => {
    chip.addEventListener('click', () => {
      elements.ambientChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      setAmbientSound(chip.dataset.sound);
    });
  });

  // Theme Switcher Drawer
  elements.themePickerBtn.addEventListener('click', toggleThemeDrawer);
  elements.closeThemeDrawerBtn.addEventListener('click', toggleThemeDrawer);
  elements.themeOptionCards.forEach(card => {
    card.addEventListener('click', () => {
      setTheme(card.dataset.theme);
      showToast('🎨', 'Theme Activated', `Switched to ${card.querySelector('strong').textContent}`);
      elements.themePaletteDrawer.classList.add('hidden');
    });
  });

  // Mute & Settings
  elements.muteToggleBtn.addEventListener('click', toggleMute);
  elements.openSettingsBtn.addEventListener('click', openSettings);
  elements.closeSettingsBtn.addEventListener('click', closeSettings);
  elements.settingsForm.addEventListener('submit', saveSettingsForm);
  elements.resetDefaultsBtn.addEventListener('click', resetSettingsToDefaults);

  // Sound preview test in settings
  elements.previewSoundBtn.addEventListener('click', () => {
    const selectedSound = elements.soundSelect.value;
    playAlarmSound(selectedSound, true);
  });

  // Volume slider in settings
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

  // Toast close
  elements.toastCloseBtn.addEventListener('click', hideToast);

  // Global Keyboard Shortcuts
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
    } else if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      toggleThemeDrawer();
    } else if (e.key === 'Escape') {
      closeSettings();
      hideToast();
      elements.themePaletteDrawer.classList.add('hidden');
    }
  });

  // Close modal when clicking outside dialog backdrop
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
  setTheme(settings.theme || 'synthwave');
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

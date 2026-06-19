const chords = [
  { name: "C", notes: ["C3", "E3", "G3", "C4", "E4"] },
  { name: "D", notes: ["D3", "A3", "D4", "F#4"] },
  { name: "Em", notes: ["E2", "B2", "E3", "G3", "B3", "E4"] },
  { name: "G", notes: ["G2", "B2", "D3", "G3", "B3", "G4"] },
  { name: "Am", notes: ["A2", "E3", "A3", "C4", "E4"] },
  { name: "F", notes: ["F2", "C3", "F3", "A3", "C4", "F4"] },
];

const video = document.querySelector("#camera");
const canvas = document.querySelector("#overlay");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#startButton");
const stageStartButton = document.querySelector("#stageStartButton");
const cameraPrompt = document.querySelector("#cameraPrompt");
const cameraHint = document.querySelector("#cameraHint");
const muteButton = document.querySelector("#muteButton");
const statusEl = document.querySelector("#status");
const chordNameEl = document.querySelector("#chordName");
const fingerCountEl = document.querySelector("#fingerCount");
const strumStateEl = document.querySelector("#strumState");
const speedBar = document.querySelector("#speedBar");
const speedValue = document.querySelector("#speedValue");
const chordGrid = document.querySelector("#chordGrid");

let handLandmarker;
let audioContext;
let masterGain;
let muted = false;
let currentChord = 0;
let lastVideoTime = -1;
let isDetecting = false;
let lastRightY = null;
let lastRightTime = 0;
let lastStrumTime = 0;

const strumThreshold = 0.8;
const strumCooldownMs = 280;
const noteOffsets = {
  C: -9,
  "C#": -8,
  D: -7,
  "D#": -6,
  E: -5,
  F: -4,
  "F#": -3,
  G: -2,
  "G#": -1,
  A: 0,
  "A#": 1,
  B: 2,
};

function setStatus(message) {
  statusEl.textContent = message;
}

function setCameraHint(message) {
  cameraHint.textContent = message;
}

function renderChordGrid() {
  chordGrid.innerHTML = "";
  chords.forEach((chord, index) => {
    const item = document.createElement("button");
    item.className = "chord";
    item.type = "button";
    item.innerHTML = `<span>${index} fingers</span><strong>${chord.name}</strong>`;
    item.addEventListener("click", () => playChord(index));
    chordGrid.append(item);
  });
}

function updateChord(index) {
  currentChord = Math.max(0, Math.min(chords.length - 1, index));
  chordNameEl.textContent = chords[currentChord].name;
  fingerCountEl.textContent = String(currentChord);
  [...chordGrid.children].forEach((node, i) => {
    node.classList.toggle("active", i === currentChord);
  });
}

async function initAudio() {
  if (audioContext) {
    await audioContext.resume();
    return;
  }

  audioContext = new AudioContext();
  masterGain = audioContext.createGain();
  masterGain.gain.value = muted ? 0 : 0.9;
  masterGain.connect(audioContext.destination);
}

function noteToFrequency(note) {
  const [, name, octaveText] = note.match(/^([A-G]#?)(\d)$/);
  const octave = Number(octaveText);
  const semitonesFromA4 = noteOffsets[name] + (octave - 4) * 12;
  return 440 * 2 ** (semitonesFromA4 / 12);
}

function playString(frequency, startTime, velocity, index) {
  const oscillator = audioContext.createOscillator();
  const overtone = audioContext.createOscillator();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.value = frequency;
  oscillator.detune.value = (index - 2) * 2.5;
  overtone.type = "sine";
  overtone.frequency.value = frequency * 2.01;
  overtone.detune.value = -3;

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2600, startTime);
  filter.frequency.exponentialRampToValueAtTime(700, startTime + 0.65);

  const volume = (0.08 + velocity * 0.11) / Math.sqrt(index + 1);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.35);

  oscillator.connect(filter);
  overtone.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  oscillator.start(startTime);
  overtone.start(startTime);
  oscillator.stop(startTime + 1.45);
  overtone.stop(startTime + 1.45);
}

function playChord(index = currentChord, velocity = 1) {
  if (!audioContext) return;

  const now = audioContext.currentTime;
  chords[index].notes.forEach((note, stringIndex) => {
    playString(noteToFrequency(note), now + stringIndex * 0.018, velocity, stringIndex);
  });
}

function countFingers(landmarks, handedness) {
  const fingerTips = [8, 12, 16, 20];
  let count = 0;

  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const isRight = handedness === "Right";
  if (isRight ? thumbTip.x < thumbIp.x : thumbTip.x > thumbIp.x) {
    count += 1;
  }

  for (const tip of fingerTips) {
    if (landmarks[tip].y < landmarks[tip - 2].y) {
      count += 1;
    }
  }

  return count;
}

function maybeStrum(landmarks, now) {
  const wristY = landmarks[0].y;
  if (lastRightY === null) {
    lastRightY = wristY;
    lastRightTime = now;
    return;
  }

  const dt = Math.max(1, now - lastRightTime) / 1000;
  const speed = Math.abs(wristY - lastRightY) / dt;
  lastRightY = wristY;
  lastRightTime = now;

  const normalized = Math.min(1, speed / 2.4);
  speedValue.textContent = speed.toFixed(2);
  speedBar.style.transform = `scaleX(${normalized})`;

  if (speed > strumThreshold && now - lastStrumTime > strumCooldownMs) {
    lastStrumTime = now;
    strumStateEl.textContent = "Strum!";
    playChord(currentChord, normalized);
    window.setTimeout(() => {
      strumStateEl.textContent = "Ready";
    }, 140);
  }
}

function resizeCanvas() {
  const rect = video.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawResults(results) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);

  if (!results.multiHandLandmarks?.length) return;

  for (const landmarks of results.multiHandLandmarks) {
    const mirrored = landmarks.map((point) => ({ ...point, x: 1 - point.x }));
    drawConnectors(ctx, mirrored, HAND_CONNECTIONS, {
      color: "#f2b84b",
      lineWidth: 3,
    });
    drawLandmarks(ctx, mirrored, {
      color: "#4fb6b2",
      fillColor: "#ef5d43",
      lineWidth: 1,
      radius: 4,
    });
  }
}

function loop() {
  if (video.currentTime !== lastVideoTime && !isDetecting) {
    lastVideoTime = video.currentTime;
    isDetecting = true;
    handLandmarker.send({ image: video }).finally(() => {
      isDetecting = false;
    });
  }

  requestAnimationFrame(loop);
}

async function initVision() {
  if (handLandmarker) return;

  setStatus("Loading hand tracker...");

  if (!window.Hands) {
    throw new Error("手势识别脚本没有加载成功，请刷新页面或换 Chrome/Edge 打开。");
  }

  handLandmarker = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`,
  });

  handLandmarker.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.55,
  });

  handLandmarker.onResults((results) => {
    const now = performance.now();
    drawResults(results);

    results.multiHandLandmarks?.forEach((landmarks, index) => {
      const handedness = results.multiHandedness[index].label;
      if (handedness === "Left") {
        updateChord(countFingers(landmarks, handedness));
      } else {
        maybeStrum(landmarks, now);
      }
    });
  });
}

async function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timer);
  }
}

async function checkCameraDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { available: true, count: -1 };
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === "videoinput");
    return {
      available: videoDevices.length > 0,
      count: videoDevices.length,
      devices: videoDevices
    };
  } catch (e) {
    console.warn("无法枚举设备:", e);
    return { available: true, count: -1 };
  }
}

async function start() {
  startButton.disabled = true;
  stageStartButton.disabled = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("当前浏览器不支持摄像头。请使用 Chrome 或 Edge 浏览器打开 http://localhost:8000/web/");
    }

    setCameraHint("正在检查摄像头设备...");
    const cameraInfo = await checkCameraDevices();
    
    if (!cameraInfo.available) {
      throw new Error("未检测到摄像头设备。请确保摄像头已连接并正常工作。");
    }

    setCameraHint("正在请求摄像头权限。请在浏览器弹窗里点击「允许」。");
    await initAudio();
    
    const constraints = {
      video: { 
        width: { ideal: 1280, max: 1920 }, 
        height: { ideal: 720, max: 1080 }, 
        facingMode: "user" 
      },
      audio: false,
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    
    await video.play().catch(e => {
      console.warn("视频播放警告:", e);
    });
    
    resizeCanvas();
    setCameraHint("摄像头已开启，正在加载手势识别...");
    setStatus("Camera is on. Loading hand tracker...");
    
    await withTimeout(
      initVision(),
      20000,
      "手势识别模型加载超时。摄像头已开启，但当前网络可能无法连接到 MediaPipe 模型资源。",
    );
    
    cameraPrompt.classList.add("hidden");
    setStatus("Tracking hands. Left hand chooses chords; right hand strums.");
    requestAnimationFrame(loop);
    
  } catch (error) {
    console.error("摄像头初始化失败:", error);
    let message = "";
    
    if (error.name === "NotAllowedError") {
      message = "摄像头权限被拒绝了。\n\n解决方法：\n1. 点击浏览器地址栏左侧的锁图标\n2. 在「摄像头」选项中选择「允许」\n3. 刷新页面";
    } else if (error.name === "NotFoundError") {
      message = "未找到可用的摄像头设备。\n\n请确保：\n1. 摄像头已正确连接\n2. 没有其他应用正在使用摄像头\n3. 摄像头驱动已正确安装";
    } else if (error.name === "NotReadableError") {
      message = "摄像头无法读取。可能被其他应用占用。\n\n请关闭其他使用摄像头的应用后重试。";
    } else {
      message = `无法开启摄像头：${error.message}\n\n请检查浏览器控制台获取更多信息。`;
    }
    
    setStatus(message);
    setCameraHint(message);
    startButton.disabled = false;
    stageStartButton.disabled = false;
  }
}

muteButton.addEventListener("click", () => {
  muted = !muted;
  muteButton.textContent = muted ? "Unmute" : "Mute";
  muteButton.setAttribute("aria-pressed", String(muted));
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.9;
});

startButton.addEventListener("click", start);
stageStartButton.addEventListener("click", start);
window.addEventListener("resize", resizeCanvas);

renderChordGrid();
updateChord(0);

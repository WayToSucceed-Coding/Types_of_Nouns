// Screen Management
const screens = {
  welcome: document.getElementById('welcome-screen'),
  loading: document.getElementById('loading-screen'),
  game: document.getElementById('game-screen')
};

// Loading Messages
const loadingMessages = [
  "Preheating the oven...",
  "Gathering ingredients...",
  "Mixing the batter...",
  "Preparing the frosting...",
  "Almost ready to bake!"
];

// Show specific screen
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
  
  if (screenName === 'game') {
    initGame();
    // Start background music only when entering game screen
    if (!isMuted) {
      audio.background.currentTime = 0;
      audio.background.play().catch(error => {
        console.log('Background music play failed:', error);
      });
    }
    // Start the game loop immediately
    lastTime = null;
    gameLoop = requestAnimationFrame(gameUpdate);
  } else {
    // Stop background music when leaving game screen
    audio.background.pause();
    audio.background.currentTime = 0;
  }
}

// Loading sequence
async function startLoading() {
  showScreen('loading');
  const loadingText = document.querySelector('.loading-text');
  
  // Initialize loading animation immediately
  if (!loadingAnimation) {
    loadingAnimation = lottie.loadAnimation({
      container: document.querySelector('.loading-animation'),
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'assets/cake.json'
    });
  }
  
  // Show different loading messages
  for (let i = 0; i < loadingMessages.length; i++) {
    loadingText.textContent = loadingMessages[i];
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Simulate loading assets
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Show game screen
  showScreen('game');
}

// Event Listeners
document.getElementById('start-btn').addEventListener('click', () => {
  playSound('background');
  startLoading();
});

// Game configuration
const GAME_CONFIG = {
  initialFallingSpeed: 0.15,
  spawnInterval: 8000,
  speedIncreasePerCake: 0.02,
  speedIncreaseThreshold: 5,
  speedIncreaseAmount: 0.05,
  maxSpeed: 0.6,
  objectWidth: 100,
  objectHeight: 40,
  fontSize: 16,
  colors: [
    '#FF9EAA',
    '#FFB6C1',
    '#FFC0CB',
    '#FFB7C5'
  ],
  cakesPerLevel: 10
};

const WORDS = {
  "Proper Noun": [
    "London", "Microsoft", "Jupiter", "Amazon", "Nike",
    "Sarah", "India", "Google", "Mars", "Disney",
    "Paris", "Tesla", "Venus", "Netflix", "Toyota"
  ],
  "Common Noun": [
    "cat", "book", "tree", "house", "phone",
    "dog", "city", "car", "computer", "flower",
    "table", "bird", "school", "chair", "pencil"
  ],
  "Collective Noun": [
    "team", "flock", "group", "family", "crowd",
    "herd", "class", "choir", "fleet", "pack",
    "bunch", "crew", "swarm", "band", "staff"
  ],
  "Abstract Noun": [
    "love", "happiness", "freedom", "courage", "wisdom",
    "peace", "joy", "hope", "faith", "success",
    "anger", "fear", "beauty", "time", "truth"
  ]
};

let gameState = {
  currentWordIndex: 0,
  cakeLayers: 0,
  cakesMade: 0,
  baseSpeed: GAME_CONFIG.initialFallingSpeed,
  currentSpeed: GAME_CONFIG.initialFallingSpeed,
  currentWord: null,
  objects: [],
  gameActive: true,
  score: 0,
  cursor: {
    x: 0,
    y: 0,
    clicking: false
  },
  spawnTimer: null,
  speedIncreased: false
};

// Initialize canvas and context
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const cursor = document.getElementById("game-cursor");

// Set canvas size
function resizeCanvas() {
  const gameArea = document.getElementById("game-area");
  canvas.width = gameArea.clientWidth;
  canvas.height = gameArea.clientHeight;
}

// Initialize game elements
document.getElementById("cake-count").innerText = gameState.cakesMade;

// Speech synthesis
function speakWord() {
  if (gameState.currentWord) {
    const utterance = new SpeechSynthesisUtterance(gameState.currentWord.word);
    speechSynthesis.speak(utterance);
  }
}

// Select a random word from the current type
function getRandomWord() {
  const types = Object.keys(WORDS);
  const randomType = types[Math.floor(Math.random() * types.length)];
  const words = WORDS[randomType];
  const word = words[Math.floor(Math.random() * words.length)];
  return { word, type: randomType };
}

function nextWord() {
  console.log('Getting next word');
  const newWord = getRandomWord();
  console.log('New word selected:', newWord);
  gameState.currentWord = newWord;
  document.getElementById("current-word").innerText = newWord.word;
  createFallingObjects();
}

// Helper hand functionality
function showHelpingHand(targetX, targetY) {
  const hand = document.getElementById('helping-hand');
  hand.style.left = `${targetX}px`;
  hand.style.top = `${targetY}px`;
  hand.classList.add('visible');
  
  setTimeout(() => {
    hand.classList.remove('visible');
  }, 3000);
}

function createFallingObjects() {
  if (!gameState.gameActive) return;

  const types = Object.keys(WORDS);
  const otherTypes = types.filter(type => type !== gameState.currentWord.type);
  const shuffledOtherTypes = otherTypes.sort(() => 0.5 - Math.random());

  // Always include the correct type and two random different types
  const usedTypes = [
    gameState.currentWord.type,
    ...shuffledOtherTypes.slice(0, 2)
  ];

  // Shuffle the position of the correct answer
  usedTypes.sort(() => 0.5 - Math.random());

  // Create new objects with proper spacing
  const spacing = canvas.width / 4;
  
  gameState.objects = usedTypes.map((type, index) => ({
    x: spacing * (index + 1) - GAME_CONFIG.objectWidth / 2,
    y: -GAME_CONFIG.objectHeight, // Start slightly above the screen
    type: type,
    width: GAME_CONFIG.objectWidth,
    height: GAME_CONFIG.objectHeight,
    color: GAME_CONFIG.colors[index],
    speed: gameState.currentSpeed,
    opacity: 1
  }));
}

let gameLoop;
let lastTime;

function gameUpdate(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const deltaTime = (timestamp - lastTime) / 16.67; // normalize to 60fps
  lastTime = timestamp;

  if (!gameState.gameActive) return;

  // If no objects exist, create new ones immediately
  if (gameState.objects.length === 0) {
    createFallingObjects();
  }

  // Update positions
  for (let i = gameState.objects.length - 1; i >= 0; i--) {
    const obj = gameState.objects[i];
    obj.y += (gameState.currentSpeed * 3) * deltaTime;
    
    // If object reaches bottom
    if (obj.y > canvas.height) {
      if (obj.type === gameState.currentWord.type) {
        showMessage("Oh no! The correct answer got away!", "error");
        resetCakeLayers();
        gameState.currentSpeed = GAME_CONFIG.initialFallingSpeed;
      }
      // Remove the object that reached bottom
      gameState.objects.splice(i, 1);
    }
  }

  // Draw everything
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw falling objects
  gameState.objects.forEach(obj => {
    ctx.save();
    ctx.globalAlpha = obj.opacity;
    
    // Enhanced shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    // Create gradient background
    const gradient = ctx.createLinearGradient(obj.x, obj.y, obj.x, obj.y + obj.height);
    gradient.addColorStop(0, obj.color);
    gradient.addColorStop(1, adjustColor(obj.color, -15)); // Slightly darker at bottom

    // Draw main rounded rectangle with gradient
    ctx.beginPath();
    ctx.roundRect(obj.x, obj.y, obj.width, obj.height, 10);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Add subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Add top highlight
    ctx.beginPath();
    ctx.roundRect(obj.x + 2, obj.y + 2, obj.width - 4, obj.height/4, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();

    // Draw text with enhanced styling
    ctx.fillStyle = "#2D3748";
    ctx.font = `600 ${GAME_CONFIG.fontSize}px Quicksand`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Text shadow for better readability
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    
    const words = obj.type.split(' ');
    if (words.length > 1) {
      words.forEach((word, i) => {
        ctx.fillText(word, obj.x + obj.width/2, obj.y + obj.height/2 + (i - words.length/2 + 0.5) * (GAME_CONFIG.fontSize + 1));
      });
    } else {
      ctx.fillText(obj.type, obj.x + obj.width/2, obj.y + obj.height/2);
    }
    ctx.restore();
  });

  // Continue the game loop
  gameLoop = requestAnimationFrame(gameUpdate);
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(45, 52, 54, 0.05)';
  ctx.lineWidth = 1;
  
  // Draw vertical lines
  for (let x = 0; x < canvas.width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  
  // Draw horizontal lines
  for (let y = 0; y < canvas.height; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function checkCollisions(e) {
  if (!gameState.gameActive) return;

  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  for (let i = gameState.objects.length - 1; i >= 0; i--) {
    const obj = gameState.objects[i];
    
    if (clickX >= obj.x && 
        clickX <= obj.x + obj.width && 
        clickY >= obj.y && 
        clickY <= obj.y + obj.height) {
      
      if (obj.type === gameState.currentWord.type) {
        // Remove clicked object before handling correct hit
        gameState.objects.splice(i, 1);
        handleCorrectHit();
      } else {
        handleIncorrectHit();
      }
      break;
    }
  }
}

// Sound Management
const audio = {
  background: document.getElementById('bgMusic'),
  correct: document.getElementById('correctSound'),
  wrong: document.getElementById('wrongSound'),
  cakeReady: document.getElementById('cakeReadySound')
};

// Set volume levels
audio.background.volume = 0.3;
audio.correct.volume = 0.5;
audio.wrong.volume = 0.5;
audio.cakeReady.volume = 0.6;

let isMuted = false;

function toggleMute() {
  isMuted = !isMuted;
  Object.values(audio).forEach(sound => {
    sound.muted = isMuted;
  });
  
  // Update sound icon
  const soundIcon = document.getElementById('sound-icon');
  if (soundIcon) {
    soundIcon.className = isMuted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
  }
}

function playSound(soundName) {
  if (!isMuted && audio[soundName]) {
    audio[soundName].currentTime = 0;
    audio[soundName].play().catch(error => {
      console.log('Sound play failed:', error);
    });
  }
}

// Start background music when game starts
document.getElementById('start-btn').removeEventListener('click', () => {
  playSound('background');
});

function handleCorrectHit() {
  gameState.score += 100;
  gameState.cakeLayers++;
  showMessage("Great job! Keep going!", "success");
  playSound('correct');

  // Calculate animation segments based on total frames (60 frames total)
  const totalFrames = 60;
  
  if(gameState.cakeLayers == 1){
    startFrame = 0;
    endFrame = 8;
  }
  else if(gameState.cakeLayers == 2){
    startFrame = 7;
    endFrame = 8.001;
  }
  else if(gameState.cakeLayers == 3){
    startFrame = 8;
    endFrame = 20;
    // Play cake ready sound when all layers are complete
    playSound('cakeReady');
  }

  // Show and play the segment of animation
  const progressContainer = document.querySelector('.cake-progress-animation');
  if (!progressContainer) {
    console.error('Progress animation container not found!');
    return;
  }
  progressContainer.classList.add('show');
  
  if (!progressAnimation) {
    console.error('Progress animation not initialized!');
    return;
  }
  
  try {
    progressAnimation.playSegments([startFrame, endFrame], true);
    
    if (gameState.cakeLayers < 3) {
      progressAnimation.goToAndStop(endFrame, true);
    } else {
      progressAnimation.playSegments([0, totalFrames], true);
      completeCake();
    }
  } catch (error) {
    console.error('Error playing animation:', error);
  }

  if (gameState.cakeLayers < 4) {
    gameState.objects = [];
    nextWord();
  }
}

function handleIncorrectHit() {
  showMessage("Try again! That's not the right type.", "error");
  playSound('wrong');
  resetCakeLayers();
}

function completeCake() {
  gameState.cakesMade++;
  localStorage.setItem("cakesMade", gameState.cakesMade);
  document.getElementById("cake-count").innerText = gameState.cakesMade;
  
  showCelebrationText('Cake Complete!');
  playSound('cakeReady');
  gameState.score += 500;
  
  // Add disappearing animation to cake layers
  const cakeLayers = document.querySelectorAll('.cake-layer');
  cakeLayers.forEach((layer, index) => {
    // Add cake number to each layer before disappearing
    const cakeNumber = document.createElement('div');
    cakeNumber.className = 'cake-number';
    cakeNumber.textContent = index + 1;
    layer.insertBefore(cakeNumber, layer.firstChild);
    
    setTimeout(() => {
      layer.classList.add('disappear');
    }, index * 200);
  });
  
  // Wait for animations to complete before resetting
  setTimeout(() => {
    const progressContainer = document.querySelector('.cake-progress-animation');
    progressContainer.classList.remove('show');
    gameState.cakeLayers = 0;
    gameState.objects = [];
    nextWord();
    showMessage("Read the new word and match it!", "info");
  }, 1500);
}

function resetCakeLayers() {
  // Reset animation to empty state
  const progressContainer = document.querySelector('.cake-progress-animation');
  progressAnimation.goToAndStop(0, true);
  
  // Add shake animation to cake layers before removing
  const cakeProgress = document.getElementById("cake-progress");
  cakeProgress.style.animation = "shake 0.5s ease-in-out";
  
  setTimeout(() => {
    gameState.cakeLayers = 0;
    cakeProgress.innerHTML = "";
    cakeProgress.style.animation = "";
  }, 500);
}

function updateCake() {
  const cake = document.createElement("div");
  cake.className = "cake-layer";
  
  const colors = ["#8B4513", "#FF69B4", "#FFB6C1", "#FF0000"]; // Brown, Pink, Light Pink, Red
  cake.style.backgroundColor = colors[gameState.cakeLayers - 1];
  
  const layers = ["Chocolate Base", "Strawberry Cream", "Vanilla Frosting", "Cherry Top"];
  cake.innerText = layers[gameState.cakeLayers - 1];
  
  document.getElementById("cake-progress").appendChild(cake);
}

function showMessage(text, type) {
  const message = document.getElementById("message");
  message.innerText = text;
  message.className = "game-message " + type;
  
  // Animate message
  message.style.animation = "none";
  message.offsetHeight; // Trigger reflow
  message.style.animation = "popMessage 0.5s ease-out";
  
  // Clear message after delay unless it's an info message
  if (type !== "info") {
    setTimeout(() => {
      message.className = "game-message";
      message.innerText = "";
    }, 2000);
  }
}

// Mouse event handlers
canvas.addEventListener("click", (e) => {
  if (!gameState.gameActive) return;
  checkCollisions(e);
});

function initGame() {
  console.log('Initializing game...');
  if (gameLoop) {
    cancelAnimationFrame(gameLoop);
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  lastTime = null;

  gameState = {
    currentWordIndex: 0,
    cakeLayers: 0,
    cakesMade: 0,
    currentSpeed: GAME_CONFIG.initialFallingSpeed,
    currentWord: null,
    objects: [],
    gameActive: true,
    score: 0,
    speedIncreased: false
  };

  document.getElementById("cake-count").innerText = gameState.cakesMade;
  
  nextWord();
  createFallingObjects(); // Create initial falling objects
  showMessage("Select the matching noun type!", "info");
}

// Help overlay management
function toggleHelp() {
  const overlay = document.getElementById('help-overlay');
  overlay.classList.toggle('visible');
}

function closeHelp() {
  const overlay = document.getElementById('help-overlay');
  overlay.classList.remove('visible');
}

// Create celebration text element
const celebrationText = document.createElement('div');
celebrationText.className = 'celebration-text';
document.body.appendChild(celebrationText);

function showCelebrationText(text) {
  const celebrationContainer = document.createElement('div');
  celebrationContainer.className = 'celebration-text';

  // Add left cake image
  const leftCake = document.createElement('div');
  leftCake.className = 'celebration-cake-number';
  celebrationContainer.appendChild(leftCake);

  // Add the celebration text
  const textSpan = document.createElement('span');
  textSpan.textContent = text;
  celebrationContainer.appendChild(textSpan);

  // Add right cake image
  const rightCake = document.createElement('div');
  rightCake.className = 'celebration-cake-number';
  celebrationContainer.appendChild(rightCake);

  // Remove any existing celebration text
  const existingCelebration = document.querySelector('.celebration-text');
  if (existingCelebration) {
    existingCelebration.remove();
  }

  document.body.appendChild(celebrationContainer);
  celebrationContainer.classList.add('show');

  // Remove the celebration text after animation
  setTimeout(() => {
    celebrationContainer.remove();
  }, 2000);
}

// Initialize Lottie animations
let welcomeAnimation, loadingAnimation, progressAnimation;

function initAnimations() {
  console.log('Initializing animations...');

  // Progress animation (hidden initially)
  const progressContainer = document.querySelector('.cake-progress-animation');
  if (!progressContainer) {
    console.error('Progress animation container not found during initialization!');
    return;
  }

  progressAnimation = lottie.loadAnimation({
    container: progressContainer,
    renderer: 'svg',
    loop: false,
    autoplay: false,
    path: 'assets/cake.json'
  });
  
  // Set initial state of progress animation
  if (progressAnimation) {
    progressAnimation.goToAndStop(0, true);
    console.log('Progress animation initialized successfully');
  } else {
    console.error('Failed to initialize progress animation');
  }
}

// Preload the Lottie JSON file
function preloadLottieAnimation() {
  return fetch('assets/cake.json')
    .then(response => response.json())
    .catch(error => console.error('Error preloading animation:', error));
}

// Make sure animations are initialized when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Document loaded, initializing game...');
  // Preload the animation file
  preloadLottieAnimation();
  initAnimations();
});

// Add event listener for visibility change to handle background music
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.background.pause();
  } else {
    if (!isMuted) {
      audio.background.play().catch(() => {});
    }
  }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  Object.values(audio).forEach(sound => {
    sound.pause();
    sound.currentTime = 0;
  });
});

// Helper function to adjust color brightness
function adjustColor(color, amount) {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return '#' + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

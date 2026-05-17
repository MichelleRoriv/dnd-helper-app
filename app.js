const CHARACTER_STORAGE_KEY = "dnd-helper.character";
const LEGACY_XP_STORAGE_KEY = "xp";
const LEVEL_UP_MESSAGE_DURATION_MS = 3000;
const LEVEL_UP_MESSAGE_ANIMATION_MS = 250;

// Tabla oficial de XP de D&D 5e. La posición del umbral determina el nivel.
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000,
  305000, 355000
];

const defaultCharacter = {
  xp: 0,
  level: 1
};

const elements = {
  xpDisplay: document.getElementById("xpDisplay"),
  levelDisplay: document.getElementById("levelDisplay"),
  progressDisplay: document.getElementById("progressDisplay"),
  progressFill: document.getElementById("progressFill"),
  levelUpMessage: document.getElementById("levelUpMessage"),
  xpInput: document.getElementById("xpInput"),
  addXpButton: document.getElementById("addXpButton")
};

// Estado principal en memoria. Cada cambio relevante se guarda en localStorage.
let character = loadCharacter();
let levelUpMessageTimeoutId = null;
let levelUpMessageClearTimeoutId = null;

function loadCharacter() {
  const storedCharacter = localStorage.getItem(CHARACTER_STORAGE_KEY);

  if (storedCharacter) {
    try {
      const parsedCharacter = JSON.parse(storedCharacter);
      const xp = normalizeXp(parsedCharacter.xp);

      // El nivel se recalcula desde la XP para evitar datos guardados inconsistentes.
      return {
        xp,
        level: getLevelFromXp(xp)
      };
    } catch (error) {
      return { ...defaultCharacter };
    }
  }

  // Mantiene compatibilidad con pruebas anteriores que guardaban solo "xp".
  const legacyXp = normalizeXp(localStorage.getItem(LEGACY_XP_STORAGE_KEY));

  return {
    xp: legacyXp,
    level: getLevelFromXp(legacyXp)
  };
}

function saveCharacter() {
  localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(character));
}

// Convierte cualquier entrada a una XP valida para evitar NaN o valores negativos.
function normalizeXp(value) {
  const xp = Number(value);

  if (!Number.isFinite(xp) || xp < 0) {
    return 0;
  }

  return Math.trunc(xp);
}

function getLevelFromXp(xp) {
  // Se recorre desde el nivel mas alto para encontrar el umbral alcanzado.
  for (let index = XP_THRESHOLDS.length - 1; index >= 0; index--) {
    if (xp >= XP_THRESHOLDS[index]) {
      return index + 1;
    }
  }

  return 1;
}

function getNextLevelXp(level) {
  // En nivel maximo no existe un siguiente umbral, asi que se usa el tope final.
  if (level >= XP_THRESHOLDS.length) {
    return XP_THRESHOLDS[XP_THRESHOLDS.length - 1];
  }

  return XP_THRESHOLDS[level];
}

function getProgressPercent(xp, requiredXp) {
  if (requiredXp <= 0) {
    return 0;
  }

  return Math.min((xp / requiredXp) * 100, 100);
}

function updateDisplay() {
  const requiredXp = getNextLevelXp(character.level);
  const progressPercent = getProgressPercent(character.xp, requiredXp);

  elements.xpDisplay.textContent = `XP: ${character.xp}`;
  elements.levelDisplay.textContent = `Nivel: ${character.level}`;
  elements.progressDisplay.textContent = `${character.xp} / ${requiredXp} XP`;
  elements.progressFill.style.width = `${progressPercent}%`;
}

function showLevelUpMessage(level) {
  if (levelUpMessageTimeoutId) {
    clearTimeout(levelUpMessageTimeoutId);
  }

  if (levelUpMessageClearTimeoutId) {
    clearTimeout(levelUpMessageClearTimeoutId);
    levelUpMessageClearTimeoutId = null;
  }

  elements.levelUpMessage.textContent = `Subiste al nivel ${level}!`;
  elements.levelUpMessage.classList.remove("isHidden");

  // La duracion del snackbar se controla desde LEVEL_UP_MESSAGE_DURATION_MS.
  levelUpMessageTimeoutId = setTimeout(clearLevelUpMessage, LEVEL_UP_MESSAGE_DURATION_MS);
}

function clearLevelUpMessage() {
  if (levelUpMessageTimeoutId) {
    clearTimeout(levelUpMessageTimeoutId);
    levelUpMessageTimeoutId = null;
  }

  elements.levelUpMessage.classList.add("isHidden");

  // Se borra el texto despues del fade-out para que la salida no se corte.
  levelUpMessageClearTimeoutId = setTimeout(() => {
    elements.levelUpMessage.textContent = "";
    levelUpMessageClearTimeoutId = null;
  }, LEVEL_UP_MESSAGE_ANIMATION_MS);
}

function addXP() {
  const xpToAdd = normalizeXp(elements.xpInput.value);

  // Ignora entradas vacias, cero o invalidas para no crear cambios accidentales.
  if (xpToAdd <= 0) {
    return;
  }

  const previousLevel = character.level;
  const newXp = character.xp + xpToAdd;
  const newLevel = getLevelFromXp(newXp);

  character = {
    xp: newXp,
    level: newLevel
  };

  saveCharacter();
  updateDisplay();

  // El mensaje solo aparece cuando la nueva XP cruza al menos un umbral de nivel.
  if (newLevel > previousLevel) {
    showLevelUpMessage(newLevel);
  } else {
    clearLevelUpMessage();
  }

  elements.xpInput.value = "";
}

function handleXpInputKeydown(event) {
  if (event.key === "Enter") {
    addXP();
  }
}

elements.xpInput.addEventListener("keydown", handleXpInputKeydown);
elements.addXpButton.addEventListener("click", addXP);

saveCharacter();
updateDisplay();

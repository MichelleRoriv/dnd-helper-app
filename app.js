const CHARACTER_STORAGE_KEY = "dnd-helper.character";
const SESSIONS_STORAGE_KEY = "dnd-helper.sessions";
const LEGACY_XP_STORAGE_KEY = "xp";
const LEVEL_UP_MESSAGE_DURATION_MS = 3000;
const LEVEL_UP_MESSAGE_ANIMATION_MS = 250;
// Cantidad maxima de acciones de XP que se pueden deshacer.
const XP_UNDO_LIMIT = 3;
const XP_INPUT_MAX_DIGITS = 6;
const SESSION_SUMMARY_MAX_LENGTH = 80;

// Tabla oficial de XP de D&D 5e. La posición del umbral determina el nivel.
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000,
  305000, 355000
];

const XP_MAX_TOTAL = XP_THRESHOLDS[XP_THRESHOLDS.length - 1];

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
  addXpButton: document.getElementById("addXpButton"),
  undoXpButton: document.getElementById("undoXpButton"),
  sessionNotes: document.getElementById("sessionNotes"),
  saveSessionButton: document.getElementById("saveSessionButton"),
  sessionStatus: document.getElementById("sessionStatus"),
  sessionList: document.getElementById("sessionList"),
  sessionDetail: document.getElementById("sessionDetail")
};

// Estado principal en memoria. Cada cambio relevante se guarda en localStorage.
let character = loadCharacter();
let sessions = loadSessions();
// Historial temporal para corregir errores durante la sesion actual.
let xpUndoHistory = [];
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

function loadSessions() {
  const storedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);

  if (!storedSessions) {
    return [];
  }

  try {
    const parsedSessions = JSON.parse(storedSessions);
    return Array.isArray(parsedSessions) ? parsedSessions : [];
  } catch (error) {
    return [];
  }
}

function saveSessions() {
  localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
}

function createSession(notes) {
  return {
    id: `session-${Date.now()}`,
    date: new Date().toISOString(),
    notes
  };
}

function getSessionsSortedByNewest() {
  // Se ordena una copia para no alterar el orden original guardado en memoria.
  return [...sessions].sort((firstSession, secondSession) => {
    return new Date(secondSession.date).getTime() - new Date(firstSession.date).getTime();
  });
}

function formatSessionDate(date) {
  return new Date(date).toLocaleString();
}

function getSessionSummary(notes) {
  // El resumen muestra solo los primeros caracteres, sin modificar la nota completa guardada.
  if (notes.length <= SESSION_SUMMARY_MAX_LENGTH) {
    return notes;
  }

  return `${notes.slice(0, SESSION_SUMMARY_MAX_LENGTH)}...`;
}

function renderSessionList() {
  const sortedSessions = getSessionsSortedByNewest();
  elements.sessionList.replaceChildren();

  if (sortedSessions.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "sessionEmpty";
    emptyItem.textContent = "Todavia no hay sesiones guardadas.";
    elements.sessionList.appendChild(emptyItem);
    return;
  }

  sortedSessions.forEach((session) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const date = document.createElement("span");
    const summary = document.createElement("span");

    button.type = "button";
    button.className = "sessionItem";
    button.dataset.sessionId = session.id;

    date.className = "sessionDate";
    date.textContent = formatSessionDate(session.date);

    summary.className = "sessionSummary";
    summary.textContent = getSessionSummary(session.notes);

    button.append(date, summary);
    item.appendChild(button);
    elements.sessionList.appendChild(item);
  });
}

function showSessionDetail(sessionId) {
  const selectedSession = sessions.find((session) => session.id === sessionId);

  if (!selectedSession) {
    return;
  }

  elements.sessionDetail.textContent = selectedSession.notes;
}

// Convierte cualquier entrada a una XP valida para evitar NaN o valores negativos.
function normalizeXp(value) {
  const xp = Number(value);

  if (!Number.isFinite(xp) || xp < 0) {
    return 0;
  }

  return Math.min(Math.trunc(xp), XP_MAX_TOTAL);
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
  updateUndoButton();
  updateAddXpButton();
}

function updateUndoButton() {
  elements.undoXpButton.disabled = xpUndoHistory.length === 0;
}

function saveXpSnapshotForUndo() {
  xpUndoHistory.push(character.xp);

  // El limite configurable evita que el historial crezca mas de lo necesario.
  if (xpUndoHistory.length > XP_UNDO_LIMIT) {
    xpUndoHistory.shift();
  }
}

function isValidXpInput(value) {
  const trimmedValue = value.trim();
  const xpToAdd = Number(trimmedValue);

  // Acepta enteros positivos de maximo 6 digitos mientras todavia se pueda ganar XP.
  return /^\d+$/.test(trimmedValue)
    && trimmedValue.length <= XP_INPUT_MAX_DIGITS
    && xpToAdd > 0
    && character.xp < XP_MAX_TOTAL;
}

function updateAddXpButton() {
  elements.addXpButton.disabled = !isValidXpInput(elements.xpInput.value);
}

function updateSaveSessionButton() {
  elements.saveSessionButton.disabled = elements.sessionNotes.value.trim().length === 0;
}

function handleXpInputChange() {
  const sanitizedValue = elements.xpInput.value.replace(/\D/g, "").slice(0, XP_INPUT_MAX_DIGITS);

  if (elements.xpInput.value !== sanitizedValue) {
    elements.xpInput.value = sanitizedValue;
  }

  updateAddXpButton();
}

function handleSessionNotesInput() {
  updateSaveSessionButton();
  elements.sessionStatus.textContent = "";
}

function saveSession() {
  const notes = elements.sessionNotes.value.trim();

  if (notes.length === 0) {
    return;
  }

  // Se guarda la nota recortada para evitar espacios accidentales al inicio o final.
  const session = createSession(notes);
  sessions.push(session);
  saveSessions();

  elements.sessionNotes.value = "";
  elements.sessionStatus.textContent = "Sesion guardada.";
  updateSaveSessionButton();
  renderSessionList();
  showSessionDetail(session.id);
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
  // Protege tambien el flujo por teclado, no solo el estado visual del boton.
  if (!isValidXpInput(elements.xpInput.value)) {
    return;
  }

  const xpToAdd = Number(elements.xpInput.value);
  const previousLevel = character.level;
  // Si el usuario ingresa mas XP de la necesaria, se limita al maximo de la tabla.
  const newXp = Math.min(character.xp + xpToAdd, XP_MAX_TOTAL);
  const newLevel = getLevelFromXp(newXp);

  saveXpSnapshotForUndo();

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
  updateAddXpButton();
}

function undoXP() {
  if (xpUndoHistory.length === 0) {
    return;
  }

  const restoredXp = xpUndoHistory.pop();

  character = {
    xp: restoredXp,
    level: getLevelFromXp(restoredXp)
  };

  clearLevelUpMessage();
  saveCharacter();
  updateDisplay();
}

function handleXpInputKeydown(event) {
  if (event.key === "Enter") {
    addXP();
  }
}

function handleSessionListClick(event) {
  const selectedButton = event.target.closest("[data-session-id]");

  if (!selectedButton) {
    return;
  }

  showSessionDetail(selectedButton.dataset.sessionId);
}

elements.xpInput.addEventListener("input", handleXpInputChange);
elements.xpInput.addEventListener("keydown", handleXpInputKeydown);
elements.addXpButton.addEventListener("click", addXP);
elements.undoXpButton.addEventListener("click", undoXP);
elements.sessionNotes.addEventListener("input", handleSessionNotesInput);
elements.saveSessionButton.addEventListener("click", saveSession);
elements.sessionList.addEventListener("click", handleSessionListClick);

saveCharacter();
updateDisplay();
updateAddXpButton();
updateSaveSessionButton();
renderSessionList();

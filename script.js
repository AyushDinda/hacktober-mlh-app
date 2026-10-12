const STORAGE_KEY = "daymark-mood-entries";
const MAX_NOTE_LENGTH = 180;

const MOODS = {
  happy: { label: "Happy", emoji: "😊" },
  okay: { label: "Okay", emoji: "😐" },
  sad: { label: "Sad", emoji: "😔" },
  angry: { label: "Angry", emoji: "😡" },
  tired: { label: "Tired", emoji: "😴" },
};

const form = document.querySelector("#mood-form");
const moodOptions = [...document.querySelectorAll("[data-mood]")];
const noteInput = document.querySelector("#mood-note");
const characterCount = document.querySelector("#character-count");
const formMessage = document.querySelector("#form-message");
const saveLabel = document.querySelector("#save-label");
const historyList = document.querySelector("#history-list");
const today = getLocalDateKey(new Date());
let selectedMood = "";
let entries = readEntries();

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date()).toUpperCase();

const todayEntry = entries.find((entry) => entry.date === today);
if (todayEntry) {
  setSelectedMood(todayEntry.mood);
  noteInput.value = todayEntry.note;
  saveLabel.textContent = "Update today's check-in";
  showMessage("You've already checked in today. You can update your entry.");
}

updateCharacterCount();
render();

moodOptions.forEach((button) => {
  button.addEventListener("click", () => {
    setSelectedMood(button.dataset.mood);
    formMessage.textContent = "";
    formMessage.classList.remove("error");
  });
});

noteInput.addEventListener("input", updateCharacterCount);

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!selectedMood || !MOODS[selectedMood]) {
    showMessage("Choose the mood that feels closest to today.", true);
    moodOptions[0].focus();
    return;
  }

  const existingIndex = entries.findIndex((entry) => entry.date === today);
  const wasUpdate = existingIndex !== -1;
  const entry = {
    date: today,
    mood: selectedMood,
    note: noteInput.value.trim().slice(0, MAX_NOTE_LENGTH),
  };

  if (wasUpdate) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  entries.sort((first, second) => second.date.localeCompare(first.date));
  render();

  if (writeEntries()) {
    showMessage(wasUpdate ? "Today's check-in has been updated." : "Today's check-in is saved. Nice job showing up for yourself.");
  } else {
    showMessage("Saved for this visit, but browser storage is unavailable.", true);
  }

  saveLabel.textContent = "Update today's check-in";
});

historyList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-date]");
  if (!deleteButton) return;

  entries = entries.filter((entry) => entry.date !== deleteButton.dataset.deleteDate);
  render();

  if (writeEntries()) {
    showMessage("That check-in has been deleted.");
  } else {
    showMessage("Deleted for this visit, but browser storage is unavailable.", true);
  }
});

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readEntries() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];

    const uniqueEntries = new Map();
    stored.forEach((entry) => {
      if (
        entry &&
        /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
        Object.hasOwn(MOODS, entry.mood)
      ) {
        uniqueEntries.set(entry.date, {
          date: entry.date,
          mood: entry.mood,
          note: typeof entry.note === "string" ? entry.note.slice(0, MAX_NOTE_LENGTH) : "",
        });
      }
    });

    return [...uniqueEntries.values()].sort((first, second) => second.date.localeCompare(first.date));
  } catch {
    return [];
  }
}

function writeEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

function setSelectedMood(mood) {
  selectedMood = mood;
  moodOptions.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mood === mood));
  });
}

function updateCharacterCount() {
  characterCount.textContent = `${noteInput.value.length} / ${MAX_NOTE_LENGTH}`;
}

function showMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", isError);
}

function render() {
  renderSummary();
  renderHistory();
}

function renderSummary() {
  const entryCount = entries.length;
  document.querySelector("#entry-count").textContent = String(entryCount);
  document.querySelector("#entry-label").textContent = entryCount === 1 ? "day checked in" : "days checked in";

  const counts = entries.reduce((totals, entry) => {
    totals[entry.mood] = (totals[entry.mood] || 0) + 1;
    return totals;
  }, {});
  const highestCount = Math.max(0, ...Object.values(counts));
  const mostCommon = entries.find((entry) => counts[entry.mood] === highestCount);

  if (!mostCommon) {
    document.querySelector("#summary-emoji").textContent = "—";
    document.querySelector("#summary-name").textContent = "Not yet known";
    document.querySelector("#summary-count").textContent = "Check in to start your story";
    return;
  }

  const mood = MOODS[mostCommon.mood];
  document.querySelector("#summary-emoji").textContent = mood.emoji;
  document.querySelector("#summary-name").textContent = mood.label;
  document.querySelector("#summary-count").textContent = `${highestCount} ${highestCount === 1 ? "check-in" : "check-ins"}`;
}

function renderHistory() {
  document.querySelector("#history-count").textContent = String(entries.length);
  historyList.replaceChildren();

  if (entries.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    const icon = document.createElement("span");
    icon.className = "empty-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "🌱";
    const message = document.createElement("p");
    message.textContent = "Your check-ins will find a home here.";
    emptyState.append(icon, message);
    historyList.append(emptyState);
    return;
  }

  entries.forEach((entry) => {
    const mood = MOODS[entry.mood];
    const row = document.createElement("article");
    row.className = "history-entry";

    const emoji = document.createElement("span");
    emoji.className = "history-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = mood.emoji;

    const details = document.createElement("div");
    details.className = "history-details";
    const date = document.createElement("p");
    date.className = "history-date";
    date.textContent = formatDate(entry.date);
    const moodName = document.createElement("span");
    moodName.className = "history-mood-name";
    moodName.textContent = mood.label;
    date.append(" · ", moodName);
    details.append(date);

    if (entry.note) {
      const note = document.createElement("p");
      note.className = "history-note";
      note.textContent = entry.note;
      details.append(note);
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.dataset.deleteDate = entry.date;
    deleteButton.setAttribute("aria-label", `Delete ${mood.label} check-in for ${formatDate(entry.date)}`);
    deleteButton.title = "Delete check-in";
    deleteButton.textContent = "×";

    row.append(emoji, details, deleteButton);
    historyList.append(row);
  });
}

function formatDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: year === new Date().getFullYear() ? undefined : "numeric",
  }).format(new Date(year, month - 1, day));
}
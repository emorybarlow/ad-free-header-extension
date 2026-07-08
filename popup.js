const SLOT_COUNT = 5;
const ALL_RULE_IDS = Array.from({ length: SLOT_COUNT }, (_, i) => i + 1);

const RESOURCE_TYPES = [
  "main_frame", "sub_frame", "stylesheet", "script", "image",
  "font", "object", "xmlhttprequest", "ping", "csp_report",
  "media", "websocket", "other"
];

const statusEl = document.getElementById("status");
let slots = Array.from({ length: SLOT_COUNT }, () => ({ name: "", value: "", enabled: false }));
let saveTimer = null;

function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "error" : "";
  setTimeout(() => { statusEl.textContent = ""; }, 2000);
}

async function applyRules() {
  const addRules = slots
    .map((slot, i) => ({ slot, id: i + 1 }))
    .filter(({ slot }) => slot.enabled && slot.name.trim())
    .map(({ slot, id }) => ({
      id,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: slot.name.trim(), operation: "set", value: slot.value.trim() }
        ]
      },
      condition: { urlFilter: "*", resourceTypes: RESOURCE_TYPES }
    }));

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ALL_RULE_IDS,
      addRules
    });
    const active = addRules.length;
    showStatus(active > 0 ? `${active} header${active > 1 ? "s" : ""} active` : "All disabled");
  } catch (e) {
    showStatus("Error: " + e.message, true);
  }
}

async function save() {
  await chrome.storage.local.set({ slots });
  await applyRules();
}

function buildRows() {
  const container = document.getElementById("rows");
  container.innerHTML = "";

  slots.forEach((slot, i) => {
    const row = document.createElement("div");
    row.className = "header-row";

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "toggle";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = slot.enabled;
    const sliderSpan = document.createElement("span");
    sliderSpan.className = "slider";
    toggleLabel.append(checkbox, sliderSpan);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "X-Header-Name";
    nameInput.value = slot.name;
    nameInput.spellcheck = false;
    nameInput.disabled = !slot.enabled;

    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.placeholder = "value";
    valueInput.value = slot.value;
    valueInput.spellcheck = false;
    valueInput.disabled = !slot.enabled;

    checkbox.addEventListener("change", () => {
      slots[i].enabled = checkbox.checked;
      nameInput.disabled = !checkbox.checked;
      valueInput.disabled = !checkbox.checked;
      save();
    });
    nameInput.addEventListener("input", () => { slots[i].name = nameInput.value; debouncedSave(); });
    valueInput.addEventListener("input", () => { slots[i].value = valueInput.value; debouncedSave(); });

    row.append(toggleLabel, nameInput, valueInput);
    container.appendChild(row);
  });
}

chrome.storage.local.get(["slots"], (data) => {
  if (data.slots?.length === SLOT_COUNT) slots = data.slots;
  buildRows();
});

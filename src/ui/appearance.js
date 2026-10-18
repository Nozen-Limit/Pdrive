const appearanceThemes = {
  slate: {
    label: "Slate",
    background: "#101720",
    accent: "#b7c7df",
    action: "#34475f",
    particles: [0.4, 0.49, 0.64],
    highlight: [0.82, 0.88, 0.98],
    waves: [0.09, 0.115, 0.16],
  },
  white: {
    label: "White",
    background: "#f5f7fa",
    accent: "#ffffff",
    action: "#34475f",
    light: true,
    particles: [0.24, 0.32, 0.43],
    highlight: [0.4, 0.49, 0.6],
    waves: [0.15, 0.19, 0.25],
  },
  ocean: {
    label: "Ocean",
    background: "#0a1722",
    accent: "#a6cbdc",
    action: "#2e5b72",
    particles: [0.4, 0.64, 0.78],
    highlight: [0.79, 0.93, 0.98],
    waves: [0.04, 0.15, 0.22],
  },
  forest: {
    label: "Forest",
    background: "#111d19",
    accent: "#b8cdbd",
    action: "#426051",
    particles: [0.48, 0.64, 0.53],
    highlight: [0.85, 0.95, 0.88],
    waves: [0.07, 0.15, 0.11],
  },
  warm: {
    label: "Warm",
    background: "#211c17",
    accent: "#d9c6ac",
    action: "#6d5944",
    particles: [0.7, 0.58, 0.43],
    highlight: [0.98, 0.91, 0.8],
    waves: [0.15, 0.105, 0.065],
  },
};
let appearanceChoice = "slate";
try {
  const saved = localStorage.getItem("sikap-appearance");
  if (appearanceThemes[saved]) appearanceChoice = saved;
} catch {}
function setAppearance(key, persist = true) {
  if (!appearanceThemes[key]) return;
  appearanceChoice = key;
  const theme = appearanceThemes[key];
  document.documentElement?.setAttribute?.("data-sikap-theme", key);
  const style = document.documentElement?.style;
  style?.setProperty("--sikap-bg", theme.background);
  style?.setProperty("--sikap-accent", theme.accent);
  style?.setProperty("--sikap-action", theme.action);
  if (persist) {
    try {
      localStorage.setItem("sikap-appearance", key);
    } catch {}
  }
  document
    .querySelectorAll?.('input[name="sikap-appearance"]')
    .forEach((input) => {
      input.checked = input.value === key;
    });
  if (
    typeof window.dispatchEvent === "function" &&
    typeof CustomEvent === "function"
  )
    window.dispatchEvent(
      new CustomEvent("sikap-appearance", { detail: theme }),
    );
}
function appearanceControls(compact = false) {
  return `<fieldset class="appearance-choices ${compact ? "appearance-compact" : ""}"><legend>${compact ? '<span class="material-symbols-rounded" aria-hidden="true">palette</span><span class="appearance-name">Choose color</span>' : "Color"}</legend>${Object.entries(
    appearanceThemes,
  )
    .map(
      ([key, theme]) =>
        `<label class="appearance-choice" title="${theme.label}"><input type="radio" name="sikap-appearance" value="${key}" ${appearanceChoice === key ? "checked" : ""} onchange="setAppearance(this.value)" aria-label="${theme.label}"><span class="appearance-swatch" style="--swatch:${theme.accent}" aria-hidden="true"></span><span class="appearance-name">${theme.label}</span></label>`,
    )
    .join("")}</fieldset>`;
}
function appearanceMenu() {
  return `<details class="appearance-menu"><summary class="icon-btn" aria-label="Choose color">${ico("palette")}</summary><div class="appearance-popover">${appearanceControls()}</div></details>`;
}
window.sikapAppearance = () => appearanceThemes[appearanceChoice];
setAppearance(appearanceChoice, false);

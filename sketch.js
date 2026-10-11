//gapminder 2018 (p5.js port of gapminder.pde)
//oop to treat each counrty as its own object

let table;

let countries;

let minIncome, maxIncome;
let minHealth, maxHealth;
let minPopulation, maxPopulation;

// Color palette for regions
const regions = [
  "ASIA (EX. NEAR EAST)", "EASTERN EUROPE", "NORTHERN AFRICA",
  "WESTERN EUROPE", "SUB-SAHARAN AFRICA", "LATIN AMER. & CARIB",
  "C.W. OF IND. STATES", "OCEANIA", "NEAR EAST", "NORTHERN AMERICA", "BALTICS", "EAST ASIA"
];

// spelled-out region names for screen readers and the data table
const regionNames = {
  "ASIA (EX. NEAR EAST)": "Asia (excluding Near East)",
  "EASTERN EUROPE": "Eastern Europe",
  "NORTHERN AFRICA": "Northern Africa",
  "WESTERN EUROPE": "Western Europe",
  "SUB-SAHARAN AFRICA": "Sub-Saharan Africa",
  "LATIN AMER. & CARIB": "Latin America & Caribbean",
  "C.W. OF IND. STATES": "Commonwealth of Independent States",
  "OCEANIA": "Oceania",
  "NEAR EAST": "Near East",
  "NORTHERN AMERICA": "Northern America",
  "BALTICS": "Baltics",
  "EAST ASIA": "East Asia"
};

const paletteHex = [
  "#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93", "#f15bb5",
  "#fee440", "#00bbf9", "#00f5d4", "#9b5de5", "#f15bb5", "#fb5607"
];
let palette; // p5.Color objects, built in setup()

// colours for everything that isn't a bubble, per theme ([r, g, b, alpha?])
// (the search box + toggle are HTML now; their colours live in index.html)
const THEMES = {
  dark: {
    bg: [15, 20, 35],
    year: [255, 255, 255, 12],
    axis: [80, 100, 130],
    axisTitle: [160, 180, 210],
    grid: [60, 90, 140, 80],
    gridLabel: [140, 165, 200],
    legendHeader: [200, 220, 255, 180],
    legendText: [180, 200, 230],
    matchLabel: [255, 255, 255, 200],
    popupBg: [20, 28, 50, 230],
    popupTitle: [240, 248, 255],
    popupText: [180, 210, 255],
    focus: [100, 160, 255],
    trend: [210, 225, 250],
    neutral: [120, 132, 155],  // "as expected" end of the life-vs-income scale
    bubbleEdge: 0     // how much bubble outlines are darkened (0 = region colour)
  },
  light: {
    bg: [244, 246, 251],
    year: [15, 20, 35, 14],
    axis: [150, 165, 190],
    axisTitle: [70, 85, 115],
    grid: [120, 140, 180, 60],
    gridLabel: [85, 100, 130],     // >= 4.5:1 contrast on the light background
    legendHeader: [40, 55, 85, 220],
    legendText: [60, 75, 105],
    matchLabel: [20, 25, 40, 220],
    popupBg: [255, 255, 255, 245],
    popupTitle: [20, 28, 50],
    popupText: [70, 90, 130],
    focus: [60, 120, 230],
    trend: [40, 55, 90],
    neutral: [175, 182, 198],
    bubbleEdge: 0.3   // darker outlines so yellow/cyan bubbles read on white
  }
};
let themeName = "dark";
let T = THEMES.dark;

// "Life vs. income" view: blue = lives longer than its income predicts, orange = shorter
// (blue/orange stays distinguishable for colour-blind viewers)
const OVER = "#00bbf9", UNDER = "#fb5607";
const RES_SCALE = 10;        // residual (years) that gets the full colour

// respect the OS "reduce motion" setting: no pulsing glow, no grow-in, no colour fades
const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

//interaction state variables
let searchCountry = "";      // search typed by user
let selected = null;         // country picked with the keyboard (or by clicking a bubble)
let byIncome, byHealth;      // countries sorted for arrow-key navigation

let view = "regions";        // "regions" | "expected"
let viewLinear = 0;          // transition progress, 0 = region colours, 1 = life-vs-income colours
let viewT = 0;               // same, eased
let hoverRegion = null;      // region under the mouse / keyboard in the legend
let pinnedRegion = null;     // region clicked in the legend
let introStart = 0;          // millis() when the bubbles start growing in

// life expectancy ~ a + b * ln(income), least-squares fit over all countries
let fitA = 0, fitB = 0, fitSD = 0;
let overachievers, underachievers;   // top 3 each way, labelled in the "expected" view

// DOM elements
let cnv, searchInput, themeButton, announcer, viewButtons, legendButtons;

// p5 loads files asynchronously, so the table is loaded before setup()
function preload() {
  table = loadTable("health-income.csv", "csv", "header");
}

//window
function setup() {
  cnv = createCanvas(1000, 700);
  cnv.parent("plot");
  palette = paletteHex.map(h => color(h));
  loadData();
  textFont("Space Grotesk"); // web font from index.html
  textAlign(CENTER, CENTER);

  setupAccessibility();
  setupEnhancements();
  setTheme(initialTheme());
  introStart = millis();
}

// saved choice first, otherwise follow the OS setting
function initialTheme() {
  try {
    const saved = localStorage.getItem("gapminder-theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch (e) {}
  return window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function setTheme(name) {
  themeName = name;
  T = THEMES[name];
  document.documentElement.dataset.theme = name; // page + HTML controls follow
  themeButton.querySelector(".label").textContent = name === "dark" ? "Light mode" : "Dark mode";
  themeButton.setAttribute("aria-label", "Switch to " + (name === "dark" ? "light" : "dark") + " mode");
  try { localStorage.setItem("gapminder-theme", name); } catch (e) {}
}

function draw() {
  // ease between the two colourings over ~0.4s (time-based, so slow frames don't drag it out)
  const target = view === "expected" ? 1 : 0;
  viewLinear = reduceMotion ? target :
    (target > viewLinear ? min(target, viewLinear + deltaTime / 400) : max(target, viewLinear - deltaTime / 400));
  viewT = viewLinear * viewLinear * (3 - 2 * viewLinear); // smoothstep

  background(...T.bg);
  drawYear();
  drawAxes();
  if (viewT > 0) drawTrend(viewT);

  let hovered = null;
  for (const c of countries) {
    c.coordUpdate();
    if (c.bubbleHovered()) {
      hovered = c;     //popup info
    }
  }

  // mouse hover wins; otherwise show the keyboard selection while the chart has focus
  const keyboardFocus = (hovered == null && selected != null && document.activeElement === cnv.elt);
  const active = hovered != null ? hovered : (keyboardFocus ? selected : null);

  // Draw all bubbles. dimmed when another is hovered (focus mode)
  for (const c of countries) {
    c.display(active);
  }

  if (view === "regions" && focusedRegion() && searchCountry.length === 0) drawRegionAverage(focusedRegion());
  if (view === "expected" && viewT > 0.5 && searchCountry.length === 0 && active == null) drawCallouts();

  //  glow on hover
  if (active != null) {
    active.displayGlowing();
    if (keyboardFocus) active.drawFocusRing();
  }

  // Draw popup last so its on top
  if (active != null) {
    if (keyboardFocus) active.drawPopup(active.x, active.y - active.radius - 8, true);
    else active.drawPopup(mouseX, mouseY - 50, false);
  }
  if (view === "expected") drawExpectedLegend();
  else drawLegend();
}

function focusedRegion() {
  return hoverRegion || pinnedRegion;
}

// trend line + a band one standard deviation either side ("typical for its income")
function drawTrend(alphaScale) {
  const x1 = 80, x2 = width - 50;
  const y1 = healthToY(expectedHealth(minIncome)), y2 = healthToY(expectedHealth(maxIncome));
  const band = healthToY(0) - healthToY(fitSD); // SD in pixels

  // keep the band inside the plot area
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(x1, 50, x2 - x1, height - 130);
  drawingContext.clip();

  noStroke();
  fill(...T.trend, 18 * alphaScale);
  quad(x1, y1 - band, x2, y2 - band, x2, y2 + band, x1, y1 + band);

  stroke(...T.trend, 170 * alphaScale);
  strokeWeight(1.5);
  drawingContext.setLineDash([6, 5]);
  line(x1, y1, x2, y2);
  drawingContext.setLineDash([]);
  drawingContext.restore();

  // label sits on the line near the left end, rotated to match it
  push();
  translate(x1 + 14, y1 - 8);
  rotate(atan2(y2 - y1, x2 - x1));
  noStroke();
  fill(...T.trend, 200 * alphaScale);
  textSize(10);
  textAlign(LEFT, BOTTOM);
  text("expected for its income", 0, 0);
  pop();
}

// population-weighted centre of a region, with crosshairs to both axes
function drawRegionAverage(region) {
  let w = 0, lx = 0, hy = 0, n = 0;
  for (const c of countries) {
    if (c.region !== region) continue;
    w += c.ppl; lx += log(c.income) * c.ppl; hy += c.health * c.ppl; n++;
  }
  if (w === 0) return;
  const inc = exp(lx / w), h = hy / w;
  const x = incomeToX(inc), y = healthToY(h);
  const clr = palette[regions.indexOf(region) % palette.length];

  stroke(red(clr), green(clr), blue(clr), 150);
  strokeWeight(1);
  drawingContext.setLineDash([3, 4]);
  line(x, y, x, height - 80);
  line(80, y, x, y);
  drawingContext.setLineDash([]);

  noFill();
  stroke(...T.popupTitle);
  strokeWeight(2);
  ellipse(x, y, 16, 16);
  line(x - 4, y, x + 4, y);
  line(x, y - 4, x, y + 4);

  // label, kept inside the plot
  const label = "Region average: $" + nfc(round(inc)) + " · " + h.toFixed(1) + " yrs · " + n + " countries";
  textSize(11);
  const tw = textWidth(label) + 16;
  let lxPos = constrain(x + 14, 84, width - 54 - tw);
  const lyPos = y - 22 < 54 ? y + 12 : y - 22;
  noStroke();
  fill(...T.popupBg);
  rect(lxPos, lyPos - 10, tw, 20, 5);
  fill(...T.popupTitle);
  textAlign(LEFT, CENTER);
  text(label, lxPos + 8, lyPos);
}

// name the biggest over- and under-performers
function drawCallouts() {
  textSize(10);
  for (const c of [...overachievers, ...underachievers]) {
    const col = residualColor(c.res);
    const above = c.res >= 0;
    const ty = above ? c.y - c.radius - 4 : c.y + c.radius + 4;
    noStroke();
    fill(...T.matchLabel);
    textAlign(CENTER, above ? BOTTOM : TOP);
    text(c.name, c.x, above ? ty - 11 : ty);
    fill(col);
    text(formatYears(c.res), c.x, above ? ty : ty + 11);
  }
}

// legend for the "Life vs. income" view: diverging scale + trend key
function drawExpectedLegend() {
  const lx = width - 160, top = 300;
  noStroke();
  fill(...T.legendHeader);
  textSize(12);
  textAlign(LEFT, CENTER);
  text("LIFE VS. INCOME", lx, top);

  fill(...T.legendText);
  textSize(10);
  text("Years above or below what", lx, top + 22);
  text("the country's income predicts", lx, top + 36);

  // gradient bar
  const bw = 120, by = top + 58;
  for (let i = 0; i <= bw; i++) {
    stroke(residualColor(map(i, 0, bw, -RES_SCALE, RES_SCALE)));
    line(lx + i, by, lx + i, by + 10);
  }
  noStroke();
  fill(...T.legendText);
  textAlign(CENTER, TOP);
  text("−" + RES_SCALE, lx, by + 14);
  text("0", lx + bw / 2, by + 14);
  text("+" + RES_SCALE, lx + bw, by + 14);
  textAlign(LEFT, TOP);
  fill(UNDER);
  text("shorter", lx, by + 28);
  fill(OVER);
  textAlign(RIGHT, TOP);
  text("longer", lx + bw, by + 28);

  // trend key
  const ky = by + 64;
  stroke(...T.trend, 170);
  strokeWeight(1.5);
  drawingContext.setLineDash([6, 5]);
  line(lx, ky, lx + 24, ky);
  drawingContext.setLineDash([]);
  noStroke();
  fill(...T.legendText);
  textAlign(LEFT, CENTER);
  text("expected life expectancy", lx + 32, ky);
  fill(...T.trend, 40);
  rect(lx, ky + 14, 24, 12);
  fill(...T.legendText);
  text("typical range (±" + fitSD.toFixed(1) + " yrs)", lx + 32, ky + 20);
}

function loadData() {
  countries = new Array(table.getRowCount());

  // values for range findingf
  minIncome = 100000; maxIncome = 0;
  minHealth = 100; maxHealth = 0;
  minPopulation = 1000000000; maxPopulation = 0;

  for (let i = 0; i < table.getRowCount(); i++) {
    const row = table.getRow(i);
    countries[i] = new Country(row);
    // Track ranges for scaling
    if (countries[i].income < minIncome) minIncome = countries[i].income;
    if (countries[i].income > maxIncome) maxIncome = countries[i].income;
    if (countries[i].health < minHealth) minHealth = countries[i].health;
    if (countries[i].health > maxHealth) maxHealth = countries[i].health;
    if (countries[i].ppl < minPopulation) minPopulation = countries[i].ppl;
    if (countries[i].ppl > maxPopulation) maxPopulation = countries[i].ppl;
  }

  byIncome = [...countries].sort((a, b) => a.income - b.income);
  byHealth = [...countries].sort((a, b) => a.health - b.health || a.income - b.income);

  // stagger the grow-in from poorest to richest
  byIncome.forEach((c, i) => { c.introDelay = i / byIncome.length; });

  fitTrend();
}

// "Preston curve": how long people live given how rich their country is.
// Each country's residual = years above/below what its income predicts.
function fitTrend() {
  const n = countries.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const c of countries) {
    const lx = log(c.income);
    sx += lx; sy += c.health; sxx += lx * lx; sxy += lx * c.health;
  }
  fitB = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  fitA = (sy - fitB * sx) / n;

  let ss = 0;
  for (const c of countries) {
    c.expected = expectedHealth(c.income);
    c.res = c.health - c.expected;
    ss += c.res * c.res;
  }
  fitSD = sqrt(ss / (n - 2));

  const byRes = [...countries].sort((a, b) => b.res - a.res);
  overachievers = byRes.slice(0, 3);
  underachievers = byRes.slice(-3).reverse();
}

function expectedHealth(income) {
  return fitA + fitB * log(income);
}

function incomeToX(income) {
  return map(log(income), log(minIncome), log(maxIncome), 80, width - 50);
}

function healthToY(h) {
  return map(h, 45, 90, height - 80, 50);
}

// diverging colour for a residual in years
function residualColor(res) {
  const t = constrain(res / RES_SCALE, -1, 1);
  return lerpColor(color(...T.neutral), color(t >= 0 ? OVER : UNDER), abs(t));
}

function formatYears(res) {
  return (res >= 0 ? "+" : "−") + abs(res).toFixed(1) + " yrs";
}

// 2018, faded
function drawYear() {
  noStroke(); // p5 outlines text when a stroke is set; Processing never does
  fill(...T.year);
  textSize(280);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  text("2018", width / 2, height / 2);
  textStyle(NORMAL);
}

//xy ax.
function drawAxes() {
  stroke(...T.axis);
  strokeWeight(1);
  line(80, height - 80, width - 50, height - 80); // X
  line(80, 50, 80, height - 80);                 // Y

  //inscriptions
  noStroke();
  fill(...T.axisTitle);
  textSize(14);
  textAlign(CENTER, CENTER);
  text("Income (GDP per capita)", width / 2, height - 30);

  push();
  translate(30, height / 2);
  rotate(HALF_PI * 3);
  text("Life Expectancy (Years)", 0, 0);
  pop();

  // horizontal grid for health
  textSize(10);
  for (let h = 50; h <= 90; h += 10) {
    const gridHealth = map(h, 45, 90, height - 80, 50);
    // Glowing grid line effect using two overlapping strokes
    stroke(...T.grid);
    strokeWeight(1);
    line(80, gridHealth, width - 50, gridHealth);
    noStroke();
    fill(...T.gridLabel);
    textAlign(RIGHT, CENTER);
    text(h, 75, gridHealth);
  }

  // vertical grid for icome gdp in dollars
  const incomeMark = [1000, 2000, 5000, 10000, 20000, 50000, 100000]; //draw line only at these points
  const logMin = log(minIncome);
  const logMax = log(maxIncome);

  for (const m of incomeMark) {
    const gridGDP = map(log(m), logMin, logMax, 80, width - 50);
    if (gridGDP >= 80 && gridGDP <= width - 50) { //draw if mark is withn data range
      stroke(...T.grid);
      strokeWeight(1);
      line(gridGDP, 50, gridGDP, height - 80);
      noStroke();
      fill(...T.gridLabel);
      textAlign(CENTER, TOP);
      text("$" + (m >= 1000 ? floor(m / 1000) + "k" : m), gridGDP, height - 75);
    }
  }
}

//country bubbles (2d primitives vis)
function drawLegend() {
  textSize(11);
  textAlign(LEFT, CENTER);
  const legendStartY = 320;

  // header for legendss
  noStroke();
  fill(...T.legendHeader);
  textSize(12);
  text("REGION", width - 160, legendStartY - 20);

  const focus = focusedRegion();
  for (let i = 0; i < regions.length; i++) {
    const yPos = legendStartY + (i * 22);
    const c = palette[i % palette.length];
    const dim = focus != null && focus !== regions[i];

    // legend: halo + solid  dot
    noStroke();
    fill(red(c), green(c), blue(c), dim ? 20 : 50);
    ellipse(width - 160, yPos, 20, 20);
    fill(red(c), green(c), blue(c), dim ? 70 : 255);
    ellipse(width - 160, yPos, 10, 10);
    fill(...T.legendText, dim ? 90 : 255);
    textSize(10);
    textStyle(regions[i] === focus ? BOLD : NORMAL);
    text(regions[i], width - 148, yPos);
    textStyle(NORMAL);
  }

  // hint while no region is focused
  if (focus == null) {
    fill(...T.legendText, 140);
    textSize(9);
    text("click a region to focus", width - 170, legendStartY + regions.length * 22 + 2);
  }
}

// click a bubble to select it (same as arrowing to it)
function mousePressed() {
  for (const c of countries) {
    if (c.bubbleHovered()) {
      selectCountry(c);
      return;
    }
  }
}

// ---------- accessibility: HTML controls, keyboard navigation, announcements ----------

function setupAccessibility() {
  searchInput = document.getElementById("search");
  themeButton = document.getElementById("theme-toggle");
  announcer = document.getElementById("announcer");

  // the canvas is a keyboard-operable widget; its instructions are in #chart-help
  const el = cnv.elt;
  el.setAttribute("tabindex", "0");
  el.setAttribute("role", "application");
  el.setAttribute("aria-roledescription", "interactive bubble chart");
  el.setAttribute("aria-label", "Gapminder 2018: income versus life expectancy for 187 countries");
  el.setAttribute("aria-describedby", "chart-help");
  el.addEventListener("keydown", chartKeydown);

  themeButton.addEventListener("click", () => setTheme(themeName === "dark" ? "light" : "dark"));

  let announceTimer;
  searchInput.addEventListener("input", () => {
    searchCountry = searchInput.value;
    if (selected && !matchesSearch(selected)) selected = null;
    // tell screen-reader users how many matched, once they pause typing
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      if (searchCountry.length === 0) return announce("Search cleared.");
      const n = searchMatches().length;
      announce(n === 0 ? "No countries match." :
        n + (n === 1 ? " country matches" : " countries match") + ". Press Enter to go to the chart.");
    }, 500);
  });
  searchInput.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      searchInput.value = "";
      searchCountry = "";
    } else if (e.key === "Enter") {
      const matches = searchMatches();
      if (matches.length > 0) {
        e.preventDefault();
        cnv.elt.focus();
        selectCountry(navList(byIncome)[0]);
      }
    }
  });

  buildDataTable();
}

function chartKeydown(e) {
  const list = (e.key === "ArrowUp" || e.key === "ArrowDown") ? navList(byHealth) : navList(byIncome);
  if (list.length === 0) return;
  const i = selected ? list.indexOf(selected) : -1;
  let next = null;

  switch (e.key) {
    case "ArrowRight": case "ArrowUp":
      next = i < 0 ? list[0] : list[min(i + 1, list.length - 1)]; break;
    case "ArrowLeft": case "ArrowDown":
      next = i < 0 ? list[list.length - 1] : list[max(i - 1, 0)]; break;
    case "Home": next = list[0]; break;
    case "End": next = list[list.length - 1]; break;
    case "Escape":
      selected = null;
      announce("Selection cleared.");
      e.preventDefault();
      return;
    default: return;
  }
  e.preventDefault(); // keep arrow keys from scrolling the page
  selectCountry(next);
}

// ---------- enhancements: view switch + interactive legend ----------

function setupEnhancements() {
  viewButtons = document.querySelectorAll("#view-switch button");
  viewButtons.forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));

  // invisible HTML buttons laid over each canvas legend row, so the legend
  // works with mouse, touch, keyboard and screen readers alike
  const plot = document.getElementById("plot");
  legendButtons = regions.map((r, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "legend-btn";
    b.style.top = ((320 - 11 + i * 22) / 10) + "cqw";
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-label", "Focus on " + regionNames[r]);
    b.addEventListener("mouseenter", () => { hoverRegion = r; });
    b.addEventListener("mouseleave", () => { hoverRegion = null; });
    b.addEventListener("focus", () => { hoverRegion = r; });
    b.addEventListener("blur", () => { hoverRegion = null; });
    b.addEventListener("click", () => togglePinnedRegion(r));
    plot.appendChild(b);
    return b;
  });
}

function setView(v) {
  view = v;
  if (v !== "regions") { pinnedRegion = null; hoverRegion = null; }
  viewButtons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
  legendButtons.forEach(b => {
    b.hidden = v !== "regions";
    b.setAttribute("aria-pressed", "false");
  });
  announce(v === "expected"
    ? "Colouring by life expectancy compared with income. Blue countries live longer than their income predicts, orange shorter. " +
      "Biggest over-performers: " + overachievers.map(c => c.name + " " + formatYears(c.res)).join(", ") + ". " +
      "Biggest under-performers: " + underachievers.map(c => c.name + " " + formatYears(c.res)).join(", ") + "."
    : "Colouring by world region.");
}

function togglePinnedRegion(r) {
  pinnedRegion = pinnedRegion === r ? null : r;
  legendButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(regions[i] === pinnedRegion)));
  if (pinnedRegion == null) return announce("Showing all regions.");
  const members = countries.filter(c => c.region === r);
  const pop = members.reduce((s, c) => s + c.ppl, 0);
  const avg = members.reduce((s, c) => s + c.health * c.ppl, 0) / pop;
  announce("Focused on " + regionNames[r] + ": " + members.length + " countries, " +
    "population-weighted life expectancy " + avg.toFixed(1) + " years.");
}

// arrow keys step through search matches when there are any, otherwise every country
function navList(sorted) {
  const matches = sorted.filter(matchesSearch);
  return searchCountry.length > 0 && matches.length > 0 ? matches : sorted;
}

function matchesSearch(c) {
  return searchCountry.length > 0 && c.name.toLowerCase().includes(searchCountry.toLowerCase());
}

function searchMatches() {
  return countries.filter(matchesSearch);
}

function selectCountry(c) {
  selected = c;
  const list = navList(byIncome);
  announce(c.describe() + " " + (list.indexOf(c) + 1) + " of " + list.length + " by income.");
}

function announce(msg) {
  // clear first so repeating the same message is still read out
  announcer.textContent = "";
  setTimeout(() => { announcer.textContent = msg; }, 50);
}

// same data as the chart, as a real table
function buildDataTable() {
  const tbody = document.getElementById("data-rows");
  for (const c of countries) {
    const tr = document.createElement("tr");
    const cells = [c.name, regionNames[c.region] || c.region,
      nfc(int(c.income)), formatFloat(c.health),
      (c.res >= 0 ? "+" : "−") + abs(c.res).toFixed(1), nfc(int(c.ppl))];
    cells.forEach((v, k) => {
      const td = document.createElement(k === 0 ? "th" : "td");
      if (k === 0) td.scope = "row";
      if (k >= 2) td.className = "num";
      td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}

// Processing prints floats with at least one decimal (76 -> "76.0")
function formatFloat(v) {
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
}

class Country {
  constructor(row) {
    this.name = row.getString("country");
    this.region = row.getString("region");
    this.income = row.getNum("income");
    this.health = row.getNum("health");
    this.ppl = row.getNum("population");
    // Assign color based on region
    this.clr = color(150, 150, 150, 180);
    for (let i = 0; i < regions.length; i++) {
      if (this.region === regions[i]) {
        this.clr = palette[i % palette.length];
        break;
      }
    }
    this.x = 0; this.y = 0; this.radius = 0;
  }

  // sentence read out by screen readers
  describe() {
    return this.name + ", " + (regionNames[this.region] || this.region) +
      ". Income $" + nfc(int(this.income)) + " per person, life expectancy " +
      formatFloat(this.health) + " years, population " + nfc(int(this.ppl)) + ". " +
      "That is " + abs(this.res).toFixed(1) + " years " + (this.res >= 0 ? "longer" : "shorter") +
      " than expected for its income.";
  }

  coordUpdate() {
    const logMin = log(minIncome);
    const logMax = log(maxIncome);
    const logValue = log(this.income); //
    // Logarithmic mapping for income - x axis and Linear mapping for health , y axis. keeps countries within xy area
    this.x = map(logValue, logMin, logMax, 80, width - 50);
    this.y = map(this.health, 45, 90, height - 80, 50);
    // Area based mapping for population (radius)
    // map the area (not the radius)=  visual acuracy
    const area = map(this.ppl, minPopulation, maxPopulation, 20, 5000);
    this.radius = sqrt(area / PI);
  }

  // dim effect when other bubble is hovered (focus mode)
  // +highlights matching search results
  display(hovered) {
    this.coordUpdate();
    // region colour, blended toward the life-vs-income colour as that view fades in
    const clr = viewT > 0 ? lerpColor(this.clr, residualColor(this.res), viewT) : this.clr;
    this.cur = clr;
    const edge = lerpColor(clr, color(0), T.bubbleEdge);

    const isMatched = matchesSearch(this);
    const isHovered = (this === hovered);
    const region = view === "regions" ? focusedRegion() : null;

    // Dim  others when hovering or searching, focus mode
    let alphaVal = 180;
    if (region != null && this.region !== region) alphaVal = 25;
    if (hovered != null && !isHovered) alphaVal = min(alphaVal, 40);
    if (searchCountry.length > 0 && !isMatched) alphaVal = 25;
    if (isMatched) alphaVal = 230;

    // grow in on load, poorest first (ease-out)
    let grow = 1;
    if (!reduceMotion) {
      const t = constrain(((millis() - introStart) / 1000 - this.introDelay * 0.9) / 0.5, 0, 1);
      grow = 1 - pow(1 - t, 3);
    }
    if (grow <= 0) return;

    fill(red(clr), green(clr), blue(clr), alphaVal);
    stroke(red(edge), green(edge), blue(edge), alphaVal * 0.6);
    strokeWeight(1);
    ellipse(this.x, this.y, this.radius * 2 * grow, this.radius * 2 * grow);

    // Label for search matches so they're easy to spot
    if (isMatched) {
      noStroke();
      fill(...T.matchLabel);
      textSize(10);
      textAlign(CENTER, BOTTOM);
      text(this.name, this.x, this.y - this.radius - 2);
    }
  }

  // pulsate and glow on hover, bubble intercation effect
  displayGlowing() {
    this.coordUpdate();
    const clr = this.cur || this.clr;
    // gentle pulse (held steady when the user prefers reduced motion)
    const shimmer = reduceMotion ? 0.75 : 0.5 + 0.5 * sin(frameCount * 0.12);

    // outer soft glow
    noStroke();
    for (let ring = 3; ring > 0; ring--) {
      const haloR = this.radius + ring * 5 + shimmer * 3;
      fill(red(clr), green(clr), blue(clr), 18 * ring * shimmer);
      ellipse(this.x, this.y, haloR * 2, haloR * 2);
    }
  }

  // keyboard focus indicator that doesn't rely on colour
  drawFocusRing() {
    noFill();
    stroke(...T.focus);
    strokeWeight(2);
    ellipse(this.x, this.y, this.radius * 2 + 8, this.radius * 2 + 8);
  }

  bubbleHovered() {
    return dist(mouseX, mouseY, this.x, this.y) < this.radius;
  }

  // popup tab for bubbles with info, popup style
  // (ax, ay) = mouse position, or a point just above the bubble when using the keyboard
  drawPopup(ax, ay, fromKeyboard) {
    const clr = this.cur || this.clr;
    const extra = view === "expected" ? 14 : 0;   // room for the "vs expected" line
    let px = ax, py = ay - (fromKeyboard ? extra : 0);
    // Keep popup inside canvas
    if (px + 90 > width) px = width - 90;
    if (px - 90 < 0) px = 90;
    if (py - 40 < 10) py = this.y + this.radius + (fromKeyboard ? 68 : 50);
    // popup body
    fill(...T.popupBg);
    stroke(red(clr), green(clr), blue(clr), 180);
    strokeWeight(1.5);
    rectMode(CENTER);
    rect(px, py - 30 + extra / 2, 160, 66 + extra, 7);
    rectMode(CORNER);
    // Colored top strip
    noStroke();
    fill(red(clr), green(clr), blue(clr), 160);
    rect(px - 79, py - 62, 160, 6, 7, 7, 0, 0);
    // Country name
    fill(...T.popupTitle);
    textAlign(CENTER, CENTER);
    textSize(13);
    text(this.name, px, py - 43);
    // data
    fill(...T.popupText);
    textSize(10);
    text("Inc: $" + int(this.income) + " | Life: " + formatFloat(this.health), px, py - 28);
    text("Ppl:" + nfc(int(this.ppl)), px, py - 14); //nfc comma in number
    if (extra > 0) {
      fill(residualColor(this.res));
      text(formatYears(this.res) + " vs. expected", px, py);
    }
  }
}

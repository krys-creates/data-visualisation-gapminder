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

const paletteHex = [
  "#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93", "#f15bb5",
  "#fee440", "#00bbf9", "#00f5d4", "#9b5de5", "#f15bb5", "#fb5607"
];
let palette; // p5.Color objects, built in setup()

// colours for everything that isn't a bubble, per theme ([r, g, b, alpha?])
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
    boxBg: [30, 40, 65, 220],
    boxBorder: [60, 80, 120],
    boxBorderActive: [100, 160, 255],
    boxText: [180, 200, 230],
    boxPlaceholder: [80, 100, 140],
    matchLabel: [255, 255, 255, 200],
    popupBg: [20, 28, 50, 230],
    popupTitle: [240, 248, 255],
    popupText: [180, 210, 255],
    bubbleEdge: 0     // how much bubble outlines are darkened (0 = region colour)
  },
  light: {
    bg: [244, 246, 251],
    year: [15, 20, 35, 14],
    axis: [150, 165, 190],
    axisTitle: [70, 85, 115],
    grid: [120, 140, 180, 60],
    gridLabel: [100, 115, 145],
    legendHeader: [40, 55, 85, 200],
    legendText: [60, 75, 105],
    boxBg: [255, 255, 255, 235],
    boxBorder: [195, 205, 225],
    boxBorderActive: [60, 120, 230],
    boxText: [40, 55, 85],
    boxPlaceholder: [140, 152, 175],
    matchLabel: [20, 25, 40, 220],
    popupBg: [255, 255, 255, 245],
    popupTitle: [20, 28, 50],
    popupText: [70, 90, 130],
    bubbleEdge: 0.3   // darker outlines so yellow/cyan bubbles read on white
  }
};
let themeName = "dark";
let T = THEMES.dark;

// UI boxes
const SEARCH = { x: 90, y: 20, w: 200, h: 28 };
const TOGGLE = { x: 840, y: 20, w: 110, h: 28 };

//interaction state variables
let searchCountry = "";      // search typed by user
let searchActive = false;    // is the search box focused?

// p5 loads files asynchronously, so the table is loaded before setup()
function preload() {
  table = loadTable("health-income.csv", "csv", "header");
}

//window
function setup() {
  const cnv = createCanvas(1000, 700);
  cnv.parent("gapminder");
  palette = paletteHex.map(h => color(h));
  loadData();
  textFont("Space Grotesk"); // web font from index.html
  textAlign(CENTER, CENTER);
  setTheme(initialTheme());
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
  document.documentElement.dataset.theme = name; // page background follows
  try { localStorage.setItem("gapminder-theme", name); } catch (e) {}
}

function draw() {
  background(...T.bg);
  drawYear();
  drawAxes();

  let hovered = null;
  for (const c of countries) {
    c.coordUpdate();
    if (c.bubbleHovered()) {
      hovered = c;     //popup info
    }
  }

  // Draw all bubbles. dimmed when another is hovered (focus mode)
  for (const c of countries) {
    c.display(hovered);
  }

  //  glow on hover
  if (hovered != null) {
    hovered.displayGlowing();
  }

  // Draw popup last so its on top
  if (hovered != null) {
    hovered.drawPopup();
  }
  drawLegend();
  drawSearch();
  drawToggle();

  // pointer feedback for the clickable bits
  if (overBox(TOGGLE)) cursor(HAND);
  else if (overBox(SEARCH)) cursor(TEXT);
  else cursor(ARROW);
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

  for (let i = 0; i < regions.length; i++) {
    const yPos = legendStartY + (i * 22);
    const c = palette[i % palette.length];

    // legend: halo + solid  dot
    noStroke();
    fill(red(c), green(c), blue(c), 50);
    ellipse(width - 160, yPos, 20, 20);
    fill(c);
    ellipse(width - 160, yPos, 10, 10);
    fill(...T.legendText);
    textSize(10);
    text(regions[i], width - 148, yPos);
  }
}

// rounded box shared by the search field and the theme toggle
function drawBox(b, active) {
  noStroke();  // Box background
  fill(...T.boxBg);
  rect(b.x, b.y, b.w, b.h, 6);

  // Border change when activ
  stroke(...(active ? T.boxBorderActive : T.boxBorder));
  strokeWeight(1);
  noFill();
  rect(b.x, b.y, b.w, b.h, 6);
  noStroke();
}

// search box top
function drawSearch() {
  const b = SEARCH;
  drawBox(b, searchActive);

  // text settings
  fill(...T.boxText);
  textSize(11);
  textAlign(LEFT, CENTER);
  const display = searchCountry.length > 0 ? searchCountry : (searchActive ? "" : "Search country...");
  if (searchCountry.length == 0 && !searchActive) fill(...T.boxPlaceholder);
  text(display + (searchActive ? "|" : ""), b.x + 10, b.y + b.h / 2);
}

// dark / light switch, top right: a little sun or moon + the mode it switches to
function drawToggle() {
  const b = TOGGLE;
  drawBox(b, overBox(b));

  const cx = b.x + 18, cy = b.y + b.h / 2;
  fill(...T.boxText);
  if (themeName === "dark") {
    // sun -> switch to light
    circle(cx, cy, 8);
    stroke(...T.boxText);
    strokeWeight(1.2);
    for (let a = 0; a < TWO_PI; a += QUARTER_PI) {
      line(cx + cos(a) * 6, cy + sin(a) * 6, cx + cos(a) * 8, cy + sin(a) * 8);
    }
    noStroke();
  } else {
    // moon -> switch to dark
    circle(cx, cy, 13);
    fill(...T.boxBg);
    circle(cx + 4, cy - 3, 11);
  }

  fill(...T.boxText);
  textSize(11);
  textAlign(LEFT, CENTER);
  text(themeName === "dark" ? "Light mode" : "Dark mode", b.x + 34, cy);
}

function overBox(b) {
  return mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h;
}

// click to activate box
function mousePressed() {
  if (overBox(TOGGLE)) {
    setTheme(themeName === "dark" ? "light" : "dark");
    return;
  }
  // Check if search box clicked
  if (overBox(SEARCH)) {
    searchActive = true;
    return;
  }
  searchActive = false;
}

// keybord x inputs (esc, backspace etc)
function keyPressed() {
  if (searchActive) {
    if (keyCode === BACKSPACE) {
      if (searchCountry.length > 0) {
        searchCountry = searchCountry.substring(0, searchCountry.length - 1);
      }
      return false;  // stop the browser treating backspace as "go back"
    } else if (keyCode === ESCAPE) {
      searchActive = false;
      searchCountry = "";
      return false;
    }
  }
}

// printable characters (incl. space) are typed into the search box
function keyTyped() {
  if (searchActive && key.length === 1) {
    searchCountry += key;
    return false;  // stop space from scrolling the page while typing
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
    const clr = this.clr;
    const edge = lerpColor(clr, color(0), T.bubbleEdge);

    const isMatched = searchCountry.length > 0 && this.name.toLowerCase().includes(searchCountry.toLowerCase());
    const isHovered = (this === hovered);

    // Dim  others when hovering or searching, focus mode
    let alphaVal = 180;
    if (hovered != null && !isHovered) alphaVal = 40;
    if (searchCountry.length > 0 && !isMatched) alphaVal = 25;
    if (isMatched) alphaVal = 230;

    fill(red(clr), green(clr), blue(clr), alphaVal);
    stroke(red(edge), green(edge), blue(edge), alphaVal * 0.6);
    strokeWeight(1);
    ellipse(this.x, this.y, this.radius * 2, this.radius * 2);

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
    const clr = this.clr;
    const shimmer = 0.5 + 0.5 * sin(frameCount * 0.12); // gentle pulse

    // outer soft glow
    noStroke();
    for (let ring = 3; ring > 0; ring--) {
      const haloR = this.radius + ring * 5 + shimmer * 3;
      fill(red(clr), green(clr), blue(clr), 18 * ring * shimmer);
      ellipse(this.x, this.y, haloR * 2, haloR * 2);
    }
  }

  bubbleHovered() {
    return dist(mouseX, mouseY, this.x, this.y) < this.radius;
  }

  // popup tab for bubbles with info, popup style
  drawPopup() {
    const clr = this.clr;
    let px = mouseX, py = mouseY - 50;
    // Keep popup inside canvas
    if (px + 90 > width) px = width - 90;
    if (px - 90 < 0) px = 90;
    if (py - 40 < 10) py = this.y + this.radius + 50;
    // popup body
    fill(...T.popupBg);
    stroke(red(clr), green(clr), blue(clr), 180);
    strokeWeight(1.5);
    rectMode(CENTER);
    rect(px, py - 30, 160, 66, 7);
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
  }
}

/**
 * Ward Christmas Memories — survey + photo upload + slideshow builder
 * Google Apps Script, bound to a Google Sheet.
 *
 * Setup (once):
 *   1. Create a new Google Sheet. Extensions > Apps Script.
 *   2. Paste this file into Code.gs, and create an HTML file named "Index" with Index.html.
 *   3. Edit CONFIG below, save, reload the Sheet. Use the "🎄 Christmas" menu > "Run setup".
 *   4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *   5. Share the web app URL (or a QR code of it) with families.
 *   6. When responses are in: "🎄 Christmas" menu > "Build slideshow".
 */

const CONFIG = {
  WARD_NAME: 'Summerhaze Ward',                 // shown on the form header and title slide
  PARTY_TITLE: 'Ward Christmas Party',
  DEADLINE_TEXT: 'Please respond by December 5',  // shown on the form; leave '' to hide
  FOLDER_NAME: 'Ward Christmas Photos',  // Drive folder created for uploads
  SHEET_NAME: 'Responses',
  MAX_ANSWER_CHARS: 400,                 // keeps slides readable
  // Slide look
  BG_COLOR: '#0e1a2f',                   // midnight (Bethlehem night sky)
  ACCENT_COLOR: '#e0be6a',               // star gold
  TEXT_COLOR: '#fbf7ee',                 // warm white
  TITLE_FONT: 'Playfair Display',
  BODY_FONT: 'Lora',
  // 'combined' = photo + answers on one slide (layout adapts to photo shape)
  // 'split'    = full-screen photo slide, then an answers slide, per family
  SLIDE_MODE: 'combined',
  // Drive file ID of the feature artwork (nativity.jpg) for the title and closing
  // slides. Leave '' to build them without it.
  FEATURE_IMAGE_FILE_ID: '1ARzqYRFaGrxMiZJRjxLQsvGynTWqLNwc',
  LIGHTS: true,                          // string of Christmas lights along the bottom of each slide
};

const QUESTIONS = [
  'What is one Christmas tradition from your past that you would love to keep, or bring back?',
  'What does Christmas mean to you?',
  'What is one thing you are most grateful for about your family?',
];

const HEADERS = ['Timestamp', 'Include?', 'Family Name', 'Tradition', 'Meaning of Christmas',
                 'Grateful For', 'Photo Link', 'Photo File ID', 'OK to Share'];

/* ---------------- Menu & setup ---------------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎄 Christmas')
    .addItem('Run setup', 'setup')
    .addItem('Build slideshow', 'buildSlideshow')
    .addToUi();
}

function setup() {
  getSheet_();
  getFolder_();
  SpreadsheetApp.getUi().alert(
    'Setup complete.\n\nPhotos folder: "' + CONFIG.FOLDER_NAME + '" in your Drive.\n' +
    'Next: Deploy > New deployment > Web app (Execute as: Me, Access: Anyone).');
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) sh = ss.insertSheet(CONFIG.SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#e8efe9');
    sh.setColumnWidths(4, 3, 320);
  }
  return sh;
}

function getFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* recreated below */ }
  }
  const folder = DriveApp.createFolder(CONFIG.FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

/* ---------------- Web app ---------------- */

function doGet() {
  const t = HtmlService.createTemplateFromFile('Index');
  t.config = CONFIG;
  t.questions = QUESTIONS;
  return t.evaluate()
    .setTitle(CONFIG.WARD_NAME + ' — Christmas Memories')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Called from the form via google.script.run.
 * data = { familyName, answers: [a1,a2,a3], consent: bool, photo: {dataUrl, name} }
 */
function submitResponse(data) {
  const family = clean_(data.familyName, 80);
  const answers = (data.answers || []).map(a => clean_(a, CONFIG.MAX_ANSWER_CHARS));
  if (!family) throw new Error('Please enter your family name.');
  if (answers.length !== QUESTIONS.length || answers.some(a => !a)) {
    throw new Error('Please answer all three questions.');
  }
  if (!data.photo || !data.photo.dataUrl) throw new Error('Please add a family photo.');

  const m = String(data.photo.dataUrl).match(/^data:(image\/(jpeg|png));base64,(.+)$/);
  if (!m) throw new Error('That photo format is not supported. Please try a JPG or PNG.');
  const bytes = Utilities.base64Decode(m[3]);
  if (bytes.length > 15 * 1024 * 1024) throw new Error('That photo is too large.');

  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const ext = m[2] === 'png' ? 'png' : 'jpg';
  const fileName = family.replace(/[^\w\- ]+/g, '').trim() + ' ' + stamp + '.' + ext;
  const file = getFolder_().createFile(Utilities.newBlob(bytes, m[1], fileName));

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    getSheet_().appendRow([new Date(), true, family, answers[0], answers[1], answers[2],
                           file.getUrl(), file.getId(), data.consent ? 'Yes' : 'No']);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

function clean_(s, max) {
  return String(s || '').replace(/\s+\n/g, '\n').trim().slice(0, max);
}

/* ---------------- Slideshow builder ---------------- */

function buildSlideshow() {
  const ui = SpreadsheetApp.getUi();
  const rows = getSheet_().getDataRange().getValues().slice(1)
    .filter(r => r[2] && r[7] && r[1] !== false && String(r[8]) === 'Yes');
  if (!rows.length) { ui.alert('No responses to include yet.'); return; }

  const deck = getDeck_();
  const W = deck.getPageWidth(), H = deck.getPageHeight();

  // Title slide (reuse the first slide)
  const title = deck.getSlides()[0];
  title.getPageElements().forEach(e => e.remove());
  decorate_(title, W, H);
  const feature = CONFIG.FEATURE_IMAGE_FILE_ID ? fileBlob_(CONFIG.FEATURE_IMAGE_FILE_ID) : null;
  const titleTextX = feature ? placeFeature_(title, feature, 'left', W, H) : 40;
  const titleTextW = W - titleTextX - 40;
  addStack_(title, titleTextX, PAD, titleTextW, H - PAD * 2 - 12, [
    { t: '✦', size: 20, color: '#ffe9a8' },
    { t: CONFIG.WARD_NAME.toUpperCase(), size: 14, color: CONFIG.ACCENT_COLOR, above: 8 },
    { t: 'Christmas Memories', font: CONFIG.TITLE_FONT, size: 40, color: CONFIG.TEXT_COLOR, above: 4, fit: true },
    { t: '“For unto you is born this day in the city of David a Saviour, which is Christ the Lord.”',
      size: 14, italic: true, color: '#f3e2b3', above: 18 },
    { t: 'LUKE 2:11', size: 10, color: CONFIG.ACCENT_COLOR, above: 4 },
  ]);

  // Template slide for families: background + lights built once, then copied (fast)
  const template = deck.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  decorate_(template, W, H);
  TEMPLATE_ = template;

  const skipped = [];
  rows.forEach(r => {
    const [, , family, a1, a2, a3, , fileId] = r;
    const answers = [a1, a2, a3].map(a => String(a).replace(/\s*\n\s*/g, ' '));
    if (CONFIG.SLIDE_MODE === 'split') {
      buildSplitSlides_(deck, family, answers, fileId, skipped);
    } else {
      buildCombinedSlide_(deck, family, answers, fileId, skipped);
    }
  });

  // Closing slide
  const end = deck.appendSlide(template);
  const endTextX = 40;
  const endTextW = feature ? W * 0.58 - endTextX : W - 80;
  if (feature) placeFeature_(end, feature, 'right', W, H);
  addStack_(end, endTextX, PAD, endTextW, H - PAD * 2 - 12, [
    { t: '✦', size: 20, color: '#ffe9a8' },
    { t: 'Merry Christmas', font: CONFIG.TITLE_FONT, size: 42, color: CONFIG.TEXT_COLOR, above: 6, fit: true },
    { t: 'from our ward family to yours', size: 16, color: CONFIG.ACCENT_COLOR, above: 2 },
    { t: '“I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life.”',
      size: 14, italic: true, color: '#f3e2b3', above: 18 },
    { t: 'JOHN 8:12', size: 10, color: CONFIG.ACCENT_COLOR, above: 4 },
  ]);

  template.remove();

  deck.saveAndClose();
  const url = deck.getUrl();
  const html = HtmlService.createHtmlOutput(
    '<p style="font-family:sans-serif">Built ' + rows.length + ' family slides.' +
    (skipped.length ? '<br>Photo problems: ' + skipped.join(', ') : '') +
    '</p><p><a href="' + url + '" target="_blank" style="font-family:sans-serif">Open the slideshow</a></p>')
    .setWidth(360).setHeight(140);
  ui.showModalDialog(html, 'Slideshow ready');
}

function styleBg_(slide) {
  slide.getBackground().setSolidFill(CONFIG.BG_COLOR);
}

function addText_(slide, str, x, y, w, h, font, size, color, center) {
  const box = slide.insertTextBox(str, x, y, w, h);
  const t = box.getText();
  t.getTextStyle().setFontFamily(font).setFontSize(size).setForegroundColor(color);
  if (center) t.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  return box;
}

function addRule_(slide, x, y, w) {
  const line = slide.insertLine(SlidesApp.LineCategory.STRAIGHT, x, y, x + w, y);
  line.setWeight(2).getLineFill().setSolidFill(CONFIG.ACCENT_COLOR);
}

/* ---------------- Adaptive layouts ---------------- */

const LABELS = ['A tradition we love', 'What Christmas means to us', "What we're grateful for"];
const PAD = 16, GAP = 22;

/**
 * One slide per family. The photo is made as large as possible, sized by its own shape:
 *  - portrait/square photos fill the full slide height; answers get the wide remainder
 *  - landscape photos grow as wide as the answers allow; the answer column narrows
 *    for short answers and widens for long ones
 * The text size is then fitted to whatever space is left.
 */
function buildCombinedSlide_(deck, family, answers, fileId, skipped) {
  const W = deck.getPageWidth(), H = deck.getPageHeight();
  const slide = deck.appendSlide(TEMPLATE_);

  const chars = answers.join('').length + family.length;
  const minTextW = Math.min(300, Math.max(200, 180 + chars * 0.09));
  const maxPhotoW = W - PAD * 2 - GAP - minTextW;
  const maxPhotoH = H - PAD * 2;

  let photoRight = PAD - GAP; // if the photo fails, text takes the whole slide
  const img = insertPhoto_(slide, fileId);
  if (img) {
    const r = img.getWidth() / img.getHeight();
    let h = maxPhotoH, w = h * r;
    if (w > maxPhotoW) { w = maxPhotoW; h = w / r; }
    img.setWidth(w).setHeight(h).setLeft(PAD).setTop((H - h) / 2);
    img.getBorder().setWeight(3).getLineFill().setSolidFill(CONFIG.ACCENT_COLOR);
    photoRight = PAD + w;
  } else {
    skipped.push(family);
  }

  const tx = photoRight + GAP, tw = W - tx - PAD;
  addCardText_(slide, family, answers, tx, PAD, tw, H - PAD * 2, { max: 22 });
}

/** Two slides per family: a full-screen photo, then the answers in large type. */
function buildSplitSlides_(deck, family, answers, fileId, skipped) {
  const W = deck.getPageWidth(), H = deck.getPageHeight();
  const capH = 34;

  const photoSlide = deck.appendSlide(TEMPLATE_);
  const img = insertPhoto_(photoSlide, fileId);
  if (img) {
    const boxW = W - PAD * 2, boxH = H - PAD * 2 - capH;
    const s = Math.min(boxW / img.getWidth(), boxH / img.getHeight());
    const w = img.getWidth() * s, h = img.getHeight() * s;
    img.setWidth(w).setHeight(h).setLeft((W - w) / 2).setTop(PAD + (boxH - h) / 2);
    img.getBorder().setWeight(3).getLineFill().setSolidFill(CONFIG.ACCENT_COLOR);
  } else {
    skipped.push(family);
  }
  addText_(photoSlide, family, PAD, H - PAD - capH, W - PAD * 2, capH,
           CONFIG.TITLE_FONT, 22, CONFIG.ACCENT_COLOR, true);

  const textSlide = deck.appendSlide(TEMPLATE_);
  addCardText_(textSlide, family, answers, W * 0.1, PAD, W * 0.8, H - PAD * 2, { max: 28 });
}

function insertPhoto_(slide, fileId) {
  const blob = fileBlob_(fileId);
  if (!blob) return null;
  try { return slide.insertImage(blob); } catch (e) { return null; }
}

function fileBlob_(fileId) {
  try { return DriveApp.getFileById(fileId).getBlob(); } catch (e) { return null; }
}

/** Family name + three labelled answers in one vertically centred box, font sized to fit. */
function addCardText_(slide, family, answers, x, y, w, h, opts) {
  const segs = [{ t: family, font: CONFIG.TITLE_FONT, k: 1.6, color: CONFIG.ACCENT_COLOR, bold: false, above: 0 }];
  answers.forEach((a, i) => {
    segs.push({ t: LABELS[i], font: CONFIG.BODY_FONT, k: 0.9, color: CONFIG.ACCENT_COLOR, bold: true, above: 0.9 });
    segs.push({ t: a, font: CONFIG.BODY_FONT, k: 1, color: CONFIG.TEXT_COLOR, bold: false, above: 0.1 });
  });
  const inset = 16; // Slides text boxes have ~7pt inner padding per side
  const size = fitFontSize_(segs, w - inset, h - inset, opts.max || 22, 9);

  const box = slide.insertTextBox(segs.map(s => s.t).join('\n'), x, y, w, h);
  box.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  const tr = box.getText();
  tr.getParagraphStyle().setLineSpacing(110);
  let pos = 0;
  segs.forEach(s => {
    const end = pos + s.t.length;
    if (end > pos) {
      const rng = tr.getRange(pos, end);
      rng.getTextStyle().setFontFamily(s.font).setFontSize(Math.round(size * s.k))
        .setForegroundColor(s.color).setBold(s.bold);
      rng.getParagraphStyle().setSpaceAbove(Math.round(size * s.above));
    }
    pos = end + 1; // skip the '\n'
  });
  return box;
}

/** Largest font size (pt) whose estimated wrapped height fits the box. */
function fitFontSize_(segs, w, h, max, min) {
  for (let s = max; s > min; s--) {
    let total = 0;
    segs.forEach(seg => {
      const fs = s * seg.k;
      const perLine = Math.max(1, Math.floor(w / (fs * 0.53)));
      const lines = Math.ceil(Math.max(1, seg.t.length) / perLine);
      total += lines * fs * 1.3 + s * seg.above;
    });
    if (total <= h * 0.9) return s;
  }
  return min;
}

/* ---------------- JSON endpoint (for the externally hosted form) ----------------
 * The form page can live anywhere (e.g. GitHub Pages) and POST here.
 * This avoids Google's multi-account bug, because no Google cookies are involved.
 */
function doPost(e) {
  try {
    submitResponse(JSON.parse(e.postData.contents));
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: err.message || String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- Reuse one deck ----------------
 * Rebuilds the same presentation every time (same link, no pile of old copies).
 * If you delete or trash the deck, the next build creates a fresh one.
 */
function getDeck_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('DECK_ID');
  if (id) {
    try {
      if (!DriveApp.getFileById(id).isTrashed()) {
        const deck = SlidesApp.openById(id);
        deck.getSlides().slice(1).forEach(s => s.remove()); // first slide is reused as the title
        return deck;
      }
    } catch (e) { /* deleted or inaccessible: create a new one below */ }
  }
  const deck = SlidesApp.create(CONFIG.PARTY_TITLE + ' Slideshow');
  props.setProperty('DECK_ID', deck.getId());
  return deck;
}


/* ---------------- Christmas decorations ---------------- */

let TEMPLATE_ = null;

/** Background + (optional) string of lights along the bottom edge. */
function decorate_(slide, W, H) {
  styleBg_(slide);
  if (!CONFIG.LIGHTS) return;
  const colors = ['#ff5a5a', '#ffd65a', '#6ee08a', '#6fb6ff'];
  const n = 30, step = W / n, y = H - 10;
  const wire = slide.insertLine(SlidesApp.LineCategory.STRAIGHT, 0, y - 1, W, y - 1);
  wire.setWeight(1).getLineFill().setSolidFill('#3d5a45');
  for (let i = 0; i < n; i++) {
    const b = slide.insertShape(SlidesApp.ShapeType.ELLIPSE, i * step + step / 2 - 2.5, y - 2, 5, 7.5);
    b.getFill().setSolidFill(colors[i % colors.length]);
    b.getBorder().setTransparent();
  }
}

/**
 * Feature artwork filling the slide height on one side. No frame: the image is pre-toned
 * and its edges fade into the midnight background, so it melts into the slide.
 * Returns the x where text can start.
 */
function placeFeature_(slide, blob, side, W, H) {
  const img = slide.insertImage(blob);
  const r = img.getWidth() / img.getHeight();
  let h = H - 12, w = h * r;                     // nearly full height (lights sit on top of the faded edge)
  if (w > W * 0.42) { w = W * 0.42; h = w / r; }
  const x = side === 'left' ? 0 : W - w;
  img.setWidth(w).setHeight(h).setLeft(x).setTop((H - 12 - h) / 2);
  return side === 'left' ? x + w + 8 : PAD;
}

/**
 * Centered block of lines in ONE text box, vertically centered, so lines can never overlap:
 * if anything wraps, everything below it moves down. `fit: true` shrinks that line so it
 * stays on one line (Playfair averages ~0.56em per character).
 */
function addStack_(slide, x, y, w, h, items) {
  items.forEach(it => {
    if (it.fit) it.size = Math.min(it.size, Math.floor((w - 20) / (it.t.length * 0.56)));
  });
  const box = slide.insertTextBox(items.map(it => it.t).join('\n'), x, y, w, h);
  box.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  const tr = box.getText();
  tr.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER).setLineSpacing(110);
  let pos = 0;
  items.forEach(it => {
    const end = pos + it.t.length;
    const rng = tr.getRange(pos, end);
    rng.getTextStyle().setFontFamily(it.font || CONFIG.BODY_FONT).setFontSize(it.size)
      .setForegroundColor(it.color).setItalic(!!it.italic);
    rng.getParagraphStyle().setSpaceAbove(it.above || 0);
    pos = end + 1;
  });
  return box;
}
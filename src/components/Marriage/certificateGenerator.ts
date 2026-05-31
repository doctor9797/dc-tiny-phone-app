// ── Real Marriage Certificate Generator ──
// US: cream paper, ornate border, state seal, official document layout
// Chinese: warm ivory paper, red borders & text, anti-counterfeit 囍 watermark, registration style

const CERT_WIDTH = 660;
const CERT_HEIGHT = 880;

// ── Font Loading ──

let fontsLoaded = false;
let fontsPromise: Promise<void> | null = null;

export async function loadHandwritingFonts(): Promise<void> {
  if (fontsLoaded) return;
  if (fontsPromise) return fontsPromise;

  fontsPromise = new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Pacifico&display=swap';
    link.onload = async () => {
      try {
        await document.fonts.ready;
        await Promise.allSettled([
          document.fonts.load('36px "Ma Shan Zheng"'),
          document.fonts.load('36px "Pacifico"'),
        ]);
        fontsLoaded = true;
      } catch {}
      resolve();
    };
    link.onerror = () => resolve();
    document.head.appendChild(link);
    setTimeout(() => resolve(), 4000);
  });

  return fontsPromise;
}

// ── Helpers ──

function drawRoundedRect(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

// ── Render signature image from text ──

async function renderSignatureImage(
  text: string,
  isEnglish: boolean,
  color: string,
): Promise<string> {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d')!;

  const fontSize = isEnglish ? 40 : 42;

  const cnFont = fontsLoaded
    ? '"Ma Shan Zheng", "STKaiti", "KaiTi", "cursive", serif'
    : '"STKaiti", "KaiTi", "cursive", serif';
  const enFont = fontsLoaded
    ? '"Pacifico", "Brush Script MT", "Apple Chancery", "cursive", serif'
    : '"Brush Script MT", "Apple Chancery", "cursive", serif';

  const fontFamily = isEnglish ? enFont : cnFont;
  tempCtx.font = `${fontSize}px ${fontFamily}`;

  const metrics = tempCtx.measureText(text);
  const textWidth = metrics.width;
  const pad = 28;
  const w = Math.ceil(Math.max(textWidth + pad * 2, 120));
  const h = Math.ceil(fontSize * 2.4);

  tempCanvas.width = w;
  tempCanvas.height = h;

  tempCtx.font = `${fontSize}px ${fontFamily}`;
  tempCtx.textAlign = 'center';
  tempCtx.textBaseline = 'middle';
  tempCtx.fillStyle = color;

  if (isEnglish) {
    tempCtx.save();
    tempCtx.transform(1, 0, 0.08, 1, 0, 0);
    tempCtx.fillText(text, w / 2, h / 2 + 4);
    tempCtx.restore();
  } else {
    tempCtx.fillText(text, w / 2, h / 2 + 6);
  }

  return tempCanvas.toDataURL('image/png');
}

// ══════════════════════════════════════════
//  US FORMAT — Official state document style
// ══════════════════════════════════════════

function drawUSCertificate(
  ctx: CanvasRenderingContext2D,
  type: 'marriage' | 'divorce',
  userName: string,
  characterName: string,
  userSigImg: HTMLImageElement,
  charSigImg: HTMLImageElement,
  dateStr: string,
) {
  const w = CERT_WIDTH;
  const h = CERT_HEIGHT;
  const isMarriage = type === 'marriage';

  // ── Background: warm cream with subtle vignette ──
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#f5e6c8');
  bg.addColorStop(0.25, '#fdf2dc');
  bg.addColorStop(0.75, '#fdf2dc');
  bg.addColorStop(1, '#ecd9b5');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // ── Ornate double border ──
  ctx.save();
  // Outer thick border
  ctx.strokeStyle = '#8B6914';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  // Inner thin border
  ctx.strokeStyle = '#c4a35a';
  ctx.lineWidth = 1;
  ctx.strokeRect(28, 28, w - 56, h - 56);
  ctx.restore();

  // ── Corner ornaments ──
  ctx.save();
  ctx.strokeStyle = '#8B6914';
  ctx.fillStyle = '#c4a35a';
  ctx.lineWidth = 1.5;
  const corners = [[40, 40], [w - 40, 40], [w - 40, h - 40], [40, h - 40]];
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ── State / County header ──
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5a3e1b';
  ctx.font = '13px "Georgia", "Times New Roman", serif';
  ctx.fillText('STATE OF GOTHAM', w / 2, 90);
  ctx.font = '11px "Georgia", "Times New Roman", serif';
  ctx.fillText('COUNTY OF GOTHAM', w / 2, 108);

  // ── Small decorative line ──
  ctx.save();
  ctx.strokeStyle = '#c4a35a';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(180, 120);
  ctx.lineTo(w - 180, 120);
  ctx.stroke();
  ctx.restore();

  // ── Title ──
  ctx.fillStyle = '#3a2a10';
  ctx.font = 'bold 30px "Georgia", "Times New Roman", serif';
  ctx.fillText(
    isMarriage ? 'Certificate of Marriage' : 'Certificate of Divorce',
    w / 2, 163,
  );

  // ── Chinese subtitle ──
  ctx.fillStyle = '#8B6914';
  ctx.font = '12px "KaiTi","STKaiti","Georgia",serif';
  ctx.fillText(
    isMarriage ? '结  婚  证  书' : '离  婚  证  书',
    w / 2, 185,
  );

  // ── Gold Seal ──
  ctx.save();
  ctx.strokeStyle = '#8B6914';
  ctx.fillStyle = '#fdf2dc';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(w / 2, 245, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(w / 2, 245, 21, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#8B6914';
  ctx.font = '14px "Georgia",serif';
  ctx.fillText('★', w / 2, 243);
  ctx.font = '7px "Georgia",serif';
  ctx.fillText('OFFICIAL SEAL', w / 2, 258);
  ctx.restore();

  // ── "This is to certify that" ──
  ctx.fillStyle = '#5a3e1b';
  ctx.font = '15px "Georgia", "Times New Roman", serif';
  ctx.fillText('This is to certify that', w / 2, 305);

  // ── Names (well spaced, "and" sits above, not overlapping) ──
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 26px "Georgia", "Times New Roman", serif';

  const nameY = 358;

  ctx.textAlign = 'right';
  ctx.fillText(userName, w / 2 - 16, nameY);

  ctx.textAlign = 'left';
  ctx.fillText(characterName, w / 2 + 16, nameY);

  // "and" centred between them on the same line
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8B6914';
  ctx.font = '18px "Georgia",serif';
  ctx.fillText('and', w / 2, nameY);

  // ── Union / Dissolution text ──
  ctx.fillStyle = '#5a3e1b';
  ctx.font = '15px "Georgia", "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    isMarriage ? 'were united in marriage on' : 'have dissolved their marriage on',
    w / 2, 415,
  );

  // ── Date ──
  ctx.fillStyle = '#3a2a10';
  ctx.font = 'bold 19px "Georgia", "Times New Roman", serif';
  ctx.fillText(dateStr, w / 2, 452);

  // ── Location ──
  ctx.fillStyle = '#8B6914';
  ctx.font = '12px "Georgia", "Times New Roman", serif';
  ctx.fillText('Gotham City, Wayne Manor', w / 2, 478);

  // ── Divider ──
  ctx.save();
  ctx.strokeStyle = '#c4a35a';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(150, 505);
  ctx.lineTo(w - 150, 505);
  ctx.stroke();
  ctx.restore();

  // ── Officiant ──
  ctx.fillStyle = '#5a3e1b';
  ctx.font = '12px "Georgia", serif';
  ctx.textAlign = 'center';
  ctx.fillText('Officiated by', w / 2, 535);

  ctx.fillStyle = '#3a2a10';
  ctx.font = 'bold 16px "Georgia", "Times New Roman", serif';
  ctx.fillText('Rev. Alfred Pennyworth', w / 2, 557);

  ctx.fillStyle = '#8B6914';
  ctx.font = '11px "Georgia", serif';
  ctx.fillText('__________________________________', w / 2, 578);

  // ── Witness ──
  ctx.fillStyle = '#5a3e1b';
  ctx.font = '12px "Georgia", serif';
  ctx.textAlign = 'center';
  ctx.fillText('In the presence of witnesses', w / 2, 612);

  ctx.fillStyle = '#8B6914';
  ctx.font = '11px "Georgia", serif';
  ctx.fillText('__________________________________', w / 2, 635);
  ctx.font = '10px "Georgia", serif';
  ctx.fillText('Witness', w / 2, 650);

  // ── Bottom divider ──
  ctx.save();
  ctx.strokeStyle = '#c4a35a';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(80, 678);
  ctx.lineTo(w - 80, 678);
  ctx.stroke();
  ctx.restore();

  // ── Signature boxes ──
  const sigY = 695;
  const sigW = 210;
  const sigH = 72;

  drawSignatureBox(ctx, 70, sigY, sigW, sigH, userSigImg,
    'PARTY / 当事人', userName, '#2c3e50', '#5a3e1b');
  drawSignatureBox(ctx, w - 70 - sigW, sigY, sigW, sigH, charSigImg,
    'PARTY / 当事人', characterName, '#2c3e50', '#5a3e1b');

  // ── County Clerk ──
  ctx.fillStyle = '#8B6914';
  ctx.font = '10px "Georgia", "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillText('Filed with the County Clerk of Gotham County', w / 2, h - 50);
  ctx.fillStyle = '#c4a35a';
  ctx.font = '10px "Georgia", serif';
  ctx.fillText('Book ______  Page ______', w / 2, h - 35);
}

// ══════════════════════════════════════════
//  CHINESE FORMAT — Interior page of the red booklet
//  Background is warm ivory; borders and text are RED, not gold
// ══════════════════════════════════════════

function drawChineseCertificate(
  ctx: CanvasRenderingContext2D,
  type: 'marriage' | 'divorce',
  userName: string,
  characterName: string,
  userSigImg: HTMLImageElement,
  charSigImg: HTMLImageElement,
  dateStr: string,
  charIsForeign: boolean,
  userBirthDate: string,
  characterBirthDate: string,
) {
  const w = CERT_WIDTH;
  const h = CERT_HEIGHT;
  const isMarriage = type === 'marriage';

  // ── Background: warm ivory (like real certificate paper) ──
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#fdf5e6');
  bg.addColorStop(0.5, '#fff8ef');
  bg.addColorStop(1, '#f5edd6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // ── Subtle anti-counterfeit wavy pattern ──
  ctx.save();
  ctx.strokeStyle = 'rgba(200, 50, 50, 0.04)';
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += 18) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const yy = y + Math.sin((x + y) * 0.03) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // ── 囍 watermark (subtle, pale red) ──
  ctx.save();
  ctx.fillStyle = 'rgba(200, 50, 50, 0.06)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const xiPositions = [
    [w * 0.25, h * 0.2], [w * 0.75, h * 0.2],
    [w * 0.25, h * 0.45], [w * 0.75, h * 0.45],
    [w * 0.25, h * 0.7], [w * 0.75, h * 0.7],
    [w * 0.5, h * 0.33], [w * 0.5, h * 0.58],
  ];
  for (const [x, y] of xiPositions) {
    ctx.font = '80px "KaiTi","STKaiti","SimSun",serif';
    ctx.fillText('囍', x, y);
  }
  ctx.restore();

  // ── Border: double red lines with rounded corners ──
  ctx.save();
  ctx.strokeStyle = '#CC0000';
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, 18, 18, w - 36, h - 36, 8);
  ctx.stroke();
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, 28, 28, w - 56, h - 56, 5);
  ctx.stroke();

  // Corner dots
  ctx.fillStyle = '#CC0000';
  const dot = (dx: number, dy: number) => {
    ctx.beginPath();
    ctx.arc(dx, dy, 4, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(34, 34); dot(w - 34, 34);
  dot(34, h - 34); dot(w - 34, h - 34);
  ctx.restore();

  // ── Photo area (left) with red border ──
  const photoX = 50;
  const photoY = 170;
  const photoW = 140;
  const photoH = 180;

  ctx.save();
  ctx.strokeStyle = '#CC0000';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(photoX, photoY, photoW, photoH);

  // Inner thin border
  ctx.lineWidth = 0.5;
  ctx.strokeRect(photoX + 4, photoY + 4, photoW - 8, photoH - 8);

  // Photo placeholder text
  ctx.fillStyle = 'rgba(200, 0, 0, 0.25)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '13px "KaiTi","STKaiti",serif';
  ctx.fillText('贴照片处', photoX + photoW / 2, photoY + photoH / 2);

  // Red corner brackets
  ctx.strokeStyle = '#CC0000';
  ctx.lineWidth = 2;
  const bracket = (x: number, y: number, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(x + dx * 15, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * 15);
    ctx.stroke();
  };
  bracket(photoX, photoY, 1, 1);
  bracket(photoX + photoW, photoY, -1, 1);
  bracket(photoX, photoY + photoH, 1, -1);
  bracket(photoX + photoW, photoY + photoH, -1, -1);
  ctx.restore();

  // ── Certificate number (above info) ──
  ctx.fillStyle = '#CC0000';
  ctx.textAlign = 'left';
  ctx.font = '11px "KaiTi","STKaiti","SimSun",serif';
  const certNo = `字 号：${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;
  ctx.fillText(certNo, photoX + photoW + 24, photoY + 8);

  // ── Title ──
  ctx.textAlign = 'center';
  ctx.fillStyle = '#CC0000';
  ctx.font = 'bold 32px "KaiTi","STKaiti","SimSun",serif';
  ctx.fillText(isMarriage ? '结 婚 证' : '离 婚 证', w / 2, 122);

  // ── Small 囍 above title ──
  ctx.font = '24px "KaiTi","STKaiti","SimSun",serif';
  ctx.fillText('囍', w / 2, 78);

  // ── Info section ──
  const infoX = photoX + photoW + 24;
  let iy = photoY + 40;
  const ilh = 32;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '14px "KaiTi","STKaiti","SimSun",serif';
  ctx.fillStyle = '#CC0000';

  const row = (label: string, value: string) => {
    ctx.fillStyle = '#CC0000';
    ctx.font = '14px "KaiTi","STKaiti","SimSun",serif';
    ctx.fillText(label, infoX, iy);
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 16px "KaiTi","STKaiti","SimSun",serif';
    ctx.fillText(value, infoX + 70, iy);
    iy += ilh;
  };

  if (isMarriage) {
    row('持 证 人：', userName);
    row('性    别：', '女');
    row('出生日期：', userBirthDate);
    row('国    籍：', '中国');
    iy += 12;
    row('配    偶：', characterName);
    row('性    别：', '男');
    row('出生日期：', characterBirthDate);
    row('国    籍：', charIsForeign ? '美国（USA）' : '中国');
  } else {
    row('男    方：', userName);
    row('性    别：', '女');
    row('出生日期：', userBirthDate);
    row('国    籍：', '中国');
    iy += 12;
    row('女    方：', characterName);
    row('性    别：', '男');
    row('出生日期：', characterBirthDate);
    row('国    籍：', charIsForeign ? '美国（USA）' : '中国');
  }

  // ── Red divider ──
  const divY = Math.max(iy + 16, 570);
  ctx.save();
  ctx.strokeStyle = '#CC0000';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(50, divY);
  ctx.lineTo(w - 50, divY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── Legal text ──
  let ty = divY + 28;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#CC0000';
  ctx.font = '13px "KaiTi","STKaiti","SimSun",serif';
  ctx.fillText('经审查符合《中华人民共和国民法典》规定，', w / 2, ty);
  ty += 24;
  ctx.fillText(
    isMarriage ? '予以登记，发给此证。' : '予以登记，准予离婚。',
    w / 2, ty,
  );

  // ── Registration info ──
  ty += 40;
  ctx.font = '14px "KaiTi","STKaiti","SimSun",serif';
  ctx.fillStyle = '#CC0000';
  ctx.fillText('登记机关：哥谭市民政局', w / 2, ty);
  ty += 28;
  ctx.fillText(`登记日期：${dateStr}`, w / 2, ty);

  // ── Red round stamp ──
  ctx.save();
  const sx = w - 100;
  const sy = ty - 20;
  ctx.strokeStyle = '#CC0000';
  ctx.fillStyle = 'rgba(200, 0, 0, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();

  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(sx, sy, 31, 0, Math.PI * 2);
  ctx.stroke();

  // Star
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '16px "Arial",sans-serif';
  ctx.fillText('★', sx, sy);

  // Text inside stamp
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '7px "KaiTi","STKaiti","SimSun",serif';
  ctx.fillText('哥谭市民政局', sx, sy - 20);
  ctx.font = '7px "Arial",sans-serif';
  ctx.fillText('婚姻登记专用章', sx, sy + 22);
  ctx.restore();

  // ── Signature boxes ──
  const sigY = ty + 40;
  const sigW = 190;
  const sigH = 66;
  const sigGap = 30;

  drawSignatureBox(ctx, w / 2 - sigGap - sigW, sigY, sigW, sigH, userSigImg,
    isMarriage ? '持证人签名' : '男方签名', userName, '#CC0000', '#CC0000');
  drawSignatureBox(ctx, w / 2 + sigGap, sigY, sigW, sigH, charSigImg,
    isMarriage ? '配偶签名' : '女方签名', characterName, '#CC0000', '#CC0000');

  // ── Bottom text ──
  ctx.save();
  ctx.strokeStyle = '#CC0000';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(60, h - 32);
  ctx.lineTo(w - 60, h - 32);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(200, 0, 0, 0.35)';
  ctx.font = '8px "KaiTi","STKaiti","SimSun",serif';
  ctx.textAlign = 'center';
  ctx.fillText('中华人民共和国民政部监制', w / 2, h - 20);
}

// ── Draw signature box ──

function drawSignatureBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, boxW: number, boxH: number,
  img: HTMLImageElement | null,
  label: string,
  name: string,
  borderColor: string,
  labelColor: string,
) {
  ctx.save();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, boxW, boxH);

  if (img && img.width > 0 && img.height > 0) {
    const pad = 6;
    const drawW = boxW - pad * 2;
    const drawH = boxH - pad * 2;
    const aspect = img.width / img.height;
    let rw = drawW;
    let rh = drawW / aspect;
    if (rh > drawH) { rh = drawH; rw = drawH * aspect; }
    ctx.drawImage(img, x + boxW / 2 - rw / 2, y + boxH / 2 - rh / 2, rw, rh);
  }

  ctx.textAlign = 'center';
  ctx.font = '9px "KaiTi","STKaiti","Georgia",serif';
  ctx.fillStyle = labelColor;
  ctx.fillText(label, x + boxW / 2, y - 5);

  ctx.font = '10px "KaiTi","STKaiti","Georgia",serif';
  ctx.fillStyle = labelColor;
  ctx.fillText(name, x + boxW / 2, y + boxH + 14);
  ctx.restore();
}

// ══════════════════════════════════════════
//  Main entry
// ══════════════════════════════════════════

export async function generateCertificate(
  format: 'us' | 'chinese',
  type: 'marriage' | 'divorce',
  userName: string,
  characterName: string,
  userSignatureDataUrl: string,
  characterSignatureText: string,
  charSigIsEnglish: boolean,
  dateStr: string,
  userBirthDate: string,
  characterBirthDate: string,
): Promise<string> {
  await loadHandwritingFonts();

  const charSigDataUrl = await renderSignatureImage(
    characterSignatureText, charSigIsEnglish, '#1a1a1a',
  );

  const [userSigImg, charSigImg] = await Promise.all([
    loadImage(userSignatureDataUrl),
    loadImage(charSigDataUrl),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = CERT_WIDTH;
  canvas.height = CERT_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  if (format === 'us') {
    drawUSCertificate(ctx, type, userName, characterName, userSigImg, charSigImg, dateStr);
  } else {
    drawChineseCertificate(ctx, type, userName, characterName, userSigImg, charSigImg, dateStr, charSigIsEnglish, userBirthDate, characterBirthDate);
  }

  return canvas.toDataURL('image/png');
}

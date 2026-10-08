/**
 * Proje taslak dosyasını üretir: proje-taslak.kaynak.html → proje-taslak.html → Proje-Taslak-Dosyasi.pdf
 * Veritabanı bölümü (ilişki çizimleri ve tablo listesi) apps/api/prisma/schema.prisma dosyasından üretilir;
 * şema değişince belge elle güncellenmez. Kullanım (depo kökünden): node docs/taslak/build.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const schema = fs.readFileSync(path.join(root, 'apps/api/prisma/schema.prisma'), 'utf8');

// ---------------------------------------------------------------- Şemayı oku

const TYPE_TR = { String: 'metin', Int: 'tam sayı', Float: 'ondalık', Boolean: 'mantıksal', DateTime: 'tarih-saat', Json: 'JSON', BigInt: 'büyük sayı' };
const DESCRIPTIONS = {
  Term: 'Akademik dönem (yıl + güz/bahar); biri içinde bulunulan dönemdir.',
  RuleDefinition: 'Kural sürümündeki tek kural: kod, tür, dayanak madde, aşama, değerler.',
  GradeSubmissionItem: 'Not gönderimindeki tek ders ve notu; ders denemesine bağlanır.',
  ProtocolTemplateItem: 'Şablon satırı: ders ya da teknik seçmeli ders yeri.',
  Notification: 'Sistem içi bildirim (yeni mesaj, ret, belge isteği, kural uyarısı).',
};

const enums = new Set([...schema.matchAll(/^enum (\w+)/gm)].map((m) => m[1]));
const models = [];
{
  const lines = schema.split(/\r?\n/);
  let doc = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!cur) {
      if (line.startsWith('///')) doc.push(line.slice(3).trim());
      else if (line.startsWith('model ')) {
        cur = { name: line.split(/\s+/)[1], doc: doc.join(' '), fields: [], fks: {}, compositePk: [] };
        doc = [];
      } else if (line !== '') doc = [];
      continue;
    }
    if (line === '}') {
      models.push(cur);
      cur = null;
      continue;
    }
    if (line.startsWith('@@id')) cur.compositePk = line.match(/\[(.*?)\]/)[1].split(',').map((s) => s.trim());
    if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
    const [name, type, ...rest] = line.split(/\s+/);
    const attrs = rest.join(' ');
    const base = type.replace(/[?\[\]]/g, '');
    const rel = attrs.match(/@relation\(fields: \[(.*?)\], references: \[(.*?)\]/);
    if (rel) rel[1].split(',').forEach((f) => (cur.fks[f.trim()] = base));
    cur.fields.push({ name, type, base, optional: type.endsWith('?'), list: type.endsWith('[]'), pk: /@id\b/.test(attrs), unique: /@unique\b/.test(attrs) });
  }
}
const modelNames = new Set(models.map((m) => m.name));
for (const m of models) {
  m.columns = m.fields.filter((f) => !modelNames.has(f.base));
  for (const c of m.columns) {
    c.fk = m.fks[c.name] ?? null;
    if (m.compositePk.includes(c.name)) c.pk = true;
  }
}
const TABLE_COUNT = models.length;

// ---------------------------------------------------------------- İlişki çizimi (SVG)

const W = 180;
const GAP_X = 22;
const GAP_Y = 30;
const LINE = 11.5;
const HEAD = 19;

function diagram(nodes, edges, cols) {
  const byName = {};
  const rowHeights = [];
  for (const n of nodes) {
    n.h = HEAD + n.lines.length * LINE + 7;
    rowHeights[n.row] = Math.max(rowHeights[n.row] ?? 0, n.h);
    byName[n.name] = n;
  }
  const rowY = [];
  let y = 4;
  rowHeights.forEach((h, i) => {
    rowY[i] = y;
    y += h + GAP_Y;
  });
  for (const n of nodes) {
    n.x = 4 + n.col * (W + GAP_X);
    n.y = rowY[n.row] + (rowHeights[n.row] - n.h) / 2;
    n.cx = n.x + W / 2;
    n.cy = n.y + n.h / 2;
  }
  const width = 8 + cols * W + (cols - 1) * GAP_X;
  const height = y - GAP_Y + 4;

  // Kutunun kenarındaki kesişim noktası (merkezden hedefe giden doğru üzerinde)
  const edgePoint = (n, tx, ty) => {
    const dx = tx - n.cx;
    const dy = ty - n.cy;
    const sx = dx === 0 ? Infinity : W / 2 / Math.abs(dx);
    const sy = dy === 0 ? Infinity : n.h / 2 / Math.abs(dy);
    const s = Math.min(sx, sy);
    return [n.cx + dx * s, n.cy + dy * s];
  };

  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px;display:block;margin:6px auto 10px" font-family="Segoe UI, Arial, sans-serif">`;
  for (const [from, to, kind] of edges) {
    const a = byName[from];
    const b = byName[to];
    if (!a || !b) throw new Error(`Çizimde olmayan tablo: ${from} → ${to}`);
    const [x1, y1] = edgePoint(a, b.cx, b.cy);
    const [x2, y2] = edgePoint(b, a.cx, a.cy);
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#1c458b" stroke-width="1.1"/>`;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    if (kind !== '1') {
      // Çatal: "çok" tarafı
      const bx = x2 - ux * 9;
      const by = y2 - uy * 9;
      for (const s of [-1, 1]) out += `<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${(x2 - uy * 4.5 * s).toFixed(1)}" y2="${(y2 + ux * 4.5 * s).toFixed(1)}" stroke="#1c458b" stroke-width="1.1"/>`;
    } else {
      const bx = x2 - ux * 5;
      const by = y2 - uy * 5;
      out += `<line x1="${(bx - uy * 4).toFixed(1)}" y1="${(by + ux * 4).toFixed(1)}" x2="${(bx + uy * 4).toFixed(1)}" y2="${(by - ux * 4).toFixed(1)}" stroke="#1c458b" stroke-width="1.1"/>`;
    }
    const sx = x1 + ux * 5;
    const sy = y1 + uy * 5;
    out += `<line x1="${(sx - uy * 4).toFixed(1)}" y1="${(sy + ux * 4).toFixed(1)}" x2="${(sx + uy * 4).toFixed(1)}" y2="${(sy - ux * 4).toFixed(1)}" stroke="#1c458b" stroke-width="1.1"/>`;
  }
  for (const n of nodes) {
    out += `<rect x="${n.x}" y="${n.y.toFixed(1)}" width="${W}" height="${n.h.toFixed(1)}" rx="4" fill="#fff" stroke="#1c458b" stroke-width="1"/>`;
    out += `<rect x="${n.x}" y="${n.y.toFixed(1)}" width="${W}" height="${HEAD}" rx="4" fill="${n.muted ? '#475569' : '#1c458b'}"/><rect x="${n.x}" y="${(n.y + HEAD - 4).toFixed(1)}" width="${W}" height="4" fill="${n.muted ? '#475569' : '#1c458b'}"/>`;
    out += `<text x="${n.x + 7}" y="${(n.y + 13.5).toFixed(1)}" font-size="9.6" font-weight="600" fill="#fff">${n.name}</text>`;
    n.lines.forEach((l, i) => {
      const m = l.match(/^(PK|FK) (.*)$/);
      const ty = (n.y + HEAD + 11 + i * LINE).toFixed(1);
      if (m) out += `<text x="${n.x + 7}" y="${ty}" font-size="7.4" font-weight="700" fill="${m[1] === 'PK' ? '#a16207' : '#1c458b'}">${m[1]}</text><text x="${n.x + 24}" y="${ty}" font-size="8.4" fill="#212529">${m[2]}</text>`;
      else out += `<text x="${n.x + 7}" y="${ty}" font-size="8.4" fill="#475569">${l}</text>`;
    });
  }
  return out + '</svg>';
}

/** Kutu satırları şemadan üretilir: anahtarlar tek tek, diğer alanlar özet olarak. */
function node(name, col, row, extra = []) {
  const m = models.find((x) => x.name === name);
  if (!m) throw new Error(`Şemada olmayan tablo: ${name}`);
  const lines = [];
  for (const c of m.columns) {
    if (c.pk) lines.push(`PK ${c.name}`);
    else if (c.fk) lines.push(`FK ${c.name} → ${c.fk}`);
  }
  return { name, col, row, lines: [...lines, ...extra] };
}

const ref = (name, col, row) => ({ ...node(name, col, row, ['(bkz. 6.1)']), muted: true });

const erA = diagram(
  [
    node('Program', 0, 0, ['name, faculty, isHome']),
    node('Student', 1, 0, ['fullName, schoolEmail, track,', 'status, source, externalRef']),
    node('User', 2, 0, ['username, role, active, invitedAt']),
    node('Term', 3, 0, ['year, season, isCurrent']),
    node('CourseRequest', 0, 1, ['code, name, note, status']),
    node('PlanItem', 1, 1, ['kind, semester, status,', 'addReason, removedAt, exemptAt']),
    node('GanoRecord', 2, 1, ['gano, source, sourceNote, cancelledAt']),
    node('TermLeave', 3, 1, ['reason, note, cancelledAt']),
    node('Course', 0, 2, ['name, ects, semester, kind, active']),
    node('CourseAttempt', 1, 2, ['grade, result, status, source']),
    node('GradeSubmissionItem', 2, 2, ['grade']),
    node('GradeSubmission', 3, 2, ['status, submittedAt']),
  ],
  [
    ['Program', 'Student'],
    ['User', 'Student', '1'],
    ['Student', 'CourseRequest'],
    ['Student', 'PlanItem'],
    ['Student', 'GanoRecord'],
    ['Term', 'TermLeave'],
    ['Course', 'PlanItem'],
    ['Course', 'CourseAttempt'],
    ['PlanItem', 'CourseAttempt'],
    ['CourseAttempt', 'GradeSubmissionItem'],
    ['GradeSubmission', 'GradeSubmissionItem'],
  ],
  4,
);

const erB = diagram(
  [
    ref('User', 0, 0),
    node('Message', 1, 0, ['body, readAt']),
    ref('Student', 2, 0),
    node('StudentNote', 3, 0, ['body, cancelledAt']),
    ref('GradeSubmission', 0, 1),
    node('Document', 1, 1, ['kind, fileName, mimeType, size,', 'sha256, status, previousId']),
    node('DocumentRequest', 2, 1, ['kind, message, status']),
  ],
  [
    ['User', 'Message'],
    ['Student', 'Message'],
    ['Student', 'StudentNote'],
    ['Student', 'DocumentRequest'],
    ['Student', 'Document'],
    ['Message', 'Document'],
    ['DocumentRequest', 'Document'],
    ['Document', 'GradeSubmission'],
  ],
  4,
);

const erC = diagram(
  [
    node('RuleDefinition', 0, 0, ['code, kind, article, phase, params']),
    node('RuleSet', 1, 0, ['version, type, status, effectiveFrom']),
    node('RuleCheck', 2, 0, ['trigger, inputs, results, worst']),
    node('StudentDecision', 3, 0, ['type, reference, reason,', 'newStatus, cancelledAt']),
    { ...node('AuditLog', 0, 1, ['at, actor, actorRole, action,', 'entity, before, after, reason']), muted: true },
    { ...node('ImportBatch', 1, 1, ['kind, rowCount, okCount, summary']), muted: true },
    ref('Student', 2, 1),
    { ...node('Notification', 3, 1, ['username, title, body, readAt']), muted: true },
    node('ProtocolTemplateItem', 0, 2, ['kind, code, name, ects, semester']),
    node('ProtocolTemplate', 1, 2, ['type, title, commonEcts']),
    node('ProtocolCondition', 2, 2, ['no, sourceCourseCode,', 'targetCourseCode']),
    ref('Program', 3, 2),
  ],
  [
    ['RuleSet', 'RuleDefinition'],
    ['RuleSet', 'RuleCheck'],
    ['RuleCheck', 'StudentDecision'],
    ['Student', 'RuleCheck'],
    ['Student', 'StudentDecision'],
    ['ProtocolTemplate', 'ProtocolTemplateItem'],
    ['ProtocolTemplate', 'ProtocolCondition'],
  ],
  4,
);

// ---------------------------------------------------------------- Tablo listesi

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function columnHtml(c) {
  const type = enums.has(c.base) ? `seçenek (${c.base})` : (TYPE_TR[c.base] ?? c.base);
  const tags = [c.pk ? '<b class="pk">PK</b>' : '', c.fk ? `<b class="fk">FK→${c.fk}</b>` : '', c.unique ? '<i>benzersiz</i>' : '', c.optional ? '<i>boş olabilir</i>' : ''].filter(Boolean).join(' ');
  return `<span class="col"><span class="code">${c.name}</span> <span class="src">${type}</span>${tags ? ' ' + tags : ''}</span>`;
}
const tables =
  '<table class="schema"><thead><tr><th style="width:17%">Tablo</th><th style="width:27%">Ne tutar</th><th>Alanlar</th></tr></thead><tbody>' +
  models
    .map((m) => `<tr><td class="code"><b>${m.name}</b></td><td>${esc(m.doc || DESCRIPTIONS[m.name] || '')}</td><td>${m.columns.map(columnHtml).join(' · ')}</td></tr>`)
    .join('') +
  '</tbody></table>';

const undocumented = models.filter((m) => !m.doc && !DESCRIPTIONS[m.name]).map((m) => m.name);
if (undocumented.length) throw new Error(`Açıklaması olmayan tablo: ${undocumented.join(', ')}`);

// ---------------------------------------------------------------- HTML ve PDF

const source = fs.readFileSync(path.join(__dirname, 'proje-taslak.kaynak.html'), 'utf8');
const html = source
  .replace('<!--COUNT-->', String(TABLE_COUNT))
  .replace('<!--ER-A-->', erA)
  .replace('<!--ER-B-->', erB)
  .replace('<!--ER-C-->', erC)
  .replace('<!--TABLES-->', tables);
const htmlPath = path.join(__dirname, 'proje-taslak.html');
fs.writeFileSync(htmlPath, html);

(async () => {
  const { chromium } = require(path.join(root, 'e2e/node_modules/@playwright/test'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'));
  await page.pdf({
    path: path.join(__dirname, 'Proje-Taslak-Dosyasi.pdf'),
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;font-size:8px;color:#475569;padding:0 16mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial,sans-serif"><span>Bilgisayar Mühendisliği ÇAP ve YDP Öğrenci Takip Sistemi — Proje Taslak Dosyası</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
  });
  await browser.close();
  console.log(`${TABLE_COUNT} tablo → ${path.relative(root, htmlPath)}, Proje-Taslak-Dosyasi.pdf`);
})();

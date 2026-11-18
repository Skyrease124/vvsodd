// Small, dependency-free writers for the export formats: CSV, ZIP, XLSX (a zip of XML) and simple PDFs. Used only by lib/exports.mjs.
import zlib from 'node:zlib';

export function csv(rows) { const q = v => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; return rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n'; }

// ZIP (deflate). files: [{ name, data: Buffer }]
export function zip(files) {
  const local = [], central = []; let off = 0; const t = new Date(), dt = ((t.getUTCFullYear() - 1980) << 9 | (t.getUTCMonth() + 1) << 5 | t.getUTCDate()), tm = (t.getUTCHours() << 11 | t.getUTCMinutes() << 5 | t.getUTCSeconds() >> 1);
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'), raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data), def = zlib.deflateRawSync(raw), crc = zlib.crc32(raw) >>> 0, useDef = def.length < raw.length, body = useDef ? def : raw, method = useDef ? 8 : 0;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(method, 8); h.writeUInt16LE(tm, 10); h.writeUInt16LE(dt, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(name.length, 26); h.writeUInt16LE(0, 28);
    local.push(h, name, body);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(method, 10); c.writeUInt16LE(tm, 12); c.writeUInt16LE(dt, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, name); off += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...local, cd, end]);
}

// XLSX: one sheet, bold header row, frozen header, sensible column widths. Numbers stay numbers; text is escaped.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const col = n => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
export function xlsx(head, rows, sheetName = 'Properties') {
  const cell = (v, r, c, hdr) => { const ref = col(c) + (r + 1); if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"><v>' + v + '</v></c>'; if (v === '' || v == null) return ''; return '<c r="' + ref + '" t="inlineStr"' + (hdr ? ' s="1"' : '') + '><is><t xml:space="preserve">' + esc(v) + '</t></is></c>'; };
  const widths = head.map((h, c) => Math.min(48, Math.max(h.length + 2, ...rows.slice(0, 200).map(r => String(r[c] == null ? '' : r[c]).length + 2)))), all = [head, ...rows];
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols><sheetData>' + all.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => cell(v, ri, ci, ri === 0)).join('') + '</row>').join('') + '</sheetData></worksheet>';
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zip([
    { name: '[Content_Types].xml', data: X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { name: '_rels/.rels', data: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + esc(sheetName) + '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', data: X + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F2EC"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>' },
    { name: 'xl/worksheets/sheet1.xml', data: sheet }].map(f => ({ name: f.name, data: Buffer.from(f.data, 'utf8') })));
}

// PDF: one information sheet per item (Helvetica, WinAnsi). pages: [{ title, sub, lines: [[label, value]] }]
const wrap = (s, n) => { const out = []; for (const para of String(s).split('\n')) { let line = ''; for (const w of para.split(/\s+/)) { if (w.length > n) { if (line) { out.push(line); line = ''; } for (let i = 0; i < w.length; i += n) out.push(w.slice(i, i + n)); continue; } if ((line + ' ' + w).trim().length > n) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); } out.push(line); } return out; };
const ps = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/·/g, '-').replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');
export function pdf(items, notes) {
  const pages = []; // each page: array of [x, y, size, bold, text]
  for (const it of items) {
    let ops = [], y = 750; const newPage = () => { ops = []; pages.push(ops); y = 750; };
    newPage(); ops.push([54, y, 11, false, 'PricePocketAsset  |  Property information sheet']); y -= 30; wrap(it.title, 52).slice(0, 2).forEach(l => { ops.push([54, y, 18, true, l]); y -= 22; }); ops.push([54, y, 11, false, it.sub]); y -= 28;
    for (const [k, v] of it.lines) { const vl = wrap(v, 62); if (y < 110 + vl.length * 13) { newPage(); y = 750; } ops.push([54, y, 9, true, k.toUpperCase()]); y -= 13; for (const l of vl) { ops.push([54, y, 11, false, l]); y -= 14; } y -= 6; }
    y = 78; for (const n of notes) for (const l of wrap(n, 100)) { ops.push([54, y, 8, false, l]); y -= 10; }
  }
  const objs = []; const add = s => { objs.push(s); return objs.length; };
  const cat = add(null), pagesRef = add(null), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'), kids = [];
  pages.forEach((p, n) => { const body = p.map(([x, y, s, b, t]) => 'BT /F' + (b ? 2 : 1) + ' ' + s + ' Tf ' + x + ' ' + y + ' Td (' + ps(t) + ') Tj ET').join('\n') + '\n0.6 w 54 100 m 558 100 l S\n' + 'BT /F1 8 Tf 480 40 Td (Page ' + (n + 1) + ' of ' + pages.length + ') Tj ET'; const c = add('<< /Length ' + Buffer.byteLength(body, 'latin1') + ' >>\nstream\n' + body + '\nendstream'); kids.push(add('<< /Type /Page /Parent ' + pagesRef + ' 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> >> /Contents ' + c + ' 0 R >>')); });
  objs[cat - 1] = '<< /Type /Catalog /Pages ' + pagesRef + ' 0 R >>'; objs[pagesRef - 1] = '<< /Type /Pages /Count ' + kids.length + ' /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] >>';
  let out = '%PDF-1.4\n', offs = []; objs.forEach((o, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xr = Buffer.byteLength(out, 'latin1'); out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + cat + ' 0 R >>\nstartxref\n' + xr + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}

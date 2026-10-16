import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-files');

// --- Excel ---
const aoa = [
  ['Tên', 'Tuổi', 'Thành phố', 'Điểm'],
  ['Nguyễn Văn A', 28, 'Hà Nội', 8.5],
  ['Trần Thị B', 34, 'Đà Nẵng', 9.1],
  ['Lê Văn C', 22, 'TP. Hồ Chí Minh', 7.8],
  ['Phạm Thị D', 41, 'Cần Thơ', 6.9],
  ['Hoàng Văn E', 30, 'Hải Phòng', 8.0],
];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'NhanVien');
XLSX.writeFile(wb, join(out, 'sample.xlsx'));

// --- Word ---
const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph({ text: 'Báo cáo thử nghiệm', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({
          children: [new TextRun({ text: 'Đây là file Word mẫu tiếng Việt: ăâđêôơư.', font: 'Arial', size: 24 })],
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Dòng thứ hai với số 123 và ký tự đặc biệt @#$%.', font: 'Arial', size: 24 })],
        }),
      ],
    },
  ],
});
writeFileSync(join(out, 'sample.docx'), await Packer.toBuffer(doc));

// --- PDF (minimal, valid) ---
function buildPdf(lines) {
  const content = lines
    .map((ln, i) => `BT /F1 20 Tf 72 ${700 - i * 30} Td (${ln}) Tj ET`)
    .join('\n');
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objs[3] =
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>';
  objs[4] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}
writeFileSync(
  join(out, 'sample.pdf'),
  buildPdf([
    'Office Lite PDF test',
    'Search test: banana apple banana orange banana',
    'Ctrl+F should find banana three times.',
  ]),
);

console.log('generated test files in', out);

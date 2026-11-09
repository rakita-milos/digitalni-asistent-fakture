import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'node:fs';
import path from 'node:path';

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';

const FONT_FILES = {
  regular: 'DejaVuSans.ttf',
  bold: 'DejaVuSans-Bold.ttf',
} as const;

function formatFening(value: bigint): string {
  return `${(Number(value) / 100).toFixed(2)} KM`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('bs-BA', {
    timeZone: 'Europe/Sarajevo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}

function formatPercent(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2).replace(/\.00$/, '')} %`;
}

/**
 * PDF računa (pdfkit) — §11: A4, JIB prodavca, JIB kupca (B2B), stavke, PDV stope, PFR, QR 40–50 mm.
 * DejaVu font zbog č/ć/š/ž/đ (standardni PDF fontovi nemaju ta slova).
 */
@Injectable()
export class InvoicePdfService {
  private readonly fontDir = this.resolveFontDir();

  constructor(private readonly prisma: PrismaService) {}

  async render(companyId: string, invoiceId: string): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        customer: true,
        company: true,
        lines: { orderBy: { position: 'asc' } },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Faktura nije pronađena');
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: { Title: `Racun ${invoice.number}`, Creator: 'Digitalni Asistent' },
    });

    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.registerFont('body', path.join(this.fontDir, FONT_FILES.regular));
    doc.registerFont('bold', path.join(this.fontDir, FONT_FILES.bold));

    const left = 48;
    const contentWidth = doc.page.width - left * 2;
    const isAdvance = invoice.type === 'ADVANCE';

    // ── Zaglavlje: prodavac ──────────────────────────────────
    doc
      .font('bold')
      .fontSize(18)
      .fillColor('#1F2937')
      .text(invoice.company.name, left, 48, { width: contentWidth * 0.55 });
    doc.font('body').fontSize(9).fillColor('#4B5563');
    doc.text(`${invoice.company.address}, ${invoice.company.city}`, { width: contentWidth * 0.55 });
    doc.text(`JIB: ${invoice.company.jib}`, { width: contentWidth * 0.55 });
    doc.text(`${invoice.company.phone} · ${invoice.company.email}`, { width: contentWidth * 0.55 });

    // ── Zaglavlje: dokument ──────────────────────────────────
    doc
      .fillColor('#1D4ED8')
      .font('bold')
      .fontSize(22)
      .text(isAdvance ? 'PRAČUN' : 'RAČUN', left, 48, { width: contentWidth, align: 'right' });
    doc.fillColor('#1F2937').font('body').fontSize(10);
    doc.text(`Broj: ${invoice.number}`, { width: contentWidth, align: 'right' });
    doc.text(`Datum izdavanja: ${formatDate(invoice.issueDate)}`, {
      width: contentWidth,
      align: 'right',
    });
    doc.text(`Datum dospijeća: ${formatDate(invoice.dueDate)}`, {
      width: contentWidth,
      align: 'right',
    });

    // ── Kupac ────────────────────────────────────────────────
    let y = 150;
    doc.font('bold').fontSize(10).fillColor('#6B7280').text('KUPAC', left, y);
    doc
      .font('bold')
      .fontSize(11)
      .fillColor('#1F2937')
      .text(invoice.customer.name, left, y + 16);

    const customerDetails = [
      invoice.customer.address,
      invoice.customer.city,
      invoice.customer.jib ? `JIB: ${invoice.customer.jib}` : null,
      invoice.customer.phone ?? null,
    ].filter((value): value is string => Boolean(value));

    doc
      .font('body')
      .fontSize(9)
      .fillColor('#4B5563')
      .text(customerDetails.join(' · ') || '—', left, y + 32, { width: contentWidth * 0.6 });

    // ── Tabela stavki ────────────────────────────────────────
    y = 220;
    const columns = {
      desc: left,
      qty: left + 250,
      price: left + 305,
      tax: left + 380,
      total: left + 445,
    };

    doc.rect(left, y, contentWidth, 22).fill('#F3F4F6');
    doc.fillColor('#374151').font('bold').fontSize(9);
    doc.text('Opis', columns.desc + 6, y + 7);
    doc.text('Kol.', columns.qty, y + 7, { width: 45, align: 'right' });
    doc.text('Cijena', columns.price, y + 7, { width: 70, align: 'right' });
    doc.text('PDV', columns.tax, y + 7, { width: 55, align: 'right' });
    doc.text('Ukupno', columns.total, y + 7, { width: 72, align: 'right' });
    y += 28;

    doc.font('body').fontSize(9).fillColor('#1F2937');
    for (const line of invoice.lines) {
      if (y > 700) {
        doc.addPage();
        y = 60;
      }

      const descriptionWidth = 240;
      const descriptionHeight = doc.heightOfString(line.description, { width: descriptionWidth });
      const rowHeight = Math.max(18, descriptionHeight + 6);

      doc.text(line.description, columns.desc + 6, y, { width: descriptionWidth });
      doc.text((line.qtyMilli / 1000).toLocaleString('bs-BA', { maximumFractionDigits: 3 }), columns.qty, y, {
        width: 45,
        align: 'right',
      });
      doc.text(formatFening(line.unitPriceFening), columns.price, y, { width: 70, align: 'right' });
      doc.text(formatPercent(line.taxRateBp), columns.tax, y, { width: 55, align: 'right' });
      doc.text(formatFening(line.lineTotalFening), columns.total, y, { width: 72, align: 'right' });

      y += rowHeight;
      doc.moveTo(left, y - 4).lineTo(left + contentWidth, y - 4).strokeColor('#E5E7EB').stroke();
    }

    // ── Totali ───────────────────────────────────────────────
    y += 8;
    const totalsX = left + contentWidth - 220;
    doc.font('body').fontSize(10).fillColor('#4B5563');
    doc.text('Osnovica:', totalsX, y, { width: 120 });
    doc.text(formatFening(invoice.subtotalFening), totalsX + 120, y, { width: 100, align: 'right' });
    y += 16;
    doc.text('PDV:', totalsX, y, { width: 120 });
    doc.text(formatFening(invoice.taxFening), totalsX + 120, y, { width: 100, align: 'right' });
    y += 18;
    doc.font('bold').fontSize(12).fillColor('#1F2937');
    doc.text('UKUPNO:', totalsX, y, { width: 120 });
    doc.text(formatFening(invoice.totalFening), totalsX + 120, y, { width: 100, align: 'right' });

    // ── Fiskalni dio + QR (§11: QR 40–50 mm) ─────────────────
    if (invoice.fiscalPfr && invoice.fiscalQrPayload) {
      y += 32;
      doc.font('body').fontSize(8).fillColor('#4B5563');
      doc.text(`PFR: ${invoice.fiscalPfr}`, left, y, { width: contentWidth - 150 });
      doc.text(
        `Fiskalizovano: ${invoice.fiscalAt ? invoice.fiscalAt.toISOString() : '—'}`,
        left,
        y + 12,
        { width: contentWidth - 150 },
      );

      const qrSize = 128; // ~45 mm
      const qrBuffer = await QRCode.toBuffer(invoice.fiscalQrPayload, {
        type: 'png',
        width: 300,
        margin: 0,
      });
      doc.image(qrBuffer, left + contentWidth - qrSize, y - 8, {
        width: qrSize,
        height: qrSize,
      });
    } else if (isAdvance) {
      y += 24;
      doc
        .font('body')
        .fontSize(9)
        .fillColor('#B45309')
        .text('PRAČUN — nije fiskalni račun.', left, y);
    }

    if (env.ESIR_MODE === 'mock') {
      doc
        .font('body')
        .fontSize(7)
        .fillColor('#9CA3AF')
        .text('MOCK fiskalizacija — dokument nije za upotrebu u prometu.', left, doc.page.height - 60, {
          width: contentWidth,
        });
    }

    doc.end();
    return done;
  }

  /**
   * QR kod fiskalnog računa kao PNG — mobilni prikaz (M-07) bez PDF-a i bez native QR biblioteke.
   * Isti payload i parametri kao QR u PDF-u.
   */
  async renderQr(companyId: string, invoiceId: string): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: { fiscalQrPayload: true },
    });

    if (!invoice) {
      throw new NotFoundException('Faktura nije pronađena');
    }
    if (!invoice.fiscalQrPayload) {
      throw new ConflictException('Faktura još nije fiskalizovana — QR kod ne postoji');
    }

    return QRCode.toBuffer(invoice.fiscalQrPayload, { type: 'png', width: 360, margin: 1 });
  }

  private resolveFontDir(): string {    const relative = path.join('node_modules', 'dejavu-fonts-ttf', 'ttf');
    const candidates = [
      path.join(process.cwd(), relative),
      path.join(process.cwd(), '..', '..', relative),
    ];

    const found = candidates.find((candidate) =>
      existsSync(path.join(candidate, FONT_FILES.regular)),
    );

    if (!found) {
      throw new Error('DejaVu font nije pronađen (paket dejavu-fonts-ttf)');
    }

    return found;
  }
}

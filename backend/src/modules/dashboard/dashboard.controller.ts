import type { NextFunction, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { success } from '../../utils/response';
import * as dashboardService from './dashboard.service';

type PDFKitDoc = InstanceType<typeof PDFDocument>;

export async function getSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await dashboardService.getDashboardSummary();
    res.json(success(data, 'Summary fetched successfully'));
  } catch (err) {
    next(err);
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const COLOR = {
  primary: '#4F46E5',
  text: '#111827',
  muted: '#6B7280',
  light: '#9CA3AF',
  border: '#E5E7EB',
  headerBg: '#F3F4F6',
  white: '#FFFFFF',
  green: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  blue: '#3B82F6',
  orange: '#F97316',
  indigo: '#6366F1',
  violet: '#8B5CF6',
  gray: '#9CA3AF',
  emerald: '#059669',
  rowAlt: '#F9FAFB',
};

const PAGE_W = 595; // A4 width in points
const PAGE_H = 842; // A4 height in points
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2; // 499
const BOTTOM_LIMIT = PAGE_H - MARGIN; // stop drawing below this line

// ─── Page-break helper ────────────────────────────────────────────────────────

/**
 * If curY + neededHeight would exceed the page bottom, add a new page.
 * Returns the (possibly reset) curY.
 */
function ensureSpace(doc: PDFKitDoc, curY: number, neededHeight: number): number {
  if (curY + neededHeight > BOTTOM_LIMIT) {
    doc.addPage();
    return MARGIN;
  }
  return curY;
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawCard(doc: PDFKitDoc, x: number, y: number, w: number, h: number): void {
  doc
    .save()
    .fillColor(COLOR.white)
    .strokeColor(COLOR.border)
    .lineWidth(0.5)
    .roundedRect(x, y, w, h, 4)
    .fillAndStroke()
    .restore();
}

function sectionTitle(doc: PDFKitDoc, title: string, y: number, color = COLOR.primary): number {
  doc.save().fillColor(color).rect(MARGIN, y, 3, 14).fill().restore();
  doc.fillColor(COLOR.text).fontSize(12).font('Helvetica-Bold').text(title, MARGIN + 10, y + 1);
  return y + 22;
}

function pill(
  doc: PDFKitDoc,
  label: string,
  x: number,
  y: number,
  bg: string,
  fg: string,
  w = 60
): void {
  doc
    .save()
    .fillColor(bg)
    .roundedRect(x, y - 2, w, 14, 3)
    .fill()
    .fillColor(fg)
    .fontSize(8)
    .font('Helvetica-Bold')
    .text(label, x, y + 1, { width: w, align: 'center' })
    .restore();
}

function barRow(
  doc: PDFKitDoc,
  label: string,
  count: number,
  maxCount: number,
  y: number,
  barColor: string
): void {
  const BAR_X = MARGIN + 90;
  const BAR_MAX_W = CONTENT_W - 90 - 32;
  const filledW =
    maxCount > 0 ? Math.max(Math.round((count / maxCount) * BAR_MAX_W), count > 0 ? 3 : 0) : 0;
  doc.fillColor(COLOR.muted).fontSize(9).font('Helvetica').text(label, MARGIN, y + 1, { width: 86, align: 'left' });
  doc.fillColor(COLOR.headerBg).rect(BAR_X, y, BAR_MAX_W, 10).fill();
  if (filledW > 0) doc.fillColor(barColor).rect(BAR_X, y, filledW, 10).fill();
  doc.fillColor(COLOR.text).fontSize(9).font('Helvetica-Bold').text(String(count), BAR_X + BAR_MAX_W + 6, y + 1);
}

function revenueChart(
  doc: PDFKitDoc,
  points: { date: string; revenue: number }[],
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (points.length === 0) {
    doc.fillColor(COLOR.light).fontSize(9).text('No data', x, y + h / 2, { width: w, align: 'center' });
    return;
  }
  const max = Math.max(...points.map((p) => p.revenue), 1);
  const barW = Math.floor((w - (points.length - 1) * 4) / points.length);
  points.forEach((p, i) => {
    const bh = Math.max(Math.round((p.revenue / max) * h), 2);
    const bx = x + i * (barW + 4);
    const by = y + h - bh;
    doc.fillColor('#BFDBFE').rect(bx, y, barW, h).fill();
    doc.fillColor(COLOR.blue).rect(bx, by, barW, bh).fill();
    const label = p.date.slice(5);
    doc
      .fillColor(COLOR.light)
      .fontSize(7)
      .font('Helvetica')
      .text(label, bx - 2, y + h + 3, { width: barW + 4, align: 'center' });
  });
}

function vnd(n: number): string {
  return n.toLocaleString('en-US') + ' VND';
}

function stars(rating: number): string {
  return `${Math.min(5, Math.max(0, Math.round(rating)))}/5`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 3) + '...';
}

/** Draws a shaded table header row and returns the new curY. */
function tableHeader(
  doc: PDFKitDoc,
  curY: number,
  cols: { label: string; x: number; width: number; align?: 'left' | 'right' | 'center' }[]
): number {
  doc.fillColor(COLOR.headerBg).rect(MARGIN + 4, curY - 2, CONTENT_W - 8, 16).fill();
  cols.forEach((c) => {
    doc
      .fillColor(COLOR.muted)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(c.label, c.x, curY + 2, { width: c.width, align: c.align ?? 'left' });
  });
  return curY + 18;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function exportPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let exportData: Awaited<ReturnType<typeof dashboardService.getExportData>>;
    try {
      exportData = await dashboardService.getExportData(req.query);
    } catch (e) {
      res.status(400).json({ success: false, message: (e as Error).message });
      return;
    }

    const summary = await dashboardService.getDashboardSummary();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=business_report.pdf');

    const doc = new PDFDocument({ margin: MARGIN, size: 'A4', autoFirstPage: true });
    doc.pipe(res);

    // ── HEADER (always page 1) ─────────────────────────────────────────────────
    doc.fillColor(COLOR.primary).rect(0, 0, PAGE_W, 68).fill();
    doc
      .fillColor(COLOR.white)
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('BUSINESS PERFORMANCE REPORT', MARGIN, 18, { align: 'center', width: CONTENT_W });
    doc
      .fillColor('#C7D2FE')
      .fontSize(9)
      .font('Helvetica')
      .text(
        `Period: ${exportData.range}  ·  Generated: ${new Date().toLocaleString('en-US')}`,
        MARGIN,
        46,
        { align: 'center', width: CONTENT_W }
      );

    let curY = 84;

    // ── SECTION 1: KEY METRICS ────────────────────────────────────────────────
    curY = ensureSpace(doc, curY, 102);
    curY = sectionTitle(doc, '1. Key Metrics', curY);
    curY += 6;

    const metricCards = [
      {
        label: 'Total Revenue',
        value: vnd(summary.keyMetrics.totalRevenue),
        sub: 'Completed (DONE) orders',
        color: COLOR.green,
      },
      {
        label: 'Total Orders',
        value: summary.keyMetrics.totalOrders.toLocaleString(),
        sub: 'All statuses',
        color: COLOR.blue,
      },
      {
        label: 'Active Products',
        value: summary.keyMetrics.activeProducts.toLocaleString(),
        sub: 'AVAILABLE status',
        color: COLOR.emerald,
      },
      {
        label: 'Customers',
        value: summary.keyMetrics.totalCustomers.toLocaleString(),
        sub: 'USER role accounts',
        color: COLOR.violet,
      },
    ];
    const cardW = Math.floor((CONTENT_W - 12) / 4);
    metricCards.forEach((m, i) => {
      const cx = MARGIN + i * (cardW + 4);
      drawCard(doc, cx, curY, cardW, 60);
      doc
        .fillColor(m.color)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(m.label.toUpperCase(), cx + 8, curY + 8, { width: cardW - 16 });
      doc
        .fillColor(COLOR.text)
        .fontSize(15)
        .font('Helvetica-Bold')
        .text(m.value, cx + 8, curY + 22, { width: cardW - 16 });
      doc
        .fillColor(COLOR.light)
        .fontSize(7.5)
        .font('Helvetica')
        .text(m.sub, cx + 8, curY + 42, { width: cardW - 16 });
    });
    curY += 74;

    // ── SECTION 2: REVENUE LAST 7 DAYS ───────────────────────────────────────
    const CHART_H = 70;
    const chartCardH = CHART_H + 30;
    curY = ensureSpace(doc, curY, 22 + 4 + chartCardH + 14);
    curY = sectionTitle(doc, '2. Revenue — Last 7 Days (DONE orders)', curY);
    curY += 4;
    drawCard(doc, MARGIN, curY, CONTENT_W, chartCardH);
    revenueChart(doc, summary.charts.revenueLast7Days, MARGIN + 12, curY + 10, CONTENT_W - 24, CHART_H);
    curY += chartCardH + 14;

    // ── SECTION 3: ORDERS BY STATUS ───────────────────────────────────────────
    const STATUS_LABELS: Record<string, string> = {
      PENDING: 'Pending',
      CONFIRMED: 'Confirmed',
      SHIPPING: 'Shipping',
      DONE: 'Done',
      CANCELLED: 'Cancelled',
    };
    const STATUS_COLORS: Record<string, string> = {
      PENDING: COLOR.orange,
      CONFIRMED: COLOR.blue,
      SHIPPING: COLOR.indigo,
      DONE: COLOR.green,
      CANCELLED: COLOR.gray,
    };
    const statusItems = summary.charts.orderStatus;
    const maxStatusCount = Math.max(...statusItems.map((s) => s.count), 1);
    const statusCardH = 10 + statusItems.length * 18 + 14;
    curY = ensureSpace(doc, curY, 22 + 4 + statusCardH + 14);
    curY = sectionTitle(doc, '3. Orders by Status', curY);
    curY += 4;
    drawCard(doc, MARGIN, curY, CONTENT_W, statusCardH);
    curY += 10;
    statusItems.forEach((item) => {
      barRow(
        doc,
        STATUS_LABELS[item.status] ?? item.status,
        item.count,
        maxStatusCount,
        curY,
        STATUS_COLORS[item.status] ?? COLOR.gray
      );
      curY += 18;
    });
    curY += 14;
    curY += 18;

    // ── SECTION 4: REVIEW SENTIMENT ───────────────────────────────────────────
    const { POSITIVE, NEUTRAL, NEGATIVE } = summary.charts.sentiment;
    const sentimentTotal = POSITIVE + NEUTRAL + NEGATIVE || 1;
    const sentItems = [
      { label: 'Positive', count: POSITIVE, color: COLOR.green },
      { label: 'Neutral', count: NEUTRAL, color: COLOR.amber },
      { label: 'Negative', count: NEGATIVE, color: COLOR.red },
    ];
    const sentCardH = 10 + sentItems.length * 18 + 14;
    curY = ensureSpace(doc, curY, 22 + 8 + sentCardH + 14);
    curY = sectionTitle(doc, '4. Review Sentiment', curY);
    curY += 8;
    drawCard(doc, MARGIN, curY, CONTENT_W, sentCardH);
    curY += 10;
    sentItems.forEach((s) => {
      const pct = Math.round((s.count / sentimentTotal) * 100);
      doc.fillColor(s.color).circle(MARGIN + 8, curY + 5, 4).fill();
      doc.fillColor(COLOR.text).fontSize(9).font('Helvetica').text(s.label, MARGIN + 18, curY + 1, { width: 60 });
      const BAR_X = MARGIN + 85;
      const BAR_W = CONTENT_W - 85 - 55;
      const filledW = Math.max(Math.round((s.count / sentimentTotal) * BAR_W), s.count > 0 ? 3 : 0);
      doc.fillColor(COLOR.headerBg).rect(BAR_X, curY, BAR_W, 10).fill();
      if (filledW > 0) doc.fillColor(s.color).rect(BAR_X, curY, filledW, 10).fill();
      doc
        .fillColor(COLOR.muted)
        .fontSize(9)
        .font('Helvetica')
        .text(`${pct}%`, BAR_X + BAR_W + 6, curY + 1, { width: 28 });
      doc.fillColor(COLOR.text).font('Helvetica-Bold').text(String(s.count), BAR_X + BAR_W + 34, curY + 1, { width: 24 });
      curY += 18;
    });
    curY += 14;
    curY += 18;

    // ── SECTION 5: ACTION REQUIRED ────────────────────────────────────────────
    curY = ensureSpace(doc, curY, 22 + 8);
    curY = sectionTitle(doc, '5. Action Required', curY);
    curY += 8;

    // 5a. Pending Orders
    const pendingOrders = summary.actionRequired.pendingOrders;
    const ROW_PO = 20;
    const poBodyH = pendingOrders.length === 0 ? 22 : 18 + pendingOrders.length * ROW_PO;
    const poCardH = 26 + poBodyH + 12;
    curY = ensureSpace(doc, curY, poCardH);
    drawCard(doc, MARGIN, curY, CONTENT_W, poCardH);
    doc
      .fillColor(COLOR.orange)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(`Pending orders (${pendingOrders.length})`, MARGIN + 8, curY + 8);
    curY += 26;
    if (pendingOrders.length === 0) {
      doc.fillColor(COLOR.light).fontSize(9).font('Helvetica').text('No pending orders', MARGIN + 8, curY + 2);
      curY += 22;
    } else {
      curY = tableHeader(doc, curY, [
        { label: 'Customer', x: MARGIN + 8, width: 160 },
        { label: 'Date', x: MARGIN + 175, width: 110 },
        { label: 'Total', x: MARGIN + 295, width: 170, align: 'right' },
      ]);
      pendingOrders.forEach((o, idx) => {
        if (idx % 2 === 0) doc.fillColor(COLOR.rowAlt).rect(MARGIN + 4, curY - 2, CONTENT_W - 8, ROW_PO).fill();
        const name = o.user.name || o.user.email;
        const date = new Date(o.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
        doc.fillColor(COLOR.text).fontSize(8.5).font('Helvetica').text(name, MARGIN + 8, curY + 2, { width: 160 });
        doc.fillColor(COLOR.muted).text(date, MARGIN + 175, curY + 2, { width: 110 });
        doc
          .fillColor(COLOR.orange)
          .font('Helvetica-Bold')
          .text(vnd(o.total), MARGIN + 295, curY + 2, { width: 170, align: 'right' });
        curY += ROW_PO;
      });
    }
    curY += 12;

    // 5b. Negative Feedback
    const negFeedbacks = summary.actionRequired.negativeFeedbacks;
    const ROW_NF = 26;
    const nfBodyH = negFeedbacks.length === 0 ? 22 : 18 + negFeedbacks.length * ROW_NF;
    const nfCardH = 26 + nfBodyH + 12;
    curY = ensureSpace(doc, curY, nfCardH);
    drawCard(doc, MARGIN, curY, CONTENT_W, nfCardH);
    doc
      .fillColor(COLOR.red)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(`Negative feedback (${negFeedbacks.length})`, MARGIN + 8, curY + 8);
    curY += 26;
    if (negFeedbacks.length === 0) {
      doc.fillColor(COLOR.light).fontSize(9).font('Helvetica').text('No negative feedback', MARGIN + 8, curY + 2);
      curY += 22;
    } else {
      curY = tableHeader(doc, curY, [
        { label: 'Product', x: MARGIN + 8, width: 160 },
        { label: 'Customer', x: MARGIN + 175, width: 100 },
        { label: 'Rating', x: MARGIN + 280, width: 60 },
        { label: 'Comment', x: MARGIN + 345, width: 130 },
      ]);
      negFeedbacks.forEach((f, idx) => {
        if (idx % 2 === 0) doc.fillColor(COLOR.rowAlt).rect(MARGIN + 4, curY - 2, CONTENT_W - 8, ROW_NF).fill();
        doc
          .fillColor(COLOR.text)
          .fontSize(8.5)
          .font('Helvetica-Bold')
          .text(f.product.name, MARGIN + 8, curY + 2, { width: 160 });
        doc.fillColor(COLOR.muted).font('Helvetica').text(f.user.name || 'Anonymous', MARGIN + 175, curY + 2, { width: 100 });
        doc.fillColor(COLOR.amber).text(stars(f.rating), MARGIN + 280, curY + 2, { width: 60 });
        if (f.comment) {
          doc
            .fillColor(COLOR.muted)
            .fontSize(7.5)
            .text(`"${truncate(f.comment, 120)}"`, MARGIN + 345, curY + 2, { width: 130 });
        }
        curY += ROW_NF;
      });
    }
    curY += 12;

    // 5c. Low Stock
    const lowStock = summary.actionRequired.lowStockProducts;
    const ROW_LS = 20;
    const lsBodyH = lowStock.length === 0 ? 22 : 18 + lowStock.length * ROW_LS;
    const lsCardH = 26 + lsBodyH + 12;
    curY = ensureSpace(doc, curY, lsCardH);
    drawCard(doc, MARGIN, curY, CONTENT_W, lsCardH);
    doc
      .fillColor(COLOR.amber)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(`Low stock products (${lowStock.length})`, MARGIN + 8, curY + 8);
    curY += 26;
    if (lowStock.length === 0) {
      doc.fillColor(COLOR.light).fontSize(9).font('Helvetica').text('All stock levels OK', MARGIN + 8, curY + 2);
      curY += 22;
    } else {
      curY = tableHeader(doc, curY, [
        { label: 'Product Name', x: MARGIN + 8, width: 340 },
        { label: 'Stock', x: MARGIN + 355, width: 120, align: 'right' },
      ]);
      lowStock.forEach((p, idx) => {
        if (idx % 2 === 0) doc.fillColor(COLOR.rowAlt).rect(MARGIN + 4, curY - 2, CONTENT_W - 8, ROW_LS).fill();
        doc.fillColor(COLOR.text).fontSize(8.5).font('Helvetica').text(p.name, MARGIN + 8, curY + 2, { width: 340 });
        pill(
          doc,
          p.stock === 0 ? 'Out of stock' : `Stock: ${p.stock}`,
          MARGIN + 360,
          curY + 1,
          p.stock === 0 ? '#FEE2E2' : '#FEF3C7',
          p.stock === 0 ? COLOR.red : COLOR.amber,
          90
        );
        curY += ROW_LS;
      });
    }
    curY += 20;

    // ── SECTION 6: EXPORT PERIOD SUMMARY ─────────────────────────────────────
    const PERIOD_CARD_H = 62;
    curY = ensureSpace(doc, curY, 22 + 4 + PERIOD_CARD_H + 30);
    curY = sectionTitle(doc, '6. Export Period Summary', curY);
    curY += 4;
    drawCard(doc, MARGIN, curY, CONTENT_W, PERIOD_CARD_H);
    const summaryItems = [
      { label: 'Total Revenue', value: vnd(exportData.revenue), color: COLOR.green },
      { label: 'Completed Orders', value: `${exportData.orders} orders`, color: COLOR.blue },
      { label: 'Positive', value: String(exportData.feedbacks.positive), color: COLOR.green },
      { label: 'Neutral', value: String(exportData.feedbacks.neutral), color: COLOR.amber },
      { label: 'Negative', value: String(exportData.feedbacks.negative), color: COLOR.red },
    ];
    const colW = Math.floor(CONTENT_W / summaryItems.length);
    summaryItems.forEach((item, i) => {
      const ix = MARGIN + i * colW + 6;
      doc.fillColor(COLOR.muted).fontSize(7.5).font('Helvetica').text(item.label, ix, curY + 8, { width: colW - 8 });
      doc.fillColor(item.color).fontSize(11).font('Helvetica-Bold').text(item.value, ix, curY + 22, { width: colW - 8 });
    });
    curY += PERIOD_CARD_H + 16;

    // ── FOOTER ────────────────────────────────────────────────────────────────
    const footerY = Math.max(curY + 8, BOTTOM_LIMIT - 20);
    doc.fillColor(COLOR.border).rect(MARGIN, footerY, CONTENT_W, 0.5).fill();
    doc
      .fillColor(COLOR.light)
      .fontSize(8)
      .font('Helvetica')
      .text('— Generated automatically by the system. For internal use only. —', MARGIN, footerY + 8, {
        align: 'center',
        width: CONTENT_W,
      });

    doc.end();
  } catch (err) {
    next(err);
  }
}

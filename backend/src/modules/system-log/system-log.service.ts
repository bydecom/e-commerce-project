import PDFDocument from 'pdfkit';
import { prisma } from '../../db';

export type TimeFilterType = 'MONTH' | 'QUARTER' | 'YEAR' | 'RANGE' | 'ALL';

const MAX_EXPORT_ROWS = 5000;

export interface SystemLogExportQuery {
  filterType?: string;
  month?: string;
  quarter?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
  method?: string;
  /** Exact status code (optional; ignored if statusGroup is set). */
  status?: string;
  /** success → 200–399 (includes 304); client → 4xx; server → 5xx */
  statusGroup?: string;
  url?: string;
}

export function parseDateRange(query: SystemLogExportQuery): { gte: Date; lte: Date } | undefined {
  const now = new Date();
  const type = (query.filterType || 'ALL').toUpperCase() as TimeFilterType;

  if (type === 'ALL') return undefined;

  const y = query.year ? Number(query.year) : now.getFullYear();
  if (type === 'YEAR') {
    const start = new Date(y, 0, 1, 0, 0, 0, 0);
    const end = new Date(y, 11, 31, 23, 59, 59, 999);
    return { gte: start, lte: end };
  }

  if (type === 'MONTH') {
    const m = query.month ? Number(query.month) : now.getMonth() + 1;
    if (m < 1 || m > 12) throw new Error('Month must be between 1 and 12');
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    return { gte: start, lte: end };
  }

  if (type === 'QUARTER') {
    const q = query.quarter ? Number(query.quarter) : Math.floor(now.getMonth() / 3) + 1;
    if (q < 1 || q > 4) throw new Error('Quarter must be between 1 and 4');
    const startMonth = (q - 1) * 3;
    const start = new Date(y, startMonth, 1, 0, 0, 0, 0);
    const end = new Date(y, startMonth + 3, 0, 23, 59, 59, 999);
    return { gte: start, lte: end };
  }

  if (type === 'RANGE') {
    if (!query.startDate || !query.endDate) {
      throw new Error('startDate and endDate are required for RANGE filter');
    }
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid startDate or endDate value');
    }
    let gte = start;
    let lte = end;
    if (lte < gte) [gte, lte] = [lte, gte];
    if (query.startDate.length <= 10) gte.setHours(0, 0, 0, 0);
    if (query.endDate.length <= 10) lte.setHours(23, 59, 59, 999);
    return { gte, lte };
  }

  return undefined;
}

export function describeTimeFilter(query: SystemLogExportQuery, range: { gte: Date; lte: Date } | undefined): string {
  const type = (query.filterType || 'ALL').toUpperCase();
  if (!range) return 'All time (no date filter)';
  if (type === 'YEAR') return `Year ${range.gte.getFullYear()}`;
  if (type === 'MONTH') {
    return `Month ${query.month ?? range.gte.getMonth() + 1}/${range.gte.getFullYear()}`;
  }
  if (type === 'QUARTER') {
    return `Q${query.quarter ?? Math.floor(range.gte.getMonth() / 3) + 1} ${range.gte.getFullYear()}`;
  }
  if (type === 'RANGE') {
    return `${range.gte.toISOString().slice(0, 10)} – ${range.lte.toISOString().slice(0, 10)}`;
  }
  return `${range.gte.toISOString()} – ${range.lte.toISOString()}`;
}

export type SystemLogWhereInput = {
  createdAt?: { gte: Date; lte: Date };
  method?: string;
  status?: number | { gte: number; lte: number };
  url?: { contains: string };
};

export function buildSystemLogWhere(
  query: SystemLogExportQuery,
  range: { gte: Date; lte: Date } | undefined
): SystemLogWhereInput {
  const method = query.method?.trim();
  const statusGroup = query.statusGroup?.trim().toLowerCase();
  const status = query.status ? Number(query.status) : undefined;
  const url = query.url?.trim();

  let statusClause: SystemLogWhereInput['status'] | undefined;
  if (statusGroup === 'success') {
    statusClause = { gte: 200, lte: 399 };
  } else if (statusGroup === 'client') {
    statusClause = { gte: 400, lte: 499 };
  } else if (statusGroup === 'server') {
    statusClause = { gte: 500, lte: 599 };
  } else if (status !== undefined && !Number.isNaN(status)) {
    statusClause = status;
  }

  return {
    ...(range ? { createdAt: { gte: range.gte, lte: range.lte } } : {}),
    ...(method ? { method: method.toUpperCase() } : {}),
    ...(statusClause !== undefined ? { status: statusClause } : {}),
    ...(url ? { url: { contains: url } } : {}),
  };
}

export async function findLogsForExport(where: SystemLogWhereInput) {
  return prisma.systemLog.findMany({
    where,
    take: MAX_EXPORT_ROWS,
    orderBy: { id: 'desc' },
  });
}

function truncateUrl(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** Display response time (ms) rounded to 2 decimal places. */
function formatResponseTimeMs(ms: number): string {
  const n = Number(ms);
  if (Number.isNaN(n)) return '0.00';
  return n.toFixed(2);
}

export function buildSystemLogsPdfBuffer(
  logs: Awaited<ReturnType<typeof findLogsForExport>>,
  meta: { timeFilterLabel: string; extraFilters: string }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(14).text('System Traffic Logs — Export', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(8).fillColor('#444').text(`Time: ${meta.timeFilterLabel}`, { align: 'center' });
    doc.text(`Other filters: ${meta.extraFilters}`, { align: 'center' });
    doc.text(`Rows: ${logs.length} (max ${MAX_EXPORT_ROWS})`, { align: 'center' });
    doc.text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.fillColor('#000').moveDown(0.8);

    const fontSize = 7;
    const lineH = 11;
    const bottom = doc.page.height - doc.page.margins.bottom;
    let y = doc.y;

    const drawHeader = () => {
      doc.fontSize(fontSize).font('Helvetica-Bold');
      doc.text('ID', 36, y, { width: 28 });
      doc.text('Meth', 66, y, { width: 32 });
      doc.text('URL', 100, y, { width: 300 });
      doc.text('St', 402, y, { width: 22 });
      doc.text('ms', 426, y, { width: 28 });
      doc.text('Created (UTC)', 456, y, { width: 100 });
      y += lineH + 2;
      doc.font('Helvetica');
    };

    drawHeader();

    for (const log of logs) {
      if (y + lineH > bottom) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader();
      }
      const created = log.createdAt.toISOString().replace('T', ' ').slice(0, 19);
      doc.fontSize(fontSize).text(String(log.id), 36, y, { width: 28 });
      doc.text(log.method, 66, y, { width: 32 });
      doc.text(truncateUrl(log.url, 80), 100, y, { width: 300 });
      doc.text(String(log.status), 402, y, { width: 22 });
      doc.text(formatResponseTimeMs(log.responseTime), 426, y, { width: 28 });
      doc.text(created, 456, y, { width: 100 });
      y += lineH;
    }

    doc.end();
  });
}

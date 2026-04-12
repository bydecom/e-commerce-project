import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db';
import { success } from '../../utils/response';
import {
  buildSystemLogWhere,
  buildSystemLogsPdfBuffer,
  describeTimeFilter,
  findLogsForExport,
  parseDateRange,
  type SystemLogExportQuery,
} from './system-log.service';

export const systemLogRouter = Router();

/**
 * GET /api/system-logs/export-pdf
 * Query: filterType (MONTH|QUARTER|YEAR|RANGE|ALL), month, quarter, year, startDate, endDate, method, statusGroup (success|client|server), status (exact), url
 */
systemLogRouter.get('/export-pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as unknown as SystemLogExportQuery;
    let range: ReturnType<typeof parseDateRange>;
    try {
      range = parseDateRange(q);
    } catch (e) {
      res.status(400).json({ success: false, message: (e as Error).message });
      return;
    }

    const where = buildSystemLogWhere(q, range);
    const logs = await findLogsForExport(where);
    const timeFilterLabel = describeTimeFilter(q, range);
    const extraParts = [
      q.method && `method=${q.method}`,
      q.statusGroup && `statusGroup=${q.statusGroup}`,
      q.status && `status=${q.status}`,
      q.url && `url~${q.url}`,
    ].filter(Boolean) as string[];
    const extraFilters = extraParts.length > 0 ? extraParts.join(', ') : 'none';

    const buffer = await buildSystemLogsPdfBuffer(logs, { timeFilterLabel, extraFilters });
    const filename = `system-logs-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch {
    res.status(500).json({ success: false, message: 'Failed to export system logs PDF' });
  }
});

/**
 * GET /api/system-logs
 * Query: limit (default 50, max 200), method, statusGroup (success=200–399 incl. 304), client, server, status (exact), url
 */
systemLogRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query['limit']) || 50, 200);
    const method = req.query['method'] as string | undefined;
    const statusGroup = (req.query['statusGroup'] as string | undefined)?.trim().toLowerCase();
    const statusNum = req.query['status'] ? Number(req.query['status']) : undefined;
    const url = req.query['url'] as string | undefined;

    const where: Prisma.SystemLogWhereInput = {
      ...(method ? { method: method.toUpperCase() } : {}),
      ...(url ? { url: { contains: url } } : {}),
    };

    if (statusGroup === 'success') {
      where.status = { gte: 200, lte: 399 };
    } else if (statusGroup === 'client') {
      where.status = { gte: 400, lte: 499 };
    } else if (statusGroup === 'server') {
      where.status = { gte: 500, lte: 599 };
    } else if (statusNum !== undefined && !Number.isNaN(statusNum)) {
      where.status = statusNum;
    }

    const logs = await prisma.systemLog.findMany({
      take: limit,
      orderBy: { id: 'desc' },
      where,
    });

    res.json(success(logs));
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch system logs' });
  }
});

import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import { httpError } from '../../utils/http-error';
import { getOrCreateTodayMiniAdvice } from './daily-advice/mini-advice.service';
import { enhanceProductDescription } from './product/product-description-enhancer';
import { processUserChat } from './chatbot/chat-orchestrator.service';
import { processAdminChat } from './chatbot/admin-chat-orchestrator.service';

export async function postEnhanceProductDescription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, description } = req.body as { name?: string; description?: string | null };
    if (!name?.trim()) throw httpError(400, 'Product name is required');
    const current =
      description === undefined || description === null
        ? null
        : String(description).trim() === ''
          ? null
          : String(description).trim();
    const text = await enhanceProductDescription(name.trim(), current);
    res.json(success({ description: text }, 'Description generated'));
  } catch (err) {
    next(err);
  }
}

export async function getMiniAdvice(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = req.query['regenerate'];
    const forceRegenerate =
      q === '1' || q === 'true' || (Array.isArray(q) && (q[0] === '1' || q[0] === 'true'));
    const bullets = await getOrCreateTodayMiniAdvice(forceRegenerate);
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.json(success({ bullets }, 'Mini advice'));
  } catch (err) {
    next(err);
  }
}

export async function postChat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as { message?: unknown; context?: unknown };
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) throw httpError(400, 'Message is required');

    const userId = req.auth?.userId;
    const out = await processUserChat(userId, message, body.context);
    res.json(success(out, 'OK'));
  } catch (err) {
    next(err);
  }
}

export async function postAdminChat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as { message?: unknown };
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) throw httpError(400, 'Message is required');

    const adminId = req.auth!.userId;
    const out = await processAdminChat(adminId, message);
    res.json(success(out, 'OK'));
  } catch (err) {
    next(err);
  }
}

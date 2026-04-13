import { GoogleGenAI, Type } from '@google/genai';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../db';
import { httpError } from '../../../utils/http-error';
import {
  getWeeklyStatsComparison,
  type WeeklyStatsComparison,
} from '../../dashboard/dashboard.service';

/** UTC calendar date (matches @db.Date; one cached row per day). */
function utcCalendarDate(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function heuristicMiniAdvice(stats: WeeklyStatsComparison): string[] {
  const bullets: string[] = [];
  const { thisWeek: tw, lastWeek: lw } = stats;

  const revPct =
    lw.revenue > 0 ? ((tw.revenue - lw.revenue) / lw.revenue) * 100 : tw.revenue > 0 ? 100 : 0;
  const ordPct = lw.orders > 0 ? ((tw.orders - lw.orders) / lw.orders) * 100 : tw.orders > 0 ? 100 : 0;

  if (lw.revenue === 0 && lw.orders === 0 && (tw.revenue > 0 || tw.orders > 0)) {
    bullets.push(
      'This week already shows orders and revenue — tighten confirmation and fulfillment so the pace holds.'
    );
  } else {
    if (revPct >= 8) {
      bullets.push(
        `Revenue in the last 7 days is up about ${revPct.toFixed(0)}% vs the prior 7 days — consider keeping promotions or top sellers visible.`
      );
    } else if (revPct <= -8) {
      bullets.push(
        `Revenue in the last 7 days is down about ${Math.abs(revPct).toFixed(0)}% — review inventory, pricing, and homepage merchandising.`
      );
    }
    if (ordPct >= 10) {
      bullets.push(
        `Order count in the last 7 days is up ~${ordPct.toFixed(0)}% — watch stock levels and PENDING order handling time.`
      );
    } else if (ordPct <= -10) {
      bullets.push(
        `Order count in the last 7 days is down ~${Math.abs(ordPct).toFixed(0)}% — try re-engaging past buyers (email/SMS) or product bundles.`
      );
    }
  }

  if (bullets.length === 0) {
    bullets.push(
      'Week-over-week movement is small — keep an eye on negative feedback and low-stock SKUs on the dashboard.'
    );
  }

  return bullets.slice(0, 3);
}

async function generateBulletsWithGemini(stats: WeeklyStatsComparison): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const prompt =
    `You are a business advisor for an e-commerce admin. All output MUST be in English only — never Vietnamese or other languages.\n` +
    `Data (revenue = DONE orders only; order count = all statuses):\n` +
    `- Last 7 days: revenue ${Math.round(stats.thisWeek.revenue)} VND, total orders ${stats.thisWeek.orders}.\n` +
    `- Previous 7 days: revenue ${Math.round(stats.lastWeek.revenue)} VND, total orders ${stats.lastWeek.orders}.\n\n` +
    `Return exactly 1–3 strings in the bullets array (each one short sentence, max ~160 characters).\n` +
    `Describe the trend vs the prior period and one concrete action. Use English only.\n` +
    `No greetings, no headings, no markdown, no numbering inside the strings.`;

  const config = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      required: ['bullets'],
      properties: {
        bullets: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    },
  };

  const aiResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    config,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const jsonText = aiResponse.text ?? '{}';
  const parsed = JSON.parse(jsonText) as { bullets?: unknown };
  const raw = parsed.bullets;
  if (!Array.isArray(raw)) throw new Error('Invalid bullets shape');
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

function normalizeBullets(b: string[]): string[] {
  const out = b.map((s) => s.trim()).filter(Boolean).slice(0, 3);
  if (out.length > 0) return out;
  return [
    'Not enough signal to analyze yet — keep monitoring revenue and orders on the dashboard.',
  ];
}

/** If the model ignored "English only", avoid caching Vietnamese in DB. */
function containsVietnameseDiacritics(s: string): boolean {
  return /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/u.test(
    s
  );
}

/**
 * Once per UTC day: return from DB if present; otherwise generate (Gemini when API key is set, else heuristic).
 * @param forceRegenerate When true, delete today's row first (e.g. query `?regenerate=1` for admins).
 */
export async function getOrCreateTodayMiniAdvice(forceRegenerate = false): Promise<string[]> {
  const date = utcCalendarDate();

  if (forceRegenerate) {
    await prisma.dashboardDailyInsight.deleteMany({ where: { date } });
  }

  let cached = await prisma.dashboardDailyInsight.findUnique({ where: { date } });
  if (cached?.bullets.some((line: string) => containsVietnameseDiacritics(line))) {
    await prisma.dashboardDailyInsight.deleteMany({ where: { date } });
    cached = null;
  }
  if (cached) return cached.bullets;

  const stats = await getWeeklyStatsComparison();

  let bullets: string[];
  if (process.env.GEMINI_API_KEY) {
    try {
      let fromModel = normalizeBullets(await generateBulletsWithGemini(stats));
      if (fromModel.some((line) => containsVietnameseDiacritics(line))) {
        console.warn('[AI] Mini advice: non-English output from model; using English heuristic instead');
        fromModel = normalizeBullets(heuristicMiniAdvice(stats));
      }
      bullets = fromModel;
    } catch (err) {
      console.error('[AI] Mini advice (Gemini) failed:', err);
      throw httpError(502, 'Could not generate AI advice right now');
    }
  } else {
    bullets = normalizeBullets(heuristicMiniAdvice(stats));
  }

  try {
    await prisma.dashboardDailyInsight.create({
      data: { date, bullets },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const again = await prisma.dashboardDailyInsight.findUnique({ where: { date } });
      if (again) return again.bullets;
    }
    throw e;
  }

  return bullets;
}

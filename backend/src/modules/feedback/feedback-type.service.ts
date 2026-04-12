import { analyzeFeedbackWithTypes } from '../ai/feedback/feedback-analyzer';
import { prisma } from '../../db';
import { httpError } from '../../utils/http-error';

const DEMO_MAX_TYPES = 64;
const DEMO_MAX_COMMENT = 8000;

export type DemoFeedbackTypeInput = {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
};

export async function demoAnalyzeFeedback(comment: string, types: DemoFeedbackTypeInput[]) {
  const trimmed = comment?.trim();
  if (!trimmed) throw httpError(400, 'Comment is required');
  if (!Array.isArray(types)) throw httpError(400, 'types must be an array');
  if (types.length > DEMO_MAX_TYPES) throw httpError(400, `At most ${DEMO_MAX_TYPES} types allowed`);

  const active = types
    .filter((t) => t.isActive && typeof t.name === 'string' && t.name.trim().length > 0)
    .map((t) => ({
      id: Number(t.id),
      name: t.name.trim(),
      description:
        t.description !== undefined && t.description !== null && String(t.description).trim()
          ? String(t.description).trim()
          : null,
    }));

  if (active.length === 0) {
    throw httpError(400, 'At least one active feedback type with a non-empty name is required');
  }

  if (trimmed.length > DEMO_MAX_COMMENT) throw httpError(400, 'Comment is too long');

  return analyzeFeedbackWithTypes(trimmed, active);
}

export async function listFeedbackTypes() {
  return prisma.feedbackType.findMany({ orderBy: { id: 'asc' } });
}

export async function createFeedbackType(data: { name: string; description?: string }) {
  const name = data.name.trim();
  if (!name) throw httpError(400, 'Name is required');

  const existing = await prisma.feedbackType.findUnique({ where: { name } });
  if (existing) throw httpError(409, 'A feedback type with this name already exists');

  return prisma.feedbackType.create({
    data: { name, description: data.description?.trim() || null },
  });
}

export async function updateFeedbackType(
  id: number,
  data: { name?: string; description?: string | null; isActive?: boolean }
) {
  const existing = await prisma.feedbackType.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Feedback type not found');

  const updateData: { name?: string; description?: string | null; isActive?: boolean } = {};

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw httpError(400, 'Name cannot be empty');
    const conflict = await prisma.feedbackType.findFirst({ where: { name, NOT: { id } } });
    if (conflict) throw httpError(409, 'A feedback type with this name already exists');
    updateData.name = name;
  }

  if (data.description !== undefined) updateData.description = data.description;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (data.isActive === false) {
    if (existing.name === 'Unknown') {
      throw httpError(409, '"Unknown" is the system default type and cannot be deactivated');
    }
    // Dùng transaction để tránh race condition: đếm và update trong cùng 1 lock
    return prisma.$transaction(async (tx) => {
      const otherActiveCount = await tx.feedbackType.count({
        where: { isActive: true, NOT: { id } },
      });
      if (otherActiveCount === 0) {
        throw httpError(409, 'At least one feedback type must remain active');
      }
      return tx.feedbackType.update({ where: { id }, data: updateData });
    });
  }

  return prisma.feedbackType.update({ where: { id }, data: updateData });
}

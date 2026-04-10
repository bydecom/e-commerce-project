import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db';
import { httpError } from '../../utils/http-error';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  // Intentionally simple; good enough for basic API validation.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function mapUser(u: { id: number; name: string | null; email: string; role: 'USER' | 'ADMIN' }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export async function register(input: { name: string; email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const password = input.password;
  const name = input.name?.trim() ? input.name.trim() : null;

  if (!email) throw httpError(400, 'email is required');
  if (!isValidEmail(email)) throw httpError(400, 'Invalid email');
  if (!password) throw httpError(400, 'password is required');
  if (password.length < 6) throw httpError(400, 'Password must be at least 6 characters');

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const u = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        name,
        role: 'USER',
      },
      select: { id: true, name: true, email: true, role: true },
    });
    return mapUser(u);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint (email already exists)
      if (e.code === 'P2002') throw httpError(409, 'Email already exists');
    }
    throw e;
  }
}

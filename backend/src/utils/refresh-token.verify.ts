/**
 * Refresh-token security verification script.
 *
 * Run with:
 *   npx ts-node src/utils/refresh-token.verify.ts
 *
 * Requires Redis to be running (same config as the app).
 * Each test issues its own tokens and cleans up after itself.
 */

import {
  generateRefreshToken,
  generateTokenFamily,
  storeRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeTokenFamily,
  revokeAllUserRefreshTokens,
  RefreshTokenPayload,
} from './refresh-token';

// ─── tiny test harness ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  console.log(`\n[${name}]`);
  try {
    await fn();
  } catch (err) {
    console.error(`  ✗ threw unexpectedly:`, err);
    failed++;
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function makePayload(overrides: Partial<RefreshTokenPayload> = {}): RefreshTokenPayload {
  return { userId: 9999, role: 'USER', familyId: generateTokenFamily(), ...overrides };
}

async function issue(
  overrides: Partial<RefreshTokenPayload> = {},
): Promise<{ raw: string; payload: RefreshTokenPayload }> {
  const payload = makePayload(overrides);
  const raw = generateRefreshToken();
  await storeRefreshToken(raw, payload);
  return { raw, payload };
}

// ─── test suite ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  /**
   * Test 1 – Normal rotation chain A→B→C
   *
   * Each rotation must succeed and return a new token.
   * Old tokens must be dead immediately after rotation.
   */
  await test('Normal rotation chain (A → B → C)', async () => {
    const { raw: tokenA } = await issue();

    const r1 = await rotateRefreshToken(tokenA);
    assert(r1.status === 'ok', 'A → B rotation succeeds');
    if (r1.status !== 'ok') return;
    const tokenB = r1.newRaw;

    const r2 = await rotateRefreshToken(tokenB);
    assert(r2.status === 'ok', 'B → C rotation succeeds');
    if (r2.status !== 'ok') return;
    const tokenC = r2.newRaw;

    const rA = await rotateRefreshToken(tokenA);
    assert(rA.status !== 'ok', 'Token A is dead after rotation');

    const rB = await rotateRefreshToken(tokenB);
    assert(rB.status !== 'ok', 'Token B is dead after rotation');

    await revokeRefreshToken(tokenC);
  });

  /**
   * Test 2 – Reuse detection
   *
   * Attack scenario:
   *   1. Attacker steals token A before the client uses it.
   *   2. Legitimate client rotates A → B (attacker still holds A).
   *   3. Attacker replays A.
   *
   * Expected: replay returns `reuse_detected`; caller revokes the family;
   * token B (held by the legitimate client) is also killed.
   *
   * This is the core guarantee: one replayed token collapses the entire session.
   */
  await test('Reuse detection: replaying a rotated token revokes the family', async () => {
    const { raw: tokenA, payload } = await issue();

    // Legitimate client rotates A → B
    const r1 = await rotateRefreshToken(tokenA);
    assert(r1.status === 'ok', 'Initial rotation A → B succeeds');
    if (r1.status !== 'ok') return;
    const tokenB = r1.newRaw;

    // Attacker replays old token A
    const rReuse = await rotateRefreshToken(tokenA);
    assert(rReuse.status === 'reuse_detected', 'Replaying token A triggers reuse_detected');

    if (rReuse.status === 'reuse_detected') {
      assert(rReuse.familyId === payload.familyId, 'Reported familyId matches the session family');
      assert(rReuse.userId === payload.userId, 'Reported userId matches the session owner');

      // auth.service.ts does this on reuse_detected
      await revokeTokenFamily(rReuse.familyId, rReuse.userId);
    }

    // Token B — held by the legitimate client — must now be invalid
    const rB = await rotateRefreshToken(tokenB);
    assert(rB.status !== 'ok', 'Token B is killed after family revocation');
  });

  /**
   * Test 3 – Concurrent rotation (TOCTOU guard)
   *
   * Attack scenario (without the fix):
   *   Two requests arrive simultaneously with the same token.
   *   A non-atomic implementation reads the token in both before either deletes
   *   it, so both succeed and issue independent new tokens — one account, two
   *   active sessions from a single rotation.
   *
   * Expected with the Lua fix: exactly one succeeds; the other loses the race.
   */
  await test('Concurrent rotation: only one of two simultaneous requests succeeds', async () => {
    const { raw: tokenA } = await issue();

    const [r1, r2] = await Promise.all([
      rotateRefreshToken(tokenA),
      rotateRefreshToken(tokenA),
    ]);

    const successes = [r1, r2].filter((r) => r.status === 'ok').length;
    assert(successes === 1, `Exactly 1 of 2 concurrent rotations succeeds (got ${successes})`);

    for (const r of [r1, r2]) {
      if (r.status === 'ok') await revokeRefreshToken(r.newRaw);
    }
  });

  /**
   * Test 4 – Unknown token
   *
   * A random value that was never stored must return `not_found`, not throw.
   */
  await test('Unknown token returns not_found', async () => {
    const ghost = generateRefreshToken();
    const r = await rotateRefreshToken(ghost);
    assert(r.status === 'not_found', 'Completely unknown token → not_found');
  });

  /**
   * Test 5 – Single-token revocation
   *
   * revokeRefreshToken must kill only the target token.
   * A second token for the same user (different family) must remain valid.
   */
  await test('revokeRefreshToken invalidates only the target token', async () => {
    const userId = 9998;
    const { raw: tokenA } = await issue({ userId, familyId: generateTokenFamily() });
    const { raw: tokenB } = await issue({ userId, familyId: generateTokenFamily() });

    await revokeRefreshToken(tokenA);

    const rA = await rotateRefreshToken(tokenA);
    assert(rA.status === 'not_found', 'Token A is revoked');

    const rB = await rotateRefreshToken(tokenB);
    assert(rB.status === 'ok', 'Token B (same user, different family) is unaffected');

    if (rB.status === 'ok') await revokeRefreshToken(rB.newRaw);
  });

  /**
   * Test 6 – revokeAllUserRefreshTokens
   *
   * All tokens across all families for one user must be wiped.
   * A token belonging to a different user must be untouched.
   */
  await test('revokeAllUserRefreshTokens wipes all sessions for one user only', async () => {
    const userId = 9997;
    const otherUserId = 9996;

    const { raw: t1 } = await issue({ userId, familyId: generateTokenFamily() });
    const { raw: t2 } = await issue({ userId, familyId: generateTokenFamily() });
    const { raw: tOther } = await issue({ userId: otherUserId, familyId: generateTokenFamily() });

    await revokeAllUserRefreshTokens(userId);

    const r1 = await rotateRefreshToken(t1);
    assert(r1.status === 'not_found', 'Session 1 of target user is revoked');

    const r2 = await rotateRefreshToken(t2);
    assert(r2.status === 'not_found', 'Session 2 of target user is revoked');

    const rOther = await rotateRefreshToken(tOther);
    assert(rOther.status === 'ok', 'Other user\'s session is unaffected');

    if (rOther.status === 'ok') await revokeRefreshToken(rOther.newRaw);
  });

  /**
   * Test 7 – familyId preserved through rotation chain
   *
   * The new token after rotation must carry the same familyId as the original.
   * Without this, reuse detection cannot trace stolen tokens back to their family.
   */
  await test('familyId is preserved across the full rotation chain', async () => {
    const { raw: tokenA, payload } = await issue();
    const { familyId } = payload;

    const r1 = await rotateRefreshToken(tokenA);
    assert(r1.status === 'ok', 'Rotation A → B succeeds');
    if (r1.status !== 'ok') return;
    assert(r1.payload.familyId === familyId, 'familyId preserved A → B');

    const r2 = await rotateRefreshToken(r1.newRaw);
    assert(r2.status === 'ok', 'Rotation B → C succeeds');
    if (r2.status !== 'ok') return;
    assert(r2.payload.familyId === familyId, 'familyId preserved B → C');

    await revokeRefreshToken(r2.newRaw);
  });

  // ─── summary ────────────────────────────────────────────────────────────────

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error('\nSome tests FAILED — the implementation has gaps.');
    process.exit(1);
  } else {
    console.log('\nAll tests passed.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

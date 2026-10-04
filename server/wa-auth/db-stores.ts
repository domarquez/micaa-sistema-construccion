/** Stores sobre Neon/Drizzle. Requieren migrations/0002_wa_otp_login.sql aplicada. */
import { randomBytes } from "crypto";
import { and, desc, eq, gt, gte, isNull, lt, ne, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { authOtpCodes, userSessions, users } from "../../shared/schema";
import type { AuthUser, OtpRow, OtpStore, SessionRow, SessionStore, UserStore } from "./types";

const toOtp = (r: any): OtpRow => ({ ...r, purpose: r.purpose, channel: r.channel, sendStatus: r.sendStatus });

export const dbOtpStore: OtpStore = {
  async countByPhoneSince(phone, since) {
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(authOtpCodes)
      .where(and(eq(authOtpCodes.phone, phone), gte(authOtpCodes.createdAt, since)));
    return Number(r?.n || 0);
  },
  async countByIpSince(ip, since) {
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(authOtpCodes)
      .where(and(eq(authOtpCodes.requestIp, ip), gte(authOtpCodes.createdAt, since)));
    return Number(r?.n || 0);
  },
  async lastCreatedAt(phone) {
    const [r] = await db.select({ c: authOtpCodes.createdAt }).from(authOtpCodes)
      .where(eq(authOtpCodes.phone, phone)).orderBy(desc(authOtpCodes.createdAt)).limit(1);
    return r?.c || null;
  },
  async supersedeActive(phone, now) {
    await db.update(authOtpCodes).set({ consumedAt: now })
      .where(and(eq(authOtpCodes.phone, phone), isNull(authOtpCodes.consumedAt)));
  },
  async insert(row) {
    const [r] = await db.insert(authOtpCodes).values({
      phone: row.phone, codeHash: row.codeHash, purpose: row.purpose, channel: row.channel,
      userId: row.userId, requestIp: row.requestIp, maxAttempts: row.maxAttempts,
      expiresAt: row.expiresAt, createdAt: row.createdAt,
    }).returning({ id: authOtpCodes.id });
    return r.id;
  },
  async markSend(id, status, providerMessageId) {
    await db.update(authOtpCodes).set({ sendStatus: status, providerMessageId: providerMessageId || null }).where(eq(authOtpCodes.id, id));
  },
  async findActive(phone, now) {
    const [r] = await db.select().from(authOtpCodes).where(and(
      eq(authOtpCodes.phone, phone), isNull(authOtpCodes.consumedAt),
      gt(authOtpCodes.expiresAt, now), ne(authOtpCodes.sendStatus, "failed"),
    )).orderBy(desc(authOtpCodes.createdAt)).limit(1);
    return r ? toOtp(r) : null;
  },
  async incrementAttempts(id) {
    const [r] = await db.update(authOtpCodes).set({ attempts: sql`${authOtpCodes.attempts} + 1` })
      .where(and(eq(authOtpCodes.id, id), lt(authOtpCodes.attempts, authOtpCodes.maxAttempts)))
      .returning({ attempts: authOtpCodes.attempts });
    return r ? r.attempts : null;
  },
  async consume(id, now) {
    const r = await db.update(authOtpCodes).set({ consumedAt: now })
      .where(and(eq(authOtpCodes.id, id), isNull(authOtpCodes.consumedAt))).returning({ id: authOtpCodes.id });
    return r.length > 0;
  },
};

const toUser = (u: any): AuthUser => ({
  id: u.id, username: u.username, email: u.email, role: u.role, userType: u.userType,
  firstName: u.firstName, lastName: u.lastName, phone: u.phone, isActive: u.isActive,
  city: u.city, country: u.country,
});

export const dbUserStore: UserStore = {
  async getById(id) {
    const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return u ? toUser(u) : null;
  },
  async findByPhone(phone) {
    const [u] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return u ? toUser(u) : null;
  },
  async createForPhone(phone) {
    // users.username/email/password son NOT NULL: generamos valores internos no adivinables.
    // El usuario puede poner su nombre después (nombre opcional). La contraseña es aleatoria e inutilizable.
    const tag = randomBytes(6).toString("hex");
    const password = await bcrypt.hash(randomBytes(32).toString("base64url"), 10);
    try {
      const [u] = await db.insert(users).values({
        username: `wa_${tag}`,
        email: `wa_${tag}@wa.micaa.invalid`,
        password,
        phone,
        phoneVerified: true,
        role: "user",
        userType: "architect",
        isActive: true,
      }).returning();
      return toUser(u);
    } catch (e: any) {
      // Carrera: otra petición creó la cuenta para el mismo número (índice único users_phone_unique)
      const existing = await dbUserStore.findByPhone(phone);
      if (existing) return existing;
      throw e;
    }
  },
  async setPhone(userId, phone) {
    const other = await dbUserStore.findByPhone(phone);
    if (other && other.id !== userId) return "taken";
    try {
      await db.update(users).set({ phone, phoneVerified: true }).where(eq(users.id, userId));
      return "ok";
    } catch (e: any) {
      if (String(e?.code) === "23505") return "taken";
      throw e;
    }
  },
  async touchLastLogin(userId) {
    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, userId));
  },
  async updateName(userId, firstName, lastName) {
    await db.update(users).set({ firstName, lastName }).where(eq(users.id, userId));
  },
};

export const dbSessionStore: SessionStore = {
  async create(row) {
    await db.insert(userSessions).values(row);
  },
  async findById(id) {
    const [r] = await db.select().from(userSessions).where(eq(userSessions.id, id)).limit(1);
    return (r as SessionRow) || null;
  },
  async findByTokenHash(hash) {
    const [r] = await db.select().from(userSessions).where(eq(userSessions.tokenHash, hash)).limit(1);
    return (r as SessionRow) || null;
  },
  async touch(id, lastSeenAt, expiresAt) {
    await db.update(userSessions).set({ lastSeenAt, expiresAt }).where(and(eq(userSessions.id, id), isNull(userSessions.revokedAt)));
  },
  async listActiveForUser(userId, now) {
    return (await db.select().from(userSessions).where(and(
      eq(userSessions.userId, userId), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, now),
    )).orderBy(desc(userSessions.lastSeenAt))) as SessionRow[];
  },
  async revoke(id, userId, now) {
    const r = await db.update(userSessions).set({ revokedAt: now })
      .where(and(eq(userSessions.id, id), eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
      .returning({ id: userSessions.id });
    return r.length > 0;
  },
  async revokeAllForUser(userId, now) {
    const r = await db.update(userSessions).set({ revokedAt: now })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
      .returning({ id: userSessions.id });
    return r.length;
  },
};

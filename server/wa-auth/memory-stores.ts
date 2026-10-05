/** Stores en memoria (tests / desarrollo sin DB). */
import type { AuthUser, OtpRow, OtpStore, SessionRow, SessionStore, UserStore } from "./types";

export function createMemoryOtpStore(): OtpStore & { rows: OtpRow[] } {
  const rows: OtpRow[] = [];
  let seq = 0;
  return {
    rows,
    async countByPhoneSince(phone, since) {
      return rows.filter((r) => r.phone === phone && r.createdAt >= since).length;
    },
    async countByIpSince(ip, since) {
      return rows.filter((r) => r.requestIp === ip && r.createdAt >= since).length;
    },
    async lastCreatedAt(phone) {
      const list = rows.filter((r) => r.phone === phone);
      return list.length ? list[list.length - 1].createdAt : null;
    },
    async supersedeActive(phone, now) {
      for (const r of rows) if (r.phone === phone && !r.consumedAt) r.consumedAt = now;
    },
    async insert(row) {
      const id = ++seq;
      rows.push({ ...row, id, attempts: 0, consumedAt: null, sendStatus: "pending" });
      return id;
    },
    async markSend(id, status) {
      const r = rows.find((x) => x.id === id);
      if (r) r.sendStatus = status;
    },
    async findActive(phone, now) {
      const list = rows.filter((r) => r.phone === phone && !r.consumedAt && r.expiresAt > now && r.sendStatus !== "failed");
      return list.length ? list[list.length - 1] : null;
    },
    async incrementAttempts(id) {
      const r = rows.find((x) => x.id === id);
      if (!r || r.attempts >= r.maxAttempts) return null;
      r.attempts++;
      return r.attempts;
    },
    async consume(id, now) {
      const r = rows.find((x) => x.id === id);
      if (!r || r.consumedAt) return false;
      r.consumedAt = now;
      return true;
    },
  };
}

export function createMemoryUserStore(seed: AuthUser[] = []): UserStore & { users: AuthUser[] } {
  const users = [...seed];
  let seq = users.reduce((m, u) => Math.max(m, u.id), 0);
  return {
    users,
    async getById(id) { return users.find((u) => u.id === id) || null; },
    async findByPhone(phone) { return users.find((u) => u.phone === phone) || null; },
    async createForPhone(phone) {
      const id = ++seq;
      const u: AuthUser = { id, username: `wa_${id}`, email: `wa_${id}@wa.micaa.invalid`, role: "user", userType: "architect", phone, phoneVerified: true, isActive: true };
      users.push(u);
      return u;
    },
    async setPhone(userId, phone) {
      const other = users.find((u) => u.phone === phone && u.id !== userId);
      if (other) {
        if (!other.phoneVerified) {
          other.phone = null;
          other.phoneVerified = false;
        } else {
          return "taken";
        }
      }
      const u = users.find((x) => x.id === userId);
      if (u) { u.phone = phone; u.phoneVerified = true; }
      return "ok";
    },
    async clearUnverifiedPhone(phone) {
      const u = users.find((x) => x.phone === phone && !x.phoneVerified);
      if (!u) return false;
      u.phone = null;
      u.phoneVerified = false;
      return true;
    },
    async touchLastLogin() {},
    async updateName(userId, firstName, lastName) {
      const u = users.find((x) => x.id === userId);
      if (u) { u.firstName = firstName; u.lastName = lastName; }
    },
  };
}

export function createMemorySessionStore(): SessionStore & { rows: SessionRow[] } {
  const rows: SessionRow[] = [];
  return {
    rows,
    async create(row) { rows.push({ ...row }); },
    async findById(id) { return rows.find((r) => r.id === id) || null; },
    async findByTokenHash(h) { return rows.find((r) => r.tokenHash === h) || null; },
    async touch(id, lastSeenAt, expiresAt) {
      const r = rows.find((x) => x.id === id);
      if (r) { r.lastSeenAt = lastSeenAt; r.expiresAt = expiresAt; }
    },
    async listActiveForUser(userId, now) {
      return rows.filter((r) => r.userId === userId && !r.revokedAt && r.expiresAt > now).sort((a, b) => +b.lastSeenAt - +a.lastSeenAt);
    },
    async revoke(id, userId, now) {
      const r = rows.find((x) => x.id === id && x.userId === userId && !x.revokedAt);
      if (!r) return false;
      r.revokedAt = now;
      return true;
    },
    async revokeAllForUser(userId, now) {
      let n = 0;
      for (const r of rows) if (r.userId === userId && !r.revokedAt) { r.revokedAt = now; n++; }
      return n;
    },
  };
}

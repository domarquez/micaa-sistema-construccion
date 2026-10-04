export type OtpPurpose = "login" | "link";
export type OtpChannel = "outbound" | "inbound";

export interface OtpRow {
  id: number;
  phone: string;
  codeHash: string;
  purpose: OtpPurpose;
  channel: OtpChannel;
  userId: number | null;
  requestIp: string | null;
  attempts: number;
  maxAttempts: number;
  sendStatus: "pending" | "sent" | "failed";
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface OtpStore {
  countByPhoneSince(phone: string, since: Date): Promise<number>;
  countByIpSince(ip: string, since: Date): Promise<number>;
  lastCreatedAt(phone: string): Promise<Date | null>;
  /** Invalida (consume) los códigos vigentes anteriores del número. */
  supersedeActive(phone: string, now: Date): Promise<void>;
  insert(row: Omit<OtpRow, "id" | "attempts" | "consumedAt" | "createdAt" | "sendStatus"> & { createdAt: Date }): Promise<number>;
  markSend(id: number, status: "sent" | "failed", providerMessageId?: string): Promise<void>;
  /** Último código vigente (no consumido, no vencido, no fallido) del número. */
  findActive(phone: string, now: Date): Promise<OtpRow | null>;
  /** Incrementa intentos de forma atómica si quedan; devuelve intentos tras el incremento o null si ya se agotaron. */
  incrementAttempts(id: number): Promise<number | null>;
  /** Marca consumido si aún no lo estaba. true si este llamado lo consumió. */
  consume(id: number, now: Date): Promise<boolean>;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: string;
  userType?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  isActive: boolean;
  city?: string | null;
  country?: string | null;
}

export interface UserStore {
  getById(id: number): Promise<AuthUser | null>;
  findByPhone(phone: string): Promise<AuthUser | null>;
  /** Crea cuenta mínima para un número (registro automático). */
  createForPhone(phone: string): Promise<AuthUser>;
  /** Vincula número; 'taken' si pertenece a otra cuenta. */
  setPhone(userId: number, phone: string): Promise<"ok" | "taken">;
  touchLastLogin(userId: number): Promise<void>;
  updateName(userId: number, firstName: string | null, lastName: string | null): Promise<void>;
}

export interface SessionRow {
  id: string;
  userId: number;
  tokenHash: string;
  deviceName: string | null;
  userAgent: string | null;
  ip: string | null;
  authMethod: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface SessionStore {
  create(row: SessionRow): Promise<void>;
  findById(id: string): Promise<SessionRow | null>;
  findByTokenHash(hash: string): Promise<SessionRow | null>;
  touch(id: string, lastSeenAt: Date, expiresAt: Date): Promise<void>;
  listActiveForUser(userId: number, now: Date): Promise<SessionRow[]>;
  revoke(id: string, userId: number, now: Date): Promise<boolean>;
  revokeAllForUser(userId: number, now: Date): Promise<number>;
}

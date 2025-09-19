declare module 'telegraf' {
  interface SessionData {
    state?: 'awaiting_password' | 'awaiting_phone' | null;
    password?: string;
    phone?: string | null;
  }

  interface Context {
    session: SessionData;
  }
}

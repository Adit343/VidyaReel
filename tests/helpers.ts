import { approvedEmails } from '@/server/db/collections';

export const PASSWORD = 'correct horse battery';

export async function approve(email: string, role: 'member' | 'admin' = 'member') {
  await approvedEmails().insertOne({ email, role, dailyLimit: 5, addedAt: new Date() } as never);
}

export const req = (url = 'http://localhost:3000/api/x', init?: RequestInit) => new Request(url, init);

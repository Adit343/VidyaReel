export interface EmailProvider {
  send(msg: { to: string; subject: string; text: string }): Promise<void>;
}

// Resend adapter (https://resend.com/docs/api-reference/emails/send-email).
export const emailProvider: EmailProvider = {
  async send({ to, subject, text }) {
    if (!process.env.RESEND_API_KEY) {
      console.log(`[email:dev] to=${to} subject=${subject}\n${text}`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
    });
    if (!res.ok) throw new Error(`Email send failed: ${res.status}`);
  },
};

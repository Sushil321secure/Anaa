import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { EmailLog } from './emailLog.model.js';
import { templates } from './templates.js';

let transport;
function getTransport() {
  if (!env.SMTP_HOST) return null;
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transport;
}

/**
 * Sends a templated email and records the outcome in emailLogs.
 * Never throws: email problems must not fail the request that triggered them.
 * Without SMTP configuration the email is logged as SKIPPED.
 */
export async function sendTemplate(to, templateName, data) {
  const { subject, html, text } = templates[templateName](data);
  const base = { to, subject, template: templateName };
  const t = getTransport();
  if (!t) {
    await EmailLog.create({ ...base, status: 'SKIPPED', error: 'SMTP not configured' }).catch(() => {});
    return false;
  }
  try {
    await t.sendMail({ from: env.MAIL_FROM, to, subject, html, text });
    await EmailLog.create({ ...base, status: 'SENT' });
    return true;
  } catch (err) {
    await EmailLog.create({ ...base, status: 'FAILED', error: err.message }).catch(() => {});
    return false;
  }
}

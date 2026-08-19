// Service d'envoi d'emails.
// Si SMTP_HOST/SMTP_USER/SMTP_PASS ne sont pas configurés, l'email est simplement
// affiché dans les logs du serveur — pratique pour développer/tester sans compte SMTP.

const nodemailer = require('nodemailer');

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendVerificationEmail({ to, name, token }) {
  const link = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email.html?token=${token}`;
  const subject = 'Confirme ton adresse email — Sport Analytics';
  const html = `
    <p>Bonjour ${escapeHtml(name)},</p>
    <p>Merci de t'être inscrit sur Sport Analytics. Clique sur le lien ci-dessous pour confirmer ton adresse email :</p>
    <p><a href="${link}">${link}</a></p>
    <p>Si tu n'es pas à l'origine de cette inscription, ignore cet email.</p>
  `;

  if (!isConfigured()) {
    console.log('📧 [MODE TEST — SMTP non configuré] Email de vérification pour', to);
    console.log('   Lien de vérification :', link);
    return { simulated: true };
  }

  const transporter = getTransporter();
  return transporter.sendMail({
    from: process.env.SMTP_FROM || 'Sport Analytics <no-reply@sport-analytics.com>',
    to,
    subject,
    html
  });
}

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

module.exports = { sendVerificationEmail, isConfigured };

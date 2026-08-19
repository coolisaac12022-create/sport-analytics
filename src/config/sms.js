// Service d'envoi de SMS pour la vérification du numéro de téléphone.
// Si les identifiants Twilio ne sont pas configurés, le code OTP est simplement
// affiché dans les logs du serveur — pratique pour développer/tester sans compte Twilio.

function isConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

async function sendOtpSms({ to, code }) {
  const message = `Sport Analytics : ton code de vérification est ${code}. Il expire dans 10 minutes.`;

  if (!isConfigured()) {
    console.log('📱 [MODE TEST — Twilio non configuré] Code OTP pour', to, ':', code);
    return { simulated: true };
  }

  // Chargement paresseux : évite de casser le projet si le paquet "twilio" n'est pas encore installé
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  return client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to
  });
}

module.exports = { sendOtpSms, isConfigured };

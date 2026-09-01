'use strict';

const fetch = require('node-fetch');

async function generateAIResponse({
  question,
  messages = [],
  context = {}
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.log('ANTHROPIC_API_KEY non configurée.');
    return null;
  }

  const userName = context?.user?.name || 'Utilisateur';
  const userRole = context?.user?.role || 'user';

  const systemPrompt = `
Tu es Galika, l'assistante intelligente de Sport Analytics.

Tu es une assistante naturelle, claire, utile et proactive.
Tu connais le contexte de la plateforme et tu peux utiliser les informations
qui te sont fournies dans le contexte.

Utilisateur :
- Nom : ${userName}
- Rôle : ${userRole}

Contexte actuel :
${JSON.stringify(context, null, 2)}

Règles :
- Réponds en français sauf si l'utilisateur demande une autre langue.
- Sois naturelle et conversationnelle.
- Utilise le contexte fourni lorsqu'il est pertinent.
- Ne prétends jamais avoir accès à une information qui n'est pas fournie.
- Pour les informations récentes, utilise les résultats Web fournis par Galika
  lorsqu'ils sont disponibles.
- Pour les statistiques sportives, base-toi sur les données fournies par les
  outils du site.
- Explique les statistiques simplement lorsque l'utilisateur ne les comprend pas.
- Ne présente jamais une prédiction comme une certitude.
- Ne fabrique pas de statistiques, de résultats ou d'informations.
- Si une information manque, dis-le clairement.
- Tu es l'assistante de Sport Analytics, pas seulement un chatbot générique.
`;

  const history = Array.isArray(messages)
    ? messages
        .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
        .slice(-10)
        .map(m => ({
          role: m.role,
          content: String(m.content || '')
        }))
    : [];

  const currentQuestion = String(question || '').trim();

  if (!currentQuestion) {
    return null;
  }

  /*
   * Si la question actuelle n'est pas encore présente dans l'historique,
   * on l'ajoute.
   */
  const lastMessage = history[history.length - 1];

  if (
    !lastMessage ||
    lastMessage.role !== 'user' ||
    lastMessage.content !== currentQuestion
  ) {
    history.push({
      role: 'user',
      content: currentQuestion
    });
  }

  try {
    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: systemPrompt,
          messages: history
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        'Erreur API Anthropic Galika:',
        response.status,
        errorText.slice(0, 500)
      );

      return null;
    }

    const data = await response.json();

    const textBlock = Array.isArray(data.content)
      ? data.content.find(block => block.type === 'text')
      : null;

    return textBlock?.text?.trim() || null;

  } catch (error) {
    console.error(
      'Moteur IA Galika indisponible :',
      error.message
    );

    return null;
  }
}

module.exports = {
  generateAIResponse
};

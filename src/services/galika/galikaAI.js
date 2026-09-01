'use strict';

const fetch = require('node-fetch');

async function generateAIResponse({
  question,
  messages = [],
  context = {}
}) {
  const apiKey = process.env.GALIKA_AI_API_KEY;
  const apiUrl = process.env.GALIKA_AI_API_URL;

  // Aucun fournisseur IA configuré :
  // Galika continue d'utiliser son moteur local.
  if (!apiKey || !apiUrl) {
    return null;
  }

  const payload = {
    question: String(question || ''),
    messages: Array.isArray(messages) ? messages : [],
    context: context || {}
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`AI HTTP ${response.status}`);
    }

    const data = await response.json();

    return (
      data.answer ||
      data.response ||
      data.message ||
      null
    );
  } catch (error) {
    console.log(
      'Moteur IA Galika indisponible :',
      error.message
    );

    return null;
  }
}

module.exports = {
  generateAIResponse
};

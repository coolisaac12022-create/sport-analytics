'use strict';

async function webSearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error('TAVILY_API_KEY non configurée.');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: String(query),
      search_depth: 'basic',
      max_results: 5,
      include_answer: true
    })
  });

  if (!response.ok) {
    throw new Error(`Recherche web impossible (${response.status}).`);
  }

  const data = await response.json();

  return {
    answer: data.answer || '',
    results: (data.results || []).map(result => ({
      title: result.title || '',
      url: result.url || '',
      content: result.content || ''
    }))
  };
}

module.exports = {
  webSearch
};

'use strict';

async function puriliSearch(query) {
  const url =
    'https://puri.li/api/search?q=' +
    encodeURIComponent(String(query));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Recherche Purili impossible (${response.status}).`);
  }

  const data = await response.json();

  const results = Array.isArray(data.results)
    ? data.results
    : [];

  return {
    answer: '',
    results: results.slice(0, 5).map(result => ({
      title: result.title || '',
      url: result.url || '',
      content:
        result.snippet ||
        result.description ||
        result.content ||
        ''
    }))
  };
}

async function tavilySearch(query, apiKey) {
  const response = await fetch(
    'https://api.tavily.com/search',
    {
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
    }
  );

  if (!response.ok) {
    throw new Error(`Recherche Tavily impossible (${response.status}).`);
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

async function webSearch(query) {
  const tavilyKey = process.env.TAVILY_API_KEY;

  if (tavilyKey) {
    return tavilySearch(query, tavilyKey);
  }

  console.log('TAVILY_API_KEY absente : utilisation de Purili.');

  return puriliSearch(query);
}

module.exports = {
  webSearch
};

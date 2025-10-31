// netlify/functions/tmdb.js

exports.handler = async function (event, context) {
  // Pega o token secreto que guardamos no Netlify
  const API_TOKEN = process.env.TMDB_API_TOKEN;

  // Pega o que o usuário quer buscar (passado na URL, ex: ?query=batman)
  const query = event.queryStringParameters.query || 'popular';
  const path = event.queryStringParameters.path || 'movie/popular';

  // Monta a URL da API do TMDB
  // Exemplo: https://api.themoviedb.org/3/search/movie?query=batman
  // Ou: https://api.themoviedb.org/3/movie/popular

  let apiUrl;
  if (query !== 'popular') {
    apiUrl = `https://api.themoviedb.org/3/search/movie?query=${query}`;
  } else {
    apiUrl = `https://api.themoviedb.org/3/${path}`;
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        // Aqui usamos o Token de Acesso (v4 auth)
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json;charset=utf-8'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro na API do TMDB: ${response.statusText}`);
    }

    const data = await response.json();

    // Retorna os dados para o seu JavaScript (navegador)
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };

  } catch (error) {
    // Retorna o erro
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
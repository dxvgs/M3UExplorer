// 1. Carregar as ferramentas
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config(); 

// 2. Configurar o servidor
const app = express();
const PORT = 3000; 
app.use(cors()); 
app.use(express.static('public')); 

// 3. O "Cache"
const tmdbCache = new Map();

// 4. API de BUSCA (MODIFICADA para retornar ID)
app.get('/api/tmdb', async (req, res) => {
    const { query, type, year } = req.query; 

    if (!query || !type) {
        return res.status(400).json({ message: 'Query e Type são obrigatórios' });
    }

    const cacheKey = `${type}:${query}:${year || ''}`;
    
    if (tmdbCache.has(cacheKey)) {
        return res.json(tmdbCache.get(cacheKey));
    }

    console.log(`[TMDB SEARCH] Buscando: ${query} (Tipo: ${type})`);
    try {
        const apiKey = process.env.TMDB_API_KEY;
        const searchUrl = `https://api.themoviedb.org/3/search/${type}`;
        
        const response = await axios.get(searchUrl, {
            params: {
                api_key: apiKey,
                query: query,
                language: 'pt-BR',
                year: year
            }
        });

        if (response.data && response.data.results.length > 0) {
            const result = response.data.results[0];
            const cleanData = {
                id: result.id, // <<< --- NOVO: Retorna o ID
                title: result.title || result.name,
                overview: result.overview,
                poster_path: `https://image.tmdb.org/t/p/w500${result.poster_path}`,
                vote_average: result.vote_average.toFixed(1),
                release_date: result.release_date || result.first_air_date
            };
            
            tmdbCache.set(cacheKey, cleanData);
            res.json(cleanData);

        } else {
            const notFound = { message: 'Não encontrado' };
            tmdbCache.set(cacheKey, notFound); 
            res.status(404).json(notFound);
        }

    } catch (error) {
        console.error("Erro ao buscar no TMDB:", error.message);
        res.status(500).json({ message: 'Erro no servidor TMDB' });
    }
});

// 5. NOVO: API DE DETALHES COMPLETOS
app.get('/api/details', async (req, res) => {
    const { type, id } = req.query;

    if (!type || !id) {
        return res.status(400).json({ message: 'Type e ID são obrigatórios' });
    }

    const cacheKey = `details:${type}:${id}`;

    // 5.1. VERIFICA O CACHE
    if (tmdbCache.has(cacheKey)) {
        return res.json(tmdbCache.get(cacheKey));
    }

    // 5.2. BUSCA NO TMDB
    console.log(`[TMDB DETAILS] Buscando: ${type} com ID: ${id}`);
    try {
        const apiKey = process.env.TMDB_API_KEY;
        const detailsUrl = `https://api.themoviedb.org/3/${type}/${id}`;

        const response = await axios.get(detailsUrl, {
            params: {
                api_key: apiKey,
                language: 'pt-BR'
            }
        });

        const result = response.data;

        // Limpa os dados completos
        const cleanData = {
            title: result.title || result.name,
            overview: result.overview,
            poster_path: `https://image.tmdb.org/t/p/w780${result.poster_path}`,
            vote_average: result.vote_average.toFixed(1),
            release_date: result.release_date || result.first_air_date,
            genres: result.genres.map(g => g.name), // Pega só os nomes
            runtime: result.runtime // Duração (para filmes)
        };

        tmdbCache.set(cacheKey, cleanData);
        res.json(cleanData);

    } catch (error) {
        console.error("Erro ao buscar detalhes no TMDB:", error.message);
        res.status(500).json({ message: 'Erro no servidor TMDB' });
    }
});


// 6. Inicia o servidor
app.listen(PORT, () => {
    console.log(`--- Servidor rodando em http://localhost:${PORT} ---`);
});
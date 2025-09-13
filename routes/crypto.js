const express = require('express');
const axios = require('axios');
const router = express.Router();
const { auth } = require('../middleware/auth');

// This endpoint is protected and requires a user to be logged in.
router.get('/prices', auth, async (req, res) => {
    const apiKey = process.env.CRYPTO_API_KEY;
    const apiUrl = process.env.CRYPTO_API_URL || 'https://pro-api.coinmarketcap.com';
    
    if (!apiKey || apiKey.includes('your_crypto_api_key')) {
        console.error('Crypto API key is not configured on the server.');
        return res.status(500).json({ error: 'Price service is currently unavailable.' });
    }

    // Define the cryptocurrencies you want to fetch prices for
    const symbols = 'BTC,ETH,LTC,USDT';

    try {
        const response = await axios.get(`${apiUrl}/v1/cryptocurrency/quotes/latest`, {
            headers: {
                'X-CMC_PRO_API_KEY': apiKey,
                'Accept': 'application/json'
            },
            params: {
                symbol: symbols
            }
        });

        // Extract and format the data we need to send to the client
        const prices = {};
        const responseData = response.data.data;

        for (const symbol of symbols.split(',')) {
            if (responseData[symbol]) {
                prices[symbol] = {
                    price: responseData[symbol].quote.USD.price,
                    change_24h: responseData[symbol].quote.USD.percent_change_24h
                };
            }
        }

        res.json(prices);

    } catch (error) {
        console.error('Error fetching crypto prices:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch cryptocurrency prices.' });
    }
});

module.exports = router;
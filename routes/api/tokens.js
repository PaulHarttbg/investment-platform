const express = require('express');
const router = express.Router();
const Token = require('../../models/Token');
const { v4: uuidv4 } = require('uuid');

// Generate a new token
router.post('/', async (req, res) => {
    try {
        const { usageLimit, expiresInDays, notes } = req.body;
        
        // Generate a unique token
        const token = `TOKEN-${uuidv4().substr(0, 8).toUpperCase()}`;
        
        // Calculate expiration date if provided
        const expiresAt = expiresInDays ? 
            new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : 
            null;
        
        // Create token in database
        const newToken = await Token.create({
            token,
            usageLimit: parseInt(usageLimit) || 1,
            expiresAt: expiresAt,
            createdBy: req.user.id, // From auth middleware
            notes
        });
        
        res.status(201).json({
            success: true,
            data: newToken
        });
    } catch (error) {
        console.error('Error generating token:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate token',
            error: error.message
        });
    }
});

// Get all tokens
router.get('/', async (req, res) => {
    try {
        const tokens = await Token.findAll();
        res.json({
            success: true,
            data: tokens
        });
    } catch (error) {
        console.error('Error fetching tokens:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tokens',
            error: error.message
        });
    }
});

// Delete/Deactivate a token
router.delete('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const updatedToken = await Token.deactivate(token);
        
        if (!updatedToken) {
            return res.status(404).json({
                success: false,
                message: 'Token not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Token deactivated successfully',
            data: updatedToken
        });
    } catch (error) {
        console.error('Error deactivating token:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate token',
            error: error.message
        });
    }
});

module.exports = router;

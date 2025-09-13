const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { auth, isAdmin } = require('../../middleware/auth');

// PUT /api/admin/settings
router.put('/settings', auth, isAdmin, async (req, res) => {
    try {
        const settings = req.body.settings; // Expecting [{ key: '...', value: '...' }, ...]
        if (!Array.isArray(settings)) {
            return res.status(400).json({ error: 'Invalid settings format.' });
        }
        // Update each setting in the system_settings table
        for (const { key, value } of settings) {
            await db.query(
                'INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
                [key, value]
            );
        }
        res.json({ success: true, message: 'Settings updated.' });
    } catch (err) {
        console.error('Error updating settings:', err);
        res.status(500).json({ error: 'Failed to update settings.' });
    }
});

module.exports = router;

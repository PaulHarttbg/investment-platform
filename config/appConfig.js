const database = require('../database/schema');

class AppConfig {
    constructor() {
        this.settings = {};
        this.isLoaded = false;
    }

    async load() {
        if (this.isLoaded) {
            return;
        }
        try {
            console.log('Loading application configuration from database...');
            const dbSettings = await database.query('SELECT setting_key, setting_value FROM system_settings');
            
            for (const setting of dbSettings) {
                // Try to parse numbers and booleans
                let value = setting.setting_value;
                if (!isNaN(value) && value.trim() !== '') {
                    value = parseFloat(value);
                } else if (value === 'true' || value === '1') {
                    value = true;
                } else if (value === 'false' || value === '0') {
                    value = false;
                }
                this.settings[setting.setting_key] = value;
            }
            
            this.isLoaded = true;
            console.log('Configuration loaded successfully.');
        } catch (error) {
            console.error('FATAL: Could not load configuration from database. Using environment variables and defaults.', error);
            // The app might still run with process.env fallbacks, but this is a critical error.
        }
    }

    get(key, defaultValue = null) {
        // Priority: 1. DB setting, 2. process.env (uppercase key), 3. provided default
        const dbValue = this.settings[key];
        if (dbValue !== undefined) {
            return dbValue;
        }

        const envValue = process.env[key.toUpperCase()];
        if (envValue !== undefined) {
            return envValue;
        }

        return defaultValue;
    }
}

const config = new AppConfig();
module.exports = config;
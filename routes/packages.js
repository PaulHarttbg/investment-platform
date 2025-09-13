const express = require('express');
const InvestmentPackage = require('../models/InvestmentPackage');

const router = express.Router();

// Get all investment packages (public endpoint)
router.get('/', async (req, res) => {
    try {
        const packages = await InvestmentPackage.findAllActive();

        res.json({
            packages: packages
        });

    } catch (error) {
        console.error('Get packages error:', error);
        res.status(500).json({
            error: 'Failed to fetch packages',
            message: 'An error occurred while fetching investment packages'
        });
    }
});

// Get specific package details (public endpoint)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const investmentPackage = await InvestmentPackage.findById(id);

        if (!investmentPackage) {
            return res.status(404).json({
                error: 'Package not found'
            });
        }

        // Get package statistics
        const stats = await InvestmentPackage.getStatistics(id);

        res.json({
            package: investmentPackage,
            statistics: {
                totalInvestments: stats.total_investments || 0,
                totalInvested: stats.total_invested || 0,
                averageInvestment: stats.average_investment || 0
            }
        });

    } catch (error) {
        console.error('Get package details error:', error);
        res.status(500).json({
            error: 'Failed to fetch package details',
            message: 'An error occurred while fetching package details'
        });
    }
});

module.exports = router;

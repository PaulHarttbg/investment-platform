const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const emailService = require('../middleware/email');

router.post('/contact', [
    body('firstName').trim().notEmpty().withMessage('First name is required.'),
    body('lastName').trim().notEmpty().withMessage('Last name is required.'),
    body('email').isEmail().withMessage('A valid email is required.'),
    body('subject').notEmpty().withMessage('Subject is required.'),
    body('message').notEmpty().withMessage('Message is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array().map(e => e.msg) });
    }

    const { firstName, lastName, email, subject, message } = req.body;

    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'support@winningedgeinvestment.com';
        const emailSubject = `New Contact Form Submission: ${subject}`;
        const emailHtml = `
            <h2>New Message from WINNING EDGE Contact Form</h2>
            <p><strong>Name:</strong> ${firstName} ${lastName}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Subject:</strong> ${subject}</p>
            <hr>
            <h3>Message:</h3>
            <p>${message.replace(/\n/g, '<br>')}</p>
        `;

        const success = await emailService.sendEmail(adminEmail, emailSubject, emailHtml);

        if (success) {
            res.status(200).json({ message: 'Your message has been sent successfully!' });
        } else {
            throw new Error('Failed to send email via email service.');
        }
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ error: 'There was an error sending your message. Please try again later.' });
    }
});

module.exports = router;
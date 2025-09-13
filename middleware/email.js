const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    async initializeTransporter() {
        try {
            const port = parseInt(process.env.SMTP_PORT) || 587;
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: port,
                // `secure: true` is required for port 465 (SSL). For other ports (like 587 for TLS), it's false.
                secure: port === 465,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                },
                tls: {
                    // For production with valid certs, this should be true.
                    // Set to false for local development or if your provider has certificate issues.
                    // It's highly recommended to resolve certificate issues for production.
                    rejectUnauthorized: process.env.NODE_ENV === 'production'
                }
            });

            // Verify connection
            await this.transporter.verify();
            console.log('Email service initialized successfully');
        } catch (error) {
            console.error('Email service initialization failed:', error);
            this.transporter = null;
        }
    }

    async sendEmail(to, subject, htmlContent, textContent = null) {
        if (!this.transporter) {
            console.error('Email transporter not initialized');
            return false;
        }

        try {
            const mailOptions = {
                from: `"${process.env.SMTP_FROM_NAME || 'WINNING EDGE'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
                to: to,
                subject: subject,
                html: htmlContent,
                text: textContent || this.stripHtml(htmlContent)
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', result.messageId);
            return true;
        } catch (error) {
            console.error('Failed to send email:', error);
            return false;
        }
    }

    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    async renderTemplate(templateName, data) {
        const templatePath = path.join(__dirname, '..', 'views', 'emails', `${templateName}.ejs`);
        const templateData = {
            ...data,
            siteName: process.env.FROM_NAME || 'WINNING EDGE',
            siteUrl: process.env.CORS_ORIGIN || 'http://localhost:3001',
            supportEmail: process.env.FROM_EMAIL || 'support@winningedgeinvestment.com'
        };
        return ejs.renderFile(templatePath, templateData);
    }

    async sendWelcomeEmail(user, verificationToken) {
        const subject = `Welcome to WINNING EDGE - Please Verify Your Email`;
        const html = await this.renderTemplate('welcome', {
            firstName: user.first_name,
            loginId: user.login_id,
            verificationToken: verificationToken
        });
        return this.sendEmail(user.email, subject, html);
    }

    async sendPasswordResetEmail(user, resetToken) {
        const subject = 'Password Reset Request - WINNING EDGE';
        const html = await this.renderTemplate('passwordReset', {
            firstName: user.first_name,
            resetToken: resetToken
        });
        return this.sendEmail(user.email, subject, html);
    }

    async sendDepositConfirmation(user, transaction) {
        const subject = 'Deposit Confirmation - WINNING EDGE';
        const html = await this.renderTemplate('depositConfirmation', {
            firstName: user.first_name,
            amount: transaction.amount,
            paymentMethod: transaction.payment_method,
            transactionId: transaction.id,
            date: new Date(transaction.created_at).toLocaleDateString()
        });
        return this.sendEmail(user.email, subject, html);
    }

    async sendWithdrawalRequest(user, transaction) {
        const subject = 'Withdrawal Request Submitted - WINNING EDGE';
        const html = await this.renderTemplate('withdrawalRequest', {
            firstName: user.first_name,
            amount: transaction.amount,
            fee: transaction.fees || 0,
            netAmount: transaction.amount - (transaction.fees || 0),
            paymentMethod: transaction.payment_method,
            transactionId: transaction.id
        });
        return this.sendEmail(user.email, subject, html);
    }

    async sendInvestmentConfirmation(user, investment, packageInfo) {
        const maturityDate = new Date(investment.end_date).toLocaleDateString();
        const subject = 'Investment Confirmation - WINNING EDGE';
        const html = await this.renderTemplate('investmentCreated', {
            firstName: user.first_name,
            packageName: packageInfo.name,
            amount: investment.amount,
            expectedReturn: investment.expected_return,
            duration: packageInfo.duration_days,
            maturityDate: maturityDate,
            investmentId: investment.id
        });
        return this.sendEmail(user.email, subject, html);
    }

    async sendInvestmentCompletedEmail(user, investment, payoutAmount) {
        const subject = 'Your Investment Has Matured - WINNING EDGE';
        const html = await this.renderTemplate('investmentCompleted', {
            firstName: user.first_name,
            packageName: investment.package_name,
            investmentAmount: parseFloat(investment.amount).toFixed(2),
            profit: parseFloat(investment.expected_return).toFixed(2),
            payoutAmount: parseFloat(payoutAmount).toFixed(2),
            investmentId: investment.id
        });
        return this.sendEmail(user.email, subject, html);
    }

    async sendSecurityAlert(user, alertType, details = {}) {
        const subject = `Security Alert - ${alertType} - WINNING EDGE`;
        const html = await this.renderTemplate('securityAlert', {
            firstName: user.first_name,
            alertType: alertType,
            details: details,
            profileUrl: `${process.env.CORS_ORIGIN || 'http://localhost:3001'}/profile/security`
        });
        return this.sendEmail(user.email, subject, html);
    }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;

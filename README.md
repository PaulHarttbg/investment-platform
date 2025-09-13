# WINNING EDGE Investment Platform

A professional cryptocurrency investment platform built with Node.js, Express, and MySQL.

## 🚀 Features

- **User Management**: Secure registration and authentication system
- **Investment Packages**: Multiple investment options with different returns
- **Transaction Management**: Deposit, withdrawal, and investment tracking
- **Admin Dashboard**: Comprehensive admin panel for platform management
- **Security**: JWT authentication, rate limiting, and security headers
- **Responsive Design**: Modern UI that works on all devices

## 📋 Prerequisites

- Node.js 16.0.0 or higher
- npm 8.0.0 or higher
- Git

## 🛠️ Installation

### Quick Start (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/winning-edge/investment-platform.git
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp env.example .env
   # Edit .env with your settings
   ```

4. **Initialize the platform**
   ```bash
   # This will create the database and tables.
   npm run setup
   ```

5. **Start the server**
    ```bash
    # Starts in development mode with nodemon for auto-reloading
    npm run dev
    ```

6. **Access the platform**
   - Main platform: http://localhost:3000
   - Admin panel: http://localhost:3001/admin

### Production Deployment

Follow these steps on your production server (e.g., a Hostinger VPS) after connecting via SSH.

1. **Install dependencies**
    ```bash
    npm install --only=production
    ```

2. **Configure environment**
    ```bash
    cp .env.example .env
    # Edit .env with your production settings using a text editor like nano
    nano .env
    ```

3. **Set up initial database**
    ```bash
    # Run this ONLY ONCE for the initial production setup.
    npm run setup
    ```

5. **Start with PM2**
    ```bash
    npm run prod:start
    ```

### Investment Packages

Default packages are created automatically during setup.

## 📁 Project Structure

```
winning-edge/
├── admin/                 # Admin panel files
├── css/                   # Stylesheets
├── database/              # Database models and schema
├── images/                # Static images
├── js/                    # Frontend JavaScript
├── middleware/            # Express middleware
├── routes/                # API routes
├── scripts/               # Setup and utility scripts
├── logs/                  # Application logs
├── uploads/               # File uploads
├── server.js              # Main server file
├── package.json           # Dependencies
└── README.md             # This file
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Content Security Policy headers
- **HTTPS Enforcement**: HSTS headers in production
- **Password Hashing**: bcrypt with configurable rounds

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/admin/login` - Admin login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users/investments` - Get user investments
- `GET /api/users/transactions` - Get user transactions

### Investments
- `GET /api/packages` - Get investment packages
- `POST /api/investments` - Create a new investment
- `GET /api/investments` - Get active investments

### Transactions
- `POST /api/transactions/deposit` - Create deposit
- `POST /api/transactions/withdrawal` - Create withdrawal
- `GET /api/transactions` - Get transaction history

### Admin
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id/status` - Update user status
- `GET /api/admin/transactions` - Get all transactions
- `POST /api/admin/process-payouts` - Process monthly payouts

## 🚀 Deployment Options

### 1. PM2 (Recommended)
```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 2. Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

### 3. Systemd Service
```bash
sudo systemctl enable winning-edge
sudo systemctl start winning-edge
```

## 📈 Monitoring

### Logs
- Application logs: `./logs/app.log`
- Error logs: `./logs/err.log`
- Access logs: `./logs/access.log`

### Health Check
```bash
curl http://localhost:3001/api/health
```

### PM2 Monitoring
```bash
pm2 monit
pm2 logs winning-edge
```

## 🔧 Maintenance

### Update Platform
```bash
git pull origin main # Or your default branch
npm install --only=production
npm run prod:restart
```

### Reset Admin Password
```bash
node scripts/reset-admin-password.js
```

## 🐛 Troubleshooting

### Common Issues

1. **SSH Connection Prompt**: When connecting to your VPS for the first time, you will be asked to verify the host's authenticity.
    ```
    The authenticity of host '...' can't be established.
    Are you sure you want to continue connecting (yes/no)?
    ```
    You must type the full word `yes` and press Enter.

2. **Dealing with Pre-installed Web Servers (e.g., OpenLiteSpeed)**: Some VPS images (like Hostinger's) come with a web server like OpenLiteSpeed pre-installed. This will conflict with the recommended Nginx setup. It's best to remove it for a clean environment.
   - On your first login, you may be prompted to enter a domain. **Do not enter your domain here.** Press `CTRL+C` to cancel the prompt.
   - If you accidentally enter something, just answer `N` (No) to any follow-up questions (like issuing an SSL certificate).
   - Once you are at the main command prompt, stop and completely remove the pre-installed server by running these commands:
     ```bash
     sudo systemctl stop lsws
     sudo systemctl disable lsws
     sudo apt-get purge openlitespeed* -y
     sudo apt-get autoremove -y
     ```
   - After this, you can proceed with installing Nginx (`sudo apt install nginx`).

3. **Node.js/npm Installation Errors (`unmet dependencies`, `held broken packages`)**: This usually happens when using the default OS repositories. The best solution is to use NodeSource.
    ```bash
    # First, remove any old versions
    sudo apt-get purge --auto-remove nodejs npm
    # Then, follow the NodeSource installation steps in the "Prepare Your Server" section.
    ```

4. **Permission denied**:
   - Ensure your user has the correct permissions for the project directory.
   - On Linux: `sudo chown -R your_user:your_user .` (replace `your_user` with your username)
   - On Linux: `chmod 755 .` and `chmod 600 .env` for security.

5. **PM2 not found**:
   ```bash
   npm install -g pm2
   ```

### Debug Mode
```bash
NODE_ENV=development DEBUG=* npm start
```

## 📞 Support

- **Email**: support@winningedge.com
- **Documentation**: [Wiki](https://github.com/winning-edge/investment-platform/wiki)
- **Issues**: [GitHub Issues](https://github.com/winning-edge/investment-platform/issues)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## ⚠️ Security

If you discover a security vulnerability, please email security@winningedge.com instead of using the issue tracker.

---

**WINNING EDGE** - Your Money, Your Growth

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
- **Git Configuration**: Before your first commit, you must configure your name and email:
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "you@example.com"
  ```

## 🛠️ Installation

### Quick Start (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/PaulHarttbg/investment-platform.git
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
   - Admin panel: http://localhost:3000/admin

### Production Deployment

This guide provides a complete walkthrough for deploying the application to a Debian-based Linux VPS (like Ubuntu on Hostinger).

#### Step 1: Prepare Your Server

Connect to your server via SSH and install the necessary software.

```bash
# Update package lists and install dependencies
sudo apt update && sudo apt upgrade -y

# --- Install Node.js, Git, and Nginx ---
# The recommended way to install Node.js is using the NodeSource repository
# to avoid dependency conflicts found in default OS repositories.
# See: https://github.com/nodesource/distributions

# 1. Add the NodeSource repository for Node.js v20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 2. Install Node.js (which includes npm), Git, and Nginx
sudo apt-get install -y nodejs git nginx

# Install PM2, a process manager for Node.js
sudo npm install -g pm2
```

#### Step 2: Deploy Your Application Code

Clone your project from GitHub onto your server.

```bash
# Clone your personal repository
git clone https://github.com/PaulHarttbg/investment-platform.git

# Navigate into the project directory
cd investment-platform
```

#### Step 3: Configure the Production Environment

Create a `.env` file with your production secrets.

```bash
# Copy the example file
cp .env.example .env

# Open the file in a text editor to add your secrets
nano .env
```
Inside the editor, fill in all required values (database password, JWT secrets, etc.). Press `CTRL+X`, then `Y`, then `Enter` to save.

#### Step 4: Install Dependencies & Initialize Database

```bash
# Install only production dependencies
npm install --only=production

# Run the setup script ONCE to create tables and seed data
npm run setup
```

#### Step 5: Start the Application with PM2

```bash
# Start the application using the ecosystem config file
npm run prod:start

# Ensure the app restarts automatically on server reboot
pm2 startup
# (Follow the command PM2 gives you to complete)
pm2 save
```

#### Step 6: Configure Nginx and SSL

Set up Nginx to act as a reverse proxy, directing public traffic to your running application. This is also where you'll handle SSL.

1.  **Point your domain** (`winningedgeinvestment.com`) to your VPS's IP address (`5.183.9.6`) using an **`A` record** in your Hostinger DNS settings.
2.  **Create an Nginx configuration file:** `sudo nano /etc/nginx/sites-available/winningedge` and paste in a server block configuration.
3.  **Enable the site:** `sudo ln -s /etc/nginx/sites-available/winningedge /etc/nginx/sites-enabled/`
4.  **Install a free SSL certificate** with Certbot: `sudo apt install certbot python3-certbot-nginx -y` and then `sudo certbot --nginx -d winningedgeinvestment.com -d www.winningedgeinvestment.com`.

Your application is now live!

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
EXPOSE 3000
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
curl http://localhost:3000/api/health
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
   - On your first login, you may see a "Welcome to One-Click OpenLiteSpeed" message and be prompted to enter a domain. **Do not enter your domain here.** Press `CTRL+C` to cancel the prompt.
   - If you accidentally enter something, just answer `N` (No) to any follow-up questions (like issuing an SSL certificate).
   - Once you are at the main command prompt, stop and completely remove the pre-installed server by running these commands:
     ```bash
     sudo systemctl stop lsws
     sudo systemctl disable lsws
     sudo apt-get purge openlitespeed* -y
     sudo apt-get autoremove -y
     ```
   - After this, you can proceed with the "Prepare Your Server" steps to install the correct software stack (Node.js, Nginx, etc.).

3. **Node.js/npm Installation Errors (`unmet dependencies`, `held broken packages`)**: This usually happens when using the default OS repositories. The best solution is to use NodeSource.
   ```bash
   # First, remove any old versions
   sudo apt-get purge --auto-remove nodejs npm
   # Then, follow the NodeSource installation steps in the "Prepare Your Server" section.
   ```

4. **`fatal: destination path '...' already exists`**: This error happens if you try to `git clone` into a directory that already contains the project. You have likely already cloned it. Simply navigate into the existing directory with `cd investment-platform`.

5. **Permission denied**:
   - Ensure your user has the correct permissions for the project directory.
   - On Linux: `sudo chown -R your_user:your_user .` (replace `your_user` with your username)
   - On Linux: `chmod 755 .` and `chmod 600 .env` for security.

6. **PM2 not found**:
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

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

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

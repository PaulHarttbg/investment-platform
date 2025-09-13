@echo off
echo.
echo ========================================
echo  WINNING EDGE Investment Platform
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if package.json exists
if not exist package.json (
    echo ERROR: package.json not found
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env >nul 2>&1
    echo .env file created. Please edit it with your configuration.
    echo.
)

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
    echo.
)

REM Initialize database
echo Initializing database...
node -e "const db = require('./database/models'); console.log('Database initialized successfully!');"
if %errorlevel% neq 0 (
    echo ERROR: Failed to initialize database
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Starting WINNING EDGE Server...
echo ========================================
echo.
echo Server will be available at: http://localhost:3000
echo Admin panel: http://localhost:3000/admin
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the server
npm start

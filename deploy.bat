@echo off
REM Deployment script for Winning Edge

REM Install dependencies
call npm install

echo Restarting server with PM2...
call npm run prod:restart

echo Deployment complete.

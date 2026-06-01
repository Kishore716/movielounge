# 🎬 CineLuxe - Movie Lounge | Vercel Deployment Guide

## ✅ Vercel-Ready Configuration Complete

Your project has been configured for Vercel deployment with the following improvements:

### 🔧 Changes Made

1. **server.js** - Vercel-compatible Express app
   - ✅ Added CORS support for Vercel domains
   - ✅ Improved error handling and logging
   - ✅ Serverless-friendly database initialization
   - ✅ In-memory fallback when database is unavailable
   - ✅ Secure cookie configuration for production
   - ✅ Health check endpoint (`/api/health`)

2. **package.json** - Updated with Vercel scripts
   - ✅ Added proper Node.js version specification (18.x)
   - ✅ Added build and dev commands
   - ✅ All dependencies specified

3. **vercel.json** - Production configuration
   - ✅ Proper build and route configuration
   - ✅ Static file serving optimized
   - ✅ API routes properly routed to server.js

4. **.env.production** - Production environment template
   - ✅ Proper security settings
   - ✅ Database configuration guide
   - ✅ Documentation for all variables

---

## 🚀 Deployment Steps

### Step 1: Prepare Your Project for Git

```bash
cd "c:\Users\Kishore Kumar\Downloads\movie-lounge\movie-lounge"

# Initialize git (if not done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Vercel-ready Movie Lounge app"
```

### Step 2: Push to GitHub

```bash
# Create a new repository on GitHub (https://github.com/new)

# Add remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/movie-lounge.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel

#### Option A: Using Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repository
4. Click "Import"
5. Configure environment variables (see Step 4)
6. Click "Deploy"

#### Option B: Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Step 4: Configure Environment Variables on Vercel

After deployment (or during), go to:
**Project Settings → Environment Variables**

Add these variables:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | ✅ Yes |
| `JWT_SECRET` | Generate a strong random key | ✅ YES (⚠️ Change!) |
| `JWT_EXPIRES_IN` | `7d` | No |
| `DB_HOST` | Your database host | Optional* |
| `DB_USER` | Your database user | Optional* |
| `DB_PASSWORD` | Your database password | Optional* |
| `DB_NAME` | Your database name | Optional* |
| `DB_PORT` | `3306` | Optional* |

*If not provided, the app uses in-memory storage (data not persisted between deployments)

---

## 💾 Database Setup (For Persistent Storage)

### Option 1: **PlanetScale** (Recommended - MySQL compatible, Free Tier)

1. Sign up at https://planetscale.com
2. Create a database
3. Copy connection string
4. Extract `host`, `user`, `password` from connection string
5. Add to Vercel environment variables

### Option 2: **Supabase** (PostgreSQL)

1. Sign up at https://supabase.com
2. Create a new project
3. Copy database credentials
4. Update connection parameters

### Option 3: **AWS RDS**

1. Create RDS MySQL instance
2. Configure security groups
3. Get connection details
4. Add to Vercel environment variables

---

## 🔐 Generate Secure JWT Secret

Run this in terminal/PowerShell:

```powershell
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and use as `JWT_SECRET` environment variable.

---

## ✔️ Testing Deployment

After deployment, test these endpoints:

```bash
# Health check
curl https://YOUR_APP.vercel.app/api/health

# Frontend
https://YOUR_APP.vercel.app

# Check database status
curl https://YOUR_APP.vercel.app/api/health
```

---

## 🐛 Troubleshooting

### Issue: "Cannot find module 'mysql2'"
**Solution:** Reinstall dependencies
```bash
npm install
git add package-lock.json
git commit -m "Update dependencies"
git push
```

### Issue: Database connection failing
**Solution:** 
- Verify all DB environment variables are set correctly
- Check database credentials
- Ensure database is accessible from internet
- Use in-memory mode (don't set DB variables) for testing

### Issue: Cookies not persisting on HTTPS
**Solution:** Already fixed! Cookies configured with `secure: true` for production

### Issue: "Origin not allowed" errors
**Solution:** CORS is configured for Vercel domains automatically

---

## 📊 Project Structure (Vercel-Compatible)

```
movie-lounge/
├── server.js              # ← Main Express app (Vercel entry point)
├── app.js                 # ← Frontend logic
├── index.html             # ← Frontend UI
├── styles.css             # ← Styling
├── package.json           # ← Dependencies
├── package-lock.json      # ← Lock file
├── vercel.json            # ← Vercel config
├── .env.production        # ← Env template
├── .env.example           # ← Development template
└── .gitignore             # ← Git ignore rules
```

---

## 🎯 Key Features

✅ **Serverless-Ready** - Works with Vercel's serverless functions
✅ **CORS Enabled** - Works across domains
✅ **Secure Cookies** - HTTP-only, secure, production-ready
✅ **Error Handling** - Proper error responses
✅ **Database Fallback** - In-memory storage if DB unavailable
✅ **Static Files** - Optimized caching
✅ **Health Check** - `/api/health` endpoint

---

## 📞 Support

**Common Issues:**
- Always check Vercel Logs: Project → Deployments → Last deployment → Runtime Logs
- Ensure Node.js 18.x is selected (default on Vercel)
- Database connections must allow external access

**Next Steps:**
1. Deploy to Vercel
2. Test `/api/health` endpoint
3. Add custom domain (optional)
4. Monitor in Vercel dashboard

---

## 🔗 Useful Links

- Vercel Docs: https://vercel.com/docs
- Express on Vercel: https://vercel.com/docs/frameworks/express
- Environment Variables: https://vercel.com/docs/projects/environment-variables
- PlanetScale: https://planetscale.com/docs

---

**Happy Deploying! 🚀**

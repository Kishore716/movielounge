require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_cineluxe_change_this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const VERCEL_URL = process.env.VERCEL_URL || 'localhost:3000';

// CORS & Security Configuration for Vercel
const isProduction = ENVIRONMENT === 'production';
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  `https://${VERCEL_URL}`,
  'https://movie-lounge.vercel.app'
];

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || !isProduction) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.static(path.join(__dirname), {
  maxAge: '1d',
  etag: false
}));

// --- DATABASE CONFIGURATION ---
let dbType = 'mysql';
let pool = null;
let dbConnectionError = null;

// In-memory cache for development/fallback (NOT persistent)
const memoryDB = {
  users: [],
  watchlists: []
};

// Native Node.js Password Hashing using PBKDF2
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  const [salt, originalHash] = storedPassword.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

// Database Interface
const db = {
  async createUser(username, password) {
    const password_hash = hashPassword(password);
    if (dbType === 'mysql' && pool) {
      try {
        const [result] = await pool.query(
          'INSERT INTO users (username, password_hash) VALUES (?, ?)',
          [username, password_hash]
        );
        return { id: result.insertId, username };
      } catch (err) {
        console.error('MySQL error in createUser:', err.message);
        throw err;
      }
    } else {
      const newUser = {
        id: Math.max(0, ...memoryDB.users.map(u => u.id)) + 1,
        username,
        password_hash,
        created_at: new Date().toISOString()
      };
      memoryDB.users.push(newUser);
      return { id: newUser.id, username: newUser.username };
    }
  },

  async findUserByUsername(username) {
    if (dbType === 'mysql' && pool) {
      try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        return rows[0] || null;
      } catch (err) {
        console.error('MySQL error in findUserByUsername:', err.message);
        return null;
      }
    } else {
      return memoryDB.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
    }
  },

  async findUserById(id) {
    if (dbType === 'mysql' && pool) {
      try {
        const [rows] = await pool.query('SELECT id, username FROM users WHERE id = ?', [id]);
        return rows[0] || null;
      } catch (err) {
        console.error('MySQL error in findUserById:', err.message);
        return null;
      }
    } else {
      const user = memoryDB.users.find(u => u.id === id);
      return user ? { id: user.id, username: user.username } : null;
    }
  },

  async getWatchlist(userId) {
    if (dbType === 'mysql' && pool) {
      try {
        const [rows] = await pool.query(
          'SELECT imdb_id as imdbID, title as Title, year as Year, type as Type, poster as Poster FROM watchlists WHERE user_id = ? ORDER BY created_at DESC',
          [userId]
        );
        return rows;
      } catch (err) {
        console.error('MySQL error in getWatchlist:', err.message);
        return [];
      }
    } else {
      return memoryDB.watchlists
        .filter(w => w.user_id === userId)
        .map(w => ({
          imdbID: w.imdb_id,
          Title: w.title,
          Year: w.year,
          Type: w.type,
          Poster: w.poster
        }));
    }
  },

  async addWatchlist(userId, movie) {
    if (dbType === 'mysql' && pool) {
      try {
        await pool.query(
          'INSERT INTO watchlists (user_id, imdb_id, title, year, type, poster) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, movie.imdbID, movie.Title, movie.Year, movie.Type, movie.Poster]
        );
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') {
          console.error('MySQL error in addWatchlist:', err.message);
          throw err;
        }
      }
    } else {
      const exists = memoryDB.watchlists.some(w => w.user_id === userId && w.imdb_id === movie.imdbID);
      if (!exists) {
        memoryDB.watchlists.push({
          id: Math.max(0, ...memoryDB.watchlists.map(w => w.id || 0)) + 1,
          user_id: userId,
          imdb_id: movie.imdbID,
          title: movie.Title,
          year: movie.Year,
          type: movie.Type,
          poster: movie.Poster,
          created_at: new Date().toISOString()
        });
      }
    }
  },

  async removeWatchlist(userId, imdbID) {
    if (dbType === 'mysql' && pool) {
      try {
        await pool.query(
          'DELETE FROM watchlists WHERE user_id = ? AND imdb_id = ?',
          [userId, imdbID]
        );
      } catch (err) {
        console.error('MySQL error in removeWatchlist:', err.message);
        throw err;
      }
    } else {
      const index = memoryDB.watchlists.findIndex(w => w.user_id === userId && w.imdb_id === imdbID);
      if (index > -1) {
        memoryDB.watchlists.splice(index, 1);
      }
    }
  }
};

// Initialize DB (attempt MySQL, fallback to memory)
async function initializeDB() {
  const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME
  };

  // Skip MySQL if not configured
  if (!config.host || !config.user || !process.env.DB_NAME) {
    console.log('\n[Database] MySQL not configured. Using in-memory storage (limited to current session).');
    console.log('[Database] To use persistent storage, set: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME\n');
    dbType = 'memory';
    return;
  }

  console.log('[Database] Attempting to connect to MySQL...');
  try {
    // Test connection
    const connection = await mysql.createConnection(config);
    const dbName = config.database;
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();

    // Create connection pool
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableTimeoutCheck: true,
      enableKeepAlive: true,
      keepAliveInitialDelayMs: 0
    });

    // Run migrations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS watchlists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        imdb_id VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        year VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL,
        poster TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY user_movie (user_id, imdb_id)
      )
    `);

    dbType = 'mysql';
    console.log(`[Database] MySQL connected successfully!\n`);
  } catch (err) {
    dbConnectionError = err.message;
    console.warn('\n[Database] MySQL connection failed. Using in-memory storage.');
    console.warn(`Reason: ${err.message}\n`);
    dbType = 'memory';
  }
}

// --- AUTH MIDDLEWARE ---

async function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.findUserById(decoded.id);
    req.user = user;
    next();
  } catch (err) {
    res.clearCookie('token');
    req.user = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }
  next();
}

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: ENVIRONMENT,
    dbType,
    dbConnected: dbType === 'mysql',
    timestamp: new Date().toISOString()
  });
});

// --- API ROUTING ENDPOINTS ---

// Auth Check & Current User info
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({
    user: req.user,
    storageMode: dbType,
    isServerMode: true
  });
});

// User registration
app.post('/api/auth/signup', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password || username.trim().length < 3 || password.length < 5) {
    return res.status(400).json({ error: 'Username must be >= 3 chars. Password must be >= 5 chars.' });
  }

  try {
    const existingUser = await db.findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    const user = await db.createUser(username, password);
    
    // Generate Token
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    
    // Set secure HTTP-only Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    res.status(201).json({ user, storageMode: dbType });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed due to internal error.' });
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await db.findUserByUsername(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate Token
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      user: { id: user.id, username: user.username },
      storageMode: dbType
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed due to internal error.' });
  }
});

// User logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'Logged out successfully.' });
});

// Get User Watchlist
app.get('/api/watchlist', authenticateToken, requireAuth, async (req, res) => {
  try {
    const list = await db.getWatchlist(req.user.id);
    res.json(list);
  } catch (err) {
    console.error('Get watchlist error:', err);
    res.status(500).json({ error: 'Failed to retrieve watchlist.' });
  }
});

// Add to Watchlist
app.post('/api/watchlist', authenticateToken, requireAuth, async (req, res) => {
  const { imdbID, Title, Year, Type, Poster } = req.body;

  if (!imdbID || !Title) {
    return res.status(400).json({ error: 'Missing movie details.' });
  }

  try {
    await db.addWatchlist(req.user.id, { imdbID, Title, Year, Type, Poster });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Add to watchlist error:', err);
    res.status(500).json({ error: 'Failed to add to watchlist.' });
  }
});

// Remove from Watchlist
app.delete('/api/watchlist/:imdbID', authenticateToken, requireAuth, async (req, res) => {
  const { imdbID } = req.params;

  try {
    await db.removeWatchlist(req.user.id, imdbID);
    res.json({ success: true });
  } catch (err) {
    console.error('Remove from watchlist error:', err);
    res.status(500).json({ error: 'Failed to remove from watchlist.' });
  }
});

// --- STREAMING PROXY ENDPOINTS ---

function buildEmbedUrls(pathname, params) {
  const providers = ['https://vidsrcme.ru', 'https://vidsrc-embed.ru'];
  const query = params.toString();
  return providers.map((host) => `${host}${pathname}?${query}`);
}

app.get('/api/stream/movie', (req, res) => {
  const { imdb, tmdb, ds_lang, sub_url, autoplay } = req.query;
  if (!imdb && !tmdb) {
    return res.status(400).json({ error: 'Either imdb or tmdb parameter is required.' });
  }
  const params = new URLSearchParams();
  if (imdb) params.append('imdb', imdb);
  if (tmdb) params.append('tmdb', tmdb);
  if (ds_lang) params.append('ds_lang', ds_lang);
  if (sub_url) params.append('sub_url', sub_url);
  if (autoplay) params.append('autoplay', autoplay);
  const urls = buildEmbedUrls('/embed/movie', params);
  res.json({ embedUrl: urls[0], fallbackEmbedUrls: urls.slice(1) });
});

app.get('/api/stream/tv', (req, res) => {
  const { imdb, tmdb, ds_lang, sub_url, autoplay } = req.query;
  if (!imdb && !tmdb) {
    return res.status(400).json({ error: 'Either imdb or tmdb parameter is required.' });
  }
  const params = new URLSearchParams();
  if (imdb) params.append('imdb', imdb);
  if (tmdb) params.append('tmdb', tmdb);
  if (ds_lang) params.append('ds_lang', ds_lang);
  if (sub_url) params.append('sub_url', sub_url);
  if (autoplay) params.append('autoplay', autoplay);
  const urls = buildEmbedUrls('/embed/tv', params);
  res.json({ embedUrl: urls[0], fallbackEmbedUrls: urls.slice(1) });
});

app.get('/api/stream/episode', (req, res) => {
  const { imdb, tmdb, season, episode, ds_lang, sub_url, autoplay } = req.query;
  if (!imdb && !tmdb) {
    return res.status(400).json({ error: 'Either imdb or tmdb parameter is required.' });
  }
  if (!season || !episode) {
    return res.status(400).json({ error: 'Both season and episode parameters are required for episode embeds.' });
  }
  const params = new URLSearchParams();
  if (imdb) params.append('imdb', imdb);
  if (tmdb) params.append('tmdb', tmdb);
  params.append('season', season);
  params.append('episode', episode);
  if (ds_lang) params.append('ds_lang', ds_lang);
  if (sub_url) params.append('sub_url', sub_url);
  if (autoplay) params.append('autoplay', autoplay);
  const urls = buildEmbedUrls('/embed/tv', params);
  res.json({ embedUrl: urls[0], fallbackEmbedUrls: urls.slice(1) });
});

// --- PROXY HELPER ---
function proxyJsonRequest(url, res) {
  try {
    https.get(url, (proxied) => {
      let body = '';
      proxied.on('data', (chunk) => body += chunk);
      proxied.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          res.json(parsed);
        } catch (err) {
          console.error('[Proxy] Failed to parse JSON from', url, err.message);
          res.status(502).json({ error: 'Invalid response from upstream' });
        }
      });
    }).on('error', (err) => {
      console.error('[Proxy] Request error for', url, err.message);
      res.status(502).json({ error: 'Upstream request failed' });
    });
  } catch (err) {
    console.error('[Proxy] Unexpected proxy error', err.message);
    res.status(500).json({ error: 'Internal proxy error' });
  }
}

app.get('/api/stream/latest-movies', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const url = `https://vsembed.ru/movies/latest/page-${page}.json`;
  proxyJsonRequest(url, res);
});

app.get('/api/stream/latest-tv', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const url = `https://vsembed.ru/tvshows/latest/page-${page}.json`;
  proxyJsonRequest(url, res);
});

app.get('/api/stream/latest-episodes', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const url = `https://vsembed.ru/episodes/latest/page-${page}.json`;
  proxyJsonRequest(url, res);
});

// --- FALLBACK ROUTE FOR SPA ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ERROR HANDLING ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: isProduction ? undefined : err.message
  });
});

// --- SERVER STARTUP ---
const startServer = async () => {
  await initializeDB();
  
  // For local development
  if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
      console.log(`\n╔════════════════════════════════════════════╗`);
      console.log(`║  CineLuxe - Movie Lounge Portal            ║`);
      console.log(`║  🎬 Server running on port ${PORT}            ║`);
      console.log(`║  📍 URL: http://localhost:${PORT}             ║`);
      console.log(`║  🗄️  Database: ${dbType === 'mysql' ? 'MySQL' : 'In-Memory'} mode        ║`);
      console.log(`╚════════════════════════════════════════════╝\n`);
    });
  }
};

// For Vercel serverless function
if (process.env.VERCEL) {
  module.exports = app;
  initializeDB().catch(err => console.error('DB Init Error:', err));
} else {
  // Local development
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

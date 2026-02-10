import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cookieParser());
app.use(express.json());

// Serve static files from current directory
app.use(express.static(__dirname));

// ====== ROUTES UTAMA ======
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// ====== 1) Redirect ke Discord OAuth ======
app.get("/auth/discord", (req, res) => {
  const state = makeState();

  console.log("=== DISCORD OAUTH START ===");
  console.log("Generated state:", state);
  console.log("Client ID:", process.env.DISCORD_CLIENT_ID);
  console.log("Redirect URI:", process.env.DISCORD_REDIRECT_URI);

  // Set state cookie
  res.cookie("oauth_state", state, {
    httpOnly: false,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 5 * 60 * 1000,
  });

  // Buat Discord OAuth URL
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify email",
    state: state,
    prompt: "consent",
  });

  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

  console.log("Redirecting to Discord:", discordAuthUrl);
  console.log("=== DISCORD OAUTH END ===\n");

  // Redirect ke Discord
  res.redirect(discordAuthUrl);
});

// ====== 2) Callback dari Discord ======
app.get("/auth/discord/callback", async (req, res) => {
  console.log("\n=== DISCORD CALLBACK START ===");
  console.log("Full URL:", req.originalUrl);
  console.log("Query params:", req.query);
  console.log("Cookies:", req.cookies);

  const { code, state } = req.query;
  const savedState = req.cookies.oauth_state;

  // Validasi state
  if (!state || !savedState || state !== savedState) {
    console.log("ERROR: State mismatch or missing");
    console.log("State from Discord:", state);
    console.log("Saved state:", savedState);

    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Error - YURI BOT</title>
        <style>
          body {
            background: #000;
            color: #fff;
            font-family: 'Roboto', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .container {
            background: rgba(15, 10, 45, 0.9);
            padding: 40px;
            border-radius: 20px;
            border: 2px solid rgba(255, 107, 107, 0.5);
            max-width: 500px;
          }
          .error-icon {
            font-size: 80px;
            margin-bottom: 20px;
            color: #ff6b6b;
          }
          h1 {
            color: #ff6b6b;
            margin-bottom: 20px;
          }
          a {
            color: #a78bfa;
            text-decoration: none;
            font-weight: bold;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">⚠️</div>
          <h1>Authentication Error</h1>
          <p>State mismatch or session expired.</p>
          <p><a href="/login">Please login again</a></p>
          <script>
            setTimeout(() => window.location.href = "/login", 3000);
          </script>
        </div>
      </body>
      </html>
    `);
  }

  // Hapus state cookie
  res.clearCookie("oauth_state", { path: "/" });

  try {
    // 1. Tukar code dengan access token
    console.log("Exchanging code for token...");
    console.log("Using Client ID:", process.env.DISCORD_CLIENT_ID);
    console.log("Using Client Secret:", process.env.DISCORD_CLIENT_SECRET ? "***SECRET_HIDDEN***" : "NOT SET");
    console.log("Redirect URI:", process.env.DISCORD_REDIRECT_URI);

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
    });

    console.log("Token response status:", tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.log("Token exchange failed:", errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log("Token received successfully");
    const accessToken = tokenData.access_token;

    // 2. Ambil user info dari Discord
    console.log("Fetching user info from Discord...");
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.log("User fetch failed:", errorText);
      throw new Error(`User fetch failed: ${userResponse.status}`);
    }

    const discordUser = await userResponse.json();
    console.log("User fetched:", discordUser.username);

    // 3. Buat session untuk user
    const sessionId = base64url(crypto.randomBytes(32));
    const userData = {
      id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      avatar: discordUser.avatar,
      email: discordUser.email,
      discordToken: accessToken,
      loggedInAt: Date.now(),
    };

    // Session storage (temporary)
    const sessions = new Map();
    sessions.set(sessionId, userData);

    // 4. Set session cookie
    res.cookie("yuri_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
    });

    // 5. Kirim HTML dengan data user untuk disimpan di localStorage
    const redirectUrl = req.query.redirect || "/";

    console.log("Login successful, redirecting to:", redirectUrl);
    console.log("=== DISCORD CALLBACK SUCCESS ===\n");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Login Success - YURI BOT</title>
        <style>
          body {
            background: #000;
            color: #fff;
            font-family: 'Roboto', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .container {
            background: rgba(15, 10, 45, 0.9);
            padding: 40px;
            border-radius: 20px;
            border: 2px solid rgba(168, 85, 247, 0.5);
            max-width: 500px;
          }
          .success-icon {
            font-size: 80px;
            margin-bottom: 20px;
            background: linear-gradient(90deg, #a78bfa, #c084fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          h1 {
            color: #a78bfa;
            margin-bottom: 20px;
          }
          .loader {
            width: 50px;
            height: 50px;
            border: 5px solid rgba(168, 85, 247, 0.3);
            border-top: 5px solid #a78bfa;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✓</div>
          <h1>Login Successful!</h1>
          <p>Welcome, <strong>${discordUser.username}</strong>!</p>
          <p>Redirecting you to YURI BOT...</p>
          <div class="loader"></div>
        </div>
        <script>
          // Simpan data user ke localStorage
          const userData = ${JSON.stringify(userData)};
          localStorage.setItem('userLoggedIn', 'true');
          localStorage.setItem('userData', JSON.stringify(userData));
          localStorage.setItem('loginTime', Date.now().toString());
          
          console.log('User data saved to localStorage');
          
          // Redirect setelah 1 detik
          setTimeout(() => {
            window.location.href = "${redirectUrl}";
          }, 1000);
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error("OAuth Error:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Login Error - YURI BOT</title>
        <style>
          body {
            background: #000;
            color: #fff;
            font-family: 'Roboto', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .container {
            background: rgba(15, 10, 45, 0.9);
            padding: 40px;
            border-radius: 20px;
            border: 2px solid rgba(255, 107, 107, 0.5);
            max-width: 500px;
          }
          .error-icon {
            font-size: 80px;
            margin-bottom: 20px;
            color: #ff6b6b;
          }
          h1 {
            color: #ff6b6b;
            margin-bottom: 20px;
          }
          a {
            color: #a78bfa;
            text-decoration: none;
            font-weight: bold;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">❌</div>
          <h1>Login Error</h1>
          <p>${error.message}</p>
          <p><a href="/login">Try again</a></p>
        </div>
      </body>
      </html>
    `);
  }
});

// ====== 3) Endpoint untuk cek login status ======
app.get("/api/auth/check", (req, res) => {
  // Simulasi session storage
  const sessions = new Map();
  const sessionId = req.cookies.yuri_session;

  if (!sessionId || !sessions.has(sessionId)) {
    return res.json({ loggedIn: false });
  }

  const userData = sessions.get(sessionId);
  const { discordToken, ...safeUserData } = userData;

  res.json({ loggedIn: true, user: safeUserData });
});

// ====== 4) Endpoint untuk logout ======
app.post("/api/auth/logout", (req, res) => {
  // Simulasi session storage
  const sessions = new Map();
  const sessionId = req.cookies.yuri_session;

  if (sessionId) {
    sessions.delete(sessionId);
  }

  res.clearCookie("yuri_session", { path: "/" });
  res.json({ success: true });
});

// ====== HELPER FUNCTIONS ======
function base64url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeState() {
  return base64url(crypto.randomBytes(24));
}

// ====== ERROR HANDLING ======
app.use((req, res, next) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>404 - Page Not Found</title>
      <style>
        body {
          background: #000;
          color: #fff;
          font-family: 'Roboto', sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          text-align: center;
        }
        .container {
          background: rgba(15, 10, 45, 0.9);
          padding: 40px;
          border-radius: 20px;
          border: 2px solid rgba(168, 85, 247, 0.5);
          max-width: 500px;
        }
        h1 {
          color: #a78bfa;
          margin-bottom: 20px;
        }
        a {
          color: #a78bfa;
          text-decoration: none;
          font-weight: bold;
        }
        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404 - Page Not Found</h1>
        <p>The page you are looking for does not exist.</p>
        <p><a href="/">Go to Home</a></p>
      </div>
    </body>
    </html>
  `);
});

app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>500 - Internal Server Error</title>
      <style>
        body {
          background: #000;
          color: #fff;
          font-family: 'Roboto', sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          text-align: center;
        }
        .container {
          background: rgba(15, 10, 45, 0.9);
          padding: 40px;
          border-radius: 20px;
          border: 2px solid rgba(255, 107, 107, 0.5);
          max-width: 500px;
        }
        h1 {
          color: #ff6b6b;
          margin-bottom: 20px;
        }
        a {
          color: #a78bfa;
          text-decoration: none;
          font-weight: bold;
        }
        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>500 - Internal Server Error</h1>
        <p>Something went wrong on our server.</p>
        <p><a href="/">Go to Home</a></p>
      </div>
    </body>
    </html>
  `);
});

// ====== START SERVER ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔗 Home: http://localhost:${PORT}/`);
  console.log(`🔗 Login: http://localhost:${PORT}/login`);
  console.log(`🔗 Discord OAuth: http://localhost:${PORT}/auth/discord`);
  console.log(`🔗 Callback: http://localhost:${PORT}/auth/discord/callback`);
  console.log(`📁 Serving files from: ${__dirname}`);
  console.log(`🔐 Client ID: ${process.env.DISCORD_CLIENT_ID}`);
  console.log(`🔑 Client Secret: ${process.env.DISCORD_CLIENT_SECRET ? "***SET***" : "NOT SET"}`);
  console.log(`↪️ Redirect URI: ${process.env.DISCORD_REDIRECT_URI}`);
});
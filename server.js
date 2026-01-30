const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURATION ---
const db = new sqlite3.Database("./monitor.db");

// Liste de tes sites avec leurs Noms et Descriptions
const SITES = [
  {
    id: "portfolio",
    name: "Portfolio",
    url: "https://calliste-portfolio.dynv6.net",
    description: "Site personnel & CV (VPS/Docker)",
  },
  {
    id: "gdpatisserie",
    name: "GD Pâtisserie (Demo)",
    url: "https://gd-patisserie.dynv6.net",
    description: "E-commerce Next.js & Prisma",
  },
];

// --- INIT DB ---
db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS pings (id INTEGER PRIMARY KEY, url TEXT, status INTEGER, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)",
  );
});

// --- WORKER (Ping toutes les minutes) ---
setInterval(async () => {
  const now = new Date().toISOString();
  for (const site of SITES) {
    try {
      const start = Date.now();
      await axios.get(site.url, { timeout: 5000 });
      const duration = Date.now() - start;
      db.run(`INSERT INTO pings (url, status, timestamp) VALUES (?, ?, ?)`, [
        site.url,
        duration,
        now,
      ]);
    } catch (error) {
      db.run(`INSERT INTO pings (url, status, timestamp) VALUES (?, ?, ?)`, [site.url, -1, now]);
    }
  }
}, 60 * 1000);

// --- API ---
app.use(express.static("public"));

app.get("/api/status", (req, res) => {
  // On récupère tout l'historique récent
  db.all(
    "SELECT * FROM pings WHERE timestamp > datetime('now', '-24 hours') ORDER BY timestamp ASC",
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      // On construit la réponse structurée pour le frontend
      const response = SITES.map((site) => {
        // Filtrer les pings pour ce site spécifique
        const history = rows.filter((row) => row.url === site.url);

        // Déterminer l'état actuel (basé sur le dernier ping)
        const lastPing = history.at(-1);
        const isUp = lastPing ? lastPing.status !== -1 : true;
        const latency = lastPing ? lastPing.status : 0;

        // Calculer la disponibilité (uptime) sur 24h
        const total = history.length;
        const success = history.filter((h) => h.status !== -1).length;
        const uptime = total === 0 ? 100 : Math.round((success / total) * 100);

        return {
          ...site, // Ajoute name, url, description
          isUp,
          latency,
          uptime,
          history: history.slice(-60), // Garder seulement les 60 derniers points pour le graph (1h)
        };
      });

      res.json(response);
    },
  );
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});

import Database from "./core/database";
import { REPL } from "./repl/repl";
import express from "express";
import { setRoutes } from "./web-demo/routes/api";

const app = express();
const PORT = process.env.PORT || 3000;

// Use default database for REPL
const db = new Database("default");

const startREPL = () => {
  const repl = new REPL(db);
  repl.start();
};

const startServer = () => {
  app.use(express.json());

  // Set up API routes
  setRoutes(app);

  app.listen(PORT, () => {
    console.log(`✓ Server is running on http://localhost:${PORT}`);
    console.log(`✓ Open http://localhost:${PORT} in your browser`);
  });
};

// Check for command line arguments to decide whether to start REPL or server
if (process.argv.includes("--repl") || process.argv.includes("repl")) {
  startREPL();
} else if (process.argv.includes("--web") || process.argv.includes("web")) {
  startServer();
} else {
  console.log("Usage:");
  console.log("  npm start repl  - Start REPL mode");
  console.log("  npm start web   - Start web server");
  process.exit(1);
}

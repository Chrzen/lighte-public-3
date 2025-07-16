console.log("--- BOT STARTING UP ---");

// Import required packages
const express = require("express");

// This agent's adapter
const adapter = require("./adapter");
console.log("Adapter loaded.");

// This agent's main dialog.
const app = require("./app/app");
console.log("Application logic loaded.");

const path = require("path");
const send = require("send");

// Create express application.
const expressApp = express();
expressApp.use(express.json());
console.log("Express app created.");

const server = expressApp.listen(process.env.port || process.env.PORT || 3978, () => {
  // This block runs once the server is successfully listening
  console.log(`\n✅ Agent started successfully.`);
  console.log(`   - Express server is listening at ${JSON.stringify(server.address())}`);
  console.log(`   - To debug, connect to the node process.`);
});

// Listen for incoming requests.
expressApp.post("/api/messages", async (req, res) => {
  // Route received a request to adapter for processing
  await adapter.process(req, res, async (context) => {
    // Dispatch to application for routing
    await app.run(context);
  });
});

expressApp.get(["/auth-start.html", "/auth-end.html"], async (req, res) => {
  send(
    req,
    path.join(
      __dirname,
      "public",
      req.url.includes("auth-start.html") ? "auth-start.html" : "auth-end.html"
    )
  ).pipe(res);
});

console.log("--- SERVER INITIALIZATION COMPLETE ---");
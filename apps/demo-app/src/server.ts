import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 4000);

const server = createApp().listen(PORT, () => {
  console.log(`[demo-app] Pharma LIMS running at http://localhost:${PORT}`);
});

function shutdown(): void {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
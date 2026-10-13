import mongoose from "mongoose";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDb } from "./db.js";

await connectDb();
const server = createApp().listen(config.PORT, () => {
  console.log(`Ledgerly API on http://localhost:${config.PORT}/graphql`);
});

// Graceful shutdown: finish in-flight requests, then close the DB connection.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      void mongoose.disconnect().then(() => process.exit(0));
    });
  });
}

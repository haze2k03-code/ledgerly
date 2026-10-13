import mongoose from "mongoose";
import { config } from "./config.js";

export async function connectDb(): Promise<void> {
  // Throw on query filters with fields that aren't in the schema, instead of silently ignoring them.
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.MONGODB_URI);
  console.log("Connected to MongoDB");
}

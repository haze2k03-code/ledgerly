import cookieParser from "cookie-parser";
import express, { type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { createSchema, createYoga } from "graphql-yoga";
import helmet from "helmet";
import mongoose from "mongoose";
import { getUserFromRequest, type AuthUser } from "./auth.js";
import { config } from "./config.js";
import { resolvers, type Context } from "./graphql/resolvers.js";
import { typeDefs } from "./graphql/typeDefs.js";

export function createApp(): express.Express {
  const app = express();

  // The frontend's web server (Vite in dev, nginx in Docker) forwards requests to us.
  // Trust one proxy hop so req.ip is the real client IP for rate limiting.
  app.set("trust proxy", 1);

  // Security headers. The content security policy is relaxed in development only,
  // so the GraphiQL playground at /graphql can load its scripts.
  app.use(helmet({ contentSecurityPolicy: config.NODE_ENV === "production" ? undefined : false }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? "ok" : "db-unavailable" });
  });

  // A general cap on API traffic per IP. Login has its own stricter limiter in the resolvers.
  app.use(
    "/graphql",
    rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }),
  );

  const yoga = createYoga<{ req: Request; res: Response }, { user: AuthUser | null }>({
    schema: createSchema<Context>({ typeDefs, resolvers }),
    // Runs once per request: works out who is calling, so every resolver can check ctx.user.
    context: async ({ req }) => ({ user: await getUserFromRequest(req) }),
    graphqlEndpoint: "/graphql",
    graphiql: config.NODE_ENV !== "production",
    landingPage: false,
    // Unexpected errors (bugs, DB failures) reach the client as a generic message.
    // Only the GraphQLErrors we throw on purpose show their real message.
    maskedErrors: true,
  });
  app.use(yoga.graphqlEndpoint, yoga);

  return app;
}

# Ledgerly: Interview Prep Guide

Read this after you have Ledgerly running. Open each file mentioned and find the code being described.

---

## 1. Your 30-second pitch

> "Ledgerly is a personal finance tracker. Users log expenses and income with a category and payment method, and the dashboard shows where their money went: spending by category, daily spending, a six-month trend, budget progress, and automatic insights like 'Shopping is up 80% from last month'.
>
> It's MERN with a GraphQL API instead of REST. The frontend is React with Recharts, the API is Express with GraphQL Yoga, and all the totals are computed inside MongoDB with aggregation pipelines. Money is stored as integer paise to avoid floating-point errors, and every query is scoped to the logged-in user, who's authenticated with a JWT in an httpOnly cookie."

---

## 2. Fix this on your resume first

Your resume says *"storing passwords using encryption"*. **That's the wrong word, and interviewers notice.** Passwords are **hashed**, not encrypted:

- **Encryption** is two-way: with the key you can decrypt and get the original back.
- **Hashing** is one-way: you can't get the password back, only check whether a login attempt produces the same hash.

Change the line to: *"storing passwords as salted bcrypt hashes"*. If asked why bcrypt and not SHA-256: bcrypt is deliberately slow and has a built-in salt, so brute-forcing leaked hashes is expensive and identical passwords produce different hashes.

---

## 3. GraphQL: concepts you must explain

**What is GraphQL?**
A query language for APIs. Instead of many REST endpoints, there's one endpoint (`/graphql`) and a typed schema. The client sends a query describing exactly the fields it wants, and the response has exactly that shape.

**Why GraphQL here instead of REST?**
The dashboard needs four things: month summary, 6-month trend, budgets and insights. With REST that's four requests, or one custom endpoint that's awkward to reuse. With GraphQL it's one query (`DASHBOARD` in `web/src/lib/queries.ts`) and one round trip. Also no over-fetching: the transactions table asks only for the fields it shows.

**Query vs mutation?**
Queries read data, mutations change it. Mine: `transactions`, `monthSummary`, `trend`, `budgets`, `insights` are queries; `addTransaction`, `setBudget`, `login` and so on are mutations.

**What is a resolver?**
A function that produces the value for one field in the schema. `Query.monthSummary` in `resolvers.ts` validates the month, runs the aggregation, converts paise to rupees and returns the result.

**What is the context?**
An object created once per request and passed to every resolver. Mine contains the logged-in user (read from the cookie in `app.ts`) plus Express's `req` and `res`. That's how resolvers know who's asking, and how `login` sets a cookie.

**How do errors work in GraphQL?**
GraphQL usually returns HTTP 200 even on errors, with an `errors` array in the body. I throw `GraphQLError` with a code (`UNAUTHENTICATED`, `BAD_USER_INPUT`, `NOT_FOUND`). Unexpected errors are masked as a generic message so stack traces and DB details never reach the client. The frontend reads the code: `UNAUTHENTICATED` sends the user back to login.

**What is the N+1 problem?**
If a list of 50 transactions each had a nested `user` field resolved with its own database query, that's 1 + 50 queries. The fix is DataLoader, which batches them into one query. My schema has no nested relations, so it doesn't apply yet. Saying you know this is a strong signal.

**GraphQL-specific security risks?**
Clients can write deeply nested or very expensive queries. Defences: query depth and cost limits, pagination limits, disabling introspection in production. My schema has no recursive types, and I cap `limit` at 100 and `offset` at 10,000. GraphiQL (the playground) is disabled in production.

---

## 4. MongoDB: what to explain

**Schema design.** Three collections: `users`, `transactions`, `budgets`. Each transaction stores a `user` reference (ObjectId). I didn't embed transactions inside the user document because a user can have thousands, and MongoDB documents are capped at 16 MB. Embedding suits small, bounded lists.

**Indexes.** `transactions` has compound indexes `{ user: 1, date: -1 }` and `{ user: 1, category: 1, date: -1 }`. Every query filters by user first, then by date range, so these let MongoDB jump straight to one user's rows for a month instead of scanning the whole collection. `budgets` has a **unique** index on `{ user, month, category }`, so the database itself prevents duplicate budgets.

**Aggregation pipelines** (`services/analytics.ts`). A pipeline is a sequence of stages:
- `$match`: filter to this user and this month
- `$group`: sum amounts by type, by category, by day
- `$sort`: biggest category first
- `$facet`: run several groupings over the same matched documents in one query

Computing in the database is faster and sends far less data over the network than loading every transaction into Node and looping.

**NoSQL injection.** In a REST API, someone could send `{"email": {"$ne": null}}` to match any user. Here GraphQL's type system rejects that before any resolver runs: `email` is declared `String!`, so an object is invalid. Search text is regex-escaped too, so a search can't become an expensive regular expression.

---

## 5. Design decisions interviewers like to probe

**Why store money as integer paise?**
Floats can't represent most decimals exactly (`0.1 + 0.2 = 0.30000000000000004`). Sum thousands of float amounts and the totals drift. Integers are exact. The API accepts and returns rupees; conversion happens only at the edges (`lib/money.ts`). Banks and payment systems do the same.

**Why store dates as midnight UTC?**
Transactions are calendar dates, not moments in time. If you stored "13 Oct, 00:30 IST", it's 12 Oct in UTC, and the transaction would land in the wrong day or even the wrong month. Storing `2026-10-13T00:00:00Z` and doing all grouping in UTC means a date never shifts.

**How do you stop one user reading another's data?**
Every query includes `user: ctx.user.id`. Updates and deletes match on **both** `_id` and `user`, so guessing someone else's transaction ID returns "not found". That vulnerability is called IDOR (Insecure Direct Object Reference), and it's in the OWASP Top 10.

**Why JWT in an httpOnly cookie, not localStorage?**
localStorage is readable by any JavaScript on the page, so one XSS bug leaks the token. httpOnly cookies are invisible to JavaScript. `SameSite=Strict` stops other sites from triggering requests that carry the cookie (CSRF).

**How is login protected from brute force?**
An in-memory limiter allows 10 attempts per IP + email every 15 minutes (`lib/rateLimiter.ts`). A route-based HTTP limiter can't single out login because every GraphQL operation goes to the same URL. With multiple servers, the counters would move to Redis. There's also a general limit of 300 requests per minute per IP on `/graphql`.

**Why validate with Zod if GraphQL already has types?**
GraphQL checks *shapes* (this is a String, that's a Float). Zod checks *rules*: the amount is positive, the date is real (rejects 30 Feb), the category matches the transaction type, the note is under 200 characters.

**How do insights work?**
`services/insights.ts` is a pure function: it gets this month's numbers, last month's, and the budgets, and returns a list of messages. No database calls, so it's easy to unit test. A category counts as a "spike" only if it rose by 30% **and** by at least ₹1,000, so tiny categories don't cause false alarms.

**How does the frontend talk to the API?**
`web/src/lib/graphql.ts` is a 50-line client: `fetch` POST with `{ query, variables }`, plus a `useQuery` hook that refetches when variables change and ignores stale responses. I didn't use Apollo Client because the app doesn't need a normalised cache. If it grew, Apollo Client or urql would add caching and optimistic updates.

**How does it deploy?**
Three containers: MongoDB, the API, and nginx serving the built React files. nginx proxies `/graphql` to the API, so the browser sees one origin (no CORS) and unknown paths fall back to `index.html` for React Router.

---

## 6. Honest limitations

- No recurring transactions: rent has to be added every month.
- The rate limiter is in-memory, so it resets on restart and isn't shared across servers.
- Offset pagination gets slower on very deep pages. Cursor-based pagination (e.g. "after this date and id") scales better.
- No end-to-end tests yet, only unit tests.

---

## 7. Updated resume entry

**Ledgerly – Personal Finance Tracker** | MongoDB, Express, React, Node.js, GraphQL, TypeScript, Docker | [GitHub]
- Built a multi-user finance tracker with a GraphQL API (Express + GraphQL Yoga) for expenses, income, budgets and payment methods; the dashboard loads in a single GraphQL query.
- Computed category, daily and monthly totals with MongoDB aggregation pipelines and compound indexes, visualised with interactive Recharts charts.
- Generated automatic insights (savings rate, category spending spikes, budget alerts) from monthly data.
- Secured accounts with bcrypt password hashing, JWT in httpOnly cookies, per-user data scoping and login rate limiting; containerised with Docker and CI on GitHub Actions.

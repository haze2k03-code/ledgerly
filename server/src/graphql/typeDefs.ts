// The GraphQL schema: the contract between frontend and backend.
// The client asks for exactly the fields it needs, and the server validates every
// query against these types before running any resolver.
// Money fields are rupees here; the database stores integer paise.

export const typeDefs = /* GraphQL */ `
  enum TransactionType {
    EXPENSE
    INCOME
  }

  enum PaymentMethod {
    UPI
    CARD
    CASH
    BANK_TRANSFER
    WALLET
  }

  enum InsightSeverity {
    GOOD
    INFO
    WARNING
  }

  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Categories {
    expense: [String!]!
    income: [String!]!
  }

  type Transaction {
    id: ID!
    type: TransactionType!
    amount: Float!
    category: String!
    paymentMethod: PaymentMethod!
    note: String!
    "Calendar date, YYYY-MM-DD"
    date: String!
  }

  type TransactionPage {
    items: [Transaction!]!
    total: Int!
    hasMore: Boolean!
  }

  type CategoryTotal {
    category: String!
    amount: Float!
    "Share of the month's spending, 0 to 100"
    share: Float!
  }

  type PaymentMethodTotal {
    method: PaymentMethod!
    amount: Float!
  }

  type DailyTotal {
    date: String!
    expense: Float!
    income: Float!
  }

  type MonthSummary {
    month: String!
    income: Float!
    expense: Float!
    balance: Float!
    "Percent of income saved; null when there was no income"
    savingsRate: Float
    byCategory: [CategoryTotal!]!
    byPaymentMethod: [PaymentMethodTotal!]!
    daily: [DailyTotal!]!
  }

  type MonthTotal {
    month: String!
    income: Float!
    expense: Float!
  }

  type Budget {
    id: ID!
    category: String!
    month: String!
    limit: Float!
    spent: Float!
    remaining: Float!
    percentUsed: Float!
  }

  type Insight {
    kind: String!
    severity: InsightSeverity!
    message: String!
  }

  input TransactionInput {
    type: TransactionType!
    amount: Float!
    category: String!
    paymentMethod: PaymentMethod!
    note: String
    date: String!
  }

  input TransactionFilter {
    type: TransactionType
    category: String
    "Inclusive, YYYY-MM-DD"
    from: String
    "Inclusive, YYYY-MM-DD"
    to: String
    "Matches text in the note"
    search: String
  }

  type Query {
    me: User
    categories: Categories!
    transactions(filter: TransactionFilter, limit: Int = 20, offset: Int = 0): TransactionPage!
    monthSummary(month: String!): MonthSummary!
    trend(months: Int = 6, endMonth: String): [MonthTotal!]!
    budgets(month: String!): [Budget!]!
    insights(month: String!): [Insight!]!
  }

  type Mutation {
    register(name: String!, email: String!, password: String!): User!
    login(email: String!, password: String!): User!
    logout: Boolean!
    addTransaction(input: TransactionInput!): Transaction!
    updateTransaction(id: ID!, input: TransactionInput!): Transaction!
    deleteTransaction(id: ID!): Boolean!
    setBudget(category: String!, month: String!, limit: Float!): Budget!
    deleteBudget(id: ID!): Boolean!
  }
`;

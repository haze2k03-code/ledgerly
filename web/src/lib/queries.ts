// All GraphQL operations the app uses, in one place.

const USER_FIELDS = "id name email";
const TRANSACTION_FIELDS = "id type amount category paymentMethod note date";

export const ME = `query Me { me { ${USER_FIELDS} } }`;

export const LOGIN = `mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) { ${USER_FIELDS} }
}`;

export const REGISTER = `mutation Register($name: String!, $email: String!, $password: String!) {
  register(name: $name, email: $email, password: $password) { ${USER_FIELDS} }
}`;

export const LOGOUT = `mutation Logout { logout }`;

export const CATEGORIES = `query Categories { categories { expense income } }`;

// One request fetches everything the dashboard needs. With REST this would be
// four separate endpoints and four round trips.
export const DASHBOARD = `query Dashboard($month: String!) {
  monthSummary(month: $month) {
    income expense balance savingsRate
    byCategory { category amount share }
    byPaymentMethod { method amount }
    daily { date expense income }
  }
  trend(months: 6, endMonth: $month) { month income expense }
  budgets(month: $month) { id category limit spent percentUsed }
  insights(month: $month) { kind severity message }
}`;

export const TRANSACTIONS = `query Transactions($filter: TransactionFilter, $limit: Int, $offset: Int) {
  transactions(filter: $filter, limit: $limit, offset: $offset) {
    items { ${TRANSACTION_FIELDS} }
    total
    hasMore
  }
}`;

export const ADD_TRANSACTION = `mutation AddTransaction($input: TransactionInput!) {
  addTransaction(input: $input) { ${TRANSACTION_FIELDS} }
}`;

export const UPDATE_TRANSACTION = `mutation UpdateTransaction($id: ID!, $input: TransactionInput!) {
  updateTransaction(id: $id, input: $input) { ${TRANSACTION_FIELDS} }
}`;

export const DELETE_TRANSACTION = `mutation DeleteTransaction($id: ID!) { deleteTransaction(id: $id) }`;

export const BUDGETS = `query Budgets($month: String!) {
  budgets(month: $month) { id category month limit spent remaining percentUsed }
}`;

export const SET_BUDGET = `mutation SetBudget($category: String!, $month: String!, $limit: Float!) {
  setBudget(category: $category, month: $month, limit: $limit) { id }
}`;

export const DELETE_BUDGET = `mutation DeleteBudget($id: ID!) { deleteBudget(id: $id) }`;

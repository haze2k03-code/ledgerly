import { useCallback, useEffect, useState } from "react";

export class GraphQLRequestError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** Fired when the server says we're not logged in, so the app can send the user to /login. */
export const UNAUTHENTICATED_EVENT = "ledgerly:unauthenticated";

/**
 * GraphQL over HTTP is just a POST with { query, variables } as JSON.
 * The response has `data`, and `errors` if anything went wrong.
 */
export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json().catch(() => null)) as {
    data?: T;
    errors?: { message: string; extensions?: { code?: string } }[];
  } | null;

  if (!json) throw new GraphQLRequestError(`Server error (${res.status})`);
  if (json.errors?.length) {
    const { message, extensions } = json.errors[0];
    if (extensions?.code === "UNAUTHENTICATED") window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
    throw new GraphQLRequestError(message, extensions?.code);
  }
  return json.data as T;
}

/** Runs a query when the component mounts and again whenever the variables change. */
export function useQuery<T>(query: string, variables: Record<string, unknown> = {}) {
  const key = JSON.stringify(variables);
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false; // ignore late responses if the variables changed meanwhile
    setLoading(true);
    gql<T>(query, JSON.parse(key))
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(undefined);
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query, key, version]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, refetch };
}

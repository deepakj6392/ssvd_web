import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://ssvd-6ru7.onrender.com";
const graphqlEndpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "/graphql";

export const client = new ApolloClient({
  link: new HttpLink({
    uri: `${backendUrl}${graphqlEndpoint}`,
  }),
  cache: new InMemoryCache(),
});

import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://10.160.2.165:3001";
const graphqlEndpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "/graphql";

export const client = new ApolloClient({
  link: new HttpLink({
    uri: `${backendUrl}${graphqlEndpoint}`,
  }),
  cache: new InMemoryCache(),
});

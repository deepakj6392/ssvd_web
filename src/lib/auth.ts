import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://ssvd-6ru7.onrender.com";
const graphqlEndpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "/graphql";

const httpLink = createHttpLink({
  uri: `${backendUrl}${graphqlEndpoint}`, // Backend GraphQL endpoint
});

const authLink = setContext((_, { headers }) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

export const setToken = (token: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', token);
};

export const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export const removeToken = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
};

export const isAuthenticated = () => {
  return !!getToken();
};

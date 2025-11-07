import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: 'http://10.160.2.165:3001/graphql', // Backend GraphQL endpoint
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

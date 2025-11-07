'use client';

import { useState } from 'react';
import { useMutation, gql } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

const FORGOT_PASSWORD_MUTATION = gql`
  mutation ForgotPassword($email: String!) {
    forgotPassword(email: $email)
  }
`;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [forgotPassword, { loading }] = useMutation(FORGOT_PASSWORD_MUTATION, {
    onCompleted: (data) => {
      setMessage(data.forgotPassword);
      setError('');
    },
    onError: (error) => {
      setError(error.message);
      setMessage('');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email is required');
      return;
    }
    await forgotPassword({ variables: { email } });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address and we&apos;ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {message && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/login" className="text-sm text-blue-600 hover:underline">
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

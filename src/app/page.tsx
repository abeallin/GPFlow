'use client';

import { LoginForm } from '@/components/LoginForm';
import { useRouter } from 'next/navigation';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function LoginPage() {
  const router = useRouter();
  usePageTitle('Sign in');

  return (
    <LoginForm onSuccess={() => router.push('/data')} />
  );
}

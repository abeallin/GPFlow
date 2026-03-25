'use client';

import { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { LicenseValidator } from './LicenseValidator';
import { ipc } from '@/lib/ipc-client';

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [licenseValid, setLicenseValid] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }
    if (!licenseValid) {
      setError('Please validate your license key first');
      return;
    }

    if (ipc) {
      await ipc.saveCredentials({ username, password, licenseKey: '' });
    }
    onSuccess();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-50">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">GP Flow</h1>
        <p className="mt-2 text-gray-500">Automate Your Accurx Templates</p>
      </div>

      <Card className="w-full max-w-md p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your Accurx username"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
          <LicenseValidator onValidated={setLicenseValid} />

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" className="w-full">
            Login
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-sm text-gray-400">Version 8.0.0</p>
    </div>
  );
}

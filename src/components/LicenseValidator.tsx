'use client';

import { useState, useEffect } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ipc } from '@/lib/ipc-client';

interface LicenseValidatorProps {
  onValidated: (valid: boolean) => void;
  initialKey?: string;
}

export function LicenseValidator({ onValidated, initialKey = '' }: LicenseValidatorProps) {
  const [licenseKey, setLicenseKey] = useState(initialKey);
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [cached, setCached] = useState(false);

  const validate = async () => {
    if (!licenseKey.trim() || !ipc) return;
    setStatus('checking');
    const result = await ipc.validateLicense(licenseKey.trim());
    setStatus(result.valid ? 'valid' : 'invalid');
    setCached(result.cached);
    onValidated(result.valid);
  };

  useEffect(() => {
    if (initialKey) validate();
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            label="License Key"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="Enter your license key"
          />
        </div>
        <div className="flex items-end">
          <Button
            variant="secondary"
            onClick={validate}
            disabled={status === 'checking'}
            className="border border-border-subtle hover:border-accent/30 transition-colors"
          >
            {status === 'checking' ? 'Checking...' : 'Validate'}
          </Button>
        </div>
      </div>
      {status === 'valid' && (
        <Badge variant="success">
          License Active {cached && '(cached)'}
        </Badge>
      )}
      {status === 'invalid' && (
        <Badge variant="error">License Invalid</Badge>
      )}
    </div>
  );
}

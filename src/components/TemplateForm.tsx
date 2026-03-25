'use client';

import { useState } from 'react';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Button } from './ui/Button';
import { Toggle } from './ui/Toggle';
import { Alert } from './ui/Alert';

interface TemplateConfig {
  template_name: string;
  message: string;
  individual: boolean;
  batch: boolean;
  allow_respond: boolean;
}

interface TemplateFormProps {
  mode: 'create' | 'delete';
  onSubmit: (config: TemplateConfig) => void;
  practiceCount: number;
}

export function TemplateForm({ mode, onSubmit, practiceCount }: TemplateFormProps) {
  const [templateName, setTemplateName] = useState('');
  const [message, setMessage] = useState('');
  const [individual, setIndividual] = useState(true);
  const [batch, setBatch] = useState(false);
  const [allowRespond, setAllowRespond] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ template_name: templateName, message, individual, batch, allow_respond: allowRespond });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-2">
      <Input
        label="Template Name"
        value={templateName}
        onChange={(e) => setTemplateName(e.target.value)}
        placeholder="Enter template name"
        required
      />

      {mode === 'create' && (
        <>
          <Textarea
            label="Message Body"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter the template message"
            rows={4}
            required
          />

          <div className="bg-slate-50 rounded-lg p-4 space-y-4">
            <p className="text-sm font-semibold text-text-primary">Template Options</p>
            <div className="space-y-3">
              <Toggle checked={individual} onChange={setIndividual} label="Individual messaging" />
              <Toggle checked={batch} onChange={setBatch} label="Batch messaging" />
              <Toggle checked={allowRespond} onChange={setAllowRespond} label="Allow patients to respond" />
            </div>
          </div>
        </>
      )}

      <Alert variant="info">
        Will {mode} template &quot;{templateName || '...'}&quot; across <strong>{practiceCount}</strong> selected practices
      </Alert>

      <Button type="submit" className="w-full">
        {mode === 'create' ? 'Bulk Create Template' : 'Bulk Delete Template'}
      </Button>
    </form>
  );
}

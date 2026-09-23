'use client';

import { useState } from 'react';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Button } from './ui/Button';
import { Toggle } from './ui/Toggle';

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
  /** A run is being started: the submit shows its pending state and refuses a second press. */
  busy?: boolean;
}

export function TemplateForm({ mode, onSubmit, practiceCount, busy = false }: TemplateFormProps) {
  const [templateName, setTemplateName] = useState('');
  const [message, setMessage] = useState('');
  const [individual, setIndividual] = useState(true);
  const [batch, setBatch] = useState(false);
  const [allowRespond, setAllowRespond] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    onSubmit({ template_name: templateName, message, individual, batch, allow_respond: allowRespond });
  };

  const nothingSelected = practiceCount === 0;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6 pt-2">
      <Input
        label="Template name"
        hint={mode === 'delete' ? 'Only templates whose name matches exactly are deleted.' : undefined}
        value={templateName}
        onChange={(e) => setTemplateName(e.target.value)}
        placeholder="e.g. Flu clinic 2026"
        required
        autoComplete="off"
      />

      {mode === 'create' && (
        <>
          <Textarea
            label="Message body"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="The message patients will receive"
            rows={4}
            required
          />

          <fieldset className="bg-bg-root rounded-xl p-4 space-y-4 border border-border m-0">
            <legend className="text-sm font-semibold text-text-secondary px-1">Template options</legend>
            <div className="space-y-3">
              <Toggle checked={individual} onChange={setIndividual} label="Individual messaging" />
              <Toggle checked={batch} onChange={setBatch} label="Batch messaging" />
              <Toggle checked={allowRespond} onChange={setAllowRespond} label="Allow patients to respond" />
            </div>
          </fieldset>
        </>
      )}

      <p className="text-sm text-text-secondary">
        Will {mode} template “{templateName || '…'}” across <strong className="text-text-primary tabular-nums">{practiceCount}</strong> assigned practice{practiceCount === 1 ? '' : 's'}.
      </p>

      <Button
        type="submit"
        size="lg"
        pending={busy}
        pendingLabel="Starting…"
        disabledReason={nothingSelected ? 'No assigned practices selected. Assign files to accounts on the Data page first.' : undefined}
        className="w-full"
      >
        {mode === 'create' ? 'Bulk Create Template' : 'Bulk Delete Template'}
      </Button>
    </form>
  );
}

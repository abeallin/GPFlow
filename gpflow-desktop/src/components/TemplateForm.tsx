'use client';

import { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

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
    onSubmit({
      template_name: templateName,
      message,
      individual,
      batch,
      allow_respond: allowRespond,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="Template Name *"
        value={templateName}
        onChange={(e) => setTemplateName(e.target.value)}
        placeholder="Enter template name"
        required
      />

      {mode === 'create' && (
        <>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Message Body *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter the template message"
              required
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Template Options</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={individual} onChange={(e) => setIndividual(e.target.checked)} className="rounded" />
              <span className="text-sm">Individual messaging</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={batch} onChange={(e) => setBatch(e.target.checked)} className="rounded" />
              <span className="text-sm">Batch messaging</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={allowRespond} onChange={(e) => setAllowRespond(e.target.checked)} className="rounded" />
              <span className="text-sm">Allow patients to respond</span>
            </label>
          </div>
        </>
      )}

      <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
        Will {mode} template &quot;{templateName || '...'}&quot; across <strong>{practiceCount}</strong> selected practices
      </div>

      <Button type="submit" className="w-full">
        {mode === 'create' ? 'Bulk Create Template' : 'Bulk Delete Template'}
      </Button>
    </form>
  );
}

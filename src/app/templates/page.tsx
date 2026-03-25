'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { TemplateForm } from '@/components/TemplateForm';
import { ipc } from '@/lib/ipc-client';
import { useRouter } from 'next/navigation';

interface TemplateConfig {
  template_name: string;
  message: string;
  individual: boolean;
  batch: boolean;
  allow_respond: boolean;
}

export default function TemplatesPage() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [screenshotMode, setScreenshotMode] = useState<string>('on-failure');
  const router = useRouter();

  useEffect(() => {
    const stored = sessionStorage.getItem('selectedPracticeIds');
    if (stored) setSelectedIds(JSON.parse(stored));
  }, []);

  const startRun = async (config: TemplateConfig, type: 'create' | 'delete') => {
    if (!ipc) return;
    const { runId } = await ipc.startRun({
      type,
      templateConfig: config,
      practiceIds: selectedIds,
      screenshotMode,
    });
    router.push(`/runs?active=${runId}`);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Template Management</h1>
        <p className="text-gray-500">{selectedIds.length} practices selected</p>
      </div>

      <Card className="p-6">
        <Tabs tabs={[
          {
            id: 'create',
            label: 'Create Template',
            content: <TemplateForm mode="create" onSubmit={(c) => startRun(c, 'create')} practiceCount={selectedIds.length} />,
          },
          {
            id: 'delete',
            label: 'Delete Template',
            content: <TemplateForm mode="delete" onSubmit={(c) => startRun(c, 'delete')} practiceCount={selectedIds.length} />,
          },
        ]} />
      </Card>

      <Card className="p-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Screenshot Mode</p>
          <select
            value={screenshotMode}
            onChange={(e) => setScreenshotMode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="off">Off</option>
            <option value="on-failure">On failure only</option>
            <option value="every-step">Every step</option>
          </select>
        </div>
      </Card>
    </div>
  );
}

import type Database from 'better-sqlite3';

/** What the renderer supplies when saving a template; the database adds id and timestamps. */
export interface NewSavedTemplate {
  name: string;
  template_name: string;
  message: string;
  individual: boolean;
  batch: boolean;
  allow_respond: boolean;
}

/** A row of `saved_templates` as stored: the booleans come back as 0/1. */
export interface SavedTemplateRow {
  id: number;
  name: string;
  template_name: string;
  message: string;
  individual: number;
  batch: number;
  allow_respond: number;
  created_at: string;
  updated_at: string;
}

export function saveTemplate(db: Database.Database, template: NewSavedTemplate): number {
  const result = db.prepare(`
    INSERT INTO saved_templates (name, template_name, message, individual, batch, allow_respond)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    template.name,
    template.template_name,
    template.message,
    template.individual ? 1 : 0,
    template.batch ? 1 : 0,
    template.allow_respond ? 1 : 0,
  );
  return result.lastInsertRowid as number;
}

export function getSavedTemplates(db: Database.Database): SavedTemplateRow[] {
  return db.prepare('SELECT * FROM saved_templates ORDER BY updated_at DESC').all() as SavedTemplateRow[];
}

export function deleteTemplate(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM saved_templates WHERE id = ?').run(id);
}

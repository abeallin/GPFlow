import type Database from 'better-sqlite3';

export function saveTemplate(
  db: Database.Database,
  template: { name: string; template_name: string; message: string; individual: boolean; batch: boolean; allow_respond: boolean },
): number {
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

export function getSavedTemplates(db: Database.Database): any[] {
  return db.prepare('SELECT * FROM saved_templates ORDER BY updated_at DESC').all();
}

export function deleteTemplate(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM saved_templates WHERE id = ?').run(id);
}

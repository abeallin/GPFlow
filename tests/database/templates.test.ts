import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase } from '../helpers/sqlite-adapter';
import { createSchema } from '../../database/schema';
import { saveTemplate, getSavedTemplates, deleteTemplate } from '../../database/queries/templates';

describe('Templates Queries', () => {
  let db: any;

  beforeEach(async () => {
    db = await createTestDatabase();
    createSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('saveTemplate inserts a template and returns id', () => {
    const id = saveTemplate(db, {
      name: 'My Template',
      template_name: 'flu-reminder',
      message: 'Please book your flu jab',
      individual: true,
      batch: false,
      allow_respond: true,
    });
    expect(id).toBeGreaterThan(0);
  });

  it('getSavedTemplates returns all templates', () => {
    saveTemplate(db, {
      name: 'Template 1',
      template_name: 'flu-reminder',
      message: 'Message 1',
      individual: true,
      batch: false,
      allow_respond: false,
    });
    saveTemplate(db, {
      name: 'Template 2',
      template_name: 'covid-reminder',
      message: 'Message 2',
      individual: false,
      batch: true,
      allow_respond: true,
    });

    const templates = getSavedTemplates(db);
    expect(templates).toHaveLength(2);
    expect(templates[0].name).toBeDefined();
    expect(templates[1].name).toBeDefined();
  });

  it('saveTemplate stores boolean fields as integers', () => {
    saveTemplate(db, {
      name: 'T',
      template_name: 'test',
      message: '',
      individual: true,
      batch: false,
      allow_respond: true,
    });

    const templates = getSavedTemplates(db);
    expect(templates[0].individual).toBe(1);
    expect(templates[0].batch).toBe(0);
    expect(templates[0].allow_respond).toBe(1);
  });

  it('deleteTemplate removes a template by id', () => {
    const id = saveTemplate(db, {
      name: 'To Delete',
      template_name: 'test',
      message: '',
      individual: true,
      batch: false,
      allow_respond: false,
    });

    deleteTemplate(db, id);

    const templates = getSavedTemplates(db);
    expect(templates).toHaveLength(0);
  });

  it('deleteTemplate with non-existent id does not error', () => {
    expect(() => deleteTemplate(db, 999)).not.toThrow();
  });
});

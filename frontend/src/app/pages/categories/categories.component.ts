import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { ApiService, Category } from '../../services/api.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cats-page">
      <header class="cats-header">
        <h1>Categories</h1>
        <p class="cats-sub">Define categories to organize scraped domains and set default field mappings (e.g. Ropa → title, image, price).</p>
        <button class="btn-accent" (click)="startCreate()">+ New Category</button>
      </header>

      <!-- Create / Edit form -->
      @if (showForm()) {
        <div class="cats-form-card">
          <h3>{{ editingId() ? 'Edit' : 'New' }} Category</h3>
          <div class="cats-form">
            <label class="cats-label">
              Name
              <input class="cats-input" [(ngModel)]="formName" placeholder="e.g. Ropa, Electrónica" />
            </label>
            <label class="cats-label">
              Description
              <textarea class="cats-input cats-textarea" [(ngModel)]="formDescription" placeholder="What type of products go here?"></textarea>
            </label>
            <label class="cats-label">
              Default Field Mappings
              <span class="cats-hint">One per line: <code>canonicalField:type</code> (e.g. <code>title:text</code>, <code>image:text</code>, <code>price:text</code>). Type can be <code>text</code>, <code>attribute</code>, or <code>html</code>.</span>
              <textarea class="cats-input cats-textarea cats-mono" [(ngModel)]="formMappings" placeholder="title:text&#10;image:image&#10;price:price"></textarea>
            </label>
            <div class="cats-form-actions">
              <button class="btn" (click)="cancelForm()">Cancel</button>
              <button class="btn-accent" (click)="saveCategory()">{{ editingId() ? 'Update' : 'Create' }}</button>
            </div>
          </div>
        </div>
      }

      <!-- List -->
      <div class="cats-list">
        @if (categories().length === 0) {
          <div class="cats-empty">
            <p>No categories yet. Create one to organize your domains.</p>
          </div>
        }
        @for (cat of categories(); track cat.id) {
          <div class="cats-card">
            <div class="cats-card-body">
              <div class="cats-card-top">
                <h3>{{ cat.name }}</h3>
                <div class="cats-card-actions">
                  <button class="btn-sm" (click)="startEdit(cat)">Edit</button>
                  <button class="btn-sm btn-sm--danger" (click)="deleteCategory(cat.id)">Delete</button>
                </div>
              </div>
              @if (cat.description) {
                <p class="cats-desc">{{ cat.description }}</p>
              }
              @if (cat.defaultFieldMappings && cat.defaultFieldMappings.length > 0) {
                <div class="cats-mappings">
                  <span class="cats-mappings-label">Default fields:</span>
                  @for (m of cat.defaultFieldMappings; track m.canonicalField) {
                    <span class="cats-badge">{{ fieldIcon(m.canonicalField) }} {{ m.canonicalField }}</span>
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; padding: 2rem; max-width: 800px; margin: 0 auto; }
    .cats-header { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 2rem; }
    .cats-header h1 { margin: 0; font-size: 1.75rem; font-weight: 700; color: var(--text-1); }
    .cats-sub { margin: 0; color: var(--text-2); font-size: 0.9375rem; }
    .cats-header .btn-accent { align-self: flex-start; margin-top: 0.5rem; }

    /* Form */
    .cats-form-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.5rem; }
    .cats-form-card h3 { margin: 0 0 1rem; font-size: 1rem; color: var(--text-1); }
    .cats-form { display: flex; flex-direction: column; gap: 1rem; }
    .cats-label { display: flex; flex-direction: column; gap: 0.375rem; font-size: 0.8125rem; font-weight: 600; color: var(--text-1); }
    .cats-input { padding: 0.625rem 0.75rem; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.9375rem; color: var(--text-1); font-family: var(--font); }
    .cats-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
    .cats-textarea { min-height: 60px; resize: vertical; }
    .cats-mono { font-family: var(--font-mono); font-size: 0.8125rem; }
    .cats-hint { font-weight: 400; font-size: 0.75rem; color: var(--text-3); }
    .cats-form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

    /* List */
    .cats-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .cats-empty { text-align: center; padding: 3rem 2rem; color: var(--text-3); }
    .cats-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
    .cats-card-body { padding: 1rem 1.25rem; }
    .cats-card-top { display: flex; justify-content: space-between; align-items: center; }
    .cats-card-top h3 { margin: 0; font-size: 1.0625rem; font-weight: 700; color: var(--text-1); }
    .cats-card-actions { display: flex; gap: 0.375rem; }
    .cats-desc { margin: 0.375rem 0 0; font-size: 0.875rem; color: var(--text-2); }
    .cats-mappings { display: flex; flex-wrap: wrap; gap: 0.375rem; align-items: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border); }
    .cats-mappings-label { font-size: 0.75rem; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em; }
    .cats-badge { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 999px; background: var(--surface-3); color: var(--text-1); }

    .btn { padding: 0.5rem 1rem; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); color: var(--text-1); cursor: pointer; font-size: 0.875rem; }
    .btn-sm { padding: 0.25rem 0.625rem; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); color: var(--text-1); cursor: pointer; font-size: 0.75rem; }
    .btn-sm--danger { border-color: rgba(239,68,68,0.3); color: var(--danger); }
    .btn-accent { padding: 0.5rem 1rem; border-radius: var(--radius); border: none; background: var(--accent); color: #fff; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
  `],
})
export class CategoriesComponent {
  private readonly api = inject(ApiService);
  readonly categories = signal<Category[]>([]);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);

  formName = '';
  formDescription = '';
  formMappings = '';

  constructor() {
    this.load();
  }

  private load(): void {
    this.api.getCategories()
      .pipe(catchError(() => of([])))
      .subscribe((cats) => this.categories.set(cats));
  }

  startCreate(): void {
    this.editingId.set(null);
    this.formName = '';
    this.formDescription = '';
    this.formMappings = '';
    this.showForm.set(true);
  }

  startEdit(cat: Category): void {
    this.editingId.set(cat.id);
    this.formName = cat.name;
    this.formDescription = cat.description ?? '';
    this.formMappings = (cat.defaultFieldMappings ?? [])
      .map((m) => `${m.canonicalField}:${m.type}`)
      .join('\n');
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
  }

  saveCategory(): void {
    const fieldTypes = ['text', 'attribute', 'html'] as const;
    type FieldType = (typeof fieldTypes)[number];
    const mappings = this.formMappings
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [canonicalField = l, rawType = 'text'] = l.split(':');
        const type: FieldType = fieldTypes.includes(rawType as FieldType)
          ? (rawType as FieldType)
          : 'text';
        return { canonicalField, type, selector: '' };
      });

    const payload = {
      name: this.formName,
      description: this.formDescription || undefined,
      defaultFieldMappings: mappings.length > 0 ? mappings : undefined,
    };

    const obs = this.editingId()
      ? this.api.updateCategory(this.editingId()!, payload)
      : this.api.createCategory(payload);

    obs.subscribe({
      next: () => {
        this.showForm.set(false);
        this.load();
      },
      error: (err) => alert('Failed to save category: ' + (err.message ?? err)),
    });
  }

  deleteCategory(id: string): void {
    if (!confirm('Delete this category? Domains assigned to it will be unlinked.')) return;
    this.api.deleteCategory(id).subscribe({
      next: () => this.load(),
      error: (err) => alert('Failed to delete: ' + (err.message ?? err)),
    });
  }

  fieldIcon(name: string): string {
    const n = name.toLowerCase();
    if (/image|img|foto|photo|thumbnail|imagen/i.test(n)) return '📸';
    if (/title|name|nombre|titulo|producto/i.test(n)) return '📝';
    if (/price|cost|precio|pricing|amount/i.test(n)) return '💰';
    return '🔤';
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { ApiService, Category } from '../../services/api.service';

/**
 * CategoriesComponent — operator surface for managing category
 * presets that link domains to default field mappings.
 *
 * Sprint 5: tokens migrated to Insight Flow (Material 3 + Tailwind
 * v4 utility classes). Form layout follows the LoginComponent
 * precedent — bg-surface-container-low input fill, focus:border-
 * primary + focus:ring-2.
 */
@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto block max-w-3xl p-8">
      <header class="mb-8 flex flex-col gap-2">
        <h1 class="text-headline-lg m-0 font-bold text-on-surface tracking-tight">
          Categories
        </h1>
        <p class="text-body-lg m-0 text-on-surface-variant">
          Define categories to organize scraped domains and set default field
          mappings (e.g. Ropa → title, image, price).
        </p>
        <button
          type="button"
          class="bg-primary text-on-primary hover:bg-primary-container mt-2 w-fit cursor-pointer self-start rounded-md px-4 py-2 text-body-md font-semibold transition-colors"
          (click)="startCreate()"
          data-testid="btn-new-category"
        >
          <span class="material-symbols-outlined mr-1.5 align-middle" style="font-size: 18px"
            >add</span
          >
          New Category
        </button>
      </header>

      <!-- Create / Edit form -->
      @if (showForm()) {
        <section
          class="mb-6 rounded-xl border border-outline-variant bg-surface p-6"
          aria-label="Category form"
        >
          <h3 class="text-body-lg m-0 mb-4 font-semibold text-on-surface">
            {{ editingId() ? 'Edit' : 'New' }} Category
          </h3>
          <div class="flex flex-col gap-4">
            <label class="flex flex-col gap-1.5 text-body-md font-semibold text-on-surface">
              Name
              <input
                class="rounded-md border border-outline-variant bg-surface-container-low px-3 py-2.5 text-body-lg text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary"
                [(ngModel)]="formName"
                placeholder="e.g. Ropa, Electrónica"
              />
            </label>
            <label class="flex flex-col gap-1.5 text-body-md font-semibold text-on-surface">
              Description
              <textarea
                class="min-h-15 resize-y rounded-md border border-outline-variant bg-surface-container-low px-3 py-2.5 text-body-lg text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary"
                [(ngModel)]="formDescription"
                placeholder="What type of products go here?"
              ></textarea>
            </label>
            <label class="flex flex-col gap-1.5 text-body-md font-semibold text-on-surface">
              Default Field Mappings
              <span class="text-label-caps font-normal text-on-surface-variant"
                >One per line: <code class="rounded-xs bg-surface-container-low px-1.5 py-0.5 font-mono">canonicalField:type</code> (e.g.
                <code class="rounded-xs bg-surface-container-low px-1.5 py-0.5 font-mono">title:text</code>,
                <code class="rounded-xs bg-surface-container-low px-1.5 py-0.5 font-mono">image:text</code>,
                <code class="rounded-xs bg-surface-container-low px-1.5 py-0.5 font-mono">price:text</code>). Type can be
                <code class="rounded-xs bg-surface-container-low px-1.5 py-0.5 font-mono">text</code>,
                <code class="rounded-xs bg-surface-container-low px-1.5 py-0.5 font-mono">attribute</code>, or
                <code class="rounded-xs bg-surface-container-low px-1.5 py-0.5 font-mono">html</code>.</span
              >
              <textarea
                class="min-h-15 resize-y rounded-md border border-outline-variant bg-surface-container-low px-3 py-2.5 font-mono text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary"
                [(ngModel)]="formMappings"
                placeholder="title:text&#10;image:image&#10;price:price"
              ></textarea>
            </label>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="cursor-pointer rounded-md border border-outline-variant bg-surface px-4 py-2 text-body-md text-on-surface transition-colors hover:bg-surface-container"
                (click)="cancelForm()"
              >
                Cancel
              </button>
              <button
                type="button"
                class="bg-primary text-on-primary hover:bg-primary-container cursor-pointer rounded-md px-4 py-2 text-body-md font-semibold transition-colors"
                (click)="saveCategory()"
              >
                {{ editingId() ? 'Update' : 'Create' }}
              </button>
            </div>
          </div>
        </section>
      }

      <!-- List -->
      <div class="flex flex-col gap-3">
        @if (categories().length === 0) {
          <div
            class="rounded-xl border border-dashed border-outline-variant p-8 text-center text-body-lg text-on-surface-variant"
          >
            <p class="m-0">No categories yet. Create one to organize your domains.</p>
          </div>
        }
        @for (cat of categories(); track cat.id) {
          <article class="overflow-hidden rounded-xl border border-outline-variant bg-surface">
            <div class="px-5 py-4">
              <div class="flex items-center justify-between">
                <h3 class="text-headline-sm m-0 font-bold text-on-surface">{{ cat.name }}</h3>
                <div class="flex gap-1.5">
                  <button
                    type="button"
                    class="cursor-pointer rounded-md border border-outline-variant bg-surface px-2.5 py-1 text-label-caps text-on-surface transition-colors hover:bg-surface-container"
                    (click)="startEdit(cat)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="cursor-pointer rounded-md border border-danger/30 bg-surface px-2.5 py-1 text-label-caps text-danger transition-colors hover:bg-danger-dim"
                    (click)="deleteCategory(cat.id)"
                  >
                    Delete
                  </button>
                </div>
              </div>
              @if (cat.description) {
                <p class="text-body-md m-1 mt-1.5 text-on-surface-variant">{{ cat.description }}</p>
              }
              @if (cat.defaultFieldMappings && cat.defaultFieldMappings.length > 0) {
                <div
                  class="mt-3 flex flex-wrap items-center gap-1.5 border-t border-outline-variant pt-3"
                >
                  <span class="text-label-caps text-on-surface-variant">Default fields:</span>
                  @for (m of cat.defaultFieldMappings; track m.canonicalField) {
                    @if (m.canonicalField) {
                      <span
                        class="flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-body-md text-on-surface"
                      >
                        <span
                          class="material-symbols-outlined text-on-surface-variant"
                          style="font-size: 14px"
                          >{{ fieldIcon(m.canonicalField) }}</span
                        >
                        {{ m.canonicalField }}
                      </span>
                    }
                  }
                </div>
              }
            </div>
          </article>
        }
      </div>
    </div>
  `,
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
    this.api
      .getCategories()
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

  /**
   * Material Symbols icon name for a given field type. Replaces the
   * legacy emoji picker. Add new field types here and the template
   * renders the icon via the standard <span class="material-symbols-
   * outlined">{{ fieldIcon(name) }}</span> pattern.
   */
  fieldIcon(name: string | null | undefined): string {
    if (!name) return 'text_fields';
    const n = name.toLowerCase();
    if (/image|img|foto|photo|thumbnail|imagen/i.test(n)) return 'image';
    if (/title|name|nombre|titulo|producto/i.test(n)) return 'title';
    if (/price|cost|precio|pricing|amount/i.test(n)) return 'payments';
    return 'text_fields';
  }
}
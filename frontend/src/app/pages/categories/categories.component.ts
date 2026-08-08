import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { catchError, of } from 'rxjs';
import { ApiService, Category } from '../../services/api.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto block max-w-3xl p-8 font-sans">
      <header class="mb-8 flex flex-col gap-2">
        <h1 class="text-headline-lg m-0 font-bold text-on-surface tracking-tight">Categories</h1>
        <p class="text-body-lg m-0 text-on-surface-variant">
          Define categories to organize scraped domains and set default field mappings (e.g. Ropa →
          title, image, price).
        </p>
        <button
          mat-flat-button
          color="primary"
          class="mt-2 w-fit"
          (click)="startCreate()"
          data-testid="btn-new-category"
        >
          <mat-icon>add</mat-icon>
          <span>New Category</span>
        </button>
      </header>

      <!-- Create / Edit form -->
      @if (showForm()) {
        <mat-card
          appearance="outlined"
          class="mb-6 !p-6"
          aria-label="Category form"
        >
          <h3 class="text-body-lg m-0 mb-4 font-semibold text-on-surface">
            {{ editingId() ? 'Edit' : 'New' }} Category
          </h3>
          <div class="flex flex-col gap-4">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Name</mat-label>
              <input
                matInput
                [(ngModel)]="formName"
                placeholder="e.g. Ropa, Electrónica"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Description</mat-label>
              <textarea
                matInput
                rows="3"
                [(ngModel)]="formDescription"
                placeholder="What type of products go here?"
              ></textarea>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Default Field Mappings</mat-label>
              <textarea
                matInput
                rows="4"
                [(ngModel)]="formMappings"
                placeholder="title:text&#10;image:image&#10;price:price"
              ></textarea>
              <mat-hint>
                One per line: canonicalField:type (e.g. title:text, image:text, price:text). Type can be text, attribute, or html.
              </mat-hint>
            </mat-form-field>

            <div class="flex justify-end gap-2 mt-2">
              <button
                mat-stroked-button
                (click)="cancelForm()"
              >
                Cancel
              </button>
              <button
                mat-flat-button
                color="primary"
                (click)="saveCategory()"
              >
                {{ editingId() ? 'Update' : 'Create' }}
              </button>
            </div>
          </div>
        </mat-card>
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
          <mat-card appearance="outlined" class="!overflow-hidden">
            <div class="px-5 py-4">
              <div class="flex items-center justify-between">
                <h3 class="text-headline-sm m-0 font-bold text-on-surface">{{ cat.name }}</h3>
                <div class="flex gap-2">
                  <button
                    mat-stroked-button
                    (click)="startEdit(cat)"
                  >
                    Edit
                  </button>
                  <button
                    mat-stroked-button
                    color="warn"
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
                  class="mt-3 flex flex-wrap items-center gap-2 border-t border-outline-variant pt-3"
                >
                  <span class="text-label-caps text-on-surface-variant">Default fields:</span>
                  <mat-chip-set>
                    @for (m of cat.defaultFieldMappings; track m.canonicalField) {
                      @if (m.canonicalField) {
                        <mat-chip class="!min-h-7 !text-xs">
                          <span class="flex items-center gap-1">
                            <mat-icon class="!size-3.5 !text-sm">{{ fieldIcon(m.canonicalField) }}</mat-icon>
                            <span>{{ m.canonicalField }}</span>
                          </span>
                        </mat-chip>
                      }
                    }
                  </mat-chip-set>
                </div>
              }
            </div>
          </mat-card>
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

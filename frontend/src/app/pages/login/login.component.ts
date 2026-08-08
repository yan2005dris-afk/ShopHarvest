import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  mode: Mode = 'login';
  email = '';
  password = '';
  error = '';
  submitting = false;
  hidePassword = true;

  get title(): string {
    return this.mode === 'login' ? 'Sign in' : 'Create account';
  }

  toggleMode(): void {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.error = '';
  }

  submit(): void {
    if (this.submitting) return;
    this.error = '';

    if (!this.email.trim() || !this.password) {
      this.error = 'Email and password are required.';
      return;
    }

    this.submitting = true;
    const op =
      this.mode === 'login'
        ? this.auth.login(this.email.trim(), this.password)
        : this.auth.register(this.email.trim(), this.password);

    op.subscribe({
      next: () => {
        this.submitting = false;
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.submitting = false;
        this.error =
          err?.error?.message || err?.message || 'Authentication failed. Please try again.';
      },
    });
  }
}

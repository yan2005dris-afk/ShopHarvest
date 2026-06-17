import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, DomainRule, ScrapingJob } from '../../services/api.service';

@Component({
  selector: 'app-url-input',
  imports: [FormsModule, NgIf, NgFor, DatePipe, RouterLink],
  templateUrl: './url-input.component.html',
  styleUrl: './url-input.component.css',
})
export class UrlInputComponent implements OnInit, OnDestroy {
  // Domain selector
  domains: DomainRule[] = [];
  selectedDomainId = '';
  domainsLoading = true;

  // URL input
  url = '';
  urlWarning = '';

  // Submission state
  isLoading = false;
  error = '';

  // Job tracking
  currentJob: ScrapingJob | null = null;
  jobResult: any = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private pollAttempts = 0;
  private readonly maxPollAttempts = 20;

  constructor(
    private readonly apiService: ApiService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadDomains();
  }

  ngOnDestroy(): void {
    this.clearPolling();
  }

  private loadDomains(): void {
    this.domainsLoading = true;
    this.apiService.getDomains().subscribe({
      next: (domains) => {
        this.domains = domains;
        this.domainsLoading = false;
        // Force change detection: FetchBackend may resolve outside Angular zone
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load domains', err);
        this.domainsLoading = false;
        this.error = 'Error al cargar los dominios. Asegúrate de que el backend esté funcionando.';
      },
    });
  }

  onDomainChange(): void {
    this.validateDomainUrl();
  }

  onUrlChange(): void {
    this.validateDomainUrl();
  }

  private validateDomainUrl(): void {
    if (!this.selectedDomainId || !this.url) {
      this.urlWarning = '';
      return;
    }

    try {
      const domain = this.domains.find((d) => d.id === this.selectedDomainId);
      if (!domain) return;

      const urlHost = new URL(this.url).hostname.replace(/^www\./, '');
      const domainHost = domain.domain.replace(/^www\./, '');

      if (urlHost !== domainHost) {
        this.urlWarning = `Advertencia: La URL no pertenece al dominio "${domain.domain}". Puedes enviarlo igualmente.`;
      } else {
        this.urlWarning = '';
      }
    } catch {
      this.urlWarning = '';
    }
  }

  submit(): void {
    if (!this.selectedDomainId || !this.url || this.isLoading) return;

    this.isLoading = true;
    this.error = '';
    this.currentJob = null;
    this.jobResult = null;
    this.clearPolling();

    this.apiService.enqueueJob(this.selectedDomainId, this.url).subscribe({
      next: (job) => {
        this.currentJob = job;
        this.isLoading = false;
        this.cdr.markForCheck();
        this.startPolling(job.id);
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err.error?.message || 'Error al encolar el trabajo de scraping.';
        console.error('Failed to enqueue job', err);
        this.cdr.markForCheck();
      },
    });
  }

  private startPolling(jobId: string): void {
    this.pollAttempts = 0;
    this.pollInterval = setInterval(() => {
      this.pollAttempts++;
      this.apiService.getJobStatus(jobId).subscribe({
        next: (job) => {
          this.currentJob = job;
          this.cdr.markForCheck();

          if (job.status === 'completed') {
            this.clearPolling();
            this.loadJobResult(jobId);
          } else if (job.status === 'failed') {
            this.clearPolling();
          }
        },
        error: (err) => {
          console.error('Polling error', err);
        },
      });

      if (this.pollAttempts >= this.maxPollAttempts) {
        this.clearPolling();
        this.error = 'El trabajo está tomando más tiempo de lo esperado. Revisa la página de productos más tarde.';
      }
    }, 3000);
  }

  private loadJobResult(jobId: string): void {
    this.apiService.getJobResult(jobId).subscribe({
      next: (result) => {
        this.jobResult = result;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load job result', err);
      },
    });
  }

  private clearPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  tryAgain(): void {
    this.currentJob = null;
    this.jobResult = null;
    this.error = '';
  }
}

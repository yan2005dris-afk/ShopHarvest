# ETL Schedule Info

## Purpose

Expose the cron-based ETL scheduler configuration so the dashboard can display the next scheduled run time.

## Requirements

### Requirement: Expose cron expression and next run

The backend MUST expose a method on `EtlSchedulerService` that returns the current cron expression from `CRON_SCHEDULE || ETL_CRON_SCHEDULE || '0 2 * * *'`, compute the next run date using `cron-parser`, and return `{ nextRun: Date | null; cronExpression: string; timezone: string }`.

#### Scenario: Valid cron expression

- GIVEN `CRON_SCHEDULE=0 */6 * * *`
- WHEN the schedule endpoint is consumed
- THEN `nextRun` contains a valid future Date
- AND `cronExpression` equals `"0 */6 * * *"`

#### Scenario: Invalid cron expression

- GIVEN `CRON_SCHEDULE=not-a-cron`
- WHEN the schedule endpoint is consumed
- THEN `nextRun` is null
- AND the response includes a warning

#### Scenario: Scheduler not running

- GIVEN the scheduler module fails registration at startup (e.g. invalid expression)
- WHEN the schedule endpoint is consumed
- THEN `nextRun` is null
- AND `cronExpression` returns the raw env value

### Requirement: Display next scheduled run in dashboard

The frontend MUST show a "Próxima ejecución programada" card on the ETL page displaying the next run date and the cron expression. `DashboardService` MUST add `getEtlSchedule()` returning the typed Observable.

#### Scenario: Card renders with valid schedule

- GIVEN the schedule endpoint returns a valid `nextRun`
- WHEN the ETL page renders
- THEN the card shows "Próxima ejecución programada: {formatted date}"
- AND the cron expression is visible as `"Cron: 0 2 * * *"`

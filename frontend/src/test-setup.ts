/**
 * Test setup para Vitest + Angular 22.
 * Inicializa TestBed antes de cualquier spec que lo use.
 */
import '@angular/localize/init';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
);
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { IntersectionObserverDirective } from './intersection-observer.directive';

@Component({
  standalone: true,
  imports: [IntersectionObserverDirective],
  template: `
    <div appIntersectionObserver (appIntersectionObserver)="onVisible()">Sentinel</div>
  `,
})
class TestHostComponent {
  visibleCount = 0;

  onVisible() {
    this.visibleCount++;
  }
}

describe('IntersectionObserverDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let mockObserver: { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  let observerCallback: (entries: Partial<IntersectionObserverEntry>[]) => void;

  beforeEach(() => {
    mockObserver = {
      observe: vi.fn(),
      disconnect: vi.fn(),
    };

    (window as any).IntersectionObserver = vi.fn().mockImplementation((cb) => {
      observerCallback = cb;
      return mockObserver;
    });

    TestBed.configureTestingModule({
      imports: [TestHostComponent],
    });

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('instantiates IntersectionObserver and observes host element', () => {
    expect(window.IntersectionObserver).toHaveBeenCalled();
    expect(mockObserver.observe).toHaveBeenCalled();
  });

  it('emits visible event when element intersects and is not disabled', () => {
    observerCallback([{ isIntersecting: true }]);
    expect(fixture.componentInstance.visibleCount).toBe(1);
  });

  it('does not emit visible event when disabled is true', () => {
    const directive = fixture.debugElement
      .query(By.directive(IntersectionObserverDirective))
      .injector.get(IntersectionObserverDirective);
    directive.disabled = true;

    observerCallback([{ isIntersecting: true }]);
    expect(fixture.componentInstance.visibleCount).toBe(0);
  });

  it('disconnects observer on destroy', () => {
    fixture.destroy();
    expect(mockObserver.disconnect).toHaveBeenCalled();
  });
});

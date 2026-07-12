import { TestBed } from '@angular/core/testing';
import { ConfirmModalComponent } from './confirm-modal.component';
import { vi } from 'vitest';

describe('ConfirmModalComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ConfirmModalComponent],
    });
  });

  it('should not render anything when isOpen is false', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.modal-backdrop')).toBeNull();
  });

  it('should render details when isOpen is true', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('title', 'Custom Title');
    fixture.componentRef.setInput('message', 'Custom Message');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.modal-backdrop')).toBeTruthy();
    expect(compiled.querySelector('h3')?.textContent).toContain('Custom Title');
    expect(compiled.querySelector('.modal-body p')?.textContent).toContain('Custom Message');
  });

  it('should emit confirm and cancel output events', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const confirmSpy = vi.fn();
    const cancelSpy = vi.fn();

    fixture.componentInstance.confirm.subscribe(confirmSpy);
    fixture.componentInstance.cancel.subscribe(cancelSpy);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    // Close button (x) is index 0, Cancel button is index 1, Confirm button is index 2
    buttons[1].click();
    expect(cancelSpy).toHaveBeenCalled();

    buttons[2].click();
    expect(confirmSpy).toHaveBeenCalled();
  });
});

import { TestBed } from '@angular/core/testing';
import { SeatingTableChipComponent } from './seating-table-chip.component';

describe('SeatingTableChipComponent', () => {
  it('renders a table assignment and its accessible label', () => {
    const fixture = TestBed.createComponent(SeatingTableChipComponent);
    fixture.componentRef.setInput('tableNumber', '12');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('12');
    expect(
      fixture.nativeElement.querySelector('[aria-label="Table 12"]')
    ).not.toBeNull();
  });

  it('renders the empty table state', () => {
    const fixture = TestBed.createComponent(SeatingTableChipComponent);
    fixture.componentRef.setInput('tableNumber', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No table');
  });

  it.each([
    ['tomorrow', 'bg-[#fef3c7]!'],
    ['expired', 'bg-(--mat-sys-error-container)!'],
  ] as const)(
    'applies the %s departure color to the chip',
    (status, colorClass) => {
      const fixture = TestBed.createComponent(SeatingTableChipComponent);
      fixture.componentRef.setInput('tableNumber', '12');
      fixture.componentRef.setInput('departureStatus', status);
      fixture.detectChanges();

      const chip = fixture.nativeElement.querySelector('mat-chip');
      expect(chip.classList.contains(colorClass)).toBe(true);
    }
  );
});

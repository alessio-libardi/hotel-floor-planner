import { TestBed } from '@angular/core/testing';
import { SeatingCheckedChipComponent } from './seating-checked-chip.component';

describe('SeatingCheckedChipComponent', () => {
  it('renders an accessible checked-today indicator', () => {
    const fixture = TestBed.createComponent(SeatingCheckedChipComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[aria-label="Checked today"]')
    ).not.toBeNull();
  });
});

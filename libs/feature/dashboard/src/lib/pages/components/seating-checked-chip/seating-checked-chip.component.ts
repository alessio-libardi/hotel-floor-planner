import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'lib-seating-checked-chip',
  imports: [MatChipsModule, MatIconModule],
  templateUrl: './seating-checked-chip.component.html',
  styleUrls: ['./seating-checked-chip.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeatingCheckedChipComponent {}

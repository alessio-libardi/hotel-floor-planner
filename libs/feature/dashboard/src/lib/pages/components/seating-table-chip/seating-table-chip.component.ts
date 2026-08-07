import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { RoomDepartureStatus } from '../../../room-departure-status';

@Component({
  selector: 'lib-seating-table-chip',
  imports: [MatChipsModule, MatIconModule],
  templateUrl: './seating-table-chip.component.html',
  styleUrls: ['./seating-table-chip.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeatingTableChipComponent {
  readonly tableNumber = input<string | null>(null);
  readonly departureStatus = input<RoomDepartureStatus>('none');
}

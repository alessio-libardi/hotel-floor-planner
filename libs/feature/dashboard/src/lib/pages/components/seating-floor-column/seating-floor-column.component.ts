import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { SeatingRoomRowComponent } from '../seating-room-row/seating-room-row.component';
import {
  SeatingFloorViewModel,
  SeatingRoomCheckChange,
  SeatingRoomViewModel,
} from '../../seating-page/seating-view-model';

@Component({
  selector: 'lib-seating-floor-column',
  imports: [MatCardModule, MatListModule, SeatingRoomRowComponent],
  templateUrl: './seating-floor-column.component.html',
  styleUrls: ['./seating-floor-column.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeatingFloorColumnComponent {
  readonly floor = input.required<SeatingFloorViewModel>();
  readonly roomSelected = output<SeatingRoomViewModel>();
  readonly roomCheckedChange = output<SeatingRoomCheckChange>();

  protected emitCheckedChange(
    room: SeatingRoomViewModel,
    checked: boolean
  ): void {
    this.roomCheckedChange.emit({ roomId: room.id, checked });
  }
}

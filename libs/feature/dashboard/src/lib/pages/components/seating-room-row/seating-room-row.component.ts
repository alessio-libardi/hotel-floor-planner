import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  input,
  output,
} from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { SeatingCheckedChipComponent } from '../seating-checked-chip/seating-checked-chip.component';
import { SeatingTableChipComponent } from '../seating-table-chip/seating-table-chip.component';
import { SeatingRoomViewModel } from '../../seating-page/seating-view-model';

export const DOUBLE_CLICK_DELAY_MS = 350;

@Component({
  selector: 'lib-seating-room-row',
  imports: [
    MatListModule,
    SeatingCheckedChipComponent,
    SeatingTableChipComponent,
  ],
  templateUrl: './seating-room-row.component.html',
  styleUrls: ['./seating-room-row.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeatingRoomRowComponent implements OnDestroy {
  readonly room = input.required<SeatingRoomViewModel>();
  readonly selected = output<void>();
  readonly checkedChange = output<boolean>();

  private selectionTimer: ReturnType<typeof setTimeout> | null = null;
  private lastClickAt: number | null = null;

  ngOnDestroy(): void {
    this.cancelPendingSelection();
    this.lastClickAt = null;
  }

  protected handleClick(event: MouseEvent): void {
    const now = Date.now();

    if (
      this.lastClickAt != null &&
      now - this.lastClickAt <= DOUBLE_CLICK_DELAY_MS
    ) {
      this.cancelPendingSelection();
      this.lastClickAt = null;
      event.preventDefault();
      event.stopPropagation();
      this.checkedChange.emit(!this.room().checkedToday);
      return;
    }

    this.cancelPendingSelection();
    this.lastClickAt = now;
    this.selectionTimer = setTimeout(() => {
      this.selectionTimer = null;
      this.lastClickAt = null;
      this.selected.emit();
    }, DOUBLE_CLICK_DELAY_MS);
  }

  private cancelPendingSelection(): void {
    if (this.selectionTimer != null) {
      clearTimeout(this.selectionTimer);
      this.selectionTimer = null;
    }
  }
}

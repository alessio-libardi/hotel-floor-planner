import { A11yModule } from '@angular/cdk/a11y';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'lib-layout-unlock-dialog',
  imports: [A11yModule, MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Enable layout editing?</h2>
    <mat-dialog-content>
      Tables can be moved, linked, resized, added, or deleted while editing is
      enabled.
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        [mat-dialog-close]="false"
        cdkFocusInitial
      >
        Cancel
      </button>
      <button mat-flat-button type="button" [mat-dialog-close]="true">
        Enable editing
      </button>
    </mat-dialog-actions>
  `,
})
export class LayoutUnlockDialogComponent {}

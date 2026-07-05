import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from '@util/auth';

@Component({
  selector: 'lib-shell',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
    MatListModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.css'],
})
export class ShellComponent {
  protected readonly authService = inject(AuthService);
  protected readonly user = toSignal(this.authService.user$, {
    initialValue: null,
  });
  protected readonly router = inject(Router);

  protected logout(): void {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/']);
    });
  }

  protected initials(displayName: string | null | undefined): string {
    if (!displayName?.trim()) {
      return 'U';
    }

    return displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((chunk) => chunk[0]?.toUpperCase() ?? '')
      .join('');
  }
}

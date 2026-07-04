import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { User } from 'firebase/auth';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly title = 'Hotel Floor Planner';
  protected readonly authUser = signal<User | null>(null);
  protected readonly loading = signal(true);
  protected readonly authBusy = signal(false);

  // constructor() {
  //   this.auth.user$.pipe(takeUntilDestroyed()).subscribe((user) => {
  //     this.authUser.set(user);
  //     if (this.loading()) {
  //       this.loading.set(false);
  //     }
  //     if (!user) {
  //       this.router.navigate(['/sign-in']);
  //     } else if (this.router.url === '/sign-in') {
  //       this.router.navigate(['/configure']);
  //     }
  //   });
  // }

  // protected async signOut(): Promise<void> {
  //   this.authBusy.set(true);
  //   try {
  //     await this.auth.signOut();
  //   } finally {
  //     this.authBusy.set(false);
  //   }
  // }
}

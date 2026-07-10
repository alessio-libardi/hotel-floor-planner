import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { LogoComponent } from '@ui/components';
import { AuthService } from '@util/auth';

interface ShellMenuItem {
  readonly route: string;
  readonly label: string;
}

@Component({
  selector: 'lib-shell',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    LogoComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.css'],
})
export class ShellComponent {
  protected readonly authService = inject(AuthService);
  protected readonly router = inject(Router);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly menuItems: readonly ShellMenuItem[] = [
    { route: 'setup', label: 'Setup' },
    { route: 'layout', label: 'Layout' },
    { route: 'seating', label: 'Seating' },
  ];

  protected readonly isSmallViewport = toSignal(
    this.breakpointObserver
      .observe('(max-width: 639.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false }
  );
  protected readonly isNavigationDrawerOpen = signal(false);

  protected readonly user = toSignal(this.authService.user$, {
    initialValue: null,
  });

  public constructor() {
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.isSmallViewport()) {
          this.closeNavigationMenu();
        }
      });

    effect(() => {
      if (!this.isSmallViewport() && this.isNavigationDrawerOpen()) {
        this.isNavigationDrawerOpen.set(false);
      }
    });
  }

  protected toggleNavigationMenu(): void {
    this.isNavigationDrawerOpen.update((isOpen) => !isOpen);
  }

  protected closeNavigationMenu(): void {
    this.isNavigationDrawerOpen.set(false);
  }

  protected onNavigationDrawerStateChange(isOpen: boolean): void {
    this.isNavigationDrawerOpen.set(isOpen);
  }

  protected logout(): void {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/auth/sign-in']);
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

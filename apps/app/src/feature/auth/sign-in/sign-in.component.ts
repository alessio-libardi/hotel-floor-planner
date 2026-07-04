import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../app/auth.service';
import {
  GoogleSignInButtonComponent,
  SignInAuthScreenComponent,
} from '@firebase-oss/ui-angular';

@Component({
  selector: 'app-sign-in',
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    GoogleSignInButtonComponent,
    SignInAuthScreenComponent,
  ],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
})
export class SignInComponent {
  private readonly auth = inject(AuthService);

  protected busy = false;
  protected error: string | null = null;

  protected async login(): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      await this.auth.login();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Sign-in failed.';
    } finally {
      this.busy = false;
    }
  }
}

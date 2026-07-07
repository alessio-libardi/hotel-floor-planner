import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  GoogleSignInButtonComponent,
  SignInAuthScreenComponent,
} from '@firebase-oss/ui-angular';
import { LogoComponent } from '@ui/components';

@Component({
  selector: 'feature-auth-sign-in',
  imports: [
    GoogleSignInButtonComponent,
    LogoComponent,
    SignInAuthScreenComponent,
  ],
  templateUrl: './sign-in-page.component.html',
  styleUrl: './sign-in-page.component.css',
})
export class SignInPageComponent {
  private readonly router = inject(Router);

  signIn() {
    this.router.navigate(['/']);
  }
}

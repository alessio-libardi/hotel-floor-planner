import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  GoogleSignInButtonComponent,
  SignInAuthScreenComponent,
} from '@firebase-oss/ui-angular';

@Component({
  selector: 'feature-auth-sign-in',
  imports: [GoogleSignInButtonComponent, SignInAuthScreenComponent],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
})
export class SignInComponent {
  private readonly router = inject(Router);

  signIn() {
    this.router.navigate(['/']);
  }
}

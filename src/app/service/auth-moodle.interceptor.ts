import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthMoodleService } from './auth-moodle.service';
import { Router } from '@angular/router';

/**
 * HTTP Interceptor do automatycznego dodawania tokena OAuth2 do requestów Moodle API
 */
export const authMoodleInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const authService = inject(AuthMoodleService);
  const router = inject(Router);

  // Sprawdź czy request idzie do Moodle API (nie do innych endpointów)
  if (!shouldInterceptRequest(req)) {
    return next(req);
  }

  // Dodaj token do requestu
  return from(authService.getAccessToken()).pipe(
    switchMap(token => {
      let authReq = req;

      if (token) {
        // Dodaj Authorization header z Bearer token
        authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
      }

      return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            // Token wygasł lub jest nieprawidłowy
            return from(handleUnauthorized(authService, router)).pipe(
              switchMap(() => throwError(() => error))
            );
          }
          return throwError(() => error);
        })
      );
    })
  );
};

/**
 * Sprawdza czy request powinien być interceptowany
 */
function shouldInterceptRequest(req: HttpRequest<any>): boolean {
  // Interceptuj tylko requesty do Moodle (ePortal PWr lub inne instancje)
  const url = req.url.toLowerCase();
  return url.includes('eportal.pwr.edu.pl') || 
         url.includes('/webservice/') ||
         url.includes('/login/token.php');
}

/**
 * Obsługuje błąd 401 Unauthorized
 */
async function handleUnauthorized(authService: AuthMoodleService, router: Router): Promise<void> {
  console.warn('Otrzymano 401 Unauthorized - próba odświeżenia tokena');
  
  // Spróbuj odświeżyć token
  const refreshed = await authService.refreshAccessToken();
  
  if (!refreshed) {
    // Nie udało się odświeżyć - wyloguj i przekieruj na moodle-selection
    console.error('Nie udało się odświeżyć tokena - wylogowywanie');
    await authService.logout();
    await router.navigate(['/moodle-selection']);
  }
}

<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ReadJwtFromCookie
{
    /**
     * Promote the HttpOnly jwt_token cookie to an Authorization header so that
     * the tymon/jwt-auth auth:api guard can validate it without any changes.
     *
     * This middleware runs before auth:api, so the guard always sees a standard
     * Bearer token regardless of whether the client sent a header or a cookie.
     * Only promotes the cookie when no Authorization header is already present,
     * so explicit Bearer tokens (e.g., from Postman or integration tests) still work.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->bearerToken()) {
            // Use the Symfony cookie bag to read the raw (unencrypted) cookie value.
            // API routes do not run EncryptCookies middleware, so the value is the
            // plain JWT string exactly as the AuthController wrote it.
            $token = $request->cookies->get('jwt_token');

            if ($token) {
                $request->headers->set('Authorization', 'Bearer ' . $token);
            }
        }

        return $next($request);
    }
}

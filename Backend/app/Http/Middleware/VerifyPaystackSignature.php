<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyPaystackSignature
{
    public function handle(Request $request, Closure $next): Response
    {
        $signature = $request->header('x-paystack-signature');

        if (! $signature) {
            abort(401, 'Missing Paystack signature.');
        }

        $computed = hash_hmac('sha512', $request->getContent(), env('PAYSTACK_SECRET_KEY'));

        if (! hash_equals($computed, $signature)) {
            abort(401, 'Invalid Paystack signature.');
        }

        return $next($request);
    }
}

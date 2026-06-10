<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Enum;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role'     => ['sometimes', 'string', new Enum(UserRole::class)],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::create($validator->validated());

        $token = auth('api')->login($user);

        return $this->respondWithToken($token);
    }

    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email'    => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $token = auth('api')->attempt($validator->validated());

        if (! $token) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        return $this->respondWithToken($token);
    }

    public function logout(): JsonResponse
    {
        auth('api')->logout();

        return response()
            ->json(['message' => 'Successfully logged out'])
            ->withCookie(cookie()->forget('jwt_token'));
    }

    public function refresh(): JsonResponse
    {
        return $this->respondWithToken(auth('api')->refresh());
    }

    public function me(): JsonResponse
    {
        return response()->json(auth('api')->user());
    }

    private function respondWithToken(string $token): JsonResponse
    {
        return response()
            ->json([
                'access_token' => $token,
                'token_type'   => 'bearer',
                'expires_in'   => auth('api')->factory()->getTTL() * 60,
                'user'         => auth('api')->user(),
            ])
            ->cookie(
                'jwt_token',
                $token,
                auth('api')->factory()->getTTL() * 60, // minutes
                '/',         // path
                null,        // domain — current domain
                app()->isProduction(), // secure — HTTPS only in production
                true,        // httpOnly — not accessible via JavaScript
                false,       // raw — URL-encode the value
                'Strict',    // sameSite
            );
    }
}

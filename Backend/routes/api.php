<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PaystackController;
use App\Http\Controllers\RecommendTruckController;
use App\Http\Controllers\ShipmentAnalysisController;
use App\Http\Controllers\ShipmentController;
use App\Http\Controllers\TruckController;
use App\Http\Middleware\VerifyPaystackSignature;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('health', function () {
    // Verify database connectivity
    try {
        DB::connection()->getPdo();
        $database = 'connected';
    } catch (\Throwable) {
        return response()->json([
            'status'    => 'unhealthy',
            'timestamp' => now()->toIso8601String(),
            'services'  => [
                'database' => 'disconnected',
                'cache'    => 'unknown',
            ],
        ], 500);
    }

    // Verify cache read/write
    try {
        Cache::put('health_probe', true, 5);
        $cache = Cache::get('health_probe') === true ? 'operational' : 'degraded';
    } catch (\Throwable) {
        $cache = 'degraded';
    }

    return response()->json([
        'status'    => 'healthy',
        'timestamp' => now()->toIso8601String(),
        'services'  => [
            'database' => $database,
            'cache'    => $cache,
        ],
    ]);
});

Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login',    [AuthController::class, 'login']);
});

Route::middleware('auth:api')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('logout',  [AuthController::class, 'logout']);
        Route::post('refresh', [AuthController::class, 'refresh']);
        Route::get('me',       [AuthController::class, 'me']);
    });

    Route::apiResource('trucks',    TruckController::class);
    Route::post('trucks/{truck}/accept/{shipment}', [TruckController::class, 'acceptShipment']);

    // Must be declared before apiResource so 'recommend-truck' is not swallowed by {shipment}
    Route::post('shipments/recommend-truck', [RecommendTruckController::class, 'recommend']);
    Route::apiResource('shipments', ShipmentController::class);

    Route::post('paystack/initiate', [PaystackController::class, 'initiate']);

    Route::get('shipments/{shipment}/analyze', [ShipmentAnalysisController::class, 'analyze']);
});

Route::post('paystack/webhook', [PaystackController::class, 'webhook'])
    ->middleware(VerifyPaystackSignature::class);

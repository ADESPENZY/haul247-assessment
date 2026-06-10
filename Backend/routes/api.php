<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PaystackController;
use App\Http\Controllers\RecommendTruckController;
use App\Http\Controllers\ShipmentTrackingController;
use App\Http\Controllers\ShipmentAnalysisController;
use App\Http\Controllers\ShipmentController;
use App\Http\Controllers\TruckController;
use App\Http\Middleware\VerifyPaystackSignature;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('health', function () {
    try {
        DB::connection()->getPdo();
        $database = 'connected';
    } catch (\Throwable) {
        return response()->json([
            'status'    => 'unhealthy',
            'timestamp' => now()->toIso8601String(),
            'services'  => ['database' => 'disconnected', 'cache' => 'unknown'],
        ], 500);
    }

    try {
        Cache::put('health_probe', true, 5);
        $cache = Cache::get('health_probe') === true ? 'operational' : 'degraded';
    } catch (\Throwable) {
        $cache = 'degraded';
    }

    return response()->json([
        'status'    => 'healthy',
        'timestamp' => now()->toIso8601String(),
        'services'  => ['database' => $database, 'cache' => $cache],
    ]);
});

// ── Public auth routes — rate-limited to 5 requests/minute per IP ─────────────
Route::prefix('auth')->middleware('throttle:5,1')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login',    [AuthController::class, 'login']);
});

// ── Authenticated routes ───────────────────────────────────────────────────────
Route::middleware('auth:api')->group(function () {

    Route::prefix('auth')->group(function () {
        Route::post('logout',  [AuthController::class, 'logout']);
        Route::post('refresh', [AuthController::class, 'refresh']);
        Route::get('me',       [AuthController::class, 'me']);
    });

    // Truck management — create/read/update open to operators; delete is admin-only
    Route::apiResource('trucks', TruckController::class)->except(['destroy']);
    Route::delete('trucks/{truck}', [TruckController::class, 'destroy'])
        ->middleware('role:admin');
    Route::post('trucks/{truck}/accept/{shipment}', [TruckController::class, 'acceptShipment']);

    // Shipment routes — delete is admin-only
    Route::post('shipments/recommend-truck', [RecommendTruckController::class, 'recommend']);
    Route::apiResource('shipments', ShipmentController::class)->except(['destroy']);
    Route::delete('shipments/{shipment}', [ShipmentController::class, 'destroy'])
        ->middleware('role:admin');

    Route::get('shipments/{shipment}/tracking', [ShipmentTrackingController::class, 'show']);
    Route::get('shipments/{shipment}/analyze',  [ShipmentAnalysisController::class, 'analyze']);

    // Payment initiation — rate-limited to 10 requests/minute per IP
    Route::post('paystack/initiate', [PaystackController::class, 'initiate'])
        ->middleware('throttle:10,1');
});

// ── Paystack webhook — public but HMAC-verified ────────────────────────────────
Route::post('paystack/webhook', [PaystackController::class, 'webhook'])
    ->middleware(VerifyPaystackSignature::class);

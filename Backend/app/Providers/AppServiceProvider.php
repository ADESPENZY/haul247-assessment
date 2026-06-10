<?php

namespace App\Providers;

use App\Models\Shipment;
use App\Models\Truck;
use App\Observers\AuditObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Truck::observe(AuditObserver::class);
        Shipment::observe(AuditObserver::class);
    }
}

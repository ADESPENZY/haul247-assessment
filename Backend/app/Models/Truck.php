<?php

namespace App\Models;

use App\Enums\TruckStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Truck extends Model
{
    use HasFactory;

    protected $fillable = [
        'license_plate',
        'capacity_kg',
        'status',
        'current_location',
    ];

    protected function casts(): array
    {
        return [
            'status' => TruckStatus::class,
        ];
    }

    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class);
    }
}

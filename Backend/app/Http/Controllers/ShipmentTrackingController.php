<?php

namespace App\Http\Controllers;

use App\Models\Shipment;
use Illuminate\Http\JsonResponse;

class ShipmentTrackingController extends Controller
{
    public function show(Shipment $shipment): JsonResponse
    {
        $shipment->load(['auditLogs.user', 'truck', 'user']);

        $timeline = $shipment->auditLogs
            ->sortBy('created_at')
            ->map(function ($log) {
                $old = $log->old_values ?? [];
                $new = $log->new_values ?? [];

                // Build a human-readable description from the changed fields
                $changes = [];
                foreach ($new as $field => $newVal) {
                    $oldVal = $old[$field] ?? null;
                    if ($oldVal !== null && $oldVal !== $newVal) {
                        $changes[] = "{$field}: {$oldVal} → {$newVal}";
                    } elseif ($oldVal === null) {
                        $changes[] = "{$field} set to {$newVal}";
                    }
                }

                return [
                    'timestamp'   => $log->created_at->toIso8601String(),
                    'event'       => $log->action,
                    'description' => $changes ? implode(', ', $changes) : ucfirst($log->action),
                    'changed_by'  => $log->user?->name ?? 'System',
                    'changes'     => ['from' => $old, 'to' => $new],
                ];
            })
            ->values();

        return response()->json([
            'shipment' => [
                'id'             => $shipment->id,
                'tracking_number'=> $shipment->tracking_number,
                'origin'         => $shipment->origin,
                'destination'    => $shipment->destination,
                'weight_kg'      => $shipment->weight_kg,
                'status'         => $shipment->status,
                'truck'          => $shipment->truck ? [
                    'license_plate'    => $shipment->truck->license_plate,
                    'current_location' => $shipment->truck->current_location,
                ] : null,
            ],
            'timeline' => $timeline,
        ]);
    }
}

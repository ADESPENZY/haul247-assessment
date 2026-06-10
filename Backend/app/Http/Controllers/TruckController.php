<?php

namespace App\Http\Controllers;

use App\Enums\ShipmentStatus;
use App\Enums\TruckStatus;
use App\Models\Shipment;
use App\Models\Truck;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Enum;

class TruckController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Truck::paginate(15));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'license_plate'    => ['required', 'string', 'unique:trucks,license_plate'],
            'capacity_kg'      => ['required', 'integer', 'min:1'],
            'status'           => ['sometimes', new Enum(TruckStatus::class)],
            'current_location' => ['sometimes', 'string', 'max:255'],
        ]);

        $truck = Truck::create($validated);

        return response()->json($truck, 201);
    }

    public function show(Truck $truck): JsonResponse
    {
        return response()->json($truck);
    }

    public function update(Request $request, Truck $truck): JsonResponse
    {
        $validated = $request->validate([
            'license_plate'    => ['sometimes', 'string', 'unique:trucks,license_plate,' . $truck->id],
            'capacity_kg'      => ['sometimes', 'integer', 'min:1'],
            'status'           => ['sometimes', new Enum(TruckStatus::class)],
            'current_location' => ['sometimes', 'string', 'max:255'],
        ]);

        $truck->update($validated);

        return response()->json($truck);
    }

    public function destroy(Truck $truck): JsonResponse
    {
        $truck->delete();

        return response()->json(null, 204);
    }

    /**
     * Accept a pending shipment on behalf of this truck.
     * Sets shipment → assigned, truck → assigned.
     */
    public function acceptShipment(Truck $truck, Shipment $shipment): JsonResponse
    {
        if ($truck->status !== TruckStatus::Available) {
            return response()->json(['message' => 'Truck is not available.'], 422);
        }

        $acceptableStatuses = [ShipmentStatus::Pending, ShipmentStatus::Paid];
        if (! in_array($shipment->status, $acceptableStatuses, true)) {
            return response()->json(['message' => 'Shipment is not available for assignment.'], 422);
        }

        $shipment->update([
            'truck_id' => $truck->id,
            'status'   => ShipmentStatus::Assigned,
        ]);

        $truck->update(['status' => TruckStatus::Assigned]);

        return response()->json($shipment->load(['user', 'truck']));
    }
}

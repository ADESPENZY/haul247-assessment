<?php

namespace App\Http\Controllers;

use App\Models\Shipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;

class ShipmentAnalysisController extends Controller
{
    public function analyze(Shipment $shipment): JsonResponse
    {
        $shipment->load(['auditLogs', 'truck']);

        $auditSummary = $shipment->auditLogs->isEmpty()
            ? 'No audit history recorded.'
            : $shipment->auditLogs
                ->map(fn ($log) => "[{$log->created_at}] {$log->event}: " . json_encode($log->changes))
                ->implode("\n");

        $truckPlate    = $shipment->truck?->license_plate    ?? 'Unassigned';
        $truckLocation = $shipment->truck?->current_location ?? 'Unknown';
        $truckCapacity = $shipment->truck ? $shipment->truck->capacity_kg . ' kg' : 'N/A';

        $prompt = <<<PROMPT
Analyze this freight shipment's status and tracking history. Return a strictly formatted JSON response with two keys: "risk_level" (Low, Medium, High) and "assessment" (a 2-sentence explanation of whether it is on-track, delayed, or off-route).

Shipment Details:
- Tracking Number: {$shipment->tracking_number}
- Origin: {$shipment->origin}
- Destination: {$shipment->destination}
- Weight: {$shipment->weight_kg} kg
- Current Status: {$shipment->status->value}
- Created At: {$shipment->created_at}

Assigned Truck:
- License Plate: {$truckPlate}
- Truck Capacity: {$truckCapacity}
- Truck Current Location: {$truckLocation}

Audit Log:
{$auditSummary}
PROMPT;

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . env('OPENAI_API_KEY'),
                'Content-Type'  => 'application/json',
            ])->post('https://api.openai.com/v1/chat/completions', [
                'model'      => 'gpt-4o',
                'max_tokens' => 1024,
                'messages'   => [
                    ['role' => 'user', 'content' => $prompt],
                ],
            ]);

            if ($response->failed()) {
                return response()->json([
                    'message' => 'AI analysis service unavailable.',
                    'error'   => $response->json('error.message'),
                ], 503);
            }

            $text = $response->json('choices.0.message.content');

            // Strip markdown code fences the model sometimes wraps around JSON
            $clean = preg_replace('/^```(?:json)?\s*/i', '', trim($text));
            $clean = preg_replace('/\s*```$/i', '', $clean);

            $analysis = json_decode(trim($clean), true);

            if (json_last_error() !== JSON_ERROR_NONE || ! isset($analysis['risk_level'], $analysis['assessment'])) {
                return response()->json([
                    'message' => 'AI returned an unexpected response format.',
                    'raw'     => $text,
                ], 502);
            }

            return response()->json([
                'shipment_id'     => $shipment->id,
                'tracking_number' => $shipment->tracking_number,
                'risk_level'      => $analysis['risk_level'],
                'assessment'      => $analysis['assessment'],
            ]);

        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Failed to connect to the AI analysis service.',
                'error'   => $e->getMessage(),
            ], 503);
        }
    }
}

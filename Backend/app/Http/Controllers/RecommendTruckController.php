<?php

namespace App\Http\Controllers;

use App\Enums\TruckStatus;
use App\Models\Truck;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class RecommendTruckController extends Controller
{
    public function recommend(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'origin'      => ['required', 'string', 'max:255'],
            'destination' => ['required', 'string', 'max:255'],
            'weight_kg'   => ['required', 'integer', 'min:1'],
        ]);

        $trucks = Truck::where('status', TruckStatus::Available)->get();

        if ($trucks->isEmpty()) {
            return response()->json(['message' => 'No available trucks in the fleet.'], 422);
        }

        $truckList = $trucks->map(fn ($t) =>
            "  - ID: {$t->id} | Plate: {$t->license_plate} | Capacity: {$t->capacity_kg} kg | Current Location: {$t->current_location}"
        )->implode("\n");

        $prompt = <<<PROMPT
A new freight shipment needs to be dispatched:
- Origin: {$validated['origin']}
- Destination: {$validated['destination']}
- Weight: {$validated['weight_kg']} kg

Available trucks (all currently idle):
{$truckList}

Selection criteria (apply in this order):
1. Proximity — prefer trucks whose current location is in or near the shipment origin city or state.
2. Capacity fit — among close trucks, prefer the one whose capacity most closely covers the load without large surplus (minimise dead weight).
3. If all trucks are equidistant, choose purely on capacity fit.

Respond with ONLY a JSON object — no markdown, no explanation outside the JSON:
{"truck_id": <integer>, "justification": "<one concise sentence explaining the selection>"}
PROMPT;

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . env('OPENAI_API_KEY'),
                'Content-Type'  => 'application/json',
            ])->post('https://api.openai.com/v1/chat/completions', [
                'model'      => 'gpt-4o',
                'max_tokens' => 256,
                'messages'   => [
                    [
                        'role'    => 'system',
                        'content' => 'You are an automated Dispatch Routing Assistant. You always respond with valid JSON only — never markdown fences, never prose outside the JSON object.',
                    ],
                    [
                        'role'    => 'user',
                        'content' => $prompt,
                    ],
                ],
            ]);

            if ($response->failed()) {
                return response()->json([
                    'message' => 'AI recommendation service unavailable.',
                    'error'   => $response->json('error.message'),
                ], 503);
            }

            $text  = $response->json('choices.0.message.content');
            $clean = preg_replace('/^```(?:json)?\s*/i', '', trim($text));
            $clean = preg_replace('/\s*```$/i', '', $clean);

            $result = json_decode(trim($clean), true);

            if (json_last_error() !== JSON_ERROR_NONE || ! isset($result['truck_id'], $result['justification'])) {
                return response()->json(['message' => 'AI returned an unexpected format.', 'raw' => $text], 502);
            }

            // Guard: ensure the returned ID is actually in our available list
            $truck = $trucks->firstWhere('id', (int) $result['truck_id']);
            if (! $truck) {
                return response()->json(['message' => 'AI recommended an unavailable truck.'], 422);
            }

            return response()->json([
                'truck_id'      => (int) $result['truck_id'],
                'justification' => $result['justification'],
                'truck'         => [
                    'license_plate'    => $truck->license_plate,
                    'capacity_kg'      => $truck->capacity_kg,
                    'current_location' => $truck->current_location,
                ],
            ]);

        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Failed to connect to the AI recommendation service.',
                'error'   => $e->getMessage(),
            ], 503);
        }
    }
}

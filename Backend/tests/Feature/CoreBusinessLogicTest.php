<?php

namespace Tests\Feature;

use App\Enums\ShipmentStatus;
use App\Enums\UserRole;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CoreBusinessLogicTest extends TestCase
{
    use RefreshDatabase;

    // -------------------------------------------------------------------------
    // Auth & Booking
    // -------------------------------------------------------------------------

    public function test_authenticated_user_can_create_a_shipment(): void
    {
        $user = User::create([
            'name'     => 'Test Operator',
            'email'    => 'operator@test.com',
            'password' => 'secret',
            'role'     => UserRole::Operator,
        ]);

        $response = $this->actingAs($user, 'api')
            ->postJson('/api/shipments', [
                'origin'      => 'Lagos',
                'destination' => 'Abuja',
                'weight_kg'   => 500,
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['id', 'tracking_number', 'origin', 'destination', 'weight_kg', 'status'])
            ->assertJson([
                'origin'      => 'Lagos',
                'destination' => 'Abuja',
                'weight_kg'   => 500,
                'status'      => 'pending',
            ]);

        $this->assertDatabaseHas('shipments', [
            'user_id'     => $user->id,
            'origin'      => 'Lagos',
            'destination' => 'Abuja',
        ]);
    }

    // -------------------------------------------------------------------------
    // Webhook Security — Failure Cases
    // -------------------------------------------------------------------------

    public function test_webhook_is_rejected_when_signature_header_is_missing(): void
    {
        $response = $this->postJson('/api/paystack/webhook', [
            'event' => 'charge.success',
            'data'  => [],
        ]);

        $response->assertStatus(401);
    }

    public function test_webhook_is_rejected_when_signature_is_invalid(): void
    {
        $response = $this->postJson('/api/paystack/webhook', [
            'event' => 'charge.success',
            'data'  => [],
        ], ['x-paystack-signature' => 'tampered-signature-value']);

        $response->assertStatus(401);
    }

    // -------------------------------------------------------------------------
    // Webhook Security — Success Case
    // -------------------------------------------------------------------------

    public function test_webhook_with_valid_hmac_returns_200_and_marks_shipment_paid(): void
    {
        $secret = 'test-paystack-secret';
        putenv("PAYSTACK_SECRET_KEY={$secret}");
        $_ENV['PAYSTACK_SECRET_KEY'] = $secret;

        $user = User::create([
            'name'     => 'Shipper',
            'email'    => 'shipper@test.com',
            'password' => 'secret',
            'role'     => UserRole::Operator,
        ]);

        $shipment = Shipment::create([
            'tracking_number' => 'SHP-WEBHOOKTEST01',
            'user_id'         => $user->id,
            'origin'          => 'Lagos',
            'destination'     => 'Kano',
            'weight_kg'       => 200,
            'status'          => ShipmentStatus::Pending,
        ]);

        $body = json_encode([
            'event' => 'charge.success',
            'data'  => [
                'reference' => 'PAY-SHP-WEBHOOKTEST01-ABCD1234',
                'metadata'  => [
                    'shipment_id' => $shipment->id,
                ],
            ],
        ]);

        $signature = hash_hmac('sha512', $body, $secret);

        // Use $this->call() with raw body so $request->getContent() matches
        // exactly what was signed — postJson() re-encodes and may differ.
        $response = $this->call('POST', '/api/paystack/webhook', [], [], [], [
            'HTTP_X_PAYSTACK_SIGNATURE' => $signature,
            'CONTENT_TYPE'              => 'application/json',
            'HTTP_ACCEPT'               => 'application/json',
        ], $body);

        $response->assertStatus(200);

        $this->assertDatabaseHas('shipments', [
            'id'     => $shipment->id,
            'status' => 'paid',
        ]);
    }
}

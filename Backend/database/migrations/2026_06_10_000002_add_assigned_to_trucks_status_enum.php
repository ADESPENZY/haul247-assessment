<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE trucks MODIFY COLUMN status ENUM('available', 'assigned', 'in-transit', 'maintenance') NOT NULL DEFAULT 'available'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE trucks MODIFY COLUMN status ENUM('available', 'in-transit', 'maintenance') NOT NULL DEFAULT 'available'");
    }
};

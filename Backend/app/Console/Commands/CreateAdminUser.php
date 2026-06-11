<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CreateAdminUser extends Command
{
    protected $signature   = 'admin:create';
    protected $description = 'Create a platform administrator account';

    public function handle(): int
    {
        $this->info('');
        $this->info('  Haul247 — Create Admin User');
        $this->info('  ───────────────────────────');
        $this->info('');

        $name = $this->ask('Full name');

        $email = $this->ask('Email address');

        $emailValidation = Validator::make(['email' => $email], [
            'email' => ['required', 'email', 'unique:users,email'],
        ]);

        if ($emailValidation->fails()) {
            $this->error('  ' . $emailValidation->errors()->first('email'));
            return self::FAILURE;
        }

        $password = $this->secret('Password (min 8 characters)');

        if (strlen($password) < 8) {
            $this->error('  Password must be at least 8 characters.');
            return self::FAILURE;
        }

        $confirm = $this->secret('Confirm password');

        if ($password !== $confirm) {
            $this->error('  Passwords do not match.');
            return self::FAILURE;
        }

        $user = User::create([
            'name'     => $name,
            'email'    => $email,
            'password' => $password,
            'role'     => UserRole::Admin,
        ]);

        $this->info('');
        $this->info("  Admin account created successfully.");
        $this->table(
            ['Field', 'Value'],
            [
                ['Name',  $user->name],
                ['Email', $user->email],
                ['Role',  $user->role->value],
            ]
        );
        $this->info('');

        return self::SUCCESS;
    }
}

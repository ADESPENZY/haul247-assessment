<?php

namespace App\Observers;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class AuditObserver
{
    public function updated(Model $model): void
    {
        $changes = $model->getChanges();

        if (empty($changes)) {
            return;
        }

        AuditLog::create([
            'user_id'        => Auth::id(),
            'auditable_type' => get_class($model),
            'auditable_id'   => $model->getKey(),
            'action'         => 'updated',
            'old_values'     => array_intersect_key($model->getOriginal(), $changes),
            'new_values'     => $changes,
        ]);
    }
}

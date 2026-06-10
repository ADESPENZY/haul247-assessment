<?php

namespace App\Enums;

enum TruckStatus: string
{
    case Available   = 'available';
    case Assigned    = 'assigned';
    case InTransit   = 'in-transit';
    case Maintenance = 'maintenance';
}

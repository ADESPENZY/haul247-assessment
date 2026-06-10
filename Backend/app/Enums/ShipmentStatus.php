<?php

namespace App\Enums;

enum ShipmentStatus: string
{
    case Pending   = 'pending';
    case Paid      = 'paid';
    case Assigned  = 'assigned';
    case InTransit = 'in-transit';
    case Delivered = 'delivered';
}

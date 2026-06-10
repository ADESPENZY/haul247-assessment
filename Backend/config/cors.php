<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | supports_credentials must be true so the browser will accept Set-Cookie
    | headers and send credentials (Authorization header / cookies) on
    | cross-origin requests from the Next.js dev server.
    |
    | NOTE: when supports_credentials is true, allowed_origins must list
    | explicit origins — '*' is not permitted by the CORS spec.
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'http://localhost:3000',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];

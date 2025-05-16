<?php
// api/get_weather.php

// Strict types help catch type errors
declare(strict_types=1);

// Include configuration containing API key and coordinates
require_once 'db_config.php';
require_once 'utils.php';

// Set response type to JSON
header('Content-Type: application/json');


/**
 * Fetches weather data from OpenWeatherMap API using cURL.
 *
 * @param string $apiKey OpenWeatherMap API Key.
 * @param string $city city.
 * @param string $country country.
 * @param string $lang Language code (e.g., 'en', 'fr').
 * @param int $timeout Request timeout in seconds.
 * @return array ['success' => bool, 'data' => ?array, 'error' => ?string]
 */
function fetchWeatherDataFromApi(string $apiKey, string $city, string $country, string $lang, int $timeout = 10): array {
    $apiUrl = "https://api.openweathermap.org/data/2.5/weather?q={$city},{$country}&lang={$lang}&units=metric&appid={$apiKey}";

    $ch = curl_init();

    curl_setopt_array($ch, [
        CURLOPT_URL            => $apiUrl,
        CURLOPT_RETURNTRANSFER => true,  // Return response as string
        CURLOPT_TIMEOUT        => $timeout, // Timeout for the request
        CURLOPT_CONNECTTIMEOUT => 5,     // Timeout for establishing connection
        CURLOPT_FAILONERROR    => false, // Don't fail automatically on HTTP error codes > 400 (we handle manually)
        CURLOPT_SSL_VERIFYPEER => true,  // Recommended for production
        CURLOPT_SSL_VERIFYHOST => 2,    // Recommended for production
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json' // Ask API for JSON response
        ]
    ]);

    $responseJson = curl_exec($ch);
    $httpStatusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErrorNo = curl_errno($ch);
    $curlError = curl_error($ch);

    curl_close($ch);

    // --- Handle cURL Errors ---
    if ($curlErrorNo !== CURLE_OK) {
        error_log("cURL Error fetching weather: (#{$curlErrorNo}) {$curlError}");
        return ['success' => false, 'data' => null, 'error' => "Failed to connect to weather service (cURL: {$curlErrorNo})."];
    }

    // --- Handle Non-JSON or Empty Response ---
    if ($responseJson === null || $responseJson === '') {
         error_log("Empty response received from weather API. HTTP Status: {$httpStatusCode}");
         return ['success' => false, 'data' => null, 'error' => "Empty response from weather service."];
    }

    // --- Decode JSON Response ---
    $responseData = json_decode($responseJson, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("Failed to decode weather API JSON response. Error: " . json_last_error_msg() . ". Raw: " . substr($responseJson, 0, 100));
        return ['success' => false, 'data' => null, 'error' => "Invalid format received from weather service."];
    }

    // OpenWeatherMap uses 'cod' for status. 200 is success.
    if (!isset($responseData['cod']) || $responseData['cod'] != 200) {
        $apiErrorMessage = isset($responseData['message']) ? $responseData['message'] : 'Unknown API error';
        error_log("Weather API Error: (" . (isset($responseData['cod']) ? $responseData['cod'] : 'N/A') . ") {$apiErrorMessage}");
        return ['success' => false, 'data' => null, 'error' => "{$apiErrorMessage}"];
    }

    // --- Check for essential data fields ---
    if (!isset($responseData['main']['temp']) || !isset($responseData['weather'][0]['description'])) {
        error_log("Incomplete weather data received: " . $responseJson);
        return ['success' => false, 'data' => null, 'error' => "Incomplete weather data received."];
    }

    // --- Success ---
    return [
        'success' => true,
        'data' => [ // Extract only the needed fields
            'temp'        => $responseData['main']['temp'], // Keep raw temp, rounding is presentation concern
            'description' => $responseData['weather'][0]['description'],
            'icon'        => isset($responseData['weather'][0]['icon']) ?  $responseData['weather'][0]['icon'] : null, // Use null coalesce for safety
        ],
        'error' => null
    ];
}

if (!defined('WEATHER_API_KEY') || WEATHER_API_KEY === '' || WEATHER_API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY_HERE') {
    error_log("Weather API configuration missing or invalid in db_config.php");
    echo buildErrorResponse("Weather service not configured on server.", 503); // 503 Service Unavailable
    exit;
}

// Get language from request, default to 'fr'
$allowed_langs = ['en', 'fr', 'de', 'it', 'pt'];
$lang_input = filter_input(INPUT_GET, 'lang', FILTER_SANITIZE_SPECIAL_CHARS); // Sanitize input
$lang = ($lang_input !== null && in_array($lang_input, $allowed_langs)) ? $lang_input : 'fr';

$city = filter_input(INPUT_GET, 'city', FILTER_SANITIZE_SPECIAL_CHARS); // Sanitize input
$country = filter_input(INPUT_GET, 'country', FILTER_SANITIZE_SPECIAL_CHARS); // Sanitize input

if ($city === null) {$city = 'Geneva';}
if ($country === null) {$country = 'CH';}

// Fetch data using the helper function
$result = fetchWeatherDataFromApi(WEATHER_API_KEY, $city, $country, $lang);

// Build and output the final JSON response
if ($result['success']) {
    echo buildSuccessResponse($result['data']);
} else {
    echo buildErrorResponse(isset($result['error']) ? $result['error'] : 'An unknown error occurred while fetching weather.');
}

exit; // Explicitly exit

?>

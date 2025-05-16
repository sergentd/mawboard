<?php
// api/get_ads.php

declare(strict_types=1);

require_once 'utils.php';
require_once 'db_config.php';

// ini_set('display_errors', "1");
// error_reporting(E_ALL);

// Set response type to JSON
header('Content-Type: application/json');

// --- Configuration ---
define('AD_PROXY_SCRIPT_PATH', 'api/get_ad_image.php');

// --- Main Logic ---

// Check if INI file exists and is readable
if (!is_readable(AD_INI_FILE_PATH)) {
    error_log("Ad INI file not found or not readable: " . AD_INI_FILE_PATH);
    echo buildErrorResponse("Ad configuration file not found.", 500);
    exit;
}

// Parse the INI file
// Use parse_ini_file with sections and preserve types if needed
$adsConfig = parse_ini_file(AD_INI_FILE_PATH, true, INI_SCANNER_TYPED); // INI_SCANNER_TYPED attempts type conversion

if ($adsConfig === false) {
    error_log("Failed to parse Ad INI file: " . AD_INI_FILE_PATH);
    echo buildErrorResponse("Could not read ad configuration.", 500);
    exit;
}

// --- Filter Ads Based on Current Time/Date ---
$activeAds = [];
$now = time(); // Current Unix timestamp
$currentDate = date('Ymd', $now); // YYYYMMDD format for comparison
$currentDayOfWeek = date('N', $now); // 1 (Mon) to 7 (Sun)
$currentTime = date('His', $now); // HHMMSS format for comparison (ignore milliseconds for simplicity)

// Loop through sections, skipping [GENERAL]
foreach ($adsConfig as $section => $ad) {
    // Skip non-numeric sections (like GENERAL) or sections missing required fields
    if (!is_numeric($section) || empty($ad['NOM']) || !isset($ad['DEBUT'], $ad['FIN'], $ad['DU'], $ad['AU'], $ad['DE'], $ad['A'], $ad['PAUSE'])) {
        continue;
    }

    // --- Validate Date/Time Ranges ---
    $debutDate = (string)($ad['DEBUT'] ?? '0');
    $finDate = (string)($ad['FIN'] ?? '99999999');
    $duDay = (int)($ad['DU'] ?? 1);
    $auDay = (int)($ad['AU'] ?? 7);
    // Pad times with leading zeros if needed for comparison
    $deTime = str_pad((string)($ad['DE'] ?? '0'), 9, '0', STR_PAD_LEFT); // HHMMSSsss format
    $aTime = str_pad((string)($ad['A'] ?? '235900000'), 9, '0', STR_PAD_LEFT);
     // Extract HHMMSS from the 9-digit format for comparison
    $deTimeCompare = substr($deTime, 0, 6);
    $aTimeCompare = substr($aTime, 0, 6);

    // Check Date Range
    if ($currentDate < $debutDate || $currentDate > $finDate) {
        continue; // Ad is not within the active date range
    }

    // Check Day of Week Range (Handles wrap-around e.g., Fri-Mon)
    $inDayRange = false;
    if ($duDay <= $auDay) { // Normal range (e.g., Mon-Fri)
         if ($currentDayOfWeek >= $duDay && $currentDayOfWeek <= $auDay) {
            $inDayRange = true;
         }
    } else { // Wraparound range (e.g., Fri-Mon)
         if ($currentDayOfWeek >= $duDay || $currentDayOfWeek <= $auDay) {
            $inDayRange = true;
         }
    }
    if (!$inDayRange) {
        continue; // Not active today
    }

     // Check Time Range
     if ($currentTime < $deTimeCompare || $currentTime > $aTimeCompare) {
          continue; // Outside active time range
     }

    // --- Ad is Active - Prepare for Response ---
    $filename = trim((string)$ad['NOM']);
    $durationSeconds = (int)(isset($ad['PAUSE']) ? $ad['PAUSE'] : 10); // Default to 10 seconds if missing

    // Determine file type (basic check based on extension)
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $type = 'unknown';
    if (in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'svg'])) {
        $type = 'image';
    } elseif (in_array($extension, ['mp4', 'webm', 'ogg'])) {
        $type = 'video';
    } elseif ($extension === 'pdf') {
        $type = 'pdf';
    }

    if ($type !== 'unknown') {
        $proxyUrl = AD_PROXY_SCRIPT_PATH . '?file=' . urlencode($filename);
        $activeAds[] = [
            'type' => $type,
            'src' => $proxyUrl, // Combine base path and filename
            'duration' => $durationSeconds * 1000 // Convert seconds to milliseconds for JS
            // Add other relevant fields if needed, like options for video
        ];
    } else {
         error_log("Skipping ad due to unknown file type: " . $filename);
    }
} // End foreach loop

// Send success response with the list of *active* ads
echo buildSuccessResponse($activeAds);
exit;
?>
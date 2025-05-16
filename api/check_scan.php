<?php
// api/check_scan.php

declare(strict_types=1);

require_once 'db_config.php'; // Include DB credentials
require_once 'utils.php';

// Set response type to JSON
header('Content-Type: application/json');

/**
 * Finds the latest scan record after a given timestamp.
 *
 * @param mysqli $conn Database connection object.
 * @return ?array Associative array with scan data (IDClient, Autorisee, LastUpdate) or null.
 */
function findLatestScan(mysqli $conn): ?array {
    $sql = "SELECT IDStatistique, IDClient, Autorisee, DateEntree, HeureEntree, LastUpdate
            FROM Statistique
            ORDER BY IDStatistique DESC
            LIMIT 1";
    $result = $conn->query($sql);

    if (!$result) {
        return null;
    }

    $scan = $result->fetch_assoc();
    if ($scan !== null) {
        $calculatedCheckIn = null;
        if (!empty($scan['DateEntree']) && !empty($scan['HeureEntree'])) {
            $parsedTs = strtotime($scan['DateEntree'] . ' ' . $scan['HeureEntree']);
            if ($parsedTs !== false) {
                 $calculatedCheckIn = date('Y-m-d H:i:s', $parsedTs);
            }
        }
        $scan['CheckIn'] = $calculatedCheckIn;
    }

    $result->free();
    return $scan;
}

// --- Database Connection ---
$conn = getDbConnection(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
if ($conn === null) {
    // Error already logged in getDbConnection
    echo buildScanCheckResponse('error', null, 'Database connection failed.');
    exit;
}

// --- Find Latest Scan ---
$scan = findLatestScan($conn);

if ($scan === null) {
    // This covers both "no new scan found" and database errors during the scan lookup
    // Check if an error occurred vs just no rows found (optional, based on logging)
    if ($conn->error) { // Check if the connection object has a lingering error message
         echo buildScanCheckResponse('error', null, 'Database query error (scan).');
    } else {
         echo buildScanCheckResponse('no_update'); 
    }
    $conn->close();
    exit;
}

// --- New Scan Found - Process ---
$member_id = $scan['IDClient'];
$scan_id = $scan['IDStatistique'];
$is_autorisee = !empty($scan['Autorisee']); // Treat 0/null/empty as false, anything else as true
$checkin = $scan['CheckIn'];
$db_last_update = $scan['LastUpdate'];

// --- Get Member Details ---
$member = getMemberDetails($conn, (string)$member_id);
$scanResponseData = [];

if ($member === null) {
    // Member lookup failed (either not found or DB error)
    $db_error_message = $conn->error;

    if ($db_error_message) {
        error_log("getMemberDetails failed. MySQL Error: " . $db_error_message); // Log the specific DB error
        $error_message = 'Database query error (member).';
        $conn->close();
        exit;
    } else {
        error_log("Member not found in synchronisation for IDClient: " . $member_id . ". Treating as DENIED scan.");
        $scanResponseData = [
            'last_scan_id' => $scan_id,
            'name' => '',
            'member_status' => 'denied',
            'custom_message' => 'Member record not found.', 
            'stats' => [
                'daysSinceLastMeasure' => null,
                'remainingSessions' => null,
                'trainingsThisMonth' => null,
                'trainingsTotal' => null,
                'checkIn' => $checkin,
            ]
        ];
    }
} else {
    // --- Process Messages and Determine Status ---
    $custom_message = extractAndParseMemberMessages($member);
    $member_status = determineMemberStatus($is_autorisee, $custom_message);

    // --- Build Success Response Payload ---
    $scanResponseData = [
        // Status is set by buildScanCheckResponse wrapper
        'name' => (isset($member['Prenom']) ? $member['Prenom'] : '') . ' ' . (isset($member['Nom']) ? $member['Nom'] : ''),
        'member_status' => $member_status,
        'custom_message' => $custom_message, // Use combined messages
        'stats' => [
            // Use null coalesce operator for safety if fields might be missing/null
            'daysSinceLastMeasure' => isset($member['NbJourDepuisDerniereMesure']) ? $member['NbJourDepuisDerniereMesure'] : null,
            'remainingSessions' => isset($member['NbSeancesRestantes']) ? $member['NbSeancesRestantes'] : null,
            'trainingsThisMonth' => isset($member['NbEntrainementMois']) ? $member['NbEntrainementMois'] : null,
            'trainingsTotal' => isset($member['NbEntrainementsTotal']) ? $member['NbEntrainementsTotal'] : null,
            'checkIn' => isset($scan['CheckIn']) ? $scan['CheckIn'] : null,
        ],
        'last_scan_id' => $scan_id
    ];
}

// --- Output Final Response ---
$finalJsonResponse = buildScanCheckResponse('update_found', $scanResponseData);
echo $finalJsonResponse;

// --- Cleanup ---
$conn->close();
exit;

?>
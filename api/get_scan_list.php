<?php
// api/get_scan_list.php

declare(strict_types=1);

require_once 'db_config.php'; // Include DB credentials
require_once 'utils.php';

// Set response type to JSON
header('Content-Type: application/json');

// Define how far back to look (6 hours)
const SCAN_HISTORY_HOURS = 6;

// --- Main Logic ---
$conn = getDbConnection(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
if ($conn === null) {
    echo buildErrorResponse('Database connection failed.', 503);
    exit;
}

// Calculate the cutoff time (6 hours ago from the *server's* current time)
// Ensure PHP's timezone is set correctly in php.ini or use date_default_timezone_set()
// Or use UTC: $cutoffTimestamp = gmdate('Y-m-d H:i:s', time() - (SCAN_HISTORY_HOURS * 3600));
$cutoffTimestamp = date('Y-m-d H:i:s', time() - (SCAN_HISTORY_HOURS * 3600));
$limit = filter_input(INPUT_GET, 'limit', FILTER_UNSAFE_RAW);
if ($limit === null or $limit < 1) {
    $limit = 12;
}

// SQL to get scans within the time window, joining to get member name
// Selecting only necessary fields
// Order by most recent first
$sql = "SELECT
            s.IDStatistique,
            s.IDClient,
            s.Autorisee,
            s.DateEntree,
            s.HeureEntree,
            sync.Nom,
            sync.Prenom,
            sync.NbJourDepuisDerniereMesure,
            sync.NbSeancesRestantes,
            sync.NbEntrainementMois,
            sync.NbEntrainementsTotal,  
            sync.Message1, sync.Message2, sync.Message3,
            sync.Alerte1, sync.Alerte2, sync.Alerte3, sync.Alerte4, sync.Alerte5,
            sync.Alerte6, sync.Alerte7, sync.Alerte8, sync.Alerte9
        FROM
            Statistique s
        LEFT JOIN
            synchronisation sync ON s.IDClient = sync.IDClient
        WHERE
            s.LastUpdate >= ? -- Get scans FROM the cutoff time onwards
        ORDER BY
            s.LastUpdate DESC -- Show most recent scans at the top
        LIMIT ?"; 

$stmt = $conn->prepare($sql);
if ($stmt === false) {
    error_log("Prepare failed (get_scan_list): " . $conn->error);
    echo buildErrorResponse('Database query error (prepare).');
    $conn->close();
    exit;
}

$scanList = [];
try {
    $stmt->bind_param("si", $cutoffTimestamp, $limit);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result === false) {
         error_log("get_result failed (get_scan_list): " . $stmt->error);
         throw new Exception("Failed to get results.");
    }

    while ($row = $result->fetch_assoc()) {
        // Process each row to determine member status and checkin time
        $isAutorisee = !empty($row['Autorisee']);
        $member = $row; // Use the fetched row data directly
        $custom_messages = extractAndParseMemberMessages($member);
        $member_status = determineMemberStatus($isAutorisee, $custom_messages);

        // Calculate Checkin time (or use LastUpdate directly?)
        $checkinTimestamp = null;
        if (!empty($row['DateEntree']) && !empty($row['HeureEntree'])) {
            $parsedTs = strtotime($row['DateEntree'] . ' ' . $row['HeureEntree']);
            if ($parsedTs !== false) {
                 $checkinTimestamp = date('Y-m-d H:i:s', $parsedTs);
            }
        }
         // Fallback to LastUpdate if Checkin cannot be calculated?
        if ($checkinTimestamp === null) {
             $checkinTimestamp = $row['LastUpdate'];
        }

        // Build the object for this scan entry
        $scanList[] = [
            // Status is set by buildScanCheckResponse wrapper
            'name' => (isset($row['Prenom']) ? $row['Prenom'] : '') . ' ' . (isset($row['Nom']) ? $row['Nom'] : ''),
            'member_status' => $member_status,
            'custom_message' => $custom_messages, // Use combined messages
            'stats' => [
                // Use null coalesce operator for safety if fields might be missing/null
                'daysSinceLastMeasure' => isset($row['NbJoursDepuisDerniereMesure']) ? $row['NbJoursDepuisDerniereMesure'] : null,
                'remainingSessions' => isset($row['NbSeancesRestantes']) ? $row['NbSeancesRestantes'] : null,
                'trainingsThisMonth' => isset($row['NbEntrainementMois']) ? $row['NbEntrainementMois'] : null,
                'trainingsTotal' => isset($row['NbEntrainementsTotal']) ? $row['NbEntrainementsTotal'] : null,
                'checkIn' => isset($checkinTimestamp) ? $checkinTimestamp : null, // Keep original format from DB
            ],
            'last_scan_id' => $row['IDStatistique'],
        ];
    }
    $stmt->close();

} catch (Exception $e) {
    error_log("Error processing scan list: " . $e->getMessage());
    if (isset($stmt) && $stmt instanceof mysqli_stmt) $stmt->close(); // Ensure statement closed on error
    echo buildErrorResponse('Error processing scan data.');
    $conn->close();
    exit;
}

$conn->close();

// Send success response with the list (even if empty)
echo buildSuccessResponse($scanList);
exit;

?>
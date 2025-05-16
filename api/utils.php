<?php

// --- Constants ---
// Define fields to check for custom/warning messages
const MESSAGE_FIELDS = [
    'Message1', 'Message2', 'Message3',
    'Alerte1', 'Alerte2', 'Alerte3', 'Alerte4', 'Alerte5',
    'Alerte6', 'Alerte7', 'Alerte8', 'Alerte9'
];

/**
 * Builds a standard JSON success response.
 * @param array $data The data payload.
 * @return string JSON encoded success response.
 */
function buildSuccessResponse(array $data): string {
    return json_encode(['status' => 'success', 'data' => $data, 'error' => null]);
}

/**
 * Builds a standard JSON error response.
 * @param string $errorMessage The error message.
 * @param ?int $httpStatusCode Optional HTTP status code to set.
 * @return string JSON encoded error response.
 */
function buildErrorResponse(string $errorMessage, ?int $httpStatusCode = null): string {
    // As before, consider if setting http_response_code is needed here
    return json_encode(['status' => 'error', 'data' => null, 'error' => ['message' => $errorMessage]]);
}

/**
 * Builds the specific JSON response for this endpoint (scan check).
 * Adapts the base success/error structure.
 *
 * @param string $status 'update_found', 'no_update', 'error'
 * @param ?array $scanData Associative array with scan data (name, status, message, stats, timestamp)
 * @param ?string $errorMessage Optional error message if status is 'error'
 * @return string JSON response
 */
function buildScanCheckResponse(string $status, ?array $scanData = null, ?string $errorMessage = null): string {
   $response = ['status' => $status];
   if ($status === 'update_found' && $scanData !== null) {
       $response = array_merge($response, $scanData); // Add scan details directly
   } elseif ($status === 'error') {
       $response['message'] = isset($errorMessage) ? $errorMessage : 'Unknown error';
       if (isset($scanData['last_scan_id'])) {
            // Include scanID even on error if available, as requested by JS logic
           $response['last_scan_id'] = $scanData['last_scan_id'];
       }
   }

   return json_encode($response);
}

function parseSingleMessageString(string $rawMessage): array {
    $iconName = null;
    $text = trim($rawMessage);

    if (strpos($text, ';') !== false) {
        list($potentialIcon, $messageText) = explode(';', $text, 2);
        $potentialIcon = trim($potentialIcon);
        // Basic check for image extension (can be more robust)
        if (preg_match('/\.(png|jpg|jpeg|gif|svg)$/i', $potentialIcon)) {
            $iconName = $potentialIcon;
            $text = trim($messageText);
        }
    }
    return ['iconName' => $iconName, 'text' => $text];
}

/**
 * Extracts and combines non-empty messages from predefined fields.
 *
 * @param array $memberData Member data associative array.
 * @return string Combined messages separated by newline, or empty string.
 */
function extractAndParseMemberMessages(array $memberData): array {
    $parsedMessages = [];
    // MESSAGE_FIELDS defined in PHP (Message1, Alerte1, etc.)
    foreach (MESSAGE_FIELDS as $field_name) {
        $rawMessage = trim((string)($memberData[$field_name] ?? ''));
        if (!empty($rawMessage)) {
            $parsedResult = parseSingleMessageString($rawMessage);
            // Only add if there's actual text or a valid icon (optional, could add empty text messages too)
            if ($parsedResult['iconName'] || $parsedResult['text']) {
                $parsedMessages[] = $parsedResult;
            }
        }
    }
    return $parsedMessages; // Returns an array of {iconName: '...', text: '...'} objects
}

/**
 * Determines member status based on authorization and messages.
 *
 * @param bool $isAutorisee Value from Statistique.Autorisee (treated as boolean).
 * @param array $messages message array from extractAndParseMemberMessages
 * @return string 'allowed', 'warning', or 'denied'.
 */
function determineMemberStatus(bool $isAutorisee, array $messages): string {
    if (!$isAutorisee) {
        return 'denied';
    }
    // If authorized, check if there are any messages/alerts
    if (!empty($messages)) {
        return 'warning'; // Authorized but has messages -> warning
    }
    return 'allowed'; // Authorized and no messages -> allowed
}

/**
 * Establishes a database connection.
 * Returns mysqli connection object on success, null on failure.
 * Logs errors internally.
 *
 * @param string $host
 * @param string $user
 * @param string $pass
 * @param string $dbName
 * @param int $port
 * @return ?mysqli Connection object or null.
 */
function getDbConnection(string $host, string $user, string $pass, string $dbName, int $port): ?mysqli {
    // Error reporting setup for mysqli (optional but good for development)
    // mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    try {
        $conn = new mysqli($host, $user, $pass, $dbName, $port);
        // Check connection (alternative to $conn->connect_error for older PHP)
        if (mysqli_connect_errno()) {
             throw new Exception(mysqli_connect_error(), mysqli_connect_errno());
        }
        $conn->set_charset("utf8mb4");
        return $conn;
    } catch (Exception $e) {
        error_log("Database Connection Error: (#{$e->getCode()}) {$e->getMessage()}");
        return null;
    }
}

/**
 * Gets member details from the synchronisation table.
 *
 * @param mysqli $conn Database connection object.
 * @param string $memberId The ID of the member.
 * @return ?array Associative array with member data or null.
 */
function getMemberDetails(mysqli $conn, string $memberId): ?array {
    // Select only the columns needed
    $sql = "SELECT Nom, Prenom, Message1, Message2, Message3, Alerte1, Alerte2, Alerte3, Alerte4, Alerte5, Alerte6, Alerte7, Alerte8, Alerte9, NbJourDepuisDerniereMesure, NbSeancesRestantes, NbEntrainementMois, NbEntrainementsTotal, CheckIn
            FROM synchronisation
            WHERE IDClient = ?";

    $stmt = $conn->prepare($sql);
    if ($stmt === false) {
        // ***** DEBUGGING: Log prepare error *****
        error_log("Prepare failed (getMemberDetails) for ID {$memberId}. MySQL Error: " . $conn->error);
        // ***** END DEBUGGING *****
        return null;
    }

    $member = null; // Initialize member to null

    try {
        $bind_success = $stmt->bind_param("s", $memberId);
        if (!$bind_success) {
             // ***** DEBUGGING: Log bind error *****
             error_log("Bind failed (getMemberDetails) for ID {$memberId}. MySQL Error: " . $stmt->error);
             $stmt->close();
             return null;
        }

        $execute_success = $stmt->execute();
        if (!$execute_success) {
            // ***** DEBUGGING: Log execute error *****
            error_log("Execute failed (getMemberDetails) for ID {$memberId}. MySQL Error: " . $stmt->error);
            $stmt->close();
            return null;
        }

        $result = $stmt->get_result();
        if ($result === false) {
             // ***** DEBUGGING: Log get_result error *****
             error_log("get_result failed (getMemberDetails) for ID {$memberId}. MySQL Error: " . $stmt->error);
             $stmt->close();
             return null;
        }

        $member = $result->fetch_assoc(); // Fetches one row or null if not found

    } catch (Exception $e) {
        // Catch potential exceptions during DB operations
        error_log("Exception during getMemberDetails for ID {$memberId}: " . $e->getMessage());
        $member = null; // Ensure member is null on exception
    } finally {
         // Always close the statement
         if (isset($stmt) && $stmt instanceof mysqli_stmt) {
              $stmt->close();
         }
    }

    return $member; // Returns null if member not found OR if an error occurred
}

?>
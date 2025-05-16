<?php
// api/get_ad_image.php

declare(strict_types=1);

require_once 'db_config.php';

// ini_set('display_errors', "1");
// error_reporting(E_ALL);

// --- Input Validation ---
$raw_filename = filter_input(INPUT_GET, 'file', FILTER_SANITIZE_SPECIAL_CHARS);
$filename = basename($raw_filename);

// Basic security: Check for empty filename and directory traversal attempts
if (empty($filename) || strpos($filename, '..') !== false || strpos($filename, '/') !== false || strpos($filename, '\\') !== false) {
    http_response_code(400);
    error_log("Invalid ad image filename requested: " . (isset($filename)? $filename : 'NULL'));
    exit('Invalid filename.');
}

if (!preg_match('/^[a-zA-Z0-9_.-]+$/', $filename)) {
    http_response_code(400);
    error_log("Invalid characters in ad image filename: " . $filename);
    exit('Filename contains invalid characters.');
}

// 4. Validate Extension and Determine Content Type (Whitelist)
$extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
$allowedExtensions = [
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'gif'  => 'image/gif',
    'svg'  => 'image/svg+xml',
];

if (!array_key_exists($extension, $allowedExtensions)) {
    http_response_code(415); // Unsupported Media Type
    error_log("Unsupported ad image extension requested: " . $filename);
    exit('Unsupported image type.');
}
$contentType = $allowedExtensions[$extension];
$fullFilePath = AD_IMAGE_BASE_DIR . $filename;

$realBaseDir = realpath(AD_IMAGE_BASE_DIR);
$realFilePath = realpath($fullFilePath);

if ($realBaseDir === false) {
    http_response_code(500);
    error_log("Configured AD_IMAGE_BASE_DIR_ACTUAL is invalid or not accessible: " . AD_IMAGE_BASE_DIR);
    exit('Server configuration error (base path).');
}

if ($realFilePath === false || strpos($realFilePath, $realBaseDir) !== 0) {
    // strpos($realFilePath, $realBaseDir) !== 0 means $realFilePath does not START WITH $realBaseDir
    http_response_code(403); // Forbidden (attempt to access outside allowed dir)
    error_log("Forbidden path attempt for ad image. Requested: '{$filename}', Resolved: '" . ($realFilePath ?: 'NonExistent') . "', Base: '{$realBaseDir}'");
    exit('Access to image forbidden.');
}

if (!is_file($realFilePath) || !is_readable($realFilePath)) { // Check if it's a file and readable
    http_response_code(404); // Not Found
    error_log("Ad image not found or not readable (after realpath): " . $realFilePath);
    exit('Image not found.');
}

// --- Output Image ---
try {
    header('Content-Type: ' . $contentType);
    header('Content-Length: ' . filesize($fullFilePath));
    header('Cache-Control: public, max-age=3600'); // Cache for 1 hour
    header('Expires: ' . gmdate('D, d M Y H:i:s \G\M\T', time() + 3600));

    // Disable output buffering if active to prevent memory issues with large files
    while (ob_get_level()) {
        ob_end_clean();
    }

    // Read the file and send its content directly to the output
    readfile($fullFilePath);

} catch (Exception $e) {
    http_response_code(500); // Internal Server Error
    error_log("Error reading/outputting ad image file '{$fullFilePath}': " . $e->getMessage());
    exit('Error serving image.');
}

exit; // Ensure script termination

?>
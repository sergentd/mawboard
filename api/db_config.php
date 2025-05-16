<?php

define('DB_HOST', getenv('MYSQL_HOST') ?: 'YOUR_DB_IP_OR_HOSTNAME');
define('DB_USER', getenv('MYSQL_USER') ?: 'YOUR_DB_USER');
define('DB_PASS', getenv('MYSQL_PASSWORD') ?: 'YOUR_DB_PASSWORD');
define('DB_NAME', getenv('MYSQL_DATABASE') ?: 'YOUR_DB_NAME');
define('DB_PORT', (int)(getenv('MYSQL_PORT') ?: YOUR_DB_PORT));

define('WEATHER_API_KEY', getenv('WEATHER_API_KEY') ?: 'YOUR_OPENWEATHER_API_KEY');

define('AD_INI_FILE_PATH', getenv('AD_INI_FILE_PATH_CONTAINER') ?: '/path/to/your/conf/file.ini');
define('AD_IMAGE_BASE_DIR', getenv('AD_IMAGE_BASE_DIR_CONTAINER') ?: '/path/to/your/images/directory');

// Comment these out in production
// error_reporting(E_ALL);
// ini_set('display_errors', 1);

?>
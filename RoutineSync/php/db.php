<?php
declare(strict_types=1);

// RoutineSync database configuration
// Local XAMPP defaults; Render will use environment variables.

$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = getenv('DB_PORT') ?: '3306';
$db   = getenv('DB_NAME') ?: 'routinesync';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASSWORD') ?: '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";

$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

// Enable TLS when a CA certificate path is provided.
$caPath = getenv('DB_SSL_CA');

if ($caPath) {
    if (!defined('PDO::MYSQL_ATTR_SSL_CA')) {
        throw new RuntimeException('PDO MySQL SSL support is unavailable.');
    }

    $options[constant('PDO::MYSQL_ATTR_SSL_CA')] = $caPath;

    if (defined('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')) {
        $options[constant('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')] = true;
    }
}

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    error_log('RoutineSync database connection failed: ' . $e->getMessage());

    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');

    echo json_encode([
        'error' => 'Database connection failed. Please check the database configuration.'
    ]);

    exit;
}

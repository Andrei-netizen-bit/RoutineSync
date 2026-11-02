<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
    'path' => '/'
]);

session_start();

require_once __DIR__ . '/db.php';

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Invalid request method.'], 405);
}

if (!isset($_SESSION['user_id'])) {
    respond(['error' => 'Please log in first.'], 401);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    respond(['error' => 'Invalid request data.'], 400);
}

$userId = (int) $_SESSION['user_id'];

$name = trim((string)($input['name'] ?? ''));
$email = strtolower(trim((string)($input['email'] ?? '')));
$currentPassword = (string)($input['current_password'] ?? '');
$newPassword = (string)($input['new_password'] ?? '');
$confirmPassword = (string)($input['confirm_password'] ?? '');

if ($name === '' || $email === '' || $currentPassword === '') {
    respond([
        'error' => 'Name, email, and current password are required.'
    ], 422);
}

if (mb_strlen($name) > 100 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(['error' => 'Please enter a valid name and email.'], 422);
}

if ($newPassword !== '' && strlen($newPassword) < 8) {
    respond(['error' => 'New password must be at least 8 characters.'], 422);
}

if ($newPassword !== '' && $newPassword !== $confirmPassword) {
    respond(['error' => 'New password and confirmation do not match.'], 422);
}

try {
    $stmt = $pdo->prepare(
        'SELECT id, display_name, email, password_hash
         FROM users
         WHERE id = ?
         LIMIT 1'
    );
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($currentPassword, $user['password_hash'])) {
        respond(['error' => 'Your current password is incorrect.'], 401);
    }

    $emailCheck = $pdo->prepare(
        'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1'
    );
    $emailCheck->execute([$email, $userId]);

    if ($emailCheck->fetch()) {
        respond(['error' => 'That email address is already being used.'], 409);
    }

    if ($newPassword !== '') {
        $newHash = password_hash($newPassword, PASSWORD_DEFAULT);

        $update = $pdo->prepare(
            'UPDATE users
             SET display_name = ?, email = ?, password_hash = ?
             WHERE id = ?'
        );
        $update->execute([$name, $email, $newHash, $userId]);
    } else {
        $update = $pdo->prepare(
            'UPDATE users
             SET display_name = ?, email = ?
             WHERE id = ?'
        );
        $update->execute([$name, $email, $userId]);
    }

    $_SESSION['user_name'] = $name;
    $_SESSION['user_email'] = $email;

    respond([
        'ok' => true,
        'message' => 'Profile updated successfully!',
        'user' => [
            'id' => $userId,
            'name' => $name,
            'email' => $email
        ]
    ]);

} catch (PDOException $e) {
    respond(['error' => 'Unable to update profile. Please try again.'], 500);
}
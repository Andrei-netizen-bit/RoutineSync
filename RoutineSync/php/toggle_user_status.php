<?php

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

session_start();

require_once __DIR__ . '/db.php';

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond([
        'ok' => false,
        'error' => 'Invalid request method.'
    ], 405);
}

if (!isset($_SESSION['user_id'])) {
    respond([
        'ok' => false,
        'error' => 'Please log in first.'
    ], 401);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    respond([
        'ok' => false,
        'error' => 'Invalid request data.'
    ], 400);
}

$targetId = filter_var(
    $input['user_id'] ?? null,
    FILTER_VALIDATE_INT
);

$newStatus = $input['is_active'] ?? null;

if (!$targetId || !in_array($newStatus, [0, 1, '0', '1'], true)) {
    respond([
        'ok' => false,
        'error' => 'Invalid user ID or account status.'
    ], 422);
}

$currentUserId = (int)$_SESSION['user_id'];

try {
    // Verify the current account directly from the database.
    $adminStmt = $pdo->prepare(
        'SELECT role, is_active FROM users WHERE id = ? LIMIT 1'
    );

    $adminStmt->execute([$currentUserId]);
    $admin = $adminStmt->fetch(PDO::FETCH_ASSOC);

    if (
        !$admin ||
        $admin['role'] !== 'admin' ||
        (int)$admin['is_active'] !== 1
    ) {
        respond([
            'ok' => false,
            'error' => 'Admin access only.'
        ], 403);
    }

    // Admin cannot deactivate or modify their own account.
    if ($targetId === $currentUserId) {
        respond([
            'ok' => false,
            'error' => 'You cannot change your own account status.'
        ], 403);
    }

    // Find the account to update.
    $targetStmt = $pdo->prepare(
        'SELECT id, role FROM users WHERE id = ? LIMIT 1'
    );

    $targetStmt->execute([$targetId]);
    $targetUser = $targetStmt->fetch(PDO::FETCH_ASSOC);

    if (!$targetUser) {
        respond([
            'ok' => false,
            'error' => 'User account not found.'
        ], 404);
    }

    // Only End User accounts can be changed.
    if ($targetUser['role'] !== 'end_user') {
        respond([
            'ok' => false,
            'error' => 'Admin accounts cannot be modified here.'
        ], 403);
    }

    $status = (int)$newStatus;

    $updateStmt = $pdo->prepare(
        'UPDATE users SET is_active = ? WHERE id = ? AND role = ?'
    );

    $updateStmt->execute([
        $status,
        $targetId,
        'end_user'
    ]);

    respond([
        'ok' => true,
        'message' => $status === 1
            ? 'User account activated successfully.'
            : 'User account deactivated successfully.',
        'is_active' => $status
    ]);

} catch (PDOException $e) {
    error_log('RoutineSync User Status Error: ' . $e->getMessage());

    respond([
        'ok' => false,
        'error' => 'Unable to update account status.'
    ], 500);
}
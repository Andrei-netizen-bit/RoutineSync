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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
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

try {
    // Verify that the current account is an active Admin.
    $roleStmt = $pdo->prepare(
        'SELECT role, is_active FROM users WHERE id = ? LIMIT 1'
    );

    $roleStmt->execute([$_SESSION['user_id']]);
    $currentUser = $roleStmt->fetch(PDO::FETCH_ASSOC);

    if (
        !$currentUser ||
        $currentUser['role'] !== 'admin' ||
        (int)$currentUser['is_active'] !== 1
    ) {
        respond([
            'ok' => false,
            'error' => 'Admin access only.'
        ], 403);
    }

    $totalUsers = (int)$pdo->query(
        'SELECT COUNT(*) FROM users'
    )->fetchColumn();

    $activeRoutines = (int)$pdo->query(
        'SELECT COUNT(*) FROM checklist_items
         WHERE archived_at IS NULL'
    )->fetchColumn();

    $archivedRoutines = (int)$pdo->query(
        'SELECT COUNT(*) FROM checklist_items
         WHERE archived_at IS NOT NULL'
    )->fetchColumn();

    $completedItems = (int)$pdo->query(
        'SELECT COUNT(*) FROM completion_logs
         WHERE is_done = 1'
    )->fetchColumn();

    // Include account status for the Admin User Management table.
    $usersStmt = $pdo->query(
        'SELECT id, display_name, email, role, is_active, created_at
         FROM users
         ORDER BY created_at DESC
         LIMIT 100'
    );

    $users = $usersStmt->fetchAll(PDO::FETCH_ASSOC);

    respond([
        'ok' => true,
        'stats' => [
            'total_users' => $totalUsers,
            'active_routines' => $activeRoutines,
            'archived_routines' => $archivedRoutines,
            'completed_items' => $completedItems
        ],
        'users' => $users
    ]);

} catch (PDOException $e) {
    error_log('RoutineSync Admin Dashboard Error: ' . $e->getMessage());

    respond([
        'ok' => false,
        'error' => 'Unable to load admin dashboard data. Check your database tables.'
    ], 500);
}
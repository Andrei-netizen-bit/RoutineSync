<?php

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

session_start();
require_once __DIR__ . '/db.php';

function respond(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    respond(['error' => 'Please login first.'], 401);
}

try {
    $today = (new DateTime(
        'now',
        new DateTimeZone('Asia/Manila')
    ))->format('Y-m-d');

    $userId = (int) $_SESSION['user_id'];

    $pdo->beginTransaction();

    $userStmt = $pdo->prepare(
        'SELECT last_checklist_date
         FROM users
         WHERE id = ?
         FOR UPDATE'
    );

    $userStmt->execute([$userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        $pdo->rollBack();
        respond(['error' => 'User account not found.'], 404);
    }

    $lastDate = $user['last_checklist_date'];

    if ($lastDate === null) {
        $dateStmt = $pdo->prepare(
            'UPDATE users
             SET last_checklist_date = ?
             WHERE id = ?'
        );

        $dateStmt->execute([$today, $userId]);

    } elseif ($lastDate !== $today) {

        // Reset ACTIVE routines only.
        $resetStmt = $pdo->prepare(
            'UPDATE checklist_items
             SET is_done = 0
             WHERE user_id = ?
               AND archived_at IS NULL'
        );

        $resetStmt->execute([$userId]);

        $dateStmt = $pdo->prepare(
            'UPDATE users
             SET last_checklist_date = ?
             WHERE id = ?'
        );

        $dateStmt->execute([$today, $userId]);
    }

    // Exclude archived routines.
    $stmt = $pdo->prepare(
        'SELECT id, name, phase, note, is_done, created_at
         FROM checklist_items
         WHERE user_id = ?
           AND archived_at IS NULL
         ORDER BY id DESC'
    );

    $stmt->execute([$userId]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $pdo->commit();

    foreach ($items as &$item) {
        $item['id'] = (int) $item['id'];
        $item['is_done'] = (bool) $item['is_done'];
    }

    unset($item);

    respond([
        'ok' => true,
        'items' => $items,
        'date' => $today
    ]);

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    respond([
        'error' => 'Unable to load your routines.'
    ], 500);
}
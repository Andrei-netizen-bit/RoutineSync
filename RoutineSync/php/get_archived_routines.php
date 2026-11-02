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
    $userId = (int) $_SESSION['user_id'];

    $stmt = $pdo->prepare(
        'SELECT id, name, phase, note, archived_at
         FROM checklist_items
         WHERE user_id = ?
           AND archived_at IS NOT NULL
         ORDER BY archived_at DESC'
    );

    $stmt->execute([$userId]);

    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($items as &$item) {
        $item['id'] = (int) $item['id'];
    }

    unset($item);

    respond([
        'ok' => true,
        'items' => $items
    ]);

} catch (Throwable $e) {
    respond([
        'error' => 'Unable to load archived routines.'
    ], 500);
}
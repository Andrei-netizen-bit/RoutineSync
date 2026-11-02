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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Use POST method.'], 405);
}

if (!isset($_SESSION['user_id'])) {
    respond(['error' => 'Please login first.'], 401);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    respond(['error' => 'Invalid request data.'], 400);
}

$id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);

if (!$id || $id < 1) {
    respond(['error' => 'Invalid routine ID.'], 422);
}

try {
    $userId = (int) $_SESSION['user_id'];

    $stmt = $pdo->prepare(
        'UPDATE checklist_items
         SET archived_at = NOW()
         WHERE id = ?
           AND user_id = ?
           AND archived_at IS NULL'
    );

    $stmt->execute([$id, $userId]);

    if ($stmt->rowCount() === 0) {
        respond([
            'error' => 'Routine not found or already archived.'
        ], 404);
    }

    respond([
        'ok' => true,
        'message' => 'Routine archived successfully.'
    ]);

} catch (PDOException $e) {
    respond([
        'error' => 'Unable to archive routine.'
    ], 500);
}
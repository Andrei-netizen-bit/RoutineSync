<?php
declare(strict_types=1);

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

$name = trim((string)($input['name'] ?? ''));
$phase = (string)($input['phase'] ?? '');
$note = trim((string)($input['note'] ?? ''));
$done = !empty($input['done']) ? 1 : 0;

$allowed = ['morning', 'midday', 'evening'];

if (
    $name === '' ||
    mb_strlen($name) > 90 ||
    !in_array($phase, $allowed, true) ||
    mb_strlen($note) > 160
) {
    respond(['error' => 'Invalid name, phase, or note.'], 422);
}

try {
    $stmt = $pdo->prepare(
        'INSERT INTO checklist_items
         (user_id, name, phase, note, is_done)
         VALUES (?, ?, ?, ?, ?)'
    );

    $stmt->execute([
        (int)$_SESSION['user_id'],
        $name,
        $phase,
        $note,
        $done
    ]);

    respond([
        'ok' => true,
        'message' => 'Routine saved successfully!',
        'id' => (int)$pdo->lastInsertId()
    ], 201);

} catch (PDOException $e) {
    respond(['error' => 'Unable to save checklist item.'], 500);
}
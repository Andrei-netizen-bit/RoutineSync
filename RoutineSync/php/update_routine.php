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

// POST method only
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Use POST method.'], 405);
}

// Require login
if (!isset($_SESSION['user_id'])) {
    respond(['error' => 'Please login first.'], 401);
}

// Read JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    respond(['error' => 'Invalid request data.'], 400);
}

// Get input values
$id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
$name = trim((string) ($input['name'] ?? ''));
$phase = (string) ($input['phase'] ?? '');
$note = trim((string) ($input['note'] ?? ''));

$doneInput = $input['done'] ?? null;

if (
    !is_bool($doneInput) &&
    !in_array($doneInput, [0, 1, '0', '1'], true)
) {
    respond(['error' => 'Invalid checklist status.'], 422);
}

$done = (int) $doneInput;
$userId = (int) $_SESSION['user_id'];

// Validate routine ID
if (!$id || $id < 1) {
    respond(['error' => 'Invalid routine ID.'], 422);
}

// Validate routine details
$allowed = ['morning', 'midday', 'evening'];

if (
    $name === '' ||
    mb_strlen($name) > 90 ||
    !in_array($phase, $allowed, true) ||
    mb_strlen($note) > 160
) {
    respond(['error' => 'Invalid routine details.'], 422);
}

try {

    // Use Manila date for completion history
    $today = (new DateTime(
        'now',
        new DateTimeZone('Asia/Manila')
    ))->format('Y-m-d');

    $pdo->beginTransaction();

    // Check ownership and previous status.
    // Archived routines cannot be edited.
    $checkStmt = $pdo->prepare(
        'SELECT id, is_done
         FROM checklist_items
         WHERE id = ?
           AND user_id = ?
           AND archived_at IS NULL
         FOR UPDATE'
    );

    $checkStmt->execute([$id, $userId]);

    $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$existing) {
        $pdo->rollBack();

        respond([
            'error' => 'Routine not found or already archived.'
        ], 404);
    }

    $previousDone = (int) $existing['is_done'];

    // Update routine details and checkbox status.
    $updateStmt = $pdo->prepare(
        'UPDATE checklist_items
         SET name = ?,
             phase = ?,
             note = ?,
             is_done = ?
         WHERE id = ?
           AND user_id = ?
           AND archived_at IS NULL'
    );

    $updateStmt->execute([
        $name,
        $phase,
        $note,
        $done,
        $id,
        $userId
    ]);

    // Save completion history only if checkbox status changed.
    if ($previousDone !== $done) {

        $logStmt = $pdo->prepare(
            'INSERT INTO completion_logs
             (user_id, checklist_item_id, completed_on, is_done)
             VALUES (?, ?, ?, ?)'
        );

        $logStmt->execute([
            $userId,
            $id,
            $today,
            $done
        ]);
    }

    $pdo->commit();

    respond([
        'ok' => true,
        'message' => 'Routine updated and saved successfully.'
    ]);

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    respond([
        'error' => 'Unable to update routine.'
    ], 500);
}
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

    $timezone = new DateTimeZone('Asia/Manila');
    $today = new DateTime('now', $timezone);

    // ----------------------------------
    // CURRENT ACTIVE ROUTINES
    // ----------------------------------

    $stmt = $pdo->prepare(
        'SELECT
            COUNT(*) AS total,
            COALESCE(SUM(is_done = 1), 0) AS completed
         FROM checklist_items
         WHERE user_id = ?
           AND archived_at IS NULL'
    );

    $stmt->execute([$userId]);
    $current = $stmt->fetch(PDO::FETCH_ASSOC);

    $total = (int) $current['total'];
    $completed = (int) $current['completed'];

    $overallRate = $total > 0
        ? (int) round(($completed / $total) * 100)
        : 0;

    // ----------------------------------
    // CURRENT PHASE BREAKDOWN
    // ----------------------------------

    $phaseNames = [
        'morning' => 'Morning',
        'midday' => 'Midday',
        'evening' => 'Evening'
    ];

    $phaseStmt = $pdo->prepare(
        'SELECT
            phase,
            COUNT(*) AS total,
            COALESCE(SUM(is_done = 1), 0) AS completed
         FROM checklist_items
         WHERE user_id = ?
           AND archived_at IS NULL
         GROUP BY phase'
    );

    $phaseStmt->execute([$userId]);
    $phaseRows = $phaseStmt->fetchAll(PDO::FETCH_ASSOC);

    $phaseData = [];

    foreach ($phaseNames as $phase => $label) {
        $phaseData[$phase] = [
            'phase' => $phase,
            'name' => $label,
            'total' => 0,
            'completed' => 0,
            'rate' => 0
        ];
    }

    foreach ($phaseRows as $row) {
        $phase = $row['phase'];

        if (!isset($phaseData[$phase])) {
            continue;
        }

        $phaseTotal = (int) $row['total'];
        $phaseCompleted = (int) $row['completed'];

        $phaseData[$phase]['total'] = $phaseTotal;
        $phaseData[$phase]['completed'] = $phaseCompleted;
        $phaseData[$phase]['rate'] = $phaseTotal > 0
            ? (int) round(($phaseCompleted / $phaseTotal) * 100)
            : 0;
    }

    $bestPhase = '—';
    $bestRate = -1;

    foreach ($phaseData as $phase) {
        if ($phase['total'] > 0 && $phase['rate'] > $bestRate) {
            $bestRate = $phase['rate'];
            $bestPhase = $phase['name'];
        }
    }

    // ----------------------------------
    // LAST 7 DAYS
    // Uses each routine's created_at
    // and archived_at to reconstruct
    // the historical daily denominator.
    // ----------------------------------

    $weekly = [];

    $dailyStatusStmt = $pdo->prepare(
        'SELECT latest.is_done
         FROM completion_logs AS latest
         INNER JOIN (
             SELECT
                 checklist_item_id,
                 MAX(id) AS latest_id
             FROM completion_logs
             WHERE user_id = ?
               AND completed_on = ?
               AND checklist_item_id IS NOT NULL
             GROUP BY checklist_item_id
         ) AS selected
             ON selected.latest_id = latest.id
         INNER JOIN checklist_items AS item
             ON item.id = latest.checklist_item_id
         WHERE item.user_id = ?
           AND DATE(item.created_at) <= ?
           AND (
               item.archived_at IS NULL
               OR DATE(item.archived_at) > ?
           )'
    );

    $dailyTotalStmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM checklist_items
         WHERE user_id = ?
           AND DATE(created_at) <= ?
           AND (
               archived_at IS NULL
               OR DATE(archived_at) > ?
           )'
    );

    for ($i = 6; $i >= 0; $i--) {
        $date = clone $today;
        $date->modify("-{$i} days");

        $dateString = $date->format('Y-m-d');

        // Number of routines active on that date.
        $dailyTotalStmt->execute([
            $userId,
            $dateString,
            $dateString
        ]);

        $dailyTotal = (int) $dailyTotalStmt->fetchColumn();

        // Latest saved status of each routine on that date.
        $dailyStatusStmt->execute([
            $userId,
            $dateString,
            $userId,
            $dateString,
            $dateString
        ]);

        $statuses = $dailyStatusStmt->fetchAll(PDO::FETCH_COLUMN);

        $dailyCompleted = 0;

        foreach ($statuses as $status) {
            if ((int) $status === 1) {
                $dailyCompleted++;
            }
        }

        $dailyRate = $dailyTotal > 0
            ? (int) round(($dailyCompleted / $dailyTotal) * 100)
            : 0;

        $weekly[] = [
            'date' => $dateString,
            'label' => $date->format('D'),
            'completed' => $dailyCompleted,
            'total' => $dailyTotal,
            'rate' => $dailyRate
        ];
    }

    // ----------------------------------
    // TRACKED DAYS
    // ----------------------------------

    $trackedStmt = $pdo->prepare(
        'SELECT COUNT(DISTINCT completed_on)
         FROM completion_logs
         WHERE user_id = ?
           AND is_done = 1'
    );

    $trackedStmt->execute([$userId]);
    $trackedDays = (int) $trackedStmt->fetchColumn();

    // ----------------------------------
    // COMPLETION STREAK
    // ----------------------------------

    $historyStmt = $pdo->prepare(
        'SELECT DISTINCT completed_on
         FROM completion_logs
         WHERE user_id = ?
           AND is_done = 1
         ORDER BY completed_on DESC'
    );

    $historyStmt->execute([$userId]);
    $historyDates = $historyStmt->fetchAll(PDO::FETCH_COLUMN);

    $completedDates = array_flip($historyDates);

    $streak = 0;
    $checkDate = clone $today;

    // If there is no completion today,
    // start checking from yesterday.
    if (!isset($completedDates[$checkDate->format('Y-m-d')])) {
        $checkDate->modify('-1 day');
    }

    while (isset($completedDates[$checkDate->format('Y-m-d')])) {
        $streak++;
        $checkDate->modify('-1 day');
    }

    // ----------------------------------
    // RESPONSE
    // ----------------------------------

    respond([
        'ok' => true,
        'overall_rate' => $overallRate,
        'best_phase' => $bestPhase,
        'tracked_days' => $trackedDays,
        'streak' => $streak,
        'weekly' => $weekly,
        'phases' => array_values($phaseData)
    ]);

} catch (Throwable $e) {
    respond([
        'ok' => false,
        'error' => 'Unable to load analytics data.'
    ], 500);
}
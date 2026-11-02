<?php
header("Content-Type: application/json; charset=UTF-8");

session_start();
require_once "db.php";

function respond($status, $data) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

try {
    if (!isset($_SESSION["user_id"])) {
        respond(401, [
            "ok" => false,
            "error" => "Please log in first."
        ]);
    }

    $userId = (int) $_SESSION["user_id"];

    $check = $pdo->prepare(
        "SELECT is_active FROM users WHERE id = ? LIMIT 1"
    );
    $check->execute([$userId]);
    $user = $check->fetch(PDO::FETCH_ASSOC);

    if (!$user || (int) $user["is_active"] !== 1) {
        session_unset();
        session_destroy();

        respond(403, [
            "ok" => false,
            "error" => "Your account is inactive."
        ]);
    }

    $stmt = $pdo->query(
        "SELECT title, description, phase, item_name, item_note
         FROM routine_templates
         ORDER BY title ASC, id ASC"
    );

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $templates = [];

    foreach ($rows as $row) {
        $key = $row["title"] . "|" . $row["description"];

        if (!isset($templates[$key])) {
            $templates[$key] = [
                "title" => $row["title"],
                "description" => $row["description"],
                "items" => []
            ];
        }

        $templates[$key]["items"][] = [
            "phase" => $row["phase"],
            "name" => $row["item_name"],
            "note" => $row["item_note"] ?? ""
        ];
    }

    respond(200, [
        "ok" => true,
        "templates" => array_values($templates)
    ]);

} catch (Throwable $e) {
    respond(500, [
        "ok" => false,
        "error" => "Unable to load templates."
    ]);
}
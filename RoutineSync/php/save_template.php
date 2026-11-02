<?php
header("Content-Type: application/json; charset=UTF-8");

session_start();
require_once "db.php";

function respond($status, $data) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function getAdmin($pdo) {
    if (!isset($_SESSION["user_id"])) {
        respond(401, ["ok" => false, "error" => "Please log in first."]);
    }

    $stmt = $pdo->prepare(
        "SELECT role, is_active FROM users WHERE id = ? LIMIT 1"
    );
    $stmt->execute([(int) $_SESSION["user_id"]]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || (int) $user["is_active"] !== 1) {
        respond(403, ["ok" => false, "error" => "Your account is inactive."]);
    }

    if ($user["role"] !== "admin") {
        respond(403, ["ok" => false, "error" => "Admin access required."]);
    }
}

function validateItems($items) {
    if (!is_array($items) || count($items) < 1) {
        respond(400, ["ok" => false, "error" => "Add at least one checklist item."]);
    }

    $validPhases = ["morning", "midday", "evening"];
    $cleanItems = [];

    foreach ($items as $item) {
        if (!is_array($item)) {
            respond(400, ["ok" => false, "error" => "Invalid checklist item."]);
        }

        $phase = strtolower(trim($item["phase"] ?? ""));
        $name = trim($item["name"] ?? "");
        $note = trim($item["note"] ?? "");

        if (!in_array($phase, $validPhases, true)) {
            respond(400, ["ok" => false, "error" => "Invalid item phase."]);
        }

        if ($name === "") {
            respond(400, ["ok" => false, "error" => "Every item must have a name."]);
        }

        $cleanItems[] = [
            "phase" => $phase,
            "name" => $name,
            "note" => $note
        ];
    }

    return $cleanItems;
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        respond(405, ["ok" => false, "error" => "POST method required."]);
    }

    getAdmin($pdo);

    $data = json_decode(file_get_contents("php://input"), true);

    if (!is_array($data)) {
        respond(400, ["ok" => false, "error" => "Invalid request data."]);
    }

    $title = trim($data["title"] ?? "");
    $description = trim($data["description"] ?? "");
    $items = validateItems($data["items"] ?? []);

    if ($title === "") {
        respond(400, ["ok" => false, "error" => "Template title is required."]);
    }

    if ($description === "") {
        respond(400, ["ok" => false, "error" => "Template description is required."]);
    }

    $check = $pdo->prepare(
        "SELECT COUNT(*) FROM routine_templates WHERE title = ?"
    );
    $check->execute([$title]);

    if ((int) $check->fetchColumn() > 0) {
        respond(409, ["ok" => false, "error" => "A template with that title already exists."]);
    }

    $pdo->beginTransaction();

    $insert = $pdo->prepare(
        "INSERT INTO routine_templates
         (title, description, phase, item_name, item_note)
         VALUES (?, ?, ?, ?, ?)"
    );

    foreach ($items as $item) {
        $insert->execute([
            $title,
            $description,
            $item["phase"],
            $item["name"],
            $item["note"]
        ]);
    }

    $pdo->commit();

    respond(200, [
        "ok" => true,
        "message" => "Template created successfully."
    ]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    respond(500, [
        "ok" => false,
        "error" => "Unable to save template."
    ]);
}
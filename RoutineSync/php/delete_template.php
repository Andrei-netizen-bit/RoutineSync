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
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        respond(405, ["ok" => false, "error" => "POST method required."]);
    }

    if (!isset($_SESSION["user_id"])) {
        respond(401, ["ok" => false, "error" => "Please log in first."]);
    }

    $adminCheck = $pdo->prepare(
        "SELECT role, is_active FROM users WHERE id = ? LIMIT 1"
    );
    $adminCheck->execute([(int) $_SESSION["user_id"]]);
    $admin = $adminCheck->fetch(PDO::FETCH_ASSOC);

    if (!$admin || (int) $admin["is_active"] !== 1) {
        respond(403, ["ok" => false, "error" => "Your account is inactive."]);
    }

    if ($admin["role"] !== "admin") {
        respond(403, ["ok" => false, "error" => "Admin access required."]);
    }

    $data = json_decode(file_get_contents("php://input"), true);

    if (!is_array($data)) {
        respond(400, ["ok" => false, "error" => "Invalid request data."]);
    }

    $title = trim($data["original_title"] ?? "");
    $description = trim($data["original_description"] ?? "");

    if ($title === "" || $description === "") {
        respond(400, ["ok" => false, "error" => "Template information is missing."]);
    }

    $stmt = $pdo->prepare(
        "DELETE FROM routine_templates
         WHERE title = ? AND description = ?"
    );
    $stmt->execute([$title, $description]);

    if ($stmt->rowCount() === 0) {
        respond(404, ["ok" => false, "error" => "Template not found."]);
    }

    respond(200, [
        "ok" => true,
        "message" => "Template deleted successfully."
    ]);

} catch (Throwable $e) {
    respond(500, [
        "ok" => false,
        "error" => "Unable to delete template."
    ]);
}
<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
    'path' => '/'
]);

session_start();

require_once __DIR__ . '/db.php';

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function clearUserSession(): void
{
    $_SESSION = [];
    session_destroy();
}

$method = $_SERVER['REQUEST_METHOD'];

/* CHECK CURRENT LOGIN */
if ($method === 'GET' && ($_GET['action'] ?? '') === 'me') {

    if (!isset($_SESSION['user_id'])) {
        respond(['logged_in' => false]);
    }

    $stmt = $pdo->prepare(
        'SELECT id, display_name, email, role, is_active
         FROM users
         WHERE id = ?
         LIMIT 1'
    );

    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user || (int)$user['is_active'] !== 1) {
        clearUserSession();
        respond([
            'logged_in' => false,
            'message' => 'Your account is inactive.'
        ]);
    }

    $_SESSION['user_name'] = $user['display_name'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_role'] = $user['role'];

    respond([
        'logged_in' => true,
        'user' => [
            'id' => (int)$user['id'],
            'name' => $user['display_name'],
            'email' => $user['email'],
            'role' => $user['role']
        ]
    ]);
}

if ($method !== 'POST') {
    respond(['error' => 'Invalid request method.'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    respond(['error' => 'Invalid request data.'], 400);
}

$action = $input['action'] ?? '';

/* REGISTER */
if ($action === 'register') {

    $name = trim((string)($input['name'] ?? ''));
    $email = strtolower(trim((string)($input['email'] ?? '')));
    $password = (string)($input['password'] ?? '');

    if ($name === '' || $email === '' || $password === '') {
        respond(['error' => 'Please complete all fields.'], 422);
    }

    if (
        mb_strlen($name) > 100 ||
        !filter_var($email, FILTER_VALIDATE_EMAIL)
    ) {
        respond(['error' => 'Please enter a valid name and email.'], 422);
    }

    if (strlen($password) < 8) {
        respond(['error' => 'Password must be at least 8 characters.'], 422);
    }

    try {
        $check = $pdo->prepare(
            'SELECT id FROM users WHERE email = ? LIMIT 1'
        );

        $check->execute([$email]);

        if ($check->fetch()) {
            respond(['error' => 'Email is already registered.'], 409);
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);

        // Public registrations are always End Users.
        // is_active defaults to 1 in the database.
        $stmt = $pdo->prepare(
            "INSERT INTO users
            (display_name, email, password_hash, role)
            VALUES (?, ?, ?, 'end_user')"
        );

        $stmt->execute([$name, $email, $hash]);

        session_regenerate_id(true);

        $_SESSION['user_id'] = (int)$pdo->lastInsertId();
        $_SESSION['user_name'] = $name;
        $_SESSION['user_email'] = $email;
        $_SESSION['user_role'] = 'end_user';

        respond([
            'ok' => true,
            'message' => 'Registration successful!',
            'user' => [
                'id' => $_SESSION['user_id'],
                'name' => $name,
                'email' => $email,
                'role' => 'end_user'
            ]
        ], 201);

    } catch (PDOException $e) {
        respond([
            'error' => 'Unable to create account. Please try again.'
        ], 500);
    }
}

/* LOGIN */
if ($action === 'login') {

    $email = strtolower(trim((string)($input['email'] ?? '')));
    $password = (string)($input['password'] ?? '');

    if ($email === '' || $password === '') {
        respond([
            'error' => 'Please enter your email and password.'
        ], 422);
    }

    $stmt = $pdo->prepare(
        'SELECT id, display_name, email, password_hash, role, is_active
         FROM users
         WHERE email = ?
         LIMIT 1'
    );

    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        respond([
            'error' => 'Incorrect email or password.'
        ], 401);
    }

    if ((int)$user['is_active'] !== 1) {
        respond([
            'error' => 'Your account has been deactivated. Please contact the administrator.'
        ], 403);
    }

    session_regenerate_id(true);

    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['user_name'] = $user['display_name'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_role'] = $user['role'];

    respond([
        'ok' => true,
        'message' => 'Login successful!',
        'user' => [
            'id' => $_SESSION['user_id'],
            'name' => $_SESSION['user_name'],
            'email' => $_SESSION['user_email'],
            'role' => $_SESSION['user_role']
        ]
    ]);
}

/* LOGOUT */
if ($action === 'logout') {

    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();

        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'],
            'domain' => $params['domain'],
            'secure' => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'] ?? 'Lax'
        ]);
    }

    session_destroy();

    respond([
        'ok' => true,
        'message' => 'Logged out successfully.'
    ]);
}

respond(['error' => 'Unknown action.'], 400);
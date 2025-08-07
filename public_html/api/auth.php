<?php
/**
 * 認証 API
 * POST /api/auth.php - ログイン処理
 */

require_once 'config.php';

$db = Database::getInstance()->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

$input = getJsonInput();

// 必須項目チェック
validateRequired($input, ['username', 'password']);

$username = $input['username'];
$password = $input['password'];

try {
    // 管理者ログインチェック
    $stmt = $db->prepare("SELECT username FROM admin_users WHERE username = :username AND password = :password");
    $stmt->execute(['username' => $username, 'password' => $password]);
    $admin = $stmt->fetch();
    
    if ($admin) {
        sendJsonResponse([
            'success' => true,
            'user_type' => 'admin',
            'username' => $admin['username'],
            'message' => 'ログインしました'
        ]);
    }
    
    // 従業員ログインチェック
    $stmt = $db->prepare("SELECT employee_code, name, business_type FROM employees WHERE employee_code = :employee_code AND password = :password");
    $stmt->execute(['employee_code' => $username, 'password' => $password]);
    $employee = $stmt->fetch();
    
    if ($employee) {
        sendJsonResponse([
            'success' => true,
            'user_type' => 'employee',
            'employee_code' => $employee['employee_code'],
            'name' => $employee['name'],
            'business_type' => $employee['business_type'],
            'message' => 'ログインしました'
        ]);
    }
    
    // ログイン失敗
    sendErrorResponse('ユーザー名またはパスワードが間違っています', 401);
    
} catch (PDOException $e) {
    error_log('Auth error: ' . $e->getMessage());
    sendErrorResponse('認証処理に失敗しました', 500);
}
?>
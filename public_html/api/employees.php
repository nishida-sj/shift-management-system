<?php
/**
 * 従業員マスタ API
 * GET /api/employees.php - 全従業員取得
 * POST /api/employees.php - 従業員追加
 * PUT /api/employees.php - 従業員更新
 * DELETE /api/employees.php?employee_code=xxx - 従業員削除
 */

require_once 'config.php';

$db = Database::getInstance()->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet($db);
        break;
    case 'POST':
        handlePost($db);
        break;
    case 'PUT':
        handlePut($db);
        break;
    case 'DELETE':
        handleDelete($db);
        break;
    default:
        sendErrorResponse('Method not allowed', 405);
}

function handleGet($db) {
    try {
        $stmt = $db->query("SELECT * FROM employees ORDER BY employee_code");
        $employees = $stmt->fetchAll();
        
        // JSON形式の available_days をパース
        foreach ($employees as &$employee) {
            if ($employee['available_days']) {
                $employee['available_days'] = json_decode($employee['available_days'], true);
            }
            // パスワードは返さない
            unset($employee['password']);
        }
        
        sendJsonResponse($employees);
    } catch (PDOException $e) {
        error_log('Employee fetch error: ' . $e->getMessage());
        sendErrorResponse('従業員データの取得に失敗しました', 500);
    }
}

function handlePost($db) {
    $input = getJsonInput();
    
    // 必須項目チェック
    validateRequired($input, ['employee_code', 'name', 'business_type', 'password']);
    
    // 業務区分チェック
    if (!in_array($input['business_type'], ['事務', '調理'])) {
        sendErrorResponse('業務区分は「事務」または「調理」を指定してください');
    }
    
    // 時間形式チェック
    if (isset($input['preferred_time_start']) && !empty($input['preferred_time_start'])) {
        validateTime($input['preferred_time_start']);
    }
    if (isset($input['preferred_time_end']) && !empty($input['preferred_time_end'])) {
        validateTime($input['preferred_time_end']);
    }
    
    try {
        $sql = "INSERT INTO employees (employee_code, name, business_type, password, available_days, 
                preferred_time_start, preferred_time_end, work_limit_per_day, work_limit_per_month) 
                VALUES (:employee_code, :name, :business_type, :password, :available_days, 
                :preferred_time_start, :preferred_time_end, :work_limit_per_day, :work_limit_per_month)";
        
        $stmt = $db->prepare($sql);
        $stmt->execute([
            'employee_code' => $input['employee_code'],
            'name' => $input['name'],
            'business_type' => $input['business_type'],
            'password' => $input['password'], // 本番環境ではハッシュ化推奨
            'available_days' => isset($input['available_days']) ? json_encode($input['available_days'], JSON_UNESCAPED_UNICODE) : null,
            'preferred_time_start' => $input['preferred_time_start'] ?? null,
            'preferred_time_end' => $input['preferred_time_end'] ?? null,
            'work_limit_per_day' => $input['work_limit_per_day'] ?? 8,
            'work_limit_per_month' => $input['work_limit_per_month'] ?? 160
        ]);
        
        sendJsonResponse(['message' => '従業員を追加しました', 'employee_code' => $input['employee_code']], 201);
        
    } catch (PDOException $e) {
        if ($e->getCode() == '23000') {
            sendErrorResponse('従業員コードが既に存在します');
        }
        error_log('Employee insert error: ' . $e->getMessage());
        sendErrorResponse('従業員の追加に失敗しました', 500);
    }
}

function handlePut($db) {
    $input = getJsonInput();
    
    // 必須項目チェック
    validateRequired($input, ['employee_code', 'name', 'business_type']);
    
    // 業務区分チェック
    if (!in_array($input['business_type'], ['事務', '調理'])) {
        sendErrorResponse('業務区分は「事務」または「調理」を指定してください');
    }
    
    // 時間形式チェック
    if (isset($input['preferred_time_start']) && !empty($input['preferred_time_start'])) {
        validateTime($input['preferred_time_start']);
    }
    if (isset($input['preferred_time_end']) && !empty($input['preferred_time_end'])) {
        validateTime($input['preferred_time_end']);
    }
    
    try {
        $sql = "UPDATE employees SET name = :name, business_type = :business_type, 
                available_days = :available_days, preferred_time_start = :preferred_time_start, 
                preferred_time_end = :preferred_time_end, work_limit_per_day = :work_limit_per_day, 
                work_limit_per_month = :work_limit_per_month, updated_at = CURRENT_TIMESTAMP
                WHERE employee_code = :employee_code";
        
        // パスワード更新がある場合
        if (isset($input['password']) && !empty($input['password'])) {
            $sql = "UPDATE employees SET name = :name, business_type = :business_type, password = :password,
                    available_days = :available_days, preferred_time_start = :preferred_time_start, 
                    preferred_time_end = :preferred_time_end, work_limit_per_day = :work_limit_per_day, 
                    work_limit_per_month = :work_limit_per_month, updated_at = CURRENT_TIMESTAMP
                    WHERE employee_code = :employee_code";
        }
        
        $stmt = $db->prepare($sql);
        $params = [
            'employee_code' => $input['employee_code'],
            'name' => $input['name'],
            'business_type' => $input['business_type'],
            'available_days' => isset($input['available_days']) ? json_encode($input['available_days'], JSON_UNESCAPED_UNICODE) : null,
            'preferred_time_start' => $input['preferred_time_start'] ?? null,
            'preferred_time_end' => $input['preferred_time_end'] ?? null,
            'work_limit_per_day' => $input['work_limit_per_day'] ?? 8,
            'work_limit_per_month' => $input['work_limit_per_month'] ?? 160
        ];
        
        if (isset($input['password']) && !empty($input['password'])) {
            $params['password'] = $input['password'];
        }
        
        $stmt->execute($params);
        
        if ($stmt->rowCount() === 0) {
            sendErrorResponse('指定された従業員コードが見つかりません', 404);
        }
        
        sendJsonResponse(['message' => '従業員情報を更新しました']);
        
    } catch (PDOException $e) {
        error_log('Employee update error: ' . $e->getMessage());
        sendErrorResponse('従業員情報の更新に失敗しました', 500);
    }
}

function handleDelete($db) {
    if (!isset($_GET['employee_code'])) {
        sendErrorResponse('従業員コードが指定されていません');
    }
    
    try {
        $stmt = $db->prepare("DELETE FROM employees WHERE employee_code = :employee_code");
        $stmt->execute(['employee_code' => $_GET['employee_code']]);
        
        if ($stmt->rowCount() === 0) {
            sendErrorResponse('指定された従業員コードが見つかりません', 404);
        }
        
        sendJsonResponse(['message' => '従業員を削除しました']);
        
    } catch (PDOException $e) {
        error_log('Employee delete error: ' . $e->getMessage());
        sendErrorResponse('従業員の削除に失敗しました', 500);
    }
}
?>
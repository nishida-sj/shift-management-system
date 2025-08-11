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
    $employee_code = $_GET['employee_code'] ?? null;
    $include_password = $_GET['include_password'] ?? false;
    
    try {
        if ($employee_code) {
            // 個別従業員取得（編集用）
            $stmt = $db->prepare("SELECT * FROM employees WHERE employee_code = :employee_code");
            $stmt->execute(['employee_code' => $employee_code]);
            $employee = $stmt->fetch();
            
            if (!$employee) {
                sendErrorResponse('指定された従業員が見つかりません', 404);
            }
            
            // JSON フィールドをデコード
            if ($employee['available_days']) {
                $employee['available_days'] = json_decode($employee['available_days'], true);
            }
            if ($employee['weekly_schedule']) {
                $employee['weekly_schedule'] = json_decode($employee['weekly_schedule'], true);
            }
            if ($employee['business_types']) {
                $employee['business_types'] = json_decode($employee['business_types'], true);
            } else {
                // 後方互換性: 既存のbusiness_typeから生成
                $employee['business_types'] = convertLegacyBusinessType($employee['business_type'] ?? '事務');
            }
            
            // 編集用の場合はパスワードも返す（管理者のみ）
            if (!$include_password) {
                unset($employee['password']);
            }
            
            sendJsonResponse($employee);
        } else {
            // 全従業員取得（一覧用）
            $stmt = $db->query("SELECT * FROM employees ORDER BY employee_code");
            $employees = $stmt->fetchAll();
            
            foreach ($employees as &$employee) {
                if ($employee['available_days']) {
                    $employee['available_days'] = json_decode($employee['available_days'], true);
                }
                if ($employee['weekly_schedule']) {
                    $employee['weekly_schedule'] = json_decode($employee['weekly_schedule'], true);
                }
                if ($employee['business_types']) {
                    $employee['business_types'] = json_decode($employee['business_types'], true);
                } else {
                    // 後方互換性: 既存のbusiness_typeから生成
                    $employee['business_types'] = convertLegacyBusinessType($employee['business_type'] ?? '事務');
                }
                
                // 一覧表示時はパスワードは返さない
                unset($employee['password']);
            }
            
            sendJsonResponse($employees);
        }
    } catch (PDOException $e) {
        error_log('Employee fetch error: ' . $e->getMessage());
        sendErrorResponse('従業員データの取得に失敗しました', 500);
    }
}

function handlePost($db) {
    $input = getJsonInput();
    error_log('=== 従業員POST処理 ===');
    error_log('受信データ: ' . json_encode($input, JSON_UNESCAPED_UNICODE));
    
    // 必須項目チェック
    validateRequired($input, ['employee_code', 'name', 'password']);
    
    // business_types または business_type のいずれかが必要
    if (!isset($input['business_types']) && !isset($input['business_type'])) {
        sendErrorResponse('business_types または business_type を指定してください');
    }
    
    // business_types が指定されている場合のバリデーション
    if (isset($input['business_types'])) {
        if (!is_array($input['business_types']) || empty($input['business_types'])) {
            sendErrorResponse('business_types は空でない配列である必要があります');
        }
        
        // メイン業務区分が1つだけかチェック
        $mainCount = 0;
        foreach ($input['business_types'] as $bt) {
            if (isset($bt['isMain']) && $bt['isMain']) {
                $mainCount++;
            }
        }
        if ($mainCount !== 1) {
            sendErrorResponse('メイン業務区分を1つ選択してください');
        }
    }
    
    // 時間形式チェック
    if (isset($input['preferred_time_start']) && !empty($input['preferred_time_start'])) {
        validateTime($input['preferred_time_start']);
    }
    if (isset($input['preferred_time_end']) && !empty($input['preferred_time_end'])) {
        validateTime($input['preferred_time_end']);
    }
    
    try {
        // 業務区分データを準備
        $business_types = isset($input['business_types']) ? $input['business_types'] : convertLegacyBusinessType($input['business_type']);
        $business_type = isset($input['business_type']) ? $input['business_type'] : getMainBusinessTypeLegacy($business_types);
        
        error_log('準備した業務区分データ:');
        error_log('business_types: ' . json_encode($business_types, JSON_UNESCAPED_UNICODE));
        error_log('business_type: ' . $business_type);
        
        $sql = "INSERT INTO employees (employee_code, name, business_type, business_types, password, shift_priority, available_days, 
                preferred_time_start, preferred_time_end, weekly_schedule, work_limit_per_day, work_limit_per_month) 
                VALUES (:employee_code, :name, :business_type, :business_types, :password, :shift_priority, :available_days, 
                :preferred_time_start, :preferred_time_end, :weekly_schedule, :work_limit_per_day, :work_limit_per_month)";
        
        $stmt = $db->prepare($sql);
        $stmt->execute([
            'employee_code' => $input['employee_code'],
            'name' => $input['name'],
            'business_type' => $business_type,
            'business_types' => json_encode($business_types, JSON_UNESCAPED_UNICODE),
            'password' => $input['password'], // 本番環境ではハッシュ化推奨
            'shift_priority' => $input['shift_priority'] ?? 0,
            'available_days' => isset($input['available_days']) ? json_encode($input['available_days'], JSON_UNESCAPED_UNICODE) : null,
            'preferred_time_start' => $input['preferred_time_start'] ?? null,
            'preferred_time_end' => $input['preferred_time_end'] ?? null,
            'weekly_schedule' => isset($input['weekly_schedule']) ? json_encode($input['weekly_schedule'], JSON_UNESCAPED_UNICODE) : null,
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
    error_log('=== 従業員PUT処理 ===');
    error_log('受信データ: ' . json_encode($input, JSON_UNESCAPED_UNICODE));
    
    // 必須項目チェック
    validateRequired($input, ['employee_code', 'name']);
    
    // business_types バリデーション
    if (isset($input['business_types'])) {
        if (!is_array($input['business_types']) || empty($input['business_types'])) {
            sendErrorResponse('business_types は空でない配列である必要があります');
        }
        
        // メイン業務区分が1つだけかチェック
        $mainCount = 0;
        foreach ($input['business_types'] as $bt) {
            if (isset($bt['isMain']) && $bt['isMain']) {
                $mainCount++;
            }
        }
        if ($mainCount !== 1) {
            sendErrorResponse('メイン業務区分を1つ選択してください');
        }
    }
    
    // 時間形式チェック
    if (isset($input['preferred_time_start']) && !empty($input['preferred_time_start'])) {
        validateTime($input['preferred_time_start']);
    }
    if (isset($input['preferred_time_end']) && !empty($input['preferred_time_end'])) {
        validateTime($input['preferred_time_end']);
    }
    
    try {
        // 業務区分データを準備
        $business_types = null;
        $business_type = null;
        
        if (isset($input['business_types'])) {
            $business_types = $input['business_types'];
            $business_type = getMainBusinessTypeLegacy($business_types);
        } else if (isset($input['business_type'])) {
            $business_types = convertLegacyBusinessType($input['business_type']);
            $business_type = $input['business_type'];
        }
        
        if ($business_types !== null) {
            error_log('PUT処理の業務区分データ:');
            error_log('business_types: ' . json_encode($business_types, JSON_UNESCAPED_UNICODE));
            error_log('business_type: ' . $business_type);
        }
        
        $sql = "UPDATE employees SET name = :name, shift_priority = :shift_priority,
                available_days = :available_days, preferred_time_start = :preferred_time_start, 
                preferred_time_end = :preferred_time_end, weekly_schedule = :weekly_schedule,
                work_limit_per_day = :work_limit_per_day, work_limit_per_month = :work_limit_per_month, 
                updated_at = CURRENT_TIMESTAMP";
        
        $params = [
            'employee_code' => $input['employee_code'],
            'name' => $input['name'],
            'shift_priority' => $input['shift_priority'] ?? 0,
            'available_days' => isset($input['available_days']) ? json_encode($input['available_days'], JSON_UNESCAPED_UNICODE) : null,
            'preferred_time_start' => $input['preferred_time_start'] ?? null,
            'preferred_time_end' => $input['preferred_time_end'] ?? null,
            'weekly_schedule' => isset($input['weekly_schedule']) ? json_encode($input['weekly_schedule'], JSON_UNESCAPED_UNICODE) : null,
            'work_limit_per_day' => $input['work_limit_per_day'] ?? 8,
            'work_limit_per_month' => $input['work_limit_per_month'] ?? 160
        ];
        
        // 業務区分データを更新する場合
        if ($business_types !== null) {
            $sql .= ", business_types = :business_types, business_type = :business_type";
            $params['business_types'] = json_encode($business_types, JSON_UNESCAPED_UNICODE);
            $params['business_type'] = $business_type;
        }
        
        // パスワード更新がある場合
        if (isset($input['password']) && !empty($input['password'])) {
            $sql .= ", password = :password";
            $params['password'] = $input['password'];
        }
        
        $sql .= " WHERE employee_code = :employee_code";
        
        $stmt = $db->prepare($sql);
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

// 後方互換性: 既存のbusiness_type文字列からbusiness_types配列を生成
function convertLegacyBusinessType($business_type) {
    $code = ($business_type === '調理') ? 'cooking' : 'office';
    return [
        [
            'code' => $code,
            'isMain' => true
        ]
    ];
}

// business_types配列からメイン業務区分の従来形式を取得
function getMainBusinessTypeLegacy($business_types) {
    foreach ($business_types as $bt) {
        if (isset($bt['isMain']) && $bt['isMain']) {
            return ($bt['code'] === 'cooking') ? '調理' : '事務';
        }
    }
    return '事務'; // デフォルト
}
?>
<?php
/**
 * 業務区分マスタ API
 * GET /api/business-types.php - 業務区分一覧取得
 * POST /api/business-types.php - 業務区分保存
 * DELETE /api/business-types.php?code=xxx - 業務区分削除
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
    case 'DELETE':
        handleDelete($db);
        break;
    default:
        sendErrorResponse('Method not allowed', 405);
}

function handleGet($db) {
    try {
        // 業務区分テーブルが存在しない場合は作成
        createTableIfNotExists($db);
        
        $stmt = $db->prepare("SELECT * FROM business_types ORDER BY build_order ASC, code ASC");
        $stmt->execute();
        $businessTypes = $stmt->fetchAll();
        
        // デフォルトデータがない場合は初期データを挿入
        if (empty($businessTypes)) {
            insertDefaultData($db);
            $stmt->execute();
            $businessTypes = $stmt->fetchAll();
        }
        
        sendJsonResponse($businessTypes);
    } catch (PDOException $e) {
        error_log('Business types fetch error: ' . $e->getMessage());
        sendErrorResponse('業務区分の取得に失敗しました', 500);
    }
}

function handlePost($db) {
    $input = getJsonInput();
    
    // 必須項目チェック
    validateRequired($input, ['code', 'name']);
    
    $code = $input['code'];
    $name = $input['name'];
    $description = $input['description'] ?? '';
    $buildOrder = $input['build_order'] ?? $input['buildOrder'] ?? 999;
    
    try {
        // 業務区分テーブルが存在しない場合は作成
        createTableIfNotExists($db);
        
        // 既存データがあるかチェック
        $stmt = $db->prepare("SELECT code FROM business_types WHERE code = :code");
        $stmt->execute(['code' => $code]);
        $existing = $stmt->fetch();
        
        if ($existing) {
            // 更新
            $sql = "UPDATE business_types SET 
                    name = :name, 
                    description = :description, 
                    build_order = :build_order,
                    updated_at = NOW()
                    WHERE code = :code";
        } else {
            // 新規作成
            $sql = "INSERT INTO business_types (code, name, description, build_order, created_at, updated_at) 
                    VALUES (:code, :name, :description, :build_order, NOW(), NOW())";
        }
        
        $params = [
            'code' => $code,
            'name' => $name,
            'description' => $description,
            'build_order' => $buildOrder
        ];
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        
        sendJsonResponse(['success' => true, 'message' => '業務区分を保存しました']);
        
    } catch (PDOException $e) {
        error_log('Business type save error: ' . $e->getMessage());
        sendErrorResponse('業務区分の保存に失敗しました', 500);
    }
}

function handleDelete($db) {
    $code = $_GET['code'] ?? '';
    
    if (empty($code)) {
        sendErrorResponse('業務区分コードが必要です');
    }
    
    try {
        // 業務区分テーブルが存在しない場合は作成
        createTableIfNotExists($db);
        
        // 使用中かチェック（従業員の business_types JSON フィールドをチェック）
        $stmt = $db->prepare("SELECT employee_code, name FROM employees WHERE JSON_SEARCH(business_types, 'one', :code, NULL, '$[*].code') IS NOT NULL");
        $stmt->execute(['code' => $code]);
        $usingEmployees = $stmt->fetchAll();
        
        if (!empty($usingEmployees)) {
            $employeeNames = array_column($usingEmployees, 'name');
            sendErrorResponse('この業務区分は以下の従業員によって使用されているため削除できません: ' . implode('、', $employeeNames));
        }
        
        // 削除実行
        $stmt = $db->prepare("DELETE FROM business_types WHERE code = :code");
        $stmt->execute(['code' => $code]);
        
        if ($stmt->rowCount() > 0) {
            sendJsonResponse(['success' => true, 'message' => '業務区分を削除しました']);
        } else {
            sendErrorResponse('指定された業務区分が見つかりません', 404);
        }
        
    } catch (PDOException $e) {
        error_log('Business type delete error: ' . $e->getMessage());
        sendErrorResponse('業務区分の削除に失敗しました', 500);
    }
}

function createTableIfNotExists($db) {
    $sql = "CREATE TABLE IF NOT EXISTS business_types (
        code VARCHAR(50) PRIMARY KEY COMMENT '業務区分コード',
        name VARCHAR(100) NOT NULL COMMENT '業務区分名',
        description TEXT COMMENT '説明',
        build_order INT DEFAULT 999 COMMENT 'シフト構築順序',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) COMMENT='業務区分マスタ'";
    
    $db->exec($sql);
}

function insertDefaultData($db) {
    $defaultData = [
        ['code' => 'office', 'name' => '事務', 'description' => 'デスクワーク中心の業務', 'build_order' => 1],
        ['code' => 'cooking', 'name' => '調理', 'description' => 'キッチンでの調理・準備業務', 'build_order' => 2]
    ];
    
    $sql = "INSERT INTO business_types (code, name, description, build_order, created_at, updated_at) 
            VALUES (:code, :name, :description, :build_order, NOW(), NOW())";
    $stmt = $db->prepare($sql);
    
    foreach ($defaultData as $data) {
        $stmt->execute($data);
    }
}
?>
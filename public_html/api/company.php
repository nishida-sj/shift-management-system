<?php
/**
 * 会社マスタ API
 * GET /api/company.php - 会社情報取得
 * POST /api/company.php - 会社情報保存
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
    default:
        sendErrorResponse('Method not allowed', 405);
}

function handleGet($db) {
    try {
        // 会社情報テーブルが存在しない場合は作成
        createTableIfNotExists($db);
        
        $stmt = $db->prepare("SELECT * FROM company_info ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $company = $stmt->fetch();
        
        if ($company) {
            sendJsonResponse($company);
        } else {
            // デフォルト値を返す
            sendJsonResponse([
                'name' => '',
                'closing_date' => 'end-of-month',
                'manager_name' => '',
                'manager_contact' => '',
                'updated_at' => null
            ]);
        }
    } catch (PDOException $e) {
        error_log('Company info fetch error: ' . $e->getMessage());
        sendErrorResponse('会社情報の取得に失敗しました', 500);
    }
}

function handlePost($db) {
    $input = getJsonInput();
    
    // 必須項目チェック
    validateRequired($input, ['name', 'closing_date', 'manager_name', 'manager_contact']);
    
    try {
        // 会社情報テーブルが存在しない場合は作成
        createTableIfNotExists($db);
        
        // 既存データがあるかチェック
        $stmt = $db->prepare("SELECT id FROM company_info ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $existing = $stmt->fetch();
        
        if ($existing) {
            // 更新
            $sql = "UPDATE company_info SET 
                    name = :name, 
                    closing_date = :closing_date, 
                    manager_name = :manager_name, 
                    manager_contact = :manager_contact,
                    updated_at = NOW()
                    WHERE id = :id";
            $params = [
                'name' => $input['name'],
                'closing_date' => $input['closing_date'],
                'manager_name' => $input['manager_name'],
                'manager_contact' => $input['manager_contact'],
                'id' => $existing['id']
            ];
        } else {
            // 新規作成
            $sql = "INSERT INTO company_info (name, closing_date, manager_name, manager_contact, created_at, updated_at) 
                    VALUES (:name, :closing_date, :manager_name, :manager_contact, NOW(), NOW())";
            $params = [
                'name' => $input['name'],
                'closing_date' => $input['closing_date'],
                'manager_name' => $input['manager_name'],
                'manager_contact' => $input['manager_contact']
            ];
        }
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        
        sendJsonResponse(['success' => true, 'message' => '会社情報を保存しました']);
        
    } catch (PDOException $e) {
        error_log('Company info save error: ' . $e->getMessage());
        sendErrorResponse('会社情報の保存に失敗しました', 500);
    }
}

function createTableIfNotExists($db) {
    $sql = "CREATE TABLE IF NOT EXISTS company_info (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL COMMENT '会社名',
        closing_date ENUM('end-of-month', '5', '10', '15', '20', '25') NOT NULL DEFAULT 'end-of-month' COMMENT '締め日',
        manager_name VARCHAR(100) NOT NULL COMMENT '責任者名',
        manager_contact VARCHAR(255) NOT NULL COMMENT '責任者連絡先',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) COMMENT='会社マスタ情報'";
    
    $db->exec($sql);
}
?>
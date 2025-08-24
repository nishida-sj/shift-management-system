<?php
require_once 'config.php';

$db = Database::getInstance()->getConnection();

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        getCompanyInfo($db);
        break;
    case 'POST':
        saveCompanyInfo($db);
        break;
    default:
        sendErrorResponse('不正なリクエストメソッドです', 405);
}

function getCompanyInfo($db) {
    try {
        $stmt = $db->prepare("SELECT name, closing_date, manager_name, manager_contact FROM company_info ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $result = $stmt->fetch();
        
        if ($result) {
            sendJsonResponse([
                'name' => $result['name'] ?: 'サンプル会社',
                'address' => '', // 既存テーブルにはアドレスフィールドがない
                'phone' => $result['manager_contact'] ?: '03-0000-0000',
                'email' => '', // 既存テーブルにはメールフィールドがない
                'closing_date' => $result['closing_date'] ?: '',
                'manager_name' => $result['manager_name'] ?: ''
            ]);
        } else {
            // デフォルト会社情報を返す
            $defaultCompanyInfo = [
                'name' => 'サンプル会社',
                'address' => '〒000-0000 東京都',
                'phone' => '03-0000-0000',
                'email' => 'info@example.com',
                'closing_date' => '',
                'manager_name' => ''
            ];
            sendJsonResponse($defaultCompanyInfo);
        }
    } catch (Exception $e) {
        error_log('会社情報取得エラー: ' . $e->getMessage());
        sendErrorResponse('会社情報の取得に失敗しました', 500);
    }
}

function saveCompanyInfo($db) {
    try {
        $input = getJsonInput();
        
        // 必須フィールドのバリデーション
        validateRequired($input, ['name']);
        
        $name = $input['name'];
        $closing_date = $input['closing_date'] ?? null;
        $manager_name = $input['manager_name'] ?? '';
        $manager_contact = $input['phone'] ?? $input['manager_contact'] ?? '';
        
        // 既存のレコードを削除して新しいレコードを挿入
        $db->beginTransaction();
        
        // 既存データを削除
        $stmt = $db->prepare("DELETE FROM company_info");
        $stmt->execute();
        
        // 新しいデータを挿入
        $stmt = $db->prepare("INSERT INTO company_info (name, closing_date, manager_name, manager_contact) VALUES (?, ?, ?, ?)");
        $stmt->execute([$name, $closing_date, $manager_name, $manager_contact]);
        
        $db->commit();
        sendJsonResponse(['success' => true, 'message' => '会社情報を保存しました']);
        
    } catch (Exception $e) {
        $db->rollback();
        error_log('会社情報保存エラー: ' . $e->getMessage());
        sendErrorResponse('会社情報の保存に失敗しました', 500);
    }
}
?>
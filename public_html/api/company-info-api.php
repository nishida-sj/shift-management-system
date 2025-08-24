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
        $stmt = $db->prepare("SELECT company_data FROM company_info ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $result = $stmt->fetch();
        
        if ($result) {
            sendJsonResponse(json_decode($result['company_data'], true));
        } else {
            // デフォルト会社情報を返す
            $defaultCompanyInfo = [
                'name' => 'サンプル会社',
                'address' => '〒000-0000 東京都',
                'phone' => '03-0000-0000',
                'email' => 'info@example.com'
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
        
        // データを JSON 形式で保存
        $companyData = json_encode($input, JSON_UNESCAPED_UNICODE);
        
        // 既存のレコードを削除して新しいレコードを挿入
        $db->beginTransaction();
        
        // 既存データを削除
        $stmt = $db->prepare("DELETE FROM company_info");
        $stmt->execute();
        
        // 新しいデータを挿入
        $stmt = $db->prepare("INSERT INTO company_info (company_data) VALUES (?)");
        $stmt->execute([$companyData]);
        
        $db->commit();
        sendJsonResponse(['success' => true, 'message' => '会社情報を保存しました']);
        
    } catch (Exception $e) {
        $db->rollback();
        error_log('会社情報保存エラー: ' . $e->getMessage());
        sendErrorResponse('会社情報の保存に失敗しました', 500);
    }
}
?>
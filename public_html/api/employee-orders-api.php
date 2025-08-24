<?php
require_once 'config.php';

$db = Database::getInstance()->getConnection();

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        getEmployeeOrders($db);
        break;
    case 'POST':
        saveEmployeeOrders($db);
        break;
    default:
        sendErrorResponse('不正なリクエストメソッドです', 405);
}

function getEmployeeOrders($db) {
    try {
        $stmt = $db->prepare("SELECT business_type_code, order_data FROM employee_orders");
        $stmt->execute();
        $results = $stmt->fetchAll();
        
        $orders = [];
        foreach ($results as $row) {
            $orders[$row['business_type_code']] = json_decode($row['order_data'] ?: '[]', true);
        }
        
        sendJsonResponse($orders);
    } catch (Exception $e) {
        error_log('従業員並び順取得エラー: ' . $e->getMessage());
        sendErrorResponse('従業員並び順の取得に失敗しました', 500);
    }
}

function saveEmployeeOrders($db) {
    try {
        $input = getJsonInput();
        
        // 必須フィールドのバリデーション
        validateRequired($input, ['businessTypeCode', 'orders']);
        
        $businessTypeCode = $input['businessTypeCode'];
        $orders = $input['orders'];
        
        // データを JSON 形式で保存
        $orderData = json_encode($orders, JSON_UNESCAPED_UNICODE);
        
        // UPSERT (INSERT OR UPDATE)
        $stmt = $db->prepare("
            INSERT INTO employee_orders (business_type_code, order_data) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE 
            order_data = VALUES(order_data), 
            updated_at = CURRENT_TIMESTAMP
        ");
        
        $stmt->execute([$businessTypeCode, $orderData]);
        
        sendJsonResponse(['success' => true, 'message' => '従業員並び順を保存しました']);
        
    } catch (Exception $e) {
        error_log('従業員並び順保存エラー: ' . $e->getMessage());
        sendErrorResponse('従業員並び順の保存に失敗しました', 500);
    }
}
?>
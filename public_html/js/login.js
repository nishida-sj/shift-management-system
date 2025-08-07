$(document).ready(function() {
    // 既にログイン済みの場合はリダイレクト
    checkExistingLogin();
    
    // ログアウト処理（URLパラメータでlogout=trueの場合）
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('logout') === 'true') {
        localStorage.removeItem('shiftApp_user');
        window.history.replaceState({}, document.title, window.location.pathname);
        showSuccess('ログアウトしました。');
    }

    // ログインフォームの送信処理
    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        
        const userType = $('#user-type').val();
        const username = $('#username').val();
        const password = $('#password').val();
        
        // バリデーション
        if (!userType || !username || !password) {
            showError('全ての項目を入力してください。');
            return;
        }
        
        // 認証処理（テスト用）
        if (authenticate(userType, username, password)) {
            // ログイン成功
            const userData = {
                userType: userType,
                username: username,
                loginTime: new Date().toISOString()
            };
            
            // ローカルストレージに保存
            localStorage.setItem('shiftApp_user', JSON.stringify(userData));
            
            // リダイレクト
            if (userType === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'input.html';
            }
        } else {
            showError('ユーザー名またはパスワードが正しくありません。');
        }
    });
    
    // エラーメッセージ表示
    function showError(message) {
        $('#error-message').text(message).show();
        setTimeout(function() {
            $('#error-message').fadeOut();
        }, 5000);
    }
    
    // 成功メッセージ表示
    function showSuccess(message) {
        // 成功メッセージ用の要素がない場合は作成
        if ($('#success-message').length === 0) {
            $('#error-message').after('<div id="success-message" class="alert alert-success" style="display: none;"></div>');
        }
        $('#success-message').text(message).show();
        setTimeout(function() {
            $('#success-message').fadeOut();
        }, 3000);
    }
    
    // 認証処理
    function authenticate(userType, username, password) {
        if (userType === 'admin') {
            // 管理者の固定認証
            return username === 'admin' && password === 'admin123';
        } else if (userType === 'employee') {
            // 従業員マスタからの認証
            try {
                // DataManagerのインスタンスを作成
                const dataManager = new DataManager();
                const employees = dataManager.getEmployees();
                const employee = employees.find(emp => emp.code === username);
                
                if (employee && employee.password === password) {
                    console.log('従業員ログイン成功:', employee.name, 'ID:', employee.code);
                    return true;
                }
                console.log('従業員ログイン失敗 - ID:', username, '利用可能な従業員:', employees.map(e => `${e.code}(${e.name})`));
                return false;
            } catch (error) {
                console.error('従業員マスタ取得エラー:', error);
                return false;
            }
        }
        
        return false;
    }
    
    // 既存ログインチェック
    function checkExistingLogin() {
        const userData = localStorage.getItem('shiftApp_user');
        if (userData) {
            const user = JSON.parse(userData);
            const loginTime = new Date(user.loginTime);
            const now = new Date();
            
            // 24時間以内のログインは有効とする
            if (now - loginTime < 24 * 60 * 60 * 1000) {
                if (user.userType === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'input.html';
                }
            } else {
                // 期限切れの場合はログイン情報を削除
                localStorage.removeItem('shiftApp_user');
            }
        }
    }
});
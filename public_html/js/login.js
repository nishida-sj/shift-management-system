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
    $('#login-form').on('submit', async function(e) {
        e.preventDefault();
        
        const userType = $('#user-type').val();
        const username = $('#username').val();
        const password = $('#password').val();
        
        // バリデーション
        if (!userType || !username || !password) {
            showError('全ての項目を入力してください。');
            return;
        }
        
        try {
            // API認証処理
            const response = await apiClient.login(username, password);
            
            if (response.success) {
                // ログイン成功
                const userData = {
                    userType: response.user_type,
                    username: response.user_type === 'admin' ? response.username : response.employee_code,
                    name: response.name || response.username,
                    business_type: response.business_type || null,
                    loginTime: new Date().toISOString()
                };
                
                // ローカルストレージに保存
                localStorage.setItem('shiftApp_user', JSON.stringify(userData));
                
                // リダイレクト
                if (response.user_type === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'input.html';
                }
            } else {
                showError('ユーザー名またはパスワードが正しくありません。');
            }
        } catch (error) {
            console.error('ログインエラー:', error);
            showError('ログイン処理中にエラーが発生しました。');
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
    
    // 旧認証処理（API移行により不要）
    // function authenticate(...) { ... }
    
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
$(document).ready(function() {
    // 初期表示
    loadCompanyInfo();
    
    // フォーム送信
    $('#company-form').on('submit', function(e) {
        e.preventDefault();
        saveCompanyInfo();
    });
    
    // リセットボタン
    $('#reset-btn').on('click', function() {
        if (confirm('入力内容をリセットしますか？')) {
            resetForm();
        }
    });
    
    // 会社情報を読み込み
    function loadCompanyInfo() {
        try {
            const companyInfo = dataManager.getCompanyInfo();
            
            if (companyInfo && Object.keys(companyInfo).length > 0) {
                // フォームに値を設定
                $('#company-name').val(companyInfo.name || '');
                $('#closing-date').val(companyInfo.closingDate || '');
                $('#manager-name').val(companyInfo.managerName || '');
                $('#manager-contact').val(companyInfo.managerContact || '');
                
                // 現在の情報を表示
                displayCompanyInfo(companyInfo);
            } else {
                displayNoCompanyInfo();
            }
        } catch (error) {
            console.error('会社情報読み込みエラー:', error);
            showError('会社情報の読み込みに失敗しました。');
        }
    }
    
    // 会社情報を保存
    function saveCompanyInfo() {
        try {
            const companyInfo = {
                name: $('#company-name').val().trim(),
                closingDate: $('#closing-date').val(),
                managerName: $('#manager-name').val().trim(),
                managerContact: $('#manager-contact').val().trim(),
                updatedAt: new Date().toISOString()
            };
            
            // バリデーション
            if (!companyInfo.name) {
                showError('会社名を入力してください。');
                return;
            }
            if (!companyInfo.closingDate) {
                showError('締め日を選択してください。');
                return;
            }
            if (!companyInfo.managerName) {
                showError('責任者名を入力してください。');
                return;
            }
            if (!companyInfo.managerContact) {
                showError('責任者連絡先を入力してください。');
                return;
            }
            
            // 連絡先の簡単なバリデーション
            if (!isValidContact(companyInfo.managerContact)) {
                showError('責任者連絡先の形式が正しくありません。電話番号またはメールアドレスを入力してください。');
                return;
            }
            
            dataManager.saveCompanyInfo(companyInfo);
            displayCompanyInfo(companyInfo);
            showSuccess('会社情報を保存しました。');
            
        } catch (error) {
            console.error('会社情報保存エラー:', error);
            showError('会社情報の保存に失敗しました。');
        }
    }
    
    // 連絡先のバリデーション
    function isValidContact(contact) {
        // 電話番号の簡単なチェック（数字とハイフンを含む）
        const phonePattern = /^[\d\-\+\(\)\s]{10,}$/;
        // メールアドレスの簡単なチェック
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        return phonePattern.test(contact) || emailPattern.test(contact);
    }
    
    // フォームをリセット
    function resetForm() {
        $('#company-form')[0].reset();
        loadCompanyInfo(); // 保存済みの情報を再読み込み
    }
    
    // 会社情報を表示
    function displayCompanyInfo(companyInfo) {
        const closingDateText = getClosingDateText(companyInfo.closingDate);
        const updatedAt = companyInfo.updatedAt ? 
            new Date(companyInfo.updatedAt).toLocaleString('ja-JP') : '不明';
        
        const html = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <div style="margin-bottom: 15px;">
                        <strong style="color: #2c3e50;">会社名:</strong><br>
                        <span style="font-size: 16px;">${escapeHtml(companyInfo.name)}</span>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong style="color: #2c3e50;">締め日:</strong><br>
                        <span style="font-size: 16px;">${closingDateText}</span>
                    </div>
                </div>
                <div>
                    <div style="margin-bottom: 15px;">
                        <strong style="color: #2c3e50;">責任者名:</strong><br>
                        <span style="font-size: 16px;">${escapeHtml(companyInfo.managerName)}</span>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong style="color: #2c3e50;">責任者連絡先:</strong><br>
                        <span style="font-size: 16px;">${escapeHtml(companyInfo.managerContact)}</span>
                    </div>
                </div>
            </div>
            <div style="text-align: right; margin-top: 15px; font-size: 12px; color: #666;">
                最終更新: ${updatedAt}
            </div>
        `;
        
        $('#company-display').html(html);
    }
    
    // 会社情報未設定時の表示
    function displayNoCompanyInfo() {
        $('#company-display').html(`
            <p style="color: #666; text-align: center; font-style: italic;">
                会社情報が設定されていません
            </p>
        `);
    }
    
    // 締め日のテキスト表示
    function getClosingDateText(closingDate) {
        switch (closingDate) {
            case 'end-of-month':
                return '月末';
            case '5':
                return '毎月5日';
            case '10':
                return '毎月10日';
            case '15':
                return '毎月15日';
            case '20':
                return '毎月20日';
            case '25':
                return '毎月25日';
            default:
                return '未設定';
        }
    }
    
    // HTMLエスケープ
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 成功メッセージ表示
    function showSuccess(message) {
        $('#success-message').text(message).show();
        setTimeout(function() {
            $('#success-message').fadeOut();
        }, 3000);
    }
    
    // エラーメッセージ表示
    function showError(message) {
        $('#error-message').text(message).show();
        setTimeout(function() {
            $('#error-message').fadeOut();
        }, 5000);
    }
});
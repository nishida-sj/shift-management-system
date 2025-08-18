$(document).ready(function() {
    let currentBusinessTypes = [];
    let editingIndex = -1;
    
    // 初期表示
    loadBusinessTypes();
    
    // 新規追加ボタン
    $('#add-business-type-btn').on('click', function() {
        openModal('新規業務区分追加');
        clearForm();
        editingIndex = -1;
    });
    
    // キャンセルボタン
    $('#cancel-btn').on('click', function() {
        closeModal();
    });
    
    // フォーム送信
    $('#business-type-form').on('submit', function(e) {
        e.preventDefault();
        saveBusinessType();
    });
    
    // 業務区分一覧を読み込み
    async function loadBusinessTypes() {
        try {
            currentBusinessTypes = await apiClient.getBusinessTypes();
            renderBusinessTypeList();
        } catch (error) {
            console.error('業務区分データ取得エラー:', error);
            showError('業務区分データの取得に失敗しました。');
        }
    }
    
    // 業務区分一覧を描画
    function renderBusinessTypeList() {
        // 構築順でソート
        const sortedBusinessTypes = [...currentBusinessTypes].sort((a, b) => {
            const orderA = a.build_order || 999;
            const orderB = b.build_order || 999;
            return orderA - orderB;
        });
        
        let html = '<table class="table"><thead><tr>';
        html += '<th>構築順</th><th>業務区分コード</th><th>業務区分名</th><th>説明</th><th>操作</th>';
        html += '</tr></thead><tbody>';
        
        sortedBusinessTypes.forEach((businessType, index) => {
            const originalIndex = currentBusinessTypes.findIndex(bt => bt.code === businessType.code);
            html += `
                <tr>
                    <td><span style="background: #3498db; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">${businessType.build_order || '-'}</span></td>
                    <td>${businessType.code}</td>
                    <td>${businessType.name}</td>
                    <td>${businessType.description || ''}</td>
                    <td>
                        <button class="btn btn-primary edit-btn" data-index="${originalIndex}" style="margin-right: 5px;">編集</button>
                        <button class="btn btn-secondary delete-btn" data-index="${originalIndex}">削除</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        $('#business-type-list').html(html);
        
        // イベントハンドラ設定
        $('.edit-btn').on('click', function() {
            const index = $(this).data('index');
            editBusinessType(index);
        });
        
        $('.delete-btn').on('click', function() {
            const index = $(this).data('index');
            deleteBusinessType(index);
        });
    }
    
    // モーダルを開く
    function openModal(title) {
        $('#modal-title').text(title);
        $('#business-type-modal').show();
    }
    
    // モーダルを閉じる
    function closeModal() {
        $('#business-type-modal').hide();
    }
    
    // フォームをクリア
    function clearForm() {
        $('#bt-code').val('').prop('readonly', false);
        $('#bt-name').val('');
        $('#bt-description').val('');
        $('#bt-build-order').val('');
    }
    
    // 業務区分編集
    function editBusinessType(index) {
        const businessType = currentBusinessTypes[index];
        editingIndex = index;
        
        openModal('業務区分情報編集');
        
        $('#bt-code').val(businessType.code).prop('readonly', true);
        $('#bt-name').val(businessType.name);
        $('#bt-description').val(businessType.description || '');
        $('#bt-build-order').val(businessType.build_order || '');
    }
    
    // 業務区分削除
    async function deleteBusinessType(index) {
        const businessType = currentBusinessTypes[index];
        
        if (confirm(`業務区分「${businessType.name}」を削除しますか？\nこの操作は取り消せません。`)) {
            try {
                await apiClient.deleteBusinessType(businessType.code);
                await loadBusinessTypes(); // データを再読み込み
                showSuccess('業務区分を削除しました。');
            } catch (error) {
                console.error('業務区分削除エラー:', error);
                showError(error.message || '業務区分の削除に失敗しました。');
            }
        }
    }
    
    // 業務区分保存
    async function saveBusinessType() {
        // 入力値取得
        const code = $('#bt-code').val().trim();
        const name = $('#bt-name').val().trim();
        const description = $('#bt-description').val().trim();
        const buildOrder = parseInt($('#bt-build-order').val()) || 999;
        
        // バリデーション
        if (!code || !name) {
            showError('業務区分コードと業務区分名を入力してください。');
            return;
        }
        
        if (isNaN(buildOrder) || buildOrder < 1) {
            showError('自動シフト構築順は1以上の数値を入力してください。');
            return;
        }
        
        // コードの形式チェック（英数字のみ）
        if (!/^[a-zA-Z0-9_]+$/.test(code)) {
            showError('業務区分コードは英数字とアンダースコアのみ使用できます。');
            return;
        }
        
        // 業務区分データを作成
        const businessTypeData = {
            code: code,
            name: name,
            description: description,
            build_order: buildOrder
        };
        
        // 保存
        try {
            await apiClient.saveBusinessType(businessTypeData);
            await loadBusinessTypes(); // データを再読み込み
            
            if (editingIndex === -1) {
                showSuccess('新規業務区分を追加しました。');
            } else {
                showSuccess('業務区分情報を更新しました。');
            }
            
            closeModal();
        } catch (error) {
            console.error('業務区分保存エラー:', error);
            showError(error.message || '業務区分の保存に失敗しました。');
        }
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
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
    function loadBusinessTypes() {
        currentBusinessTypes = dataManager.getBusinessTypes();
        renderBusinessTypeList();
    }
    
    // 業務区分一覧を描画
    function renderBusinessTypeList() {
        let html = '<table class="table"><thead><tr>';
        html += '<th>業務区分コード</th><th>業務区分名</th><th>説明</th><th>操作</th>';
        html += '</tr></thead><tbody>';
        
        currentBusinessTypes.forEach((businessType, index) => {
            html += `
                <tr>
                    <td>${businessType.code}</td>
                    <td>${businessType.name}</td>
                    <td>${businessType.description || ''}</td>
                    <td>
                        <button class="btn btn-primary edit-btn" data-index="${index}" style="margin-right: 5px;">編集</button>
                        <button class="btn btn-secondary delete-btn" data-index="${index}">削除</button>
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
    }
    
    // 業務区分編集
    function editBusinessType(index) {
        const businessType = currentBusinessTypes[index];
        editingIndex = index;
        
        openModal('業務区分情報編集');
        
        $('#bt-code').val(businessType.code).prop('readonly', true);
        $('#bt-name').val(businessType.name);
        $('#bt-description').val(businessType.description || '');
    }
    
    // 業務区分削除
    async function deleteBusinessType(index) {
        const businessType = currentBusinessTypes[index];
        
        // 削除前チェック：現在存在する従業員でこの業務区分を使用しているかチェック
        try {
            const apiEmployees = await apiClient.getEmployees();
            const isUsed = apiEmployees.some(emp => emp.business_type === businessType.name);
            
            if (isUsed) {
                const usingEmployees = apiEmployees
                    .filter(emp => emp.business_type === businessType.name)
                    .map(emp => emp.name)
                    .join('、');
                showError(`この業務区分は以下の従業員によって使用されているため削除できません:\n${usingEmployees}`);
                return;
            }
            
            if (confirm(`業務区分「${businessType.name}」を削除しますか？\n現在使用している従業員はいません。\n\nこの操作は取り消せません。`)) {
                currentBusinessTypes.splice(index, 1);
                dataManager.saveBusinessTypes(currentBusinessTypes);
                renderBusinessTypeList();
                showSuccess('業務区分を削除しました。');
            }
        } catch (error) {
            console.error('従業員データ取得エラー:', error);
            // APIエラーの場合は従来通りの確認で削除を許可
            if (confirm(`業務区分「${businessType.name}」を削除しますか？\n※従業員データの確認ができませんでした。\n\nこの操作は取り消せません。`)) {
                currentBusinessTypes.splice(index, 1);
                dataManager.saveBusinessTypes(currentBusinessTypes);
                renderBusinessTypeList();
                showSuccess('業務区分を削除しました。');
            }
        }
    }
    
    // 業務区分保存
    function saveBusinessType() {
        // 入力値取得
        const code = $('#bt-code').val().trim();
        const name = $('#bt-name').val().trim();
        const description = $('#bt-description').val().trim();
        
        // バリデーション
        if (!code || !name) {
            showError('業務区分コードと業務区分名を入力してください。');
            return;
        }
        
        // コードの形式チェック（英数字のみ）
        if (!/^[a-zA-Z0-9_]+$/.test(code)) {
            showError('業務区分コードは英数字とアンダースコアのみ使用できます。');
            return;
        }
        
        // 業務区分コードの重複チェック（新規の場合）
        if (editingIndex === -1) {
            const existingBusinessType = currentBusinessTypes.find(bt => bt.code === code);
            if (existingBusinessType) {
                showError('この業務区分コードは既に使用されています。');
                return;
            }
        }
        
        // 業務区分データを作成
        const businessTypeData = {
            code: code,
            name: name,
            description: description
        };
        
        // 保存
        if (editingIndex === -1) {
            // 新規追加
            currentBusinessTypes.push(businessTypeData);
            showSuccess('新規業務区分を追加しました。');
        } else {
            // 更新
            currentBusinessTypes[editingIndex] = businessTypeData;
            showSuccess('業務区分情報を更新しました。');
        }
        
        dataManager.saveBusinessTypes(currentBusinessTypes);
        renderBusinessTypeList();
        closeModal();
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
// 勤怠申請の承認（管理者）
// attendance-approval.html で使用。従業員からの打刻修正申請を承認・却下する。
$(document).ready(function() {
    const userData = JSON.parse(localStorage.getItem('shiftApp_user') || 'null');

    // 管理者ログインでない場合はログイン画面へ
    if (!userData || userData.userType !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    loadRequests();

    $('#reload-btn').on('click', loadRequests);
    $('#status-filter').on('change', loadRequests);

    // 申請一覧を読み込み
    async function loadRequests() {
        const status = $('#status-filter').val();
        $('#approval-list-container').html('<p style="color:#7f8c8d;">読み込み中...</p>');

        try {
            const params = {};
            if (status) params.status = status;

            const list = await apiClient.getAttendanceRequests(params);
            renderList(list || []);
        } catch (e) {
            console.error('申請一覧取得エラー:', e);
            $('#approval-list-container').html(
                '<p style="color:#e74c3c;">申請一覧を取得できませんでした。</p>'
            );
        }
    }

    // 一覧を描画
    function renderList(list) {
        if (list.length === 0) {
            $('#approval-list-container').html(
                '<p style="color:#7f8c8d;">該当する申請はありません。</p>'
            );
            return;
        }

        let html = '<table class="table"><thead><tr>' +
            '<th>対象日</th><th>従業員</th><th>申請内容</th><th>事由</th><th>理由</th><th>状態</th><th>操作</th>' +
            '</tr></thead><tbody>';

        list.forEach(r => {
            const inT = r.clock_in ? r.clock_in.substring(0, 5) : '—';
            const outT = r.clock_out ? r.clock_out.substring(0, 5) : '—';
            const breakLabel = Number(r.break_none) === 1 ? '休憩なし' : '事由なし';
            const isPending = r.status === 'pending';

            // 未承認のみ承認・却下できる
            const actions = isPending
                ? `<button type="button" class="btn btn-success approve-btn" data-id="${r.id}" style="margin-right:6px;">承認</button>` +
                  `<button type="button" class="btn btn-secondary reject-btn" data-id="${r.id}">却下</button>`
                : '';

            const comment = r.admin_comment
                ? `<br><small style="color:#7f8c8d;">${escapeHtml(r.admin_comment)}</small>`
                : '';

            html += '<tr>' +
                `<td style="text-align:center;">${formatDateLabel(r.work_date)}</td>` +
                `<td>${escapeHtml(r.name || r.employee_code)}</td>` +
                `<td style="text-align:center;">${inT} - ${outT}</td>` +
                `<td style="text-align:center;">${breakLabel}</td>` +
                `<td>${escapeHtml(r.reason || '')}</td>` +
                `<td style="text-align:center;">${statusLabel(r.status)}${comment}</td>` +
                `<td style="text-align:center;">${actions}</td>` +
                '</tr>';
        });

        html += '</tbody></table>';
        $('#approval-list-container').html(html);

        $('.approve-btn').on('click', function() {
            review($(this).data('id'), 'approved');
        });
        $('.reject-btn').on('click', function() {
            review($(this).data('id'), 'rejected');
        });
    }

    // 承認・却下を実行
    async function review(id, status) {
        const isApprove = status === 'approved';

        if (!confirm(isApprove ? 'この申請を承認しますか？打刻データに反映されます。' : 'この申請を却下しますか？')) {
            return;
        }

        // 却下時は理由を入力できる
        let comment = null;
        if (!isApprove) {
            comment = prompt('却下理由（任意）', '');
            if (comment === null) return; // キャンセル
            comment = comment.trim() || null;
        }

        try {
            const res = await apiClient.reviewAttendanceRequest(id, status, comment);
            showMessage(res.message || '処理しました。', true);
            await loadRequests();
        } catch (e) {
            console.error('承認処理エラー:', e);
            showMessage(e.message || '処理に失敗しました。', false);
        }
    }

    function statusLabel(status) {
        if (status === 'approved') {
            return '<span style="color:#e74c3c; font-weight:bold;">承認済</span>';
        }
        if (status === 'rejected') {
            return '<span style="color:#7f8c8d;">却下</span>';
        }
        return '<span style="color:#f39c12;">申請中</span>';
    }

    // YYYY-MM-DD → YYYY/M/D
    function formatDateLabel(dateStr) {
        const s = String(dateStr).substring(0, 10);
        const parts = s.split('-');
        if (parts.length !== 3) return s;
        return `${parts[0]}/${Number(parts[1])}/${Number(parts[2])}`;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showMessage(msg, ok) {
        const el = $('#approval-message');
        el.removeClass('alert-success alert-danger')
          .addClass(ok ? 'alert-success' : 'alert-danger')
          .text(msg).show();
        setTimeout(function() { el.fadeOut(); }, 4000);
    }
});

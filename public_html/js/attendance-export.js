// 勤怠データ出力（管理者）
$(document).ready(function() {
    setPreset('prev16'); // 既定は締め期間（前月16日〜当月15日）

    $('#preview-btn').on('click', loadPreview);
    $('#export-btn').on('click', exportFile);
    $('.preset-btn').on('click', function() {
        setPreset($(this).data('preset'));
        loadPreview();
    });

    loadPreview();

    // ---- 期間プリセット ----
    function setPreset(preset) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth(); // 0-11
        let start, end;

        switch (preset) {
            case 'cur16': // 当月16日〜翌月15日
                start = new Date(y, m, 16);
                end = new Date(y, m + 1, 15);
                break;
            case 'curMonth': // 当月1日〜末日
                start = new Date(y, m, 1);
                end = new Date(y, m + 1, 0);
                break;
            case 'prevMonth': // 前月1日〜末日
                start = new Date(y, m - 1, 1);
                end = new Date(y, m, 0);
                break;
            case 'prev16': // 前月16日〜当月15日
            default:
                start = new Date(y, m - 1, 16);
                end = new Date(y, m, 15);
                break;
        }

        $('#start-date').val(toDateStr(start));
        $('#end-date').val(toDateStr(end));
    }

    function toDateStr(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    }

    // 入力された期間を取得（不正なら null）
    function getRange() {
        const start = $('#start-date').val();
        const end = $('#end-date').val();
        if (!start || !end) {
            showError('開始日と終了日を指定してください。');
            return null;
        }
        if (start > end) {
            showError('開始日が終了日より後になっています。');
            return null;
        }
        return { start, end };
    }

    // ---- プレビュー表示 ----
    async function loadPreview() {
        const range = getRange();
        if (!range) return;

        try {
            const records = await apiClient.getAttendanceRange(range.start, range.end);
            renderTable(records, range);
            checkAttendanceCodes(records);
        } catch (e) {
            console.error('勤怠取得エラー:', e);
            showError('勤怠データの取得に失敗しました。');
        }
    }

    // 勤怠コード未設定の従業員を警告表示
    function checkAttendanceCodes(records) {
        const missing = {};
        (records || []).forEach(r => {
            if (!r.attendance_code) {
                missing[r.employee_code] = r.name || r.employee_code;
            }
        });

        const names = Object.keys(missing).map(code => `${missing[code]}（${code}）`);
        if (names.length === 0) {
            $('#warning-message').hide();
            return;
        }

        $('#warning-message').html(
            '勤怠コード（社員CD）が未設定の従業員がいます: <strong>' + names.join('、') + '</strong><br>' +
            'このままでは該当分は出力されません。<a href="employee-master.html">従業員マスタ</a>で勤怠用コードを設定するか、' +
            '下の「従業員コードを社員CDとして出力する」にチェックを入れてください。'
        ).show();
    }

    function renderTable(records, range) {
        const header = `<p style="color:#34495e; margin-bottom:8px;">対象期間: ${range.start} 〜 ${range.end}（${(records || []).length}件）</p>`;

        if (!records || records.length === 0) {
            $('#attendance-table').html(header + '<p style="color:#7f8c8d;">該当する打刻データがありません。</p>');
            return;
        }

        let html = header + '<table class="table"><thead><tr>' +
            '<th>勤怠コード</th><th>従業員コード</th><th>氏名</th><th>日付</th>' +
            '<th>出勤</th><th>退勤</th><th>実働(分)</th><th>事由</th>' +
            '</tr></thead><tbody>';

        records.forEach(r => {
            const inT = r.clock_in ? r.clock_in.substring(0, 5) : '';
            const outT = r.clock_out ? r.clock_out.substring(0, 5) : '';
            let work = '';
            if (inT && outT) {
                work = toMin(outT) - toMin(inT);
                if (work < 0) work = '';
            }
            const codeCell = r.attendance_code
                ? r.attendance_code
                : '<span style="color:#e74c3c;">未設定</span>';
            html += `<tr>
                <td>${codeCell}</td>
                <td>${r.employee_code}</td>
                <td>${r.name || ''}</td>
                <td>${r.work_date}</td>
                <td>${inT}</td>
                <td>${outT}</td>
                <td>${work}</td>
                <td>${reasonLabel(r.reason)}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        $('#attendance-table').html(html);
    }

    function toMin(t) {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    }

    // 事由コード → ラベル
    function reasonLabel(code) {
        if (!code) return '';
        const map = { '21': '休憩なし' };
        return map[code] || code;
    }

    // ---- kinmu.txt ダウンロード ----
    async function exportFile() {
        const range = getRange();
        if (!range) return;

        const params = new URLSearchParams({ start: range.start, end: range.end });
        if ($('#fallback-code').is(':checked')) {
            params.set('fallback_code', '1');
        }

        try {
            const res = await fetch(`/api/attendance-export.php?${params.toString()}`);
            const contentType = res.headers.get('content-type') || '';

            // 出力できない場合はサーバーがJSONで理由を返す
            if (!res.ok || contentType.indexOf('application/json') !== -1) {
                let message = '勤怠データの出力に失敗しました。';
                try {
                    const json = await res.json();
                    if (json && json.error) message = json.error;
                } catch (e) { /* JSONでなければ既定メッセージ */ }
                showError(message);
                return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'kinmu.txt';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
            console.error('出力エラー:', e);
            showError('勤怠データの出力に失敗しました。');
        }
    }

    function showError(msg) {
        $('#error-message').text(msg).show();
        setTimeout(() => $('#error-message').fadeOut(), 8000);
    }
});

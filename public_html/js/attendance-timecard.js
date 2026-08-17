// 個人別タイムカード表示（管理者）
// attendance-timecard.html で使用。期間内の打刻を従業員ごとにタイムカード形式で表示・印刷する。
$(document).ready(function() {
    const userData = JSON.parse(localStorage.getItem('shiftApp_user') || 'null');

    // 管理者ログインでない場合はログイン画面へ
    if (!userData || userData.userType !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

    let employees = [];   // 従業員マスタ
    let recordMap = {};   // { employee_code: { 'YYYY-MM-DD': record } }
    let currentRange = null;

    init();

    async function init() {
        setPreset('prev16'); // 既定は締め期間（前月16日〜当月15日）

        $('#show-btn').on('click', loadTimecards);
        $('#print-btn').on('click', printTimecards);
        $('.preset-btn').on('click', function() {
            setPreset($(this).data('preset'));
            loadTimecards();
        });
        $('#employee-select').on('change', render);

        try {
            employees = await apiClient.getEmployees() || [];
        } catch (e) {
            console.error('従業員取得エラー:', e);
            showError('従業員マスタを取得できませんでした。');
            return;
        }

        let opts = '<option value="">全従業員</option>';
        employees.forEach(emp => {
            opts += `<option value="${emp.employee_code}">${escapeHtml(emp.name)}（${emp.employee_code}）</option>`;
        });
        $('#employee-select').html(opts);

        loadTimecards();
    }

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

    // 'YYYY-MM-DD' → Date（タイムゾーンの影響を受けないよう数値で生成）
    function parseDate(s) {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
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

    // 期間内の全日付（'YYYY-MM-DD'）
    function dateList(range) {
        const list = [];
        const cur = parseDate(range.start);
        const last = parseDate(range.end);
        while (cur <= last) {
            list.push(toDateStr(cur));
            cur.setDate(cur.getDate() + 1);
        }
        return list;
    }

    // ---- データ取得 ----
    async function loadTimecards() {
        const range = getRange();
        if (!range) return;

        $('#timecard-container').html('<p style="color:#7f8c8d;">読み込み中...</p>');

        try {
            const records = await apiClient.getAttendanceRange(range.start, range.end) || [];
            recordMap = {};
            records.forEach(r => {
                if (!recordMap[r.employee_code]) recordMap[r.employee_code] = {};
                recordMap[r.employee_code][r.work_date] = r;
            });
            currentRange = range;
            render();
        } catch (e) {
            console.error('勤怠取得エラー:', e);
            $('#timecard-container').html('');
            showError('勤怠データの取得に失敗しました。');
        }
    }

    // ---- 表示 ----
    function render() {
        if (!currentRange) return;

        const selected = $('#employee-select').val();
        const targets = selected
            ? employees.filter(e => e.employee_code === selected)
            : employees;

        if (targets.length === 0) {
            $('#timecard-container').html('<p style="color:#7f8c8d;">従業員が登録されていません。</p>');
            return;
        }

        const html = targets.map(emp => buildTimecard(emp, currentRange)).join('');
        $('#timecard-container').html(html);
    }

    // 1名分のタイムカードHTML
    function buildTimecard(emp, range) {
        const days = dateList(range);
        const records = recordMap[emp.employee_code] || {};

        let workDays = 0;
        let totalMinutes = 0;
        let rows = '';

        days.forEach(date => {
            const r = records[date] || null;
            const d = parseDate(date);
            const dow = d.getDay();
            const inT = r && r.clock_in ? r.clock_in.substring(0, 5) : '';
            const outT = r && r.clock_out ? r.clock_out.substring(0, 5) : '';

            let minutes = null;
            if (inT && outT) {
                minutes = toMin(outT) - toMin(inT);
                if (minutes < 0) minutes = null; // 日跨ぎ等は集計しない
            }
            if (inT || outT) workDays++;
            if (minutes !== null) totalMinutes += minutes;

            // 土曜=青、日曜=赤
            let dowColor = '';
            if (dow === 0) dowColor = ' color:#e74c3c;';
            else if (dow === 6) dowColor = ' color:#2980b9;';

            rows += `<tr>
                <td style="text-align:center;${dowColor}">${d.getMonth() + 1}/${d.getDate()}</td>
                <td style="text-align:center;${dowColor}">${WEEKDAYS[dow]}</td>
                <td style="text-align:center;">${inT}</td>
                <td style="text-align:center;">${outT}</td>
                <td style="text-align:center;">${minutes !== null ? formatHours(minutes) : ''}</td>
                <td style="text-align:center;">${reasonLabel(r ? r.reason : null)}</td>
            </tr>`;
        });

        return `
            <div class="timecard" style="margin-bottom: 30px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #2c3e50; padding-bottom:6px; margin-bottom:10px;">
                    <div>
                        <span style="font-size:18px; font-weight:bold; color:#2c3e50;">${escapeHtml(emp.name)}</span>
                        <span style="font-size:13px; color:#7f8c8d; margin-left:10px;">従業員コード: ${emp.employee_code}${emp.attendance_code ? ' / 勤怠コード: ' + emp.attendance_code : ''}</span>
                    </div>
                    <div style="font-size:13px; color:#34495e;">${range.start} 〜 ${range.end}</div>
                </div>
                <table class="table" style="margin-bottom:8px;">
                    <thead>
                        <tr>
                            <th style="text-align:center;">日付</th>
                            <th style="text-align:center;">曜日</th>
                            <th style="text-align:center;">出勤</th>
                            <th style="text-align:center;">退勤</th>
                            <th style="text-align:center;">時間</th>
                            <th style="text-align:center;">事由</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <div style="font-size:14px; color:#2c3e50;">
                    出勤日数: <strong>${workDays}日</strong>
                    <span style="margin-left:20px;">合計時間: <strong>${formatHours(totalMinutes)}</strong>（${totalMinutes}分）</span>
                </div>
            </div>`;
    }

    function toMin(t) {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    }

    // 分 → h:mm
    function formatHours(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}:${String(m).padStart(2, '0')}`;
    }

    // 事由コード → ラベル
    function reasonLabel(code) {
        if (!code) return '';
        const map = { '21': '休憩なし' };
        return map[code] || code;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ---- 印刷（表示中の内容を別ウィンドウで印刷） ----
    function printTimecards() {
        if (!currentRange) {
            showError('先に期間を指定して表示してください。');
            return;
        }

        const content = $('#timecard-container').html();
        if (!content || content.indexOf('timecard') === -1) {
            showError('印刷する内容がありません。');
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showError('ポップアップがブロックされました。ブラウザの設定を確認してください。');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <title>タイムカード ${currentRange.start}〜${currentRange.end}</title>
                <style>
                    body { font-family: "MS PGothic", sans-serif; margin: 15px; color: #000; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #333; padding: 3px 5px; font-size: 12px; }
                    th { background: #eee; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .timecard { page-break-after: always; }
                    .timecard:last-child { page-break-after: auto; }
                    @page { size: A4 portrait; margin: 10mm; }
                </style>
            </head>
            <body>${content}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    function showError(msg) {
        $('#error-message').text(msg).show();
        setTimeout(() => $('#error-message').fadeOut(), 8000);
    }
});

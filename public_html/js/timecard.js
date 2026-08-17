// 打刻（タイムカード）専用画面
// timecard.html で使用。ログイン中の従業員が出勤・退勤を記録する。
$(document).ready(function() {
    const userData = JSON.parse(localStorage.getItem('shiftApp_user') || 'null');

    // 従業員ログインでない場合はログイン画面へ
    if (!userData || userData.userType !== 'employee') {
        window.location.href = 'login.html';
        return;
    }

    const employeeCode = userData.username; // = employee_code
    $('#current-user').text('従業員: ' + (userData.name || employeeCode));

    startClock();
    loadTodayStatus();

    // 月別表示のデータ（対象日クリック時の初期値に使う）
    let shiftMap = {};
    let attMap = {};
    let reqMap = {};

    // 当月の勤務・打刻表
    let monthDate = new Date();
    renderMonth();
    renderRequests();

    // 申請フォームの初期値は本日
    $('#request-date').val(todayStr());
    $('#request-submit-btn').on('click', submitRequest);

    $('#punch-in-btn').on('click', function() { punch('in'); });
    $('#punch-out-btn').on('click', function() { punch('out'); });

    $('#prev-month').on('click', function() {
        monthDate.setMonth(monthDate.getMonth() - 1);
        renderMonth();
        renderRequests();
    });
    $('#next-month').on('click', function() {
        monthDate.setMonth(monthDate.getMonth() + 1);
        renderMonth();
        renderRequests();
    });

    // 現在時刻の時計（ブラウザ時刻・表示用。記録はサーバー時刻）
    function startClock() {
        updateClock();
        setInterval(updateClock, 1000);
    }

    function updateClock() {
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        $('#current-time').text(`${hh}:${mm}:${ss}`);

        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        $('#current-date').text(
            `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${dayNames[d.getDay()]}）`
        );
    }

    // 本日の打刻状況を読み込み
    async function loadTodayStatus() {
        try {
            const rec = await apiClient.getAttendanceByDate(employeeCode, todayStr());
            renderStatus(rec);
        } catch (e) {
            console.error('打刻状況取得エラー:', e);
            $('#timecard-today').text('打刻状況を取得できませんでした。');
        }
    }

    // 打刻実行（時刻はサーバー側で記録）
    async function punch(type) {
        const reason = $('#punch-reason').val().trim();
        try {
            const res = await apiClient.punch(employeeCode, type, reason || null);
            showMessage(res.message || '記録しました。', true);
            $('#punch-reason').val('');
            renderStatus(res.record);
        } catch (e) {
            console.error('打刻エラー:', e);
            showMessage('打刻に失敗しました。', false);
        }
    }

    // 打刻修正を申請
    async function submitRequest() {
        const workDate = $('#request-date').val();
        const clockIn = $('#request-clock-in').val();
        const clockOut = $('#request-clock-out').val();
        const breakNone = $('#request-break').val() === '1' ? 1 : 0;
        const reason = $('#request-reason').val().trim();

        if (!workDate) {
            showRequestMessage('対象日を選択してください。', false);
            return;
        }
        if (!clockIn && !clockOut) {
            showRequestMessage('出勤時刻または退勤時刻を入力してください。', false);
            return;
        }
        if (clockIn && clockOut && clockIn >= clockOut) {
            showRequestMessage('退勤時刻は出勤時刻より後にしてください。', false);
            return;
        }

        try {
            const res = await apiClient.createAttendanceRequest({
                employee_code: employeeCode,
                work_date: workDate,
                clock_in: clockIn || null,
                clock_out: clockOut || null,
                break_none: breakNone,
                reason: reason || null
            });

            showRequestMessage(res.message || '申請しました。', true);
            $('#request-clock-in').val('');
            $('#request-clock-out').val('');
            $('#request-reason').val('');
            $('#request-break').val('0');

            await renderRequests();
            await renderMonth();
        } catch (e) {
            console.error('申請エラー:', e);
            showRequestMessage(e.message || '申請に失敗しました。', false);
        }
    }

    // 申請一覧を表示
    async function renderRequests() {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth() + 1;

        try {
            const list = await apiClient.getAttendanceRequests({
                employee_code: employeeCode,
                year: year,
                month: month
            });

            if (!list || list.length === 0) {
                $('#request-list-container').html(
                    `<p style="color:#7f8c8d; font-size: 13px;">${year}年${month}月の申請はありません。</p>`
                );
                return;
            }

            let html = '<table class="table"><thead><tr>' +
                '<th>対象日</th><th>申請内容</th><th>事由</th><th>理由</th><th>状態</th>' +
                '</tr></thead><tbody>';

            list.forEach(r => {
                const inT = r.clock_in ? r.clock_in.substring(0, 5) : '—';
                const outT = r.clock_out ? r.clock_out.substring(0, 5) : '—';
                const breakLabel = Number(r.break_none) === 1 ? '休憩なし' : '事由なし';
                const comment = r.admin_comment ? `<br><small>管理者: ${escapeHtml(r.admin_comment)}</small>` : '';

                html += '<tr>' +
                    `<td style="text-align:center;">${formatDateLabel(r.work_date)}</td>` +
                    `<td style="text-align:center;">${inT} - ${outT}</td>` +
                    `<td style="text-align:center;">${breakLabel}</td>` +
                    `<td>${escapeHtml(r.reason || '')}</td>` +
                    `<td style="text-align:center;">${statusLabel(r.status)}${comment}</td>` +
                    '</tr>';
            });

            html += '</tbody></table>';
            $('#request-list-container').html(html);
        } catch (e) {
            console.error('申請一覧取得エラー:', e);
            $('#request-list-container').html(
                '<p style="color:#e74c3c; font-size: 13px;">申請状況を取得できませんでした。</p>'
            );
        }
    }

    // 当月の勤務（シフト予定）と打刻を日別に表示
    async function renderMonth() {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth() + 1;
        $('#month-title').text(`${year}年${month}月の勤務・打刻`);
        $('#month-table-container').html('<p style="color:#7f8c8d;">読み込み中...</p>');

        // 対象日クリック時の初期値に使うため、表示中の月のデータを保持する
        shiftMap = {}; // day -> { start, end }
        attMap = {};   // day -> { in, out, reason }
        reqMap = {};   // day -> { status, break_none }

        // 確定シフト（予定）
        try {
            const shifts = await apiClient.getConfirmedShifts(year, month).catch(() => []);
            (shifts || []).forEach(s => {
                if (s.employee_code !== employeeCode) return;
                shiftMap[Number(s.day)] = {
                    start: s.time_start ? s.time_start.substring(0, 5) : '',
                    end: s.time_end ? s.time_end.substring(0, 5) : ''
                };
            });
        } catch (e) {
            console.warn('シフト取得失敗:', e);
        }

        // 打刻（実績）
        try {
            const att = await apiClient.getMonthlyAttendance(year, month, employeeCode).catch(() => []);
            (att || []).forEach(a => {
                const d = Number(String(a.work_date).substring(8, 10));
                attMap[d] = {
                    in: a.clock_in ? a.clock_in.substring(0, 5) : '',
                    out: a.clock_out ? a.clock_out.substring(0, 5) : '',
                    reason: a.reason || ''
                };
            });
        } catch (e) {
            console.warn('打刻取得失敗:', e);
        }

        // 申請（承認済みの打刻を赤字で示すため）
        try {
            const reqs = await apiClient.getAttendanceRequests({
                employee_code: employeeCode,
                year: year,
                month: month
            }).catch(() => []);
            (reqs || []).forEach(r => {
                const d = Number(String(r.work_date).substring(8, 10));
                // 同じ日に複数ある場合は承認済みを優先して表示する
                if (!reqMap[d] || r.status === 'approved') {
                    reqMap[d] = { status: r.status, break_none: Number(r.break_none) };
                }
            });
        } catch (e) {
            console.warn('申請取得失敗:', e);
        }

        const lastDay = new Date(year, month, 0).getDate();
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

        let html = '<table class="table"><thead><tr>' +
            '<th>日</th><th>曜</th><th>シフト</th><th>打刻(出勤-退勤)</th><th>事由</th><th>申請</th>' +
            '</tr></thead><tbody>';

        for (let day = 1; day <= lastDay; day++) {
            const dow = new Date(year, month - 1, day).getDay();
            const weekend = (dow === 0 || dow === 6);
            const s = shiftMap[day];
            const a = attMap[day];
            const r = reqMap[day];

            const shiftStr = (s && (s.start || s.end)) ? `${s.start || '?'}-${s.end || '?'}` : '-';
            const attStr = (a && (a.in || a.out)) ? `${a.in || '未'}-${a.out || '未'}` : '-';
            const reason = (a && a.reason) ? reasonLabel(a.reason) : '';
            const rowStyle = weekend ? ' style="background:#fff5f5;"' : '';

            // 申請が承認された内容は赤字で表示する
            const isApproved = r && r.status === 'approved';
            const attStyle = isApproved ? ' color:#e74c3c; font-weight:bold;' : '';

            // 日をクリックすると、その日の申請フォームを開く
            html += `<tr${rowStyle}>` +
                `<td class="request-day-cell" data-day="${day}" title="クリックすると申請できます" ` +
                `style="text-align:center; cursor:pointer; color:#2980b9; text-decoration:underline;">${day}</td>` +
                `<td style="text-align:center;">${dayNames[dow]}</td>` +
                `<td style="text-align:center;">${shiftStr}</td>` +
                `<td style="text-align:center;${attStyle}">${attStr}</td>` +
                `<td style="text-align:center;${attStyle}">${reason}</td>` +
                `<td style="text-align:center;">${r ? statusLabel(r.status) : ''}</td>` +
                `</tr>`;
        }

        html += '</tbody></table>';
        $('#month-table-container').html(html);

        $('.request-day-cell').on('click', function() {
            openRequestForDay(Number($(this).data('day')));
        });
    }

    // 対象日をクリックしたとき、その日の内容で申請フォームを埋める
    function openRequestForDay(day) {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth() + 1;
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const a = attMap[day];
        const s = shiftMap[day];

        // 初期値は 打刻 > シフト予定 の順に採用する（打刻忘れの申請をしやすくするため）
        const inVal = (a && a.in) || (s && s.start) || '';
        const outVal = (a && a.out) || (s && s.end) || '';

        $('#request-date').val(dateStr);
        $('#request-clock-in').val(inVal);
        $('#request-clock-out').val(outVal);
        $('#request-break').val(a && a.reason === '21' ? '1' : '0');
        $('#request-reason').val('');

        // フォームまでスクロールして、対象日が変わったことを分かるようにする
        const $form = $('#request-form-card');
        if ($form.length) {
            $('html, body').animate({ scrollTop: $form.offset().top - 20 }, 300);
        }

        showRequestMessage(`${month}月${day}日の申請内容を入力してください。`, true);
    }

    // 状況表示（サーバー記録時刻）
    function renderStatus(rec) {
        const inT = rec && rec.clock_in ? rec.clock_in.substring(0, 5) : '未打刻';
        const outT = rec && rec.clock_out ? rec.clock_out.substring(0, 5) : '未打刻';
        const reason = rec && rec.reason ? `　／　事由: ${reasonLabel(rec.reason)}` : '';
        $('#timecard-today').html(
            `本日の打刻　出勤: <strong>${inT}</strong>　退勤: <strong>${outT}</strong>${reason}`
        );
    }

    // 事由コード → ラベル
    function reasonLabel(code) {
        const map = { '21': '休憩なし' };
        return map[code] || code;
    }

    // 申請状態 → 表示ラベル（承認済みは赤字）
    function statusLabel(status) {
        if (status === 'approved') {
            return '<span style="color:#e74c3c; font-weight:bold;">承認済</span>';
        }
        if (status === 'rejected') {
            return '<span style="color:#7f8c8d;">却下</span>';
        }
        return '<span style="color:#f39c12;">申請中</span>';
    }

    // YYYY-MM-DD → M月D日
    function formatDateLabel(dateStr) {
        const s = String(dateStr).substring(0, 10);
        const parts = s.split('-');
        if (parts.length !== 3) return s;
        return `${Number(parts[1])}月${Number(parts[2])}日`;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showRequestMessage(msg, ok) {
        const el = $('#request-message');
        el.removeClass('alert-success alert-danger')
          .addClass(ok ? 'alert-success' : 'alert-danger')
          .text(msg).show();
        setTimeout(function() { el.fadeOut(); }, 4000);
    }

    // YYYY-MM-DD（取得用）
    function todayStr() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function showMessage(msg, ok) {
        const el = $('#timecard-message');
        el.removeClass('alert-success alert-danger')
          .addClass(ok ? 'alert-success' : 'alert-danger')
          .text(msg).show();
        setTimeout(function() { el.fadeOut(); }, 3000);
    }
});

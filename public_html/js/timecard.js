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

    // 事由コード（attendance_records.reason と同じ値）
    const NO_BREAK_CODE = '21';    // 休憩なし
    const PAID_LEAVE_CODE = '10';  // 有給（勤務しない日のため時刻の入力は不要）
    const BREAK_MINUTES = 30;      // 休憩なしの申告がない日に差し引く休憩時間

    $('#current-user').text('従業員: ' + (userData.name || employeeCode));

    startClock();
    loadTodayStatus();

    // 月別表示のデータ（対象日クリック時の初期値に使う）
    let shiftMap = {};
    let attMap = {};
    let reqMap = {};

    // 当月の勤務・打刻表
    // 前月・次月ボタンで月末日が繰り上がらないよう、日は1日に固定しておく
    let monthDate = new Date();
    monthDate.setDate(1);
    renderMonth();
    renderRequests();

    // 集計期間の初期値は表示中の月（1日〜末日）
    setSummaryRangeToMonth();
    renderSummary();

    // 申請フォームの初期値は本日
    $('#request-date').val(todayStr());
    $('#request-submit-btn').on('click', submitRequest);
    $('#request-break').on('change', updateTimeInputState);
    updateTimeInputState();

    $('#punch-in-btn').on('click', function() { punch('in'); });
    $('#punch-out-btn').on('click', function() { punch('out'); });

    // 月を切り替えたら、集計期間もその月にそろえ直す
    $('#prev-month').on('click', function() {
        monthDate.setMonth(monthDate.getMonth() - 1);
        renderMonth();
        renderRequests();
        setSummaryRangeToMonth();
        renderSummary();
    });
    $('#next-month').on('click', function() {
        monthDate.setMonth(monthDate.getMonth() + 1);
        renderMonth();
        renderRequests();
        setSummaryRangeToMonth();
        renderSummary();
    });

    // 期間を指定した集計
    $('#summary-btn').on('click', renderSummary);
    $('#summary-month-btn').on('click', function() {
        setSummaryRangeToMonth();
        renderSummary();
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

    // 事由が「有給」のときは時刻を入力させない（1日休みのため）
    function updateTimeInputState() {
        const isPaidLeave = $('#request-break').val() === PAID_LEAVE_CODE;
        if (isPaidLeave) {
            $('#request-clock-in').val('');
            $('#request-clock-out').val('');
        }
        $('#request-clock-in, #request-clock-out').prop('disabled', isPaidLeave);
    }

    // 打刻修正を申請
    async function submitRequest() {
        const workDate = $('#request-date').val();
        const reasonCode = $('#request-break').val();
        const isPaidLeave = reasonCode === PAID_LEAVE_CODE;
        const clockIn = isPaidLeave ? '' : $('#request-clock-in').val();
        const clockOut = isPaidLeave ? '' : $('#request-clock-out').val();
        const reason = $('#request-reason').val().trim();

        if (!workDate) {
            showRequestMessage('対象日を選択してください。', false);
            return;
        }
        if (!isPaidLeave) {
            if (!clockIn && !clockOut) {
                showRequestMessage('出勤時刻または退勤時刻を入力してください。', false);
                return;
            }
            if (clockIn && clockOut && clockIn >= clockOut) {
                showRequestMessage('退勤時刻は出勤時刻より後にしてください。', false);
                return;
            }
        }

        try {
            const res = await apiClient.createAttendanceRequest({
                employee_code: employeeCode,
                work_date: workDate,
                clock_in: clockIn || null,
                clock_out: clockOut || null,
                reason_code: reasonCode || null,
                break_none: reasonCode === NO_BREAK_CODE ? 1 : 0,
                reason: reason || null
            });

            showRequestMessage(res.message || '申請しました。', true);
            $('#request-clock-in').val('');
            $('#request-clock-out').val('');
            $('#request-reason').val('');
            $('#request-break').val('');
            updateTimeInputState();

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
                const breakLabel = reasonLabel(requestReasonCode(r)) || '事由なし';
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
                    reqMap[d] = { status: r.status, reason_code: requestReasonCode(r) };
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

    // 集計期間の入力を、表示中の月の1日〜末日にそろえる
    function setSummaryRangeToMonth() {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth() + 1;
        const lastDay = new Date(year, month, 0).getDate();
        const mm = String(month).padStart(2, '0');

        $('#summary-start').val(`${year}-${mm}-01`);
        $('#summary-end').val(`${year}-${mm}-${String(lastDay).padStart(2, '0')}`);
    }

    // 指定期間の出勤日数と実労働時間を集計する
    // 計算式はタイムカード表示（attendance-timecard.js）と同じ
    async function renderSummary() {
        const start = $('#summary-start').val();
        const end = $('#summary-end').val();

        if (!start || !end) {
            $('#summary-container').html(
                '<p style="color:#e74c3c; font-size:13px;">開始日と終了日を指定してください。</p>'
            );
            return;
        }
        if (start > end) {
            $('#summary-container').html(
                '<p style="color:#e74c3c; font-size:13px;">開始日が終了日より後になっています。</p>'
            );
            return;
        }

        $('#summary-container').html('<p style="color:#7f8c8d; font-size:13px;">集計中...</p>');

        let records;
        try {
            records = await apiClient.getAttendanceRange(start, end, employeeCode) || [];
        } catch (e) {
            console.error('期間集計取得エラー:', e);
            $('#summary-container').html(
                '<p style="color:#e74c3c; font-size:13px;">集計データを取得できませんでした。</p>'
            );
            return;
        }

        let workDays = 0;
        let totalMinutes = 0;
        let breakDeductedDays = 0;
        let paidLeaveDays = 0;

        records.forEach(rec => {
            const a = {
                in: rec.clock_in ? rec.clock_in.substring(0, 5) : '',
                out: rec.clock_out ? rec.clock_out.substring(0, 5) : '',
                reason: rec.reason || ''
            };

            if (a.in || a.out) workDays++;
            if (isPaidLeaveDay(a)) paidLeaveDays++;

            const minutes = workMinutes(a);
            if (minutes !== null) {
                totalMinutes += minutes;
                if (!isNoBreak(a)) breakDeductedDays++;
            }
        });

        $('#summary-container').html(`
            <div style="font-size:14px; color:#2c3e50;">
                <span style="margin-right:20px; color:#34495e;">${formatDateLabel(start)}〜${formatDateLabel(end)}</span>
                出勤日数: <strong>${workDays}日</strong>
                <span style="margin-left:20px;">実労働時間: <strong>${formatHours(totalMinutes)}</strong>（${totalMinutes}分）</span>
                <span style="margin-left:20px;">有給日数: <strong>${paidLeaveDays}日</strong></span>
            </div>
            <div style="font-size:12px; color:#7f8c8d; margin-top:6px;">
                ※時間は15分単位で丸めています（出勤は切り上げ／退勤は切り捨て）。
                事由「休憩なし」以外の日は休憩30分を差し引いています（${breakDeductedDays}日分）。
                出勤・退勤のどちらかが未打刻の日は実労働時間に含まれません。
            </div>`);
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
        $('#request-break').val(selectableReason(a && a.reason));
        $('#request-reason').val('');
        updateTimeInputState(); // 有給なら時刻入力を閉じる

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

    // 1日の実労働時間（分）。計算式はタイムカード表示（attendance-timecard.js）と同じ
    // 15分丸め（出勤=切り上げ／退勤=切り捨て）のうえ、「休憩なし」以外の日は休憩30分を差し引く
    // 出勤・退勤が揃っていない日、日跨ぎ（退勤 < 出勤）の日は集計対象外（null）
    function workMinutes(a) {
        if (!a || !a.in || !a.out) return null;

        const rawIn = toMin(a.in);
        const rawOut = toMin(a.out);
        if (rawOut < rawIn) return null;

        let minutes = roundOut(rawOut) - roundIn(rawIn);
        if (minutes < 0) minutes = 0; // 丸めで逆転する短時間勤務は0扱い

        if (!isNoBreak(a)) {
            minutes -= BREAK_MINUTES;
            if (minutes < 0) minutes = 0;
        }
        return minutes;
    }

    // 「休憩なし」の申告がある日か
    function isNoBreak(a) {
        return !!a && String(a.reason) === NO_BREAK_CODE;
    }

    // 「有給」の日か
    function isPaidLeaveDay(a) {
        return !!a && String(a.reason) === PAID_LEAVE_CODE;
    }

    // 'HH:MM' → 分
    function toMin(t) {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    }

    // 出勤は15分単位で切り上げ（9:25 → 9:30）
    function roundIn(minutes) {
        return Math.ceil(minutes / 15) * 15;
    }

    // 退勤は15分単位で切り捨て（13:49 → 13:45）
    function roundOut(minutes) {
        return Math.floor(minutes / 15) * 15;
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
        const map = { '21': '休憩なし', '10': '有給' };
        return map[code] || code;
    }

    // 申請の事由コード（reason_code が無い旧データは break_none で判定）
    function requestReasonCode(req) {
        const code = req.reason_code ? String(req.reason_code) : '';
        if (code === NO_BREAK_CODE || code === PAID_LEAVE_CODE) return code;
        return Number(req.break_none) === 1 ? NO_BREAK_CODE : '';
    }

    // 申請フォームの事由セレクトで選べるコードだけを返す
    function selectableReason(code) {
        const c = code ? String(code) : '';
        return (c === NO_BREAK_CODE || c === PAID_LEAVE_CODE) ? c : '';
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

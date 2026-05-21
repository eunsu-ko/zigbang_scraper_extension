(async () => {
  let finalCount = null;
  try {
    const categories = ["원룸", "오피스텔(도시형생활주택)", "빌라"];
    const CATEGORY_SLUG = {
      "원룸": "oneroom",
      "오피스텔(도시형생활주택)": "officetel",
      "빌라": "villa"
    };

    const allCombinedResults = [];

    // 개수 집계 기준 (26년 1월 ~ 3월)
    const startDate = "26.01.01";
    const endDate = "26.03.31";

    for (const catName of categories) {
        console.log(`\n🚀 [${catName}] 수집 시작...`);

        const catBtn = Array.from(document.querySelectorAll('button[role="tab"]'))
            .find(btn => btn.textContent.trim() === catName);
        if (catBtn) {
            catBtn.click();
            await new Promise(r => setTimeout(r, 2000));
        }

        const allTab = Array.from(document.querySelectorAll('button[role="tab"]'))
            .find(btn => btn.textContent.includes('전체'));
        if (!allTab) continue;

        allTab.click();
        await new Promise(r => setTimeout(r, 1000));
        const TARGET_COUNT = parseInt(allTab.textContent.match(/\d+/)[0]);

        const getScrollContainer = () => {
            const card = document.querySelector('[data-sentry-component="AdItemCard"]');
            let parent = card ? card.parentElement : null;
            while (parent) {
                const style = window.getComputedStyle(parent);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll') return parent;
                parent = parent.parentElement;
            }
            return document.documentElement;
        };

        const scrollContainer = getScrollContainer();
        const currentCatData = new Map();
        let retryCount = 0;

        while (currentCatData.size < TARGET_COUNT && retryCount < 25) {
            const lastSize = currentCatData.size;
            document.querySelectorAll('[data-sentry-component="AdItemCard"]').forEach(card => {
                const idMatch = card.innerText.match(/등록번호\s*:\s*(\d+)/);
                const id = idMatch ? idMatch[1] : null;

                if (id && !currentCatData.has(id)) {
                    const addrEl = card.querySelector('.flex-row.text-sm.font-semibold.leading-normal');
                    const infoText = card.querySelector('.flex-row.text-sm.font-normal.leading-normal')?.innerText || "";
                    const fullAddr = addrEl ? addrEl.innerText.split('ㅣ') : ["", ""];
                    const dateMatch = infoText.match(/등록일\s*:\s*([\d.]+)/);
                    const viewMatch = infoText.match(/조회수\s*:\s*([\d,]+)/);
                    const anchor = card.querySelector('a[href*="/ad-item/"]')
                        || card.closest('a[href*="/ad-item/"]');
                    const detailHref = anchor ? anchor.getAttribute('href') : null;

                    currentCatData.set(id, {
                        "유형": catName.includes("오피스텔") ? "오피스텔" : catName,
                        "_카테고리원본": catName,
                        "등록번호": id,
                        "주소": (fullAddr[0] || "").trim(),
                        "상세호수": (fullAddr[1] || "").trim(),
                        "등록일": dateMatch ? dateMatch[1] : "",
                        "조회수": viewMatch ? viewMatch[1] : "",
                        "_detailHref": detailHref
                    });
                }
            });

            if (currentCatData.size > lastSize) {
                retryCount = 0;
                scrollContainer === document.documentElement ? window.scrollBy(0, 1000) : scrollContainer.scrollTop += 1000;
                await new Promise(r => setTimeout(r, 100));
            } else {
                retryCount++;
                scrollContainer === document.documentElement ? window.scrollBy(0, 300) : scrollContainer.scrollTop += 300;
                await new Promise(r => setTimeout(r, 400));
            }
        }
        currentCatData.forEach(item => allCombinedResults.push(item));
    }

    // --- 매물별 상세 페이지 수집 ---
    console.log(`\n🔎 매물별 상세 페이지 수집 시작 (총 ${allCombinedResults.length}건)...`);
    try {
      chrome.runtime.sendMessage({
        status: 'scraping_progress',
        stage: '상세 수집',
        current: 0,
        total: allCombinedResults.length
      });
    } catch (e) { /* popup 닫혀있어도 무시 */ }

    // CSV 컬럼 순서로 고정 (라벨명 = 상세페이지 라벨 그대로, 단 주소는 충돌 방지를 위해 별도 키)
    const DETAIL_FIELDS = [
        "주소(상세)", "동 정보", "호 정보",
        "건물 종류", "거래 유형",
        "보증금", "월세", "매매가", "관리비",
        "전용면적", "공급면적", "대지권면적",
        "사용 승인일", "입주가능일",
        "해당층", "총층", "방향", "방수", "욕실수",
        "주차", "엘리베이터", "난방방식"
    ];

    const LABEL_TO_KEY = {
        "주소": "주소(상세)",
        "동 정보": "동 정보",
        "호 정보": "호 정보",
        "건물 종류": "건물 종류",
        "거래 유형": "거래 유형",
        "보증금": "보증금",
        "월세": "월세",
        "매매가": "매매가",
        "관리비": "관리비",
        "전용면적": "전용면적",
        "공급면적": "공급면적",
        "대지권면적": "대지권면적",
        "사용 승인일": "사용 승인일",
        "입주가능일": "입주가능일",
        "해당층": "해당층",
        "총층": "총층",
        "방향": "방향",
        "방수": "방수",
        "욕실수": "욕실수",
        "주차": "주차",
        "엘리베이터": "엘리베이터",
        "난방방식": "난방방식"
    };

    function parseDetailHtml(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const result = {};
        const sections = doc.querySelectorAll('[data-sentry-component="SubSection"]');
        sections.forEach(section => {
            section.querySelectorAll('.font-semibold').forEach(labelEl => {
                const label = labelEl.textContent.trim();
                const valueEl = labelEl.nextElementSibling;
                if (!label || !valueEl) return;
                const value = valueEl.textContent.trim().replace(/\s+/g, ' ');
                const key = LABEL_TO_KEY[label] || label;
                if (!(key in result)) result[key] = value;
            });
        });
        return result;
    }

    function buildDetailUrl(item) {
        let url = item._detailHref;
        if (!url) {
            const slug = CATEGORY_SLUG[item._카테고리원본];
            if (!slug) return null;
            url = `/ads/${slug}/ad-item/${item.등록번호}`;
        }
        if (url.startsWith('/')) url = window.location.origin + url;
        return url;
    }

    async function fetchDetail(item) {
        const url = buildDetailUrl(item);
        if (!url) return null;
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const parsed = parseDetailHtml(html);
        if (Object.keys(parsed).length === 0) {
            // SPA로 렌더되어 SubSection이 없는 경우 → __NEXT_DATA__ JSON 시도
            const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
            if (m) {
                try {
                    const json = JSON.parse(m[1]);
                    parsed._nextDataAvailable = JSON.stringify(json).length;
                    // 구조가 페이지별로 달라서 안전한 일반 추출은 생략. 필요시 별도 매핑.
                } catch (e) { /* ignore */ }
            }
        }
        return parsed;
    }

    let completedDetails = 0;
    const totalDetails = allCombinedResults.length;

    async function worker(queue) {
        while (queue.length) {
            const item = queue.shift();
            try {
                const detail = await fetchDetail(item);
                if (detail) {
                    DETAIL_FIELDS.forEach(f => { item[f] = detail[f] || ""; });
                }
            } catch (e) {
                console.warn(`상세 수집 실패 (등록번호 ${item.등록번호}):`, e.message);
            }
            completedDetails++;
            if (completedDetails % 5 === 0 || completedDetails === totalDetails) {
                try {
                    chrome.runtime.sendMessage({
                        status: 'scraping_progress',
                        stage: '상세 수집',
                        current: completedDetails,
                        total: totalDetails
                    });
                } catch (e) { /* ignore */ }
                console.log(`상세 진행: ${completedDetails}/${totalDetails}`);
            }
            // 과도한 동시 요청 방지용 미세 지연
            await new Promise(r => setTimeout(r, 50));
        }
    }

    const CONCURRENCY = 4;
    const queue = [...allCombinedResults];
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

    // --- 최종 결과 처리 ---

    // 1. 기간 내 매물 개수 계산 (26.01.01 ~ 26.03.31)
    const targetPeriodItems = allCombinedResults.filter(item =>
        item.등록일 >= startDate && item.등록일 <= endDate
    );
    finalCount = targetPeriodItems.length;

    // 2. 콘솔 요약
    console.log("\n" + "=".repeat(40));
    console.log(`📊 데이터 수집 최종 리포트`);
    console.log(`- 전체 수집된 총 매물: ${allCombinedResults.length}개`);
    console.log(`- [26년 1월~3월] 등록 매물 수: ${targetPeriodItems.length}개`);
    const periodStats = {};
    targetPeriodItems.forEach(item => {
        periodStats[item.유형] = (periodStats[item.유형] || 0) + 1;
    });
    console.log(`📍 기간 내 유형별 상세 개수:`);
    console.table(periodStats);
    console.log("=".repeat(40));

    // 3. CSV 다운로드 (리스트 컬럼 + 상세 컬럼)
    if (allCombinedResults.length > 0) {
        const baseHeaders = ["유형", "등록번호", "주소", "상세호수", "등록일", "조회수"];
        const headers = [...baseHeaders, ...DETAIL_FIELDS];
        const escape = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;

        const csvRows = [headers.map(escape).join(",")];
        allCombinedResults.forEach(item => {
            csvRows.push(headers.map(h => escape(item[h] ?? "")).join(","));
        });

        const csvContent = "﻿" + csvRows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `직방_전체데이터_상세포함_${allCombinedResults.length}개.csv`;
        link.click();
        console.log(`💾 전체 데이터(${allCombinedResults.length}개) + 상세 정보 파일 다운로드를 시작했습니다.`);
    }
  } finally {
    try {
      chrome.runtime.sendMessage({ status: 'scraping_complete', count: finalCount });
    } catch (e) { /* ignore */ }
  }
})();

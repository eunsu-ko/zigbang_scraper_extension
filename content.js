(async () => {
  let finalCount = null;
  try {
    const categories = ["원룸", "오피스텔(도시형생활주택)", "빌라"];
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

                    currentCatData.set(id, {
                        "유형": catName.includes("오피스텔") ? "오피스텔" : catName,
                        "주소": (fullAddr[0] || "").trim(),
                        "상세호수": (fullAddr[1] || "").trim(),
                        "등록일": dateMatch ? dateMatch[1] : "",
                        "조회수": viewMatch ? viewMatch[1] : ""
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

    // --- 최종 결과 처리 ---

    // 1. 기간 내 매물 개수 계산 (26.01.01 ~ 26.03.31)
    const targetPeriodItems = allCombinedResults.filter(item => 
        item.등록일 >= startDate && item.등록일 <= endDate
    );
    finalCount = targetPeriodItems.length; // Set the count here

    // 2. 콘솔에 요약 정보 출력
    console.log("\n" + "=".repeat(40));
    console.log(`📊 데이터 수집 최종 리포트`);
    console.log(`- 전체 수집된 총 매물: ${allCombinedResults.length}개`);
    console.log(`- [26년 1월~3월] 등록 매물 수: ${targetPeriodItems.length}개`);
    
    // 유형별 기간 내 개수 상세 요약
    const periodStats = {};
    targetPeriodItems.forEach(item => {
        periodStats[item.유형] = (periodStats[item.유형] || 0) + 1;
    });
    console.log(`📍 기간 내 유형별 상세 개수:`);
    console.table(periodStats);
    console.log("=".repeat(40));

    // 3. 전체 데이터 CSV 다운로드
    if (allCombinedResults.length > 0) {
        const csvRows = [["유형", "주소", "상세호수", "등록일", "조회수"]];
        allCombinedResults.forEach(item => {
            csvRows.push([item.유형, `"${item.주소}"`, `"${item.상세호수}"`, item.등록일, item.조회수]);
        });

        const csvContent = "\uFEFF" + csvRows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `직방_전체데이터_통합_${allCombinedResults.length}개.csv`;
        link.click();
        console.log(`💾 전체 데이터(${allCombinedResults.length}개) 파일 다운로드를 시작했습니다.`);
    }
  } finally {
    chrome.runtime.sendMessage({ status: 'scraping_complete', count: finalCount });
  }
})();
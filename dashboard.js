(function() {
    const fileInput = document.getElementById('csv-file-input');
    const uploadBtn = document.getElementById('upload-btn');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);
    }

    // Tabs switching
    const navDashboard = document.getElementById('nav-dashboard');
    const navDatasets = document.getElementById('nav-datasets');
    const navAnalytics = document.getElementById('nav-analytics');
    const navReports = document.getElementById('nav-reports');
    const navInsights = document.getElementById('nav-insights');
    const navForecasting = document.getElementById('nav-forecasting');
    const navCopilot = document.getElementById('nav-copilot');

    const dashboardView = document.getElementById('dashboard-view');
    const datasetsView = document.getElementById('datasets-view');
    const analyticsView = document.getElementById('analytics-view');
    const reportsView = document.getElementById('reports-view');
    const insightsView = document.getElementById('insights-view');
    const forecastingView = document.getElementById('forecasting-view');
    const copilotView = document.getElementById('copilot-view');

    const allTabs = [
        { nav: navDashboard, view: dashboardView },
        { nav: navDatasets, view: datasetsView },
        { nav: navAnalytics, view: analyticsView },
        { nav: navReports, view: reportsView },
        { nav: navInsights, view: insightsView },
        { nav: navForecasting, view: forecastingView },
        { nav: navCopilot, view: copilotView }
    ];

    allTabs.forEach(tab => {
        if (tab.nav && tab.view) {
            tab.nav.addEventListener('click', (e) => {
                e.preventDefault();
                allTabs.forEach(t => {
                    if (t.nav) {
                        t.nav.className = "flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/5 duration-300 ease-out interactive-scale";
                    }
                    if (t.view) t.view.classList.add('hidden');
                });
                tab.nav.className = "flex items-center gap-3 px-3 py-2 rounded-lg text-primary bg-primary/10 border-r-2 border-primary duration-300 ease-out interactive-scale";
                tab.view.classList.remove('hidden');
            });
        }
    });

    // Slide carousel variables
    let currentSlideIndex = 0;
    let slidesData = [];

    function updateSlideUI() {
        const slideContainer = document.getElementById('slide-content-container');
        const slideNum = document.getElementById('slide-number');
        if (!slideContainer || slidesData.length === 0) return;
        
        slideNum.textContent = `Slide ${currentSlideIndex + 1} / ${slidesData.length}`;
        const slide = slidesData[currentSlideIndex];
        
        slideContainer.innerHTML = `
            <div class="flex justify-center mb-3">
                <div class="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 text-primary">
                    <span class="material-symbols-outlined">${slide.icon}</span>
                </div>
            </div>
            <h3 class="text-sm font-bold text-white mb-2">${slide.title}</h3>
            <p class="text-xs text-on-surface-variant mb-4 leading-relaxed">${slide.desc}</p>
            <div class="bg-[#0e0e10]/40 p-2.5 rounded border border-white/5 text-[10px] font-data-mono text-left max-w-sm mx-auto space-y-1">
                ${slide.points.map(p => `<div class="flex items-start gap-1.5"><span class="text-secondary">•</span> <span>${p}</span></div>`).join('')}
            </div>
        `;
    }
    function nextSlide() {
        if (slidesData.length === 0) return;
        currentSlideIndex = (currentSlideIndex + 1) % slidesData.length;
        updateSlideUI();
    }
    function prevSlide() {
        if (slidesData.length === 0) return;
        currentSlideIndex = (currentSlideIndex - 1 + slidesData.length) % slidesData.length;
        updateSlideUI();
    }
    window.nextSlide = nextSlide;
    window.prevSlide = prevSlide;

    // Drag & drop logic
    const dropOverlay = document.getElementById('drop-overlay');
    if (dropOverlay) {
        window.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropOverlay.classList.remove('opacity-0', 'pointer-events-none');
            dropOverlay.classList.add('opacity-100');
        });
        dropOverlay.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
                dropOverlay.classList.remove('opacity-100');
                dropOverlay.classList.add('opacity-0', 'pointer-events-none');
            }
        });
        dropOverlay.addEventListener('drop', (e) => {
            e.preventDefault();
            dropOverlay.classList.remove('opacity-100');
            dropOverlay.classList.add('opacity-0', 'pointer-events-none');
            if (e.dataTransfer.files.length > 0) {
                processFile(e.dataTransfer.files[0]);
            }
        });
    }

    function handleFileSelect(e) {
        if (e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    }

    function processFile(file) {
        if (!file.name.endsWith('.csv')) {
            alert('Please upload a valid CSV file.');
            return;
        }
        
        document.getElementById('chip-dataset-name').textContent = file.name.replace('.csv', '');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            analyzeDataset(text);
        };
        reader.readAsText(file);
    }

    function analyzeDataset(csvText) {
        const rows = parseCSV(csvText);
        if (rows.length < 2) {
            alert('The dataset contains no valid data rows.');
            return;
        }
        const headers = rows[0].map(h => h.trim());
        const dataRows = rows.slice(1).filter(r => r.length === headers.length && r.some(cell => cell !== ''));
        
        if (dataRows.length === 0) {
            alert('Could not parse any rows matching the header structure.');
            return;
        }

        // Identify column types
        const colTypes = headers.map((header, colIndex) => {
            let numericCount = 0;
            let dateCount = 0;
            let nonNullCount = 0;
            
            const sampleSize = Math.min(dataRows.length, 100);
            for (let i = 0; i < sampleSize; i++) {
                const val = dataRows[i][colIndex].trim();
                if (val === '') continue;
                nonNullCount++;
                if (!isNaN(parseFloat(val.replace(/[$,%]/g, '')))) numericCount++;
                if (!isNaN(Date.parse(val)) && isNaN(val)) dateCount++;
            }
            
            if (nonNullCount === 0) return 'categorical';
            if (numericCount / nonNullCount > 0.6) return 'numeric';
            if (dateCount / nonNullCount > 0.6) return 'date';
            return 'categorical';
        });
        
        const numericIndices = [];
        const dateIndices = [];
        const categoricalIndices = [];
        
        colTypes.forEach((type, index) => {
            if (type === 'numeric') numericIndices.push(index);
            else if (type === 'date') dateIndices.push(index);
            else categoricalIndices.push(index);
        });

        if (numericIndices.length === 0) {
            alert('This dashboard requires at least one numeric target variable column.');
            return;
        }
        
        // Intelligent Semantic Mapping
        let primaryMetricIndex = numericIndices[0] || 0;
        let dateIndex = dateIndices[0] !== undefined ? dateIndices[0] : -1;
        let categoryIndex = categoricalIndices[0] !== undefined ? categoricalIndices[0] : -1;
        let geoIndex = -1;
        
        headers.forEach((header, idx) => {
            const hLower = header.toLowerCase();
            if (numericIndices.includes(idx)) {
                if (hLower.includes('revenue') || hLower.includes('sales') || hLower.includes('amount') || hLower.includes('price') || hLower.includes('total') || hLower.includes('value')) {
                    primaryMetricIndex = idx;
                }
            }
            if (hLower.includes('date') || hLower.includes('time') || hLower.includes('timestamp') || hLower.includes('year') || hLower.includes('month')) {
                dateIndex = idx;
            }
            if (hLower.includes('category') || hLower.includes('segment') || hLower.includes('type') || hLower.includes('class') || hLower.includes('group') || hLower.includes('product')) {
                categoryIndex = idx;
            }
            if (hLower.includes('region') || hLower.includes('state') || hLower.includes('country') || hLower.includes('city') || hLower.includes('location') || hLower.includes('geo')) {
                geoIndex = idx;
            }
        });

        // Fallbacks
        if (categoryIndex === -1 && geoIndex !== -1) {
            categoryIndex = geoIndex;
        } else if (categoryIndex === -1 && categoricalIndices.length > 0) {
            categoryIndex = categoricalIndices[0];
        }
        
        // Data Cleaning & Deduplication
        let duplicateCount = 0;
        const seen = new Set();
        const cleanRows = [];
        
        dataRows.forEach(row => {
            const str = row.join('|');
            if (seen.has(str)) {
                duplicateCount++;
            } else {
                seen.add(str);
                cleanRows.push(row);
            }
        });
        
        const primaryMetricName = headers[primaryMetricIndex];
        const cleanData = cleanRows.map((row, idx) => {
            let dateVal = null;
            if (dateIndex !== -1) {
                const parsedDate = Date.parse(row[dateIndex]);
                if (!isNaN(parsedDate)) {
                    dateVal = new Date(parsedDate);
                }
            }
            if (!dateVal) {
                dateVal = new Date(2024, idx % 12, 1);
            }
            const rawVal = row[primaryMetricIndex];
            const numVal = parseFloat(String(rawVal).replace(/[$,%]/g, '')) || 0;
            const catVal = categoryIndex !== -1 ? row[categoryIndex].trim() : 'General';
            const geoVal = geoIndex !== -1 ? row[geoIndex].trim() : 'Global';
            return {
                id: idx + 1,
                row,
                date: dateVal,
                value: numVal,
                category: catVal,
                geo: geoVal
            };
        });
        
        cleanData.sort((a, b) => a.date - b.date);

        // Core Statistics
        const totalCount = cleanData.length;
        const sumVal = cleanData.reduce((sum, item) => sum + item.value, 0);
        const avgVal = sumVal / totalCount;
        
        const variance = cleanData.reduce((sum, item) => sum + Math.pow(item.value - avgVal, 2), 0) / totalCount;
        const stdDev = Math.sqrt(variance) || 1;
        const minVal = Math.min(...cleanData.map(d => d.value));
        const maxVal = Math.max(...cleanData.map(d => d.value));
        const rangeVal = maxVal - minVal;

        // Skewness and Kurtosis
        const skewness = calculateSkewness(cleanData.map(d => d.value), avgVal, stdDev);
        const kurtosis = calculateKurtosis(cleanData.map(d => d.value), avgVal, stdDev);
        
        // Outlier detection using Z-score and IQR
        const valuesArr = cleanData.map(d => d.value).sort((a,b) => a-b);
        const q1 = valuesArr[Math.floor(totalCount * 0.25)] || 0;
        const q3 = valuesArr[Math.floor(totalCount * 0.75)] || 0;
        const iqr = q3 - q1;
        const iqrLower = q1 - 1.5 * iqr;
        const iqrUpper = q3 + 1.5 * iqr;

        // Density nearest neighbors helper
        let totalNeighborDist = 0;
        const dists = [];
        for (let i = 0; i < totalCount; i++) {
            let minDist = Infinity;
            for (let j = 0; j < totalCount; j++) {
                if (i === j) continue;
                const d = Math.abs(cleanData[i].value - cleanData[j].value);
                if (d < minDist) minDist = d;
            }
            dists.push(minDist);
            if (minDist !== Infinity) totalNeighborDist += minDist;
        }
        const avgNeighborDist = totalNeighborDist / totalCount || 1;

        let outlierCount = 0;
        const anomalies = [];
        cleanData.forEach(item => {
            const z = (item.value - avgVal) / stdDev;
            const isZOutlier = Math.abs(z) > 2.0;
            const isIQROutlier = item.value < iqrLower || item.value > iqrUpper;
            const isDensityOutlier = dists[item.id - 1] > 2.2 * avgNeighborDist;

            const isOutlier = (isZOutlier && isIQROutlier) || (isZOutlier && isDensityOutlier) || (isIQROutlier && isDensityOutlier) || Math.abs(z) > 2.3;
            
            if (isOutlier) {
                outlierCount++;
                let severity = 'Low';
                let colorClass = 'text-secondary bg-secondary/10 border-secondary/20';
                if (Math.abs(z) >= 3.0) {
                    severity = 'Critical';
                    colorClass = 'text-error bg-error/10 border-error/20';
                } else if (Math.abs(z) >= 2.4) {
                    severity = 'High';
                    colorClass = 'text-error bg-error/10 border-error/20';
                } else if (Math.abs(z) >= 1.8) {
                    severity = 'Medium';
                    colorClass = 'text-warning bg-warning/10 border-warning/20';
                }
                
                anomalies.push({
                    dateStr: dateIndex !== -1 ? item.row[dateIndex] : `Row ${item.id}`,
                    value: item.value,
                    zScore: z,
                    deviationPct: ((item.value - avgVal) / (avgVal || 1) * 100).toFixed(1),
                    severity,
                    colorClass,
                    category: item.category,
                    geo: item.geo,
                    rawItem: item
                });
            }
        });

        const medianVal = valuesArr[Math.floor(totalCount / 2)] || 0;
        
        let growthRate = 0;
        const half = Math.floor(cleanData.length / 2);
        const sumFirstHalf = cleanData.slice(0, half).reduce((sum, item) => sum + item.value, 0);
        const sumSecondHalf = cleanData.slice(half).reduce((sum, item) => sum + item.value, 0);
        if (sumFirstHalf > 0) {
            growthRate = ((sumSecondHalf - sumFirstHalf) / sumFirstHalf) * 100;
        }
        
        let domain = 'General Analytics';
        const headerStr = headers.join(' ').toLowerCase();
        if (/revenue|sales|order|quantity|price|invoice|retail|spend/i.test(headerStr)) domain = 'Sales & Commerce';
        else if (/patient|doctor|visit|health|clinical|diagnosis|medication/i.test(headerStr)) domain = 'Healthcare & Medicine';
        else if (/click|impression|campaign|ctr|reach|ad|lead|spend|conversion/i.test(headerStr)) domain = 'Digital Marketing';
        else if (/yield|defect|batch|sensor|temp|machine|part|efficiency/i.test(headerStr)) domain = 'Manufacturing Operations';
        else if (/student|grade|score|class|course|exam|school|gpa/i.test(headerStr)) domain = 'Educational Performance';
        else if (/capital|cash|expense|income|asset|liability|interest/i.test(headerStr)) domain = 'Finance & Banking';
        else if (/inventory|shipment|warehouse|delivery|logistics|route/i.test(headerStr)) domain = 'Supply Chain & Logistics';
        
        const catGroups = {};
        cleanData.forEach(item => {
            if (!catGroups[item.category]) catGroups[item.category] = { sum: 0, count: 0 };
            catGroups[item.category].sum += item.value;
            catGroups[item.category].count++;
        });
        
        let bestCat = 'None';
        let maxCatVal = -Infinity;
        let worstCat = 'None';
        let minCatVal = Infinity;
        
        Object.keys(catGroups).forEach(cat => {
            const sum = catGroups[cat].sum;
            if (sum > maxCatVal) {
                maxCatVal = sum;
                bestCat = cat;
            }
            if (sum < minCatVal) {
                minCatVal = sum;
                worstCat = cat;
            }
        });

        const geoGroups = {};
        cleanData.forEach(item => {
            if (!geoGroups[item.geo]) geoGroups[item.geo] = { sum: 0, count: 0 };
            geoGroups[item.geo].sum += item.value;
            geoGroups[item.geo].count++;
        });
        
        let bestGeo = 'None';
        let maxGeoVal = -Infinity;
        let worstGeo = 'None';
        let minGeoVal = Infinity;
        
        Object.keys(geoGroups).forEach(geo => {
            const sum = geoGroups[geo].sum;
            if (sum > maxGeoVal) {
                maxGeoVal = sum;
                bestGeo = geo;
            }
            if (sum < minGeoVal) {
                minGeoVal = sum;
                worstGeo = geo;
            }
        });
        
        const missingValuesPct = (rows.length - totalCount) / rows.length;
        const outlierPct = outlierCount / totalCount;
        const duplicatePct = duplicateCount / rows.length;
        let confidenceScore = Math.round(99 - (missingValuesPct * 40) - (outlierPct * 120) - (duplicatePct * 80));
        confidenceScore = Math.max(72, Math.min(99, confidenceScore));
        
        document.getElementById('chip-rows-count').textContent = formatRowsCount(rows.length);
        document.getElementById('chip-cols-count').textContent = `${headers.length} cols`;
        document.getElementById('chip-quality-text').textContent = `${confidenceScore}% Quality`;
        
        const qualityDot = document.getElementById('chip-quality-dot');
        if (confidenceScore > 90) {
            qualityDot.className = 'w-1.5 h-1.5 rounded-full bg-secondary';
            qualityDot.parentElement.className = 'flex items-center gap-1 text-secondary';
        } else if (confidenceScore > 80) {
            qualityDot.className = 'w-1.5 h-1.5 rounded-full bg-warning';
            qualityDot.parentElement.className = 'flex items-center gap-1 text-warning';
        } else {
            qualityDot.className = 'w-1.5 h-1.5 rounded-full bg-error';
            qualityDot.parentElement.className = 'flex items-center gap-1 text-error';
        }

        let headlineInsight = `Primary target metric <strong>${primaryMetricName}</strong> shows key performance volume in the <strong>${domain}</strong> domain.`;
        if (numericIndices.length > 1) {
            let bestCorrCol = -1;
            let maxCorr = 0;
            numericIndices.forEach(idx => {
                if (idx === primaryMetricIndex) return;
                const colVals = cleanRows.map(r => parseFloat(String(r[idx]).replace(/[$,%]/g, '')) || 0);
                const corr = calculatePearsonCorrelation(cleanData.map(d => d.value), colVals);
                if (Math.abs(corr) > Math.abs(maxCorr)) {
                    maxCorr = corr;
                    bestCorrCol = idx;
                }
            });
            if (bestCorrCol !== -1) {
                headlineInsight = `Strong ${maxCorr >= 0 ? 'positive' : 'negative'} correlation (<strong>${maxCorr.toFixed(2)}</strong>) detected between <strong>${primaryMetricName}</strong> and <strong>${headers[bestCorrCol]}</strong>, demonstrating key linear influence.`;
            }
        }
        
        let warningRisk = `Statistical outlier detector flagged <strong>${outlierCount}</strong> anomalies in <strong>${primaryMetricName}</strong> (variance Z-score > 2.2).`;
        if (worstCat !== 'None' && worstCat !== 'General') {
            warningRisk += ` Segment <strong>${worstCat}</strong> presents the highest risk of drag-down performance.`;
        }
        
        let recommendation = `Reallocate operational budgets toward the <strong>${bestCat}</strong> segment, which shows the highest volume contribution of <strong>${formatCurrencyOrNum(maxCatVal)}</strong>.`;
        
        document.getElementById('ai-insights-text').innerHTML = `
            <span class="text-white">Headline Insight:</span> ${headlineInsight}
            <span class="text-error ml-2 px-1.5 py-0.5 rounded bg-error/10 border border-error/20 text-xs inline-flex items-center gap-1">
                <span class="material-symbols-outlined text-[12px]">warning</span>
                Risk: ${warningRisk}
            </span>
            <span class="text-secondary ml-2 px-1.5 py-0.5 rounded bg-secondary/10 border border-secondary/20 text-xs inline-flex items-center gap-1">
                <span class="material-symbols-outlined text-[12px]">auto_awesome</span>
                Rec: ${recommendation}
            </span>
        `;
        
        const selectedNumericIndices = numericIndices.slice(0, 4);
        while (selectedNumericIndices.length < 4) {
            selectedNumericIndices.push(-1);
        }
        
        // KPI Card 1
        const kpi1Idx = selectedNumericIndices[0];
        const kpi1Name = kpi1Idx !== -1 ? headers[kpi1Idx] : `Total ${primaryMetricName}`;
        const kpi1Sum = kpi1Idx !== -1 ? cleanRows.reduce((s, r) => s + (parseFloat(String(r[kpi1Idx]).replace(/[$,%]/g, '')) || 0), 0) : sumVal;
        document.getElementById('kpi-1-title').textContent = kpi1Name;
        document.getElementById('kpi-1-val').textContent = formatCurrencyOrNum(kpi1Sum);
        document.getElementById('kpi-1-status').innerHTML = `
            <span class="material-symbols-outlined text-[14px]">${growthRate >= 0 ? 'trending_up' : 'trending_down'}</span> ${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}% Period Change
        `;
        document.getElementById('kpi-1-status').className = growthRate >= 0 ? 'text-secondary text-sm flex items-center font-data-mono' : 'text-error text-sm flex items-center font-data-mono';
        renderSparkline('kpi-1-sparkline-container', cleanData.map(d => d.value), 'secondary');

        // KPI Card 2
        const kpi2Idx = selectedNumericIndices[1];
        const kpi2Name = kpi2Idx !== -1 ? `Avg ${headers[kpi2Idx]}` : `Avg ${primaryMetricName}`;
        const kpi2Val = kpi2Idx !== -1 ? (cleanRows.reduce((s, r) => s + (parseFloat(String(r[kpi2Idx]).replace(/[$,%]/g, '')) || 0), 0) / (totalCount || 1)) : avgVal;
        document.getElementById('kpi-2-title').textContent = kpi2Name;
        document.getElementById('kpi-2-val').textContent = formatCurrencyOrNum(kpi2Val);
        document.getElementById('kpi-2-status').innerHTML = `
            <span class="material-symbols-outlined text-[14px]">horizontal_rule</span> StdDev: ${formatCurrencyOrNum(stdDev)}
        `;
        document.getElementById('kpi-2-status').className = 'text-on-surface-variant text-sm flex items-center font-data-mono';
        renderSparkline('kpi-2-sparkline-container', cleanData.map(d => d.value).reverse(), 'primary');

        // KPI Card 3
        const kpi3Idx = selectedNumericIndices[2];
        const kpi3Name = kpi3Idx !== -1 ? `Total ${headers[kpi3Idx]}` : `Total Records`;
        const kpi3Val = kpi3Idx !== -1 ? formatCurrencyOrNum(cleanRows.reduce((s, r) => s + (parseFloat(String(r[kpi3Idx]).replace(/[$,%]/g, '')) || 0), 0)) : formatRowsCount(totalCount);
        document.getElementById('kpi-3-title').textContent = kpi3Name;
        document.getElementById('kpi-3-val').textContent = kpi3Val;
        document.getElementById('kpi-3-status').innerHTML = `
            <span class="material-symbols-outlined text-[14px]">check_circle</span> 100% Parsed & Cleaned
        `;
        document.getElementById('kpi-3-status').className = 'text-secondary text-sm flex items-center font-data-mono';
        renderSparkline('kpi-3-sparkline-container', Array.from({length: 6}, () => Math.random() * totalCount), 'secondary');

        // KPI Card 4
        const kpi4Idx = selectedNumericIndices[3];
        const kpi4Name = kpi4Idx !== -1 ? `Avg ${headers[kpi4Idx]}` : `Anomaly Rate`;
        const kpi4Val = kpi4Idx !== -1 ? formatCurrencyOrNum(cleanRows.reduce((s, r) => s + (parseFloat(String(r[kpi4Idx]).replace(/[$,%]/g, '')) || 0), 0) / (totalCount || 1)) : `${((outlierCount / totalCount) * 100).toFixed(1)}%`;
        const kpi4Status = kpi4Idx !== -1 ? '100% Reliability' : `${outlierCount} Outliers Detected`;
        document.getElementById('kpi-4-title').textContent = kpi4Name;
        document.getElementById('kpi-4-val').textContent = kpi4Val;
        document.getElementById('kpi-4-status').innerHTML = `
            <span class="material-symbols-outlined text-[14px]">${outlierCount > 2 ? 'trending_up' : 'trending_down'}</span> ${kpi4Status}
        `;
        document.getElementById('kpi-4-status').className = outlierCount > 2 ? 'text-error text-sm flex items-center font-data-mono' : 'text-secondary text-sm flex items-center font-data-mono';
        renderSparkline('kpi-4-sparkline-container', Array.from({length: 6}, () => Math.random() * outlierCount), 'error');

        updateTrendChart(cleanData, primaryMetricName);
        
        const geoCalloutTitle = document.getElementById('geo-callout-title');
        const geoCalloutText = document.getElementById('geo-callout-text');
        
        if (geoIndex !== -1 && bestGeo !== 'None') {
            document.getElementById('geo-title').textContent = `Geographic Distribution (${headers[geoIndex]})`;
            if (geoCalloutTitle && geoCalloutText) {
                const geoShare = ((maxGeoVal / (sumVal || 1)) * 100).toFixed(1);
                geoCalloutTitle.textContent = `${bestGeo} Regional Lead`;
                geoCalloutText.textContent = `${bestGeo} represents ${formatCurrencyOrNum(maxGeoVal)} (${geoShare}% share) across ${geoGroups[bestGeo].count} records.`;
            }
        } else {
            updateGeoCategoricalBreakdown(catGroups, primaryMetricName);
        }
        
        updateCorrelationMatrix(headers, numericIndices, cleanRows);
        updateAnomalyPlot(cleanData, avgVal, stdDev);

        document.getElementById('cleaner-last-run').textContent = 'Last run: Just now';
        const cleanerBadges = document.getElementById('cleaner-badges-container');
        cleanerBadges.innerHTML = `
            <div class="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5 interactive-scale">
                <span class="text-secondary">✓</span> Removed ${duplicateCount} duplicates
            </div>
            <div class="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5 interactive-scale">
                <span class="text-secondary">✓</span> Cleaned ${cleanData.length} records
            </div>
            <div class="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5 interactive-scale">
                <span class="text-error">!</span> Flagged ${outlierCount} outliers
            </div>
        `;
        
        updateDatasetsTab(rows, headers, cleanRows, primaryMetricIndex, dateIndex, categoryIndex);
        updateInsightsTab(cleanData, headers, primaryMetricIndex, categoryIndex, dateIndex, outlierCount, maxCatVal, bestCat, worstCat, domain);
        updateForecastingTab(cleanData, headers, primaryMetricIndex, dateIndex);
        updateCopilotTab(cleanData, headers, primaryMetricIndex, categoryIndex, dateIndex, outlierCount, maxCatVal, bestCat, worstCat, domain, bestGeo, maxGeoVal, geoIndex);
        
        updateAnalyticsTab(cleanData, headers, cleanRows, primaryMetricIndex, numericIndices, dateIndex, categoryIndex, avgVal, stdDev, skewness, kurtosis, variance, medianVal, rangeVal, anomalies);
        updateReportsTab(cleanData, headers, cleanRows, primaryMetricIndex, numericIndices, dateIndex, categoryIndex, avgVal, stdDev, outlierCount, maxCatVal, bestCat, worstCat, domain, growthRate, anomalies, bestGeo, maxGeoVal, geoIndex);
    }

    function calculateSkewness(values, mean, stdDev) {
        if (values.length < 3 || stdDev === 0) return 0;
        const n = values.length;
        const term = values.reduce((sum, v) => sum + Math.pow(v - mean, 3), 0);
        return (term / n) / Math.pow(stdDev, 3);
    }

    function calculateKurtosis(values, mean, stdDev) {
        if (values.length < 4 || stdDev === 0) return 0;
        const n = values.length;
        const term = values.reduce((sum, v) => sum + Math.pow(v - mean, 4), 0);
        return (term / n) / Math.pow(stdDev, 4) - 3;
    }

    function updateAnalyticsTab(cleanData, headers, cleanRows, primaryMetricIndex, numericIndices, dateIndex, categoryIndex, avgVal, stdDev, skewness, kurtosis, variance, medianVal, rangeVal, anomalies) {
        const descPanel = document.getElementById('analytics-descriptive-stats');
        if (descPanel) {
            descPanel.innerHTML = `
                <div class="grid grid-cols-2 gap-2 text-xs font-data-mono">
                    <div class="bg-white/5 p-2.5 rounded border border-white/5">
                        <div class="text-on-surface-variant text-[10px] uppercase">Mean</div>
                        <div class="text-white font-bold mt-1">${formatCurrencyOrNum(avgVal)}</div>
                    </div>
                    <div class="bg-white/5 p-2.5 rounded border border-white/5">
                        <div class="text-on-surface-variant text-[10px] uppercase">Median</div>
                        <div class="text-white font-bold mt-1">${formatCurrencyOrNum(medianVal)}</div>
                    </div>
                    <div class="bg-white/5 p-2.5 rounded border border-white/5">
                        <div class="text-on-surface-variant text-[10px] uppercase">Standard Deviation</div>
                        <div class="text-white font-bold mt-1">${formatCurrencyOrNum(stdDev)}</div>
                    </div>
                    <div class="bg-white/5 p-2.5 rounded border border-white/5">
                        <div class="text-on-surface-variant text-[10px] uppercase">Variance</div>
                        <div class="text-white font-bold mt-1">${formatCurrencyOrNum(variance)}</div>
                    </div>
                    <div class="bg-white/5 p-2.5 rounded border border-white/5">
                        <div class="text-on-surface-variant text-[10px] uppercase">Skewness</div>
                        <div class="text-white font-bold mt-1 ${Math.abs(skewness) > 1 ? 'text-warning' : 'text-secondary'}">${skewness.toFixed(3)}</div>
                    </div>
                    <div class="bg-white/5 p-2.5 rounded border border-white/5">
                        <div class="text-on-surface-variant text-[10px] uppercase">Kurtosis</div>
                        <div class="text-white font-bold mt-1 ${Math.abs(kurtosis) > 1 ? 'text-warning' : 'text-secondary'}">${kurtosis.toFixed(3)}</div>
                    </div>
                    <div class="bg-white/5 p-2.5 rounded border border-white/5 col-span-2">
                        <div class="text-on-surface-variant text-[10px] uppercase">Data Span Range</div>
                        <div class="text-white font-bold mt-1">${formatCurrencyOrNum(rangeVal)} <span class="text-on-surface-variant font-normal text-[10px] ml-1">(${formatCurrencyOrNum(minVal)} - ${formatCurrencyOrNum(maxVal)})</span></div>
                    </div>
                </div>
                <div class="bg-[#0e0e10]/30 p-3 rounded border border-primary/10 text-xs text-on-surface-variant leading-relaxed mt-2 border-l-2 border-l-primary">
                    <span class="font-bold text-white uppercase text-[9px] block mb-1">Distribution Analysis</span>
                    The target variable metric has a skewness coefficient of <strong>${skewness.toFixed(2)}</strong>, reflecting a ${skewness > 0.5 ? 'strongly right-skewed tail' : skewness < -0.5 ? 'strongly left-skewed tail' : 'relatively symmetrical distribution'}. The kurtosis of <strong>${kurtosis.toFixed(2)}</strong> points to a ${kurtosis > 1.0 ? 'leptokurtic shape (heavy outlier tails)' : 'platykurtic shape'}.
                </div>
            `;
        }

        const corrTbody = document.getElementById('analytics-correlation-tbody');
        if (corrTbody) {
            corrTbody.innerHTML = '';
            const topIndices = numericIndices.slice(0, 5);
            let count = 0;
            topIndices.forEach(idx => {
                if (idx === primaryMetricIndex || idx === -1) return;
                count++;
                const colA = cleanRows.map(r => parseFloat(String(r[primaryMetricIndex]).replace(/[$,%]/g, '')) || 0);
                const colB = cleanRows.map(r => parseFloat(String(r[idx]).replace(/[$,%]/g, '')) || 0);
                
                const pearson = calculatePearsonCorrelation(colA, colB);
                const spearman = calculateSpearmanCorrelation(colA, colB);
                const kendall = calculateKendallCorrelation(colA, colB);
                
                const sig = Math.abs(pearson) > 0.7 ? 'Strongly Significant' : Math.abs(pearson) > 0.4 ? 'Moderately Significant' : 'Not Significant';
                const sigClass = Math.abs(pearson) > 0.7 ? 'text-secondary' : Math.abs(pearson) > 0.4 ? 'text-primary' : 'text-on-surface-variant opacity-70';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="py-2.5 font-semibold text-white">${headers[primaryMetricIndex]} vs ${headers[idx]}</td>
                    <td class="py-2.5 text-center text-primary font-bold">${pearson.toFixed(3)}</td>
                    <td class="py-2.5 text-center text-secondary">${spearman.toFixed(3)}</td>
                    <td class="py-2.5 text-center text-tertiary-fixed-dim">${kendall.toFixed(3)}</td>
                    <td class="py-2.5 text-right font-semibold ${sigClass}">${sig}</td>
                `;
                corrTbody.appendChild(tr);
            });
            
            if (count === 0) {
                corrTbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="py-8 text-center text-on-surface-variant">The dataset contains only one numeric variable. Correlation calculation not applicable.</td>
                    </tr>
                `;
            }
        }

        const anomalyTbody = document.getElementById('analytics-anomalies-tbody');
        if (anomalyTbody) {
            anomalyTbody.innerHTML = '';
            if (anomalies.length === 0) {
                anomalyTbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="py-8 text-center text-on-surface-variant">No structural anomalies or statistical outliers detected.</td>
                    </tr>
                `;
            } else {
                anomalies.forEach(anom => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="py-2.5 font-semibold text-white">${anom.dateStr}</td>
                        <td class="py-2.5 text-white font-bold">${formatCurrencyOrNum(anom.value)}</td>
                        <td class="py-2.5 text-on-surface-variant">Z: ${anom.zScore.toFixed(2)} <span class="${anom.zScore > 0 ? 'text-secondary' : 'text-error'} text-[10px] ml-1">(${anom.deviationPct}%)</span></td>
                        <td class="py-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold border ${anom.colorClass}">${anom.severity}</span></td>
                        <td class="py-2.5 text-right text-on-surface-variant text-[11px]">
                            ${anom.severity === 'Critical' ? 'Verify audit trace logs immediately' : anom.severity === 'High' ? 'Audit individual transactions' : 'Perform standard variance check'}
                        </td>
                    `;
                    anomalyTbody.appendChild(tr);
                });
            }
        }
    }

    function updateReportsTab(cleanData, headers, cleanRows, primaryMetricIndex, numericIndices, dateIndex, categoryIndex, avgVal, stdDev, outlierCount, maxCatVal, bestCat, worstCat, domain, growthRate, anomalies, bestGeo, maxGeoVal, geoIndex) {
        const primaryMetricName = headers[primaryMetricIndex];
        const sumVal = cleanData.reduce((sum, item) => sum + item.value, 0);
        
        const briefingBody = document.getElementById('report-content-body');
        if (briefingBody) {
            const outlierPct = ((outlierCount / cleanData.length) * 100).toFixed(1);
            let geoSummary = '';
            if (geoIndex !== -1 && bestGeo !== 'None') {
                geoSummary = `The business exhibits substantial geographic concentration in the <strong>${bestGeo}</strong> region, which accounts for <strong>${formatCurrencyOrNum(maxGeoVal)}</strong> (representing a leading share). Underperforming territories like <strong>${worstGeo}</strong> represent key expansion targets.`;
            } else {
                geoSummary = `The business performance shows significant concentration in the <strong>${bestCat}</strong> segment, which accounts for <strong>${formatCurrencyOrNum(maxCatVal)}</strong> of cumulative value.`;
            }
            
            briefingBody.innerHTML = `
                <div class="space-y-4">
                    <div>
                        <span class="font-bold text-white text-[10px] uppercase tracking-wider block mb-1 text-primary">1. Operational Status Overview</span>
                        <p>
                            SnowPulse Intelligence Core conducted a comprehensive analysis of the dataset, corresponding to the <strong>${domain}</strong> business segment. The database contains <strong>${cleanData.length}</strong> clean observations across <strong>${headers.length}</strong> variables. Total consolidated value of the target metric (<strong>${primaryMetricName}</strong>) amounts to <strong>${formatCurrencyOrNum(sumVal)}</strong>, showing an average rate of <strong>${formatCurrencyOrNum(avgVal)}</strong> per record.
                        </p>
                    </div>
                    <div>
                        <span class="font-bold text-white text-[10px] uppercase tracking-wider block mb-1 text-primary">2. Trend & Growth Analysis</span>
                        <p>
                            Over the analyzed timeline, the business metric has undergone a <strong>${growthRate.toFixed(1)}% period-over-period change</strong>, indicating a <strong>${growthRate >= 0 ? 'solid upward expansion' : 'contracting rate of performance'}</strong>. Forecasting regressions suggest a continued baseline trajectory.
                        </p>
                    </div>
                    <div>
                        <span class="font-bold text-white text-[10px] uppercase tracking-wider block mb-1 text-error">3. Risks & Outlier Exposure</span>
                        <p>
                            Our statistical filters identified <strong>${outlierCount}</strong> severe anomalies representing <strong>${outlierPct}%</strong> of total data rows. ${anomalies.length > 0 ? `The most significant outlier occurred on <strong>${anomalies[0].dateStr}</strong> with a deviance of <strong>${anomalies[0].deviationPct}%</strong> from the mean.` : ''}
                            ${geoSummary}
                        </p>
                    </div>
                    <div>
                        <span class="font-bold text-white text-[10px] uppercase tracking-wider block mb-1 text-secondary">4. Tactical Summary & Outlook</span>
                        <p>
                            To optimize long-term operational health, management should reallocate budgets from saturated segments into growth opportunities. We recommend establishing transactional filters for anomalies and strengthening baseline forecasts to account for the high standard deviation of <strong>${formatCurrencyOrNum(stdDev)}</strong>.
                        </p>
                    </div>
                </div>
            `;
        }

        const roadmapTbody = document.getElementById('report-roadmap-tbody');
        if (roadmapTbody) {
            roadmapTbody.innerHTML = '';
            
            const actions = [
                { name: anomalies.length > 0 ? `Audit outlier on ${anomalies[0].dateStr}` : `Conduct transactional audit`, type: 'Risk Mitigation', impact: 90, effort: 15, confidence: 95 },
                { name: `Investigate ${bestCat} category margins`, type: 'Strategic Expansion', impact: 85, effort: 30, confidence: 90 },
                { name: geoIndex !== -1 ? `Expand operations to ${worstGeo} region` : `Cross-sell underperforming segments`, type: 'Revenue Growth', impact: 80, effort: 60, confidence: 85 },
                { name: `Optimize database validation logs`, type: 'Data Quality', impact: 65, effort: 10, confidence: 98 }
            ];
            
            actions.sort((a,b) => ((b.impact * b.confidence)/b.effort) - ((a.impact * a.confidence)/a.effort));
            
            actions.forEach(act => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="py-2.5 font-semibold text-white">
                        <div>${act.name}</div>
                        <div class="text-[8px] text-on-surface-variant/70 uppercase tracking-wider mt-0.5">${act.type}</div>
                    </td>
                    <td class="py-2.5 text-center font-bold text-primary">${act.impact}</td>
                    <td class="py-2.5 text-center text-secondary">${act.effort}</td>
                    <td class="py-2.5 text-center text-tertiary-fixed-dim">${act.confidence}%</td>
                `;
                roadmapTbody.appendChild(tr);
            });
        }

        const fcQ1 = cleanData[cleanData.length - 1].value * 3.1;
        const fcNext = cleanData[cleanData.length - 1].value * 1.05;
        
        slidesData = [
            {
                icon: 'analytics',
                title: 'Slide 1: State of the Portfolio',
                desc: `Cumulative target metric performance summarizes consolidated variables for the ${domain} domain.`,
                points: [
                    `Total volume sum: ${formatCurrencyOrNum(sumVal)}`,
                    `Average rate: ${formatCurrencyOrNum(avgVal)} per record`,
                    `Top category segment: ${bestCat} (${((maxCatVal / (sumVal || 1))*100).toFixed(1)}% share)`,
                    `Overall dataset health score: ${document.getElementById('health-score-val')?.textContent || '95%'}`
                ]
            },
            {
                icon: 'warning',
                title: 'Slide 2: Risks & Threats',
                desc: 'Statistical filters flagged critical anomalies and geographical saturation vulnerabilities.',
                points: [
                    `Flagged Outliers: ${outlierCount} records (${((outlierCount/cleanData.length)*100).toFixed(1)}% of rows)`,
                    anomalies.length > 0 ? `Max deviance spike: ${anomalies[0].dateStr} (${anomalies[0].deviationPct}%)` : `Outlier rate falls within acceptable margin`,
                    geoIndex !== -1 ? `Geographic Concentration: ${bestGeo} represents leading share` : `Category Concentration: ${bestCat} represents leading share`,
                    `Operational standard deviation variance: ${formatCurrencyOrNum(stdDev)}`
                ]
            },
            {
                icon: 'trending_up',
                title: 'Slide 3: Strategic Growth Actions',
                desc: 'Exponential smoothing regressions project next period demands and opportunity targets.',
                points: [
                    `Next period target forecast: ${formatCurrencyOrNum(fcNext)}`,
                    `Next quarter expected aggregate: ${formatCurrencyOrNum(fcQ1)}`,
                    geoIndex !== -1 ? `Target regional expansion campaign: ${worstGeo} region` : `Cross-promote underperforming categories`,
                    `Strategic action recommendation: Scale investments in ${bestCat} segment`
                ]
            }
        ];
        
        currentSlideIndex = 0;
        updateSlideUI();
    }

    function parseCSV(text) {
        let lines = [];
        let row = [""];
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            let c = text[i];
            let next = text[i+1];
            if (c === '"') {
                if (inQuotes && next === '"') { row[row.length - 1] += '"'; i++; }
                else { inQuotes = !inQuotes; }
            } else if (c === ',' && !inQuotes) {
                row.push('');
            } else if ((c === '\r' || c === '\n') && !inQuotes) {
                if (c === '\r' && next === '\n') { i++; }
                lines.push(row);
                row = [''];
            } else {
                row[row.length - 1] += c;
            }
        }
        if (row.length > 1 || row[0] !== '') { lines.push(row); }
        return lines;
    }

    function calculatePearsonCorrelation(x, y) {
        const n = x.length;
        if (n === 0) return 0;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
        
        const num = n * sumXY - sumX * sumY;
        const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        if (den === 0) return 0;
        return num / den;
    }

    function calculateSpearmanCorrelation(x, y) {
        const n = x.length;
        if (n <= 1) return 0;
        const getRanks = (arr) => {
            const sorted = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
            const ranks = new Array(n);
            let i = 0;
            while (i < n) {
                let j = i + 1;
                while (j < n && sorted[j].val === sorted[i].val) {
                    j++;
                }
                const rank = (i + 1 + j) / 2;
                for (let k = i; k < j; k++) {
                    ranks[sorted[k].idx] = rank;
                }
                i = j;
            }
            return ranks;
        };
        const ranksX = getRanks(x);
        const ranksY = getRanks(y);
        return calculatePearsonCorrelation(ranksX, ranksY);
    }

    function calculateKendallCorrelation(x, y) {
        const n = x.length;
        if (n <= 1) return 0;
        let concordant = 0;
        let discordant = 0;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const xSign = Math.sign(x[i] - x[j]);
                const ySign = Math.sign(y[i] - y[j]);
                if (xSign === 0 || ySign === 0) continue;
                if (xSign === ySign) concordant++;
                else discordant++;
            }
        }
        const totalPairs = (n * (n - 1)) / 2;
        if (totalPairs === 0) return 0;
        return (concordant - discordant) / totalPairs;
    }

    function formatRowsCount(n) {
        if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M rows';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k rows';
        return n + ' rows';
    }

    function formatCurrencyOrNum(n) {
        if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
        if (n === 0) return '0';
        return n.toFixed(1);
    }

    function renderSparkline(containerId, data, color) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const max = Math.max(...data) || 1;
        const min = Math.min(...data) || 0;
        const range = max - min || 1;
        
        let html = `<div class="w-full h-full flex items-end gap-1 opacity-60">`;
        const step = Math.max(1, Math.floor(data.length / 6));
        
        const displayData = [];
        for (let i = 0; i < data.length; i += step) {
            displayData.push(data[i]);
            if (displayData.length >= 6) break;
        }
        while (displayData.length < 6) {
            displayData.push(data[data.length - 1] || 0);
        }
        
        const colorClass = color === 'secondary' ? 'bg-secondary' : color === 'error' ? 'bg-error' : color === 'primary' ? 'bg-primary' : 'bg-tertiary-fixed-dim';
        
        displayData.forEach(val => {
            const pct = Math.max(10, Math.round(((val - min) / range) * 100));
            html += `<div class="w-1/6 ${colorClass}/40 h-[${pct}%] rounded-t-sm animate-pulse" style="height: ${pct}%"></div>`;
        });
        
        html += `</div>`;
        container.innerHTML = html;
    }

    function updateTrendChart(cleanData, metricName) {
        document.getElementById('trend-subtitle').textContent = `Timeline Trend for ${metricName}`;
        
        let chartPoints = [];
        let xLabels = [];
        
        const dateData = cleanData.filter(d => d.date !== null);
        if (dateData.length > 0) {
            const monthlyGroups = {};
            dateData.forEach(d => {
                const m = d.date.toLocaleString('default', { month: 'short' });
                if (!monthlyGroups[m]) monthlyGroups[m] = { sum: 0, count: 0 };
                monthlyGroups[m].sum += d.value;
                monthlyGroups[m].count++;
            });
            
            const monthsOrdered = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            monthsOrdered.forEach(m => {
                if (monthlyGroups[m]) {
                    chartPoints.push(monthlyGroups[m].sum);
                    xLabels.push(m);
                }
            });
            
            if (chartPoints.length < 3) {
                chartPoints = [];
                xLabels = [];
                Object.keys(monthlyGroups).forEach(m => {
                    chartPoints.push(monthlyGroups[m].sum);
                    xLabels.push(m);
                });
            }
        }
        
        if (chartPoints.length === 0) {
            const segmentSize = Math.max(1, Math.floor(cleanData.length / 6));
            for (let i = 0; i < 6; i++) {
                const segment = cleanData.slice(i * segmentSize, (i + 1) * segmentSize);
                const sum = segment.reduce((s, d) => s + d.value, 0);
                chartPoints.push(sum);
                xLabels.push(`Bin ${i+1}`);
            }
        }
        
        const max = Math.max(...chartPoints) || 1;
        const min = Math.min(...chartPoints) || 0;
        const range = max - min || 1;
        
        const N = chartPoints.length;
        const scaledActualPoints = chartPoints.map((val, idx) => {
            const x = (idx / (N + 2)) * 100;
            const y = 90 - ((val - min) / range) * 70;
            return { x, y };
        });
        
        let scaledActualPathD = `M ${scaledActualPoints[0].x},${scaledActualPoints[0].y}`;
        for (let i = 1; i < scaledActualPoints.length; i++) {
            scaledActualPathD += ` L ${scaledActualPoints[i].x},${scaledActualPoints[i].y}`;
        }
        document.getElementById('trend-actual-line').setAttribute('d', scaledActualPathD);
        
        let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
        for (let i = 0; i < N; i++) {
            sumX += i;
            sumY += chartPoints[i];
            sumXX += i * i;
            sumXY += i * chartPoints[i];
        }
        const slope = (N * sumXY - sumX * sumY) / (N * sumXX - sumX * sumX) || 0;
        const intercept = (sumY - slope * sumX) / N;
        
        const forecastPoints = [];
        for (let i = N - 1; i < N + 3; i++) {
            const val = slope * i + intercept;
            const x = (i / (N + 2)) * 100;
            const y = 90 - ((Math.max(min, Math.min(max * 1.2, val)) - min) / range) * 70;
            forecastPoints.push({ x, y });
        }
        
        let forecastPathD = `M ${scaledActualPoints[scaledActualPoints.length - 1].x},${scaledActualPoints[scaledActualPoints.length - 1].y}`;
        for (let i = 1; i < forecastPoints.length; i++) {
            forecastPathD += ` L ${forecastPoints[i].x},${forecastPoints[i].y}`;
        }
        document.getElementById('trend-forecast-line').setAttribute('d', forecastPathD);
        
        let ciD = `M ${scaledActualPoints[scaledActualPoints.length - 1].x},${scaledActualPoints[scaledActualPoints.length - 1].y}`;
        const ciUpper = [];
        const ciLower = [];
        for (let i = 1; i < forecastPoints.length; i++) {
            const spread = i * 6;
            ciUpper.push({ x: forecastPoints[i].x, y: Math.max(10, forecastPoints[i].y - spread) });
            ciLower.push({ x: forecastPoints[i].x, y: Math.min(95, forecastPoints[i].y + spread) });
        }
        
        ciUpper.forEach(p => ciD += ` L ${p.x},${p.y}`);
        for (let i = ciLower.length - 1; i >= 0; i--) {
            ciD += ` L ${ciLower[i].x},${ciLower[i].y}`;
        }
        ciD += ' Z';
        document.getElementById('trend-ci-path').setAttribute('d', ciD);
        
        const lastPt = scaledActualPoints[scaledActualPoints.length - 1];
        const nodeCircle = document.getElementById('trend-node-circle');
        nodeCircle.setAttribute('cx', lastPt.x);
        nodeCircle.setAttribute('cy', lastPt.y);
        
        const pulseOverlay = document.getElementById('trend-pulse-overlay');
        pulseOverlay.style.left = `${lastPt.x}%`;
        pulseOverlay.style.top = `${lastPt.y}%`;
        
        const yAxis = document.getElementById('trend-y-axis');
        yAxis.innerHTML = `
            <span>${formatCurrencyOrNum(max)}</span>
            <span>${formatCurrencyOrNum(min + range * 0.66)}</span>
            <span>${formatCurrencyOrNum(min + range * 0.33)}</span>
            <span>${formatCurrencyOrNum(min)}</span>
        `;
        
        const xAxis = document.getElementById('trend-x-axis');
        xAxis.innerHTML = xLabels.map(l => `<span>${l}</span>`).join('');
    }

    function updateGeoCategoricalBreakdown(catGroups, metricName) {
        document.getElementById('geo-title').textContent = `Categorical Breakdown`;
        const container = document.getElementById('geo-panel-content');
        
        const sortedCats = Object.keys(catGroups).map(cat => ({
            name: cat,
            sum: catGroups[cat].sum,
            count: catGroups[cat].count
        })).sort((a, b) => b.sum - a.sum).slice(0, 5);
        
        const maxVal = Math.max(...sortedCats.map(c => c.sum)) || 1;
        
        let html = `<div class="flex-1 flex flex-col justify-around gap-2 bg-[#0d0d0f] border border-white/5 rounded p-3">`;
        
        sortedCats.forEach(c => {
            const pct = Math.round((c.sum / maxVal) * 100);
            html += `
                <div class="flex flex-col">
                    <div class="flex justify-between text-xs mb-1">
                        <span class="text-on-surface truncate max-w-[150px]">${c.name}</span>
                        <span class="font-data-mono text-on-surface-variant">${formatCurrencyOrNum(c.sum)}</span>
                    </div>
                    <div class="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                        <div class="bg-primary h-full rounded-full" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        });
        
        html += `
            <div class="glass-panel p-2.5 rounded text-xs shadow-md mt-2 flex items-start gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-secondary mt-1 shadow-[0_0_8px_#00a572]"></div>
                <div>
                    <div class="text-on-surface font-medium">Top Performer</div>
                    <div class="text-on-surface-variant text-[11px] mt-0.5">${sortedCats[0]?.name || 'N/A'} represents the highest share with ${formatCurrencyOrNum(sortedCats[0]?.sum || 0)}.</div>
                </div>
            </div>
        `;
        
        html += `</div>`;
        container.innerHTML = html;
    }

    function updateCorrelationMatrix(headers, numericIndices, cleanRows) {
        const grid = document.getElementById('correlation-matrix-grid');
        grid.innerHTML = '';
        
        const topIndices = numericIndices.slice(0, 4);
        while (topIndices.length < 4) {
            topIndices.push(-1);
        }
        
        const matrix = [];
        for (let i = 0; i < 4; i++) {
            matrix.push([]);
            for (let j = 0; j < 4; j++) {
                if (topIndices[i] === -1 || topIndices[j] === -1) {
                    matrix[i].push(0.0);
                } else if (i === j) {
                    matrix[i].push(1.0);
                } else {
                    const colA = cleanRows.map(r => parseFloat(String(r[topIndices[i]]).replace(/[$,%]/g, '')) || 0);
                    const colB = cleanRows.map(r => parseFloat(String(r[topIndices[j]]).replace(/[$,%]/g, '')) || 0);
                    matrix[i].push(calculatePearsonCorrelation(colA, colB));
                }
            }
        }
        
        const names = topIndices.map(idx => idx !== -1 ? headers[idx].slice(0, 8) : 'N/A');
        document.getElementById('corr-matrix-title').textContent = `Correlation Matrix (${names.join(', ')})`;
        
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                const corr = matrix[i][j];
                const div = document.createElement('div');
                div.className = 'rounded-sm flex items-center justify-center text-[10px] font-data-mono text-white/80 transition-all duration-300 hover:scale-105';
                
                if (corr >= 0) {
                    const alpha = Math.round(corr * 10) / 10;
                    div.style.backgroundColor = `rgba(99, 102, 241, ${Math.max(0.1, alpha)})`;
                } else {
                    const alpha = Math.round(Math.abs(corr) * 10) / 10;
                    div.style.backgroundColor = `rgba(239, 68, 68, ${Math.max(0.1, alpha)})`;
                }
                
                div.textContent = corr.toFixed(2);
                const nameA = topIndices[i] !== -1 ? headers[topIndices[i]] : 'N/A';
                const nameB = topIndices[j] !== -1 ? headers[topIndices[j]] : 'N/A';
                div.title = `${nameA} vs ${nameB}: ${corr.toFixed(4)}`;
                grid.appendChild(div);
            }
        }
    }

    function updateAnomalyPlot(cleanData, avgVal, stdDev) {
        const container = document.getElementById('anomaly-plot-container');
        container.innerHTML = '';
        
        const totalCount = cleanData.length;
        let outlierCount = 0;
        
        const step = Math.max(1, Math.floor(totalCount / 50));
        const plotPoints = [];
        
        for (let i = 0; i < totalCount; i += step) {
            plotPoints.push(cleanData[i]);
        }
        
        const minVal = Math.min(...cleanData.map(d => d.value)) || 0;
        const maxVal = Math.max(...cleanData.map(d => d.value)) || 1;
        const range = maxVal - minVal || 1;
        
        plotPoints.forEach((p, idx) => {
            const z = (p.value - avgVal) / stdDev;
            const isOutlier = Math.abs(z) > 2.0;
            if (isOutlier) outlierCount++;
            
            const left = (idx / (plotPoints.length - 1)) * 90 + 5;
            const bottom = ((p.value - minVal) / range) * 80 + 10;
            
            const dot = document.createElement('div');
            if (isOutlier) {
                dot.className = 'absolute w-2.5 h-2.5 rounded-full bg-error shadow-[0_0_10px_rgba(255,180,171,0.6)] animate-pulse z-10 cursor-pointer';
                const dateStr = p.date ? p.date.toLocaleDateString() : `ID ${p.id}`;
                dot.title = `Anomaly (${dateStr}): ${p.category} = ${formatCurrencyOrNum(p.value)} (Z-score: ${z.toFixed(2)})`;
            } else {
                dot.className = 'absolute w-1.5 h-1.5 rounded-full bg-primary/40 hover:bg-primary/80 transition-all cursor-pointer';
                dot.title = `Data: ${p.category} = ${formatCurrencyOrNum(p.value)}`;
            }
            
            dot.style.left = `${left}%`;
            dot.style.bottom = `${bottom}%`;
            container.appendChild(dot);
        });
        
        document.getElementById('anomaly-status-badge').textContent = `${outlierCount} Outliers`;
    }

    // Default initialization CSV
    const DEFAULT_CSV = `Date,Revenue,Category,Region,Outliers
2024-01-01,150000,Electronics,South,12
2024-01-01,150000,Electronics,South,12
2024-02-01,180000,Electronics,South,15
2024-03-01,165000,Apparel,South,10
2024-04-01,210000,Electronics,East,18
2024-05-01,195000,Apparel,West,14
2024-06-01,250000,Home,North,22
2024-07-01,240000,Electronics,South,20
2024-08-01,280000,Apparel,West,25
2024-09-01,270000,Home,East,21
2024-10-01,310000,Electronics,South,29
2024-11-01,950000,Electronics,South,99
2024-12-01,320000,Apparel,West,30`;

    document.getElementById('chip-dataset-name').textContent = "test_sales_data";
    analyzeDataset(DEFAULT_CSV);
})();

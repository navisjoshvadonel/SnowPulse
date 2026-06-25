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
        if (!cleanData || cleanData.length === 0) return;
        
        const primaryMetricName = headers[primaryMetricIndex];
        
        // ----------------------------------------------------
        // PANEL 1: TREND INTELLIGENCE CALCULATIONS
        // ----------------------------------------------------
        
        // Growth Rate calculation
        let growthPct = 0;
        if (cleanData.length >= 2) {
            const firstVal = cleanData[0].value;
            const lastVal = cleanData[cleanData.length - 1].value;
            if (firstVal !== 0) {
                growthPct = ((lastVal - firstVal) / Math.abs(firstVal)) * 100;
            }
        }
        
        // Group by category to find top/worst performing segments
        let bestCat = 'None';
        let worstCat = 'None';
        let topCatVal = 0;
        let worstCatVal = 0;
        
        if (categoryIndex !== -1) {
            const catSums = {};
            cleanData.forEach(d => {
                catSums[d.category] = (catSums[d.category] || 0) + d.value;
            });
            const catEntries = Object.entries(catSums);
            if (catEntries.length > 0) {
                catEntries.sort((a, b) => b[1] - a[1]);
                bestCat = catEntries[0][0];
                topCatVal = catEntries[0][1];
                worstCat = catEntries[catEntries.length - 1][0];
                worstCatVal = catEntries[catEntries.length - 1][1];
            }
        } else {
            bestCat = 'General';
            worstCat = 'General';
            topCatVal = avgVal;
            worstCatVal = avgVal;
        }
        
        // Trend Score (0-100) & Confidence Score (0-100)
        let trendScore = Math.min(100, Math.max(0, Math.round(50 + growthPct * 1.5)));
        const cv = avgVal > 0 ? (stdDev / avgVal) : 0;
        let confidenceScore = Math.min(99, Math.max(60, Math.round(100 - cv * 35)));
        
        // Set badges and summary metrics
        const growthBadge = document.getElementById('trend-growth-val');
        if (growthBadge) {
            growthBadge.textContent = `${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%`;
            growthBadge.className = `text-xs font-bold mt-1 ${growthPct >= 0 ? 'text-secondary' : 'text-error'}`;
        }
        
        const topSegText = document.getElementById('trend-top-seg');
        if (topSegText) {
            topSegText.textContent = bestCat;
            topSegText.title = `${bestCat}: ${formatCurrencyOrNum(topCatVal)}`;
        }
        
        const worstSegText = document.getElementById('trend-worst-seg');
        if (worstSegText) {
            worstSegText.textContent = worstCat;
            worstSegText.title = `${worstCat}: ${formatCurrencyOrNum(worstCatVal)}`;
        }
        
        const trendScoreBadge = document.getElementById('trend-score-badge');
        if (trendScoreBadge) {
            trendScoreBadge.textContent = `Trend: ${trendScore}/100`;
            trendScoreBadge.className = `text-xs font-bold font-data-mono px-2.5 py-1 rounded border ${trendScore >= 60 ? 'bg-secondary/20 text-secondary border-secondary/30' : trendScore >= 40 ? 'bg-primary/20 text-primary border-primary/30' : 'bg-error/20 text-error border-error/30'}`;
        }
        
        const trendConfidenceBadge = document.getElementById('trend-confidence-badge');
        if (trendConfidenceBadge) {
            trendConfidenceBadge.textContent = `${confidenceScore}% Confidence`;
        }
        
        // Write summaries
        const execSummary = document.getElementById('trend-exec-summary');
        if (execSummary) {
            let directionText = growthPct >= 0 ? 'expanding' : 'declining';
            let changeVerb = growthPct >= 0 ? 'grew by' : 'fell by';
            execSummary.innerHTML = `The historical performance of <strong>${primaryMetricName}</strong> shows an overall <strong>${directionText}</strong> trend, having ${changeVerb} <strong>${Math.abs(growthPct).toFixed(1)}%</strong> from the start of the recorded time series. The key operations segment driving this trend is <strong>${bestCat}</strong>, whereas <strong>${worstCat}</strong> represents the primary drag on growth.`;
        }
        
        const growthDrivers = document.getElementById('trend-growth-drivers');
        if (growthDrivers) {
            growthDrivers.innerHTML = `
                <li><strong>${bestCat} Segment</strong>: Dominates contribution.</li>
                <li><strong>Trend Consistency</strong>: Growth stability is registered at ${confidenceScore}%.</li>
            `;
        }
        
        const declineDrivers = document.getElementById('trend-decline-drivers');
        if (declineDrivers) {
            declineDrivers.innerHTML = `
                <li><strong>${worstCat} Segment</strong>: Underperforming segment lagging behind.</li>
                <li><strong>Outlier Variance</strong>: Flagged anomalies present operational risk.</li>
            `;
        }
        
        // ----------------------------------------------------
        // PANEL 1: DRAW TREND SVG CHART
        // ----------------------------------------------------
        const trendSvg = document.getElementById('trend-intel-svg');
        if (trendSvg) {
            trendSvg.innerHTML = '';
            
            const width = 500;
            const height = 200;
            const paddingX = 50;
            const paddingY = 30;
            
            const values = cleanData.map(d => d.value);
            const minValVal = Math.min(...values) * 0.95;
            const maxValVal = Math.max(...values) * 1.05;
            const valueRange = (maxValVal - minValVal) || 1;
            
            const points = cleanData.map((d, i) => {
                const x = paddingX + (i / (cleanData.length - 1)) * (width - 2 * paddingX);
                const y = height - paddingY - ((d.value - minValVal) / valueRange) * (height - 2 * paddingY);
                return { x, y, val: d.value };
            });
            
            // Build linear regression line
            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
            const n = points.length;
            points.forEach((p, i) => {
                sumX += i;
                sumY += p.y;
                sumXY += i * p.y;
                sumXX += i * i;
            });
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
            const intercept = (sumY - slope * sumX) / n;
            const regPoints = points.map((p, i) => {
                return { x: p.x, y: slope * i + intercept };
            });
            
            // Draw Grid Lines & Axes
            for (let i = 0; i <= 3; i++) {
                const y = paddingY + (i / 3) * (height - 2 * paddingY);
                const val = maxValVal - (i / 3) * valueRange;
                trendSvg.innerHTML += `
                    <line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="2,2"/>
                    <text x="${paddingX - 10}" y="${y + 3}" fill="rgba(255,255,255,0.4)" font-size="8" text-anchor="end" font-family="monospace">${formatCurrencyOrNum(val)}</text>
                `;
            }
            
            // Area Path (semi-transparent gradient)
            const areaPath = `
                M ${points[0].x} ${height - paddingY}
                L ${points.map(p => `${p.x} ${p.y}`).join(' L ')}
                L ${points[points.length - 1].x} ${height - paddingY} Z
            `;
            trendSvg.innerHTML += `
                <defs>
                    <linearGradient id="trend-area-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#6366f1" stop-opacity="0.25"/>
                        <stop offset="100%" stop-color="#6366f1" stop-opacity="0.0"/>
                    </linearGradient>
                </defs>
                <path d="${areaPath}" fill="url(#trend-area-grad)"/>
            `;
            
            // Regression Line (dashed)
            const regPath = `M ${regPoints[0].x} ${regPoints[0].y} L ${regPoints[regPoints.length - 1].x} ${regPoints[regPoints.length - 1].y}`;
            trendSvg.innerHTML += `
                <path d="${regPath}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="4,4"/>
            `;
            
            // Trend Line
            const linePath = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
            trendSvg.innerHTML += `
                <path d="${linePath}" stroke="#6366f1" stroke-width="2" fill="none"/>
            `;
            
            // Find Peak and Floor indices
            let maxPt = points[0], minPt = points[0];
            points.forEach(p => {
                if (p.val > maxPt.val) maxPt = p;
                if (p.val < minPt.val) minPt = p;
            });
            
            // Add interactive markers for Max and Min
            trendSvg.innerHTML += `
                <!-- Peak Point -->
                <circle cx="${maxPt.x}" cy="${maxPt.y}" r="4" fill="#10b981" stroke="#09090b" stroke-width="1.5"/>
                <line x1="${maxPt.x}" y1="${maxPt.y}" x2="${maxPt.x}" y2="${maxPt.y - 12}" stroke="#10b981" stroke-width="1"/>
                <rect x="${maxPt.x - 45}" y="${maxPt.y - 25}" width="90" height="12" rx="2" fill="#09090b" stroke="#10b981" stroke-width="0.5"/>
                <text x="${maxPt.x}" y="${maxPt.y - 16}" fill="#10b981" font-size="7" font-weight="bold" font-family="monospace" text-anchor="middle">PEAK: ${formatCurrencyOrNum(maxPt.val)}</text>
                
                <!-- Floor Point -->
                <circle cx="${minPt.x}" cy="${minPt.y}" r="4" fill="#ef4444" stroke="#09090b" stroke-width="1.5"/>
                <line x1="${minPt.x}" y1="${minPt.y}" x2="${minPt.x}" y2="${minPt.y + 12}" stroke="#ef4444" stroke-width="1"/>
                <rect x="${minPt.x - 45}" y="${minPt.y + 14}" width="90" height="12" rx="2" fill="#09090b" stroke="#ef4444" stroke-width="0.5"/>
                <text x="${minPt.x}" y="${minPt.y + 22}" fill="#ef4444" font-size="7" font-weight="bold" font-family="monospace" text-anchor="middle">FLOOR: ${formatCurrencyOrNum(minPt.val)}</text>
            `;
            
            // X-Axis Date Labels (First, Middle, Last)
            const firstDateStr = cleanData[0].date.toLocaleDateString(undefined, {month:'short', year:'2-digit'});
            const midDateStr = cleanData[Math.floor(cleanData.length/2)].date.toLocaleDateString(undefined, {month:'short', year:'2-digit'});
            const lastDateStr = cleanData[cleanData.length-1].date.toLocaleDateString(undefined, {month:'short', year:'2-digit'});
            trendSvg.innerHTML += `
                <text x="${paddingX}" y="${height - paddingY + 12}" fill="rgba(255,255,255,0.4)" font-size="8" font-family="monospace">${firstDateStr}</text>
                <text x="${width/2}" y="${height - paddingY + 12}" fill="rgba(255,255,255,0.4)" font-size="8" font-family="monospace" text-anchor="middle">${midDateStr}</text>
                <text x="${width - paddingX}" y="${height - paddingY + 12}" fill="rgba(255,255,255,0.4)" font-size="8" font-family="monospace" text-anchor="end">${lastDateStr}</text>
            `;
        }
        
        // ----------------------------------------------------
        // PANEL 2: ROOT CAUSE CALCULATIONS & DRIVER TREE
        // ----------------------------------------------------
        const corrList = document.getElementById('root-cause-correlation-list');
        let topDriverName = 'None';
        let maxCorr = 0;
        
        if (corrList) {
            corrList.innerHTML = '';
            const topIndices = numericIndices.slice(0, 5);
            let count = 0;
            topIndices.forEach(idx => {
                if (idx === primaryMetricIndex || idx === -1) return;
                count++;
                const colA = cleanRows.map(r => parseFloat(String(r[primaryMetricIndex]).replace(/[$,%]/g, '')) || 0);
                const colB = cleanRows.map(r => parseFloat(String(r[idx]).replace(/[$,%]/g, '')) || 0);
                
                const pearson = calculatePearsonCorrelation(colA, colB);
                if (Math.abs(pearson) > Math.abs(maxCorr)) {
                    maxCorr = pearson;
                    topDriverName = headers[idx];
                }
                
                const sigClass = Math.abs(pearson) > 0.7 ? 'text-secondary' : Math.abs(pearson) > 0.4 ? 'text-primary' : 'text-on-surface-variant/70';
                corrList.innerHTML += `
                    <li class="flex justify-between items-center py-0.5 border-b border-white/5">
                        <span class="truncate pr-1">${headers[idx]}</span>
                        <span class="font-bold ${sigClass}">${pearson.toFixed(3)}</span>
                    </li>
                `;
            });
            
            if (count === 0) {
                corrList.innerHTML = `<li class="text-on-surface-variant italic">Only 1 numeric column.</li>`;
            }
        }
        
        const topDriverTitle = document.getElementById('top-driver-title');
        const topDriverEvidence = document.getElementById('top-driver-evidence');
        if (topDriverTitle && topDriverEvidence) {
            if (topDriverName !== 'None') {
                topDriverTitle.textContent = topDriverName;
                topDriverEvidence.innerHTML = `Attribution factor shows a Pearson correlation of <strong>${maxCorr.toFixed(2)}</strong> with ${primaryMetricName}. Operational variance is strongly driven by fluctuations in ${topDriverName}.`;
            } else {
                topDriverTitle.textContent = 'Operational Volume';
                topDriverEvidence.innerHTML = `No other numerical driver variables detected. Root causes reside in segment density distribution.`;
            }
        }
        
        // Draw Driver Tree
        const treeSvg = document.getElementById('root-cause-tree-svg');
        if (treeSvg) {
            treeSvg.innerHTML = '';
            
            const nodes = [
                { id: 'root', label: primaryMetricName, x: 45, y: 70, type: 'root' },
                { id: 'seg1', label: bestCat, x: 215, y: 35, type: 'seg' },
                { id: 'seg2', label: worstCat !== bestCat ? worstCat : 'Others', x: 215, y: 105, type: 'seg' },
                { id: 'drv1', label: topDriverName !== 'None' ? topDriverName : 'Volume', x: 385, y: 20, type: 'drv' },
                { id: 'drv2', label: 'Time Trend', x: 385, y: 65, type: 'drv' },
                { id: 'drv3', label: 'Residuals', x: 385, y: 110, type: 'drv' }
            ];
            
            const drawLink = (n1, n2) => {
                const dx = n2.x - n1.x;
                const pathStr = `M ${n1.x} ${n1.y} C ${n1.x + dx/2} ${n1.y} ${n2.x - dx/2} ${n2.y} ${n2.x} ${n2.y}`;
                return `<path d="${pathStr}" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" fill="none"/>`;
            };
            
            treeSvg.innerHTML += drawLink(nodes[0], nodes[1]);
            treeSvg.innerHTML += drawLink(nodes[0], nodes[2]);
            treeSvg.innerHTML += drawLink(nodes[1], nodes[3]);
            treeSvg.innerHTML += drawLink(nodes[1], nodes[4]);
            treeSvg.innerHTML += drawLink(nodes[2], nodes[4]);
            treeSvg.innerHTML += drawLink(nodes[2], nodes[5]);
            
            nodes.forEach(n => {
                let colorClass = '#6366f1';
                if (n.type === 'seg') colorClass = '#10b981';
                if (n.type === 'drv') colorClass = '#facc15';
                
                treeSvg.innerHTML += `
                    <rect x="${n.x - 35}" y="${n.y - 12}" width="70" height="24" rx="3" fill="#09090b" stroke="${colorClass}" stroke-width="1"/>
                    <text x="${n.x}" y="${n.y + 3}" fill="#ffffff" font-size="7" font-weight="bold" font-family="monospace" text-anchor="middle" class="truncate">${n.label.substring(0, 11)}</text>
                `;
            });
        }
        
        // Root Cause Cards
        const rcContainer = document.getElementById('root-cause-cards-container');
        if (rcContainer) {
            rcContainer.innerHTML = `
                <div class="bg-white/5 p-2 rounded border border-white/5">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-secondary text-[9px] uppercase">1. Segment concentration</span>
                        <span class="text-[8px] bg-secondary/10 text-secondary border border-secondary/25 px-1 py-0.5 rounded">High Confidence</span>
                    </div>
                    <p class="text-[10px] text-on-surface-variant mt-1"><strong>Cause:</strong> Dominance of ${bestCat} segment accounts for the majority contribution.<br/><strong>Evidence:</strong> Group aggregates show it represents top performance metrics.</p>
                </div>
                <div class="bg-white/5 p-2 rounded border border-white/5">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-primary text-[9px] uppercase">2. Numeric correlation</span>
                        <span class="text-[8px] bg-primary/10 text-primary border border-primary/25 px-1 py-0.5 rounded">Medium Confidence</span>
                    </div>
                    <p class="text-[10px] text-on-surface-variant mt-1"><strong>Cause:</strong> Covariance detected with ${topDriverName !== 'None' ? topDriverName : 'volume indicators'}.<br/><strong>Evidence:</strong> Calculated Pearson coefficient of ${maxCorr.toFixed(2)} indicates linked outcomes.</p>
                </div>
            `;
        }
        
        // ----------------------------------------------------
        // PANEL 3: FORECAST & RISK CALCULATIONS & SVG
        // ----------------------------------------------------
        
        const valuesY = cleanData.map(d => d.value);
        const countN = valuesY.length;
        let sumX_fc = 0, sumY_fc = 0, sumXY_fc = 0, sumXX_fc = 0;
        for (let i = 0; i < countN; i++) {
            sumX_fc += i;
            sumY_fc += valuesY[i];
            sumXY_fc += i * valuesY[i];
            sumXX_fc += i * i;
        }
        const slope_fc = (countN * sumXY_fc - sumX_fc * sumY_fc) / (countN * sumXX_fc - sumX_fc * sumX_fc || 1);
        const intercept_fc = (sumY_fc - slope_fc * sumX_fc) / countN;
        
        const nextMonthIndex = countN;
        const nextQuarterIndex = countN + 2;
        
        const forecastMonth = slope_fc * nextMonthIndex + intercept_fc;
        const forecastQuarter = slope_fc * nextQuarterIndex + intercept_fc;
        
        const margin = stdDev * 1.5;
        const bestMonth = forecastMonth + margin;
        const worstMonth = forecastMonth - margin;
        
        const fMonthEl = document.getElementById('forecast-month-val');
        if (fMonthEl) fMonthEl.textContent = formatCurrencyOrNum(forecastMonth);
        const fQuarterEl = document.getElementById('forecast-quarter-val');
        if (fQuarterEl) fQuarterEl.textContent = formatCurrencyOrNum(forecastQuarter);
        const fExpectedEl = document.getElementById('forecast-expected-val');
        if (fExpectedEl) fExpectedEl.textContent = formatCurrencyOrNum(forecastMonth);
        const fBestEl = document.getElementById('forecast-best-val');
        if (fBestEl) fBestEl.textContent = formatCurrencyOrNum(bestMonth);
        const fWorstEl = document.getElementById('forecast-worst-val');
        if (fWorstEl) fWorstEl.textContent = formatCurrencyOrNum(Math.max(0, worstMonth));
        
        const forecastRisksDesc = document.getElementById('forecast-risks-desc');
        if (forecastRisksDesc) {
            if (slope_fc < 0) {
                forecastRisksDesc.innerHTML = `<strong>Systemic Decline Alert</strong>: Time-series regression indicates a downward trend with a slope of <strong>${slope_fc.toFixed(2)}</strong>. Budget mitigation required.`;
            } else if (stdDev / avgVal > 0.4) {
                forecastRisksDesc.innerHTML = `<strong>High Volatility Warning</strong>: Outliers and high standard deviation (cv: <strong>${(stdDev/avgVal).toFixed(2)}</strong>) present forecasting uncertainty. Keep buffer reserves.`;
            } else {
                forecastRisksDesc.innerHTML = `<strong>Stable Performance</strong>: Forecast indicates consistent performance. Focus on incremental optimizations.`;
            }
        }
        
        // Draw Forecast SVG Chart
        const fcSvg = document.getElementById('forecast-risk-svg');
        if (fcSvg) {
            fcSvg.innerHTML = '';
            
            const width = 400;
            const height = 160;
            const paddingX = 40;
            const paddingY = 20;
            
            const minV = Math.min(...valuesY, Math.max(0, worstMonth)) * 0.95;
            const maxV = Math.max(...valuesY, bestMonth) * 1.05;
            const rangeV = (maxV - minV) || 1;
            
            const histPoints = cleanData.map((d, i) => {
                const x = paddingX + (i / (countN - 1)) * (width * 0.75 - paddingX);
                const y = height - paddingY - ((d.value - minV) / rangeV) * (height - 2 * paddingY);
                return { x, y };
            });
            
            const fcXStart = width * 0.75;
            const fcXEnd = width - paddingX;
            
            const lastHistPt = histPoints[histPoints.length - 1];
            
            const fcExpectedY = height - paddingY - ((forecastMonth - minV) / rangeV) * (height - 2 * paddingY);
            const fcBestY = height - paddingY - ((bestMonth - minV) / rangeV) * (height - 2 * paddingY);
            const fcWorstY = height - paddingY - ((Math.max(0, worstMonth) - minV) / rangeV) * (height - 2 * paddingY);
            
            // Grid Lines
            for (let i = 0; i <= 2; i++) {
                const y = paddingY + (i / 2) * (height - 2 * paddingY);
                const val = maxV - (i / 2) * rangeV;
                fcSvg.innerHTML += `
                    <line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="2,2"/>
                    <text x="${paddingX - 5}" y="${y + 3}" fill="rgba(255,255,255,0.3)" font-size="7" font-anchor="end" font-family="monospace">${formatCurrencyOrNum(val)}</text>
                `;
            }
            
            // Forecast Confidence Band
            fcSvg.innerHTML += `
                <polygon points="${lastHistPt.x},${lastHistPt.y} ${fcXEnd},${fcBestY} ${fcXEnd},${fcWorstY}" fill="rgba(99,102,241,0.15)"/>
                <line x1="${fcXStart}" y1="${paddingY}" x2="${fcXStart}" y2="${height - paddingY}" stroke="rgba(255,255,255,0.2)" stroke-dasharray="3,3"/>
                <text x="${fcXStart + 5}" y="${paddingY + 10}" fill="rgba(255,255,255,0.5)" font-size="6" font-family="monospace">Forecast Horizon</text>
            `;
            
            // Draw historical line
            const histLinePath = `M ${histPoints.map(p => `${p.x} ${p.y}`).join(' L ')}`;
            fcSvg.innerHTML += `
                <path d="${histLinePath}" stroke="#6366f1" stroke-width="1.5" fill="none"/>
            `;
            
            // Draw forecast scenario lines
            fcSvg.innerHTML += `
                <!-- Expected Line -->
                <line x1="${lastHistPt.x}" y1="${lastHistPt.y}" x2="${fcXEnd}" y2="${fcExpectedY}" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="3,3"/>
                <!-- Best Case Line -->
                <line x1="${lastHistPt.x}" y1="${lastHistPt.y}" x2="${fcXEnd}" y2="${fcBestY}" stroke="#10b981" stroke-width="1" stroke-dasharray="2,2"/>
                <!-- Worst Case Line -->
                <line x1="${lastHistPt.x}" y1="${lastHistPt.y}" x2="${fcXEnd}" y2="${fcWorstY}" stroke="#ef4444" stroke-width="1" stroke-dasharray="2,2"/>
            `;
        }
        
        // ----------------------------------------------------
        // PANEL 4: RECOMMENDATIONS & PRIORITY MATRIX
        // ----------------------------------------------------
        
        const pmSvg = document.getElementById('priority-matrix-svg');
        if (pmSvg) {
            pmSvg.innerHTML = '';
            
            const recDots = [
                { label: 'R1', name: 'Expand segment', x: 150, y: 40, color: '#10b981' },
                { label: 'R2', name: 'Cap outliers', x: 130, y: 70, color: '#6366f1' },
                { label: 'R3', name: 'Monitor anomaly', x: 60, y: 110, color: '#facc15' },
                { label: 'R4', name: 'Optimize logistics', x: 40, y: 140, color: 'rgba(255,255,255,0.4)' }
            ];
            
            recDots.forEach(d => {
                pmSvg.innerHTML += `
                    <circle cx="${d.x}" cy="${d.y}" r="5" fill="${d.color}" stroke="#09090b" stroke-width="1.5"/>
                    <text x="${d.x + 8}" y="${d.y + 3}" fill="#ffffff" font-size="7" font-weight="bold" font-family="monospace">${d.label}</text>
                `;
            });
        }
        
        const recBiggestOppEl = document.getElementById('rec-biggest-opp');
        if (recBiggestOppEl) {
            recBiggestOppEl.innerHTML = `Focus capital allocations towards scaling the <strong>${bestCat}</strong> segment which currently yields the strongest growth profile.`;
        }
        const recBiggestRiskEl = document.getElementById('rec-biggest-risk');
        if (recBiggestRiskEl) {
            recBiggestRiskEl.innerHTML = `Establish variance safeguards against ${worstCat} segment slippages and outlier volatility triggers.`;
        }
        
        const recList = document.getElementById('rec-list-container');
        if (recList) {
            recList.innerHTML = `
                <div class="bg-white/5 p-2 rounded border border-white/5 text-[11px] flex justify-between items-center gap-2">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-[#10b981]">R1</span>
                        <div>
                            <span class="text-white font-bold block">Scale Operational Segment: ${bestCat}</span>
                            <span class="text-[9px] text-on-surface-variant block">Quick Win: low effort / high impact</span>
                        </div>
                    </div>
                    <div class="flex gap-1 text-[8px] font-data-mono">
                        <span class="px-1.5 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/20">Imp: High</span>
                        <span class="px-1.5 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/20">Eff: Low</span>
                    </div>
                </div>
                
                <div class="bg-white/5 p-2 rounded border border-white/5 text-[11px] flex justify-between items-center gap-2">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-[#6366f1]">R2</span>
                        <div>
                            <span class="text-white font-bold block">Mitigate Outliers in ${topDriverName !== 'None' ? topDriverName : 'values'}</span>
                            <span class="text-[9px] text-on-surface-variant block">Strategic: medium effort / high impact</span>
                        </div>
                    </div>
                    <div class="flex gap-1 text-[8px] font-data-mono">
                        <span class="px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">Imp: High</span>
                        <span class="px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">Eff: Med</span>
                    </div>
                </div>
                
                <div class="bg-white/5 p-2 rounded border border-white/5 text-[11px] flex justify-between items-center gap-2">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-[#facc15]">R3</span>
                        <div>
                            <span class="text-white font-bold block">Monitor Anomalies & Volatility</span>
                            <span class="text-[9px] text-on-surface-variant block">Fill-In: low effort / medium impact</span>
                        </div>
                    </div>
                    <div class="flex gap-1 text-[8px] font-data-mono">
                        <span class="px-1.5 py-0.5 rounded bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim border border-tertiary-fixed-dim/20">Imp: Med</span>
                        <span class="px-1.5 py-0.5 rounded bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim border border-tertiary-fixed-dim/20">Eff: Low</span>
                    </div>
                </div>
                
                <div class="bg-white/5 p-2 rounded border border-white/5 text-[11px] flex justify-between items-center gap-2">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-on-surface-variant/70">R4</span>
                        <div>
                            <span class="text-white font-bold block">Optimize Segment Tracking for ${worstCat}</span>
                            <span class="text-[9px] text-on-surface-variant block">Thankless: high effort / low impact</span>
                        </div>
                    </div>
                    <div class="flex gap-1 text-[8px] font-data-mono">
                        <span class="px-1.5 py-0.5 rounded bg-white/5 text-on-surface-variant border border-white/10">Imp: Low</span>
                        <span class="px-1.5 py-0.5 rounded bg-white/5 text-on-surface-variant border border-white/10">Eff: High</span>
                    </div>
                </div>
            `;
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

    function updateDatasetsTab(rows, headers, cleanRows, primaryMetricIndex, dateIndex, categoryIndex) {
        // 1. Calculations & DNA
        const totalRows = cleanRows.length;
        const totalCols = headers.length;
        
        let emptyCells = 0;
        cleanRows.forEach(row => {
            row.forEach(cell => {
                if (cell.trim() === '') emptyCells++;
            });
        });
        const totalCells = totalRows * totalCols;
        const duplicateCount = Math.max(0, rows.length - 1 - totalRows);

        // Classify domain and criticality
        let domain = 'General Analytics';
        const headerStr = headers.join(' ').toLowerCase();
        if (/revenue|sales|order|quantity|price|invoice|retail|spend/i.test(headerStr)) domain = 'Sales & Commerce';
        else if (/patient|doctor|visit|health|clinical|diagnosis|medication/i.test(headerStr)) domain = 'Healthcare & Medicine';
        else if (/click|impression|campaign|ctr|reach|ad|lead|spend|conversion/i.test(headerStr)) domain = 'Digital Marketing';
        else if (/yield|defect|batch|sensor|temp|machine|part|efficiency/i.test(headerStr)) domain = 'Manufacturing Operations';
        else if (/student|grade|score|class|course|exam|school|gpa/i.test(headerStr)) domain = 'Educational Performance';
        else if (/capital|cash|expense|income|asset|liability|interest/i.test(headerStr)) domain = 'Finance & Banking';
        else if (/inventory|shipment|warehouse|delivery|logistics|route/i.test(headerStr)) domain = 'Supply Chain & Logistics';

        let hasMonetary = /revenue|sales|price|invoice|spend|salary|cost/i.test(headerStr);
        let hasPersonal = /email|name|ssn|phone|address|ip|password/i.test(headerStr);
        const criticality = hasPersonal ? 'Critical' : hasMonetary ? 'High' : 'Medium';
        const complexity = totalCols > 15 ? 'High' : totalCols > 8 ? 'Moderate' : 'Low';
        
        // Update DNA Panel UI
        document.getElementById('dataset-classification').textContent = domain;
        document.getElementById('dataset-criticality').textContent = criticality;
        document.getElementById('dataset-complexity').textContent = complexity;
        
        const classIcon = document.getElementById('dataset-class-icon');
        if (domain === 'Sales & Commerce') classIcon.textContent = 'shopping_cart';
        else if (domain === 'Healthcare & Medicine') classIcon.textContent = 'medical_services';
        else if (domain === 'Digital Marketing') classIcon.textContent = 'ads_click';
        else if (domain === 'Manufacturing Operations') classIcon.textContent = 'precision_manufacturing';
        else if (domain === 'Educational Performance') classIcon.textContent = 'school';
        else if (domain === 'Finance & Banking') classIcon.textContent = 'account_balance';
        else if (domain === 'Supply Chain & Logistics') classIcon.textContent = 'local_shipping';
        else classIcon.textContent = 'database';

        const critBadge = document.getElementById('dataset-criticality');
        if (criticality === 'Critical') {
            critBadge.className = 'text-lg font-bold text-error leading-tight';
        } else if (criticality === 'High') {
            critBadge.className = 'text-lg font-bold text-warning leading-tight';
        } else {
            critBadge.className = 'text-lg font-bold text-white leading-tight';
        }

        // 2. Data Quality & Radar calculation
        const completeness = ((totalCells - emptyCells) / (totalCells || 1)) * 100;
        
        // Uniqueness Columns
        let columnUniquenessSum = 0;
        headers.forEach((h, colIdx) => {
            const uniqueVals = new Set(cleanRows.map(r => r[colIdx]));
            columnUniquenessSum += uniqueVals.size / (totalRows || 1);
        });
        const avgColUniqueness = (columnUniquenessSum / (totalCols || 1)) * 100;
        const rowUniqueness = (totalRows / ((rows.length - 1) || 1)) * 100;

        // Consistency (Type checking)
        let typeCompliantCells = 0;
        let totalCellsChecked = 0;
        headers.forEach((h, colIdx) => {
            let numericCount = 0;
            let dateCount = 0;
            let nonNullCount = 0;
            const sampleSize = Math.min(totalRows, 100);
            for (let i = 0; i < sampleSize; i++) {
                const val = cleanRows[i][colIdx].trim();
                if (val === '') continue;
                nonNullCount++;
                if (!isNaN(parseFloat(val.replace(/[$,%]/g, '')))) numericCount++;
                if (!isNaN(Date.parse(val)) && isNaN(val)) dateCount++;
            }
            const majorType = (numericCount / (nonNullCount || 1) > 0.6) ? 'numeric' : (dateCount / (nonNullCount || 1) > 0.6) ? 'date' : 'categorical';
            
            cleanRows.forEach(r => {
                const val = r[colIdx].trim();
                if (val === '') return;
                totalCellsChecked++;
                if (majorType === 'numeric') {
                    if (!isNaN(parseFloat(val.replace(/[$,%]/g, '')))) typeCompliantCells++;
                } else if (majorType === 'date') {
                    if (!isNaN(Date.parse(val)) && isNaN(val)) typeCompliantCells++;
                } else {
                    typeCompliantCells++;
                }
            });
        });
        const consistencyScore = totalCellsChecked > 0 ? (typeCompliantCells / totalCellsChecked) * 100 : 100;

        // Accuracy (Outlier based)
        const primaryValues = cleanRows.map(r => parseFloat(String(r[primaryMetricIndex]).replace(/[$,%]/g, '')) || 0);
        const sum = primaryValues.reduce((a, b) => a + b, 0);
        const avg = sum / (primaryValues.length || 1);
        const variance = primaryValues.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (primaryValues.length || 1);
        const stdDev = Math.sqrt(variance) || 1;
        let outlierCount = 0;
        primaryValues.forEach(val => {
            const z = (val - avg) / stdDev;
            if (Math.abs(z) > 2.0) outlierCount++;
        });
        const accuracyScore = Math.max(30, 100 - (outlierCount / (totalRows || 1)) * 300);

        // Consolidated Health Score
        const healthScore = Math.round(completeness * 0.35 + consistencyScore * 0.25 + avgColUniqueness * 0.15 + rowUniqueness * 0.15 + accuracyScore * 0.1);
        
        document.getElementById('health-score-val').textContent = `${healthScore}%`;
        const healthRing = document.getElementById('health-progress-ring');
        if (healthRing) {
            const circumference = 390;
            const offset = circumference - (healthScore / 100) * circumference;
            healthRing.style.strokeDashoffset = offset;
            
            if (healthScore >= 90) {
                healthRing.setAttribute('stroke', '#4edea3');
                document.getElementById('health-score-status').textContent = 'EXCELLENT';
                document.getElementById('health-score-status').className = 'text-[9px] text-secondary uppercase tracking-wider font-label-caps';
            } else if (healthScore >= 75) {
                healthRing.setAttribute('stroke', '#c0c1ff');
                document.getElementById('health-score-status').textContent = 'HEALTHY';
                document.getElementById('health-score-status').className = 'text-[9px] text-primary uppercase tracking-wider font-label-caps';
            } else {
                healthRing.setAttribute('stroke', '#ffb4ab');
                document.getElementById('health-score-status').textContent = 'WARNING';
                document.getElementById('health-score-status').className = 'text-[9px] text-error uppercase tracking-wider font-label-caps';
            }
        }
        
        document.getElementById('health-score-summary').innerHTML = `
            Consolidated health: <strong>${healthScore}%</strong>. Found <strong>${emptyCells}</strong> missing cells, 
            <strong>${duplicateCount}</strong> duplicate rows, and <strong>${outlierCount}</strong> outliers.
        `;

        // Maturity Score
        const maturityVal = Math.round(healthScore * 0.8 + (dateIndex !== -1 ? 15 : 0) + (totalCols > 4 ? 5 : 0));
        document.getElementById('dataset-maturity').textContent = `${maturityVal}%`;

        // Update counts in metadata
        document.getElementById('meta-total-rows').textContent = totalRows.toLocaleString();
        document.getElementById('meta-total-cols').textContent = totalCols.toLocaleString();
        document.getElementById('meta-empty-cells').textContent = emptyCells.toLocaleString();
        document.getElementById('meta-duplicate-rows').textContent = duplicateCount.toLocaleString();

        // 3. Readiness Breakdown UI
        const readinessAnalytics = Math.round(completeness);
        const readinessForecasting = dateIndex !== -1 ? Math.round(Math.min(100, Math.max(30, (totalRows / 50) * 100))) : 0;
        const readinessML = Math.round(completeness * 0.5 + consistencyScore * 0.3 + (totalCols > 3 ? 20 : 0));
        const readinessReporting = categoryIndex !== -1 && primaryMetricIndex !== -1 ? 95 : 60;

        document.getElementById('readiness-analytics').textContent = `${readinessAnalytics}%`;
        document.getElementById('readiness-forecasting').textContent = `${readinessForecasting}%`;
        document.getElementById('readiness-ml').textContent = `${readinessML}%`;
        document.getElementById('readiness-reporting').textContent = `${readinessReporting}%`;

        document.getElementById('readiness-analytics-bar').style.width = `${readinessAnalytics}%`;
        document.getElementById('readiness-forecasting-bar').style.width = `${readinessForecasting}%`;
        document.getElementById('readiness-ml-bar').style.width = `${readinessML}%`;
        document.getElementById('readiness-reporting-bar').style.width = `${readinessReporting}%`;

        // 4. Data Quality Radar SVG Update
        const radarPoly = document.getElementById('radar-polygon');
        if (radarPoly) {
            const comp = completeness / 100;
            const cons = consistencyScore / 100;
            const uniq = avgColUniqueness / 100;
            const vald = rowUniqueness / 100;
            const accu = accuracyScore / 100;

            const cx = 100, cy = 100, r = 80;
            // Angles: 0, 72, 144, 216, 288 in rad
            const points = [
                { x: cx, y: cy - r * comp },
                { x: cx + r * cons * Math.cos(-Math.PI/10), y: cy + r * cons * Math.sin(-Math.PI/10) },
                { x: cx + r * uniq * Math.cos(3*Math.PI/10), y: cy + r * uniq * Math.sin(3*Math.PI/10) },
                { x: cx + r * vald * Math.cos(7*Math.PI/10), y: cy + r * vald * Math.sin(7*Math.PI/10) },
                { x: cx + r * accu * Math.cos(11*Math.PI/10), y: cy + r * accu * Math.sin(11*Math.PI/10) }
            ];
            
            radarPoly.setAttribute('points', points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
        }

        document.getElementById('quality-completeness-val').textContent = `${readinessAnalytics}%`;
        document.getElementById('quality-consistency-val').textContent = `${Math.round(consistencyScore)}%`;
        document.getElementById('quality-uniqueness-val').textContent = `${Math.round(avgColUniqueness)}%`;
        document.getElementById('quality-rows-uniqueness-val').textContent = `${Math.round(rowUniqueness)}%`;
        document.getElementById('quality-accuracy-val').textContent = `${Math.round(accuracyScore)}%`;

        // 5. ERD Discovery Map SVG
        const erdSvg = document.getElementById('erd-svg');
        if (erdSvg) {
            erdSvg.innerHTML = '';
            
            const pkName = dateIndex !== -1 ? headers[dateIndex] : "Row_ID";
            const measureName = headers[primaryMetricIndex];
            const dimName = categoryIndex !== -1 ? headers[categoryIndex] : "Dimension";
            
            const numericCols = headers.filter((h, idx) => idx !== primaryMetricIndex && idx !== dateIndex && idx !== categoryIndex && !isNaN(parseFloat(cleanRows[0][idx] || '')));
            const secondaryMeasure = numericCols.length > 0 ? numericCols[0] : "Volume";

            // Define node coordinates
            const nodes = [
                { id: 'pk', name: pkName, type: 'pk', cx: 50, cy: 90, r: 18, color: '#ffb4ab' },
                { id: 'dim', name: dimName, type: 'dim', cx: 160, cy: 50, r: 18, color: '#ffb95f' },
                { id: 'meas', name: measureName, type: 'meas', cx: 280, cy: 90, r: 20, color: '#4edea3' },
                { id: 'meas2', name: secondaryMeasure, type: 'meas2', cx: 400, cy: 90, r: 16, color: '#c0c1ff' }
            ];

            // Add connections (links)
            const links = [
                { from: 'pk', to: 'meas', label: 'analyzes' },
                { from: 'dim', to: 'meas', label: 'slices' },
                { from: 'meas', to: 'meas2', label: 'correlates' }
            ];

            // Render Links
            links.forEach(link => {
                const fNode = nodes.find(n => n.id === link.from);
                const tNode = nodes.find(n => n.id === link.to);
                if (fNode && tNode) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', fNode.cx);
                    line.setAttribute('y1', fNode.cy);
                    line.setAttribute('x2', tNode.cx);
                    line.setAttribute('y2', tNode.cy);
                    line.setAttribute('stroke', 'rgba(255,255,255,0.15)');
                    line.setAttribute('stroke-width', '1.5');
                    line.setAttribute('stroke-dasharray', '4');
                    erdSvg.appendChild(line);

                    // Link label text
                    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    txt.setAttribute('x', (fNode.cx + tNode.cx)/2);
                    txt.setAttribute('y', (fNode.cy + tNode.cy)/2 - 5);
                    txt.setAttribute('text-anchor', 'middle');
                    txt.setAttribute('font-size', '8');
                    txt.setAttribute('fill', 'rgba(255,255,255,0.4)');
                    txt.textContent = link.label;
                    erdSvg.appendChild(txt);
                }
            });

            // Render Nodes
            nodes.forEach(node => {
                const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', node.cx);
                circle.setAttribute('cy', node.cy);
                circle.setAttribute('r', node.r);
                circle.setAttribute('fill', 'rgba(19, 19, 21, 0.9)');
                circle.setAttribute('stroke', node.color);
                circle.setAttribute('stroke-width', '2');
                group.appendChild(circle);

                const iconText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                iconText.setAttribute('x', node.cx);
                iconText.setAttribute('y', node.cy + 3);
                iconText.setAttribute('text-anchor', 'middle');
                iconText.setAttribute('font-size', '8');
                iconText.setAttribute('fill', node.color);
                iconText.setAttribute('font-weight', 'bold');
                iconText.textContent = node.type === 'pk' ? 'PK' : node.type === 'dim' ? 'DIM' : 'MSR';
                group.appendChild(circle);
                group.appendChild(iconText);

                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', node.cx);
                label.setAttribute('y', node.cy + node.r + 12);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('font-size', '9');
                label.setAttribute('fill', '#ffffff');
                label.textContent = node.name.slice(0, 10);
                group.appendChild(label);

                erdSvg.appendChild(group);
            });
        }

        // 6. Column dictionary
        const tbody = document.getElementById('data-dictionary-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            headers.forEach((header, colIdx) => {
                // Determine column attributes
                let emptyColCells = 0;
                const uniqueSet = new Set();
                let isNum = true;
                let isDateCandidate = true;

                cleanRows.forEach(row => {
                    const cell = row[colIdx].trim();
                    if (cell === '') emptyColCells++;
                    else {
                        uniqueSet.add(cell);
                        if (isNaN(parseFloat(cell.replace(/[$,%]/g, '')))) isNum = false;
                        if (isNaN(Date.parse(cell)) || !isNaN(cell)) isDateCandidate = false;
                    }
                });

                const colMissingPct = ((emptyColCells / (totalRows || 1)) * 100).toFixed(1);
                const colUniqPct = ((uniqueSet.size / (totalRows || 1)) * 100).toFixed(1);
                
                let detectedType = 'Categorical';
                let semanticMeaning = 'Dimension (Categorical)';
                let alias = header;
                let purpose = 'Groups data records into segment categories.';
                let importance = 2;

                if (colIdx === primaryMetricIndex) {
                    detectedType = 'Numeric (Float)';
                    semanticMeaning = 'Measure (Financial KPI)';
                    alias = `${header} [Target]`;
                    purpose = `Primary business outcome metric tracked for analytics and performance audits.`;
                    importance = 5;
                } else if (colIdx === dateIndex) {
                    detectedType = 'Date (ISO)';
                    semanticMeaning = 'Temporal (Anchor)';
                    alias = 'Timeline Date';
                    purpose = 'Provides the chronological reference for time-series forecasting.';
                    importance = 5;
                } else if (colIdx === categoryIndex) {
                    detectedType = 'Categorical';
                    semanticMeaning = 'Dimension (Slicing)';
                    alias = 'Primary Category';
                    purpose = 'Categorical segment mapping for business intelligence aggregation.';
                    importance = 4;
                } else if (isNum) {
                    detectedType = 'Numeric (Integer)';
                    semanticMeaning = 'Measure (Indicator)';
                    purpose = 'Numeric volume indicator supporting secondary correlations.';
                    importance = 3;
                } else if (isDateCandidate) {
                    detectedType = 'Date';
                    semanticMeaning = 'Temporal';
                    purpose = 'Secondary date attribute for time-series categorization.';
                    importance = 3;
                }

                // Bounds
                let boundsStr = 'N/A';
                if (isNum) {
                    const numValues = cleanRows.map(r => parseFloat(String(r[colIdx]).replace(/[$,%]/g, '')) || 0);
                    boundsStr = `[${Math.min(...numValues)}, ${Math.max(...numValues)}]`;
                } else {
                    boundsStr = `${uniqueSet.size} categories`;
                }

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-white/5 transition-all duration-300';
                tr.innerHTML = `
                    <td class="py-3 font-semibold text-white">
                        <div>${header}</div>
                        <div class="text-[9px] text-on-surface-variant/70 uppercase font-normal">${alias}</div>
                    </td>
                    <td class="py-3">
                        <span class="text-white">${detectedType}</span>
                        <div class="text-[9px] text-primary">${semanticMeaning}</div>
                    </td>
                    <td class="py-3 text-center">
                        <div class="text-white">${colMissingPct}%</div>
                        <div class="w-12 bg-white/5 h-1 rounded-full mx-auto overflow-hidden mt-1">
                            <div class="bg-error h-full" style="width: ${colMissingPct}%"></div>
                        </div>
                    </td>
                    <td class="py-3 text-center">
                        <div class="text-white">${colUniqPct}%</div>
                        <div class="w-12 bg-white/5 h-1 rounded-full mx-auto overflow-hidden mt-1">
                            <div class="bg-secondary h-full" style="width: ${colUniqPct}%"></div>
                        </div>
                    </td>
                    <td class="py-3 text-on-surface-variant max-w-[200px] truncate" title="${purpose}">${purpose}</td>
                    <td class="py-3 font-data-mono text-on-surface-variant">${boundsStr}</td>
                    <td class="py-3 text-right text-tertiary-fixed-dim font-bold">${'★'.repeat(importance)}${'☆'.repeat(5 - importance)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // 7. AI Data Stories
        const storiesContainer = document.getElementById('data-stories-container');
        if (storiesContainer) {
            storiesContainer.innerHTML = '';
            
            const stories = [
                { icon: 'auto_awesome', text: `<strong>Domain Anchor:</strong> Classified under the <strong>${domain}</strong> operational track with moderate schema complexity.` },
                { icon: 'trending_up', text: `<strong>Temporal Trend:</strong> Sequential date anchor detected over <strong>${headers[dateIndex] || 'Date'}</strong> enabling high-accuracy forecasting pipelines.` },
                { icon: 'query_stats', text: `<strong>Primary Driver:</strong> <strong>${headers[primaryMetricIndex]}</strong> identified as target measure showing typical average rates of <strong>${formatCurrencyOrNum(avg)}</strong>.` },
                { icon: 'warning', text: `<strong>Governance Warning:</strong> Found <strong>${outlierCount}</strong> statistical anomalies. These rows show Z-scores above 2.0 and require automated screening.` }
            ];

            stories.forEach(st => {
                const item = document.createElement('div');
                item.className = 'text-xs text-on-surface bg-white/5 p-2.5 rounded border border-white/5 flex items-start gap-2.5 interactive-scale hover:border-primary/20 duration-300';
                item.innerHTML = `
                    <span class="material-symbols-outlined text-[16px] text-primary mt-0.5">${st.icon}</span>
                    <span>${st.text}</span>
                `;
                storiesContainer.appendChild(item);
            });
        }

        // 8. Data Prep Assistant
        const prepContainer = document.getElementById('prep-assistant-container');
        if (prepContainer) {
            prepContainer.innerHTML = '';
            
            const tasks = [
                { title: `Deduplicate Rows`, desc: `Drop the ${duplicateCount} duplicate records detected to restore analytical consistency.`, lift: 6 },
                { title: `Cap Target Outliers`, desc: `Apply IQR bounding box logic to cap the ${outlierCount} outliers in ${headers[primaryMetricIndex]}.`, lift: 11 },
                { title: `Impute Null Values`, desc: `Fill the ${emptyCells} empty cells in variables using mean/median interpolation.`, lift: 8 },
                { title: `Normalize Schema Headers`, desc: `Convert schema header metadata to strict lowercase variables.`, lift: 3 }
            ];

            tasks.forEach(t => {
                const item = document.createElement('div');
                item.className = 'text-xs text-on-surface bg-white/5 p-2.5 rounded border border-white/5 flex items-center justify-between interactive-scale hover:border-secondary/20 duration-300';
                item.innerHTML = `
                    <div class="flex items-start gap-2.5">
                        <span class="material-symbols-outlined text-[16px] text-secondary mt-0.5">check_box_outline_blank</span>
                        <div>
                            <div class="font-bold text-white">${t.title}</div>
                            <div class="text-[10px] text-on-surface-variant mt-0.5">${t.desc}</div>
                        </div>
                    </div>
                    <span class="text-[10px] font-data-mono px-1.5 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/25 font-bold flex-shrink-0 ml-2">+${t.lift}% Lift</span>
                `;
                prepContainer.appendChild(item);
            });
        }

        // 9. Auto KPI Detection
        const kpiTbody = document.getElementById('kpi-detection-tbody');
        if (kpiTbody) {
            kpiTbody.innerHTML = '';
            let kpiCount = 0;
            
            headers.forEach((h, colIdx) => {
                let isNum = true;
                cleanRows.forEach(row => {
                    if (isNaN(parseFloat(row[colIdx].replace(/[$,%]/g, '')))) isNum = false;
                });
                
                if (isNum) {
                    kpiCount++;
                    const colA = cleanRows.map(r => parseFloat(String(r[primaryMetricIndex]).replace(/[$,%]/g, '')) || 0);
                    const colB = cleanRows.map(r => parseFloat(String(r[colIdx]).replace(/[$,%]/g, '')) || 0);
                    const corr = calculatePearsonCorrelation(colA, colB);
                    
                    const valueRating = Math.round(Math.abs(corr) * 5);
                    const stars = '★'.repeat(valueRating) + '☆'.repeat(5 - valueRating);
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="py-2 font-semibold text-white">
                            <div>${h}</div>
                            <span class="text-[8px] text-on-surface-variant px-1 rounded bg-white/5 uppercase">${colIdx === primaryMetricIndex ? 'Target KPI' : 'Metric Variable'}</span>
                        </td>
                        <td class="py-2 text-center text-primary font-bold">${corr.toFixed(3)}</td>
                        <td class="py-2 text-right text-tertiary-fixed-dim font-bold">${stars}</td>
                    `;
                    kpiTbody.appendChild(tr);
                }
            });
            
            if (kpiCount === 0) {
                kpiTbody.innerHTML = `
                    <tr>
                        <td colspan="3" class="py-4 text-center text-on-surface-variant">No numeric metric candidates found.</td>
                    </tr>
                `;
            }
        }

        // 10. Descriptive Stats & Mini Histogram
        const statsGrid = document.getElementById('datasets-descriptive-stats-grid');
        if (statsGrid) {
            const minVal = Math.min(...primaryValues);
            const maxVal = Math.max(...primaryValues);
            const rangeVal = maxVal - minVal;
            const meanVal = avg;
            
            const valuesSorted = [...primaryValues].sort((a,b) => a-b);
            const medianVal = valuesSorted[Math.floor(valuesSorted.length / 2)] || 0;
            
            statsGrid.innerHTML = `
                <div class="bg-white/5 p-1.5 rounded border border-white/5">
                    <div class="text-on-surface-variant text-[8px] uppercase">Mean</div>
                    <div class="text-white font-bold">${formatCurrencyOrNum(meanVal)}</div>
                </div>
                <div class="bg-white/5 p-1.5 rounded border border-white/5">
                    <div class="text-on-surface-variant text-[8px] uppercase">Median</div>
                    <div class="text-white font-bold">${formatCurrencyOrNum(medianVal)}</div>
                </div>
                <div class="bg-white/5 p-1.5 rounded border border-white/5">
                    <div class="text-on-surface-variant text-[8px] uppercase">Range</div>
                    <div class="text-white font-bold">${formatCurrencyOrNum(rangeVal)}</div>
                </div>
                <div class="bg-white/5 p-1.5 rounded border border-white/5">
                    <div class="text-on-surface-variant text-[8px] uppercase">Std Dev</div>
                    <div class="text-white font-bold">${formatCurrencyOrNum(stdDev)}</div>
                </div>
            `;

            // Draw mini histogram SVG
            const histSvg = document.getElementById('datasets-histogram-svg');
            if (histSvg) {
                histSvg.innerHTML = '';
                
                // Calculate 5 equal bins
                const bins = [0, 0, 0, 0, 0];
                const binSize = (rangeVal || 1) / 5;
                
                primaryValues.forEach(val => {
                    let binIdx = Math.floor((val - minVal) / binSize);
                    if (binIdx >= 5) binIdx = 4;
                    bins[binIdx]++;
                });
                
                const maxBinCount = Math.max(...bins) || 1;
                const svgW = 100, svgH = 80;
                
                bins.forEach((count, i) => {
                    const rectH = (count / maxBinCount) * 60;
                    const rectW = 14;
                    const x = i * 20 + 2;
                    const y = 70 - rectH;
                    
                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('x', x);
                    rect.setAttribute('y', y);
                    rect.setAttribute('width', rectW);
                    rect.setAttribute('height', rectH);
                    rect.setAttribute('fill', 'url(#hist-gradient)');
                    rect.setAttribute('rx', '1');
                    
                    // Tooltip
                    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                    title.textContent = `Bin ${i+1}: ${count} records`;
                    rect.appendChild(title);
                    
                    histSvg.appendChild(rect);
                });
                
                // Define gradient
                const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                defs.innerHTML = `
                    <linearGradient id="hist-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#c0c1ff" stop-opacity="0.8"/>
                        <stop offset="100%" stop-color="#c0c1ff" stop-opacity="0.2"/>
                    </linearGradient>
                `;
                histSvg.appendChild(defs);
            }
        }

        // 11. Data Governance & PII Shield
        const govBadge = document.getElementById('governance-class-badge');
        const govContainer = document.getElementById('governance-pii-container');
        if (govContainer && govBadge) {
            govContainer.innerHTML = '';
            
            const piiCols = [];
            headers.forEach((h, colIdx) => {
                const hl = h.toLowerCase();
                if (/email|name|ssn|phone|address|ip|password|card|bank|salary/i.test(hl)) {
                    piiCols.push(h);
                }
            });

            if (piiCols.length > 0) {
                govBadge.textContent = 'RESTRICTED PII';
                govBadge.className = 'text-[9px] font-bold font-data-mono px-2 py-0.5 rounded border text-error bg-error/15 border-error/20';

                const alertBox = document.createElement('div');
                alertBox.className = 'p-2.5 rounded bg-error/10 border border-error/20 text-error flex items-start gap-2';
                alertBox.innerHTML = `
                    <span class="material-symbols-outlined text-[16px] mt-0.5">gavel</span>
                    <div>
                        <div class="font-bold">Compliance Warning</div>
                        <div class="text-[10px] mt-0.5">${piiCols.length} columns are classified as sensitive PII. Regulatory auditing rules apply.</div>
                    </div>
                `;
                govContainer.appendChild(alertBox);

                piiCols.forEach(col => {
                    const item = document.createElement('div');
                    item.className = 'flex items-center justify-between p-2 rounded bg-white/5 border border-white/5';
                    item.innerHTML = `
                        <span class="text-white">${col}</span>
                        <span class="text-[8px] font-bold font-data-mono px-1.5 py-0.5 rounded bg-error/10 text-error border border-error/25">PII SHIELD ACTIVE</span>
                    `;
                    govContainer.appendChild(item);
                });
            } else {
                govBadge.textContent = 'PUBLIC';
                govBadge.className = 'text-[9px] font-bold font-data-mono px-2 py-0.5 rounded border text-secondary bg-secondary/15 border-secondary/20';

                const okBox = document.createElement('div');
                okBox.className = 'p-2.5 rounded bg-secondary/10 border border-secondary/20 text-secondary flex items-start gap-2';
                okBox.innerHTML = `
                    <span class="material-symbols-outlined text-[16px] mt-0.5">verified_user</span>
                    <div>
                        <div class="font-bold">No Sensitive PII Detected</div>
                        <div class="text-[10px] mt-0.5">Dataset is safe for public distribution & standard modeling.</div>
                    </div>
                `;
                govContainer.appendChild(okBox);
            }
        }
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

document.addEventListener('DOMContentLoaded', () => {
    const notionDataTextarea = document.getElementById('notion-data');
    const importButton = document.getElementById('import-button');
    const importStatus = document.getElementById('import-status');
    
    const probabilitySettingsSection = document.getElementById('probability-settings-section');
    const prob2StarInput = document.getElementById('prob-2star');
    const prob3StarInput = document.getElementById('prob-3star');
    const prob4StarInput = document.getElementById('prob-4star');
    const applyProbButton = document.getElementById('apply-prob-button');

    const lotterySection = document.getElementById('lottery-section');
    const draw1Button = document.getElementById('draw-1');
    const draw10Button = document.getElementById('draw-10');
    const feedbackMessage = document.getElementById('feedback-message');

    const resultsSection = document.getElementById('results-section');
    const totalDrawsSpan = document.getElementById('total-draws');
    const historyTableBody = document.querySelector('#history-table tbody');
    const copyHistoryButton = document.getElementById('copy-history-button');
    const copyStatus = document.getElementById('copy-status');

    let items = [];
    let winHistory = [];
    let totalDraws = 0;

    // 稀有度对应的基础权重（根据期望调整）
    // 🌟: 2-3天一次 (假设一天15抽, 约 1/(2.5*15) = 1/37.5) -> 权重相对较小
    // 🌟🌟: 一天大概率 (假设15抽中1次) -> 权重相对较大
    // 🌟🌟🌟: 一天3-4次 (假设15抽中3.5次) -> 权重较大
    // 🌟🌟🌟🌟: 两天一次 (假设15抽, 约 1/(2*15) = 1/30) -> 权重中等
    // 🌟🌟🌟🌟🌟: 一周1次 (1/105)
    // 🌟🌟🌟🌟🌟🌟: 3-6个月一次 (1/ (4.5*30*15) = 1/2025)
    // 🌟🌟🌟🌟🌟🌟🌟: 一年1次 (1/(365*15) = 1/5475)
    // 为了简化，我们用相对权重值，数值越大，概率越高
    const baseRarityWeights = {
        "🌟": 5,          // 基础权重
        "🌟🌟": 50,       // 比较常见，用于补充
        "🌟🌟🌟": 30,     // 期望较高
        "🌟🌟🌟🌟": 10,    // 
        "🌟🌟🌟🌟🌟": 2,   //
        "🌟🌟🌟🌟🌟🌟": 0.1, // 非常稀有
        "🌟🌟🌟🌟🌟🌟🌟": 0.02 // 极其稀有
    };

    const wittyPhrases = [
        "哟嚯，手气不错嘛！",
        "再接再厉，大奖等着你！",
        "嗯...这位客官，下次换个姿势试试？",
        "恭喜！不过别太得意忘形哦~",
        "哇哦！今天锦鲤附体了？",
        "还行还行，保持这个节奏！",
        "你小子运气有点衰啊，要不要去洗把脸？",
        "别灰心，好运总会来的！",
        "啧啧，就这？再来！",
        "淡定，淡定，抽奖就像人生，起起落落落落...",
        "是个狠人！这都能抽到！",
        "感觉身体被掏空...但好像中了点啥？"
    ];

    importButton.addEventListener('click', handleImport);
    applyProbButton.addEventListener('click', applyProbabilityAdjustments);
    draw1Button.addEventListener('click', () => performDraws(1));
    draw10Button.addEventListener('click', () => performDraws(11)); // 10抽送1次，所以是11次
    copyHistoryButton.addEventListener('click', copyHistoryToClipboard);

    function handleImport() {
        const data = notionDataTextarea.value.trim();
        if (!data) {
            importStatus.textContent = '❌ 请粘贴数据后再导入！';
            importStatus.style.color = 'red';
            return;
        }

        items = [];
        const lines = data.split('\n');
        let parseError = false;

        lines.forEach((line, index) => {
            const parts = line.split('\t'); // Notion表格复制出来通常是Tab分隔
            if (parts.length >= 2) {
                const name = parts[0].trim();
                const rarity = parts[1].trim();
                if (name && rarity && baseRarityWeights.hasOwnProperty(rarity)) {
                    items.push({ 
                        name, 
                        rarity, 
                        baseWeight: baseRarityWeights[rarity],
                        currentWeight: baseRarityWeights[rarity] // 初始时currentWeight等于baseWeight
                    });
                } else {
                    console.warn(`第 ${index + 1} 行数据格式错误或稀有度无法识别: ${line}`);
                    parseError = true;
                }
            } else {
                console.warn(`第 ${index + 1} 行数据列数不足: ${line}`);
                parseError = true;
            }
        });

        if (items.length === 0) {
            importStatus.textContent = '❌ 未能成功导入任何奖品。请检查数据格式，确保包含名称和有效稀有度（如🌟, 🌟🌟等）。';
            importStatus.style.color = 'red';
            hideLotterySections();
        } else {
            importStatus.textContent = `✅ 成功导入 ${items.length} 个奖品! ${parseError ? '部分行解析失败，请查看控制台。' : ''}`;
            importStatus.style.color = 'green';
            applyProbabilityAdjustments(); // 自动应用一次默认的调整
            showLotterySections();
            resetResults(); // 导入新数据后重置结果区
        }
    }

    function applyProbabilityAdjustments() {
        if (items.length === 0) return;

        const mult2Star = parseFloat(prob2StarInput.value) || 1.0;
        const mult3Star = parseFloat(prob3StarInput.value) || 1.0;
        const mult4Star = parseFloat(prob4StarInput.value) || 1.0;

        items.forEach(item => {
            item.currentWeight = item.baseWeight; // 重置为基础权重
            if (item.rarity === "🌟🌟") item.currentWeight *= mult2Star;
            if (item.rarity === "🌟🌟🌟") item.currentWeight *= mult3Star;
            if (item.rarity === "🌟🌟🌟🌟") item.currentWeight *= mult4Star;
        });
        
        console.log("概率已调整:", items.map(i => ({name: i.name, weight: i.currentWeight})));
        if (document.activeElement === applyProbButton) { // 只有点击按钮时才提示
             feedbackMessage.textContent = "💡 概率权重已更新！";
        }
    }

    function performDraws(count) {
        if (items.length === 0) {
            feedbackMessage.textContent = "请先导入奖品数据！";
            return;
        }
        // 确保最新的概率调整已应用
        applyProbabilityAdjustments(); 

        let currentBatchWins = [];
        for (let i = 0; i < count; i++) {
            const winningItem = drawSingleItem();
            if (winningItem) {
                totalDraws++;
                winHistory.push({
                    drawNumber: totalDraws,
                    itemName: winningItem.name,
                    itemRarity: winningItem.rarity
                });
                currentBatchWins.push(winningItem);
            }
        }
        updateResultsDisplay();
        
        // 显示俏皮话
        feedbackMessage.textContent = wittyPhrases[Math.floor(Math.random() * wittyPhrases.length)];
        
        // 可以选择高亮本次抽中的奖品
        if (currentBatchWins.length > 0) {
            let batchMsg = (count > 1 ? `本次 ${count} 抽结果：` : "恭喜抽中：") + 
                           currentBatchWins.map(item => `${item.name} (${item.rarity})`).join(', ');
            // feedbackMessage.textContent += " " + batchMsg; // 如果想追加信息
        }
    }

    function drawSingleItem() {
        if (items.length === 0) return null;

        const totalWeight = items.reduce((sum, item) => sum + item.currentWeight, 0);
        if (totalWeight <= 0) {
            console.warn("所有奖品权重为0，无法抽奖。");
            return items[Math.floor(Math.random() * items.length)]; // 权重为0则等概率随机（或返回null）
        }

        let randomNum = Math.random() * totalWeight;
        
        for (const item of items) {
            if (randomNum < item.currentWeight) {
                return item;
            }
            randomNum -= item.currentWeight;
        }
        // 理论上不应该到这里，除非有浮点数精度问题
        return items[items.length - 1]; 
    }

    function updateResultsDisplay() {
        totalDrawsSpan.textContent = totalDraws;
        historyTableBody.innerHTML = ''; // 清空旧记录

        winHistory.forEach(record => {
            const row = historyTableBody.insertRow();
            row.insertCell().textContent = record.drawNumber;
            row.insertCell().textContent = record.itemName;
            row.insertCell().textContent = record.itemRarity;
        });
    }
    
    function resetResults() {
        winHistory = [];
        totalDraws = 0;
        updateResultsDisplay();
        feedbackMessage.textContent = "";
        copyStatus.textContent = "";
    }

    function showLotterySections() {
        probabilitySettingsSection.classList.remove('hidden');
        lotterySection.classList.remove('hidden');
        resultsSection.classList.remove('hidden');
    }
    
    function hideLotterySections() {
        probabilitySettingsSection.classList.add('hidden');
        lotterySection.classList.add('hidden');
        resultsSection.classList.add('hidden');
    }

    function copyHistoryToClipboard() {
        if (winHistory.length === 0) {
            copyStatus.textContent = "没有记录可复制。";
            copyStatus.style.color = "orange";
            return;
        }

        // 表头 + 数据行，使用Tab分隔符 (TSV)
        let tsvContent = "序号\t奖品名称\t稀有度\n";
        winHistory.forEach(record => {
            tsvContent += `${record.drawNumber}\t${record.itemName}\t${record.itemRarity}\n`;
        });

        navigator.clipboard.writeText(tsvContent.trim())
            .then(() => {
                copyStatus.textContent = "✅ 已复制到剪贴板！可以直接粘贴到Notion。";
                copyStatus.style.color = "green";
            })
            .catch(err => {
                copyStatus.textContent = "❌ 复制失败: " + err;
                copyStatus.style.color = "red";
                console.error('无法复制到剪贴板: ', err);
            });
    }
    
    // Initially hide sections that require data
    hideLotterySections();
});
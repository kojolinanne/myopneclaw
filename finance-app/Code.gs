// Google Apps Script - 財務報表系統
// 綁定到 Google Sheets: 主恩改革宗長老會 財務報表

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('主恩改革宗長老會 財務報表')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 用綁定的 Spreadsheet（不需要額外授權）
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// 將儲存格值統一轉為字串（避免日期/數字格式問題）
function cellToString(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Taipei', 'yyyy/MM/dd');
  }
  return String(val);
}

// 讀取設定工作表
function getSettings() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('設定');
  if (!sheet) return { elderMode: false };
  
  var val = String(sheet.getRange('A2').getValue()).trim().toLowerCase();
  var elderMode = (val === '是' || val === 'true' || val === 'yes' || val === '1');
  
  return { elderMode: elderMode };
}

// 取得可用的組織和期間
function getFilterOptions() {
  var ss = getSpreadsheet();
  var settings = getSettings();
  
  var incomeSheet = ss.getSheetByName('收支餘絀表');
  var incomeData = incomeSheet.getDataRange().getValues().slice(1);
  
  var orgSet = {};
  var periodSet = {};
  for (var i = 0; i < incomeData.length; i++) {
    var org = String(incomeData[i][0]).trim();
    var period = String(incomeData[i][1]).trim();
    if (org) orgSet[org] = true;
    if (period) periodSet[period] = true;
  }
  
  var bsSheet = ss.getSheetByName('資產負債表');
  var bsData = bsSheet.getDataRange().getValues().slice(1);
  var bsPeriodSet = {};
  for (var j = 0; j < bsData.length; j++) {
    var bp = String(bsData[j][1]).trim();
    if (bp) bsPeriodSet[bp] = true;
  }
  
  return {
    organizations: Object.keys(orgSet),
    incomePeriods: Object.keys(periodSet),
    balancePeriods: Object.keys(bsPeriodSet),
    elderMode: settings.elderMode
  };
}

// 取得收支餘絀表資料
function getIncomeStatement(org, period) {
  var ss = getSpreadsheet();
  var settings = getSettings();
  var sheet = ss.getSheetByName('收支餘絀表');
  var data = sheet.getDataRange().getValues();
  var rows = data.slice(1);
  
  var income = [];
  var expense = [];
  var totalIncome = 0;
  var totalExpense = 0;
  var netIncome = 0;
  
  // 長執會模式：暫存人事費用以便彙總
  var personnelMonth = 0;
  var personnelYear = 0;
  
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowOrg = String(row[0]).trim();
    var rowPeriod = String(row[1]).trim();
    var category = String(row[2]).trim();
    
    if (org && rowOrg !== org) continue;
    if (period && rowPeriod !== period) continue;
    
    var item = {
      org: rowOrg,
      period: rowPeriod,
      category: category,
      mainAccount: String(row[3]).trim(),
      subAccount: String(row[4]).trim(),
      monthAmount: Number(row[5]) || 0,
      yearAmount: Number(row[6]) || 0
    };
    
    if (category === '收入') {
      income.push(item);
    } else if (category === '支出') {
      // 長執會模式：人事費用只彙總，不顯示細項
      if (settings.elderMode && item.mainAccount === '人事費用') {
        personnelMonth += item.monthAmount;
        personnelYear += item.yearAmount;
      } else {
        expense.push(item);
      }
    } else if (category === '收入小計') {
      totalIncome = item.monthAmount;
    } else if (category === '支出小計') {
      totalExpense = item.monthAmount;
    } else if (category === '本期損益') {
      netIncome = item.monthAmount;
    }
  }
  
  // 長執會模式：加入人事費用彙總項目（放在支出最前面）
  if (settings.elderMode && personnelMonth > 0) {
    expense.unshift({
      org: org || '',
      period: period || '',
      category: '支出',
      mainAccount: '人事費用',
      subAccount: '人事費用',
      monthAmount: personnelMonth,
      yearAmount: personnelYear
    });
  }
  
  if (!totalIncome) {
    for (var a = 0; a < income.length; a++) totalIncome += income[a].monthAmount;
  }
  if (!totalExpense) {
    for (var b = 0; b < expense.length; b++) totalExpense += expense[b].monthAmount;
  }
  if (!netIncome) netIncome = totalIncome - totalExpense;
  
  return {
    income: income,
    expense: expense,
    totalIncome: totalIncome,
    totalExpense: totalExpense,
    netIncome: netIncome,
    elderMode: settings.elderMode,
    org: org || '全部',
    period: period || '全部'
  };
}

// 取得預算資料
function getBudgetData(org) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('預算資料');
  if (!sheet) return { items: [], detailMap: {}, actualDetailMap: {} };
  
  var data = sheet.getDataRange().getValues();
  var rows = data.slice(1); // 跳過 header
  
  var items = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowOrg = String(row[0]).trim();
    if (org && rowOrg !== org) continue;
    
    items.push({
      org: rowOrg,
      category: String(row[1]).trim(),
      mainAccount: String(row[2]).trim(),
      subAccount: String(row[3]).trim(),
      budget: Number(row[4]) || 0,
      detailTag: String(row[5]).trim()
    });
  }
  
  // 讀取預算明細
  var detailSheet = ss.getSheetByName('預算明細');
  var detailMap = {};
  if (detailSheet) {
    var detailData = detailSheet.getDataRange().getValues();
    var detailRows = detailData.slice(1);
    for (var j = 0; j < detailRows.length; j++) {
      var dr = detailRows[j];
      var detailOrg = String(dr[3]).trim();
      if (org && detailOrg !== org) continue;
      
      var parentKey = String(dr[0]).trim();
      if (!detailMap[parentKey]) detailMap[parentKey] = [];
      detailMap[parentKey].push({
        subItem: String(dr[1]).trim(),
        budget: Number(dr[2]) || 0
      });
    }
  }
  
  // 讀取收支明細（實際支出子項）
  var actualDetailSheet = ss.getSheetByName('收支明細');
  var actualDetailMap = {};
  if (actualDetailSheet) {
    var adData = actualDetailSheet.getDataRange().getValues();
    var adRows = adData.slice(1);
    for (var k = 0; k < adRows.length; k++) {
      var ar = adRows[k];
      var adOrg = String(ar[0]).trim();
      if (org && adOrg !== org) continue;
      
      var adParent = String(ar[2]).trim();
      var adPeriod = String(ar[1]).trim();
      if (!actualDetailMap[adParent]) actualDetailMap[adParent] = [];
      actualDetailMap[adParent].push({
        period: adPeriod,
        subItem: String(ar[3]).trim(),
        monthAmount: Number(ar[4]) || 0,
        yearAmount: Number(ar[5]) || 0
      });
    }
  }
  
  return { items: items, detailMap: detailMap, actualDetailMap: actualDetailMap };
}

// 取得資產負債表資料
function getBalanceSheet(org, period) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('資產負債表');
  var data = sheet.getDataRange().getValues();
  var rows = data.slice(1);
  
  var assets = [];
  var liabilities = [];
  var equity = [];
  var totalAssets = 0;
  var totalLiab = 0;
  var totalEquity = 0;
  var totalLiabEquity = 0;
  
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowOrg = String(row[0]).trim();
    var rowPeriod = String(row[1]).trim();
    var tableType = String(row[2]).trim();
    
    if (org && rowOrg !== org) continue;
    if (period && rowPeriod !== period) continue;
    
    var item = {
      org: rowOrg,
      period: rowPeriod,
      tableType: tableType,
      mainAccount: String(row[3]).trim(),
      subAccount: String(row[4]).trim(),
      amount: Number(row[5]) || 0
    };
    
    if (tableType === '資產') {
      assets.push(item);
    } else if (tableType === '負債') {
      liabilities.push(item);
    } else if (tableType === '基金及餘絀') {
      equity.push(item);
    } else if (tableType === '資產小計') {
      totalAssets = item.amount;
    } else if (tableType === '負債小計') {
      totalLiab = item.amount;
    } else if (tableType === '基金及餘絀小計') {
      totalEquity = item.amount;
    } else if (tableType === '合計') {
      totalLiabEquity = item.amount;
    }
  }
  
  if (!totalAssets) {
    for (var a = 0; a < assets.length; a++) totalAssets += assets[a].amount;
  }
  if (!totalLiab) {
    for (var b = 0; b < liabilities.length; b++) totalLiab += liabilities[b].amount;
  }
  if (!totalEquity) {
    for (var c = 0; c < equity.length; c++) totalEquity += equity[c].amount;
  }
  if (!totalLiabEquity) totalLiabEquity = totalLiab + totalEquity;
  
  return {
    assets: assets,
    liabilities: liabilities,
    equity: equity,
    totalAssets: totalAssets,
    totalLiabilities: totalLiab,
    totalEquity: totalEquity,
    totalLiabEquity: totalLiabEquity,
    org: org || '全部',
    period: period || '全部'
  };
}

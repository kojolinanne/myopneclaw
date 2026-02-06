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

// 取得可用的組織和期間
function getFilterOptions() {
  var ss = getSpreadsheet();
  
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
    balancePeriods: Object.keys(bsPeriodSet)
  };
}

// 取得收支餘絀表資料
function getIncomeStatement(org, period) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('收支餘絀表');
  var data = sheet.getDataRange().getValues();
  var rows = data.slice(1);
  
  var income = [];
  var expense = [];
  var totalIncome = 0;
  var totalExpense = 0;
  var netIncome = 0;
  
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
      expense.push(item);
    } else if (category === '收入小計') {
      totalIncome = item.monthAmount;
    } else if (category === '支出小計') {
      totalExpense = item.monthAmount;
    } else if (category === '本期損益') {
      netIncome = item.monthAmount;
    }
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
    org: org || '全部',
    period: period || '全部'
  };
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

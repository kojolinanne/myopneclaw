// Google Apps Script - 財務報表系統
// 綁定到 Google Sheets: 主恩改革宗長老會 財務報表

const SPREADSHEET_ID = '1_caJxWmBVuuNCfeIBBmMhqnfUctdK1VOv80wodCu_sg';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('主恩改革宗長老會 財務報表')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 取得可用的組織和期間
function getFilterOptions() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const incomeSheet = ss.getSheetByName('收支餘絀表');
  const incomeData = incomeSheet.getDataRange().getValues().slice(1);
  const orgs = [...new Set(incomeData.map(r => r[0]).filter(Boolean))];
  const periods = [...new Set(incomeData.map(r => r[1]).filter(Boolean))];
  
  const bsSheet = ss.getSheetByName('資產負債表');
  const bsData = bsSheet.getDataRange().getValues().slice(1);
  const bsPeriods = [...new Set(bsData.map(r => r[1]).filter(Boolean))];
  
  return {
    organizations: orgs,
    incomePeriods: periods,
    balancePeriods: bsPeriods
  };
}

// 取得收支餘絀表資料
function getIncomeStatement(org, period) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('收支餘絀表');
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  
  let filtered = rows;
  if (org) filtered = filtered.filter(r => r[0] === org);
  if (period) filtered = filtered.filter(r => r[1] === period);
  
  const income = [];
  const expense = [];
  let totalIncome = 0;
  let totalExpense = 0;
  let netIncome = 0;
  
  filtered.forEach(row => {
    const item = {
      org: row[0],
      period: row[1],
      category: row[2],
      mainAccount: row[3],
      subAccount: row[4],
      monthAmount: row[5],
      yearAmount: row[6]
    };
    
    if (item.category === '收入') {
      income.push(item);
    } else if (item.category === '支出') {
      expense.push(item);
    } else if (item.category === '收入小計') {
      totalIncome = item.monthAmount;
    } else if (item.category === '支出小計') {
      totalExpense = item.monthAmount;
    } else if (item.category === '本期損益') {
      netIncome = item.monthAmount;
    }
  });
  
  if (!totalIncome) totalIncome = income.reduce((s, i) => s + i.monthAmount, 0);
  if (!totalExpense) totalExpense = expense.reduce((s, i) => s + i.monthAmount, 0);
  if (!netIncome) netIncome = totalIncome - totalExpense;
  
  return {
    income, expense,
    totalIncome, totalExpense, netIncome,
    org: org || '全部',
    period: period || '全部'
  };
}

// 取得資產負債表資料
function getBalanceSheet(org, period) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('資產負債表');
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  
  let filtered = rows;
  if (org) filtered = filtered.filter(r => r[0] === org);
  if (period) filtered = filtered.filter(r => r[1] === period);
  
  const assets = [];
  const liabilities = [];
  const equity = [];
  let totalAssets = 0;
  let totalLiab = 0;
  let totalEquity = 0;
  let totalLiabEquity = 0;
  
  filtered.forEach(row => {
    const item = {
      org: row[0],
      period: row[1],
      tableType: row[2],
      mainAccount: row[3],
      subAccount: row[4],
      amount: row[5]
    };
    
    if (item.tableType === '資產') {
      assets.push(item);
    } else if (item.tableType === '負債') {
      liabilities.push(item);
    } else if (item.tableType === '基金及餘絀') {
      equity.push(item);
    } else if (item.tableType === '資產小計') {
      totalAssets = item.amount;
    } else if (item.tableType === '負債小計') {
      totalLiab = item.amount;
    } else if (item.tableType === '基金及餘絀小計') {
      totalEquity = item.amount;
    } else if (item.tableType === '合計') {
      totalLiabEquity = item.amount;
    }
  });
  
  if (!totalAssets) totalAssets = assets.reduce((s, i) => s + i.amount, 0);
  if (!totalLiab) totalLiab = liabilities.reduce((s, i) => s + i.amount, 0);
  if (!totalEquity) totalEquity = equity.reduce((s, i) => s + i.amount, 0);
  if (!totalLiabEquity) totalLiabEquity = totalLiab + totalEquity;
  
  return {
    assets, liabilities, equity,
    totalAssets, totalLiabilities: totalLiab,
    totalEquity, totalLiabEquity,
    org: org || '全部',
    period: period || '全部'
  };
}

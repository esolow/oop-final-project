(function() {
  "use strict";

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];

  const chartColors = [
    "#087f8c",
    "#f25f5c",
    "#247ba0",
    "#70c1b3",
    "#ffb703",
    "#5e548e",
    "#2a9d8f",
    "#e76f51",
    "#577590"
  ];

  const database = window.db.openCostsDB("costsdb", 1);
  const today = new Date();

  const costForm = document.getElementById("costForm");
  const reportForm = document.getElementById("reportForm");
  const yearForm = document.getElementById("yearForm");
  const tableBody = document.getElementById("costTableBody");
  const monthInput = document.getElementById("monthInput");
  const yearInput = document.getElementById("yearInput");
  const barYearInput = document.getElementById("barYearInput");
  const reportSummary = document.getElementById("reportSummary");
  const yearSummary = document.getElementById("yearSummary");
  const currentMonthTotal = document.getElementById("currentMonthTotal");
  const categoryChart = document.getElementById("categoryChart");
  const yearChart = document.getElementById("yearChart");

  monthInput.value = String(today.getMonth() + 1);
  yearInput.value = String(today.getFullYear());
  barYearInput.value = String(today.getFullYear());

  // Native currency formatting keeps every amount consistent with the USD requirement.
  function formatMoney(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(value);
  }

  function showToast(message, type) {
    const toast = document.createElement("div");
    toast.className = "toast" + (type === "error" ? " error" : "");
    toast.textContent = message;
    document.body.appendChild(toast);

    window.setTimeout(function() {
      toast.remove();
    }, 2400);
  }

  function getCategoryTotals(costs) {
    return costs.reduce(function(groups, cost) {
      groups[cost.category] = (groups[cost.category] || 0) + Number(cost.sum);
      return groups;
    }, {});
  }

  function renderTable(report) {
    tableBody.innerHTML = "";

    if (report.costs.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 4;
      cell.className = "empty-cell";
      cell.textContent = "No costs for this month yet.";
      row.appendChild(cell);
      tableBody.appendChild(row);
      return;
    }

    report.costs.forEach(function(cost) {
      const row = document.createElement("tr");
      const dayCell = document.createElement("td");
      const categoryCell = document.createElement("td");
      const descriptionCell = document.createElement("td");
      const amountCell = document.createElement("td");

      dayCell.textContent = cost.date.day;
      categoryCell.textContent = cost.category;
      descriptionCell.textContent = cost.description;
      amountCell.className = "amount-cell";
      amountCell.textContent = formatMoney(cost.sum);

      row.appendChild(dayCell);
      row.appendChild(categoryCell);
      row.appendChild(descriptionCell);
      row.appendChild(amountCell);
      tableBody.appendChild(row);
    });
  }

  function clearCanvas(canvas) {
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    return context;
  }

  function drawEmptyChart(canvas, message) {
    const context = clearCanvas(canvas);

    context.fillStyle = "#607080";
    context.font = "700 28px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(message, canvas.width / 2, canvas.height / 2);
  }

  function drawCategoryChart(report) {
    const totals = getCategoryTotals(report.costs);
    const entries = Object.entries(totals);

    if (entries.length === 0) {
      drawEmptyChart(categoryChart, "No category data yet");
      return;
    }

    const context = clearCanvas(categoryChart);
    const centerX = 150;
    const centerY = 150;
    const radius = 105;
    const total = entries.reduce(function(sum, entry) {
      return sum + entry[1];
    }, 0);
    let startAngle = -Math.PI / 2;

    entries.forEach(function(entry, index) {
      const slice = (entry[1] / total) * Math.PI * 2;

      context.beginPath();
      context.moveTo(centerX, centerY);
      context.arc(centerX, centerY, radius, startAngle, startAngle + slice);
      context.closePath();
      context.fillStyle = chartColors[index % chartColors.length];
      context.fill();

      startAngle += slice;
    });

    context.font = "14px Arial";
    context.textAlign = "left";
    context.textBaseline = "middle";

    entries.forEach(function(entry, index) {
      const x = 305;
      const y = 70 + index * 28;

      context.fillStyle = chartColors[index % chartColors.length];
      context.fillRect(x, y - 7, 14, 14);
      context.fillStyle = "#17202a";
      context.fillText(entry[0] + " - " + formatMoney(entry[1]), x + 24, y);
    });
  }

  function drawYearChart(yearlyReport) {
    if (yearlyReport.total.sum === 0) {
      drawEmptyChart(yearChart, "No yearly data yet");
      return;
    }

    const context = clearCanvas(yearChart);
    const maxValue = Math.max.apply(null, yearlyReport.months.map(function(item) {
      return item.sum;
    }));
    const left = 52;
    const right = 18;
    const top = 30;
    const bottom = 54;
    const chartWidth = yearChart.width - left - right;
    const chartHeight = yearChart.height - top - bottom;
    const barGap = 10;
    const barWidth = (chartWidth - barGap * 11) / 12;

    context.strokeStyle = "#d7dee8";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left, top);
    context.lineTo(left, top + chartHeight);
    context.lineTo(left + chartWidth, top + chartHeight);
    context.stroke();

    context.fillStyle = "#607080";
    context.font = "12px Arial";
    context.textAlign = "right";
    context.fillText(formatMoney(maxValue), left - 8, top + 4);
    context.fillText("$0", left - 8, top + chartHeight);

    yearlyReport.months.forEach(function(item, index) {
      const height = maxValue === 0 ? 0 : (item.sum / maxValue) * chartHeight;
      const x = left + index * (barWidth + barGap);
      const y = top + chartHeight - height;

      context.fillStyle = chartColors[index % chartColors.length];
      context.fillRect(x, y, barWidth, height);
      context.fillStyle = "#17202a";
      context.textAlign = "center";
      context.fillText(monthNames[index], x + barWidth / 2, top + chartHeight + 24);
    });
  }

  function renderReports() {
    const selectedMonth = Number(monthInput.value);
    const selectedYear = Number(yearInput.value);
    const selectedBarYear = Number(barYearInput.value);
    const monthlyReport = database.getReport(selectedYear, selectedMonth);
    const yearlyReport = database.getYearlyReport(selectedBarYear);
    const currentReport = database.getReport(today.getFullYear(), today.getMonth() + 1);

    reportSummary.textContent = formatMoney(monthlyReport.total.sum) + " total";
    yearSummary.textContent = formatMoney(yearlyReport.total.sum) + " total";
    currentMonthTotal.textContent = formatMoney(currentReport.total.sum);

    renderTable(monthlyReport);
    drawCategoryChart(monthlyReport);
    drawYearChart(yearlyReport);
  }

  costForm.addEventListener("submit", function(event) {
    event.preventDefault();

    try {
      database.addCost({
        sum: document.getElementById("sumInput").value,
        currency: document.getElementById("currencyInput").value,
        category: document.getElementById("categoryInput").value,
        description: document.getElementById("descriptionInput").value
      });

      costForm.reset();
      document.getElementById("currencyInput").value = "USD";
      renderReports();
      showToast("Cost added");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  reportForm.addEventListener("submit", function(event) {
    event.preventDefault();
    renderReports();
  });

  yearForm.addEventListener("submit", function(event) {
    event.preventDefault();
    renderReports();
  });

  renderReports();
})();

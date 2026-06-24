(function(global) {
  "use strict";

  const DEFAULT_DB_NAME = "costsdb";
  const DEFAULT_VERSION = 1;
  const STORAGE_PREFIX = "cost-manager:";

  let currentDatabaseName = DEFAULT_DB_NAME;
  let currentVersion = DEFAULT_VERSION;

  // Each database/version pair receives its own localStorage slot.
  function getStorageKey(databaseName, version) {
    return STORAGE_PREFIX + databaseName + ":v" + version;
  }

  function getCurrentStorageKey() {
    return getStorageKey(currentDatabaseName, currentVersion);
  }

  function readCosts() {
    const rawData = global.localStorage.getItem(getCurrentStorageKey());

    if (!rawData) {
      return [];
    }

    try {
      const parsedData = JSON.parse(rawData);
      return Array.isArray(parsedData) ? parsedData : [];
    } catch (error) {
      return [];
    }
  }

  function writeCosts(costs) {
    global.localStorage.setItem(getCurrentStorageKey(), JSON.stringify(costs));
  }

  function normalizeDate() {
    const sourceDate = new Date();

    return {
      year: sourceDate.getFullYear(),
      month: sourceDate.getMonth() + 1,
      day: sourceDate.getDate(),
      iso: sourceDate.toISOString()
    };
  }

  function normalizeCost(cost) {
    if (!cost || typeof cost !== "object") {
      throw new Error("Cost must be an object.");
    }

    const sum = Number(cost.sum);
    const currency = String(cost.currency || "USD").trim().toUpperCase();
    const category = String(cost.category || "").trim();
    const description = String(cost.description || "").trim();

    if (!Number.isFinite(sum) || sum <= 0) {
      throw new Error("Cost sum must be a positive number.");
    }

    if (!currency) {
      throw new Error("Cost currency is required.");
    }

    if (!category) {
      throw new Error("Cost category is required.");
    }

    if (!description) {
      throw new Error("Cost description is required.");
    }

    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      sum,
      currency,
      category,
      description,
      date: normalizeDate()
    };
  }

  function addCost(cost) {
    const newCost = normalizeCost(cost);
    const costs = readCosts();

    costs.push(newCost);
    writeCosts(costs);

    return {
      sum: newCost.sum,
      currency: newCost.currency,
      category: newCost.category,
      description: newCost.description
    };
  }

  function buildReport(costs, year, month, currency) {
    const filteredCosts = costs.filter(function(cost) {
      const matchesYear = typeof year === "number" ? cost.date.year === year : true;
      const matchesMonth = typeof month === "number" ? cost.date.month === month : true;
      const matchesCurrency = currency ? cost.currency === currency : true;

      return matchesYear && matchesMonth && matchesCurrency;
    });

    const total = filteredCosts.reduce(function(sum, cost) {
      return sum + Number(cost.sum);
    }, 0);

    return {
      year: typeof year === "number" ? year : null,
      month: typeof month === "number" ? month : null,
      costs: filteredCosts.map(function(cost) {
        return {
          sum: cost.sum,
          currency: cost.currency,
          category: cost.category,
          description: cost.description,
          date: {
            day: cost.date.day
          }
        };
      }),
      total: {
        currency: currency || "USD",
        sum: Number(total.toFixed(2))
      }
    };
  }

  function getReport(year, month) {
    const costs = readCosts();

    /* The assignment sample calls db.getReport("USD"). This keeps that sample usable. */
    if (arguments.length === 1 && typeof year === "string") {
      return buildReport(costs, null, null, year.toUpperCase());
    }

    const selectedYear = Number(year);
    const selectedMonth = Number(month);

    if (!Number.isInteger(selectedYear)) {
      throw new Error("Report year must be a number.");
    }

    if (!Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
      throw new Error("Report month must be a number between 1 and 12.");
    }

    return buildReport(costs, selectedYear, selectedMonth, "USD");
  }

  function getYearlyReport(year) {
    const selectedYear = Number(year);

    if (!Number.isInteger(selectedYear)) {
      throw new Error("Year must be a number.");
    }

    const costs = readCosts();
    const months = Array.from({ length: 12 }, function(_, index) {
      return {
        month: index + 1,
        sum: 0
      };
    });

    costs.forEach(function(cost) {
      if (cost.date.year === selectedYear && cost.currency === "USD") {
        months[cost.date.month - 1].sum += Number(cost.sum);
      }
    });

    return {
      year: selectedYear,
      months: months.map(function(item) {
        return {
          month: item.month,
          sum: Number(item.sum.toFixed(2))
        };
      }),
      total: {
        currency: "USD",
        sum: Number(months.reduce(function(total, item) {
          return total + item.sum;
        }, 0).toFixed(2))
      }
    };
  }

  function getAllCosts() {
    return readCosts();
  }

  function clearCosts() {
    writeCosts([]);
  }

  function openCostsDB(databaseName, version) {
    currentDatabaseName = databaseName || DEFAULT_DB_NAME;
    currentVersion = version || DEFAULT_VERSION;

    if (!global.localStorage.getItem(getCurrentStorageKey())) {
      writeCosts([]);
    }

    return {
      addCost,
      getReport,
      getYearlyReport,
      getAllCosts,
      clearCosts
    };
  }

  global.db = {
    openCostsDB,
    addCost,
    getReport,
    getYearlyReport,
    getAllCosts,
    clearCosts
  };
})(window);

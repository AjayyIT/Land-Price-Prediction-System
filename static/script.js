
"use strict";

/* ── Utility: format Indian currency ─────────────────────────────────────── */
function formatINR(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "₹ 0";
  if (num >= 1e7) return `₹ ${(num / 1e7).toFixed(2)} Cr`;
  if (num >= 1e5) return `₹ ${(num / 1e5).toFixed(2)} L`;
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatNum(value) {
  return parseFloat(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/* ── Form validation ─────────────────────────────────────────────────────── */
function validateForm() {
  const district      = document.getElementById("district").value;
  const area_type     = document.getElementById("area_type").value;
  const road_facility = document.getElementById("road_facility").value;
  const land_sqft     = parseFloat(document.getElementById("land_sqft").value);
  const school_km     = parseFloat(document.getElementById("school_km").value);
  const hospital_km   = parseFloat(document.getElementById("hospital_km").value);
  const bus_km        = parseFloat(document.getElementById("bus_km").value);
  const airport_km    = parseFloat(document.getElementById("airport_km").value);

  if (!district)                    return "Please select a District.";
  if (!area_type)                   return "Please select an Area Type.";
  if (!road_facility)               return "Please select Road Facility status.";
  if (!land_sqft || land_sqft < 100) return "Land size must be at least 100 sqft.";
  if (!school_km  || school_km  <= 0) return "Please enter School distance (km).";
  if (!hospital_km || hospital_km <= 0) return "Please enter Hospital distance (km).";
  if (!bus_km     || bus_km     <= 0) return "Please enter Bus Stand distance (km).";
  if (!airport_km || airport_km <= 0) return "Please enter Airport distance (km).";
  return null;
}

/* ── Show / hide error banner ────────────────────────────────────────────── */
function showError(msg) {
  const el = document.getElementById("errorBanner");
  el.textContent = msg;
  el.hidden = false;
}
function clearError() {
  document.getElementById("errorBanner").hidden = true;
}

/* ── Set submit button loading state ─────────────────────────────────────── */
function setLoading(loading) {
  const btn     = document.getElementById("submitBtn");
  const text    = btn.querySelector(".btn-text");
  const spinner = document.getElementById("spinner");

  btn.disabled        = loading;
  text.textContent    = loading ? "Analysing…" : "Predict Land Price";
  spinner.hidden      = !loading;
}

/* ── Render result cards ─────────────────────────────────────────────────── */
function renderResult(data) {
  document.getElementById("emptyState").hidden  = true;
  document.getElementById("resultCards").hidden = false;

  document.getElementById("resultMeta").textContent =
    data.fallback_used ? "⚠ Fallback data used" : `${data.sample_count} matching records`;

  document.getElementById("priceValue").textContent = formatINR(data.predicted_price);
  document.getElementById("priceSub").textContent   =
    `₹ ${formatNum(data.avg_price_sqft)} per sqft × ${formatNum(data.land_sqft)} sqft`;

  const investCard = document.getElementById("investCard");
  investCard.className = `investment-card color-${data.investment_color}`;
  document.getElementById("invType").textContent   = data.investment_type;
  document.getElementById("invReason").textContent = data.reason;
  document.getElementById("invMeta").textContent   =
    `Average facility distance: ${data.avg_distance} km`;

  document.getElementById("bkAvg").textContent     = `₹ ${formatNum(data.avg_price_sqft)}`;
  document.getElementById("bkSize").textContent    = `${formatNum(data.land_sqft)} sqft`;
  document.getElementById("bkTotal").textContent   = formatINR(data.predicted_price);
  document.getElementById("bkDist").textContent    = `${data.avg_distance} km`;
  document.getElementById("bkSamples").textContent =
    data.sample_count > 0 ? data.sample_count : "Fallback (district avg)";

  if (window.innerWidth <= 1024) {
    document.getElementById("resultPane").scrollIntoView({ behavior: "smooth" });
  }
}

/* ── Form submit handler ─────────────────────────────────────────────────── */
async function handleSubmit(e) {
  e.preventDefault();
  clearError();

  const error = validateForm();
  if (error) { showError(error); return; }

  setLoading(true);

  const payload = {
    district:      document.getElementById("district").value,
    area_type:     document.getElementById("area_type").value,
    road_facility: document.getElementById("road_facility").value,
    school_km:     parseFloat(document.getElementById("school_km").value),
    hospital_km:   parseFloat(document.getElementById("hospital_km").value),
    bus_km:        parseFloat(document.getElementById("bus_km").value),
    airport_km:    parseFloat(document.getElementById("airport_km").value),
    land_sqft:     parseFloat(document.getElementById("land_sqft").value),
  };

  try {
    const res  = await fetch("/predict", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      showError(data.error || "Prediction failed. Please try again.");
    } else {
      renderResult(data);
    }
  } catch (err) {
    showError("Network error. Is the Flask server running?");
    console.error(err);
  } finally {
    setLoading(false);
  }
}

/* ═══════════════════════════ CHARTS ═══════════════════════════════════════ */

Chart.defaults.color           = "#8ca4c8";
Chart.defaults.font.family     = "'Inter', sans-serif";
Chart.defaults.font.size       = 12;
Chart.defaults.plugins.legend.labels.color = "#8ca4c8";

const TEAL   = "rgba(0,212,170,0.85)";
const TEAL_D = "rgba(0,212,170,0.15)";
const BLUE   = "rgba(59,130,246,0.85)";
const AMBER  = "rgba(245,158,11,0.85)";
const GREEN  = "rgba(34,197,94,0.85)";
const gridColor = "rgba(30,48,87,0.6)";

function gridOpts() {
  return { color: gridColor, drawBorder: false };
}

/* District bar chart — top 6 only */
function buildDistrictChart(data) {
  const top6   = data.slice(0, 6); // backend already sorts desc, take first 6
  const labels = top6.map(d => d.District);
  const values = top6.map(d => d.avg);
  const colors = values.map((v, i) =>
    i === 0 ? AMBER :
    i === values.length - 1 ? "rgba(99,102,241,0.85)" : TEAL
  );

  new Chart(document.getElementById("districtChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Avg ₹/sqft",
        data:  values,
        backgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ₹ ${formatNum(ctx.parsed.y)} / sqft` }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: gridOpts(), beginAtZero: false,
             ticks: { callback: v => `₹${v}` } }
      }
    }
  });
}

/* Area type doughnut */
function buildAreaChart(data) {
  new Chart(document.getElementById("areaChart"), {
    type: "doughnut",
    data: {
      labels:   data.map(d => d.Area_Type),
      datasets: [{
        data:            data.map(d => d.avg),
        backgroundColor: [TEAL, BLUE, AMBER],
        borderColor:     "rgba(13,22,40,0.6)",
        borderWidth:     3,
        hoverOffset:     8,
      }]
    },
    options: {
      responsive: true,
      cutout: "65%",
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ₹${formatNum(ctx.parsed)} / sqft`
          }
        }
      }
    }
  });
}

/* Distance vs price line */
function buildDistPriceChart(data) {
  new Chart(document.getElementById("distPriceChart"), {
    type: "line",
    data: {
      labels: data.map(d => d.school_bucket),
      datasets: [{
        label:            "Avg ₹/sqft",
        data:             data.map(d => d.Price_per_sqft),
        borderColor:      TEAL,
        backgroundColor:  TEAL_D,
        fill:             true,
        tension:          0.4,
        pointRadius:      5,
        pointHoverRadius: 7,
        pointBackgroundColor: TEAL,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ₹ ${formatNum(ctx.parsed.y)} / sqft` }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: gridOpts(), ticks: { callback: v => `₹${v}` } }
      }
    }
  });
}

/* Road facility horizontal bar */
function buildRoadChart(data) {
  new Chart(document.getElementById("roadChart"), {
    type: "bar",
    data: {
      labels: data.map(d => d.Road_Facility === "Yes" ? "Road Available" : "No Road"),
      datasets: [{
        label:           "Avg ₹/sqft",
        data:            data.map(d => d.Price_per_sqft),
        backgroundColor: [GREEN, "rgba(239,68,68,0.75)"],
        borderRadius:    8,
        borderSkipped:   false,
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ₹ ${formatNum(ctx.parsed.x)} / sqft` }
        }
      },
      scales: {
        x: { grid: gridOpts(), ticks: { callback: v => `₹${v}` } },
        y: { grid: { display: false } }
      }
    }
  });
}

/* ── Load analytics data & render ────────────────────────────────────────── */
async function loadAnalytics() {
  try {
    const res  = await fetch("/analytics");
    const data = await res.json();
    if (data.error) { console.error("Analytics error:", data.error); return; }

    const s = data.summary;
    document.getElementById("hTotal").textContent     = s.total_records.toLocaleString("en-IN");
    document.getElementById("hAvg").textContent       = `₹${formatNum(s.avg_price)}`;
    document.getElementById("hMax").textContent       = `₹${formatNum(s.max_price)}`;
    document.getElementById("hDistricts").textContent = s.districts_count;

    buildDistrictChart(data.dist_stats);
    buildAreaChart(data.area_stats);
    buildRoadChart(data.road_stats);
    buildDistPriceChart(data.dist_price);

  } catch (err) {
    console.error("Failed to load analytics:", err);
  }
}

/* ── Initialise ──────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  loadAnalytics();
  document.getElementById("predictForm").addEventListener("submit", handleSubmit);

  // Active nav link on scroll
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
        const link = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (link) link.classList.add("active");
      }
    });
  }, { threshold: 0.4 });

  ["predict-section", "analytics-section"].forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
});

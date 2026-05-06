"""
AI-Based Land Price Prediction System - Tamil Nadu
Flask Backend with Prediction Logic and BI Analytics
"""

from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import os

app = Flask(__name__)

# ── Load Dataset ──────────────────────────────────────────────────────────────
CSV_PATH = os.path.join(os.path.dirname(__file__), "tamilnadu_land_dataset_10000.csv")

try:
    df = pd.read_csv(CSV_PATH, low_memory=False)
    # Normalise column names
    df.columns = df.columns.str.strip()
    # Drop rows with missing values in key columns
    df = df.dropna(subset=["District", "Area_Type", "Road_Facility", "Price_per_sqft"])
    # Ensure string columns are clean
    df["District"]      = df["District"].astype(str).str.strip()
    df["Area_Type"]     = df["Area_Type"].astype(str).str.strip()
    df["Road_Facility"] = df["Road_Facility"].astype(str).str.strip()
    print(f"[OK] Dataset loaded: {len(df)} rows, columns: {list(df.columns)}")
except FileNotFoundError:
    print(f"[WARN] CSV not found at {CSV_PATH}. Generating synthetic demo data.")
    import random

    DISTRICTS = [
        "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem",
        "Tirunelveli", "Erode", "Vellore", "Thoothukudi", "Dindigul",
        "Thanjavur", "Ranipet", "Sivaganga", "Virudhunagar", "Namakkal",
        "Karur", "Krishnagiri", "Dharmapuri", "Kancheepuram", "Chengalpattu",
        "Villupuram", "Cuddalore", "Nagapattinam", "Tiruvarur", "Pudukkottai",
        "Perambalur", "Ariyalur", "Kallakurichi", "Tirupattur", "Tenkasi",
        "Mayiladuthurai", "Ramanathapuram", "The Nilgiris"
    ]
    AREA_TYPES = ["Urban", "Rural", "Village"]
    ROAD = ["Yes", "No"]

    rows = []
    for _ in range(10000):
        dist = random.choice(DISTRICTS)
        area = random.choice(AREA_TYPES)
        road = random.choice(ROAD)
        school = round(random.uniform(0.5, 20), 1)
        hospital = round(random.uniform(0.5, 25), 1)
        bus = round(random.uniform(0.2, 15), 1)
        airport = round(random.uniform(1, 80), 1)

        # Price logic for realism
        base = {"Chennai": 4500, "Coimbatore": 3200, "Madurai": 2800}.get(dist, random.randint(800, 3000))
        multiplier = {"Urban": 1.4, "Rural": 1.0, "Village": 0.7}[area]
        road_bonus = 1.15 if road == "Yes" else 1.0
        dist_penalty = 1 - min((school + hospital + bus) / 200, 0.35)
        price = round(base * multiplier * road_bonus * dist_penalty * random.uniform(0.85, 1.15), 2)

        rows.append([dist, area, road, school, hospital, bus, airport, price])

    df = pd.DataFrame(rows, columns=[
        "District", "Area_Type", "Road_Facility",
        "School_Distance_km", "Hospital_Distance_km",
        "Bus_Stand_Distance_km", "Airport_Distance_km", "Price_per_sqft"
    ])
    df.to_csv(CSV_PATH, index=False)
    print(f"[OK] Synthetic dataset generated and saved: {len(df)} rows")


# ── Pre-computed analytics (cached at startup) ────────────────────────────────
DISTRICT_AVG    = df.groupby("District")["Price_per_sqft"].mean().round(2).to_dict()
DISTRICTS_LIST  = sorted(df["District"].unique().tolist())
AREA_TYPES_LIST = sorted(df["Area_Type"].unique().tolist())


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template(
        "index.html",
        districts=DISTRICTS_LIST,
        area_types=AREA_TYPES_LIST
    )


@app.route("/predict", methods=["POST"])
def predict():
    """
    Main prediction endpoint.
    Accepts JSON body with user inputs, returns prediction + investment analysis.
    """
    try:
        data = request.get_json(force=True)

        # ── Parse inputs ──────────────────────────────────────────────────────
        district      = str(data.get("district", "")).strip()
        area_type     = str(data.get("area_type", "")).strip()
        road_facility = str(data.get("road_facility", "")).strip()
        school_km     = float(data.get("school_km", 0))
        hospital_km   = float(data.get("hospital_km", 0))
        bus_km        = float(data.get("bus_km", 0))
        airport_km    = float(data.get("airport_km", 0))
        land_sqft     = float(data.get("land_sqft", 0))

        if land_sqft <= 0:
            return jsonify({"error": "Land size must be greater than 0"}), 400

        # ── Step 1: Filter by district / area_type / road ─────────────────────
        filtered = df[
            (df["District"]      == district)    &
            (df["Area_Type"]     == area_type)   &
            (df["Road_Facility"] == road_facility)
        ]

        # ── Step 2: Similarity window ─────────────────────────────────────────
        similar = filtered[
            (filtered["School_Distance_km"].between(school_km - 2,     school_km + 2))   &
            (filtered["Hospital_Distance_km"].between(hospital_km - 2, hospital_km + 2)) &
            (filtered["Bus_Stand_Distance_km"].between(bus_km - 2,     bus_km + 2))      &
            (filtered["Airport_Distance_km"].between(airport_km - 5,   airport_km + 5))
        ]

        fallback_used = False

        if len(similar) >= 3:
            avg_price_sqft = round(similar["Price_per_sqft"].mean(), 2)
            sample_count   = len(similar)
        elif len(filtered) >= 3:
            # Widen to district + area_type + road
            avg_price_sqft = round(filtered["Price_per_sqft"].mean(), 2)
            sample_count   = len(filtered)
            fallback_used  = True
        else:
            # Ultimate fallback: district average
            avg_price_sqft = round(DISTRICT_AVG.get(district, df["Price_per_sqft"].mean()), 2)
            sample_count   = 0
            fallback_used  = True

        # ── Step 3: Final price ───────────────────────────────────────────────
        predicted_price = round(avg_price_sqft * land_sqft, 2)

        # ── Step 4: Investment analysis ───────────────────────────────────────
        avg_distance = (school_km + hospital_km + bus_km + airport_km) / 4

        if area_type != "Village" and avg_distance < 5:
            investment_type = "Short-term Investment"
            investment_icon = "rocket"
            investment_color = "green"
            reason = (
                "Property is located close to essential facilities in a developed or "
                "semi-developed area, leading to faster growth and higher resale potential."
            )
        elif avg_distance > 8:
            investment_type = "Long-term Investment"
            investment_icon = "clock"
            investment_color = "amber"
            reason = (
                "Property is located far from key facilities, indicating slower development "
                "but potential future appreciation over time."
            )
        else:
            investment_type = "Moderate Investment"
            investment_icon = "balance"
            investment_color = "blue"
            reason = (
                "Property has balanced access to facilities, offering steady growth "
                "and moderate returns."
            )

        return jsonify({
            "predicted_price":   predicted_price,
            "avg_price_sqft":    avg_price_sqft,
            "land_sqft":         land_sqft,
            "investment_type":   investment_type,
            "investment_icon":   investment_icon,
            "investment_color":  investment_color,
            "reason":            reason,
            "sample_count":      sample_count,
            "fallback_used":     fallback_used,
            "avg_distance":      round(avg_distance, 2)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/analytics")
def analytics():
    """
    Returns pre-computed BI analytics for charts.
    """
    try:
        # Price by district (top 15 by avg)
        dist_stats = (
            df.groupby("District")["Price_per_sqft"]
            .agg(["mean", "min", "max", "count"])
            .round(2)
            .reset_index()
            .rename(columns={"mean": "avg", "count": "records"})
            .sort_values("avg", ascending=False)
            .head(15)
        )

        # Area type comparison
        area_stats = (
            df.groupby("Area_Type")["Price_per_sqft"]
            .agg(["mean", "min", "max", "count"])
            .round(2)
            .reset_index()
            .rename(columns={"mean": "avg", "count": "records"})
        )

        # Distance vs price buckets (school distance)
        df["school_bucket"] = pd.cut(
            df["School_Distance_km"],
            bins=[0, 2, 5, 10, 15, 100],
            labels=["0-2 km", "2-5 km", "5-10 km", "10-15 km", "15+ km"]
        )
        dist_price = (
            df.groupby("school_bucket", observed=True)["Price_per_sqft"]
            .mean().round(2).reset_index()
        )

        # Road facility comparison
        road_stats = (
            df.groupby("Road_Facility")["Price_per_sqft"]
            .mean().round(2).reset_index()
        )

        # Summary KPIs
        summary = {
            "total_records":   len(df),
            "avg_price":       round(df["Price_per_sqft"].mean(), 2),
            "max_price":       round(df["Price_per_sqft"].max(), 2),
            "min_price":       round(df["Price_per_sqft"].min(), 2),
            "districts_count": df["District"].nunique(),
        }

        return jsonify({
            "summary":       summary,
            "dist_stats":    dist_stats.to_dict(orient="records"),
            "area_stats":    area_stats.to_dict(orient="records"),
            "dist_price":    dist_price.to_dict(orient="records"),
            "road_stats":    road_stats.to_dict(orient="records"),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)

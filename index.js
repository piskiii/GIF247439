const express = require("express");
const sql = require("mssql");

const app = express();
const port = process.env.PORT || 3000;

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

app.use(express.json());

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(dbConfig);
  }
  return poolPromise;
}

app.post("/login", async (req, res) => {
  const { username } = req.body;

  if (!username || typeof username !== "string" || !username.trim()) {
    return res.status(400).json({ error: "Missing username" });
  }

  try {
    const pool = await getPool();
    const normalizedUsername = username.trim();

    const existing = await pool
      .request()
      .input("username", sql.NVarChar(50), normalizedUsername)
      .query("SELECT id FROM Users WHERE username = @username");

    if (existing.recordset.length > 0) {
      return res.json({ user_id: existing.recordset[0].id });
    }

    const insert = await pool
      .request()
      .input("username", sql.NVarChar(50), normalizedUsername)
      .query("INSERT INTO Users (username) OUTPUT INSERTED.id VALUES (@username)");

    return res.json({ user_id: insert.recordset[0].id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "DB error" });
  }
});

app.post("/workouts", async (req, res) => {
  const { user_id, date } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "Missing user_id" });
  }

  try {
    const pool = await getPool();
    const request = pool.request().input("user_id", sql.Int, Number(user_id));
    let query = "INSERT INTO Workouts (user_id) OUTPUT INSERTED.id, INSERTED.date VALUES (@user_id)";

    if (date) {
      request.input("date", sql.DateTime, new Date(date));
      query = "INSERT INTO Workouts (user_id, date) OUTPUT INSERTED.id, INSERTED.date VALUES (@user_id, @date)";
    }

    const result = await request.query(query);
    return res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "DB error" });
  }
});

app.post("/workouts/:workoutId/sets", async (req, res) => {
  const { workoutId } = req.params;
  const { exercise, weight, reps } = req.body;

  if (!exercise || reps == null) {
    return res.status(400).json({ error: "Missing exercise or reps" });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("workout_id", sql.Int, Number(workoutId))
      .input("exercise", sql.NVarChar(100), exercise.trim())
      .input("weight", sql.Float, Number(weight || 0))
      .input("reps", sql.Int, Number(reps))
      .query(
        "INSERT INTO [Sets] (workout_id, exercise, weight, reps) OUTPUT INSERTED.id, INSERTED.exercise, INSERTED.weight, INSERTED.reps VALUES (@workout_id, @exercise, @weight, @reps)"
      );

    return res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "DB error" });
  }
});

app.get("/db-test", async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1");
    res.send("DB OK");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

app.get("/users/:userId/workouts", async (req, res) => {
  const { userId } = req.params;

  try {
    const pool = await getPool();
    const workouts = await pool
      .request()
      .input("user_id", sql.Int, Number(userId))
      .query("SELECT id, [date] FROM Workouts WHERE user_id = @user_id ORDER BY [date] DESC");

    const sets = await pool
      .request()
      .input("user_id", sql.Int, Number(userId))
      .query(
        "SELECT s.id, s.workout_id, s.exercise, s.weight, s.reps FROM [Sets] s INNER JOIN Workouts w ON s.workout_id = w.id WHERE w.user_id = @user_id ORDER BY s.id DESC"
      );

    const byWorkout = {};
    for (const set of sets.recordset) {
      if (!byWorkout[set.workout_id]) {
        byWorkout[set.workout_id] = [];
      }
      byWorkout[set.workout_id].push(set);
    }

    const data = workouts.recordset.map((w) => ({
      ...w,
      sets: byWorkout[w.id] || []
    }));

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "DB error" });
  }
});

app.get("/users/:userId/exercises", async (req, res) => {
  const { userId } = req.params;

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.Int, Number(userId))
      .query(
        "SELECT DISTINCT s.exercise FROM [Sets] s INNER JOIN Workouts w ON s.workout_id = w.id WHERE w.user_id = @user_id ORDER BY s.exercise"
      );

    return res.json(result.recordset.map((r) => r.exercise));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "DB error" });
  }
});

app.get("/users/:userId/progress", async (req, res) => {
  const { userId } = req.params;
  const { exercise } = req.query;

  if (!exercise || typeof exercise !== "string") {
    return res.status(400).json({ error: "Missing exercise query parameter" });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.Int, Number(userId))
      .input("exercise", sql.NVarChar(100), exercise)
      .query(
        "SELECT CONVERT(date, w.[date]) AS training_date, MAX(s.weight) AS max_weight, SUM(s.weight * s.reps) AS volume, SUM(s.reps) AS total_reps FROM [Sets] s INNER JOIN Workouts w ON s.workout_id = w.id WHERE w.user_id = @user_id AND s.exercise = @exercise GROUP BY CONVERT(date, w.[date]) ORDER BY training_date"
      );

    return res.json(result.recordset);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "DB error" });
  }
});

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Gym Progress Tracker</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        :root {
          --bg: #f4f8f3;
          --card: #ffffff;
          --text: #1f2937;
          --muted: #6b7280;
          --accent: #0f766e;
          --accent-soft: #ccfbf1;
          --danger: #b91c1c;
          --border: #d1d5db;
        }

        * { box-sizing: border-box; }

        body {
          margin: 0;
          font-family: "Trebuchet MS", "Segoe UI", sans-serif;
          background: radial-gradient(circle at 10% 10%, #d9f99d 0%, transparent 30%),
                      radial-gradient(circle at 90% 15%, #a7f3d0 0%, transparent 35%),
                      var(--bg);
          color: var(--text);
          min-height: 100vh;
          padding: 18px;
        }

        .app {
          max-width: 1080px;
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px;
          box-shadow: 0 12px 24px rgba(31, 41, 55, 0.08);
        }

        h1, h2, h3 { margin: 0 0 10px 0; }

        .muted { color: var(--muted); }

        .row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }

        input, select, button {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--border);
          font-size: 14px;
        }

        button {
          border: none;
          background: var(--accent);
          color: white;
          cursor: pointer;
          transition: transform 0.1s ease, opacity 0.2s ease;
        }

        button:hover { opacity: 0.92; }
        button:active { transform: translateY(1px); }

        button.secondary {
          background: #111827;
        }

        .hidden { display: none; }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .set-item {
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px;
          margin-top: 8px;
          background: #f9fafb;
        }

        .error {
          color: var(--danger);
          font-weight: 600;
          min-height: 22px;
        }

        @media (max-width: 880px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="app">
        <div class="card">
          <h1>Gym Progress Tracker</h1>
          <p class="muted">Loguj tréningy, zapisuj série a sleduj progres na grafoch.</p>
          <div id="error" class="error"></div>
        </div>

        <div id="loginCard" class="card">
          <h2>Login</h2>
          <div class="row">
            <input id="username" placeholder="Tvoje meno / nickname" maxlength="50">
            <button id="loginBtn">Login</button>
          </div>
        </div>

        <div id="appCard" class="hidden">
          <div class="grid">
            <div class="card">
              <h2>Nový tréning</h2>
              <div class="row">
                <input id="workoutDate" type="datetime-local">
                <button id="createWorkoutBtn">Vytvoriť tréning</button>
              </div>
              <p id="activeWorkout" class="muted">Žiadny aktívny tréning.</p>

              <h3>Pridať sériu</h3>
              <div class="row">
                <input id="exercise" placeholder="Cvik (napr. Bench Press)">
                <input id="weight" type="number" step="0.5" placeholder="Váha (kg)">
                <input id="reps" type="number" placeholder="Opakovania">
                <button id="addSetBtn">Pridať</button>
              </div>

              <div id="currentSets"></div>
            </div>

            <div class="card">
              <h2>Progres</h2>
              <div class="row">
                <select id="exerciseSelect"></select>
                <button class="secondary" id="refreshProgressBtn">Načítať graf</button>
              </div>
              <canvas id="progressChart" height="240"></canvas>
            </div>
          </div>

          <div class="card">
            <h2>História tréningov</h2>
            <div id="workoutHistory" class="muted">Zatiaľ bez tréningov.</div>
          </div>
        </div>
      </div>

      <script>
        const state = {
          userId: null,
          activeWorkoutId: null,
          workouts: [],
          chart: null
        };

        const errorEl = document.getElementById("error");
        const loginCard = document.getElementById("loginCard");
        const appCard = document.getElementById("appCard");
        const activeWorkoutEl = document.getElementById("activeWorkout");
        const currentSetsEl = document.getElementById("currentSets");
        const workoutHistoryEl = document.getElementById("workoutHistory");
        const exerciseSelect = document.getElementById("exerciseSelect");

        function setError(message) {
          errorEl.textContent = message || "";
        }

        async function api(path, options = {}) {
          const res = await fetch(path, {
            headers: { "Content-Type": "application/json" },
            ...options
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || "Request failed");
          }

          return data;
        }

        function renderCurrentSets() {
          if (!state.activeWorkoutId) {
            currentSetsEl.innerHTML = "";
            return;
          }

          const workout = state.workouts.find((w) => w.id === state.activeWorkoutId);
          if (!workout || !workout.sets.length) {
            currentSetsEl.innerHTML = "<p class='muted'>Zatiaľ žiadne série.</p>";
            return;
          }

          currentSetsEl.innerHTML = workout.sets
            .map(
              (s, idx) =>
                "<div class='set-item'>" +
                "#" + (idx + 1) + " - " + s.exercise + " | " + s.weight + " kg x " + s.reps +
                "</div>"
            )
            .join("");
        }

        function renderHistory() {
          if (!state.workouts.length) {
            workoutHistoryEl.textContent = "Zatiaľ bez tréningov.";
            return;
          }

          workoutHistoryEl.innerHTML = state.workouts
            .map((w) => {
              const lines = w.sets
                .map((s) => "<li>" + s.exercise + ": " + s.weight + " kg x " + s.reps + "</li>")
                .join("");
              return (
                "<div class='set-item'><strong>" +
                new Date(w.date).toLocaleString() +
                "</strong><ul>" +
                lines +
                "</ul></div>"
              );
            })
            .join("");
        }

        async function refreshWorkouts() {
          state.workouts = await api("/users/" + state.userId + "/workouts");
          renderCurrentSets();
          renderHistory();
        }

        async function refreshExercises() {
          const exercises = await api("/users/" + state.userId + "/exercises");
          exerciseSelect.innerHTML = "";

          if (!exercises.length) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "Najprv pridaj série";
            exerciseSelect.appendChild(option);
            return;
          }

          for (const name of exercises) {
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            exerciseSelect.appendChild(option);
          }
        }

        async function loadProgress() {
          const exercise = exerciseSelect.value;
          if (!exercise) {
            return;
          }

          const points = await api(
            "/users/" + state.userId + "/progress?exercise=" + encodeURIComponent(exercise)
          );

          const labels = points.map((p) => new Date(p.training_date).toLocaleDateString());
          const maxWeight = points.map((p) => Number(p.max_weight || 0));
          const volume = points.map((p) => Number(p.volume || 0));

          const ctx = document.getElementById("progressChart");
          if (state.chart) {
            state.chart.destroy();
          }

          state.chart = new Chart(ctx, {
            type: "line",
            data: {
              labels,
              datasets: [
                {
                  label: "Max váha (kg)",
                  data: maxWeight,
                  borderColor: "#0f766e",
                  backgroundColor: "rgba(15, 118, 110, 0.15)",
                  tension: 0.25,
                  yAxisID: "y"
                },
                {
                  label: "Objem (kg)",
                  data: volume,
                  borderColor: "#1d4ed8",
                  backgroundColor: "rgba(29, 78, 216, 0.15)",
                  tension: 0.25,
                  yAxisID: "y1"
                }
              ]
            },
            options: {
              responsive: true,
              interaction: { mode: "index", intersect: false },
              scales: {
                y: { position: "left", beginAtZero: true },
                y1: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false } }
              }
            }
          });
        }

        document.getElementById("loginBtn").addEventListener("click", async () => {
          setError("");
          try {
            const username = document.getElementById("username").value;
            const data = await api("/login", {
              method: "POST",
              body: JSON.stringify({ username })
            });

            state.userId = data.user_id;
            loginCard.classList.add("hidden");
            appCard.classList.remove("hidden");

            await refreshWorkouts();
            await refreshExercises();
            await loadProgress();
          } catch (err) {
            setError(err.message);
          }
        });

        document.getElementById("createWorkoutBtn").addEventListener("click", async () => {
          setError("");
          try {
            const date = document.getElementById("workoutDate").value;
            const payload = { user_id: state.userId };
            if (date) {
              payload.date = date;
            }

            const workout = await api("/workouts", {
              method: "POST",
              body: JSON.stringify(payload)
            });

            state.activeWorkoutId = workout.id;
            activeWorkoutEl.textContent = "Aktívny tréning ID: " + workout.id;
            await refreshWorkouts();
          } catch (err) {
            setError(err.message);
          }
        });

        document.getElementById("addSetBtn").addEventListener("click", async () => {
          setError("");
          try {
            if (!state.activeWorkoutId) {
              throw new Error("Najprv vytvor tréning.");
            }

            const exercise = document.getElementById("exercise").value;
            const weight = document.getElementById("weight").value;
            const reps = document.getElementById("reps").value;

            await api("/workouts/" + state.activeWorkoutId + "/sets", {
              method: "POST",
              body: JSON.stringify({ exercise, weight, reps })
            });

            document.getElementById("exercise").value = "";
            document.getElementById("weight").value = "";
            document.getElementById("reps").value = "";

            await refreshWorkouts();
            await refreshExercises();
          } catch (err) {
            setError(err.message);
          }
        });

        document.getElementById("refreshProgressBtn").addEventListener("click", async () => {
          setError("");
          try {
            await loadProgress();
          } catch (err) {
            setError(err.message);
          }
        });
      </script>
    </body>
    </html>
  `);
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});